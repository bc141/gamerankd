import { NextRequest, NextResponse } from 'next/server'
import { serverDataService } from '@/lib/data-service/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { viewerId, tab, filter, cursor, limit } = body || {}

    const result = await serverDataService.getFeed({
      viewerId,
      tab: tab === 'following' ? 'following' : 'for-you',
      filter: ['all', 'clips', 'reviews', 'screens'].includes(filter) ? filter : 'all',
      cursor: cursor || null,
      limit: typeof limit === 'number' ? Math.max(1, Math.min(50, limit)) : 20
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      items: result.data.data,
      nextCursor: result.data.next_cursor,
      hasMore: result.data.has_more
    })
  } catch (error: any) {
    return NextResponse.json({ error: { message: error?.message || 'Unknown error' } }, { status: 500 })
  }
}


