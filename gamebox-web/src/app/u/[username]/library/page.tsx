'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';
import { timeAgo } from '@/lib/timeAgo';
import BackToProfile from '@/components/BackToProfile';

type Tab = 'All' | LibraryStatus;

type Row = {
  game_id: number;
  status: LibraryStatus;
  updated_at: string;
  game: { id: number; name: string; cover_url: string | null };
};

export default function ProfileLibraryPage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const usernameSlug =
    Array.isArray((params as any)?.username)
      ? (params as any)?.username[0]
      : ((params as any)?.username ?? '');

  const [tab, setTab] = useState<Tab>('All');
  const [owner, setOwner] = useState<{ id: string; display: string } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [libCounts, setLibCounts] = useState<{ total: number; Backlog: number; Playing: number; Completed: number; Dropped: number }>({
    total: 0,
    Backlog: 0,
    Playing: 0,
    Completed: 0,
    Dropped: 0,
  });

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

      // fetch their library
      const { data, error } = await supabase
        .from('user_game_library')
        .select('game_id,status,updated_at,game:games(id,name,cover_url)')
        .eq('user_id', prof.id)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      const normalized: Row[] = (data ?? []).map((r: any) => {
        const g = r?.game ?? {};
        return {
          game_id: Number(r?.game_id),
          status: (r?.status ?? 'Backlog') as LibraryStatus,
          updated_at: String(r?.updated_at ?? new Date(0).toISOString()),
          game: {
            id: Number(g?.id ?? r?.game_id),
            name: String(g?.name ?? 'Unknown'),
            cover_url: (g?.cover_url ?? null) as string | null,
          },
        };
      }).filter(r => Number.isFinite(r.game.id));

      setRows(normalized);
      
      // Calculate counts
      const counts = {
        total: normalized.length,
        Backlog: normalized.filter(r => r.status === 'Backlog').length,
        Playing: normalized.filter(r => r.status === 'Playing').length,
        Completed: normalized.filter(r => r.status === 'Completed').length,
        Dropped: normalized.filter(r => r.status === 'Dropped').length,
      };
      setLibCounts(counts);
    })();

    return () => { cancelled = true; };
  }, [supabase, usernameSlug]);

  const TAB_META: {key: LibraryStatus | 'All'; label: string; count: number}[] = [
    { key: 'All',       label: 'All',       count: libCounts.total },
    { key: 'Backlog',   label: 'Backlog',   count: libCounts.Backlog ?? 0 },
    { key: 'Playing',   label: 'Playing',   count: libCounts.Playing ?? 0 },
    { key: 'Completed', label: 'Completed', count: libCounts.Completed ?? 0 },
    { key: 'Dropped',   label: 'Dropped',   count: libCounts.Dropped ?? 0 },
  ];

  const filtered = useMemo(() => {
    if (!rows) return null;
    return tab === 'All' ? rows : rows.filter(r => r.status === tab);
  }, [rows, tab]);

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
            <li key={`${r.game.id}-${r.status}-${r.updated_at}`}>
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
                  <span className="px-1.5 py-0.5 rounded bg-white/10">{r.status}</span>
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