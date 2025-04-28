import { logger } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";
import { processPullRequestWebhookTask } from "@/app/trigger/process-pull-request-webhook";
import { processCommentWebhookTask } from "@/app/trigger/process-comment-webhook";

const interestedPrEvents = ["closed", "opened", "edited", "reopened"];
const interestedCommentEvents = ["created", "edited"];

export async function POST(request: NextRequest) {
  const githubEvent = request.headers.get('x-github-event');
  const body = await request.json();

  let eventType = "";

  if (githubEvent === 'pull_request') {
    eventType = "pull_request";
  } else if (githubEvent === 'issue_comment') {
    eventType = "issue_comment";
  } else if (githubEvent === 'pull_request_review_comment') {
    eventType = "pull_request_review_comment";
  } else {
    // Fallback to body-based detection
    if (body.pull_request) eventType = "pull_request";
    if (body.comment && body.issue) eventType = "issue_comment";
  }


  try {
    if (eventType === "pull_request") {
      if (!interestedPrEvents.includes(body.action)) {
        return NextResponse.json({ status: "ignored", reason: "Uninterested PR action" });
      }

      try {
        await processPullRequestWebhookTask.trigger({
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

        return NextResponse.json({ status: "success", event: "pull_request" });
      } catch (error) {
        logger.error(`Error triggering PR webhook task: ${error}`);
        return NextResponse.json(
          { status: "error", message: `Error processing PR webhook: ${error}` },
          { status: 500 }
        );
      }
    } else if (eventType === "issue_comment") {
      if (!interestedCommentEvents.includes(body.action)) {
        return NextResponse.json({ status: "ignored", reason: "Uninterested comment action" });
      }

      if (!body.issue || !body.issue.pull_request) {
        return NextResponse.json({ status: "ignored", reason: "Not a PR comment" });
      }

      try {
        await processCommentWebhookTask.trigger({
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
            html_url: body.comment.html_url,
            url: body.comment.url,
          },
          issue: {
            number: body.issue.number,
            title: body.issue.title,
            body: body.issue.body,
            user: {
              login: body.issue.user.login,
              id: body.issue.user.id,
            },
            pull_request: body.issue.pull_request,
          },
          repository: {
            id: body.repository.id,
            name: body.repository.name,
            owner: {
              login: body.repository.owner.login,
            },
            full_name: body.repository.full_name,
          },
          installation: {
            id: body.installation.id,
          },
        });

        return NextResponse.json({ status: "success", event: "issue_comment" });
      } catch (error) {
        logger.error(`Error triggering comment webhook task: ${error}`);
        return NextResponse.json(
          { status: "error", message: `Error processing comment webhook: ${error}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ status: "ignored", reason: "Unhandled event type" });
  } catch (error) {
    logger.error(`Error processing webhook: ${error}`);
    return NextResponse.json({ status: "error", message: `Error processing webhook: ${error}` }, { status: 500 });
  }
}
