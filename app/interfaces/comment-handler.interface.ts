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

export interface GithubPullRequestComment {
  id: number;
  body: string | null;
  user?: {
    login: string;
    id: number;
  };
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
  path?: string;
  commit_id?: string;
  pull_request_review_id?: number | null;
  [key: string]: any;
}

export interface CommentContext {
  previousSuggestions: string[]; 
  fileContext: string;
  commentThread: string[];
  pullRequestDiff: string;
  fileName?: string;
  lineNumber?: number;
}

export interface CommentWebhookPayload {
  action: string;
  comment: {
    id: string;
    body: string;
    user: {
      login: string;
    };
    created_at: string;
    updated_at: string;
    in_reply_to_id?: string;
    commit_id?: string;
    pull_request_review_id?: number;
  };
  pull_request?: {
    number: number;
    body: string | null;
    user: {
      login: string;
    };
    url: string;
  };
  repository: {
    id: number;
    name: string;
  };
  installation: {
    id: number;
  };
}
