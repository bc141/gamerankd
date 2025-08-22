// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { igdbSearch, mapIgdbToUpsert } from '../_lib/igdb';

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
    if (!q) return NextResponse.json({ items: [] });

    const items = await igdbSearch(q, limit);

    // Strip nulls so we never send null -> overwrite
    const payload = items.map((r) => {
      const out: any = {
        igdb_id: r.igdb_id,
        name: r.name,
        release_year: r.release_year ?? undefined,
        aliases: r.aliases ?? undefined,
      };
      if (r.cover_url) out.cover_url = r.cover_url;
      if (r.summary) out.summary = r.summary;
      return out;
    });

    // Upsert via PostgREST
    const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SB = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${SB_URL}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: {
        apikey: SB,
        Authorization: `Bearer ${SB}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ items: [], error: err }, { status: 500 });
    }

    // After upserting, fetch the results with parent_igdb_id for collapsing
    const fetchRes = await fetch(
      `${SB_URL}/rest/v1/games?select=igdb_id,parent_igdb_id,name,cover_url,release_year,summary,aliases&or=(igdb_id.eq.${payload.map(p => p.igdb_id).join(',igdb_id.eq.')})`,
      { headers: { apikey: SB, Authorization: `Bearer ${SB}` } }
    );

    if (!fetchRes.ok) {
      // If we can't fetch with parent info, return the original payload
      return NextResponse.json({ items: payload });
    }

    const rows = await fetchRes.json() as Array<{ 
      igdb_id: number; 
      parent_igdb_id: number | null; 
      name: string; 
      cover_url: string | null; 
      release_year: number | null;
      summary: string | null;
      aliases: string[] | null;
    }>;

    // Collapse editions by canonical key
    const canonical = (r: typeof rows[0]) => r.parent_igdb_id ?? r.igdb_id;
    const score = (r: typeof rows[0]) => (r.parent_igdb_id ? 0 : 1000) + (r.cover_url ? 100 : 0) - (r.release_year ?? 9999);

    const byKey = new Map<number, typeof rows[0]>();
    for (const r of rows) {
      const k = canonical(r);
      const prev = byKey.get(k);
      if (!prev || score(r) > score(prev)) byKey.set(k, r);
    }

    const collapsed = Array.from(byKey.values()).slice(0, limit);

    return NextResponse.json({ items: collapsed });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}