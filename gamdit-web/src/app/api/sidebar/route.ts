import { NextRequest, NextResponse } from 'next/server'
import { serverDataService } from '@/lib/data-service/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const result = await serverDataService.preloadSidebarData()
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const games = (result.data.continuePlaying || []).map(g => ({
      id: g.id,
      name: g.name,
      cover_url: g.cover_url || ''
    }))

    const users = (result.data.whoToFollow || []).map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      avatar_url: u.avatar_url || ''
    }))

    return NextResponse.json({ games, users })
  } catch (error: any) {
    return NextResponse.json({ error: { message: error?.message || 'Unknown error' } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const viewerId = typeof body?.viewerId === 'string' ? body.viewerId : null
    if (!viewerId) return NextResponse.json({ ids: [] })
    const result = await serverDataService.getFollowingIds(viewerId)
    if (!result.success) {
      console.error('[api/sidebar:getFollowingIds]', result.error, body)
      return NextResponse.json({ ids: [] })
    }
    return NextResponse.json({ ids: result.data })
  } catch (err) {
    console.error('[api/sidebar:getFollowingIds]', err)
    return NextResponse.json({ ids: [] })
  }
}


