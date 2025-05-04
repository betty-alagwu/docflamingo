import { logger } from "@trigger.dev/sdk/v3";
import { Comment, CommentWebhookPayload } from "../interfaces/comment-handler.interface";

/**
 * List of bot usernames that might be used by the AI or other systems
 */
export const BOT_USERNAMES = [
  "docflamingo-app",
  "docflamingo-app[bot]",
  "docflamingo",
];

/**
 * Check if a comment is from the AI bot
 * @param username The username to check
 * @returns True if the username belongs to the AI bot
 */
export function isAiBot(username: string): boolean {
  if (!username) {
    return false;
  }
  const normalizedUsername = username.replace(/\[bot\]$/, "").trim();

  let isBot = BOT_USERNAMES.includes(username);

  if (!isBot) {
    isBot = BOT_USERNAMES.some((botName) => {
      const normalizedBotName = botName.replace(/\[bot\]$/, "").trim();
      return normalizedBotName === normalizedUsername;
    });
  }

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

    if (parentComment) {
      return true;
    }

    logger.info(`Parent comment is not an AI suggestion or not found`);
    return false;
  }

  // If the comment mentions the AI bot, consider it a reply
  const commentBody = payload.comment.body.toLowerCase();
  const botMentioned = BOT_USERNAMES.some((name) => {
    const isMentioned = commentBody.includes(`@${name.toLowerCase()}`);
    return isMentioned;
  });

  if (botMentioned) {
    return true;
  }

  const firstComment = commentThread[0];
  if (firstComment && firstComment.isAiSuggestion) {
    return true;
  }

  return false;
}
