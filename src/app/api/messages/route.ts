import { NextRequest, NextResponse } from 'next/server'
import {
  listMessages,
  markRead,
  parseScope,
  postMessage,
  reactionsFor,
  requireUserId,
} from '@/lib/data'

const MAX_BODY_LENGTH = 4000

/** GET /api/messages?scope=channel:general — conversation history. */
export async function GET(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const scope = parseScope(request.nextUrl.searchParams.get('scope'))
  if (!scope) {
    return NextResponse.json({ error: 'invalid scope' }, { status: 400 })
  }

  const rows = await listMessages(scope, meId)
  const grouped = await reactionsFor(
    rows.map((r) => r.id),
    meId
  )

  // Reading the conversation clears its unread badge.
  const newest = rows.at(-1)
  if (newest) await markRead(scope, meId, newest.id)

  return NextResponse.json({
    messages: rows.map((r) => ({ ...r, reactions: grouped[r.id] ?? [] })),
    meId,
  })
}

/** POST /api/messages — send to a channel or DM. */
export async function POST(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const scope = parseScope(payload?.scope ?? null)
  const body = typeof payload?.body === 'string' ? payload.body.trim() : ''

  if (!scope) {
    return NextResponse.json({ error: 'invalid scope' }, { status: 400 })
  }
  if (!body) {
    return NextResponse.json({ error: 'message is empty' }, { status: 400 })
  }
  if (body.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 })
  }

  try {
    const row = await postMessage(scope, meId, body)
    if (row) await markRead(scope, meId, row.id)
    return NextResponse.json({ message: row }, { status: 201 })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'send failed'
    return NextResponse.json({ error: reason }, { status: 400 })
  }
}
