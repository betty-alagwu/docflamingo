import { AIService } from '../../app/services/ai.service';
import { AIServicePrivate } from '../utils/test-interfaces';

process.env.DEEPSEEK_API_KEY = 'test-deepseek-api-key';
process.env.GITHUB_APP_CLIENT_ID = 'test-github-app-client-id';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-github-app-private-key';

jest.mock('octokit', () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: {
            head: { sha: 'test-commit-sha' }
          }
        }),
        listFiles: jest.fn().mockResolvedValue({
          data: [
            {
              filename: 'src/test-file.ts',
              patch: '@@ -1,5 +1,7 @@\n line1\n+line2\n+line3\n line4\n line5'
            }
          ]
        }),
        createReviewComment: jest.fn().mockResolvedValue({}),
        createReview: jest.fn().mockResolvedValue({})
      },
      issues: {
        createComment: jest.fn().mockResolvedValue({})
      }
    },
    request: jest.fn()
  };

  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit)
    }))
  };
});

jest.mock('ai', () => {
  return {
    generateText: jest.fn().mockResolvedValue({
      text: `\`\`\`json
{
  "review": {
    "codeSuggestions": [
      {
        "suggestedCode": "const updatedValue = getValue();",
        "originalCode": "const value = getValue()",
        "explanation": "Added missing semicolon and renamed variable for clarity",
        "startLine": 2,
        "endLine": 2,
        "relevantFile": "src/test-file.ts"
      }
    ],
    "securityConcerns": "No"
  }
}
\`\`\``
    })
  };
});

jest.mock('@ai-sdk/deepseek', () => {
  return {
    createDeepSeek: jest.fn().mockReturnValue(() => {})
  };
});

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('formatCodeSuggestionsWithKeyIssues', () => {
    it('should format code suggestions with matching key issues', async () => {
      // Arrange
      const formatMethod = (aiService as unknown as AIServicePrivate).formatCodeSuggestionsWithKeyIssues.bind(aiService);

      const codeSuggestions = [
        {
          suggestedCode: 'return response.status(400).json({ message: "Invalid data provided." })',
          originalCode: 'return response.(400).json({ message: "Invalid data provided." })',
          explanation: 'Fixes a syntax error in the response method call',
          startLine: 15,
          endLine: 15,
          relevantFile: 'pages/api/store.ts'
        }
      ];

      const keyIssuesMap = new Map();
      keyIssuesMap.set('pages/api/store.ts:15', {
        relevantFile: 'pages/api/store.ts',
        issueHeader: 'Syntax Error',
        issueContent: 'There is a syntax error in the response method call. The correct syntax should be response.status(400) instead of response.(400).',
        startLine: 15,
        endLine: 15
      });

      // Act
      const result = formatMethod(codeSuggestions, keyIssuesMap);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].body).toContain('🔧 **Syntax Error**');
      expect(result[0].body).toContain('There is a syntax error in the response method call');
      expect(result[0].body).toContain('```diff');
      expect(result[0].body).toContain('- return response.(400).json');
      expect(result[0].body).toContain('+ return response.status(400).json');
      expect(result[0].path).toBe('pages/api/store.ts');
      expect(result[0].startLine).toBe(15);
      expect(result[0].endLine).toBe(15);
    });

    it('should use default header when no matching key issue is found', async () => {
      // Arrange
      const formatMethod = (aiService as unknown as AIServicePrivate).formatCodeSuggestionsWithKeyIssues.bind(aiService);

      const codeSuggestions = [
        {
          suggestedCode: 'return response.status(400).json({ message: "Invalid data provided." })',
          originalCode: 'return response.(400).json({ message: "Invalid data provided." })',
          explanation: 'Fixes a syntax error in the response method call',
          startLine: 15,
          endLine: 15,
          relevantFile: 'pages/api/store.ts'
        }
      ];

      // Empty map - no matching key issues
      const keyIssuesMap = new Map();

      // Act
      const result = formatMethod(codeSuggestions, keyIssuesMap);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('pages/api/store.ts');
    });
  });

  describe('analyzePullRequest', () => {
    it('should analyze PR and post comments to GitHub', async () => {
      // Arrange
      const octokitMock = jest.requireMock('octokit');
      const mockOctokit = await octokitMock.App().getInstallationOctokit();

      (aiService as unknown as AIServicePrivate).authenticate = jest.fn().mockResolvedValue(undefined);
      (aiService as unknown as AIServicePrivate).octokit = mockOctokit;

      // Act
      await aiService.analyzePullRequest(
        'Test patch diff',
        'test-owner',
        'test-repo',
        123
      );

      // Assert
      const aiMock = jest.requireMock('ai');
      expect(aiMock.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Test patch diff')
        })
      );

      // Verify that a review was created with comments
      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 123,
          event: 'COMMENT',
          comments: expect.arrayContaining([
            expect.objectContaining({
              path: 'src/test-file.ts',
              line: expect.any(Number),
              side: 'RIGHT',
              body: expect.stringContaining('🔧')
            })
          ])
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (aiService as unknown as AIServicePrivate).authenticate = jest.fn().mockRejectedValue(new Error('Auth error'));

      // Act & Assert
      await expect(
        aiService.analyzePullRequest('Test patch diff', 'test-owner', 'test-repo', 123)
      ).rejects.toThrow('Error analyzing pull request: Error: Auth error');
    });
  });

  describe('parseAIResponse', () => {
    it('should parse JSON response correctly', () => {
      // Arrange
      const parseMethod = (aiService as unknown as AIServicePrivate).parseAIResponse.bind(aiService);

      const jsonResponse = `\`\`\`json
{
  "review": {
    "codeSuggestions": [
      {
        "suggestedCode": "const x = 1;",
        "originalCode": "const x = 1",
        "explanation": "Added semicolon",
        "startLine": 1,
        "endLine": 1,
        "relevantFile": "test.ts"
      }
    ]
  }
}
\`\`\``;

      // Act
      const result = parseMethod(jsonResponse);

      // Assert
      expect(result).toHaveProperty('review');
      expect(result.review).toHaveProperty('codeSuggestions');
      expect(result.review.codeSuggestions).toHaveLength(1);
      expect(result.review.codeSuggestions?.[0].suggestedCode).toBe('const x = 1;');
    });
  });
});
