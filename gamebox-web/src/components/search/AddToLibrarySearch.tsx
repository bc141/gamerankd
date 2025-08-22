'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';
import StatusMenu from '@/components/StatusMenu';
import { type LibraryStatus } from '@/lib/library';
import Link from 'next/link';

type Row = { id: number; name: string; cover_url: string | null; release_year: number | null };

export default function AddToLibrarySearch({ ownerId }: { ownerId: string }) {
  const supabase = supabaseBrowser();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  // debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim();
      if (!query) { setRows([]); return; }
      setLoading(true);

      // 1) local
      let { data: local } = await supabase.rpc('game_search', { q: query, lim: 12 });
      local = local ?? [];

      // 2) fallback hydrate (server) if thin
      if (local.length < 5) {
        await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`).then(() => null).catch(() => null);
        // re-run local (should pick up new rows)
        const { data: again } = await supabase.rpc('game_search', { q: query, lim: 12 });
        local = again ?? local;
      }

      setRows(local.map((r: any) => ({
        id: Number(r.id),
        name: String(r.name),
        cover_url: r.cover_url ?? null,
        release_year: r.release_year ?? null,
      })));
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q, supabase]);

  async function upsertStatus(game_id: number, status: LibraryStatus) {
    await supabase.from('user_game_library').upsert(
      { user_id: ownerId, game_id, status, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,game_id' }
    );
  }

  async function upsertRating(game_id: number, value0to5: number) {
    const rating = Math.round(value0to5 * 20);
    await supabase.from('reviews').upsert(
      { user_id: ownerId, game_id, rating },
      { onConflict: 'user_id,game_id' }
    );
  }

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search games…"
        className="w-full rounded-md bg-neutral-900 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {(q && rows.length > 0) && (
        <ul className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
          {rows.map((g) => (
            <li key={g.id} className="flex items-center gap-3 p-2 hover:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.cover_url || '/cover-fallback.png'}
                alt={g.name}
                className="h-12 w-9 rounded border border-white/10 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-white">{g.name}</div>
                {g.release_year && <div className="text-xs text-white/50">{g.release_year}</div>}
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2" data-ignore-context>
                <button
                  className="rounded px-2 py-1 text-xs bg-white/10 hover:bg-white/15"
                  onClick={() => setOpenId((id) => (id === g.id ? null : g.id))}
                >
                  Add
                </button>

                {/* Rating inline */}
                <StarRating size={14} value={0} onChange={(v) => upsertRating(g.id, v)} />

                <Link
                  href={`/game/${g.id}`}
                  className="text-xs text-white/60 hover:text-white/80 underline"
                  prefetch={false}
                >
                  View
                </Link>
              </div>

              {openId === g.id && (
                <div className="absolute right-2 top-full mt-1 z-50 w-40 rounded-lg bg-neutral-900 border border-white/10 shadow-xl p-1">
                  <StatusMenu
                    value={'Backlog'}
                    onChange={async (next) => {
                      await upsertStatus(g.id, next);
                      setOpenId(null);
                    }}
                  />
                </div>
              )}
            </li>
          ))}
          {loading && <li className="p-3 text-sm text-white/60">Searching…</li>}
        </ul>
      )}
      {q && !loading && rows.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 p-3 text-white/60">
          No results yet.
        </div>
      )}
    </div>
  );
}