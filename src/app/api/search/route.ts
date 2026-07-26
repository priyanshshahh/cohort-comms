import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, searchMessages } from '@/lib/data'

/** GET /api/search?q=deploy — keyword search across channels and own DMs. */
export async function GET(request: NextRequest) {
  let meId: string
  try {
    meId = await requireUserId()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  return NextResponse.json({ results: await searchMessages(meId, query) })
}
