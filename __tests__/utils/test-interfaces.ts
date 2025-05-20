import type { Octokit } from 'octokit';

/**
 * Octokit Mock Interface
 */
export interface MockOctokitClient {
  request: jest.Mock;
  rest?: {
    pulls: {
      get: jest.Mock;
      listFiles: jest.Mock;
      createReviewComment: jest.Mock;
    };
    issues: {
      createComment: jest.Mock;
    };
  };
}

export interface MockOctokitApp {
  getInstallationOctokit: jest.Mock<Promise<MockOctokitClient>>;
}

/**
 * AI Service Mock Interface
 */
export interface MockAIService {
  getSystemPrompt: jest.Mock<string>;
  analyzePullRequest: jest.Mock<Promise<void>>;
}

/**
 * Token Handler Mock Interface
 */
export interface MockTokenHandler {
  processFiles: jest.Mock<Promise<string>>;
}

/**
 * FilePatchInfo Interface
 */
export interface FilePatchInfo {
  filename: string;
  newContent: {
    content: string;
  };
  originalContent: {
    content: string;
  };
  patch?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  num_plus_lines?: number;
  num_minus_lines?: number;
}

/**
 * AI Service Private Method Interface
 */
export interface CodeSuggestion {
  suggestedCode: string;
  originalCode: string;
  explanation: string;
  startLine: number | string;
  endLine: number | string;
  relevantFile: string;
}

/**
 * Comment Formatting Interface
 */
export interface FormattedComment {
  path: string;
  body: string;
  startLine: number;
  endLine: number;
}

/**
 * AI Response Interface
 */
export interface AIReviewResponse {
  review: {
    codeSuggestions?: CodeSuggestion[];
    securityConcerns?: string;
  };
}

/**
 * Key Issue Interface
 */
export interface KeyIssue {
  relevantFile: string;
  issueHeader: string;
  issueContent: string;
  startLine: string | number;
  endLine: string | number;
}

/**
 * AI Service Private Interface
 */
export interface AIServicePrivate {
  formatCodeSuggestionsWithKeyIssues: (
    codeSuggestions: CodeSuggestion[],
    keyIssuesMap: Map<string, KeyIssue>
  ) => FormattedComment[];
  authenticate: (owner: string, repo: string) => Promise<void>;
  parseAIResponse: (text: string) => AIReviewResponse;
  octokit: Octokit;
}
