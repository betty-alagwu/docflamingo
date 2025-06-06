import { logger } from '@trigger.dev/sdk/v3';
import dayjs from 'dayjs';

import { prisma } from '@/app/database/prisma';
import { GithubService, type FilePatchInfo } from '@/app/services/git-providers/github.service';

import { type GitHubPullRequest } from '../schemas/github.schema';
import { getPullRequestDetails } from '../utils/get-pull-request-details';

import type { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

export class ProcessNewPullRequestService {
  async run(payload: ProcessPullRequestWebhookTaskPayload) {
    try {
      const githubService = new GithubService(payload);
      await githubService.initialise();

      const prDetails = await getPullRequestDetails(payload);
      const job = await this.createOrUpdateJobRecord(payload, prDetails);

      await githubService.analyzePullRequestWithLLM();

      const diffFiles = await githubService.getDiffFiles();
      await this.updateJobWithReviewedFiles(job.id, diffFiles);

      return diffFiles;
    } catch (error) {
      logger.error(`Error processing new PR: ${error}`);
      throw error;
    }
  }

  private async createOrUpdateJobRecord(
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

      const existingJob = await prisma.job.findFirst({
        where: {
          githubRepositoryId: payload.repository.id,
          githubPullRequestId: payload.number,
        },
      });

      if (existingJob) {
        const updatedJob = await prisma.job.update({
          where: { id: existingJob.id },
          data: {
            status: 'open',
            headSha: payload.head.sha,
            baseSha: payload.base.sha,
            updatedAt: dayjs().toDate(),
            closedAt: null,
            mergedAt: null,
            // Preserve existing triggerTaskIds
            triggerTaskIds: existingJob.triggerTaskIds || [],
          },
        });

        return updatedJob;
      } else {
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
            createdAt: dayjs().toDate(),
            updatedAt: dayjs().toDate(),
            status: 'open',
            headSha: payload.head.sha,
            baseSha: payload.base.sha,
            reviewedFiles: [],
            triggerTaskIds: [],
          },
        });

        return newJob;
      }
    } catch (error) {
      logger.error(`Error creating/updating job record: ${error}`);
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
}
