import { NextResponse } from 'next/server'
import {
  dmKeyFor,
  isAdmin as isAdminMember,
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

  // Admission decides what the sidebar contains, not whether it renders.
  const cohortMember = me.status === 'active'

  const [channelRows, memberRows, unread] = await Promise.all([
    listChannels(me.id, cohortMember),
    // The roster is a cohort surface. Someone still pending sees no one, so
    // signing up cannot be used to enumerate the cohort.
    cohortMember ? listMembers() : Promise.resolve([]),
    unreadByScope(me.id),
  ])

  const isAdmin = isAdminMember(me.handle, me.email)

  return NextResponse.json({
    me: { ...me, isAdmin, cohortMember },
    channels: channelRows
      .filter((c) => !c.archived)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        adminOnly: c.adminOnly,
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
