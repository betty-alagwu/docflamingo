import { setTimeout } from 'node:timers/promises';

import { App } from 'octokit';

import { env } from '@/app/config/env';
import { chunkArray } from '@/app/utils/chunk-array';
import { extendPatch } from '@/app/utils/patch-processing';

import { AIService } from '../ai.service';
import { TokenHandler } from '../token-handler.service';

import type { FileInfo } from '../token-handler.service';
import type { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

export interface FilePatchInfo {
  filename: string;
  newContent: {
    content: string;
  };
  originalContent: {
    content: string;
  };
  patch?: string;
}

export class GithubService {
  protected app = new App({
    appId: env.GITHUB_APP_CLIENT_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  protected octokit!: Awaited<ReturnType<typeof this.app.getInstallationOctokit>>;
  private aiService: AIService;

  constructor(protected payload: ProcessPullRequestWebhookTaskPayload) {
    this.aiService = new AIService();
  }
  public async initialise() {
    this.octokit = await this.app.getInstallationOctokit(this.payload.installation.id);
  }

  public async analyzePullRequestWithLLM(): Promise<void> {
    try {
      const files = await this.getDiffFiles();
      const owner = this.payload.repository.owner;
      const repo = this.payload.repository.name;
      const prNumber = this.payload.number;

      const systemPrompt = this.aiService.getSystemPrompt();
      const tokenHandler = new TokenHandler(systemPrompt, 30000, {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 3000, // Higher value - more lenient threshold
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 2000, // Lower value - more restrictive threshold
      });

      const fileInfos: FileInfo[] = files
        .filter((file) => file.patch)
        .map((file) => ({
          filename: file.filename,
          patch: file.patch,
        }));

      if (fileInfos.length === 0) {
        throw new Error('No files with patches found');
      }

      const processedDiff = await tokenHandler.processFiles(fileInfos);

      await this.aiService.analyzePullRequest(processedDiff, owner.login, repo, prNumber);
    } catch (error) {
      throw new Error('Pull Request Analysis Failed:' + error);
    }
  }

  /**
   * Get the diff files for the pull request
   * @returns {Promise<FilePatchInfo[]>}
   */
  public async getDiffFiles(): Promise<FilePatchInfo[]> {
    const mergeCommitSha = await this.getMergeBaseCommit();

    const pullRequestFiles = await this.octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner: this.payload.repository.owner.login,
        repo: this.payload.repository.name,
        pull_number: this.payload.number,
      }
    );

    const pullRequestFilesChunks = chunkArray(pullRequestFiles.data, 5);

    const filesPatchInfo: FilePatchInfo[] = [];
    const patchExtraLinesBefore = 3;
    const patchExtraLinesAfter = 3;

    for (const chunk of pullRequestFilesChunks) {
      const results = await Promise.allSettled(
        chunk.map(async (file) => {
          const newContent = await this.getFileContent(this.payload.head.sha, file.filename);

          let originalContent = { content: '' };

          if (file.status !== 'added' && file.status !== 'removed') {
            originalContent = await this.getFileContent(mergeCommitSha, file.filename);
          }

          let num_plus_lines;
          let num_minus_lines;

          // count number of lines added and removed
          if (
            Object.prototype.hasOwnProperty.call(file, 'additions') &&
            Object.prototype.hasOwnProperty.call(file, 'deletions')
          ) {
            num_plus_lines = file.additions;
            num_minus_lines = file.deletions;
          } else {
            num_plus_lines = file.patch
              ? file.patch.split('\n').filter((line) => line.startsWith('+')).length
              : 0;

            num_minus_lines = file.patch
              ? file.patch.split('\n').filter((line) => line.startsWith('-')).length
              : 0;
          }

          // If a patch exists, extend it using the original file content.
          if (file.patch) {
            file.patch = extendPatch(
              originalContent.content,
              file.patch,
              patchExtraLinesBefore,
              patchExtraLinesAfter,
              file.filename
            );
          }

          return {
            ...file,
            newContent,
            originalContent,
            num_plus_lines,
            num_minus_lines,
          };
        })
      );

      const allSuccessfulFiles = results
        .filter((promise) => promise.status === 'fulfilled')
        .map((promise) => promise.value);

      // Log the count of failed files for now
      // TODO: Implement proper error handling for failed file processing
      const failedFilesCount = results.filter((promise) => promise.status === 'rejected').length;
      if (failedFilesCount > 0) {
        console.warn(`Failed to process ${failedFilesCount} files`);
      }

      filesPatchInfo.push(...allSuccessfulFiles);

      await setTimeout(100);
    }

    return filesPatchInfo;
  }

  protected async getFileContent(ref: string, path: string) {
    const content = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: this.payload.repository.owner.login,
      repo: this.payload.repository.name,
      path,
      ref,
    });

    return content.data as { content: string };
  }

  protected async getMergeBaseCommit() {
    const response = await this.octokit?.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner: this.payload.repository.owner.login,
      repo: this.payload.repository.name,
      basehead: `${this.payload.base.sha}...${this.payload.head.sha}`,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    return response?.data.merge_base_commit.sha;
  }
}
