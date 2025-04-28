import { logger } from "@trigger.dev/sdk/v3";
import { Comment, CommentWebhookPayload } from "../interfaces/comment-handler.interface";

/**
 * List of bot usernames that might be used by the AI
 */
export const BOT_USERNAMES = ["docflamingo-app", "github-actions[bot]", "docflamingo"];

/**
 * Check if a comment is from the AI bot
 * @param username The username to check
 * @returns True if the username belongs to the AI bot
 */
export function isAiBot(username: string): boolean {
  const isBot = BOT_USERNAMES.includes(username);
  logger.info(`Checking if ${username} is an AI bot: ${isBot}`);
  return isBot;
}

/**
 * Check if a comment is a reply to an AI-generated comment
 * @param payload The webhook payload
 * @param commentThread The thread of comments
 * @returns True if the comment is a reply to an AI-generated comment
 */
export function isReplyToAiComment(payload: CommentWebhookPayload, commentThread: Comment[]): boolean {
  if (payload.comment.in_reply_to_id) {
    const parentComment = commentThread.find((comment) => comment.id === payload.comment.in_reply_to_id);

    if (parentComment && parentComment.isAiSuggestion) {
      return true;
    }

    logger.info(`Parent comment is not an AI suggestion or not found`);
    return false;
  }

  // If the comment mentions the AI bot, consider it a reply
  const commentBody = payload.comment.body.toLowerCase();
  const botMentioned = BOT_USERNAMES.some((name) => {
    const isMentioned = commentBody.includes(`@${name.toLowerCase()}`);
    if (isMentioned) {
      logger.info(`Comment mentions bot @${name}`);
    }
    return isMentioned;
  });

  if (botMentioned) {
    logger.info(`Comment mentions an AI bot`);
    return true;
  }

  // Check if the comment is in a thread started by the AI
  const firstComment = commentThread[0];
  if (firstComment && firstComment.isAiSuggestion) {
    logger.info(`Comment is in a thread started by the AI`);
    return true;
  }

  logger.info(`Comment is not a reply to an AI comment`);
  return false;
}

/**
 * Format a comment for logging (truncate long content)
 * @param comment The comment to format
 * @returns Formatted comment for logging
 */
export function formatCommentForLogging(comment: Comment): any {
  return {
    id: comment.id,
    user: comment.user,
    isAiSuggestion: comment.isAiSuggestion,
    createdAt: comment.createdAt,
    body: comment.body.length > 100 ? `${comment.body.substring(0, 100)}...` : comment.body,
    inReplyToId: comment.inReplyToId,
  };
}

/**
 * Extract owner, repo, and PR number from a GitHub PR URL
 * @param prUrl The PR URL
 * @returns Object containing owner, repo, and PR number
 */
export function extractPRInfo(prUrl: string): { owner: string; repo: string; prNumber: number } {
  // Example URL: https://github.com/owner/repo/pull/123
  const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);

  if (!match) {
    logger.error(`Failed to extract PR info from URL: ${prUrl}`);
    throw new Error(`Invalid PR URL: ${prUrl}`);
  }

  const [, owner, repo, prNumberStr] = match;
  const prNumber = parseInt(prNumberStr, 10);

  logger.info(`Extracted PR info: owner=${owner}, repo=${repo}, prNumber=${prNumber}`);

  return { owner, repo, prNumber };
}
