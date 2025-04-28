import { ProcessCommentWebhookTaskPayload } from "@/app/trigger/process-comment-webhook";
import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { Comment } from "@/app/interfaces/comment-handler.interface";
import { GitHubFileContent } from "@/app/interfaces/github-api.interface";
import { isAiBot } from "@/app/utils/comment-utils";
import { logger } from "@trigger.dev/sdk/v3";
import { App } from "octokit";
import { GithubService } from "./github.service";

export class GithubCommentService {
  protected app = new App({
    appId: process.env.GITHUB_APP_CLIENT_ID as string,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY as string,
  });

  protected octokit!: Awaited<ReturnType<typeof this.app.getInstallationOctokit>>;

  constructor(protected payload: ProcessCommentWebhookTaskPayload) {}

  public async initialize(): Promise<void> {
    this.octokit = await this.app.getInstallationOctokit(this.payload.installation.id);
  }

  public async processGithubComment(): Promise<{ message: string; action: string }> {
    try {
      if (this.payload.comment.in_reply_to_id) {
        const commentThread = await this.getCommentThread();

        if (commentThread.length === 0) {
          return {
            message: "success",
            action: "no_comments_found",
          };
        }

        const parentComment = commentThread.find(
          (comment) => comment.id === this.payload.comment.in_reply_to_id?.toString()
        );

        if (parentComment && parentComment.isAiSuggestion) {
          logger.info(`Found parent comment from AI bot: ${parentComment.id}`);

          // In Phase 3, this will be replaced with AI-generated response
          const response = `Thank you for your reply to our suggestion. We'll implement AI-generated responses in Phase 3.`;
        } else {
          logger.info(`Parent comment not found or not from AI bot`);
        }
      }

      return {
        message: "success",
        action: "no_action_needed",
      };
    } catch (error) {
      logger.error(`Error processing comment reply: ${error}`);
      // Return an error status instead of throwing
      return {
        message: "error",
        action: "processing_failed",
      };
    }
  }

  public async getCommentThread(): Promise<Comment[]> {
    try {
      const prNumber = this.payload.issue.number;
      
      const { data: comments } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        {
          owner: this.payload.repository.owner.login,
          repo: this.payload.repository.name,
          pull_number: prNumber,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );


      console.log(comments);

      return [this.convertGitHubComment(comments)]
    } catch (error: any) {
      if (error.response && error.response.status) {
        logger.error(`Status: ${error.response.status}, Message: ${error.response.data?.message}`);
      }

      return [];
    }
  }

  private convertGitHubComment(comment: any): Comment {
    try {
      if (!comment || !comment.id) {
        return {
          id: "unknown",
          body: "",
          isAiSuggestion: false,
          createdAt: new Date(),
          user: "unknown",
        };
      }

      return {
        id: comment.id.toString(),
        body: comment.body || "",
        isAiSuggestion: comment.user && isAiBot(comment.user.login),
        createdAt: new Date(comment.created_at || Date.now()),
        user: comment.user ? comment.user.login : "unknown",
        inReplyToId: comment.in_reply_to_id?.toString(),
      };
    } catch (error: any) {
      logger.error(`Error converting GitHub comment: ${error}`);
      return {
        id: "error",
        body: "",
        isAiSuggestion: false,
        createdAt: new Date(),
        user: "unknown",
      };
    }
  }
}
