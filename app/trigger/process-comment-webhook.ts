import { task } from "@trigger.dev/sdk/v3";
import { prisma } from "../database/prisma";
import { GithubCommentService } from "../services/git-providers/github-comment.service";
import { NextResponse } from "next/server";

export interface ProcessCommentWebhookTaskPayload {
  action: "created" | "edited" | "deleted";
  comment: {
    id: number;
    body: string;
    user: {
      login: string;
      id: number;
      type?: string;
    };
    created_at: string;
    updated_at: string;
    in_reply_to_id?: number;
    html_url?: string;
    url?: string;
    path?: string;
    commit_id?: string;
    pull_request_review_id?: number;
  };

  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
      id: number;
    };
    url: string;
    html_url: string;
  };
  repository: {
    id: number;
    name: string;
    owner: {
      login: string;
    };
  };
  installation: {
    id: number;
  };
  conversation?: {
    isReplyToAiComment: boolean;
    parentCommentId?: number;
    threadId?: string;
  };
}

export const processCommentWebhookTask = task({
  id: "process-comment-webhook",
  async run(payload: ProcessCommentWebhookTaskPayload) {
    try {
      const installation = await prisma.installation.findFirst({
        where: {
          githubInstallationId: payload.installation.id,
        },
      });

      if (!installation) {
        throw new Error(`Installation with ID of ${payload.installation.id} not found`);
      }

      if (payload.action === "created") {
        const githubCommentService = new GithubCommentService(payload);
        await githubCommentService.initialize();
        const result = await githubCommentService.processGithubUserReply();

        return result;
      }

      if (payload.action === "edited") {
        // Handle edited comments
      }

      if (payload.action === "deleted") {
        // Handle deleted comments
      }

    } catch (error) {
      return NextResponse.json(
        { status: "error", message: `Error processing comment webhook: ${error}` },
        { status: 500 }
      );
    }
  },
});
