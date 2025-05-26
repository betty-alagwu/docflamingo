import { logger } from '@trigger.dev/sdk/v3';
import dayjs from 'dayjs';
import { App } from 'octokit';

import { env } from '@/app/config/env';
import { prisma } from '@/app/database/prisma';
import { type GitHubPullRequest } from '@/app/schemas/github.schema';
import { GithubService } from '@/app/services/git-providers/github.service';
import { TokenHandler } from '@/app/services/token-handler.service';

import { getPullRequestDetails } from '../utils/get-pull-request-details';

import type { FilePatchInfo } from '@/app/services/git-providers/github.service';
import type { FileInfo } from '@/app/services/token-handler.service';
import type { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

/**
 * Service to handle processing of reopened pull requests
 * Performs differential review - only reviewing files that have changed since the last review
 */
export class ProcessReopenedPullRequestService {
  async run(payload: ProcessPullRequestWebhookTaskPayload) {
    try {
      const githubService = new GithubService(payload);
      await githubService.initialise();

      const prDetails = await getPullRequestDetails(payload);

      const existingJob = await this.findExistingJob(payload);

      if (!existingJob) {
        const job = await this.createJobRecord(payload, prDetails);
        await githubService.analyzePullRequestWithLLM();

        const diffFiles = await githubService.getDiffFiles();
        await this.updateJobWithReviewedFiles(job.id, diffFiles);

        return diffFiles;
      }

      if (existingJob.headSha === payload.head.sha) {
        await prisma.job.update({
          where: { id: existingJob.id },
          data: {
            status: 'open',
            updatedAt: dayjs().toDate(),
            closedAt: null,
            mergedAt: null,
            triggerTaskIds: existingJob.triggerTaskIds || [],
          },
        });

        return [];
      }

      const allDiffFiles = await githubService.getDiffFiles();

      const newOrChangedFiles = await this.filterNewOrChangedFiles(
        allDiffFiles,
        existingJob.reviewedFiles,
        existingJob.headSha,
        payload
      );

      if (newOrChangedFiles.length === 0) {
        await prisma.job.update({
          where: { id: existingJob.id },
          data: {
            status: 'open',
            headSha: payload.head.sha,
            updatedAt: dayjs().toDate(),
            closedAt: null,
            mergedAt: null,
            // Preserve existing triggerTaskIds
            triggerTaskIds: existingJob.triggerTaskIds || [],
          },
        });

        return [];
      }

      await this.analyzeDifferentialChanges(githubService, newOrChangedFiles);

      const combinedFiles = [
        ...existingJob.reviewedFiles,
        ...newOrChangedFiles.map((file) => file.filename),
      ];
      // Remove duplicates by creating a Set and converting back to array
      const updatedReviewedFiles = Array.from(new Set(combinedFiles));

      await prisma.job.update({
        where: { id: existingJob.id },
        data: {
          status: 'open',
          headSha: payload.head.sha,
          reviewedFiles: updatedReviewedFiles,
          updatedAt: dayjs().toDate(),
          closedAt: null,
          mergedAt: null,
          triggerTaskIds: existingJob.triggerTaskIds || [],
        },
      });

      return newOrChangedFiles;
    } catch (error) {
      logger.error(`Error processing reopened PR: ${error}`);
      throw error;
    }
  }

  private async findExistingJob(payload: ProcessPullRequestWebhookTaskPayload) {
    return await prisma.job.findFirst({
      where: {
        githubRepositoryId: payload.repository.id,
        githubPullRequestId: payload.number,
      },
    });
  }

  private async createJobRecord(
    payload: ProcessPullRequestWebhookTaskPayload,
    prDetails: GitHubPullRequest | null
  ) {
    try {
      const installation = await prisma.installation.findFirst({
        where: {
          githubInstallationId: payload.installation.id,
        },
        include: {
          Customer: true,
        },
      });

      if (!installation || !installation.customerId) {
        throw new Error(`No valid customer found for installation ID ${payload.installation.id}`);
      }

      const customerId = installation.customerId;

      const newJob = await prisma.job.create({
        data: {
          customer: {
            connect: {
              id: customerId,
            },
          },
          githubRepositoryId: payload.repository.id,
          githubRepositoryName: payload.repository.name,
          githubRepositoryOwner: payload.repository.owner.login,
          githubPullRequestId: payload.number,
          githubPullRequestNumber: payload.number,
          githubPullRequestTitle: prDetails?.title || `PR #${payload.number}`,
          status: 'open',
          createdAt: dayjs().toDate(),
          updatedAt: dayjs().toDate(),
          headSha: payload.head.sha,
          baseSha: payload.base.sha,
          reviewedFiles: [],
          triggerTaskIds: [],
        },
      });

      return newJob;
    } catch (error) {
      logger.error(`Error creating job record: ${error}`);
      throw error;
    }
  }

  private async updateJobWithReviewedFiles(jobId: string, diffFiles: FilePatchInfo[]) {
    try {
      const reviewedFiles = diffFiles.map((file) => file.filename);

      await prisma.job.update({
        where: { id: jobId },
        data: {
          reviewedFiles,
        },
      });
    } catch (error) {
      logger.error(`Error updating job with reviewed files: ${error}`);
    }
  }

  private async analyzeDifferentialChanges(
    githubService: GithubService,
    changedFiles: FilePatchInfo[]
  ): Promise<void> {
    if (changedFiles.length === 0) {
      logger.info('No changed files to analyze');
      return;
    }

    try {
      const payload = githubService['payload']; // Access protected property
      const owner = payload.repository.owner;
      const repo = payload.repository.name;
      const prNumber = payload.number;

      const aiService = githubService['aiService'];
      const systemPrompt = aiService.getSystemPrompt();

      const tokenHandler = new TokenHandler(systemPrompt, 30000, {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 3000,
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 2000,
      });

      const fileInfos: FileInfo[] = changedFiles
        .filter((file) => file.patch)
        .map((file) => ({
          filename: file.filename,
          patch: file.patch,
        }));

      if (fileInfos.length === 0) {
        return;
      }

      const processedDiff = await tokenHandler.processFiles(fileInfos);

      await aiService.analyzePullRequest(processedDiff, owner.login, repo, prNumber);
    } catch (error) {
      throw new Error(`Differential analysis failed: ${error}`);
    }
  }

  private async filterNewOrChangedFiles(
    allFiles: FilePatchInfo[],
    previouslyReviewedFiles: string[],
    previousHeadSha: string,
    payload: ProcessPullRequestWebhookTaskPayload
  ): Promise<FilePatchInfo[]> {
    const newFiles = allFiles.filter((file) => !previouslyReviewedFiles.includes(file.filename));
    const changedFiles: FilePatchInfo[] = [];

    try {
      const app = new App({
        appId: env.GITHUB_APP_CLIENT_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await app.getInstallationOctokit(payload.installation.id);

      const previouslyReviewedFilesInCurrentPR = allFiles.filter((file) =>
        previouslyReviewedFiles.includes(file.filename)
      );

      for (const file of previouslyReviewedFilesInCurrentPR) {
        try {
          const { data: comparison } = await octokit.rest.repos.compareCommitsWithBasehead({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            basehead: `${previousHeadSha}...${payload.head.sha}`,
          });

          const fileChanged = comparison.files?.some((f) => f.filename === file.filename);

          if (fileChanged) {
            changedFiles.push(file);
          }
        } catch (error) {
          logger.error(`Error comparing file ${file.filename}: ${error}`);
        }
      }
    } catch (error) {
      logger.error(`Error checking for changed files: ${error}`);
    }

    return [...newFiles, ...changedFiles];
  }
}
