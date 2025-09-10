// src/components/library/LibraryPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';
import StatusBadge from '@/components/library/StatusBadge';
import StarRating from '@/components/StarRating';
import { fetchUserRatingsMap } from '@/lib/reviews';

// Tabs row
const TABS = [
  { key: 'All',       label: 'All' },
  { key: 'Backlog',   label: 'Backlog' },
  { key: 'Playing',   label: 'Playing' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Dropped',   label: 'Dropped' },
] as const;

type TabKey = typeof TABS[number]['key'];

function EmptyState({ tab }: { tab: TabKey }) {
  const copy: Record<TabKey, { title: string; hint: string }> = {
    All:       { title: 'No games in your library yet',      hint: 'Open any game page and use the Library status to add it.' },
    Backlog:   { title: 'Nothing in Backlog yet',            hint: 'Set a game\'s status to Backlog from its page.' },
    Playing:   { title: 'Nothing in Playing yet',            hint: 'Set a game\'s status to Playing from its page.' },
    Completed: { title: 'No games Completed yet',            hint: 'Mark a finished game as Completed on its page.' },
    Dropped:   { title: 'No games Dropped yet',              hint: 'Set Dropped on a game you stopped playing.' },
  };

  const c = copy[tab];

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center max-w-lg">
      <div className="text-3xl mb-2">🗂️</div>
      <h3 className="text-white text-lg font-semibold">{c.title}</h3>
      <p className="text-white/70 mt-1">{c.hint}</p>
      <a
        href="/search"
        className="inline-block mt-4 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
      >
        Find games
      </a>
    </div>
  );
}

type Row = {
  game_id: number;
  status: LibraryStatus;
  updated_at: string;
  game: {
    id: number;
    name: string;
    cover_url: string | null;
  };
};

export default function LibraryPageClient() {
  const supabase = supabaseBrowser();

  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('All');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ratingsByGame, setRatingsByGame] = useState<Record<number, number>>({});
  const [libCounts, setLibCounts] = useState<{ total: number; Backlog: number; Playing: number; Completed: number; Dropped: number }>({
    total: 0,
    Backlog: 0,
    Playing: 0,
    Completed: 0,
    Dropped: 0,
  });

  function countFor(k: TabKey) {
    return k === 'All' ? libCounts.total : (libCounts as any)[k] ?? 0;
  }

  // load session once
  useEffect(() => {
    (async () => {
      const session = await waitForSession(supabase);
      setUid(session?.user?.id ?? null);
    })();
  }, [supabase]);

  // fetch library when tab/user changes
  useEffect(() => {
    if (!uid) {
      setErr('Sign in to view your library.');
      setRows([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setErr(null);
      setRows(null);

      // base query
      const { data, error } = await supabase
        .from('user_game_library')
        .select('game_id,status,updated_at,game:games(id,name,cover_url)')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      const raw = (data ?? []) as any[];

      // normalize + optional filter by tab
      const normalized: Row[] = raw
        .map((r) => {
          const g = r?.game ?? {};
          const status = (r?.status ?? 'Backlog') as LibraryStatus;
          return {
            game_id: Number(r?.game_id),
            status,
            updated_at: String(r?.updated_at ?? new Date(0).toISOString()),
            game: {
              id: Number(g?.id ?? r?.game_id),
              name: String(g?.name ?? 'Unknown'),
              cover_url: (g?.cover_url ?? null) as string | null,
            },
          } as Row;
        })
        .filter((r) => Number.isFinite(r.game.id));

      const filtered =
        tab === 'All' ? normalized : normalized.filter((r) => r.status === tab);

      // Calculate library counts
      const counts = {
        total: normalized.length,
        Backlog: normalized.filter(r => r.status === 'Backlog').length,
        Playing: normalized.filter(r => r.status === 'Playing').length,
        Completed: normalized.filter(r => r.status === 'Completed').length,
        Dropped: normalized.filter(r => r.status === 'Dropped').length,
      };
      setLibCounts(counts);
      setRows(filtered);

      // collect game ids we actually show
      const gameIds = (filtered ?? [])
        .map((r) => Number(r?.game?.id))
        .filter((n) => Number.isFinite(n)) as number[];

      if (gameIds.length) {
        const ratingsMap = await fetchUserRatingsMap(supabase, uid, gameIds);
        setRatingsByGame(ratingsMap);
      } else {
        setRatingsByGame({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, uid, tab]);

  const header = useMemo(() => (tab === 'All' ? 'My Library' : `${tab}`), [tab]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{header}</h1>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Library filters"
        className="flex gap-2 overflow-x-auto no-scrollbar"
      >
        {TABS.map(({ key, label }) => {
          const n = countFor(key);
          const selected = tab === key;
          const muted = key !== 'All' && n === 0 && !selected;

          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(key)}
              className={[
                'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                selected
                  ? 'bg-indigo-600 text-white border-transparent'
                  : muted
                    ? 'text-white/55 border-white/10 hover:bg-white/5'
                    : 'text-white/90 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-2">
                {label}
                <span
                  className={[
                    'text-xs px-1.5 py-0.5 rounded',
                    selected
                      ? 'bg-white/20 text-white'
                      : muted
                        ? 'bg-white/5 text-white/50'
                        : 'bg-white/10 text-white/70',
                  ].join(' ')}
                >
                  {n}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {err && <p className="text-red-400 mb-3">{err}</p>}

      {/* Skeleton */}
      {rows === null && !err && (
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

      {/* Content */}
      {rows && rows.length === 0 && !err && (
        <EmptyState tab={tab} />
      )}

      {rows && rows.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map((r) => {
            const gid = Number(r.game?.id);
            const myRating100 = Number.isFinite(gid) ? ratingsByGame[gid] : undefined;

            return (
              <li key={`${r.game.id}-${r.status}`}>
                <Link
                  href={`/game/${r.game.id}`}
                  className="block rounded hover:bg-white/5 p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.game.cover_url || '/cover-fallback.png'}
                    alt={r.game.name}
                    className="h-40 w-full object-cover rounded border border-white/10"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="mt-2 text-sm text-white truncate">
                    {r.game.name}
                  </div>
                  <div className="mt-1 text-xs text-white/50 flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span>· {timeAgo(r.updated_at)}</span>
                  </div>
                  {typeof myRating100 === 'number' && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                      <StarRating value={myRating100 / 20} size={14} readOnly />
                      <span className="text-white/60">{(myRating100 / 20).toFixed(1)}</span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}