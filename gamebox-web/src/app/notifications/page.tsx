'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';

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
  const [me, setMe] = useState<string | null>(null); // ✨ keep user id for refresh

  // ✨ tiny helper to ping other tabs (bell listens for this)
  const broadcastNotifSync = () => {
    try {
      window.localStorage.setItem('gb-notif-sync', String(Date.now()));
    } catch {}
  };

  // ✨ refetch function so we can also refresh on focus
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

    // Fetch notifications (narrow select)
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

    // Hydrate profiles & games in parallel
    const actorIds = Array.from(new Set(list.map(n => n.actor_id)));
    const gameIds = Array.from(
      new Set(list.map(n => n.game_id).filter((x): x is number => typeof x === 'number'))
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchAll();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ✨ refresh on window focus (covers long-lived tabs)
  useEffect(() => {
    const onFocus = () => fetchAll();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Optimistically mark a single row as read and persist (with revert on failure) + ✨ broadcast
  async function handleRowClick(n: Notif) {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setRows(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: now } : x)));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', n.id)
      .is('read_at', null);

    if (error) {
      // revert optimistic
      setRows(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: null } : x)));
      // optional toast: alert(error.message);
      return;
    }
    broadcastNotifSync(); // ✨ keep bell in sync
  }

  // Optimistically mark all as read and persist (with revert on failure) + ✨ broadcast
  async function handleMarkAll() {
    const unreadIds = rows.filter(r => !r.read_at).map(r => r.id);
    if (unreadIds.length === 0) return;

    const now = new Date().toISOString();
    const before = rows;
    setRows(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: now })));

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .is('read_at', null);

    if (error) {
      setRows(before); // revert optimistic
      // optional toast: alert(error.message);
      return;
    }
    broadcastNotifSync(); // ✨ keep bell in sync
  }

  const title = useMemo(() => 'Notifications', []);

  if (!ready) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {rows.length > 0 && rows.some(r => !r.read_at) && (
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
          {rows.map(n => {
            const actor = actors[n.actor_id];
            const actorName = actor?.display_name || actor?.username || 'Someone';
            const actorHref = actor?.username ? `/u/${actor.username}` : null;
            const avatar = actor?.avatar_url || '/avatar-placeholder.svg';

            const game = n.game_id != null ? games[n.game_id] ?? null : null;
            const gameHref = game ? `/game/${game.id}` : null;

            const ActorName = actorHref ? (
              <Link href={actorHref} className="font-medium hover:underline" prefetch={false}>
                {actorName}
              </Link>
            ) : (
              <span className="font-medium">{actorName}</span>
            );

            const GameName =
              gameHref && game ? (
                <Link href={gameHref} className="font-medium hover:underline" prefetch={false}>
                  {game.name}
                </Link>
              ) : game ? (
                <span className="font-medium">{game.name}</span>
              ) : null;

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

            return (
              <li
                key={n.id}
                onClick={() => handleRowClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(n);
                  }
                }}
                className={`flex items-start gap-3 py-4 rounded-lg -mx-3 px-3 transition-colors cursor-pointer ${
                  unread ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{text}</div>
                  <div className={`text-xs mt-0.5 ${unread ? 'text-white/60' : 'text-white/40'}`}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {game?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.cover_url}
                    alt={game.name}
                    className="h-14 w-10 rounded object-cover border border-white/10"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}