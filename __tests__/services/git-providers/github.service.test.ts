import { GithubService } from "@/app/services/git-providers/github.service";
import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { FilePatchInfo } from "@/__tests__/utils/test-interfaces";
import { Octokit } from "octokit";

const INSTALLATION_ID = 12345;
const REPO_OWNER = "test-owner";
const REPO_NAME = "test-repo";
const PR_NUMBER = 1;
const HEAD_SHA = "head-sha";
const BASE_SHA = "base-sha";
const MERGE_BASE_SHA = "merge-base-sha";
const SYSTEM_PROMPT = "System prompt for PR analysis";
const PROCESSED_FILES_CONTENT = "Processed files content";

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

const createPRPayload = (): ProcessPullRequestWebhookTaskPayload => ({
  installation: { id: INSTALLATION_ID },
  action: "opened",
  repository: { name: REPO_NAME, id: 123,  owner: { login: REPO_OWNER } },
  number: PR_NUMBER,
  head: { sha: HEAD_SHA },
  base: { sha: BASE_SHA },
});

jest.mock("@/app/utils/patch-processing", () => ({
  extendPatch: jest.fn((_, patch) => `${patch}\n extended context`),
}));

jest.mock("@/app/utils/chunk-array", () => ({
  chunkArray: jest.fn((arr: any[], size = 3) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result.length ? result : [arr];
  }),
}));

jest.mock("octokit", () => {
  const request = jest.fn(async (route: string) => {
    switch (route) {
      case "GET /repos/{owner}/{repo}/compare/{basehead}":
        return { data: { merge_base_commit: { sha: MERGE_BASE_SHA } } };
      case "GET /repos/{owner}/{repo}/pulls/{pull_number}/files":
        return { data: [mockPRFile] };
      case "GET /repos/{owner}/{repo}/contents/{path}":
        return { data: mockFileContent };
      default:
        return { data: {} };
    }
  });
  return {
    App: jest.fn().mockImplementation(() => ({
      getInstallationOctokit: jest.fn().mockResolvedValue({ request }),
    })),
  };
});

jest.mock("@/app/services/ai.service", () => ({
  AIService: jest.fn(() => ({
    getSystemPrompt: jest.fn(() => SYSTEM_PROMPT),
    analyzePullRequest: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/app/services/token-handler.service", () => ({
  TokenHandler: jest.fn(() => ({
    processFiles: jest.fn().mockResolvedValue(PROCESSED_FILES_CONTENT),
  })),
}));

describe("GithubService", () => {
  let service: GithubService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GithubService(createPRPayload());
  });

  describe("Initialization", () => {
    it("should initialize the Octokit client using the installation ID", async () => {
      await service.initialise();

      const octokit = (await (service as unknown as { octokit: Octokit }).octokit);
      expect(octokit.request).toBeDefined();
    });
  });

  describe("Diff File Handling", () => {
    beforeEach(async () => await service.initialise());

    it("should fetch PR files with correct parameters", async () => {
      await service.getDiffFiles();
      expect((service as unknown as { octokit: Octokit }).octokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        expect.objectContaining({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          pull_number: PR_NUMBER,
        }),
      );
    });

    it("should fetch new and base file content using correct refs", async () => {
      await service.getDiffFiles();

      expect((service as unknown as { octokit: Octokit }).octokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/contents/{path}",
        expect.objectContaining({ path: mockPRFile.filename, ref: HEAD_SHA }),
      );
      expect((service as unknown as { octokit: Octokit }).octokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/contents/{path}",
        expect.objectContaining({ path: mockPRFile.filename, ref: MERGE_BASE_SHA }),
      );
    });

    it("should extend patch using extendPatch utility", async () => {
      const { extendPatch } = require("@/app/utils/patch-processing");
      const files = await service.getDiffFiles();

      expect(extendPatch).toHaveBeenCalled();
      expect(files[0].patch).toContain("extended context");
    });

    it("should throw on API failure", async () => {
      (service as any).octokit.request.mockRejectedValueOnce(new Error("API failure"));

      await expect(service.getDiffFiles()).rejects.toThrow("API failure");
    });
  });

  describe("Pull Request Analysis", () => {
    beforeEach(async () => {
      await service.initialise();
    });

    it("should process and analyze PR files end-to-end", async () => {
      const mockFile: FilePatchInfo = {
        filename: "test-file.ts",
        patch: "diff",
        originalContent: { content: "original" },
        newContent: { content: "new" },
      };
      jest.spyOn(service, "getDiffFiles").mockResolvedValueOnce([mockFile]);

      await service.analyzePullRequestWithLLM();

      const { processFiles } = require("@/app/services/token-handler.service").TokenHandler.mock.results[0].value;
      const { analyzePullRequest } = require("@/app/services/ai.service").AIService.mock.results[0].value;

      expect(processFiles).toHaveBeenCalledWith([{ filename: "test-file.ts", patch: "diff" }]);
      expect(analyzePullRequest).toHaveBeenCalledWith(PROCESSED_FILES_CONTENT, REPO_OWNER, REPO_NAME, PR_NUMBER);
    });

    it("should throw an error if no patchable files exist", async () => {
      jest.spyOn(service, "getDiffFiles").mockResolvedValueOnce([
        {
          filename: "file.ts",
          originalContent: { content: "original" },
          newContent: { content: "new" },
        } as FilePatchInfo,
      ]);

      await expect(service.analyzePullRequestWithLLM()).rejects.toThrow("Pull Request Analysis Failed:Error: No files with patches found");
    });

    it("should throw if diff fetching fails", async () => {
      jest.spyOn(service, "getDiffFiles").mockRejectedValueOnce(new Error("Rate limit"));

      await expect(service.analyzePullRequestWithLLM()).rejects.toThrow("Pull Request Analysis Failed:Error: Rate limit");
    });

    it("should throw an error if LLM analysis fails", async () => {
      const mockFile: FilePatchInfo = {
        filename: "test-file.ts",
        patch: "diff",
        originalContent: { content: "original" },
        newContent: { content: "new" },
      };
      jest.spyOn(service, "getDiffFiles").mockResolvedValueOnce([mockFile]);
      const aiService = require("@/app/services/ai.service").AIService.mock.results[0].value;
      aiService.analyzePullRequest.mockRejectedValueOnce(new Error("LLM error"));

      await expect(service.analyzePullRequestWithLLM()).rejects.toThrow("Pull Request Analysis Failed:Error: LLM error");
    });
  });
});
