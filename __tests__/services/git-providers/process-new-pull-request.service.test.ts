import { ProcessNewPullRequestService } from '@/app/services/process-new-pull-request.service';
import { GithubService } from '@/app/services/git-providers/github.service';
import { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

// Mock the GithubService
jest.mock('@/app/services/git-providers/github.service', () => {
  return {
    GithubService: jest.fn().mockImplementation(() => ({
      initialise: jest.fn().mockResolvedValue(undefined),
      analyzePullRequestWithLLM: jest.fn().mockResolvedValue(undefined),
      getDiffFiles: jest.fn().mockResolvedValue([{ filename: 'test.ts', patch: 'test patch' }])
    }))
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

    service = new ProcessNewPullRequestService();
  });

  it('should initialize the GitHub service and analyze the PR', async () => {
    // Act
    await service.run(mockPayload);

    // Assert
    const mockGithubService = require('@/app/services/git-providers/github.service').GithubService;
    expect(mockGithubService).toHaveBeenCalledWith(mockPayload);
    
    const mockGithubServiceInstance = mockGithubService.mock.results[0].value;
    expect(mockGithubServiceInstance.initialise).toHaveBeenCalled();
    expect(mockGithubServiceInstance.analyzePullRequestWithLLM).toHaveBeenCalled();
    expect(mockGithubServiceInstance.getDiffFiles).toHaveBeenCalled();
  });

  it('should return the diff files from the GitHub service', async () => {
    // Act
    const result = await service.run(mockPayload);

    // Assert
    expect(result).toEqual([{ filename: 'test.ts', patch: 'test patch' }]);
  });
});
