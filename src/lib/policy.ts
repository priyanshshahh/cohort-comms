/**
 * Authorization and parsing rules, with no framework or database imports.
 *
 * These live apart from `data.ts` on purpose. Peer review found a DM read
 * leak that survived a green test suite because the rule was tangled up with
 * query code the tests could not reach. Anything that decides who may see
 * what belongs here, where a test can call it directly and nothing but the
 * standard library has to load.
 *
 * `data.ts` re-exports all of this, so callers import from either.
 */

function csvEnv(raw: string | undefined, fallback: string): string[] {
  // A blank value counts as unset. Vercel stores an empty string when a
  // variable is created without one, and `?? fallback` would let that through
  // as "no admins at all", locking the cohort out of its own roster screen.
  const source = raw?.trim() ? raw : fallback
  return source
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Cohort admins by GitHub handle. Roger Hunt runs the cohort; Priyansh is
 * co-admin. Both are defaults rather than hard-coded checks, so staff can
 * change without a deploy.
 */
export function adminHandles(): string[] {
  return csvEnv(
    process.env.ADMIN_HANDLES,
    'rogersuperbuilderalpha,priyanshshahh'
  )
}

/**
 * Cohort admins by email.
 *
 * Handles alone are not enough now that members can sign in with Google: a
 * Google account has no GitHub login, so its handle falls back to the email
 * prefix and would never match. An admin who signs in either way stays an
 * admin.
 */
export function adminEmails(): string[] {
  return csvEnv(process.env.ADMIN_EMAILS, '')
}

export function isAdminHandle(handle: string | null | undefined): boolean {
  if (!handle) return false
  return adminHandles().includes(handle.toLowerCase())
}

/** True when this member is an admin by either handle or email. */
export function isAdmin(
  handle: string | null | undefined,
  email?: string | null
): boolean {
  if (isAdminHandle(handle)) return true
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}

/**
 * Raised when an authenticated caller asks for a conversation they are not a
 * participant in. Distinct from a plain Error so routes answer 403 rather
 * than folding it into a generic 400.
 */
export class ForbiddenError extends Error {
  constructor(message = 'not a participant in this conversation') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** Raised when a signed-in account has not yet been admitted to the cohort. */
export class PendingApprovalError extends Error {
  constructor(message = 'awaiting cohort approval') {
    super(message)
    this.name = 'PendingApprovalError'
  }
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

/** The subset of a message row the thread-read decision depends on. */
export type ThreadRootRef =
  | {
      parentId: number | null
      dmKey: string | null
    }
  | null
  | undefined

/**
 * The authorization decision for reading a thread.
 *
 * A thread scope is only a message id, and ids are a serial primary key, so
 * without this check any signed-in account could walk the id space and read
 * every DM in the cohort. The write path guarded this from the start; the
 * read paths did not. Both share this now.
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

/**
 * Split a pasted roster into clean, unique emails.
 * Admins paste from a spreadsheet or an email client, so accept commas,
 * newlines, semicolons and spaces rather than demanding one format.
 */
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(/[\s,;]+/)) {
    const email = piece.trim().toLowerCase()
    // Deliberately permissive: a rough shape check, not RFC 5322.
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue
    seen.add(email)
  }
  return [...seen]
}
