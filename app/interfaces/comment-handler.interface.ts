/**
 * Interfaces for PR comment handling system
 */

/**
 * Represents a comment in a GitHub PR
 */
export interface Comment {
  id: string;
  body: string;
  isAiSuggestion: boolean;
  createdAt: Date;
  user: string;
  inReplyToId?: string; // ID of the comment this is replying to
}

/**
 * Context information for a conversation in a PR
 */
export interface CommentContext {
  previousSuggestions: string[]; // Previous AI suggestions in the thread
  fileContext: string; // Code context around the comment
  commentThread: string[]; // All comments in the thread
  pullRequestDiff: string; // The PR diff
  fileName?: string; // The file being discussed
  lineNumber?: number; // The line number being discussed
}

/**
 * Interface for Git providers (e.g., GitHub)
 */
export interface GitProvider {
  /**
   * Get the full thread of comments related to a specific comment
   * @param commentId The ID of the comment
   * @returns Array of comments in the thread
   */
  getCommentThread(commentId: string): Promise<Comment[]>;
  
  /**
   * Reply to a comment
   * @param owner Repository owner
   * @param repo Repository name
   * @param prNumber Pull request number
   * @param commentId ID of the comment to reply to
   * @param response The response text
   */
  replyToComment(owner: string, repo: string, prNumber: number, commentId: string, response: string): Promise<void>;
}

/**
 * Interface for AI handlers
 */
export interface AIHandler {
  /**
   * Generate a response to a user's comment
   * @param prompt The prompt for the AI
   * @returns The AI's response
   */
  generateCommentResponse(prompt: string): Promise<string>;
}

/**
 * Interface for the PR conversation handler
 */
export interface PRConversationHandler {
  /**
   * Handle a user's response to an AI comment
   * @param commentId ID of the comment
   * @param userResponse The user's response text
   * @param owner Repository owner
   * @param repo Repository name
   * @param prNumber Pull request number
   */
  handleUserResponse(
    commentId: string,
    userResponse: string,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<void>;
}

/**
 * Interface for webhook payloads containing comment information
 */
export interface CommentWebhookPayload {
  action: string;
  comment: {
    id: string;
    body: string;
    user: {
      login: string;
      id: number;
    };
    created_at: string;
    updated_at: string;
    in_reply_to_id?: string;
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
    };
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
}
