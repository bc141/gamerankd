// src/app/api/backfill-games/route.ts
import { NextRequest, NextResponse } from 'next/server';

const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --- IGDB token cache ---
let _tok: { v: string; exp: number } | null = null;
async function igdbToken() {
  const now = Date.now();
  if (_tok && _tok.exp > now + 60_000) return _tok.v;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const j = await res.json();
  _tok = { v: j.access_token, exp: now + j.expires_in * 1000 };
  return _tok.v;
}

async function fetchParents(igdbIds: number[]): Promise<Map<number, number | null>> {
  if (!igdbIds.length) return new Map();
  const t = await igdbToken();
  const body = `fields id, version_parent; where id = (${igdbIds.join(',')}); limit ${igdbIds.length};`;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${t}`, Accept: 'application/json' },
    body
  });
  const rows = (await res.json()) as Array<{ id: number; version_parent?: number | null }>;
  const m = new Map<number, number | null>();
  for (const r of rows) m.set(r.id, r.version_parent ?? null);
  return m;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op ?? 'parents';
    const limit = Number(body.limit ?? 200);
    const dryRun = Boolean(body.dryRun);

    if (op !== 'parents') {
      return NextResponse.json({ error: `unsupported op: ${String(op)}` }, { status: 400 });
    }

    // Pull newest games that have igdb_id and no parent_igdb_id
    // build PostgREST query correctly
    const qs = new URLSearchParams({
      select: 'id,igdb_id,parent_igdb_id,name,release_year,cover_url,created_at',
      limit: String(Math.min(Number(limit ?? 400), 1000)),
      order: 'created_at.desc',
    });

    // Only rows that actually have an IGDB id…
    qs.append('igdb_id', 'not.is.null');      // ✅ correct negation
    // …and haven't been assigned a parent yet
    qs.append('parent_igdb_id', 'is.null');   // ✅ correct is-null

    const restUrl = `${SB_URL}/rest/v1/games?${qs.toString()}`;

    const headers = {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      Prefer: 'count=exact',
    };

    const listRes = await fetch(restUrl, { headers });
    if (!listRes.ok) {
      const errText = await listRes.text();
      return NextResponse.json({ scanned: 0, updated: 0, error: `list failed: ${errText}` }, { status: 500 });
    }
    const candidates: Array<{ id:number; igdb_id:number; parent_igdb_id:number|null; name:string }> = await listRes.json();
    
    if (candidates.length === 0) return NextResponse.json({ updated: 0, scanned: 0 });

    const ids = candidates.map((g) => g.igdb_id).filter((n): n is number => typeof n === 'number');
    if (ids.length === 0) return NextResponse.json({ updated: 0, scanned: 0 });

    const parents = await fetchParents(ids);

    // UNIFORM array: every object has BOTH keys (even if null)
    const uniform = ids.map((id) => ({
      igdb_id: id,
      parent_igdb_id: parents.get(id) ?? null,
    }));

    // If you only want to write when there's an actual parent:
    const updates = uniform.filter((u) => u.parent_igdb_id !== null);

    if (dryRun) {
      return NextResponse.json({
        route: 'backfill-games/v2',
        scanned: candidates.length,
        updated: Object.values(parents).filter(v => v != null).length,
        sample: updates.slice(0, 5),
      });
    }

    if (!updates.length) return NextResponse.json({ scanned: candidates.length, updated: 0 });

    const upsertRes = await fetch(`${SB_URL}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(updates), // <-- every object has the SAME keys
    });

    if (!upsertRes.ok) {
      return NextResponse.json(
        { scanned: candidates.length, updated: 0, error: await upsertRes.text() },
        { status: 500 }
      );
    }

    return NextResponse.json({ scanned: candidates.length, updated: updates.length });
  } catch (e: any) {
    return NextResponse.json({ scanned: 0, updated: 0, error: String(e?.message ?? e) }, { status: 500 });
  }
}