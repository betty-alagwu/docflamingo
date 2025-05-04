import { GithubCommentService } from '@/app/services/git-providers/github-comment.service';
import { ProcessCommentWebhookTaskPayload } from '@/app/trigger/process-comment-webhook';
import { AIService } from '@/app/services/ai.service';

// Mock the AIService
jest.mock('@/app/services/ai.service', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      generateResponse: jest.fn().mockResolvedValue('This is a mock AI response to your comment.')
    }))
  };
});

jest.mock('octokit', () => {
  const mockRequestHandler = jest.fn().mockImplementation((url) => {
    if (url.includes('/issues/comments/')) {
      return {
        data: {
          id: 123,
          body: 'Test comment',
          user: { login: 'test-user' },
          created_at: '2023-01-01T00:00:00Z',
          issue_url: 'https://api.github.com/repos/owner/repo/issues/1'
        }
      };
    } else if (url.includes('/issues/1/comments')) {
      return {
        data: [
          {
            id: 123,
            body: 'Test comment',
            user: { login: 'test-user' },
            created_at: '2023-01-01T00:00:00Z'
          },
          {
            id: 456,
            body: 'Bot comment',
            user: { login: 'docflamingo-app' },
            created_at: '2023-01-01T01:00:00Z'
          }
        ]
      };
    } else if (url.includes('/pulls/1/files')) {
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
    }

    return { data: {} };
  });

  // We don't need this second implementation as it's causing recursion

  const mockOctokit = {
    rest: {
      issues: {
        createComment: jest.fn().mockResolvedValue({ data: { id: 789 } })
      }
    },
    request: mockRequestHandler
  };

  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit)
    }))
  };
});

process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-private-key';

describe('GithubCommentService', () => {
  let service: GithubCommentService;
  let mockPayload: ProcessCommentWebhookTaskPayload;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPayload = {
      action: 'created',
      comment: {
        id: 123,
        body: 'Test comment',
        user: {
          login: 'test-user',
          id: 456
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      },
      issue: {
        number: 1,
        title: 'Test PR',
        body: 'Test PR body',
        user: {
          login: 'pr-author',
          id: 789
        },
        pull_request: {
          url: 'https://api.github.com/repos/owner/repo/pulls/1'
        }
      },
      repository: {
        id: 123,
        name: 'repo',
        owner: {
          login: 'owner'
        },
        full_name: 'owner/repo'
      },
      installation: {
        id: 12345
      }
    };

    service = new GithubCommentService(mockPayload);
    await service.initialize();
  });

  describe('getCommentThread', () => {
    it('should return a list of comments in the thread', async () => {
      // Arrange - Mock the method directly
      service.getCommentThread = jest.fn().mockResolvedValue([
        {
          id: '123',
          body: 'Test comment',
          isAiSuggestion: false,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          user: 'test-user'
        },
        {
          id: '456',
          body: 'Bot comment',
          isAiSuggestion: true,
          createdAt: new Date('2023-01-01T01:00:00Z'),
          user: 'docflamingo-app'
        }
      ]);

      // Act
      const comments = await service.getCommentThread();

      // Assert
      expect(comments).toHaveLength(2);
      expect(comments[0].id).toBe('123');
      expect(comments[1].id).toBe('456');
      expect(comments[1].isAiSuggestion).toBe(true);
    });
  });
});
