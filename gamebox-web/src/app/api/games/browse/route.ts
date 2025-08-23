// src/app/api/games/browse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

type GameRow = {
  id: number;
  igdb_id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  parent_igdb_id: number | null;
  preview?: string | null;
};

function pick<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, n));
}

export async function GET(req: NextRequest) {
  const sb = createClient(SB_URL, SB_SERVICE);
  const headers = { 'Cache-Control': 'no-store' };

  const url = new URL(req.url);
  const sections = (url.searchParams.get('sections') ?? 'trending,new,top').split(',').map(s => s.trim());
  const limit = Math.min(30, Math.max(4, Number(url.searchParams.get('limit') ?? '12')));
  const sinceDays = Math.min(30, Math.max(7, Number(url.searchParams.get('sinceDays') ?? '14'))); // for trending window

  // helper to load canonical games by ids in the same order
  const loadGamesByIds = async (ids: number[]) => {
    if (!ids.length) return [] as GameRow[];
    const { data, error } = await sb
      .from('games')
      .select('id,igdb_id,name,cover_url,release_year,parent_igdb_id,preview')
      .in('id', ids)
      .is('parent_igdb_id', null);
    if (error) throw new Error(error.message);
    // keep original order
    const map = new Map((data ?? []).map(g => [g.id, g]));
    return ids.map(id => map.get(id)).filter(Boolean) as GameRow[];
  };

  // -------- Sections --------
  const out: Record<string, GameRow[]> = {};

  // TRENDING: most reviews in the last N days (velocity proxy)
  if (sections.includes('trending')) {
    const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
    // pull a window of review rows and tally in memory (keeps SQL simple)
    const { data: recent, error } = await sb
      .from('reviews')
      .select('game_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(4000);
    if (error) throw new Error(error.message);

    const counts = new Map<number, number>();
    (recent ?? []).forEach(r => counts.set(r.game_id, (counts.get(r.game_id) ?? 0) + 1));

    const rankedIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    out.trending = await loadGamesByIds(pick(rankedIds, limit));
  }

  // NEW: newest release_year (edition-safe)
  if (sections.includes('new')) {
    const { data, error } = await sb
      .from('games')
      .select('id,igdb_id,name,cover_url,release_year,parent_igdb_id,preview')
      .is('parent_igdb_id', null)
      .not('release_year', 'is', null)
      .order('release_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    out.new = data ?? [];
  }

  // TOP: highest average rating over last 90d with ≥ 5 reviews
  if (sections.includes('top')) {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data: rows, error } = await sb
      .from('reviews')
      .select('game_id, rating, created_at')
      .gte('created_at', since)
      .limit(8000);
    if (error) throw new Error(error.message);

    const agg = new Map<number, { sum: number; n: number }>();
    (rows ?? []).forEach(r => {
      const a = agg.get(r.game_id) ?? { sum: 0, n: 0 };
      agg.set(r.game_id, { sum: a.sum + (r.rating ?? 0), n: a.n + 1 });
    });

    const rankedIds = [...agg.entries()]
      .filter(([, v]) => v.n >= 5)
      .sort((a, b) => (b[1].sum / b[1].n) - (a[1].sum / a[1].n))
      .map(([id]) => id);

    out.top = await loadGamesByIds(pick(rankedIds, limit));
  }

  return NextResponse.json({ sections: out }, { headers });
}