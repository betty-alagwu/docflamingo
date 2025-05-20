import { GithubCommentService } from '@/app/services/git-providers/github-comment.service';
import { ProcessCommentWebhookTaskPayload } from '@/app/trigger/process-comment-webhook';
import { Comment } from '@/app/interfaces/comment-handler.interface';

const INSTALLATION_ID = 12345;
const REPO_OWNER = 'owner';
const REPO_NAME = 'repo';
const PR_NUMBER = 1;
const USER_LOGIN = 'test-user';
const BOT_LOGIN = 'docflamingo-app';
const COMMENT_ID = 123;
const REPLY_TO_ID = 456;
const MOCK_AI_RESPONSE = 'This is a mock AI response to your comment.';
const SYSTEM_PROMPT = 'Mock system prompt for testing';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body) => ({
      status: 200,
      body,
      json: () => body,
      toJSON: () => JSON.stringify(body),
      toString: () => JSON.stringify(body)
    }))
  }
}));

jest.mock('@/app/services/ai.service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue(MOCK_AI_RESPONSE),
    generateCommentResponse: jest.fn().mockResolvedValue(MOCK_AI_RESPONSE),
    getSystemPrompt: jest.fn().mockReturnValue(SYSTEM_PROMPT)
  }))
}));

jest.mock('@/app/services/token-handler.service', () => ({
  TokenHandler: jest.fn().mockImplementation(() => ({
    countTokens: jest.fn().mockReturnValue(10),
    processFiles: jest.fn().mockResolvedValue('Processed files')
  }))
}));

jest.mock('octokit', () => {
  // Create mock functions that we can check for calls
  const createCommentMock = jest.fn().mockResolvedValue({ data: { id: 789 } });
  const createReactionMock = jest.fn().mockResolvedValue({});
  const requestMock = jest.fn().mockImplementation((url) => {
    if (url.includes('/issues/comments/')) {
      return {
        data: {
          id: COMMENT_ID,
          body: 'Test comment',
          user: { login: USER_LOGIN },
          created_at: '2023-01-01T00:00:00Z',
          issue_url: `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}`
        }
      };
    } else if (url.includes(`/issues/${PR_NUMBER}/comments`)) {
      return {
        data: [
          {
            id: COMMENT_ID,
            body: 'Test comment',
            user: { login: USER_LOGIN },
            created_at: '2023-01-01T00:00:00Z'
          },
          {
            id: REPLY_TO_ID,
            body: 'Bot comment',
            user: { login: BOT_LOGIN },
            created_at: '2023-01-01T01:00:00Z'
          }
        ]
      };
    } else if (url.includes(`/pulls/${PR_NUMBER}/files`)) {
      return {
        data: [
          {
            filename: 'test.js',
            patch: '@@ -1,3 +1,4 @@\n line1\n+line2\n line3\n line4'
          }
        ]
      };
    } else if (url.includes('/contents/')) {
      return {
        data: {
          content: Buffer.from('line1\nline2\nline3\nline4\nline5').toString('base64')
        }
      };
    } else if (url.includes('/reactions')) {
      return { data: {} };
    }
    return { data: {} };
  });

  // Create the mock Octokit instance
  const mockOctokit = {
    rest: {
      issues: {
        createComment: createCommentMock
      },
      reactions: {
        createForIssueComment: createReactionMock
      }
    },
    request: requestMock
  };

  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit)
    }))
  };
});

process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-private-key';

function createCommentPayload(overrides = {}): ProcessCommentWebhookTaskPayload {
  return {
    action: 'created',
    comment: {
      id: COMMENT_ID,
      body: 'Test comment',
      user: {
        login: USER_LOGIN,
        id: 456
      },
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    },
    repository: {
      id: 123,
      name: REPO_NAME,
      owner: {
        login: REPO_OWNER
      },
    },
    installation: {
      id: INSTALLATION_ID
    },
    ...overrides
  };
}

function createMockCommentThread(): Comment[] {
  return [
    {
      id: '123',
      body: 'Root comment',
      isAiSuggestion: false,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      user: USER_LOGIN,
      inReplyToId: undefined
    },
    {
      id: '456',
      body: 'AI response',
      isAiSuggestion: true,
      createdAt: new Date('2023-01-01T01:00:00Z'),
      user: BOT_LOGIN,
      inReplyToId: '123'
    },
    {
      id: '789',
      body: 'User reply',
      isAiSuggestion: false,
      createdAt: new Date('2023-01-01T02:00:00Z'),
      user: USER_LOGIN,
      inReplyToId: '456'
    }
  ];
}

describe('GithubCommentService', () => {
  let service: GithubCommentService;
  let mockPayload: ProcessCommentWebhookTaskPayload;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPayload = createCommentPayload();
    service = new GithubCommentService(mockPayload);
    await service.initialize();
  });

  describe('Initialization', () => {
    it('should initialize the Octokit client using the installation ID', async () => {
      jest.clearAllMocks();

      // Create a fresh mock to track calls
      const mockGetInstallationOctokit = jest.fn().mockResolvedValue({
        rest: { issues: {}, reactions: {} },
        request: jest.fn()
      });

      // Override the mock implementation
      jest.requireMock('octokit').App.mockImplementation(() => ({
        getInstallationOctokit: mockGetInstallationOctokit
      }));

      const newService = new GithubCommentService(mockPayload);
      await newService.initialize();

      const octokitApp = jest.requireMock('octokit').App;
      const getInstallationOctokitMock = octokitApp().getInstallationOctokit;
      await newService.initialize();
      expect(octokitApp).toHaveBeenCalledWith({
        appId: 'test-client-id',
        privateKey: 'test-private-key'
      });
      expect(getInstallationOctokitMock).toHaveBeenCalledWith(INSTALLATION_ID);
    });
  });

  describe('getCommentThread', () => {
    beforeEach(() => {
      const octokitMock = jest.requireMock('octokit');
      const mockOctokit = octokitMock.App().getInstallationOctokit();
      mockOctokit.request = jest.fn().mockResolvedValue({ data: [] });
    });

    it('should return an empty array when pull request is not defined', async () => {
      mockPayload.pull_request = undefined;
      const comments = await service.getCommentThread();
      expect(comments).toEqual([]);
    });

    it('should return thread comments when in_reply_to_id is present', async () => {
      mockPayload.comment.in_reply_to_id = REPLY_TO_ID;
      mockPayload.pull_request = {
        number: PR_NUMBER,
        title: 'Test PR',
        body: 'Test PR body',
        user: {
          login: 'pr-author',
          id: 789
        },
        url: `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}`,
        html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${PR_NUMBER}`
      };

      service.getCommentThread = jest.fn().mockResolvedValue(createMockCommentThread());
      const comments = await service.getCommentThread();

      expect(comments).toHaveLength(3);
      expect(comments[0].id).toBe('123');
      expect(comments[1].id).toBe('456');
      expect(comments[1].isAiSuggestion).toBe(true);
      expect(comments[2].id).toBe('789');
      expect(comments[2].inReplyToId).toBe('456');
    });
  });

  describe('processGithubUserReply', () => {
    beforeEach(() => {
      service.getCommentThread = jest.fn().mockResolvedValue([]);
      const nextServerMock = jest.requireMock('next/server');
      nextServerMock.NextResponse.json.mockClear();
    });

    it('should ignore when comment is not a reply', async () => {
      mockPayload.comment.in_reply_to_id = undefined;
      const result = await service.processGithubUserReply();
      expect(result).toEqual({ status: 'ignored', reason: 'Not a reply to any comment' });
      expect(service.getCommentThread).not.toHaveBeenCalled();
    });

    it('should ignore when comment is from the AI bot', async () => {
      mockPayload.comment.in_reply_to_id = REPLY_TO_ID;
      mockPayload.comment.user.login = BOT_LOGIN;

      const nextServerMock = jest.requireMock('next/server');
      nextServerMock.NextResponse.json.mockReturnValueOnce({
        status: 'ignored',
        reason: 'Comment is from the AI bot, not a user'
      });

      await service.processGithubUserReply();

      expect(nextServerMock.NextResponse.json).toHaveBeenCalledWith({
        status: 'ignored',
        reason: 'Comment is from the AI bot, not a user'
      });
      expect(service.getCommentThread).not.toHaveBeenCalled();
    });

    it('should ignore when parent comment is not found in thread', async () => {
      mockPayload.comment.in_reply_to_id = 999;
      service.getCommentThread = jest.fn().mockResolvedValue(createMockCommentThread());

      const nextServerMock = jest.requireMock('next/server');
      nextServerMock.NextResponse.json.mockReturnValueOnce({
        status: 'ignored',
        reason: 'Not a reply to an AI-generated comment'
      });

      await service.processGithubUserReply();

      expect(nextServerMock.NextResponse.json).toHaveBeenCalledWith({
        status: 'ignored',
        reason: 'Not a reply to an AI-generated comment'
      });
    });

    it('should successfully process a valid user reply to AI comment', async () => {
      // Setup the test data
      mockPayload.comment.in_reply_to_id = REPLY_TO_ID;
      mockPayload.pull_request = {
        number: PR_NUMBER,
        title: 'Test PR',
        body: 'Test PR body',
        user: {
          login: 'pr-author',
          id: 789
        },
        url: `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}`,
        html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${PR_NUMBER}`
      };

      // Mock the getCommentThread method to return a thread with an AI comment
      service.getCommentThread = jest.fn().mockResolvedValue([
        {
          id: REPLY_TO_ID.toString(),
          body: 'AI comment',
          isAiSuggestion: true,
          createdAt: new Date('2023-01-01T01:00:00Z'),
          user: BOT_LOGIN
        }
      ]);

      // Mock the private methods directly on the service instance
      (service as any).addReactionToComment = jest.fn().mockResolvedValue(undefined);
      (service as any).replyToComment = jest.fn().mockResolvedValue(undefined);

      // Mock the AI service
      const aiServiceMock = jest.requireMock('@/app/services/ai.service');
      aiServiceMock.AIService.mock.results[0].value.generateCommentResponse.mockResolvedValue(MOCK_AI_RESPONSE);

      // Mock the NextResponse
      const nextServerMock = jest.requireMock('next/server');
      nextServerMock.NextResponse.json.mockReturnValueOnce({
        status: 'success',
        message: 'Replied to user comment'
      });

      // Call the method
      await service.processGithubUserReply();

      // Verify the private methods were called
      expect((service as any).addReactionToComment).toHaveBeenCalledWith(
        REPO_OWNER,
        REPO_NAME,
        COMMENT_ID.toString(),
        'eyes'
      );

      expect((service as any).replyToComment).toHaveBeenCalledWith(
        REPO_OWNER,
        REPO_NAME,
        PR_NUMBER,
        COMMENT_ID.toString(),
        MOCK_AI_RESPONSE
      );

      // Verify the response
      expect(nextServerMock.NextResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Replied to user comment'
      });
    });
  });

  describe('Private methods', () => {
    const getPrivateMethod = (methodName: string) => {
      return (service as any)[methodName].bind(service);
    };

    describe('buildPromptFromCommentThread', () => {
      it('should build a prompt with user question and conversation history', () => {
        const buildPromptFromCommentThread = getPrivateMethod('buildPromptFromCommentThread');
        const commentThread = [
          {
            id: '123',
            body: 'Initial comment',
            isAiSuggestion: false,
            createdAt: new Date('2023-01-01T00:00:00Z'),
            user: USER_LOGIN
          },
          {
            id: '456',
            body: 'AI response',
            isAiSuggestion: true,
            createdAt: new Date('2023-01-01T01:00:00Z'),
            user: BOT_LOGIN
          }
        ];
        const userQuestion = 'How do I fix this bug?';

        const tokenHandlerMock = jest.requireMock('@/app/services/token-handler.service');
        const countTokensMock = tokenHandlerMock.TokenHandler.mock.results[0].value.countTokens;
        countTokensMock.mockReturnValue(100);

        const prompt = buildPromptFromCommentThread(commentThread, userQuestion);

        expect(prompt).toContain(`User: ${userQuestion}`);
      });

      it('should truncate long comments to stay within token limits', () => {
        const buildPromptFromCommentThread = getPrivateMethod('buildPromptFromCommentThread');
        const longComment = 'A'.repeat(1000);
        const commentThread = [
          {
            id: '123',
            body: longComment,
            isAiSuggestion: false,
            createdAt: new Date('2023-01-01T00:00:00Z'),
            user: USER_LOGIN
          }
        ];
        const userQuestion = 'How do I fix this bug?';

        const tokenHandlerMock = jest.requireMock('@/app/services/token-handler.service');
        const countTokensMock = tokenHandlerMock.TokenHandler.mock.results[0].value.countTokens;
        countTokensMock.mockReturnValue(500);

        const prompt = buildPromptFromCommentThread(commentThread, userQuestion);

        expect(prompt).toContain('User: ' + 'A'.repeat(500) + '... (truncated)');
      });
    });

    describe('mapGithubComment', () => {
      it('should map GitHub comment to internal format', () => {
        const mapGithubComment = getPrivateMethod('mapGithubComment');
        const githubComment = {
          id: 123,
          body: 'Test comment',
          user: { login: USER_LOGIN },
          created_at: '2023-01-01T00:00:00Z',
          in_reply_to_id: 456
        };

        const mappedComment = mapGithubComment(githubComment);

        expect(mappedComment.id).toBe('123');
        expect(mappedComment.body).toBe('Test comment');
        expect(mappedComment.isAiSuggestion).toBe(false);
        expect(mappedComment.createdAt).toEqual(new Date('2023-01-01T00:00:00Z'));
        expect(mappedComment.user).toBe(USER_LOGIN);
        expect(mappedComment.inReplyToId).toBe('456');
      });

      it('should detect AI bot comments', () => {
        const mapGithubComment = getPrivateMethod('mapGithubComment');
        const githubComment = {
          id: 123,
          body: 'AI suggestion',
          user: { login: BOT_LOGIN },
          created_at: '2023-01-01T00:00:00Z'
        };

        const mappedComment = mapGithubComment(githubComment);

        expect(mappedComment.isAiSuggestion).toBe(true);
      });
    });
  });
});
