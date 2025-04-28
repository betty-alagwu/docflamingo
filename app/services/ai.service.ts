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

    // Validate the installations data
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

      console.log(text, "texttexttext");

      if (text) {
        try {
          const parsedResponse = this.parseAIResponse(text);
          logger.info(`AI response parsed successfully`);

          const review = parsedResponse.review;
          const allComments: FormattedComment[] = [];

          // Process code suggestions with their corresponding key issues
          if (review.codeSuggestions && review.codeSuggestions.length > 0) {
          const keyIssuesMap = new Map<string, KeyIssue>();

          if (review.keyIssuesToReview && review.keyIssuesToReview.length > 0) {
            review.keyIssuesToReview.forEach(issue => {
              // Create a key using file path and line numbers
              const key = `${issue.relevantFile}:${issue.startLine}`;
              keyIssuesMap.set(key, issue);
            });
          }

          const suggestionComments = this.formatCodeSuggestionsWithKeyIssues(
            review.codeSuggestions,
            keyIssuesMap
          );
          allComments.push(...suggestionComments);
        }

        // Post all comments to GitHub
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

      // Determine the issue header and content
      let issueHeader = "Code Suggestion";
      let issueContent = suggestion.explanation;

      if (keyIssue) {
        // Use the key issue's header and content if available
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

      // Process each file to find the actual changed lines
      const fileChanges = new Map<string, Set<number>>();

      for (const file of prFiles) {
        if (!file.patch) continue

        const changedLines = new Set<number>();
        const patchLines = file.patch.split('\n');
        let currentLine = 0;

        const hunkHeaderMatch = file.patch.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
        if (hunkHeaderMatch) {
          currentLine = parseInt(hunkHeaderMatch[1], 10);
        }

        // Process each line in the patch
        for (const line of patchLines) {
          if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
            if (match) {
              currentLine = parseInt(match[1], 10);
            }
            continue;
          }

          if (line.startsWith('+') && !line.startsWith('+++')) {
            changedLines.add(currentLine);
          }

          // Increment line number for all lines except removed lines
          if (!line.startsWith('-') || line.startsWith('---')) {
            currentLine++;
          }
        }

        fileChanges.set(file.filename, changedLines);
      }

      // Map comments to the closest changed lines
      const mappedComments = reviewComments.map(comment => {
        const changedLines = fileChanges.get(comment.path);
        if (!changedLines || changedLines.size === 0) {
          return {
            ...comment,
            mappedLine: Number(comment.startLine)
          };
        }

        // Find the closest changed line to the comment's startLine
        const startLine = Number(comment.startLine);
        let closestLine = startLine;
        let minDistance = Number.MAX_SAFE_INTEGER;

        Array.from(changedLines).forEach(line => {
          const distance = Math.abs(line - startLine);
          if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
          }
        });

        return {
          ...comment,
          mappedLine: closestLine
        };
      });

      // First try to create a unified review with all comments
      try {
        const comments = mappedComments.map(comment => ({
          path: comment.path,
          line: comment.mappedLine,
          side: "RIGHT",
          body: comment.body
        }));

        await this.octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: commitId,
          event: 'COMMENT',
          comments: comments
        });

      } catch (reviewError) {
        for (let index = 0; index < mappedComments.length; index++) {
          const comment = mappedComments[index];

          logger.info(`Posting individual comment ${index + 1}/${mappedComments.length} for file ${comment.path}`);

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
      logger.info(`Cleaning AI response text for JSON parsing`);
      const jsonString = text.replace(/```json\n|```/g, "").trim();

      logger.info(`Parsing JSON string (length: ${jsonString.length})`);
      const parsedJson = JSON.parse(jsonString) as AIReviewResponse;

      // Validate the response structure
      if (!parsedJson.review) {
        logger.error(`Invalid AI response: Missing 'review' property`);
        throw new Error(`Invalid AI response: Missing 'review' property`);
      }

      logger.info(`Successfully parsed AI response JSON`);
      return parsedJson;
    } catch (error) {
      logger.error(`Error parsing AI response: ${error}`);
      logger.error(`AI response text (first 200 chars): ${text.substring(0, 200)}...`);
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
}
