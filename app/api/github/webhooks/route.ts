import { processPullRequestWebhookTask } from "@/app/trigger/process-pull-request-webhook";
import { NextRequest, NextResponse } from "next/server";

const interestedEvents = ['closed', 'opened', 'edited', 'reopened']

export async function POST(request: NextRequest) {
    const body = await request.json()

    if (!interestedEvents.includes(body.action)) {
        return NextResponse.json([])
    }

    // run the Webhook task using trigger()
    await processPullRequestWebhookTask.trigger({
        action: body.action,
        number: body.number,
        repository: {
            id: body.repository.id,
            name: body.repository.name,
            owner: {
                login: body.repository.owner.login
            }
        },
        installation: {
            id: body.installation.id
        },
        base: {
            sha: body.pull_request.base.sha
        },
        head: {
            sha: body.pull_request.head.sha
        }
    })

    return NextResponse.json([])
}
