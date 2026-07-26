import { NextResponse } from 'next/server'
import {
  dmKeyFor,
  listChannels,
  listMembers,
  syncCurrentUser,
  unreadByScope,
} from '@/lib/data'

/**
 * Everything the sidebar needs in one request: identity, channel list,
 * cohort roster with presence, and unread counts. Polled by the shell.
 */
export async function GET() {
  const me = await syncCurrentUser()
  if (!me) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [channelRows, memberRows, unread] = await Promise.all([
    listChannels(),
    listMembers(),
    unreadByScope(me.id),
  ])

  return NextResponse.json({
    me,
    channels: channelRows.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      unread: unread[`channel:${c.slug}`] ?? 0,
    })),
    members: memberRows.map((m) => ({
      id: m.id,
      handle: m.handle,
      name: m.name,
      avatarUrl: m.avatarUrl,
      lastSeenAt: m.lastSeenAt,
      isSelf: m.id === me.id,
      unread: unread[`dm:${dmKeyFor(me.id, m.id)}`] ?? 0,
    })),
  })
}
