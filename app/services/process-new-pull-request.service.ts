import { Octokit } from "octokit";
import { ProcessPullRequestWebhookTaskPayload } from "@/app/trigger/process-pull-request-webhook";
import { GithubService } from '@/app/services/git-providers/github.service'

export class ProcessNewPullRequestService {
 async run(payload: ProcessPullRequestWebhookTaskPayload) {
  const githubService = new GithubService(payload)
  await githubService.initialise();

  await githubService.testLLMIntegration();

  const patchDiff = await githubService.getDiffFiles();
  return patchDiff;
 }
}
