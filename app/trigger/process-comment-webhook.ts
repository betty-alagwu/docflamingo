import { task } from "@trigger.dev/sdk/v3";
import { logger } from "@trigger.dev/sdk/v3";
import { prisma } from "../database/prisma";
import { GithubCommentService } from "../services/git-providers/github-comment.service";

export interface ProcessCommentWebhookTaskPayload {
  action: "created" | "edited" | "deleted";
  comment: {
    id: number;
    body: string;
    user: {
      login: string;
      id: number;
    };
    created_at: string;
    updated_at: string;
    in_reply_to_id?: number;
    html_url?: string;
    url?: string;
  };
  issue: {
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

      const isBotComment = await isCommentForBot(payload);

      if (!isBotComment) {
        return {
          message: "ignored",
          reason: "Comment not directed at bot"
        };
      }

      if (payload.action === "created") {
        const githubCommentService = new GithubCommentService(payload);
        await githubCommentService.initialize();
        const result = await githubCommentService.processGithubComment();
        return result;
      }

      return {
        message: "success",
        action: "no_action_needed"
      };
    } catch (error) {
      logger.error(`Error processing comment: ${error}`);
      return {
        message: "error",
        error: String(error)
      };
    }
  },
});

async function isCommentForBot(payload: ProcessCommentWebhookTaskPayload): Promise<boolean> {
  try {
    if (BOT_USERNAMES.includes(payload.comment.user.login)) {
      return false;
    }

    if (payload.comment.in_reply_to_id) {
      logger.info(`Reply detected to comment ID: ${payload.comment.in_reply_to_id}`);
      return true;
    }

    const commentBody = payload.comment.body.toLowerCase();
    const botMentions = BOT_USERNAMES.some(name =>
      commentBody.includes(`@${name.toLowerCase()}`)
    );

    if (botMentions) {
      logger.info(`Bot was mentioned in comment`);
      return true;
    }

    const triggerKeywords = ['help', 'explain', 'clarify', 'what do you mean', 'can you', 'please', 'thanks'];
    const containsTriggerKeyword = triggerKeywords.some(keyword =>
      commentBody.includes(keyword.toLowerCase())
    );

    if (containsTriggerKeyword) {
      logger.info(`Comment contains trigger keyword`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Error checking if comment is for bot: ${error}`);
    return false;
  }
}

export const BOT_USERNAMES = ['docflamingo-app', 'github-actions[bot]', 'docflamingo'];
