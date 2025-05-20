import { ProcessClosedPullRequestService } from '@/app/services/process-closed-pull-request.service';
import { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';
import { App } from 'octokit';
import { prisma } from '@/app/database/prisma';
import { logger, runs, configure } from '@trigger.dev/sdk/v3';

jest.mock('@/app/config/env', () => ({
  env: {
    GITHUB_APP_CLIENT_ID: 'test-client-id',
    GITHUB_APP_PRIVATE_KEY: 'test-private-key',
    TRIGGER_SECRET_KEY: 'test-trigger-secret-key'
  }
}));

jest.mock('octokit', () => {
  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue({
        rest: {
          pulls: {
            get: jest.fn().mockResolvedValue({
              data: {
                merged: true
              }
            })
          }
        }
      })
    }))
  };
});

jest.mock('@/app/database/prisma', () => {
  const mockJob = {
    id: 'job-id-123',
    githubRepositoryId: 123,
    githubPullRequestId: 1,
    triggerTaskIds: ['task-id-1', 'task-id-2']
  };

  return {
    prisma: {
      job: {
        findFirst: jest.fn().mockResolvedValue(mockJob),
        update: jest.fn().mockResolvedValue({ ...mockJob, triggerTaskIds: [] })
      }
    }
  };
});

jest.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  },
  runs: {
    cancel: jest.fn().mockResolvedValue({ success: true })
  },
  configure: jest.fn()
}));

describe('ProcessClosedPullRequestService', () => {
  let service: ProcessClosedPullRequestService;
  let mockPayload: ProcessPullRequestWebhookTaskPayload;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPayload = {
      action: 'closed',
      number: 1,
      repository: {
        id: 123,
        name: 'test-repo',
        owner: {
          login: 'test-owner'
        }
      },
      installation: {
        id: 12345
      },
      head: {
        sha: 'head-sha'
      },
      base: {
        sha: 'base-sha'
      }
    } as ProcessPullRequestWebhookTaskPayload;

    service = new ProcessClosedPullRequestService();
  });

  it('should attempt to find and clean up job records', async () => {
    // Act
    await service.run(mockPayload);

    // Assert
    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: {
        githubRepositoryId: 123,
        githubPullRequestId: 1
      }
    });
  });

  it('should handle errors gracefully when checking if PR was merged', async () => {
    // Arrange
    const mockAppConstructor = App as unknown as jest.Mock;
    mockAppConstructor.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    // Act
    const result = await service.run(mockPayload);

    // Assert
    expect(logger.error).toHaveBeenCalled();
    expect(result.wasMerged).toBe(false);
  });

  it('should return a properly formatted result object', async () => {
    // Act
    const result = await service.run(mockPayload);

    // Assert
    expect(result).toEqual({
      status: 'closed',
      prNumber: 1,
      wasMerged: true,
      repository: {
        owner: 'test-owner',
        name: 'test-repo'
      }
    });
  });

  it('should cancel pending tasks associated with the PR', async () => {
    // Act
    await service.run(mockPayload);

    // Assert
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: expect.any(String)
    }));

    expect(runs.cancel).toHaveBeenCalledWith('task-id-1');
    expect(runs.cancel).toHaveBeenCalledWith('task-id-2');
    expect(runs.cancel).toHaveBeenCalledTimes(2);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-id-123' },
      data: expect.objectContaining({
        triggerTaskIds: []
      })
    });
  });

  it('should handle errors when canceling tasks', async () => {
    // Arrange
    (runs.cancel as jest.Mock).mockRejectedValueOnce(new Error('Failed to cancel task'));

    // Act
    await service.run(mockPayload);

    // Assert
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error canceling task task-id-1'));
    expect(runs.cancel).toHaveBeenCalledWith('task-id-2');
    expect(prisma.job.update).toHaveBeenCalled();
  });

  it('should handle case when no tasks need to be canceled', async () => {
    // Arrange
    (prisma.job.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'job-id-123',
      triggerTaskIds: []
    });

    // Act
    await service.run(mockPayload);

    // Assert
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No tasks to cancel'));
    expect(runs.cancel).not.toHaveBeenCalled();
  });
});
