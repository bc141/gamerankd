// src/components/library/LibraryPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';
import StatusBadge from '@/components/library/StatusBadge';

type Tab = 'All' | LibraryStatus;

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

const TABS: Tab[] = ['All', ...LIBRARY_STATUSES];

export default function LibraryPageClient() {
  const supabase = supabaseBrowser();

  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('All');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [libCounts, setLibCounts] = useState<{ total: number; Backlog: number; Playing: number; Completed: number; Dropped: number }>({
    total: 0,
    Backlog: 0,
    Playing: 0,
    Completed: 0,
    Dropped: 0,
  });

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
      <div className="mt-4 mb-6 flex gap-2 overflow-x-auto no-scrollbar snap-x">
        {(['All', 'Backlog', 'Playing', 'Completed', 'Dropped'] as const).map((t) => {
          const isAll = t === 'All';
          const count =
            t === 'All' ? libCounts.total : (libCounts as any)[t] ?? 0;
          const disabled = !isAll && count === 0;
          const active = tab === t;

          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => {
                if (active && !isAll) {
                  setTab('All'); // clicking the active filter toggles back to All
                } else {
                  setTab(t);
                }
              }}
              className={`snap-start rounded-lg px-3 py-1.5 text-sm border
                ${active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/10'}
                ${disabled ? 'opacity-40 pointer-events-none' : ''}
              `}
            >
              {t} {!isAll && <span className="opacity-70">({count})</span>}
              {isAll && <span className="opacity-70">({libCounts.total})</span>}
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
        <p className="text-white/60">No games yet in this view.</p>
      )}

      {rows && rows.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map((r) => (
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}