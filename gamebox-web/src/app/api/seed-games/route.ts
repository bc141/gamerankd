// src/app/api/seed-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { igdbSearch } from '@/app/api/_lib/igdb'; // or use a relative path: '../../_lib/igdb'

export async function POST(req: NextRequest) {
  const KEY = process.env.SEED_SECRET;
  if (KEY && req.headers.get('x-seed-secret') !== KEY) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const { names = [] } = await req.json(); // e.g. ["Half-Life 2","Hades","Aquaria"]
    const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SB     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const upserts: any[] = [];

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ added: 0 });
    }

    for (const name of names) {
      const items = await igdbSearch(String(name), 3); // small fanout
      // pick best (prefer has cover, then earliest release year)
      const best = items
        .slice()
        .sort((a, b) => {
          const coverBoost = (x: { cover_url: string | null }) => (x.cover_url ? 1 : 0);
          const aScore = coverBoost(a);
          const bScore = coverBoost(b);
          if (bScore !== aScore) return bScore - aScore;
          const aYear = a.release_year ?? 9999;
          const bYear = b.release_year ?? 9999;
          return aYear - bYear;
        })[0];

      if (best) upserts.push(best);

      // gentle throttle to be nice to IGDB
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (upserts.length === 0) {
      return NextResponse.json({ added: 0 });
    }

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
      const err = await res.text();
      return NextResponse.json({ added: 0, ok: false, error: err }, { status: 500 });
    }

    return NextResponse.json({ added: upserts.length, ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { added: 0, ok: false, error: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}