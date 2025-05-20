import { App } from "octokit";
import { logger } from "@trigger.dev/sdk/v3";
import { ProcessCommentWebhookTaskPayload } from "@/app/trigger/process-comment-webhook";
import { Comment, GithubPullRequestComment } from "@/app/interfaces/comment-handler.interface";
import { isAiBot } from "@/app/utils/comment-utils";
import { AIService } from "../ai.service";
import { TokenHandler } from "../token-handler.service";
import { NextResponse } from "next/server";
import { env } from "@/app/config/env";

export class GithubCommentService {
  protected app = new App({
    appId: env.GITHUB_APP_CLIENT_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  protected octokit!: Awaited<ReturnType<typeof this.app.getInstallationOctokit>>;
  private aiService: AIService;
  private tokenHandler: TokenHandler;

  private readonly MAX_COMMENT_TOKENS = 3000; // Maximum tokens for comment processing
  private readonly OUTPUT_BUFFER_TOKENS = 1000;

  constructor(protected payload: ProcessCommentWebhookTaskPayload) {
    this.aiService = new AIService();

    const systemPrompt = this.aiService.getSystemPrompt();
    this.tokenHandler = new TokenHandler(systemPrompt, this.MAX_COMMENT_TOKENS, {
      OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: this.OUTPUT_BUFFER_TOKENS,
      OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: this.OUTPUT_BUFFER_TOKENS / 2
    });
  }

  public async initialize(): Promise<void> {
    this.octokit = await this.app.getInstallationOctokit(this.payload.installation.id);
  }

  public async processGithubUserReply() {
    try {
      if (this.payload.comment.in_reply_to_id) {
        const isUserComment = !isAiBot(this.payload.comment.user.login);

        if (!isUserComment) {
          return NextResponse.json({ status: "ignored", reason: "Comment is from the AI bot, not a user" });
        }

        const commentThread = await this.getCommentThread();

        if (commentThread.length > 0) {
          const parentComment = commentThread.find(
            (comment) => comment.id === this.payload.comment.in_reply_to_id?.toString()
          );

          if (parentComment && parentComment.isAiSuggestion) {
            if (!this.payload.pull_request) {
              return NextResponse.json({ status: "error", reason: "Pull request information not found" });
            }

            const owner = this.payload.repository.owner.login;
            const repo = this.payload.repository.name;
            const prNumber = this.payload.pull_request.number;

            try {
              await this.addReactionToComment(owner, repo, this.payload.comment.id.toString(), "eyes");
            } catch (reactionError) {
              logger.error(`Failed to add reaction to comment: ${reactionError}`);
            }

            const alreadyResponded = commentThread.some(comment =>
              comment.isAiSuggestion &&
              comment.inReplyToId === this.payload.comment.id.toString());

            if (alreadyResponded) {
              return NextResponse.json({ status: "ignored", reason: "Already responded to this comment" });
            }

            const prompt = this.buildPromptFromCommentThread(commentThread, this.payload.comment.body);
            const aiResponse = await this.aiService.generateCommentResponse(prompt);
            const responseTokens = this.tokenHandler.countTokens(aiResponse);
            const promptTokens = this.tokenHandler.countTokens(prompt);
            const totalTokens = promptTokens + responseTokens;

            logger.info(`Total tokens for this interaction: ${totalTokens} (prompt: ${promptTokens}, response: ${responseTokens})`);

            await this.replyToComment(owner, repo, prNumber, this.payload.comment.id.toString(), aiResponse);

            return NextResponse.json({ status: "success", message: "Replied to user comment" });
          }
        }

        return NextResponse.json({ status: "ignored", reason: "Not a reply to an AI-generated comment" });
      }

      return { status: "ignored", reason: "Not a reply to any comment" };
    } catch (error) {
      return NextResponse.json(
        { status: "error", message: `Error processing comment reply: ${error}` },
        { status: 500 }
      );
    }
  }

  public async getCommentThread(): Promise<Comment[]> {
    try {
      if (!this.payload.pull_request) return [];

      const owner = this.payload.repository.owner.login;
      const repo = this.payload.repository.name;
      const prNumber = this.payload.pull_request.number;

      if (this.payload.comment.in_reply_to_id) {
        const { data: allComments } = await this.octokit.request(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
          {
            owner,
            repo,
            pull_number: prNumber,
          }
        );

        let rootCommentId = this.payload.comment.in_reply_to_id;
        const rootComment = allComments.find(comment => comment.id === rootCommentId);

        if (rootComment && rootComment.in_reply_to_id) {
          rootCommentId = rootComment.in_reply_to_id;
        }

        const threadComments = allComments.filter(comment =>
          comment.id === rootCommentId ||
          comment.in_reply_to_id === rootCommentId ||
          comment.id === this.payload.comment.in_reply_to_id ||
          comment.in_reply_to_id === this.payload.comment.in_reply_to_id
        );

        logger.info(`Found ${threadComments.length} comments in this thread`);
        const currentCommentInThread = threadComments.some((comment) => comment.id === this.payload.comment.id);

        const mappedComments = threadComments.map((comment) => this.mapGithubComment(comment));

        if (!currentCommentInThread) {
          mappedComments.push(
            this.mapGithubComment({
              id: this.payload.comment.id,
              body: this.payload.comment.body,
              user: this.payload.comment.user,
              created_at: this.payload.comment.created_at,
              updated_at: this.payload.comment.updated_at,
              in_reply_to_id: this.payload.comment.in_reply_to_id,
              commit_id: this.payload.comment.commit_id,
            })
          );
        }

        return mappedComments;
      }

      return [];
    } catch (error) {
      logger.error(`Error retrieving comment thread: ${error}`);
      return [];
    }
  }

  private buildPromptFromCommentThread(commentThread: Comment[], userQuestion: string): string {
    const sortedComments = [...commentThread].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let conversationHistory = "Instructions:\n";
    conversationHistory += "1. Provide a single, concise, and helpful response to the user's question\n";
    conversationHistory += "2. Do not suggest additional questions or topics unless specifically asked\n";
    conversationHistory += "3. Keep your response focused and to the point\n";
    conversationHistory += "4. Do not repeat information that has already been provided\n\n";

    conversationHistory += `User: ${userQuestion}\n\n`;

    let tokensUsed = this.tokenHandler.countTokens(conversationHistory);

    let historyContent = "Previous conversation:\n";

    // Process comments from newest to oldest to prioritize recent context
    const reversedComments = [...sortedComments].reverse();

    for (const comment of reversedComments) {
      const role = comment.isAiSuggestion ? "AI" : "User";

      let commentBody = comment.body;
      if (commentBody.length > 500) {
        commentBody = commentBody.substring(0, 500) + "... (truncated)";
      }

      const commentText = `${role}: ${commentBody}\n\n`;
      const commentTokens = this.tokenHandler.countTokens(commentText);

      if (tokensUsed + commentTokens <= this.MAX_COMMENT_TOKENS - this.OUTPUT_BUFFER_TOKENS) {
        historyContent = commentText + historyContent; // Prepend to keep newest comments
        tokensUsed += commentTokens;
      } else {
        historyContent = "... (earlier conversation omitted due to token limits)\n\n" + historyContent;
        break;
      }
    }

    logger.info(`Comment thread prompt using ${tokensUsed} tokens out of ${this.MAX_COMMENT_TOKENS}`);
    return conversationHistory + historyContent;
  }

  private async replyToComment(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: string,
    response: string
  ): Promise<void> {
    try {
      await this.octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", {
        owner,
        repo,
        pull_number: prNumber,
        comment_id: parseInt(commentId),
        body: response,
      });
    } catch (error) {
      try {
        await this.octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
          owner,
          repo,
          issue_number: prNumber,
          body: `In reply to comment #${commentId}: ${response}`,
        });
      } catch (fallbackError) {
        throw new Error(`Failed to reply to comment: ${fallbackError}`);
      }
    }
  }

  private mapGithubComment(comment: GithubPullRequestComment): Comment {
    const commentId = comment.id.toString();
    const inReplyToId = comment.in_reply_to_id?.toString() || undefined;

    const isBot = isAiBot(comment.user?.login || "");

    return {
      id: commentId,
      body: comment.body || "",
      isAiSuggestion: isBot,
      createdAt: new Date(comment.created_at),
      user: comment.user?.login || "unknown",
      inReplyToId: inReplyToId,
      path: comment.path,
      position: comment.position,
      line: comment.line,
      side: comment.side,
      commitId: comment.commit_id,
      diffHunk: comment.diff_hunk,
      originalPosition: comment.original_position,
      startLine: comment.start_line,
      originalLine: comment.original_line,
      subjectType: comment.subject_type,
    };
  }

  private async addReactionToComment(
    owner: string,
    repo: string,
    commentId: string,
    reaction: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes"
  ): Promise<void> {
    try {
      await this.octokit.request('POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions', {
        owner,
        repo,
        comment_id: parseInt(commentId),
        content: reaction
      });
    } catch (error) {
      // If that fails, try to add reaction to an issue comment
      try {
        await this.octokit.request('POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
          owner,
          repo,
          comment_id: parseInt(commentId),
          content: reaction
        });
      } catch (fallbackError) {
        throw new Error(`Failed to add reaction to comment: ${fallbackError}`);
      }
    }
  }
}
