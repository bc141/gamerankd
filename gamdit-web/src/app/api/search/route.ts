// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' as const };

  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const scope = (req.nextUrl.searchParams.get('scope') ?? 'games').toLowerCase(); // default for b/c
    const limit = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10')));

    // Empty query: preserve old shapes
    if (!q) {
      if (scope === 'all') return NextResponse.json({ games: [], users: [], meta: { route: 'v2' } }, { headers });
      return NextResponse.json({ items: [], meta: { route: 'v2' } }, { headers });
    }

    const sb = createClient(SB_URL, SB_SERVICE);

    const wantGames = scope === 'all' || scope === 'games';
    const wantUsers = scope === 'all' || scope === 'users';

    let games: any[] = [];
    let users: any[] = [];

    const tasks: Promise<void>[] = [];

    if (wantGames) {
      tasks.push(
        (async () => {
          const { data, error } = await sb.rpc('game_search_v2', { q, lim: limit });
          if (error) throw new Error(`game_search_v2: ${error.message}`);
          games = data ?? [];
        })()
      );
    }

    if (wantUsers) {
      // simple ilike search; add trigram ordering later if desired
      const like = q.replace(/([%_\\])/g, '\\$1');
      tasks.push(
        (async () => {
          const { data, error } = await sb
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .or(`username.ilike.%${like}%,display_name.ilike.%${like}%`)
            .limit(limit);
          if (error) throw new Error(`profiles search: ${error.message}`);
          users = data ?? [];
        })()
      );
    }

    await Promise.all(tasks);

    if (scope === 'all') {
      return NextResponse.json({ games, users, meta: { route: 'v2' } }, { headers });
    }
    // keep legacy shape
    return NextResponse.json({ items: scope === 'games' ? games : users, meta: { route: 'v2' } }, { headers });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: String(e?.message ?? e), meta: { route: 'v2' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}