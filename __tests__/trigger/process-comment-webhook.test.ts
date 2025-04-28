import { processCommentWebhookTask } from '@/app/trigger/process-comment-webhook';
import { GithubCommentService } from '@/app/services/git-providers/github-comment.service';
import { prisma } from '@/app/database/prisma';

// Mock the prisma client
jest.mock('@/app/database/prisma', () => ({
  prisma: {
    installation: {
      findFirst: jest.fn()
    }
  }
}));

// Mock the GithubCommentService
jest.mock('@/app/services/git-providers/github-comment.service');

describe('processCommentWebhookTask', () => {
  const mockPayload = {
    action: 'created',
    comment: {
      id: 123,
      body: 'Test comment',
      user: {
        login: 'test-user',
        id: 456
      },
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      in_reply_to_id: 456
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the prisma client to return a valid installation
    (prisma.installation.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      githubInstallationId: 12345
    });
    
    // Mock the GithubCommentService
    (GithubCommentService as jest.MockedClass<typeof GithubCommentService>).prototype.initialize = jest.fn().mockResolvedValue(undefined);
    (GithubCommentService as jest.MockedClass<typeof GithubCommentService>).prototype.processCommentReply = jest.fn().mockResolvedValue({
      message: 'success',
      action: 'replied_to_user'
    });
  });

  it('should process a comment webhook', async () => {
    // Act
    const result = await processCommentWebhookTask.run(mockPayload);

    // Assert
    expect(prisma.installation.findFirst).toHaveBeenCalledWith({
      where: {
        githubInstallationId: 12345
      }
    });
    
    expect(GithubCommentService.prototype.initialize).toHaveBeenCalled();
    expect(GithubCommentService.prototype.processCommentReply).toHaveBeenCalled();
    
    expect(result).toEqual({
      message: 'success',
      action: 'replied_to_user'
    });
  });

  it('should return ignored if the comment is not directed at the bot', async () => {
    // Arrange - Mock the isCommentForBot function to return false
    const originalModule = jest.requireActual('@/app/trigger/process-comment-webhook');
    const mockIsCommentForBot = jest.spyOn(originalModule, 'isCommentForBot').mockResolvedValue(false);
    
    // Act
    const result = await processCommentWebhookTask.run(mockPayload);
    
    // Assert
    expect(result).toEqual({
      message: 'ignored',
      reason: 'Comment not directed at bot'
    });
    
    // Cleanup
    mockIsCommentForBot.mockRestore();
  });

  it('should throw an error if the installation is not found', async () => {
    // Arrange
    (prisma.installation.findFirst as jest.Mock).mockResolvedValue(null);
    
    // Act & Assert
    await expect(processCommentWebhookTask.run(mockPayload)).rejects.toThrow(
      'Installation with ID of 12345 not found'
    );
  });
});
