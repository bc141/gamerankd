// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
    let limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
    if (!q) return NextResponse.json({ items: [] });

    // clamp limit to something sensible
    limit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 10;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try v2 first (editions-collapsed); fall back if not deployed yet
    let { data, error } = await supabase.rpc('game_search_v2', { q, lim: limit });
    if (error && /function .* does not exist/i.test(error.message)) {
      const fallback = await supabase.rpc('game_search', { q, lim: limit });
      data = fallback.data;
      error = fallback.error ?? null;
    }

    if (error) {
      return NextResponse.json({ items: [], error: error.message }, { status: 500 });
    }

    // Optional: normalize output keys if your UI expects a strict shape
    // const items = (data ?? []).map(g => ({
    //   id: g.id, igdb_id: g.igdb_id, name: g.name,
    //   cover_url: g.cover_url, release_year: g.release_year
    // }));

    return NextResponse.json({ items: data ?? [] }, {
      // tiny cache to smooth bursts from typeahead, safe to remove if unwanted
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' }
    });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}