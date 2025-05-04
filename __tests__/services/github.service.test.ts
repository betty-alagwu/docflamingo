import { GithubService } from "../../app/services/git-providers/github.service";
import { TokenHandler } from "../../app/services/token-handler.service";
import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { chunkArray } from "@/app/utils/chunk-array";
import {
  MockOctokitClient,
  MockOctokitApp,
  MockAIService,
  MockTokenHandler,
  FilePatchInfo
} from "../utils/test-interfaces";

const MERGE_BASE_SHA = "merge-base-sha";
const INSTALLATION_ID = 12345;
const REPO_NAME = "test-repo";
const REPO_OWNER = "test-owner";
const PR_NUMBER = 1;
const HEAD_SHA = "head-sha";
const BASE_SHA = "base-sha";
const SYSTEM_PROMPT = "System prompt for PR analysis";
const PROCESSED_FILES_CONTENT = "Processed files content with token handling";

const mockPRFile = {
  filename: "test-file.ts",
  patch: "@@ -1,5 +1,7 @@\n line1\n-line2\n+modified line2\n+new line\n line3",
  status: "modified",
  additions: 2,
  deletions: 1,
};

const mockFileContent = {
  content: Buffer.from("file content").toString("base64"),
};

jest.mock("@/app/utils/patch-processing", () => ({
  extendPatch: jest
    .fn()
    .mockImplementation((_originalContent, patch, _before, _after, _filename) => `${patch}\n extended context`),
}));

jest.mock("@/app/utils/chunk-array", () => ({
  chunkArray: jest.fn().mockImplementation((array: any[], size = 3) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result.length ? result : [array];
  }),
}));

jest.mock("octokit", () => {
  const mockRequestHandler = jest.fn().mockImplementation((route: string) => {
    if (route === "GET /repos/{owner}/{repo}/compare/{basehead}") {
      return Promise.resolve({
        data: {
          merge_base_commit: {
            sha: MERGE_BASE_SHA,
          },
        },
      });
    }

    if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/files") {
      return Promise.resolve({
        data: [mockPRFile],
      });
    }

    if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
      return Promise.resolve({
        data: mockFileContent,
      });
    }

    return Promise.resolve({ data: {} });
  });

  const mockOctokit = {
    request: mockRequestHandler,
  };

  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit),
    })),
  };
});

jest.mock("../../app/services/ai.service", () => ({
  AIService: jest.fn().mockImplementation(() => ({
    getSystemPrompt: jest.fn().mockReturnValue(SYSTEM_PROMPT),
    analyzePullRequest: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../../app/services/token-handler.service", () => ({
  TokenHandler: jest.fn().mockImplementation(() => ({
    processFiles: jest.fn().mockResolvedValue(PROCESSED_FILES_CONTENT),
  })),
}));

const createMockPRPayload = (): ProcessPullRequestWebhookTaskPayload => ({
  installation: { id: INSTALLATION_ID },
  repository: {
    name: REPO_NAME,
    owner: { login: REPO_OWNER },
  },
  number: PR_NUMBER,
  head: { sha: HEAD_SHA },
  base: { sha: BASE_SHA },
} as ProcessPullRequestWebhookTaskPayload);

describe("GithubService", () => {
  let githubService: GithubService;

  let mockPayload: ProcessPullRequestWebhookTaskPayload;
  let mockOctokitApp: MockOctokitApp;
  let mockOctokitClient: MockOctokitClient;
  let mockAIService: MockAIService;
  let mockTokenHandler: MockTokenHandler;
  let mockExtendPatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPayload = createMockPRPayload();

    const mockRequestFn = jest.fn().mockImplementation((route: string) => {
      if (route === "GET /repos/{owner}/{repo}/compare/{basehead}") {
        return Promise.resolve({
          data: {
            merge_base_commit: {
              sha: MERGE_BASE_SHA,
            },
          },
        });
      }

      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/files") {
        return Promise.resolve({
          data: [mockPRFile],
        });
      }

      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return Promise.resolve({
          data: mockFileContent,
        });
      }

      return Promise.resolve({ data: {} });
    });

    mockOctokitClient = {
      request: mockRequestFn,
    };

    mockOctokitApp = {
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokitClient),
    };

    // Set up mock for AI Service
    mockAIService = {
      getSystemPrompt: jest.fn().mockReturnValue(SYSTEM_PROMPT),
      analyzePullRequest: jest.fn().mockResolvedValue(undefined),
    };

    // Set up mock for Token Handler
    mockTokenHandler = {
      processFiles: jest.fn<Promise<string>, [any[]]>().mockResolvedValue(PROCESSED_FILES_CONTENT),
    };

    const octokitMock = jest.requireMock("octokit");
    octokitMock.App.mockImplementation(() => mockOctokitApp);

    const aiServiceMock = jest.requireMock("../../app/services/ai.service");
    aiServiceMock.AIService.mockImplementation(() => mockAIService);

    const tokenHandlerMock = jest.requireMock("../../app/services/token-handler.service");
    tokenHandlerMock.TokenHandler.mockImplementation(() => mockTokenHandler);

    // Create the service instance directly
    githubService = new GithubService(mockPayload);

    // Get reference to extendPatch mock
    mockExtendPatch = require("@/app/utils/patch-processing").extendPatch;
  });

  describe("Service Initialization", () => {
    it("should initialize the Octokit client with the correct installation ID", async () => {
      // Act
      await githubService.initialise();

      // Assert
      expect(mockOctokitApp.getInstallationOctokit).toHaveBeenCalledWith(INSTALLATION_ID);
    });

    it("should store the Octokit client for later use", async () => {
      // Act
      await githubService.initialise();

      // Assert - verify the client is stored (indirectly by checking a subsequent method works)
      const mockGetInstallationResult = await mockOctokitApp.getInstallationOctokit();
      expect(mockGetInstallationResult).toBeDefined();

      // We can't directly test private properties, but we can test behavior
      const files = await githubService.getDiffFiles();
      expect(files).toBeDefined();
      expect(files).toBeInstanceOf(Array);
    });
  });

  describe("Pull Request Diff Handling", () => {
    beforeEach(async () => {
      // Initialize the service before each test in this block
      await githubService.initialise();
      mockOctokitClient = await mockOctokitApp.getInstallationOctokit();
    });

    it("should retrieve PR files from GitHub API with correct parameters", async () => {
      // Act
      await githubService.getDiffFiles();

      // Assert
      expect(mockOctokitClient.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        expect.objectContaining({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          pull_number: PR_NUMBER,
        })
      );
    });

    it("should retrieve file content for both new and original versions with correct refs", async () => {
      // Act
      await githubService.getDiffFiles();

      // Assert - check both head and base content are fetched
      expect(mockOctokitClient.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/contents/{path}",
        expect.objectContaining({
          ref: HEAD_SHA,
          path: "test-file.ts",
        })
      );

      expect(mockOctokitClient.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/contents/{path}",
        expect.objectContaining({
          ref: MERGE_BASE_SHA,
          path: "test-file.ts",
        })
      );
    });

    it("should extend patches with context using the extendPatch utility", async () => {
      // Act
      const files = await githubService.getDiffFiles();

      // Assert
      expect(mockExtendPatch).toHaveBeenCalledWith(
        expect.any(String), // originalContent
        expect.stringContaining("@@ -1,5 +1,7 @@"), // patch
        expect.any(Number), // patchExtraLinesBefore
        expect.any(Number), // patchExtraLinesAfter
        "test-file.ts" // filename
      );

      // Verify the extended patch is in the result
      expect(files[0].patch).toContain("extended context");
    });

    it("should process files in chunks to avoid overwhelming the API", async () => {
      // Arrange - mock multiple files
      const multipleFiles = [
        mockPRFile,
        { ...mockPRFile, filename: "another-file.ts" },
        { ...mockPRFile, filename: "third-file.ts" }
      ];

      // Mock getMergeBaseCommit to avoid the issue
      jest.spyOn(githubService as unknown as { getMergeBaseCommit: () => Promise<string> }, "getMergeBaseCommit").mockResolvedValue(MERGE_BASE_SHA);

      // Mock the request method for PR files
      mockOctokitClient.request.mockResolvedValueOnce({ data: multipleFiles });

      // Act
      await githubService.getDiffFiles();

      // Assert
      expect(chunkArray).toHaveBeenCalledWith(multipleFiles, expect.any(Number));
    });

    it("should handle files with no patch gracefully", async () => {
      // Arrange - mock a file without a patch
      const fileWithoutPatch = { ...mockPRFile, patch: undefined };

      // Mock getMergeBaseCommit to avoid the issue
      jest.spyOn(githubService as unknown as { getMergeBaseCommit: () => Promise<string> }, "getMergeBaseCommit").mockResolvedValue(MERGE_BASE_SHA);

      // Mock the request method for PR files
      mockOctokitClient.request
        // First call - get PR files
        .mockResolvedValueOnce({ data: [fileWithoutPatch] })
        // Subsequent calls for file content
        .mockResolvedValue({ data: mockFileContent });

      // Act
      const files = await githubService.getDiffFiles();

      // Assert
      expect(files[0].patch).toBeUndefined();
      expect(mockExtendPatch).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      // Arrange
      const apiError = new Error("GitHub API error");
      mockOctokitClient.request.mockRejectedValueOnce(apiError);

      // Act & Assert
      await expect(githubService.getDiffFiles()).rejects.toThrow("GitHub API error");
    });
  });

  describe("Pull Request Analysis with LLM", () => {
    beforeEach(async () => {
      // Initialize the service before each test in this block
      await githubService.initialise();

      // Mock getDiffFiles to provide consistent test data
      jest.spyOn(githubService, "getDiffFiles").mockResolvedValue([
        {
          filename: "test-file.ts",
          patch: "test patch content",
          newContent: { content: "new content" },
          originalContent: { content: "original content" },
        } as FilePatchInfo
      ]);
    });

    it("should retrieve diff files and process them with token handling using correct parameters", async () => {
      // Arrange
      const getDiffFilesSpy = jest.spyOn(githubService, "getDiffFiles");

      // Act
      await githubService.analyzePullRequestWithLLM();

      // Assert
      expect(getDiffFilesSpy).toHaveBeenCalled();
      expect(TokenHandler).toHaveBeenCalledWith(
        SYSTEM_PROMPT,
        30000, // Exact token limit value - max tokens for the model
        expect.objectContaining({
          OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 3000, // Higher value - more lenient threshold
          OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 2000, // Lower value - more restrictive threshold
        })
      );
    });

    it("should convert file data to the format expected by TokenHandler", async () => {
      // Arrange
      const testFile = {
        filename: "test-file.ts",
        patch: "test patch content",
        newContent: { content: "new content" },
        originalContent: { content: "original content" },
      };

      jest.spyOn(githubService, "getDiffFiles").mockResolvedValueOnce([testFile as FilePatchInfo]);

      // Act
      await githubService.analyzePullRequestWithLLM();

      // Assert
      expect(mockTokenHandler.processFiles).toHaveBeenCalledWith([
        {
          filename: "test-file.ts",
          patch: "test patch content",
        }
      ]);
    });

    it("should send processed files to the AI service for analysis with correct parameters", async () => {
      // Act
      await githubService.analyzePullRequestWithLLM();

      // Assert
      expect(mockAIService.analyzePullRequest).toHaveBeenCalledWith(
        PROCESSED_FILES_CONTENT,
        REPO_OWNER,
        REPO_NAME,
        PR_NUMBER
      );
    });

    it("should handle errors during diff file retrieval with proper error message", async () => {
      // Arrange
      const apiError = new Error("API rate limit exceeded");
      jest.spyOn(githubService, "getDiffFiles").mockRejectedValueOnce(apiError);

      // Act & Assert
      await expect(githubService.analyzePullRequestWithLLM()).rejects.toThrow(
        "Pull Request Analysis Failed:Error: API rate limit exceeded"
      );
    });

    it("should handle errors during AI analysis with proper error message", async () => {
      // Arrange
      const aiError = new Error("AI model unavailable");
      mockAIService.analyzePullRequest.mockRejectedValueOnce(aiError);

      // Act & Assert
      await expect(githubService.analyzePullRequestWithLLM()).rejects.toThrow(
        "Pull Request Analysis Failed:Error: AI model unavailable"
      );
    });

    it("should throw an error when no files with patches are found", async () => {
      // Arrange
      jest.spyOn(githubService, "getDiffFiles").mockResolvedValueOnce([
        {
          filename: "test-file.ts",
          // No patch property
          newContent: { content: "new content" },
          originalContent: { content: "original content" },
        } as FilePatchInfo
      ]);

      // Act & Assert
      await expect(githubService.analyzePullRequestWithLLM()).rejects.toThrow(
        "Pull Request Analysis Failed:Error: No files with patches found"
      );
    });
  });
});
