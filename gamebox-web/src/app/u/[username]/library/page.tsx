'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { type LibraryStatus } from '@/lib/library';
import { timeAgo } from '@/lib/timeAgo';
import BackToProfile from '@/components/BackToProfile';
import { applySortToSupabase, applySortToArray, type SupabaseSortMap, type SortKey } from '@/lib/sort';
import StarRating from '@/components/StarRating';

type Tab = 'All' | LibraryStatus;

// ADD / UPDATE imports near the top
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent',       label: 'Recent' },
  { key: 'az',           label: 'A–Z' },
  { key: 'za',           label: 'Z–A' },
  { key: 'status',       label: 'By status' },
  { key: 'ratingHigh',   label: 'Your rating (High → Low)' },
  { key: 'ratingLow',    label: 'Your rating (Low → High)' },
];

// choose a sensible default; Recent is best for libraries
const DEFAULT_SORT: SortKey = 'recent';

const LIBRARY_SORT_MAP: SupabaseSortMap = {
  recent: { column: 'updated_at' },            // base table column
  name:   { column: 'name', table: 'games' },  // relation key, not the alias
  status: { column: 'status' },                // base table column
};

type Row = {
  game_id: number;
  status: LibraryStatus;
  updated_at: string;
  game: { id: number; name: string; cover_url: string | null } | null;
};

// If your Row type exists, extend it locally to carry the user rating:
type RowWithRating = Row & { my_rating?: number | null };

// Add this helper in the same file:
async function fetchRatingsMap(
  supabase: ReturnType<typeof import('@/lib/supabaseBrowser').supabaseBrowser>,
  userId: string,
  gameIds: number[]
): Promise<Record<number, number>> {
  if (gameIds.length === 0) return {};
  const { data, error } = await supabase
    .from('reviews')
    .select('game_id, rating')
    .eq('user_id', userId)
    .in('game_id', gameIds)
    .not('rating', 'is', null);

  if (error) return {};
  const map: Record<number, number> = {};
  for (const row of data ?? []) {
    // if multiple, keep latest rating is fine; for now first wins
    if (map[row.game_id] == null) map[row.game_id] = row.rating as number;
  }
  return map;
}

export default function ProfileLibraryPage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const usernameSlug =
    Array.isArray((params as any)?.username)
      ? (params as any)?.username[0]
      : ((params as any)?.username ?? '');

  const [tab, setTab] = useState<Tab>('All');
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`lib:sort:${String(usernameSlug)}`);
      if (saved === 'recent' || saved === 'az' || saved === 'za' ||
          saved === 'status' || saved === 'ratingHigh' || saved === 'ratingLow') {
        return saved as SortKey;
      }
    }
    return DEFAULT_SORT;
  });
  const [owner, setOwner] = useState<{ id: string; display: string } | null>(null);
  const [rows, setRows] = useState<RowWithRating[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [libCounts, setLibCounts] = useState<{ total: number; Backlog: number; Playing: number; Completed: number; Dropped: number }>({
    total: 0,
    Backlog: 0,
    Playing: 0,
    Completed: 0,
    Dropped: 0,
  });

  // Persist sort preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`lib:sort:${String(usernameSlug)}`, sort);
    }
  }, [sort, usernameSlug]);

  // Columns in this query:
  // - updated_at, status are from the base "library" table
  // - name comes from the joined games table

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      setRows(null);

      // who is this profile?
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('username', usernameSlug)
        .single();

      if (pErr || !prof) {
        if (!cancelled) {
          setErr('Profile not found.');
          setRows([]);
        }
        return;
      }
      if (cancelled) return;

      setOwner({
        id: prof.id as string,
        display: (prof.display_name ?? prof.username) as string,
      });

      // --- fetch their library (data) + counts in parallel ---
      let qBase = supabase
        .from('user_game_library')
        .select('game_id,status,updated_at,game:games(id,name,cover_url)')
        .eq('user_id', prof.id);

      let qData = qBase;
      // Only send sorts to the server when it actually helps.
      // A–Z / Z–A are handled client-side for correctness.
      if (sort === 'recent' || sort === 'status') {
        qData = applySortToSupabase(qData, sort as SortKey, LIBRARY_SORT_MAP) as typeof qData;
      }
      if (tab !== 'All') {
        qData = qData.eq('status', tab);
      }

      // counts: unfiltered, tiny payload
      const qCounts = supabase
        .from('user_game_library')
        .select('status')
        .eq('user_id', prof.id)
        .limit(2000);

      const [{ data, error }, { data: allStatuses, error: cErr }] = await Promise.all([
        qData.limit(200),
        qCounts
      ]);

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      // Build safe rows...
      const list = (data ?? []).map((r: any) => ({
        game_id: Number(r.game_id),
        status: (r.status ?? 'Backlog') as LibraryStatus,
        updated_at: String(r.updated_at),
        game: r.game ? {
          id: Number(r.game.id),
          name: String(r.game.name ?? ''),
          cover_url: r.game.cover_url ?? null,
        } : null,
      }));

      // Ratings (bulk)
      const ratingMap = await fetchRatingsMap(supabase, prof.id, list.map(x => x.game_id));
      const withRatings = list.map(r => ({ ...r, my_rating: ratingMap[r.game_id] ?? null }));

      // Client-side refinement (status ranking, rating sorts, etc.)
      const needsClientRefine =
        sort === 'status' ||
        sort === 'ratingHigh' ||
        sort === 'ratingLow' ||
        sort === 'az' ||
        sort === 'za';
      const finalRows = needsClientRefine
        ? applySortToArray(withRatings, sort as SortKey, (row) => ({
            name: row.game?.name ?? '',
            recent: row.updated_at,
            status: row.status,
            rating: row.my_rating,
          }))
        : withRatings;

      setRows(finalRows);

      // --- global counts from allStatuses (unfiltered) ---
      const baseCounts = { total: 0, Backlog: 0, Playing: 0, Completed: 0, Dropped: 0 };
      for (const s of allStatuses ?? []) {
        baseCounts.total += 1;
        if (s.status === 'Backlog') baseCounts.Backlog += 1;
        if (s.status === 'Playing') baseCounts.Playing += 1;
        if (s.status === 'Completed') baseCounts.Completed += 1;
        if (s.status === 'Dropped') baseCounts.Dropped += 1;
      }
      setLibCounts(baseCounts);
    })();

    return () => { cancelled = true; };
  }, [supabase, usernameSlug, sort, tab]);

  // Most helpful flow: Playing → Backlog → Completed → Dropped
  const TAB_ORDER: Array<'All' | 'Playing' | 'Backlog' | 'Completed' | 'Dropped'> = [
    'All', 'Playing', 'Backlog', 'Completed', 'Dropped'
  ];

  const TAB_META: {key: LibraryStatus | 'All'; label: string; count: number}[] = TAB_ORDER.map(key => ({
    key,
    label: key,
    count: key === 'All' ? libCounts.total : (libCounts as any)[key] ?? 0,
  }));

  const filtered = rows;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-2">
        <BackToProfile username={usernameSlug} />
      </div>
      <h1 className="text-2xl font-bold mb-1">
        {owner ? `${owner.display}'s Library` : 'Library'}
      </h1>
      <p className="text-white/60 mb-4">@{usernameSlug}</p>

      {/* chips */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-2">
          {TAB_META.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as LibraryStatus | 'All')}
              aria-pressed={tab === t.key}
              className={`px-3 py-2 rounded ${tab===t.key ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/15'}`}
            >
              {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-white/70">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-white/15 bg-neutral-900 px-2 py-1 text-white/90"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err && <p className="text-red-400 mb-3">{err}</p>}

      {/* Skeleton */}
      {filtered === null && !err && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="space-y-2">
              <div className="h-40 w-full rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {filtered && filtered.length === 0 && !err && (
        <p className="text-white/60">No games yet in this view.</p>
      )}

      {filtered && filtered.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <li key={`${r.game?.id || r.game_id}-${r.status}-${r.updated_at}`}>
              <Link
                href={`/game/${r.game?.id || r.game_id}`}
                className="block rounded hover:bg-white/5 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.game?.cover_url || '/cover-fallback.png'}
                  alt={r.game?.name || 'Unknown Game'}
                  className="h-40 w-full object-cover rounded border border-white/10"
                  loading="lazy"
                  decoding="async"
                />
                <div className="mt-2 text-sm text-white truncate">
                  {r.game?.name || 'Unknown Game'}
                </div>
                <div className="mt-1 text-xs text-white/50 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-white/10">{r.status}</span>
                  <span>· {timeAgo(r.updated_at)}</span>
                </div>
                {/* user rating mini (if exists) */}
                {r.my_rating != null && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/70" data-ignore-context>
                    <span className="inline-flex items-center gap-1">
                      <StarRating value={(r.my_rating as number) / 20} readOnly size={14} />
                      <span>{((r.my_rating as number) / 20).toFixed(1)} / 5</span>
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}