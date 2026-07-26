import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, toggleReaction } from '@/lib/data'

/** Emoji allowed on messages — a fixed set keeps the column predictable. */
const ALLOWED = ['👍', '🎉', '🔥', '👀', '✅', '❤️']

/** POST /api/reactions — add or remove the caller's reaction. */
export async function POST(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const messageId = Number(payload?.messageId)
  const emoji = String(payload?.emoji ?? '')

  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: 'invalid messageId' }, { status: 400 })
  }
  if (!ALLOWED.includes(emoji)) {
    return NextResponse.json({ error: 'unsupported emoji' }, { status: 400 })
  }

  return NextResponse.json(await toggleReaction(messageId, meId, emoji))
}
