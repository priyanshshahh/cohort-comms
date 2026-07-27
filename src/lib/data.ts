import { auth, currentUser } from '@clerk/nextjs/server'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  max,
  or,
  sql,
} from 'drizzle-orm'
import { getDb } from '@/db'
import { channels, messages, notifications, reactions, reads, typing, users } from '@/db/schema'

/** Channels every cohort member lands in, created on first boot. */
export const DEFAULT_CHANNELS = [
  {
    slug: 'announcements',
    name: 'announcements',
    description: 'Staff and admin broadcasts — read-only for members',
    isDefault: true,
    adminOnly: true,
  },
  {
    slug: 'general',
    name: 'general',
    description: 'Cohort-wide chatter',
    isDefault: true,
  },
  {
    slug: 'project-2',
    name: 'project-2',
    description: 'Week 2 — internal communications',
    isDefault: true,
  },
  {
    slug: 'peer-review',
    name: 'peer-review',
    description: 'Review week coordination and submission links',
    isDefault: true,
  },
  {
    slug: 'help',
    name: 'help',
    description: 'Blockers, questions, and debugging',
    isDefault: true,
  },
]

/** Cap on the history scanned for unread badges. */
const UNREAD_SCAN_LIMIT = 2000

/**
 * Cohort admins, by handle. Configurable per deployment so the winning
 * platform can hand posting rights to staff without a code change.
 */
export function adminHandles(): string[] {
  return (process.env.ADMIN_HANDLES ?? 'admin,priyanshshahh')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminHandle(handle: string | null | undefined): boolean {
  if (!handle) return false
  return adminHandles().includes(handle.toLowerCase())
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('unauthorized')
  return userId
}

/**
 * Raised when an authenticated caller asks for a conversation they are not a
 * participant in. Distinct from a plain Error so routes can answer 403 rather
 * than folding it into a generic 400.
 */
export class ForbiddenError extends Error {
  constructor(message = 'not a participant in this conversation') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** The subset of a message row the thread-read decision depends on. */
export type ThreadRootRef = {
  parentId: number | null
  dmKey: string | null
} | null | undefined

/**
 * The authorization decision for reading a thread, as a pure function so it
 * can be tested exhaustively without a database.
 *
 * A thread scope is only a message id, and ids are a serial primary key, so
 * without this check any signed-in account could walk the id space and read
 * every DM in the cohort. `postMessage` guarded its thread branch from the
 * start; the read paths did not, and the test suite stayed green because its
 * coverage stopped at pure functions. Keeping the rule pure is what lets the
 * tests reach it.
 *
 * Rejecting a non-root id matters as much as the DM check: addressing a reply
 * would otherwise return that reply's entire sibling set.
 */
export function assertThreadRootReadable(
  root: ThreadRootRef,
  meId: string
): void {
  if (!root) throw new ForbiddenError('thread not found')
  if (root.parentId) throw new ForbiddenError('not a thread root')
  if (root.dmKey && !root.dmKey.split('~').includes(meId)) {
    throw new ForbiddenError()
  }
}

/** Load a thread root and prove the caller is allowed to read it. */
async function requireReadableThreadRoot(rootId: number, meId: string) {
  const db = getDb()
  const [root] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, rootId))
    .limit(1)

  assertThreadRootReadable(root, meId)
  return root
}

/**
 * Mirror the signed-in Clerk user into our `users` table and refresh their
 * presence timestamp. Clerk remains the identity source of truth; this row
 * exists so we can join author details onto messages cheaply.
 */
export async function syncCurrentUser() {
  const user = await currentUser()
  if (!user) return null

  const githubAccount = user.externalAccounts?.find(
    (a) => a.provider === 'oauth_github' || a.provider === 'github'
  )
  const handle =
    user.username ??
    githubAccount?.username ??
    user.emailAddresses[0]?.emailAddress?.split('@')[0] ??
    'member'
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || handle

  const db = getDb()
  await db
    .insert(users)
    .values({
      id: user.id,
      handle,
      name,
      avatarUrl: user.imageUrl ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        handle,
        name,
        avatarUrl: user.imageUrl ?? null,
        lastSeenAt: new Date(),
      },
    })

  return { id: user.id, handle, name, avatarUrl: user.imageUrl ?? null }
}

export async function ensureSeedChannels() {
  const db = getDb()
  await db.insert(channels).values(DEFAULT_CHANNELS).onConflictDoNothing()
}

/** Stable conversation key for a pair of users, order-independent. */
export function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join('~')
}

export type Scope =
  | { kind: 'channel'; slug: string }
  | { kind: 'dm'; otherUserId: string }
  | { kind: 'thread'; rootId: number }

/** Parse `channel:general` / `dm:user_123` / `thread:42` into a typed scope. */
export function parseScope(raw: string | null): Scope | null {
  if (!raw) return null
  const [kind, ...rest] = raw.split(':')
  const value = rest.join(':')
  if (!value) return null
  if (kind === 'channel') return { kind: 'channel', slug: value }
  if (kind === 'dm') return { kind: 'dm', otherUserId: value }
  if (kind === 'thread') {
    const rootId = Number(value)
    return Number.isInteger(rootId) && rootId > 0
      ? { kind: 'thread', rootId }
      : null
  }
  return null
}

/** Canonical string form used as the key in the `reads` table. */
export function scopeKey(scope: Scope, meId: string): string {
  if (scope.kind === 'channel') return `channel:${scope.slug}`
  if (scope.kind === 'thread') return `thread:${scope.rootId}`
  return `dm:${dmKeyFor(meId, scope.otherUserId)}`
}

export async function listChannels() {
  const db = getDb()
  return db.select().from(channels).orderBy(asc(channels.id))
}

export async function listMembers() {
  const db = getDb()
  return db.select().from(users).orderBy(desc(users.lastSeenAt))
}

const MESSAGE_FIELDS = {
  id: messages.id,
  body: messages.body,
  attachmentUrl: messages.attachmentUrl,
  createdAt: messages.createdAt,
  editedAt: messages.editedAt,
  parentId: messages.parentId,
  authorId: messages.authorId,
  authorName: users.name,
  authorHandle: users.handle,
  authorAvatar: users.avatarUrl,
}

/**
 * Messages for a conversation, oldest first, with author details joined.
 * Channel and DM views list only root messages; replies live inside their
 * thread and are counted onto the root by `withReplyCounts`.
 */
export async function listMessages(scope: Scope, meId: string) {
  const db = getDb()

  if (scope.kind === 'thread') {
    // Throws unless this caller may read the root's conversation.
    await requireReadableThreadRoot(scope.rootId, meId)

    // The root message first, then its replies in order.
    const rows = await db
      .select(MESSAGE_FIELDS)
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.id))
      .where(
        or(eq(messages.id, scope.rootId), eq(messages.parentId, scope.rootId))
      )
      .orderBy(asc(messages.id))
      .limit(500)
    return rows.map((r) => ({ ...r, replyCount: 0 }))
  }

  const base =
    scope.kind === 'channel'
      ? db
          .select(MESSAGE_FIELDS)
          .from(messages)
          .innerJoin(channels, eq(messages.channelId, channels.id))
          .leftJoin(users, eq(messages.authorId, users.id))
          .where(and(eq(channels.slug, scope.slug), isNull(messages.parentId)))
      : db
          .select(MESSAGE_FIELDS)
          .from(messages)
          .leftJoin(users, eq(messages.authorId, users.id))
          .where(
            and(
              eq(messages.dmKey, dmKeyFor(meId, scope.otherUserId)),
              isNull(messages.parentId)
            )
          )

  const rows = await base.orderBy(asc(messages.id)).limit(500)
  return withReplyCounts(rows)
}

/** Attach a reply count to each root message in one extra query. */
async function withReplyCounts<T extends { id: number }>(rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, replyCount: 0 }))
  const db = getDb()

  const counts = await db
    .select({ parentId: messages.parentId, total: count() })
    .from(messages)
    .where(
      inArray(
        messages.parentId,
        rows.map((r) => r.id)
      )
    )
    .groupBy(messages.parentId)

  const byParent = new Map(counts.map((c) => [c.parentId, Number(c.total)]))
  return rows.map((r) => ({ ...r, replyCount: byParent.get(r.id) ?? 0 }))
}

export async function postMessage(
  scope: Scope,
  meId: string,
  body: string,
  attachmentUrl?: string | null
) {
  const db = getDb()
  const attachment = attachmentUrl?.trim() || null

  let row: typeof messages.$inferSelect | undefined

  if (scope.kind === 'thread') {
    // A reply inherits the root's conversation so it stays searchable and
    // stays inside the same channel or DM. Reuses the same gate as the read
    // paths, so read and write authorization can never drift apart again.
    const root = await requireReadableThreadRoot(scope.rootId, meId)

    ;[row] = await db
      .insert(messages)
      .values({
        channelId: root.channelId,
        dmKey: root.dmKey,
        parentId: root.id,
        authorId: meId,
        body,
        attachmentUrl: attachment,
      })
      .returning()
  } else if (scope.kind === 'channel') {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.slug, scope.slug))
      .limit(1)
    if (!channel) throw new Error('channel not found')

    if (channel.adminOnly) {
      const [author] = await db
        .select({ handle: users.handle })
        .from(users)
        .where(eq(users.id, meId))
        .limit(1)
      if (!isAdminHandle(author?.handle)) {
        throw new Error('#announcements is read-only for members')
      }
    }

    ;[row] = await db
      .insert(messages)
      .values({
        channelId: channel.id,
        authorId: meId,
        body,
        attachmentUrl: attachment,
      })
      .returning()
  } else {
    ;[row] = await db
      .insert(messages)
      .values({
        dmKey: dmKeyFor(meId, scope.otherUserId),
        authorId: meId,
        body,
        attachmentUrl: attachment,
      })
      .returning()
  }

  if (row) await notifyForMessage(scope, meId, row.id, body)
  return row
}

/** Newest message id in a scope — used by the SSE cursor. */
export async function latestMessageId(scope: Scope, meId: string) {
  const db = getDb()

  if (scope.kind === 'thread') {
    // Same gate as the read path, so /api/events cannot be used as a side
    // channel to watch a stranger's DM for activity.
    await requireReadableThreadRoot(scope.rootId, meId)

    const [row] = await db
      .select({ id: max(messages.id) })
      .from(messages)
      .where(
        or(eq(messages.id, scope.rootId), eq(messages.parentId, scope.rootId))
      )
    return row?.id ?? 0
  }

  if (scope.kind === 'channel') {
    const [row] = await db
      .select({ id: max(messages.id) })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(and(eq(channels.slug, scope.slug), isNull(messages.parentId)))
    return row?.id ?? 0
  }

  const [row] = await db
    .select({ id: max(messages.id) })
    .from(messages)
    .where(
      and(
        eq(messages.dmKey, dmKeyFor(meId, scope.otherUserId)),
        isNull(messages.parentId)
      )
    )
  return row?.id ?? 0
}

function previewText(body: string): string {
  const trimmed = body.replace(/\s+/g, ' ').trim()
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed || '(attachment)'
}

/**
 * Fan out @mention / DM / thread-reply notifications after a successful post.
 */
async function notifyForMessage(
  scope: Scope,
  actorId: string,
  messageId: number,
  body: string
) {
  const db = getDb()
  const preview = previewText(body)
  const scopeStr = scopeKey(scope, actorId)
  const recipients = new Map<string, string>()

  const handles = [...body.matchAll(/@([a-zA-Z0-9_-]{2,39})/g)].map((m) =>
    m[1].toLowerCase()
  )
  if (handles.length > 0) {
    const wanted = [...new Set(handles)]
    const matched = await db
      .select({ id: users.id, handle: users.handle })
      .from(users)
      .where(
        sql`lower(${users.handle}) in (${sql.join(
          wanted.map((h) => sql`${h}`),
          sql`, `
        )})`
      )
    for (const u of matched) {
      if (u.id !== actorId) recipients.set(u.id, 'mention')
    }
  }

  if (scope.kind === 'dm' && scope.otherUserId !== actorId) {
    recipients.set(scope.otherUserId, recipients.get(scope.otherUserId) ?? 'dm')
  }

  if (scope.kind === 'thread') {
    const [root] = await db
      .select({ authorId: messages.authorId })
      .from(messages)
      .where(eq(messages.id, scope.rootId))
      .limit(1)
    if (root && root.authorId !== actorId) {
      recipients.set(root.authorId, recipients.get(root.authorId) ?? 'reply')
    }
  }

  if (recipients.size === 0) return

  await db.insert(notifications).values(
    [...recipients.entries()].map(([userId, kind]) => ({
      userId,
      actorId,
      kind,
      messageId,
      scope: scopeStr,
      preview,
    }))
  )
}

export async function listNotifications(meId: string, limit = 30) {
  const db = getDb()
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      messageId: notifications.messageId,
      scope: notifications.scope,
      preview: notifications.preview,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: users.name,
      actorHandle: users.handle,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, meId))
    .orderBy(desc(notifications.id))
    .limit(limit)

  return rows.map((r) => ({
    ...r,
    href: hrefForScope(r.scope, meId),
  }))
}

function hrefForScope(scope: string, meId: string): string {
  if (scope.startsWith('channel:')) return `/c/${scope.slice('channel:'.length)}`
  if (scope.startsWith('dm:')) {
    const key = scope.slice('dm:'.length)
    const other = key.split('~').find((id) => id !== meId) ?? ''
    return `/dm/${other}`
  }
  if (scope.startsWith('thread:')) {
    // Threads open from the parent conversation; land on general as a safe default.
    return '/c/general'
  }
  return '/c/general'
}

export async function unreadNotificationCount(meId: string) {
  const db = getDb()
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, meId), isNull(notifications.readAt)))
  return Number(row?.total ?? 0)
}

export async function markNotificationsRead(meId: string, ids?: number[]) {
  const db = getDb()
  if (ids && ids.length > 0) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, meId), inArray(notifications.id, ids))
      )
    return
  }
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, meId), isNull(notifications.readAt)))
}

/**
 * Unread counts keyed by scope string. Counts are computed in JS over recent
 * history — at cohort scale that is a few hundred rows, and it avoids a
 * correlated subquery per conversation.
 */
export async function unreadByScope(meId: string) {
  const db = getDb()

  const [cursors, recent, allChannels] = await Promise.all([
    db.select().from(reads).where(eq(reads.userId, meId)),
    db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        dmKey: messages.dmKey,
        authorId: messages.authorId,
      })
      .from(messages)
      .where(isNull(messages.parentId))
      .orderBy(desc(messages.id))
      .limit(UNREAD_SCAN_LIMIT),
    db.select({ id: channels.id, slug: channels.slug }).from(channels),
  ])

  const slugById = new Map(allChannels.map((c) => [c.id, c.slug]))
  const cursorByScope = new Map(
    cursors.map((c) => [c.scope, c.lastReadMessageId ?? 0])
  )

  const counts: Record<string, number> = {}
  for (const m of recent) {
    if (m.authorId === meId) continue

    let key: string | null = null
    if (m.channelId != null) {
      const slug = slugById.get(m.channelId)
      if (slug) key = `channel:${slug}`
    } else if (m.dmKey) {
      // Only count DMs this user participates in.
      if (!m.dmKey.split('~').includes(meId)) continue
      key = `dm:${m.dmKey}`
    }
    if (!key) continue

    if (m.id > (cursorByScope.get(key) ?? 0)) {
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  return counts
}

/** Reactions for a set of messages, grouped per message and emoji. */
export async function reactionsFor(messageIds: number[], meId: string) {
  if (messageIds.length === 0) return {}
  const db = getDb()
  const rows = await db
    .select()
    .from(reactions)
    .where(inArray(reactions.messageId, messageIds))

  const grouped: Record<
    number,
    { emoji: string; count: number; mine: boolean }[]
  > = {}

  for (const row of rows) {
    const list = (grouped[row.messageId] ??= [])
    const existing = list.find((r) => r.emoji === row.emoji)
    if (existing) {
      existing.count += 1
      existing.mine ||= row.userId === meId
    } else {
      list.push({ emoji: row.emoji, count: 1, mine: row.userId === meId })
    }
  }
  return grouped
}

/** Add the reaction, or remove it if this user already reacted with it. */
export async function toggleReaction(
  messageId: number,
  meId: string,
  emoji: string
) {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, meId),
        eq(reactions.emoji, emoji)
      )
    )
    .limit(1)

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id))
    return { active: false }
  }

  await db.insert(reactions).values({ messageId, userId: meId, emoji })
  return { active: true }
}

/**
 * Identity used for messages delivered by the Forth webhook, so board events
 * are attributable rather than appearing to come from a person.
 */
export const FORTH_BOT_ID = 'forth-bot'

export async function ensureForthBot() {
  const db = getDb()
  await db
    .insert(users)
    .values({
      id: FORTH_BOT_ID,
      handle: 'forth',
      name: 'Forth',
      avatarUrl: null,
    })
    .onConflictDoNothing()
}

/** Post an inbound board event into a channel as the Forth bot. */
export async function postFromForth(slug: string, body: string) {
  const db = getDb()
  await ensureForthBot()

  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.slug, slug))
    .limit(1)
  if (!channel) throw new Error(`channel #${slug} not found`)

  const [row] = await db
    .insert(messages)
    .values({ channelId: channel.id, authorId: FORTH_BOT_ID, body })
    .returning()
  return row
}

/**
 * Keyword search across every public channel plus the caller's own DMs.
 * DMs belonging to other people are never searchable.
 */
export async function searchMessages(meId: string, query: string) {
  const db = getDb()

  /**
   * Ranked full-text search over a generated `tsvector` column with a GIN
   * index. `websearch_to_tsquery` parses user syntax ("quoted phrase", -minus)
   * safely, so a stray operator cannot break or inject into the query, and
   * `ts_rank` orders by relevance rather than recency alone. Replies are
   * included; DMs are restricted to conversations the caller is part of.
   */
  const rows = await db.execute(sql`
    SELECT m.id,
           m.body,
           m.created_at   AS "createdAt",
           m.channel_id   AS "channelId",
           m.dm_key       AS "dmKey",
           m.parent_id    AS "parentId",
           c.slug         AS "channelSlug",
           u.name         AS "authorName",
           u.handle       AS "authorHandle",
           ts_rank(m.search_vector, q.query) AS rank
    FROM messages m
    CROSS JOIN websearch_to_tsquery('english', ${query}) AS q(query)
    LEFT JOIN channels c ON c.id = m.channel_id
    LEFT JOIN users u ON u.id = m.author_id
    WHERE m.search_vector @@ q.query
      AND (m.channel_id IS NOT NULL OR m.dm_key LIKE ${'%' + meId + '%'})
    ORDER BY rank DESC, m.id DESC
    LIMIT 50
  `)

  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{
    id: number
    body: string
    createdAt: string
    dmKey: string | null
    parentId: number | null
    channelSlug: string | null
    authorName: string | null
    authorHandle: string | null
  }>

  return list.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    authorName: r.authorName,
    authorHandle: r.authorHandle,
    href: r.channelSlug
      ? `/c/${r.channelSlug}`
      : `/dm/${(r.dmKey ?? '').split('~').find((id) => id !== meId) ?? ''}`,
    label: r.channelSlug
      ? `#${r.channelSlug}${r.parentId ? ' · thread' : ''}`
      : 'Direct message',
  }))
}

export async function markRead(scope: Scope, meId: string, messageId: number) {
  const db = getDb()
  await db
    .insert(reads)
    .values({
      userId: meId,
      scope: scopeKey(scope, meId),
      lastReadMessageId: messageId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [reads.userId, reads.scope],
      set: { lastReadMessageId: messageId, updatedAt: new Date() },
    })
}


/** Mark the current user as typing in a scope (TTL ~4s client-side). */
export async function pulseTyping(scopeStr: string, meId: string) {
  const db = getDb()
  await db
    .insert(typing)
    .values({ scope: scopeStr, userId: meId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [typing.scope, typing.userId],
      set: { updatedAt: new Date() },
    })
}

/** Active typers in a scope within the last 4 seconds, excluding me. */
export async function listTyping(scopeStr: string, meId: string) {
  const db = getDb()
  const cutoff = new Date(Date.now() - 4_000)
  const rows = await db
    .select({
      userId: typing.userId,
      handle: users.handle,
      name: users.name,
      updatedAt: typing.updatedAt,
    })
    .from(typing)
    .leftJoin(users, eq(typing.userId, users.id))
    .where(and(eq(typing.scope, scopeStr), gt(typing.updatedAt, cutoff)))
  return rows.filter((r) => r.userId !== meId)
}
