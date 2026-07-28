import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { channels } from '@/db/schema'
import {
  ForbiddenError,
  isCohortMember,
  requireAdminId,
  requireUserId,
} from '@/lib/data'

/** Lowercase, hyphenated, no leading/trailing separators. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

/** POST /api/channels — any member can open a channel. */
export async function POST(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
  const description =
    typeof payload?.description === 'string' ? payload.description.trim() : null

  const slug = slugify(name)
  if (!slug) {
    return NextResponse.json({ error: 'invalid channel name' }, { status: 400 })
  }

  /**
   * An admitted member opens a channel for the cohort. Someone still pending
   * opens one in their own space, which is what lets them use the app straight
   * after signing up without touching the cohort's channels.
   *
   * Personal slugs are namespaced so two people can both have "#notes" without
   * colliding on the unique slug.
   */
  const cohortMember = await isCohortMember()
  const ownerId = cohortMember ? null : meId
  const finalSlug = cohortMember ? slug : `u-${meId}-${slug}`.slice(0, 64)

  const db = getDb()
  const inserted = await db
    .insert(channels)
    .values({
      slug: finalSlug,
      name: slug,
      description,
      ownerId,
      createdBy: meId,
    })
    .onConflictDoNothing()
    .returning()

  if (inserted.length === 0) {
    return NextResponse.json(
      { error: 'a channel with that name already exists', slug },
      { status: 409 }
    )
  }

  return NextResponse.json({ channel: inserted[0] }, { status: 201 })
}

/**
 * PATCH /api/channels — rename or archive a channel. Admins only.
 *
 * The schema has carried an `archived` column and the sidebar has filtered on
 * it since the beginning, but nothing ever set it, so channel management was
 * create-only. Reported by @gge513 (#5).
 *
 * Rename deliberately leaves `slug` alone. The slug is the permalink and the
 * key in the `reads` table, so rewriting it would break every bookmark and
 * silently reset everyone's unread cursor for that channel.
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdminId()
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : ''
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  const updates: Partial<typeof channels.$inferInsert> = {}

  if (typeof payload?.name === 'string') {
    const name = payload.name.trim().slice(0, 64)
    if (!name) {
      return NextResponse.json(
        { error: 'invalid channel name' },
        { status: 400 }
      )
    }
    updates.name = name
  }

  if (typeof payload?.description === 'string') {
    updates.description = payload.description.trim().slice(0, 280) || null
  }

  if (typeof payload?.archived === 'boolean') {
    updates.archived = payload.archived
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const db = getDb()

  // Default channels are the cohort's shared spine. Renaming one is fine;
  // archiving #general out from under everybody is not.
  if (updates.archived === true) {
    const [target] = await db
      .select({ isDefault: channels.isDefault })
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1)
    if (target?.isDefault) {
      return NextResponse.json(
        { error: 'default channels cannot be archived' },
        { status: 400 }
      )
    }
  }

  const [updated] = await db
    .update(channels)
    .set(updates)
    .where(eq(channels.slug, slug))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'channel not found' }, { status: 404 })
  }

  return NextResponse.json({ channel: updated })
}
