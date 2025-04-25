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

      if (text) {
        const parsedResponse = this.parseAIResponse(text);
        const review = parsedResponse.review;
        const allComments: FormattedComment[] = [];

        // Process code suggestions first (they're more detailed)
        if (review.codeSuggestions && review.codeSuggestions.length > 0) {
          const suggestionComments = this.formatCodeSuggestionsForGitHub(review.codeSuggestions);
          allComments.push(...suggestionComments);
        }

        // Post all comments to GitHub
        if (allComments.length > 0) {
          await this.postCommentToGitHub(owner, repo, prNumber, allComments);
        }
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Error analyzing pull request: ${error}`);
    }
  }

  private formatCodeSuggestionsForGitHub(
    codeSuggestions: CodeSuggestion[]
  ): FormattedComment[] {
    return codeSuggestions.map((suggestion) => {
      const originalCode = suggestion.originalCode || suggestion.suggestedCode;

      // Extract filename without extension for use in the message
      const filename = suggestion.relevantFile
        .split("/")
        .pop() || ""  // Handle potential undefined with empty string fallback
        .replace(/\.[^/.]+$/, "");

      // Determine if this is a method-related issue
      const isMethodIssue =
        suggestion.explanation.toLowerCase().includes("method") ||
        originalCode.includes(".") ||
        suggestion.suggestedCode.includes(".");

      // Determine the issue type for better messaging
      let issueType = "Refactor suggestion";
      if (isMethodIssue) {
        issueType = "Method issue";
      } else if (suggestion.explanation.toLowerCase().includes("incomplete")) {
        issueType = "Incomplete code";
      }

      // Format as GitHub compatible comment with suggested code change in CodeRabbit style
      const body = `🔧 **${issueType}**

⚠️ **Potential issue**

${suggestion.explanation}

${
  originalCode !== suggestion.suggestedCode
    ? `\`${originalCode}\` is not valid TypeScript/JavaScript; the ${
        isMethodIssue
          ? "empty parenthesised expression causes a compile-time failure"
          : "code causes a compile-time failure"
      }.`
    : "The current implementation can be improved."
}

${
  isMethodIssue
    ? `Function \`${filename}\` still expects a working ${
        originalCode.split(".")[0]
      } connection, so the handler will explode at runtime even if the file manages to compile.`
    : ""
}

Recommended quick fix:

\`\`\`diff
- ${originalCode}
+ ${suggestion.suggestedCode}
\`\`\`

* ${
        isMethodIssue ? "Re-introduces the correct method name" : "Improves code correctness"
      } to ensure intended functionality.
* Prevents potential runtime errors.
* Ensures the code functions as intended.
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

      // Fetch the PR files to get the correct line numbers
      const { data: prFiles } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Prepare comments for the review
      const comments: Array<{
        path: string;
        body: string;
        line: number;
        side: string;
      }> = [];

      for (const comment of reviewComments) {
        // Find the corresponding file in the PR
        const prFile = prFiles.find((file: { filename: string; patch?: string }) => file.filename === comment.path);
        if (!prFile || !prFile.patch) {
          continue;
        }

        // Extract the diff hunk from the patch
        const patchLines = prFile.patch.split("\n");
        let diffHunk = "";
        let lineNumber = -1;
        let foundLine = false;

        // Extract the line mapping from the patch header
        const patchHeaderMatch = prFile.patch.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        if (!patchHeaderMatch) {
          logger.info(`Skipping comment for ${comment.path} - could not parse patch header`);
          continue;
        }

        const oldStart = parseInt(patchHeaderMatch[1], 10);
        const newStart = parseInt(patchHeaderMatch[3], 10);
        const lineOffset = newStart - oldStart;

        // Create a map of all changed lines in the patch
        const changedLines = new Set<number>();
        let currentLineNumber = newStart;

        // Process the patch to find all changed lines
        for (let i = 0; i < patchLines.length; i++) {
          const line = patchLines[i];

          // If this is a hunk header, reset the line number
          if (line.startsWith("@@")) {
            const hunkMatch = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (hunkMatch) {
              currentLineNumber = parseInt(hunkMatch[3], 10);
            }
            continue;
          }

          // Skip removed lines
          if (line.startsWith("-")) {
            continue;
          }

          // Mark added lines as changed
          if (line.startsWith("+")) {
            changedLines.add(currentLineNumber);
          }

          // Increment line number for context and added lines
          currentLineNumber++;
        }

        // Calculate the target line number
        lineNumber = comment.startLine + lineOffset;

        // Check if the line is part of the diff
        const isLineInDiff = changedLines.has(lineNumber);

        // If the line isn't in the diff, find the closest changed line
        if (!isLineInDiff) {
          logger.info(`Line ${lineNumber} in ${comment.path} is not part of the diff`);

          // Find the closest changed line
          let closestLine = -1;
          let minDistance = Number.MAX_SAFE_INTEGER;

          // Convert Set to Array for iteration
          Array.from(changedLines).forEach((changedLine) => {
            const distance = Math.abs(changedLine - lineNumber);
            if (distance < minDistance) {
              minDistance = distance;
              closestLine = changedLine;
            }
          });

          if (closestLine !== -1) {
            lineNumber = closestLine;
            foundLine = true;
          } else {
            foundLine = false;
          }
        } else {
          foundLine = true;
        }

        // Extract the diff hunk for the line
        if (foundLine) {
          // Find the hunk that contains this line
          let hunkStart = 0;
          for (let i = 0; i < patchLines.length; i++) {
            const line = patchLines[i];
            if (line.startsWith("@@")) {
              const hunkMatch = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
              if (hunkMatch) {
                const hunkNewStart = parseInt(hunkMatch[3], 10);
                const hunkNewLines = parseInt(hunkMatch[4], 10);
                const hunkNewEnd = hunkNewStart + hunkNewLines - 1;

                if (lineNumber >= hunkNewStart && lineNumber <= hunkNewEnd) {
                  // Found the right hunk
                  hunkStart = i;
                  diffHunk = line + "\n";
                  break;
                }
              }
            }
          }

          // Add context lines to the diff hunk
          if (hunkStart > 0) {
            // Add up to 5 lines of context
            const contextLines = patchLines.slice(hunkStart + 1, hunkStart + 6);
            diffHunk += contextLines.join("\n");
          }
        }

        // Only add line comments for lines that are part of the diff
        if (foundLine) {
          comments.push({
            path: comment.path,
            body: comment.body,
            line: lineNumber,
            side: "RIGHT",
          });
        }
      }

      // If we have comments, post them individually
      if (comments.length > 0) {
        // Post individual comments directly - more reliable than batch review
        for (const comment of comments) {
          try {
            await this.octokit.rest.pulls.createReviewComment({
              owner,
              repo,
              pull_number: prNumber,
              body: comment.body,
              commit_id: commitId,
              path: comment.path,
              line: comment.line,
              side: comment.side,
            });
            // Add a small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (commentError) {
            logger.info(`Error posting comment to ${comment.path}:${comment.line}: ${commentError}`);
            // Last resort: post as a regular PR comment
            try {
              await this.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: `**Comment for ${comment.path} line ${comment.line}**\n\n${comment.body}`,
              });
            } catch (commentError) {
              logger.error(`Failed to post as issue comment: ${commentError}`);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Error posting comment: ${error}`);
    }
  }

  private parseAIResponse(text: string): AIReviewResponse {
    const jsonString = text.replace(/```json\n|```/g, "").trim();
    return JSON.parse(jsonString) as AIReviewResponse;
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
