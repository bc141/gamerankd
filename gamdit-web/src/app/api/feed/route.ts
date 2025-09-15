import { NextRequest, NextResponse } from 'next/server'
import { serverDataService } from '@/lib/data-service/server'

const ALLOWED_TABS = ['following', 'for-you'] as const
export type Tab = typeof ALLOWED_TABS[number]

const ALLOWED_FILTERS = ['all', 'clips', 'reviews', 'screens'] as const
export type FeedFilter = typeof ALLOWED_FILTERS[number]

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawViewerId = body?.viewerId
    const rawTab = body?.tab
    const rawFilter = body?.filter
    const rawCursor = body?.cursor
    const rawLimit = body?.limit

    const viewerId = typeof rawViewerId === 'string' && rawViewerId.trim() ? rawViewerId : null

    const tab: Tab = (ALLOWED_TABS as readonly string[]).includes(String(rawTab))
      ? (rawTab as Tab)
      : 'for-you'

    const filter: FeedFilter = (ALLOWED_FILTERS as readonly string[]).includes(String(rawFilter))
      ? (rawFilter as FeedFilter)
      : 'all'

    let cursor: { id: string; created_at: string } | null = null
    if (
      rawCursor &&
      typeof rawCursor === 'object' &&
      'id' in (rawCursor as Record<string, unknown>) &&
      'created_at' in (rawCursor as Record<string, unknown>)
    ) {
      cursor = {
        id: String((rawCursor as any).id),
        created_at: String((rawCursor as any).created_at),
      }
    }

    const limit = typeof rawLimit === 'number' ? Math.max(1, Math.min(50, rawLimit)) : 20

    const result = await serverDataService.getFeed({ viewerId, tab, filter, cursor, limit })

    if (!result.success) {
      console.error('[api/feed]', result.error, body)
      return NextResponse.json({ items: [], nextCursor: null, hasMore: false })
    }

    const payload: any = result?.data ?? {}
    return NextResponse.json({
      items: payload.items ?? payload.data ?? [],
      nextCursor: payload.nextCursor ?? payload.next_cursor ?? null,
      hasMore: typeof payload.hasMore === 'boolean' ? payload.hasMore : !!payload.has_more,
    })
  } catch (err: any) {
    try { console.error('[api/feed]', err, await req.json().catch(() => ({}))) } catch {}
    return NextResponse.json({ items: [], nextCursor: null, hasMore: false })
  }
}


