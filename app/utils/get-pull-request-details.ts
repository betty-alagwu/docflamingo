import { logger } from '@trigger.dev/sdk/v3';
import { App } from 'octokit';

import { env } from '@/app/config/env';
import { githubPullRequestSchema, type GitHubPullRequest } from '@/app/schemas/github.schema';

import type { ProcessPullRequestWebhookTaskPayload } from '@/app/trigger/process-pull-request-webhook';

export async function getPullRequestDetails(
  payload: ProcessPullRequestWebhookTaskPayload
): Promise<GitHubPullRequest | null> {
  try {
    const app = new App({
      appId: env.GITHUB_APP_CLIENT_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    });

    const octokit = await app.getInstallationOctokit(payload.installation.id);

    const { data: pullRequestData } = await octokit.rest.pulls.get({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: payload.number,
    });

    const pullRequest = githubPullRequestSchema.parse(pullRequestData);
    return pullRequest;
  } catch (error) {
    logger.error(`Error getting PR details: ${error}`);
    return null;
  }
}
