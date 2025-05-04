export interface Comment {
  id: string;
  body: string;
  isAiSuggestion: boolean;
  createdAt: Date;
  user: string;
  inReplyToId?: string;
  path?: string;
  position?: number;
  line?: number;
  side?: string;
  commitId?: string;
  diffHunk?: string;
  originalPosition?: number;
  startLine?: number | null;
  originalLine?: number;
  subjectType?: string;
}

/**
 * Interface for GitHub Pull Request Comment
 */
export interface GithubPullRequestComment {
  id: number;
  body: string | null;
  user?: {
    login: string;
    id: number;
    type?: string;
  };
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
  path?: string;
  position?: number;
  line?: number;
  side?: string;
  commit_id?: string;
  pull_request_review_id?: number | null;
  diff_hunk?: string;
  original_position?: number;
  start_line?: number | null;
  original_line?: number;
  subject_type?: string;
  [key: string]: any; // Allow additional properties
}

export interface CommentContext {
  previousSuggestions: string[]; 
  fileContext: string;
  commentThread: string[];
  pullRequestDiff: string;
  fileName?: string;
  lineNumber?: number;
}

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
  changes?: {
    body?: {
      from: string;
    };
  };
  comment: {
    id: string;
    body: string;
    user: {
      login: string;
      id: number;
      type?: string;
    };
    created_at: string;
    updated_at: string;
    in_reply_to_id?: string;
    // Fields specific to PR review comments
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
  // This can be either issue (for issue_comment events) or pull_request (for pull_request_review_comment events)
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
      diff_url?: string;
      patch_url?: string;
      merged_at?: string | null;
    };
    state?: string;
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
    full_name?: string;
  };
  installation: {
    id: number;
  };
}
