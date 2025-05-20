import { task } from '@trigger.dev/sdk/v3';

import { prisma } from '../database/prisma';
import { ProcessClosedPullRequestService } from '../services/process-closed-pull-request.service';
import { ProcessNewPullRequestService } from '../services/process-new-pull-request.service';
import { ProcessReopenedPullRequestService } from '../services/process-reopened-pull-request.service';

export interface ProcessPullRequestWebhookTaskPayload {
  action: 'closed' | 'opened' | 'reopened';
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
  id: 'process-pull-request-webhook',
  async run(payload: ProcessPullRequestWebhookTaskPayload) {
    const installation = await prisma.installation.findFirst({
      where: {
        githubInstallationId: payload.installation.id,
      },
    });

    if (!installation) {
      throw new Error('Installation with ID of ' + payload.installation.id + ' not found');
    }

    if (payload.action === 'opened') {
      await new ProcessNewPullRequestService().run(payload);
    }

    if (payload.action === 'closed') {
      await new ProcessClosedPullRequestService().run(payload);
    }

    if (payload.action === 'reopened') {
      await new ProcessReopenedPullRequestService().run(payload);
    }

    return {
      message: 'success',
    };
  },
});
