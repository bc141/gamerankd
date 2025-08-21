// src/components/library/LibraryPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';
import Badge from '@/components/ui/Badge';

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
      <div className="flex items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`px-3 py-1.5 rounded text-sm ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 hover:bg-white/15 text-white/80'
            }`}
          >
            {t}
          </button>
        ))}
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
                  <Badge tone={r.status === 'Completed' ? 'success' : 'neutral'}>
                    {r.status}
                  </Badge>
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