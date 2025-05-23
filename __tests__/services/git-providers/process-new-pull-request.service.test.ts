import { prisma } from '@/app/database/prisma';
import { ProcessNewPullRequestService } from '@/app/services/process-new-pull-request.service';

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
  return {
    GithubService: jest.fn().mockImplementation(() => ({
      initialise: jest.fn().mockResolvedValue(undefined),
      analyzePullRequestWithLLM: jest.fn().mockResolvedValue(undefined),
      getDiffFiles: jest.fn().mockResolvedValue([{ filename: 'test.ts', patch: 'test patch' }]),
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
        },
      }),
    })),
  };
});

jest.mock('@/app/database/prisma', () => {
  const mockExistingJob = {
    id: 'existing-job-id',
    status: 'open',
    headSha: 'old-head-sha',
    baseSha: 'old-base-sha',
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
        findFirst: jest.fn().mockResolvedValue(null),
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

describe('ProcessNewPullRequestService', () => {
  let service: ProcessNewPullRequestService;
  let mockPayload: ProcessPullRequestWebhookTaskPayload;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPayload = {
      action: 'opened',
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
        sha: 'head-sha',
      },
      base: {
        sha: 'base-sha',
      },
    } as ProcessPullRequestWebhookTaskPayload;

    service = new ProcessNewPullRequestService();
  });

  it('should initialize the GitHub service and analyze the PR', async () => {
    // Act
    await service.run(mockPayload);

    // Assert
    const mockGithubService = jest.requireMock(
      '@/app/services/git-providers/github.service'
    ).GithubService;
    expect(mockGithubService).toHaveBeenCalledWith(mockPayload);

    const mockGithubServiceInstance = mockGithubService.mock.results[0].value;
    expect(mockGithubServiceInstance.initialise).toHaveBeenCalled();
    expect(mockGithubServiceInstance.analyzePullRequestWithLLM).toHaveBeenCalled();
  });

  it('should return the diff files from the GitHub service', async () => {
    // Act
    const result = await service.run(mockPayload);

    // Assert
    expect(result).toEqual([{ filename: 'test.ts', patch: 'test patch' }]);
  });

  it('should create a new job with empty triggerTaskIds array when no job exists', async () => {
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

  it('should preserve existing triggerTaskIds when updating an existing job', async () => {
    // Arrange
    const mockExistingJob = {
      id: 'existing-job-id',
      status: 'open',
      headSha: 'old-head-sha',
      baseSha: 'old-base-sha',
      triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
    };

    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(mockExistingJob);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-job-id' },
        data: expect.objectContaining({
          triggerTaskIds: ['existing-task-id-1', 'existing-task-id-2'],
        }),
      })
    );
  });

  it('should handle case when existing job has no triggerTaskIds field', async () => {
    // Arrange
    const mockExistingJobWithoutTaskIds = {
      id: 'existing-job-id',
      status: 'open',
      headSha: 'old-head-sha',
      baseSha: 'old-base-sha',
      // No triggerTaskIds field
    };

    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce(mockExistingJobWithoutTaskIds);

    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-job-id' },
        data: expect.objectContaining({
          triggerTaskIds: [],
        }),
      })
    );
  });
});
