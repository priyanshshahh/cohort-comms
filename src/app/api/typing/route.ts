import { NextRequest, NextResponse } from 'next/server'
import {
  listTyping,
  parseScope,
  pulseTyping,
  requireUserId,
  scopeKey,
} from '@/lib/data'
import { rateLimited } from '@/lib/rateLimit'

/** GET /api/typing?scope= — who is typing right now. */
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
  const key = scopeKey(scope, meId)
  const typers = await listTyping(key, meId)
  return NextResponse.json({ typers })
}

/** POST /api/typing — pulse that I am typing in this scope. */
export async function POST(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limited = await rateLimited(meId, 'typing')
  if (limited) return limited

  const payload = await request.json().catch(() => ({}))
  const scope = parseScope(
    typeof payload?.scope === 'string' ? payload.scope : null
  )
  if (!scope) {
    return NextResponse.json({ error: 'invalid scope' }, { status: 400 })
  }
  await pulseTyping(scopeKey(scope, meId), meId)
  return NextResponse.json({ ok: true })
}
