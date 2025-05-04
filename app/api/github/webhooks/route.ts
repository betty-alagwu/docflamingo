import { logger } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";
import { processPullRequestWebhookTask } from "@/app/trigger/process-pull-request-webhook";
import { processCommentWebhookTask } from "@/app/trigger/process-comment-webhook";

const interestedPrEvents = ["closed", "opened", "edited", "reopened"];
const interestedCommentEvents = ["created", "edited"];

export async function POST(request: NextRequest) {
  const githubEvent = request.headers.get('X-GitHub-Event');
  const body = await request.json();

  try {
    if (githubEvent === "pull_request") {
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
        return NextResponse.json(
          { status: "error", message: `Error processing PR webhook: ${error}` },
          { status: 500 }
        );
      }
    } else if (githubEvent === "pull_request_review_comment") {
      if (!interestedCommentEvents.includes(body.action)) {
        return NextResponse.json({
          status: "ignored",
          reason: `Uninterested comment action: ${body.action}`
        });
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
              type: body.comment.user.type,
            },
            created_at: body.comment.created_at,
            updated_at: body.comment.updated_at,
            in_reply_to_id: body.comment.in_reply_to_id || null,
            html_url: body.comment.html_url,
            url: body.comment.url,
            path: body.comment.path,
            position: body.comment.position,
            line: body.comment.line,
            side: body.comment.side,
            commit_id: body.comment.commit_id,
            pull_request_review_id: body.comment.pull_request_review_id,
            diff_hunk: body.comment.diff_hunk,
            original_position: body.comment.original_position,
            start_line: body.comment.start_line,
            original_line: body.comment.original_line,
            subject_type: body.comment.subject_type,
            performed_via_github_app: body.comment.performed_via_github_app,
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
            state: body.pull_request.state,
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

        return NextResponse.json({ status: "success", event: "pull_request_review_comment" });
      } catch (error) {
        return NextResponse.json(
          { status: "error", message: `Error processing PR review comment webhook: ${error}` },
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
