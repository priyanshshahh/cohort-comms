import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getDb } from '@/db'
import { sql } from 'drizzle-orm'
import { postFromForth } from '@/lib/data'
import { normalizeForthUrl } from '@/lib/forth'

/**
 * Inbound webhook for Forth board events.
 *
 * Forth does not publish outbound webhooks today, so this is the receiving
 * half of the contract, live and ready: point Forth (or any relay) at
 * `POST /api/webhooks/forth` with the shared secret and ticket transitions
 * appear in the cohort's channels automatically.
 */

/** Constant-time compare so the secret can't be probed byte-by-byte. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const STATUS_ICON: Record<string, string> = {
  shipped: '✅',
  'in forge': '🔨',
  camped: '⛺',
  'quest log': '📋',
}

export async function POST(request: NextRequest) {
  const expected = process.env.FORTH_WEBHOOK_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }

  const provided = request.headers.get('x-forth-secret') ?? ''
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)

  /**
   * Replay protection. A delivery may legitimately be retried, but it must not
   * post twice, and an intercepted payload must not stay replayable forever.
   * `event_id` is a primary key, so the insert is the dedupe.
   */
  const eventId =
    typeof payload?.id === 'string' ? payload.id.slice(0, 200) : null
  if (eventId) {
    const inserted = await getDb().execute(sql`
      INSERT INTO webhook_events (event_id) VALUES (${eventId})
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `)
    const rows = Array.isArray(inserted)
      ? inserted
      : ((inserted as { rows?: unknown[] }).rows ?? [])
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
  }

  // Reject stale payloads so a captured delivery cannot be replayed later.
  if (typeof payload?.sentAt === 'string') {
    const sent = Date.parse(payload.sentAt)
    if (Number.isFinite(sent) && Math.abs(Date.now() - sent) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: 'payload timestamp outside the accepted window' },
        { status: 400 }
      )
    }
  }

  const ticket = payload?.ticket
  if (!ticket?.title) {
    return NextResponse.json(
      { error: 'ticket.title is required' },
      { status: 400 }
    )
  }

  // Only accept links that actually point at Forth, so the webhook cannot be
  // used to inject arbitrary URLs into the cohort's channels. Normalize view
  // paths (`/board`) to the live SPA root — Forth has no server routes there.
  let link = ''
  if (typeof ticket.url === 'string') {
    const normalized = normalizeForthUrl(ticket.url)
    if (normalized) link = normalized.url
  }

  const status = String(ticket.status ?? '').trim()
  const icon = STATUS_ICON[status.toLowerCase()] ?? '⚒'
  const parts = [`${icon} ${ticket.title}`]
  if (status) parts.push(`moved to ${status}`)
  if (ticket.assignee) parts.push(`· ${ticket.assignee}`)

  const body = [parts.join(' '), link].filter(Boolean).join('\n')
  const slug = typeof payload.channel === 'string' ? payload.channel : 'general'

  try {
    const message = await postFromForth(slug, body)
    return NextResponse.json(
      { ok: true, messageId: message?.id },
      { status: 201 }
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'delivery failed'
    return NextResponse.json({ error: reason }, { status: 400 })
  }
}
