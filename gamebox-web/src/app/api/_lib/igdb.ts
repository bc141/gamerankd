// src/app/api/_lib/igdb.ts
type UpsertGame = {
    igdb_id: number;
    name: string;
    cover_url: string | null;
    release_year: number | null;
    aliases: string[];
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
  
    // IMPORTANT: IGDB query language does not support // comments
    const body = `
      fields id, name, alternative_names.name, cover.image_id, first_release_date;
      search "${q.replace(/"/g, '\\"')}";
      where version_parent = null;
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
      };
    });
  }