// src/app/api/backfill-games/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const IGDB_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET!;

// ---- IGDB auth (per-instance token cache) ----
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

async function fetchVersionParent(igdbId: number): Promise<number | null> {
  const t = await getIgdbToken();
  const body = `
    fields id, name, version_parent;
    where id = ${igdbId};
    limit 1;
  `;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${t}`, Accept: 'application/json' },
    body,
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const r = rows?.[0];
  return (r && typeof r.version_parent === 'number') ? r.version_parent : null;
}

// Use correct PostgREST filters (no dotted form)
function buildGamesQuery(limit: number) {
  const qs = new URLSearchParams({
    select: 'id,igdb_id,parent_igdb_id,name,created_at',
    limit: String(Math.min(limit, 1000)),
    order: 'created_at.desc',
  });
  qs.append('igdb_id', 'not.is.null');        // ✅ igdb_id is present
  qs.append('parent_igdb_id', 'is.null');     // ✅ not already labeled
  return `${SUPA_URL}/rest/v1/games?${qs.toString()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { op, limit = 400, dryRun = false } = await req.json().catch(() => ({}));

    if (op !== 'parents') {
      return NextResponse.json({ error: 'unsupported op' }, { status: 400 });
    }

    // 1) list candidates from our DB
    const listUrl = buildGamesQuery(Number(limit));
    const listRes = await fetch(listUrl, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact' },
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      return NextResponse.json({ scanned: 0, updated: 0, error: `list failed: ${err}` }, { status: 500 });
    }
    const candidates: Array<{ id: number; igdb_id: number; name: string }> = await listRes.json();

    // 2) ask IGDB for each candidate's version_parent (if any)
    const parentByChild = new Map<number, number>(); // child igdb_id -> parent igdb_id
    for (const row of candidates) {
      const parent = await fetchVersionParent(row.igdb_id);
      if (parent && parent !== row.igdb_id) {
        parentByChild.set(row.igdb_id, parent);
      }
    }

    // 3) dry-run?
    const updatesSample = Array.from(parentByChild.entries())
      .slice(0, 5)
      .map(([child, parent]) => ({ igdb_id: child, parent_igdb_id: parent }));
    if (dryRun) {
      return NextResponse.json({
        route: 'backfill-games/v2',
        scanned: candidates.length,
        updated: parentByChild.size,
        sample: updatesSample,
      });
    }

    // 4) perform updates with PATCH per row (NO INSERTS)
    let updated = 0;
    for (const [child, parent] of parentByChild.entries()) {
      const patchUrl = `${SUPA_URL}/rest/v1/games?igdb_id=eq.${child}`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ parent_igdb_id: parent }),
      });
      if (res.ok) updated += 1;
    }

    return NextResponse.json({ scanned: candidates.length, updated });
  } catch (e: any) {
    return NextResponse.json({ scanned: 0, updated: 0, error: String(e?.message ?? e) }, { status: 500 });
  }
}