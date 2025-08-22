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

    return NextResponse.json({ items: payload });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}