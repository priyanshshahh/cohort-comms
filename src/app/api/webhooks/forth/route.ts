import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getDb } from '@/db'
import { sql } from 'drizzle-orm'
import { postFromForth } from '@/lib/data'
import { normalizeForthUrl, stripNonForthUrls } from '@/lib/forth'

/**
 * Inbound webhook for Forth board events (`ticket.shipped` and compatible
 * payloads). Forth sends `x-forth-secret`; this route posts as the Forth bot.
 */

/** Constant-time compare so the secret can't be probed byte-by-byte. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function releaseEventReservation(eventId: string): Promise<void> {
  await getDb().execute(sql`
    DELETE FROM webhook_events WHERE event_id = ${eventId}
  `)
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

  // Reject stale payloads before reserving an event id so a clock-skewed
  // retry is not permanently consumed.
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

  /**
   * Replay protection. Reserve `event_id` before posting so concurrent
   * duplicates create at most one message. If the bot post fails, release the
   * reservation so Forth's explicit retry can succeed.
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

  // Only accept links that actually point at Forth, so the webhook cannot be
  // used to inject arbitrary URLs into the cohort's channels. Normalize view
  // paths (`/board`) and preserve allowlisted hashes (`/#proof`).
  let link = ''
  if (typeof ticket.url === 'string') {
    const normalized = normalizeForthUrl(ticket.url)
    if (normalized) link = normalized.url
  }

  // `ticket.url` is not the only attacker-controlled field. Title, status and
  // assignee are interpolated into the body too, and the renderer auto-links
  // bare URLs, so each one gets the same URL policy — otherwise the guard
  // above holds for one field while the others stay wide open.
  const title = stripNonForthUrls(String(ticket.title))
  const status = stripNonForthUrls(String(ticket.status ?? '').trim())
  const assignee = ticket.assignee
    ? stripNonForthUrls(String(ticket.assignee))
    : ''

  const icon = STATUS_ICON[status.toLowerCase()] ?? '⚒'
  const parts = [`${icon} ${title}`]
  if (status) parts.push(`moved to ${status}`)
  if (assignee) parts.push(`· ${assignee}`)

  const body = [parts.join(' '), link].filter(Boolean).join('\n')
  const slug = typeof payload.channel === 'string' ? payload.channel : 'general'

  try {
    const message = await postFromForth(slug, body)
    return NextResponse.json(
      { ok: true, messageId: message?.id },
      { status: 201 }
    )
  } catch (error) {
    if (eventId) {
      try {
        await releaseEventReservation(eventId)
      } catch {
        // Prefer surfacing the post failure; a stuck reservation is worse
        // than a noisy delete error and can be cleaned up manually.
      }
    }
    const reason = error instanceof Error ? error.message : 'delivery failed'
    return NextResponse.json({ error: reason }, { status: 400 })
  }
}
