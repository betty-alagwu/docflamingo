import { task } from "@trigger.dev/sdk/v3";
import { prisma } from "../database/prisma";
import { GithubCommentService } from "../services/git-providers/github-comment.service";
import { NextResponse } from "next/server";

export interface ProcessCommentWebhookTaskPayload {
  action: "created" | "edited" | "deleted";
  changes?: {
    body?: {
      from: string;
    };
  };
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
    position?: number;
    line?: number;
    side?: string;
    commit_id?: string;
    pull_request_review_id?: number;
    diff_hunk?: string;
    original_position?: number;
    start_line?: number | null;
    original_line?: number;
    subject_type?: string;
    performed_via_github_app?: {
      id: number;
      slug: string;
      name: string;
    };
  };
  issue?: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
      id: number;
    };
    pull_request?: {
      url: string;
      html_url?: string;
    };
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
    state?: string;
  };
  repository: {
    id: number;
    name: string;
    owner: {
      login: string;
    };
    full_name?: string;
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
        const result = await githubCommentService.processGithubComment();

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
