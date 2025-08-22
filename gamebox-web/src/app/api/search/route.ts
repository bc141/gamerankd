// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type UpsertGame = {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  popularity: number | null;
  aliases: string[];
};

const IGDB_ID = process.env.IGDB_CLIENT_ID;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET;
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

// in-memory token cache per lambda instance
let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (!IGDB_ID || !IGDB_SECRET) {
    throw new Error('Missing IGDB_CLIENT_ID / IGDB_CLIENT_SECRET');
  }
  const now = Date.now();
  if (token && token.exp > now + 60_000) return token.value;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: IGDB_ID,
      client_secret: IGDB_SECRET,
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(`IGDB token error ${res.status}: ${JSON.stringify(json)}`);
  }
  token = { value: json.access_token, exp: now + (json.expires_in ?? 0) * 1000 };
  return token.value;
}

async function igdbSearch(q: string, limit = 10): Promise<UpsertGame[]> {
  const t = await getToken();
  const body = `
fields id, name, alternative_names.name, cover.image_id, first_release_date, popularity;
search "${q.replace(/"/g, '\\"')}";
where version_parent = null;
limit ${Math.min(limit, 25)};
`;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID!, Authorization: `Bearer ${t}`, Accept: 'application/json' },
    body,
    cache: 'no-store',
  });
  const rows = await res.json();
  if (!res.ok || !Array.isArray(rows)) {
    throw new Error(`IGDB search error ${res.status}: ${JSON.stringify(rows)}`);
  }

  return rows.map((r: any) => {
    const year = r.first_release_date ? new Date(r.first_release_date * 1000).getUTCFullYear() : null;
    const cover_url = r?.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${r.cover.image_id}.jpg`
      : null;
    const aliases = (r.alternative_names ?? []).map((a: any) => a.name).filter(Boolean);
    return {
      igdb_id: r.id,
      name: r.name,
      cover_url,
      release_year: year,
      popularity: r.popularity ?? null,
      aliases,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
    if (!q) return NextResponse.json({ items: [] });

    const items = await igdbSearch(q, limit);

    if (!SUPA_URL || !SUPA_SVC) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }

    // don’t overwrite existing covers with null
    const upserts = items.map((g) => {
      const row: any = {
        igdb_id: g.igdb_id,
        name: g.name,
        release_year: g.release_year,
        popularity: g.popularity,
        aliases: g.aliases,
      };
      if (g.cover_url) row.cover_url = g.cover_url;
      return row;
    });

    const up = await fetch(`${SUPA_URL}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: {
        apikey: SUPA_SVC,
        Authorization: `Bearer ${SUPA_SVC}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(upserts),
      cache: 'no-store',
    });
    const txt = await up.text();
    if (!up.ok) {
      throw new Error(`Supabase upsert error ${up.status}: ${txt}`);
    }

    return NextResponse.json({ items: upserts });
  } catch (err: any) {
    console.error('[api/search] error', err);
    return NextResponse.json({ items: [], error: String(err?.message ?? err) }, { status: 500 });
  }
}