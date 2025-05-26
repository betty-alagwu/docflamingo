import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const clonedRequest = request.clone();

  const apiUrl = new URL('/api/github/webhooks', request.url);

  return fetch(apiUrl, {
    method: 'POST',
    headers: request.headers,
    body: await clonedRequest.text(),
  });
}
