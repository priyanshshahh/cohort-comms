import { NextRequest } from 'next/server'
import {
  ForbiddenError,
  PendingApprovalError,
  latestMessageId,
  parseScope,
  requireUserId,
} from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-Sent Events for near-realtime chat. Polls max(message id) for the
 * scope and emits when it advances. Clients reconnect every ~25s (Vercel
 * function limit friendly); ChatView falls back to SWR only while offline.
 */
export async function GET(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  const scope = parseScope(request.nextUrl.searchParams.get('scope'))
  if (!scope) {
    return new Response('invalid scope', { status: 400 })
  }

  let lastId = Number(request.nextUrl.searchParams.get('after') ?? '0')
  if (!Number.isFinite(lastId) || lastId < 0) lastId = 0

  // Authorize before opening the stream. Checking here rather than inside the
  // loop means an unauthorized probe gets a plain 403 instead of holding a
  // 25-second serverless invocation open only to be told nothing.
  try {
    await latestMessageId(scope, meId)
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof PendingApprovalError
    ) {
      return new Response(error.message, { status: 403 })
    }
    throw error
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      send({ type: 'hello', after: lastId })
      const started = Date.now()
      let lastPing = 0

      try {
        while (Date.now() - started < 25_000) {
          const newest = await latestMessageId(scope, meId)
          if (newest > lastId) {
            lastId = newest
            send({ type: 'message', id: newest })
          } else if (Date.now() - lastPing > 5_000) {
            send({ type: 'ping' })
            lastPing = Date.now()
          }
          await new Promise((r) => setTimeout(r, 800))
        }
      } catch {
        send({ type: 'error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
