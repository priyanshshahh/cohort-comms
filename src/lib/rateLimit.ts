import { NextResponse } from 'next/server'
import { and, eq, lt, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { rateLimits } from '@/db/schema'

export const WINDOW_MS = 60_000

/**
 * Requests allowed per rolling minute, per user, per bucket. Documented in
 * the README; change both together.
 */
export const LIMITS = {
  /** A message every two seconds, sustained, is already a flood. */
  messages: 30,
  reactions: 60,
  /** Clients pulse this on every keystroke burst, so it runs loosest. */
  typing: 120,
  /** Uploads are the heaviest write; nobody attaches 12 images a minute. */
  upload: 12,
} as const

export type Bucket = keyof typeof LIMITS

/** Start of the fixed window containing `now`. */
export function windowStart(now: number): number {
  return now - (now % WINDOW_MS)
}

/**
 * Sliding-window approximation over two adjacent fixed windows: the previous
 * window's count is weighted by how much of it the rolling minute still
 * covers. Smooths the boundary burst a plain fixed window allows, while
 * storing one row per user + bucket + window instead of one per request.
 */
export function slidingCount(
  prevCount: number,
  currCount: number,
  elapsedInWindowMs: number
): number {
  const prevWeight = 1 - elapsedInWindowMs / WINDOW_MS
  return prevCount * prevWeight + currCount
}

/**
 * Count this request against `userId`'s budget for `bucket`. Returns a 429
 * response to send back when the caller is over the limit, or null to let
 * the write proceed.
 *
 * Fails open: if the limiter's own queries error, the write goes through.
 * A limiter bug must never be the thing that takes the app down.
 */
export async function rateLimited(
  userId: string,
  bucket: Bucket
): Promise<NextResponse | null> {
  try {
    const now = Date.now()
    const currStart = windowStart(now)
    const prevStart = currStart - WINDOW_MS
    const db = getDb()

    const [bumped] = await db
      .insert(rateLimits)
      .values({ userId, bucket, windowStart: currStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.userId, rateLimits.bucket, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count })

    // First hit of a fresh window: this key's windows before the previous one
    // can no longer influence a decision, so drop them. Keeps the table at two
    // rows per user + bucket without a scheduled job.
    if (bumped.count === 1) {
      await db
        .delete(rateLimits)
        .where(
          and(
            eq(rateLimits.userId, userId),
            eq(rateLimits.bucket, bucket),
            lt(rateLimits.windowStart, prevStart)
          )
        )
    }

    const prevRows = await db
      .select({ count: rateLimits.count })
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.userId, userId),
          eq(rateLimits.bucket, bucket),
          eq(rateLimits.windowStart, prevStart)
        )
      )

    const used = slidingCount(
      prevRows[0]?.count ?? 0,
      bumped.count,
      now - currStart
    )
    if (used <= LIMITS[bucket]) return null

    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - currStart)) / 1000))
    return NextResponse.json(
      { error: 'rate limit exceeded, slow down', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  } catch (error) {
    console.error('[rateLimit] check failed, allowing request', error)
    return null
  }
}
