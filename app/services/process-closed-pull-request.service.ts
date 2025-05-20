import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { logger, runs, configure } from "@trigger.dev/sdk/v3";
import { prisma } from "../database/prisma";
import { App } from "octokit";
import dayjs from "dayjs";
import { env } from "@/app/config/env";

/**
 * Service to handle processing of closed pull requests
 * Responsible for:
 * - Logging PR closure events
 * - Checking if PR was merged
 * - Canceling any pending tasks
 * - Cleaning up resources
 */
export class ProcessClosedPullRequestService {
  async run(payload: ProcessPullRequestWebhookTaskPayload) {
    try {
      this.logClosedPr(payload);
      const wasMerged = await this.checkIfPrWasMerged(payload);

      await this.cancelPendingTasks(payload);

      await this.cleanupResources(payload);

      return {
        status: "closed",
        prNumber: payload.number,
        wasMerged,
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name
        }
      };
    } catch (error) {
      logger.error(`Error processing closed PR: ${error}`);
      throw error;
    }
  }

  private logClosedPr(payload: ProcessPullRequestWebhookTaskPayload): void {
    const repoFullName = `${payload.repository.owner.login}/${payload.repository.name}`;
    logger.info(`PR #${payload.number} closed in ${repoFullName}`, {
      pr_number: payload.number,
      repository_id: payload.repository.id,
      repository_name: repoFullName,
      installation_id: payload.installation.id,
      head_sha: payload.head.sha,
      base_sha: payload.base.sha,
      action: payload.action
    });
  }

  private async checkIfPrWasMerged(payload: ProcessPullRequestWebhookTaskPayload): Promise<boolean> {
    try {
      const app = new App({
        appId: env.GITHUB_APP_CLIENT_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await app.getInstallationOctokit(payload.installation.id);

      const { data: pullRequest } = await octokit.rest.pulls.get({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        pull_number: payload.number
      });

      const wasMerged = pullRequest.merged === true;

      return wasMerged;
    } catch (error) {
      logger.error(`Error checking if PR was merged: ${error}`);
      return false;
    }
  }

  private async cancelPendingTasks(payload: ProcessPullRequestWebhookTaskPayload): Promise<void> {
    try {
      const job = await prisma.job.findFirst({
        where: {
          githubRepositoryId: payload.repository.id,
          githubPullRequestId: payload.number
        }
      });

      if (!job || !job.triggerTaskIds || job.triggerTaskIds.length === 0) {
        logger.info(`No tasks to cancel for PR #${payload.number}`);
        return;
      }

      configure({
        accessToken: env.TRIGGER_SECRET_KEY,
      });

      for (const taskId of job.triggerTaskIds) {
        try {
          await runs.cancel(taskId);
        } catch (taskError) {
          logger.error(`Error canceling task ${taskId}: ${taskError}`);
        }
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          triggerTaskIds: []
        }
      });
    } catch (error) {
      logger.error(`Error canceling pending tasks: ${error}`);
    }
  }

  private async cleanupResources(payload: ProcessPullRequestWebhookTaskPayload): Promise<void> {
    try {
      const job = await prisma.job.findFirst({
        where: {
          githubRepositoryId: payload.repository.id,
          githubPullRequestId: payload.number
        }
      });

      if (job) {
        const wasMerged = await this.checkIfPrWasMerged(payload);

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: wasMerged ? "merged" : "closed",
            closedAt: dayjs().toDate(),
            mergedAt: wasMerged ? dayjs().toDate() : null
          }
        });
      } else {
        logger.info(`No job record found for PR #${payload.number}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up resources: ${error}`);
    }
  }
}
