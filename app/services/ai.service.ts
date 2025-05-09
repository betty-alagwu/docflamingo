import { createDeepSeek } from "@ai-sdk/deepseek";
import { logger } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { App, Octokit } from "octokit";
import { z } from "zod";

interface CodeSuggestion {
  suggestedCode: string;
  originalCode: string;
  explanation: string;
  startLine: string | number;
  endLine: string | number;
  relevantFile: string;
}

interface KeyIssue {
  relevantFile: string;
  issueHeader: string;
  issueContent: string;
  startLine: string | number;
  endLine: string | number;
}

interface AIReviewResponse {
  review: {
    keyIssuesToReview?: KeyIssue[];
    codeSuggestions?: CodeSuggestion[];
    securityConcerns?: string;
  };
}

interface FormattedComment {
  path: string;
  body: string;
  startLine: number;
  endLine: number;
}

export class AIService {
  private deepseek;
  private octokit!: Octokit;
  private app;
  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }

    if (!process.env.GITHUB_APP_CLIENT_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
      throw new Error("Missing GitHub App credentials");
    }

    this.deepseek = createDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    });

    this.app = new App({
      appId: process.env.GITHUB_APP_CLIENT_ID as string,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY as string,
    });
  }

  accountSchema = z.object({
    login: z.string(),
  });
  installationSchema = z.object({
    id: z.number(),
    account: this.accountSchema,
  });
  installationsSchema = z.array(this.installationSchema);

  private async authenticate(owner: string, repo: string) {
    const { data: installations } = await this.app.octokit.request("GET /app/installations");
    const validatedInstallations = this.installationsSchema.parse(installations);
    const installation = validatedInstallations.find((inst) => inst.account?.login === owner);

    if (!installation) {
      throw new Error(`No installation found for repository ${owner}/${repo}`);
    }

    this.octokit = await this.app.getInstallationOctokit(installation.id);
  }

  public async analyzePullRequest(patchDiff: string, owner: string, repo: string, prNumber: number) {
    try {
      await this.authenticate(owner, repo);
      const systemPrompt = this.generateSystemPrompt();
      const userPrompt = this.generateUserPrompt(patchDiff);

      const { text } = await generateText({
        model: this.deepseek("deepseek-chat"),
        prompt: `${systemPrompt}\n\n${userPrompt}`,
      });

      if (text) {
        try {
          const parsedResponse = this.parseAIResponse(text);
          const review = parsedResponse.review;
          const allComments: FormattedComment[] = [];

          if (review.codeSuggestions && review.codeSuggestions.length > 0) {
            const keyIssuesMap = new Map<string, KeyIssue>();

            if (review.keyIssuesToReview && review.keyIssuesToReview.length > 0) {
              review.keyIssuesToReview.forEach((issue) => {
                const key = `${issue.relevantFile}:${issue.startLine}`;
                keyIssuesMap.set(key, issue);
              });
            }

            const suggestionComments = this.formatCodeSuggestionsWithKeyIssues(review.codeSuggestions, keyIssuesMap);
            allComments.push(...suggestionComments);
          }

          if (allComments.length > 0) {
            await this.postCommentToGitHub(owner, repo, prNumber, allComments);
          }
        } catch (parseError) {
          logger.error(`Error processing AI response: ${parseError}`);
          throw new Error(`Error processing AI response: ${parseError}`);
        }
      }
    } catch (error) {
      throw new Error(`Error analyzing pull request: ${error}`);
    }
  }

  private formatCodeSuggestionsWithKeyIssues(
    codeSuggestions: CodeSuggestion[],
    keyIssuesMap: Map<string, KeyIssue>
  ): FormattedComment[] {
    return codeSuggestions.map((suggestion) => {
      const originalCode = suggestion.originalCode || suggestion.suggestedCode;

      const suggestionKey = `${suggestion.relevantFile}:${suggestion.startLine}`;
      const keyIssue = keyIssuesMap.get(suggestionKey);

      let issueHeader = "";
      let issueContent = suggestion.explanation;

      if (keyIssue) {
        issueHeader = keyIssue.issueHeader;
        issueContent = keyIssue.issueContent;
      }

      const body = `🔧 **${issueHeader}**

⚠️ **Potential issue**

${issueContent}

${originalCode ? `Current code:\n\`${originalCode}\`` : ""}

Recommended fix:

\`\`\`diff
${originalCode ? `- ${originalCode}` : ""}
+ ${suggestion.suggestedCode}
\`\`\`

* Improves code correctness and functionality
* Addresses the issue described above
* Ensures the code works as intended
      `;

      return {
        path: suggestion.relevantFile,
        body: body,
        startLine: Number(suggestion.startLine),
        endLine: Number(suggestion.endLine),
      };
    });
  }

  private async postCommentToGitHub(owner: string, repo: string, prNumber: number, reviewComments: FormattedComment[]) {
    try {
      const { data: prData } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
      const commitId = prData.head.sha;

      const { data: prFiles } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      const fileChanges = new Map<string, Set<number>>();

      for (const file of prFiles) {
        if (!file.patch) continue;

        const changedLines = new Set<number>();
        const patchLines = file.patch.split("\n");
        let currentLine = 0;

        const hunkHeaderMatch = file.patch.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
        if (hunkHeaderMatch) {
          currentLine = parseInt(hunkHeaderMatch[1], 10);
        }

        for (const line of patchLines) {
          if (line.startsWith("@@")) {
            const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
            if (match) {
              currentLine = parseInt(match[1], 10);
            }
            continue;
          }

          if (line.startsWith("+") && !line.startsWith("+++")) {
            changedLines.add(currentLine);
          }

          if (!line.startsWith("-") || line.startsWith("---")) {
            currentLine++;
          }
        }

        fileChanges.set(file.filename, changedLines);
      }

      const mappedComments = reviewComments.map((comment) => {
        const changedLines = fileChanges.get(comment.path);
        if (!changedLines || changedLines.size === 0) {
          return {
            ...comment,
            mappedLine: Number(comment.startLine),
          };
        }

        // Find the closest changed line to the comment's startLine
        const startLine = Number(comment.startLine);
        let closestLine = startLine;
        let minDistance = Number.MAX_SAFE_INTEGER;

        Array.from(changedLines).forEach((line) => {
          const distance = Math.abs(line - startLine);
          if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
          }
        });

        return {
          ...comment,
          mappedLine: closestLine,
        };
      });

      try {
        const comments = mappedComments.map((comment) => ({
          path: comment.path,
          line: comment.mappedLine,
          side: "RIGHT",
          body: comment.body,
        }));

        await this.octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: commitId,
          event: "COMMENT",
          comments: comments,
        });
      } catch (reviewError) {
        for (let index = 0; index < mappedComments.length; index++) {
          const comment = mappedComments[index];

          try {
            const commentBody = `**Comment for ${comment.path} line ${comment.mappedLine}**\n\n${comment.body}`;
            await this.octokit.rest.issues.createComment({
              owner,
              repo,
              issue_number: prNumber,
              body: commentBody,
            });

            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (commentError) {
            logger.error(`Failed to post comment ${index + 1}: ${commentError}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Error posting comment: ${error}`);
    }
  }

  private parseAIResponse(text: string): AIReviewResponse {
    try {
      const jsonString = text.replace(/```json\n|```/g, "").trim();
      const parsedJson = JSON.parse(jsonString) as AIReviewResponse;

      if (!parsedJson.review) {
        throw new Error(`Invalid AI response: Missing 'review' property`);
      }

      return parsedJson;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error}`);
    }
  }

  public getSystemPrompt(): string {
    return this.generateSystemPrompt();
  }

  private generateSystemPrompt(): string {
    return `system="""You are PR-Reviewer, a language model designed to review a Git Pull Request (PR).
Your task is to provide constructive and concise feedback for the PR.
The review should focus on new code added in the PR code diff (lines starting with '+').

The format we will use to present the PR code diff:
======
File: 'src/file1.ts'
@@ -1,12 +1,8 @@
+new code line
-old code line
...

- The diff is presented with the filename and the code changes, where '+' indicates new code and '-' indicates removed code.
- Focus your review on the new code additions.
- Provide feedback on code quality, potential bugs, security concerns, performance implications, and best practices.
- IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any explanations or markdown formatting outside of the JSON.

The output must be a JSON object with the following structure:
=====
{
  "review": {
    "keyIssuesToReview": [
      {
        "relevantFile": "The full file path of the relevant file",
        "issueHeader": "One or two word title for the issue. For example: 'Possible Bug', etc.",
        "issueContent": "A short and concise summary of what should be further inspected and validated during the PR review process for this issue.",
        "startLine": "The start line that corresponds to this issue in the relevant file",
        "endLine": "The end line that corresponds to this issue in the relevant file"
      }
    ],
     "codeSuggestions": [
      {
        "suggestedCode": "The improved code suggestion",
        "originalCode": "The original code that needs to be changed",
        "explanation": "Why this change is beneficial (performance, readability, security, etc.)",
        "startLine": "Start line of the suggested change",
        "endLine": "End line of the suggested change",
        "relevantFile": "The full file path of the relevant file"
      }
    ],
    "securityConcerns": "Does this PR code introduce possible vulnerabilities such as exposure of sensitive information (e.g., API keys, secrets, passwords), or security concerns like SQL injection, XSS, CSRF, and others? Answer 'No' if there are no possible issues. If there are security concerns or issues, start your answer with a short header, such as: 'Sensitive information exposure: ...', 'SQL injection: ...' etc. Explain your answer. Be specific and give examples if possible"
  }
}
=====

Ensure the JSON output is well-formatted and includes all necessary fields as specified above.
"""`;
  }

  private generateUserPrompt(patchDiff: string) {
    return `Please review the following code changes:

 ${patchDiff}

 Provide a comprehensive review of these changes.`;
  }

  public async generateCommentResponse(prompt: string): Promise<string> {
    try {
      const systemPrompt = `system="""You are an AI assistant helping with code-related questions in a GitHub pull request.
Your task is to provide helpful, accurate, and concise responses to user questions.
Be friendly and professional in your responses.
If you're unsure about something, acknowledge the limitations of your knowledge.

IMPORTANT GUIDELINES:
1. Keep your responses focused and to the point
2. Provide a single, direct answer to the user's question
3. Do not suggest additional questions or topics unless specifically asked
4. Do not repeat information that has already been provided
5. Do not include meta-commentary about your role or capabilities
6. Avoid phrases like "Here's a response..." or "Here's what you could say..."
7. Just answer the question directly without unnecessary preamble
"""`;

      const { text } = await generateText({
        model: this.deepseek("deepseek-chat"),
        prompt: `${systemPrompt}\n\n${prompt}`,
        maxTokens: 1000, // Limit response length
      });

      return text;
    } catch (error) {
      logger.error(`Error generating comment response: ${error}`);
      throw new Error(`Error generating comment response: ${error}`);
    }
  }
}
