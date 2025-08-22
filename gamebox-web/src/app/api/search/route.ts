// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

type UpsertGame = {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  aliases: string[];
};

const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let token: { value: string; exp: number } | null = null;
async function getToken() {
  const now = Date.now();
  if (token && token.exp > now + 60_000) return token.value;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const json = await res.json();
  token = { value: json.access_token, exp: now + json.expires_in * 1000 };
  return token.value;
}

async function igdbSearch(q: string, limit = 10): Promise<UpsertGame[]> {
  const t = await getToken();

  // NOTE: no comments inside this string; IGDB will error on them.
  const body = [
    'fields id, name, alternative_names.name, cover.image_id, first_release_date;',
    `search "${q.replace(/"/g, '\\"')}";`,
    'where version_parent = null;', // prefer base titles
    `limit ${Math.min(limit, 25)};`,
  ].join('\n');

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': IGDB_ID,
      Authorization: `Bearer ${t}`,
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IGDB search error ${res.status}: ${err}`);
  }

  const rows = await res.json();
  return rows.map((r: any): UpsertGame => {
    const year = r.first_release_date
      ? new Date(r.first_release_date * 1000).getUTCFullYear()
      : null;
    const cover_url = r.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${r.cover.image_id}.jpg`
      : null;
    const aliases = (r.alternative_names ?? [])
      .map((a: any) => a?.name)
      .filter(Boolean);

    return {
      igdb_id: r.id,
      name: r.name ?? '',
      cover_url,
      release_year: year,
      aliases,
    };
  });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
  if (!q) return NextResponse.json({ items: [] });

  try {
    const items = await igdbSearch(q, limit);
    if (!items.length) return NextResponse.json({ items: [] });

    // Upsert into PostgREST (no popularity field)
    const res = await fetch(`${SB_URL}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(items),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ items: [], error: err }, { status: 500 });
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}