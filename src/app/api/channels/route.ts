import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { channels } from '@/db/schema'
import { requireUserId } from '@/lib/data'

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

  const db = getDb()
  const inserted = await db
    .insert(channels)
    .values({ slug, name: slug, description, createdBy: meId })
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
