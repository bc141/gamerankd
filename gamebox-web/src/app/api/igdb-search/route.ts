// src/app/api/igdb-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

type UpsertGame = {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  popularity: number | null;
  aliases: string[];
};

const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;

// simple in-memory token cache (per server instance)
let token: { value: string; exp: number } | null = null;

async function getToken() {
  const now = Date.now();
  if (token && token.exp > now + 60_000) return token.value;
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${IGDB_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`, { method: 'POST' });
  const json = await res.json();
  token = { value: json.access_token, exp: now + (json.expires_in * 1000) };
  return token.value;
}

// Minimal IGDB search (name + cover + release year + alt names)
async function igdbSearch(q: string, limit = 10): Promise<UpsertGame[]> {
  const t = await getToken();
  const body = `
    fields id, name, alternative_names.name, cover.image_id, first_release_date, popularity;
    search "${q.replace(/"/g, '\\"')}";
    where version_parent = null;  // prefer base titles
    limit ${Math.min(limit, 25)};
  `;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${t}`, 'Accept': 'application/json' },
    body
  });
  const rows = await res.json();
  return rows.map((r: any) => {
    const year = r.first_release_date ? new Date(r.first_release_date * 1000).getUTCFullYear() : null;
    const cover_url = r.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${r.cover.image_id}.jpg`
      : null;
    const aliases = (r.alternative_names ?? []).map((a: any) => a.name).filter(Boolean);
    return {
      igdb_id: r.id,
      name: r.name,
      cover_url,
      release_year: year,
      popularity: r.popularity ?? null,
      aliases
    };
  });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
  if (!q) return NextResponse.json({ items: [] });

  // Upsert into Postgres using PostgREST (service key NOT required if RLS allows insert,
  // otherwise create a small Edge function / server client with service key).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // safer for server-side upsert
  const items = await igdbSearch(q, limit);

  if (!items.length) return NextResponse.json({ items: [] });

  // Upsert games (keep existing cover if we already have one)
  const upserts = items.map((g: UpsertGame) => {
    const row: any = {
      igdb_id: g.igdb_id,
      name: g.name,
      release_year: g.release_year,
      popularity: g.popularity,
      aliases: g.aliases,
    };
    if (g.cover_url) row.cover_url = g.cover_url; // don't clobber existing cover with null
    return row;
  });

  const res = await fetch(`${url}/rest/v1/games?on_conflict=igdb_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(upserts),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ items: [], error: err }, { status: 500 });
  }

  return NextResponse.json({ items: upserts });
}