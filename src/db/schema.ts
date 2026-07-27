import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'

/**
 * Cohort members. `id` is the Clerk user id, so Clerk stays the source of
 * truth for identity and this table only caches display data + presence.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  handle: text('handle').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  /** Only cohort admins may post; everyone may read. Used by #announcements. */
  adminOnly: boolean('admin_only').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * One table backs both channel posts and DMs.
 * A channel message has `channelId` set; a DM has `dmKey` set to the two
 * participants' ids sorted and joined, so either participant derives the
 * same key without needing a separate conversation row.
 */
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id'),
    dmKey: text('dm_key'),
    authorId: text('author_id').notNull(),
    body: text('body').notNull(),
    /**
     * Set on a threaded reply, pointing at the root message it answers.
     * Root messages leave it null, so a conversation lists only roots and
     * each root carries its reply count.
     */
    parentId: integer('parent_id'),
    /** Optional image/file URL (Blob or small data URL fallback). */
    attachmentUrl: text('attachment_url'),
    editedAt: timestamp('edited_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('messages_channel_idx').on(t.channelId, t.id),
    index('messages_dm_idx').on(t.dmKey, t.id),
    index('messages_parent_idx').on(t.parentId, t.id),
  ]
)

/**
 * In-app alerts for @mentions, DM arrivals, and thread replies.
 * Separate from `reads` (conversation unread) so the bell can surface
 * actionable events without changing channel badges.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    actorId: text('actor_id').notNull(),
    kind: text('kind').notNull(),
    messageId: integer('message_id').notNull(),
    scope: text('scope').notNull(),
    preview: text('preview').notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.id)]
)

/**
 * Per-user read cursor for a conversation, used for unread badges.
 * `scope` is either `channel:<id>` or `dm:<dmKey>`.
 */
export const reads = pgTable(
  'reads',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    scope: text('scope').notNull(),
    lastReadMessageId: integer('last_read_message_id').notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reads_user_scope_idx').on(t.userId, t.scope)]
)

/**
 * Ephemeral typing indicators. Rows older than a few seconds are ignored.
 */
export const typing = pgTable(
  'typing',
  {
    scope: text('scope').notNull(),
    userId: text('user_id').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.userId] })]
)

/** Emoji reactions. One row per (message, user, emoji). */
export const reactions = pgTable(
  'reactions',
  {
    id: serial('id').primaryKey(),
    messageId: integer('message_id').notNull(),
    userId: text('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reactions_unique_idx').on(t.messageId, t.userId, t.emoji)]
)

export type User = typeof users.$inferSelect
export type Channel = typeof channels.$inferSelect
export type Message = typeof messages.$inferSelect
