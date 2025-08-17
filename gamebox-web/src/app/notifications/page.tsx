// src/app/notifications/page.tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { useReviewContextModal } from '@/components/ReviewContext/useReviewContextModal';
import ViewInContextButton from '@/components/ReviewContext/ViewInContextButton';

type NotifMeta = { preview?: string } | null;

type Notif = {
  id: number;
  type: 'like' | 'comment' | 'follow';
  user_id: string;
  actor_id: string;
  game_id: number | null;
  comment_id: string | null;
  meta: NotifMeta;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Game = { id: number; name: string; cover_url: string | null };

export default function NotificationsPage() {
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Notif[]>([]);
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [games, setGames] = useState<Record<number, Game>>({});
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  // 👁️ context modal controller
  const { open: openContext, modal: contextModal } = useReviewContextModal(
    supabase,
    me
  );

  // cross-tab ping so the bell stays in sync
  const broadcastNotifSync = () => {
    try {
      localStorage.setItem('gb-notif-sync', String(Date.now()));
    } catch {}
  };

  // fetch everything for this page
  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    const session = await waitForSession(supabase);
    const uid = session?.user?.id ?? null;
    setMe(uid);
    setReady(true);

    if (!uid) {
      setRows([]);
      setActors({});
      setGames({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,user_id,actor_id,game_id,comment_id,meta,read_at,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Notif[];
    setRows(list);

    // hydrate related rows (profiles + games)
    const actorIds = Array.from(new Set(list.map((n) => n.actor_id)));
    const gameIds = Array.from(
      new Set(list.map((n) => n.game_id).filter((x): x is number => typeof x === 'number'))
    );

    const [profsRes, gamesRes] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', actorIds)
        : Promise.resolve({ data: [] as any[] }),
      gameIds.length
        ? supabase.from('games').select('id,name,cover_url').in('id', gameIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profMap: Record<string, Profile> = {};
    (profsRes.data ?? []).forEach((p: any) => {
      profMap[p.id] = p;
    });
    setActors(profMap);

    const gameMap: Record<number, Game> = {};
    (gamesRes.data ?? []).forEach((g: any) => {
      gameMap[g.id] = g;
    });
    setGames(gameMap);

    setLoading(false);
  };

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchAll();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // refresh on window focus (long-lived tabs)
  useEffect(() => {
    const onFocus = () => fetchAll();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // mark one row read (optimistic) and notify other tabs
  async function handleRowClick(n: Notif) {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', n.id)
      .is('read_at', null);

    if (error) {
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: null } : x)));
      return;
    }
    broadcastNotifSync();
  }

  // mark all read (optimistic) and notify other tabs
  async function handleMarkAll() {
    if (!rows.some((r) => !r.read_at)) return;
    const now = new Date().toISOString();
    const before = rows;
    setRows((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', me)
      .is('read_at', null);

    if (error) {
      setRows(before);
      return;
    }
    broadcastNotifSync();
  }

  // helper: skip context open if the click was on a link/button/etc.
  function isInteractive(el: HTMLElement | null) {
    return !!el?.closest('a,button,[data-ignore-context],input,textarea,svg');
  }

  // unified row activation: mark read and (when applicable) open context
  function onRowActivate(e: React.MouseEvent | React.KeyboardEvent, n: Notif) {
    if (isInteractive(e.target as HTMLElement)) return; // child controls handle themselves
    handleRowClick(n);
    const canView =
      (n.type === 'like' || n.type === 'comment') &&
      typeof n.game_id === 'number' &&
      !!me;
    if (canView) {
      openContext(me!, n.game_id!);
    }
  }

  const title = useMemo(() => 'Notifications', []);

  if (!ready) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {rows.length > 0 && rows.some((r) => !r.read_at) && (
          <button
            onClick={handleMarkAll}
            className="text-sm rounded px-3 py-1.5 bg-white/10 hover:bg-white/15"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/70">You’re all caught up.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {rows.map((n) => {
            const actor = actors[n.actor_id];
            const actorName = actor?.display_name || actor?.username || 'Someone';
            const actorHref = actor?.username ? `/u/${actor.username}` : null;
            const avatar = actor?.avatar_url || '/avatar-placeholder.svg';

            const game = n.game_id != null ? games[n.game_id] ?? null : null;

            const ActorName = actorHref ? (
              <Link href={actorHref} prefetch={false} className="font-medium hover:underline">
                {actorName}
              </Link>
            ) : (
              <span className="font-medium">{actorName}</span>
            );

            const GameName =
              game && (
                <span className="font-medium">{game.name}</span>
              );

            let text: ReactNode = null;
            if (n.type === 'like') {
              text = (
                <>
                  {ActorName} liked your rating{GameName ? <> of {GameName}</> : null}.
                </>
              );
            } else if (n.type === 'comment') {
              const preview = n.meta?.preview ? String(n.meta.preview) : null;
              text = (
                <>
                  {ActorName} commented on your rating{GameName ? <> of {GameName}</> : null}.
                  {preview ? (
                    <span className="text-white/60">
                      {' '}
                      — “{preview.slice(0, 80)}
                      {preview.length > 80 ? '…' : ''}”
                    </span>
                  ) : null}
                </>
              );
            } else {
              text = <>{ActorName} started following you.</>;
            }

            const unread = !n.read_at;
            const canView =
              (n.type === 'like' || n.type === 'comment') &&
              typeof n.game_id === 'number' &&
              !!me;

            return (
              <li
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={(e) => onRowActivate(e, n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowActivate(e, n);
                  }
                }}
                className={`flex items-start gap-3 py-4 rounded-lg -mx-3 px-3 transition-colors cursor-pointer ${
                  unread ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {/* avatar */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10 mt-0.5"
                />

                {/* body */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{text}</div>
                  <div className={`text-xs mt-0.5 ${unread ? 'text-white/60' : 'text-white/40'}`}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>

                {/* actions / cover */}
                <div className="flex items-center gap-2" data-ignore-context>
                  {canView && (
                    // prevent parent row from also firing
                    <span onClick={(e) => e.stopPropagation()}>
                      <ViewInContextButton
                        onClick={() => openContext(me!, n.game_id!)}
                      />
                    </span>
                  )}
                  {game?.cover_url ? (
                    <Link
                      href={`/game/${game.id}`}
                      prefetch={false}
                      aria-label={`Open ${game.name}`}
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={game.cover_url}
                        alt={game.name}
                        className="h-14 w-10 rounded object-cover border border-white/10"
                      />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* context modal lives once per page */}
      {contextModal}
    </main>
  );
}