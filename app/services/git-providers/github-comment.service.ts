import { App } from "octokit";
import { logger } from "@trigger.dev/sdk/v3";
import { ProcessCommentWebhookTaskPayload } from "@/app/trigger/process-comment-webhook";
import { Comment, GithubPullRequestComment } from "@/app/interfaces/comment-handler.interface";
import { isAiBot } from "@/app/utils/comment-utils";
import { AIService } from "../ai.service";
import { NextResponse } from "next/server";

export class GithubCommentService {
  protected app = new App({
    appId: process.env.GITHUB_APP_CLIENT_ID as string,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY as string,
  });

  protected octokit!: Awaited<ReturnType<typeof this.app.getInstallationOctokit>>;
  private aiService: AIService;

  constructor(protected payload: ProcessCommentWebhookTaskPayload) {
    this.aiService = new AIService();
  }

  public async initialize(): Promise<void> {
    this.octokit = await this.app.getInstallationOctokit(this.payload.installation.id);
  }

  public async processGithubComment() {
    try {
      if (this.payload.comment.in_reply_to_id) {
        const commentThread = await this.getCommentThread();

        console.log(commentThread)
      }
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
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
          {
            owner,
            repo,
            pull_number: prNumber
          }
        );

        const threadComments = allComments.filter(
          (comment) =>
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
              path: this.payload.comment.path,
              position: this.payload.comment.position,
              line: this.payload.comment.line,
              side: this.payload.comment.side,
              commit_id: this.payload.comment.commit_id,
              pull_request_review_id: this.payload.comment.pull_request_review_id,
              diff_hunk: this.payload.comment.diff_hunk,
              original_position: this.payload.comment.original_position,
              start_line: this.payload.comment.start_line,
              original_line: this.payload.comment.original_line,
              subject_type: this.payload.comment.subject_type,
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
}
