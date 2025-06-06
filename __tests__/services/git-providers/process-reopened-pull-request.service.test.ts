import { logger } from '@trigger.dev/sdk/v3';

import { prisma } from '@/app/database/prisma';
import { GithubService } from '@/app/services/git-providers/github.service';
import { ProcessReopenedPullRequestService } from '@/app/services/process-reopened-pull-request.service';

import type { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

// Mock environment variables
jest.mock('@/app/config/env', () => ({
  env: {
    GITHUB_APP_CLIENT_ID: 'test-client-id',
    GITHUB_APP_PRIVATE_KEY: 'test-private-key',
    TRIGGER_SECRET_KEY: 'test-trigger-secret-key',
    DEEPSEEK_API_KEY: 'test-deepseek-api-key',
  },
}));

// Mock getPullRequestDetails
jest.mock('@/app/utils/get-pull-request-details', () => ({
  getPullRequestDetails: jest.fn().mockResolvedValue({
    title: 'Test PR Title',
    body: 'Test PR Body',
  }),
}));

jest.mock('@/app/services/git-providers/github.service', () => {
  const mockAIService = {
    getSystemPrompt: jest.fn().mockReturnValue('Mock system prompt'),
    analyzePullRequest: jest.fn().mockResolvedValue(undefined),
  };

  return {
    GithubService: jest.fn().mockImplementation((payload) => ({
      initialise: jest.fn().mockResolvedValue(undefined),
      analyzePullRequestWithLLM: jest.fn().mockResolvedValue(undefined),
      getDiffFiles: jest.fn().mockResolvedValue([{ filename: 'test.ts', patch: 'test patch' }]),
      payload: payload,
      aiService: mockAIService,
    })),
  };
});

jest.mock('octokit', () => {
  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue({
        rest: {
          pulls: {
            get: jest.fn().mockResolvedValue({
              data: {
                title: 'Test PR',
                merged: false,
              },
            }),
          },
          repos: {
            compareCommitsWithBasehead: jest.fn().mockResolvedValue({
              data: {
                files: [{ filename: 'test.ts', status: 'modified' }],
              },
            }),
          },
        },
      }),
    })),
  };
});

jest.mock('@/app/database/prisma', () => {
  const mockExistingJob = {
    id: 'job-id',
    status: 'open',
    headSha: 'old-head-sha',
    reviewedFiles: ['test.ts'],
    triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
  };

  return {
    prisma: {
      installation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'installation-id',
          customerId: 'customer-id',
        }),
      },
      job: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((data) => {
          return Promise.resolve({
            id: 'new-job-id',
            ...data.data,
            status: 'open',
          });
        }),
        update: jest.fn().mockImplementation((data) => {
          return Promise.resolve({
            ...mockExistingJob,
            ...data.data,
          });
        }),
      },
    },
  };
});

jest.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/app/services/token-handler.service', () => {
  return {
    TokenHandler: jest.fn().mockImplementation(() => ({
      processFiles: jest.fn().mockResolvedValue('Processed diff content'),
    })),
  };
});

describe('ProcessReopenedPullRequestService', () => {
  let service: ProcessReopenedPullRequestService;
  let mockPayload: ProcessPullRequestWebhookTaskPayload;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPayload = {
      action: 'reopened',
      number: 1,
      repository: {
        id: 123,
        name: 'test-repo',
        owner: {
          login: 'test-owner',
        },
      },
      installation: {
        id: 12345,
      },
      head: {
        sha: 'new-head-sha',
      },
      base: {
        sha: 'base-sha',
      },
    } as ProcessPullRequestWebhookTaskPayload;

    service = new ProcessReopenedPullRequestService();
  });

  it('should create a new job record if no existing job is found', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(null);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          githubRepositoryId: 123,
          githubPullRequestId: 1,
          status: 'open',
        }),
      })
    );
    expect(GithubService).toHaveBeenCalledWith(mockPayload);
    const mockGithubServiceInstance = (GithubService as jest.Mock).mock.results[0].value;
    expect(mockGithubServiceInstance.analyzePullRequestWithLLM).toHaveBeenCalled();
  });

  it('should update job status without review if PR content has not changed', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'job-id',
      headSha: 'new-head-sha', // Same as the current head SHA
      reviewedFiles: ['test.ts'],
    });

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-id' },
      data: expect.objectContaining({
        status: 'open',
        closedAt: null,
        mergedAt: null,
      }),
    });

    const mockGithubServiceInstance = (GithubService as jest.Mock).mock.results[0].value;
    expect(mockGithubServiceInstance.analyzePullRequestWithLLM).not.toHaveBeenCalled();
  });

  it('should perform differential review if PR content has changed', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'job-id',
      headSha: 'old-head-sha', // Different from the current head SHA
      reviewedFiles: [],
    });

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-id' },
        data: expect.objectContaining({
          status: 'open',
          headSha: 'new-head-sha',
          reviewedFiles: expect.any(Array),
        }),
      })
    );

    const mockGithubServiceInstance = (GithubService as jest.Mock).mock.results[0].value;
    expect(mockGithubServiceInstance.analyzePullRequestWithLLM).not.toHaveBeenCalled();

    const tokenHandlerMock = jest.requireMock('@/app/services/token-handler.service').TokenHandler;
    expect(tokenHandlerMock).toHaveBeenCalled();
    expect(tokenHandlerMock.mock.results[0].value.processFiles).toHaveBeenCalled();

    const mockAIService = mockGithubServiceInstance.aiService;
    expect(mockAIService.analyzePullRequest).toHaveBeenCalled();
    expect(mockAIService.analyzePullRequest).toHaveBeenCalledWith(
      'Processed diff content',
      'test-owner',
      'test-repo',
      1
    );
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

    // Act & Assert
    await expect(service.run(mockPayload)).rejects.toThrow('Test error');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should create a new job with empty triggerTaskIds array when no job exists', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(null);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerTaskIds: [],
        }),
      })
    );
  });

  it('should preserve existing triggerTaskIds when updating a job with no content changes', async () => {
    // Arrange
    const mockExistingJob = {
      id: 'job-id',
      headSha: 'new-head-sha', // Same as the current head SHA
      reviewedFiles: ['test.ts'],
      triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
    };

    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(mockExistingJob);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-id' },
        data: expect.objectContaining({
          triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
        }),
      })
    );
  });

  it('should preserve existing triggerTaskIds when updating a job with content changes', async () => {
    // Arrange
    const mockExistingJob = {
      id: 'job-id',
      headSha: 'old-head-sha', // Different from the current head SHA
      reviewedFiles: ['test.ts'],
      triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
    };

    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(mockExistingJob);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-id' },
        data: expect.objectContaining({
          triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
        }),
      })
    );
  });

  it('should handle case when existing job has no triggerTaskIds field', async () => {
    // Arrange
    const mockExistingJobWithoutTaskIds = {
      id: 'job-id',
      headSha: 'old-head-sha',
      reviewedFiles: ['test.ts'],
    };

    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(mockExistingJobWithoutTaskIds);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-id' },
        data: expect.objectContaining({
          triggerTaskIds: [],
        }),
      })
    );
  });
});
