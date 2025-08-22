import { NextRequest, NextResponse } from 'next/server';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;

let token: { value: string; exp: number } | null = null;
async function getIgdbToken(): Promise<string> {
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

async function fetchSummaries(ids: number[]): Promise<Record<number, string>> {
  if (ids.length === 0) return {};
  const t = await getIgdbToken();
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const out: Record<number, string> = {};
  for (const c of chunks) {
    const body = `fields id, summary; where id = (${c.join(',')}); limit ${c.length};`;
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${t}`, Accept: 'application/json' },
      body,
    });
    if (!res.ok) continue;
    const rows = await res.json();
    for (const r of rows ?? []) {
      if (r?.summary) out[r.id] = r.summary;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { limit = 200, dryRun = false } = await req.json().catch(() => ({}));

    // pull base games (hide editions) with NULL summary and known igdb_id
    const qs = new URLSearchParams({
      select: 'id,igdb_id,name,summary',
      limit: String(Math.min(limit, 1000)),
      order: 'created_at.desc',
    });
    qs.append('summary', 'is.null');
    qs.append('parent_igdb_id', 'is.null');
    qs.append('igdb_id', 'not.is.null');

    const listRes = await fetch(`${SUPA_URL}/rest/v1/games?${qs}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      return NextResponse.json({ scanned: 0, updated: 0, error: `list failed: ${err}` }, { status: 500 });
    }
    const rows: Array<{ id: number; igdb_id: number; name: string | null }> = await listRes.json();
    const igdbIds = rows.map(r => r.igdb_id).filter((x): x is number => typeof x === 'number');

    const map = await fetchSummaries(igdbIds);

    if (dryRun) {
      return NextResponse.json({
        scanned: rows.length,
        willUpdate: Object.keys(map).length,
        sample: Object.entries(map).slice(0, 5).map(([k, v]) => ({ igdb_id: Number(k), summary: String(v).slice(0, 80) + '…' })),
      });
    }

    let updated = 0;
    for (const r of rows) {
      const s = map[r.igdb_id];
      if (!s) continue;
      const res = await fetch(`${SUPA_URL}/rest/v1/games?igdb_id=eq.${r.igdb_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ summary: s }),
      });
      if (res.ok) updated += 1;
    }

    return NextResponse.json({ scanned: rows.length, updated });
  } catch (e: any) {
    return NextResponse.json({ scanned: 0, updated: 0, error: String(e?.message ?? e) }, { status: 500 });
  }
}