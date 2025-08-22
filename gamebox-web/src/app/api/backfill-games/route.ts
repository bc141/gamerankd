import { NextRequest, NextResponse } from 'next/server';

// --- IGDB helpers (reuse your existing lib if paths differ) ---
const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;

let token: { value: string; exp: number } | null = null;
async function getIGDBToken() {
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

async function fetchVersionParents(igdbIds: number[]): Promise<Map<number, number | null>> {
  if (igdbIds.length === 0) return new Map();
  const t = await getIGDBToken();
  const body = `fields id, version_parent; where id = (${igdbIds.join(',')}); limit ${igdbIds.length};`;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${t}`, Accept: 'application/json' },
    body
  });
  const rows = (await res.json()) as Array<{ id: number; version_parent?: number | null }>;
  const map = new Map<number, number | null>();
  for (const r of rows) map.set(r.id, r.version_parent ?? null);
  return map;
}

// --- Supabase (PostgREST) ---
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type GameRow = { igdb_id: number; name: string | null; parent_igdb_id?: number | null; created_at?: string };

export async function POST(req: NextRequest) {
  try {
    const { op = 'parents', limit = 200, dryRun = false } = await req.json().catch(() => ({}));
    if (op !== 'parents') {
      return NextResponse.json({ error: `unsupported op: ${String(op)}` }, { status: 400 });
    }

    // 1) Pull candidates that don't yet have parent_igdb_id (newest first)
    const listUrl = new URL(`${SB_URL}/rest/v1/games`);
    listUrl.searchParams.set('select', 'igdb_id,name,created_at,parent_igdb_id');
    listUrl.searchParams.set('not', 'igdb_id.is.null');          // igdb_id not null
    listUrl.searchParams.append('is', 'parent_igdb_id.null');    // parent_igdb_id is null
    listUrl.searchParams.set('order', 'created_at.desc');
    listUrl.searchParams.set('limit', String(limit));

    const listRes = await fetch(listUrl, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    if (!listRes.ok) {
      return NextResponse.json(
        { updated: 0, scanned: 0, error: `games list failed: ${await listRes.text()}` },
        { status: 500 }
      );
    }
    const list = (await listRes.json()) as GameRow[];
    const ids = list.map((g) => g.igdb_id).filter((n): n is number => typeof n === 'number');
    if (ids.length === 0) return NextResponse.json({ updated: 0, scanned: 0 });

    // 2) Ask IGDB which of these are editions (version_parent present)
    const parentMap = await fetchVersionParents(ids);

    // 3) Build a UNIFORM payload: every object has the same keys
    //    (This avoids PGRST102.)
    const updates = ids
      .map((id) => ({ igdb_id: id, parent_igdb_id: parentMap.get(id) ?? null }))
      // optional: only actually update rows that have a real parent
      .filter((r) => r.parent_igdb_id !== null);

    if (dryRun) {
      return NextResponse.json({
        scanned: ids.length,
        willUpdate: updates.length,
        preview: updates.slice(0, 10),
      });
    }

    if (updates.length === 0) {
      return NextResponse.json({ updated: 0, scanned: ids.length });
    }

    // 4) Upsert uniformly shaped objects
    const upsertRes = await fetch(`${SB_URL}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(updates),
    });

    if (!upsertRes.ok) {
      return NextResponse.json(
        { updated: 0, scanned: ids.length, error: await upsertRes.text() },
        { status: 500 }
      );
    }

    return NextResponse.json({ updated: updates.length, scanned: ids.length });
  } catch (e: any) {
    return NextResponse.json({ updated: 0, error: String(e?.message ?? e) }, { status: 500 });
  }
}