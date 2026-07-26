import { NextRequest, NextResponse } from 'next/server'
import {
  listNotifications,
  markNotificationsRead,
  requireUserId,
  unreadNotificationCount,
} from '@/lib/data'

/** GET /api/notifications — bell inbox + unread count. */
export async function GET() {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const items = await listNotifications(meId)
  const listedUnread = items.filter((i) => !i.readAt).length
  const unread =
    items.length < 30 ? listedUnread : await unreadNotificationCount(meId)
  return NextResponse.json({ items, unread })
}

/** PATCH /api/notifications — mark one or all as read. */
export async function PATCH(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const ids = Array.isArray(payload?.ids)
    ? payload.ids.filter((n: unknown) => typeof n === 'number')
    : undefined

  await markNotificationsRead(meId, ids)
  return NextResponse.json({ ok: true })
}
