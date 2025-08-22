// src/app/api/backfill-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { igdbSearch } from '../_lib/igdb';

export const maxDuration = 60; // Vercel: give it some time

export async function POST(req: NextRequest) {
  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SB = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 1) fetch candidates (tune where clause as you like)
  const pick = await fetch(
    `${SB_URL}/rest/v1/games?select=id,igdb_id,name,summary,cover_url&or=(summary.is.null,cover_url.is.null)&limit=200`,
    { headers: { apikey: SB, Authorization: `Bearer ${SB}` } }
  );
  const rows: any[] = await pick.json();
  if (!rows?.length) return NextResponse.json({ updated: 0 });

  // 2) refetch from IGDB by name (you could also build a by-id fetch)
  const upserts: any[] = [];
  for (const r of rows) {
    try {
      const [best] = await igdbSearch(r.name, 1);
      if (!best) continue;

      // only include fields we WANT to update & only if non-null
      const out: any = { igdb_id: best.igdb_id, name: best.name };
      if (!r.cover_url && best.cover_url) out.cover_url = best.cover_url;
      if (!r.summary && best.summary) out.summary = best.summary;
      if (best.release_year != null) out.release_year = best.release_year;
      if (best.aliases?.length) out.aliases = best.aliases;
      upserts.push(out);
      await new Promise(r => setTimeout(r, 150)); // gentle throttle
    } catch {}
  }

  if (!upserts.length) return NextResponse.json({ updated: 0 });

  const res = await fetch(`${SB_URL}/rest/v1/games?on_conflict=igdb_id`, {
    method: 'POST',
    headers: {
      apikey: SB,
      Authorization: `Bearer ${SB}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(upserts),
  });

  if (!res.ok) {
    return NextResponse.json({ updated: 0, error: await res.text() }, { status: 500 });
  }

  return NextResponse.json({ updated: upserts.length });
}
