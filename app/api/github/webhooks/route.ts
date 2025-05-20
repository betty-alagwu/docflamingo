import { logger } from '@trigger.dev/sdk/v3';
import { NextResponse } from 'next/server';

import { prisma } from '@/app/database/prisma';
import { processCommentWebhookTask } from '@/app/trigger/process-comment-webhook';
import { processPullRequestWebhookTask } from '@/app/trigger/process-pull-request-webhook';

import type { NextRequest } from 'next/server';

const interestedPrEvents = ['closed', 'opened', 'edited', 'reopened'];
const interestedCommentEvents = ['created', 'edited'];

export async function POST(request: NextRequest) {
  const githubEvent = request.headers.get('X-GitHub-Event');
  const body = await request.json();

  try {
    if (githubEvent === 'pull_request') {
      if (!interestedPrEvents.includes(body.action)) {
        return NextResponse.json({ status: 'ignored', reason: 'Uninterested PR action' });
      }

      try {
        const result = await processPullRequestWebhookTask.trigger({
          action: body.action,
          number: body.number,
          repository: {
            id: body.repository.id,
            name: body.repository.name,
            owner: {
              login: body.repository.owner.login,
            },
          },
          installation: {
            id: body.installation.id,
          },
          base: {
            sha: body.pull_request.base.sha,
          },
          head: {
            sha: body.pull_request.head.sha,
          },
        });

        if (body.action !== 'closed' && result && result.id) {
          try {
            const job = await prisma.job.findFirst({
              where: {
                githubRepositoryId: body.repository.id,
                githubPullRequestId: body.number,
              },
            });

            if (job) {
              await prisma.job.update({
                where: { id: job.id },
                data: {
                  triggerTaskIds: [...(job.triggerTaskIds || []), result.id],
                },
              });
            }
          } catch (dbError) {
            logger.error(`Error storing task ID: ${dbError}`);
          }
        }

        return NextResponse.json({ status: 'success', event: 'pull_request' });
      } catch (error) {
        return NextResponse.json(
          { status: 'error', message: `Error processing PR webhook: ${error}` },
          { status: 500 }
        );
      }
    } else if (githubEvent === 'pull_request_review_comment') {
      if (!interestedCommentEvents.includes(body.action)) {
        return NextResponse.json({
          status: 'ignored',
          reason: `Uninterested comment action: ${body.action}`,
        });
      }

      try {
        const result = await processCommentWebhookTask.trigger({
          action: body.action,
          comment: {
            id: body.comment.id,
            body: body.comment.body,
            user: {
              login: body.comment.user.login,
              id: body.comment.user.id,
            },
            created_at: body.comment.created_at,
            updated_at: body.comment.updated_at,
            in_reply_to_id: body.comment.in_reply_to_id || null,
            url: body.comment.url,
            path: body.comment.path,
            commit_id: body.comment.commit_id,
            pull_request_review_id: body.comment.pull_request_review_id,
          },
          pull_request: {
            number: body.pull_request.number,
            title: body.pull_request.title,
            body: body.pull_request.body,
            user: {
              login: body.pull_request.user.login,
              id: body.pull_request.user.id,
            },
            url: body.pull_request.url,
            html_url: body.pull_request.html_url,
          },
          repository: {
            id: body.repository.id,
            name: body.repository.name,
            owner: {
              login: body.repository.owner.login,
            },
          },
          installation: {
            id: body.installation.id,
          },
        });

        if (result && result.id) {
          try {
            const job = await prisma.job.findFirst({
              where: {
                githubRepositoryId: body.repository.id,
                githubPullRequestId: body.pull_request.number,
              },
            });

            if (job) {
              await prisma.job.update({
                where: { id: job.id },
                data: {
                  triggerTaskIds: [...(job.triggerTaskIds || []), result.id],
                },
              });
              logger.info(
                `Stored comment task ID ${result.id} for PR #${body.pull_request.number}`
              );
            }
          } catch (dbError) {
            logger.error(`Error storing comment task ID: ${dbError}`);
          }
        }

        return NextResponse.json({ status: 'success', event: 'pull_request_review_comment' });
      } catch (error) {
        return NextResponse.json(
          { status: 'error', message: `Error processing PR review comment webhook: ${error}` },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ status: 'ignored', reason: 'Unhandled event type' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: `Error processing webhook: ${error}` },
      { status: 500 }
    );
  }
}
