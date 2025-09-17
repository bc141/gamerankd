// src/app/api/_lib/igdb.ts

// Minimal model we need downstream
export type IgdbGame = {
  id: number;
  name: string;
  category?: number | null;        // 0 main game, 8 remake, 9 remaster, 11 port
  version_parent?: number | null;  // parent if this is a variant
  first_release_date?: number | null;
  summary?: string | null;
  cover?: { image_id: string } | null;
  alternative_names?: { name: string }[];
  genres?: { name: string }[];
  platforms?: { name: string }[];
};

type UpsertGame = {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  aliases: string[];
  summary: string | null;
};

const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;

// simple in-memory token cache (per server instance)
let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
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

/** Minimal IGDB search (no comments, no unsupported fields) */
export async function igdbSearch(q: string, limit = 10): Promise<UpsertGame[]> {
  const t = await getToken();

  // Prefer base titles: version_parent = null and category in (main/remake/remaster/port)
  const body = `
    fields id,name,category,version_parent,first_release_date,summary,
           cover.image_id,alternative_names.name,
           genres.name,platforms.name;
    search "${q.replace(/"/g, '\\"')}";
    where version_parent = null & category = (0,8,9,11);
    limit ${Math.min(limit, 25)};
  `;

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
    const txt = await res.text();
    throw new Error(`IGDB error ${res.status}: ${txt}`);
  }

  const rows = await res.json();
  return (rows ?? []).map((r: any): UpsertGame => {
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
      name: r.name,
      cover_url,
      release_year: year,
      aliases,
      summary: r.summary ?? null,
    };
  });
}

// helpers
export function mapIgdbToUpsert(g: IgdbGame) {
  const year = g.first_release_date
    ? new Date(g.first_release_date * 1000).getUTCFullYear()
    : null;

  const cover_url = g.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
    : null;

  return {
    igdb_id: g.id,
    name: g.name,
    cover_url,        // we'll conditionally include this in payload (no nulls)
    release_year: year,
    aliases: (g.alternative_names ?? []).map(a => a?.name).filter(Boolean),
    summary: g.summary ?? null,
    // optional: store light facets for future
    // genres: (g.genres ?? []).map(x => x?.name).filter(Boolean),
    // platforms: (g.platforms ?? []).map(x => x?.name).filter(Boolean),
  };
}