import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireUserId } from '@/lib/data'
import { attachmentStorageMode } from '@/lib/policy'

export const runtime = 'nodejs'

const MAX_BYTES = 900_000

/**
 * POST /api/upload — image attachment for chat.
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Without it, the data-URL
 * fallback (stored on the message row) serves local development only; in
 * production the route refuses instead, so the database never absorbs
 * attachment bytes (issue #20).
 */
export async function POST(request: NextRequest) {
  try {
    await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mode = attachmentStorageMode(
    Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    process.env.NODE_ENV
  )
  if (mode === 'disabled') {
    return NextResponse.json(
      { error: 'attachments are disabled: file storage is not configured' },
      { status: 503 }
    )
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'images only' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'image too large (max ~900KB)' },
      { status: 400 }
    )
  }

  if (mode === 'blob') {
    const blob = await put(`comms/${Date.now()}-${file.name}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return NextResponse.json({ url: blob.url })
  }

  // Development-only fallback: mode === 'data-url'.
  const buffer = Buffer.from(await file.arrayBuffer())
  const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
  if (dataUrl.length > 1_200_000) {
    return NextResponse.json(
      { error: 'image too large after encoding' },
      { status: 400 }
    )
  }
  return NextResponse.json({ url: dataUrl })
}
