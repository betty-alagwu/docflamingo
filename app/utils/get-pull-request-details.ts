import { logger } from "@trigger.dev/sdk/v3";
import { App } from "octokit";
import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { env } from "@/app/config/env";

export async function getPullRequestDetails(payload: ProcessPullRequestWebhookTaskPayload) {
  try {
    const app = new App({
      appId: env.GITHUB_APP_CLIENT_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    });

    const octokit = await app.getInstallationOctokit(payload.installation.id);

    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: payload.number,
    });

    return pullRequest;
  } catch (error) {
    logger.error(`Error getting PR details: ${error}`);
    return null;
  }
}
