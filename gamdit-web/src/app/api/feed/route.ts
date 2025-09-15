import { NextRequest, NextResponse } from 'next/server'
import { serverDataService } from '@/lib/data-service/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawViewerId = body?.viewerId
    const rawTab = body?.tab
    const rawFilter = body?.filter
    const rawCursor = body?.cursor
    const rawLimit = body?.limit

    const viewerId = typeof rawViewerId === 'string' ? rawViewerId : null
    const tab: 'following' | 'for-you' = rawTab === 'following' ? 'following' : 'for-you'
    const filter: 'all' | 'clips' | 'reviews' | 'screens' = ['all', 'clips', 'reviews', 'screens'].includes(rawFilter)
      ? rawFilter
      : 'all'
    const cursor = rawCursor && typeof rawCursor === 'object' && rawCursor.id && rawCursor.created_at
      ? { id: String(rawCursor.id), created_at: String(rawCursor.created_at) }
      : null
    const limit = typeof rawLimit === 'number' ? Math.max(1, Math.min(50, rawLimit)) : 20

    const result = await serverDataService.getFeed({ viewerId, tab, filter, cursor, limit })

    if (!result.success) {
      console.error('[api/feed]', result.error, body)
      return NextResponse.json({ items: [], nextCursor: null, hasMore: false })
    }

    return NextResponse.json({
      items: result.data.data,
      nextCursor: result.data.next_cursor ?? null,
      hasMore: !!result.data.has_more
    })
  } catch (err: any) {
    try { console.error('[api/feed]', err, await req.json().catch(() => ({}))) } catch {}
    return NextResponse.json({ items: [], nextCursor: null, hasMore: false })
  }
}


