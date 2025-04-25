import { task } from "@trigger.dev/sdk/v3";
import { prisma } from "../database/prisma";
import { ProcessNewPullRequestService } from "../services/process-new-pull-request.service";

export interface ProcessPullRequestWebhookTaskPayload {
  action: "closed" | "opened" | "reopened";
  number: number;
  repository: {
    id: number;
    name: string;
    owner: {
      login: string;
    };
  };
  installation: {
    id: number;
  };
  head: {
    sha: string;
  };
  base: {
    sha: string;
  };
}

export const processPullRequestWebhookTask = task({
  id: "process-pull-request-webhook",
  async run(payload: ProcessPullRequestWebhookTaskPayload) {
    const installation = await prisma.installation.findFirst({
      where: {
        githubInstallationId: payload.installation.id,
      },
    });

    if (!installation) {
      throw new Error("Installation with ID of " + payload.installation.id + " not found");
    }

    // if the action is opened new pull request
    if (payload.action === "opened") {
      await new ProcessNewPullRequestService().run(payload);
    }

    if (payload.action === "closed") {
      // find the job associated with the pull request and mark it as done/closed
    }

    if (payload.action === "reopened") {
      // find the job associated with the pull request and reopen it.
    }

    return {
      message: "success",
    };
  },
});
