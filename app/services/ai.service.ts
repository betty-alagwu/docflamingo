import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { App, Octokit } from "octokit";

export class AIService {
 private deepseek;
 private octokit!: Octokit
 private app;
 constructor() {
  if (!process.env.DEEPSEEK_API_KEY) {
   throw new Error('Missing DEEPSEEK_API_KEY environment variable');
  }

  if (!process.env.GITHUB_APP_CLIENT_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
   throw new Error('Missing GitHub App credentials');
  }

  this.deepseek = createDeepSeek({
   apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  });

  this.app = new App({
   appId: process.env.GITHUB_APP_CLIENT_ID as string,
   privateKey: process.env.GITHUB_APP_PRIVATE_KEY as string
  });
 }

 private async authenticate(owner: string, repo: string) {
  const { data: installations } = await this.app.octokit.request('GET /app/installations');
  const installation = installations.find((inst: any) => inst.account?.login === owner);

  if (!installation) {
   throw new Error(`No installation found for repository ${owner}/${repo}`);
  }

  this.octokit = await this.app.getInstallationOctokit(installation.id);
 }

 public async analyzePullRequest(patchDiff: string, owner: string, repo: string, prNumber: number) {
  try {
   await this.authenticate(owner, repo);

   const systemPrompt = this.generateSystemPrompt();
   const parsedPatches = this.parsePatch(patchDiff);
   const userPrompt = this.generateUserPrompt(parsedPatches);

   const { text } = await generateText({
    model: this.deepseek('deepseek-chat'),
    prompt: `${systemPrompt}\n\n${userPrompt}`,
   });

   console.log(userPrompt, text, 'parsedPatchesparsedPatchesparsedPatchesparsedPatchesparsedPatches')

   if (text) {
    const reviewComments = this.formatReviewForGitHubComment(text, parsedPatches);
    console.log(reviewComments, 'reviewCommentsreviewCommentsreviewComments')
    if(reviewComments.length > 0) {
     await this.postCommentToGitHub(owner, repo, prNumber, reviewComments)
    }
   }

   return { text };
  } catch (error) {
   throw new Error(`Error analyzing pull request: ${error}`);
  }
 }

 // Parse the patchDiff to track line numbers
 private parsePatch(patchDiff: string) {
  const patchLines = patchDiff.split("\n");
  let currentFile = "";
  let currentHunkStart = 0;
  let currentNewLine = 0;
  let lineOffset = 0;
  const changes = [];

  for (const line of patchLines) {
   if (line.startsWith('File: ')) {
    currentFile = line.replace('File: ', '').trim();

    // Parse hunk headers to get correct line numbers
   } else if (line.startsWith('@@')) {
    const match = /@@ -\d+,\d+ \+(\d+),\d+ @@/.exec(line);
    if (match) {
     currentNewLine = parseInt(match[1], 10) - 1;
     currentHunkStart = currentNewLine;
     lineOffset = 0;
    }

    // Track line changes
   } else if (line.startsWith('+')) {
    changes.push({ file: currentFile, line: currentNewLine, content: line.substring(1), type: 'added' });
    currentNewLine++
    changes.push({
     file: currentFile,
     line: currentNewLine,
     content: line.substring(1),
     type: 'added',
     position: lineOffset + (currentNewLine - currentHunkStart)
    });

    // Track removed lines but don't increment line number
   } else if (line.startsWith('-')) {
    changes.push({
     file: currentFile,
     line: currentNewLine,
     content: line.substring(1),
     type: 'removed',
     position: lineOffset + (currentNewLine - currentHunkStart)
    });

    // Context lines, increment line number
   } else if (!line.startsWith('@@') && !line.startsWith('File:')) {
    currentNewLine++;
   }
   lineOffset++; 
  }

  console.log(changes, 'changes')
  return changes;
 }

 private formatReviewForGitHubComment(text: string, parsedPatches: any[]): { relevantFile: string; body: string; startLine: number; endLine: number }[] {
  const jsonString = text.replace(/```json\n|```/g, '').trim()
  const review = JSON.parse(jsonString).review;

  let comments = []

  if (review.keyIssuesToReview && review.keyIssuesToReview.length > 0) {
   for (const issue of review.keyIssuesToReview) {
    // Find the relevant change
    const changes = parsedPatches.find(c => 
     c.file === issue.relevantFile && 
     c.line === issue.startLine && 
     c.type === 'added');

    if (changes) {
     const currentCode = changes.content;

     let suggestedCode = null;
      
      // Try to extract suggested code from the issue content
      if (issue.issueContent.includes('Consider using') || issue.issueContent.includes('should be')) {
       const regex = /(?:Consider using|should be|replace with|use instead)[:\s]+([\w\s<>\.]+)/i;
       const match = issue.issueContent.match(regex);
       if (match && match[1]) {
        suggestedCode = match[1].trim();
       }
      }

     comments.push({
      relevantFile: issue.relevantFile,
      body: `### Issue: ${issue.issueHeader}\n\n**Details:** ${issue.issueContent}`,
      startLine: issue.startLine,
      endLine: issue.endLine,
      suggestedCode: suggestedCode
     });
    }
   }
  }

  return comments;
 }

 private async postCommentToGitHub(owner: string, repo: string, prNumber: number, reviewComments: any[]) {
  try {
   // Get the latest commit SHA
   const { data: prData } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
   const commitId = prData.head.sha;

   
   // Start a new review
   const review = await this.octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: commitId,
    event: 'COMMENT'
   });
   
   for (const comment of reviewComments) {
    let body = comment.body;

    // Add suggestion if available
    if (comment.suggestedCode) {
     body += `\n\n\`\`\`suggestion\n${comment.suggestedCode}\n\`\`\``;
    }

    const res = await this.octokit.rest.pulls.createReviewComment({
     owner,
     repo,
     pull_number: prNumber,
     commit_id: commitId,
     body: comment.body,
     path: comment.relevantFile,
     line: comment.startLine,
     side: 'RIGHT'
    });

    console.log(res, '>>>>>>>>>>>>>res')
   }


    // Submit the review
    await this.octokit.rest.pulls.submitReview({
     owner,
     repo,
     pull_number: prNumber,
     review_id: review.data.id,
     event: 'COMMENT'
    });
 
  } catch (error) {
   throw new Error(`Error posting comment: ${error}`);
  }
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
    "securityConcerns": "Does this PR code introduce possible vulnerabilities such as exposure of sensitive information (e.g., API keys, secrets, passwords), or security concerns like SQL injection, XSS, CSRF, and others? Answer 'No' if there are no possible issues. If there are security concerns or issues, start your answer with a short header, such as: 'Sensitive information exposure: ...', 'SQL injection: ...' etc. Explain your answer. Be specific and give examples if possible"
  }
}
=====

Ensure the JSON output is well-formatted and includes all necessary fields as specified above.
"""`;
 }

 private generateUserPrompt(patchDiff: any) {
  return `Please review the following code changes:

 ${patchDiff}

 Provide a comprehensive review of these changes.`;
 }
}


