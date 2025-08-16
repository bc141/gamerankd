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
  comment_id: number | null;
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const session = await waitForSession(supabase);
      if (cancelled) return;

      const me = session?.user?.id ?? null;
      setReady(true);

      if (!me) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Fetch notifications (narrow select)
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id,type,user_id,actor_id,game_id,comment_id,meta,read_at,created_at'
        )
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const list = (data ?? []) as Notif[];
      setRows(list);

      // Hydrate profiles & games in parallel (small perf win)
      const actorIds = Array.from(new Set(list.map((n) => n.actor_id)));
      const gameIds = Array.from(
        new Set(
          list
            .map((n) => n.game_id)
            .filter((x): x is number => typeof x === 'number')
        )
      );

      const [profsRes, gamesRes] = await Promise.all([
        actorIds.length
          ? supabase
              .from('profiles')
              .select('id,username,display_name,avatar_url')
              .in('id', actorIds)
          : Promise.resolve({ data: [] as any[] }),
        gameIds.length
          ? supabase
              .from('games')
              .select('id,name,cover_url')
              .in('id', gameIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;

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

// Mark all as read (best-effort; don't block UI)
void supabase
  .from('notifications')
  .update({ read_at: new Date().toISOString() })
  .eq('user_id', me)
  .is('read_at', null);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const title = useMemo(() => 'Notifications', []);

  if (!ready) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/70">You’re all caught up.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {rows.map((n) => {
            const actor = actors[n.actor_id];
            const actorName =
              actor?.display_name || actor?.username || 'Someone';
            const actorHref = actor?.username
              ? `/u/${actor.username}`
              : null; // no "#" links
            const avatar = actor?.avatar_url || '/avatar-placeholder.svg';

            const game =
              n.game_id != null ? games[n.game_id] ?? null : null;
            const gameHref = game ? `/game/${game.id}` : null;

            const ActorName = actorHref ? (
              <Link href={actorHref} className="font-medium hover:underline">
                {actorName}
              </Link>
            ) : (
              <span className="font-medium">{actorName}</span>
            );

            const GameName = gameHref && game ? (
              <Link href={gameHref} className="font-medium hover:underline">
                {game.name}
              </Link>
            ) : game ? (
              <span className="font-medium">{game.name}</span>
            ) : null;

            let text: ReactNode = null;

            if (n.type === 'like') {
              text = (
                <>
                  {ActorName} liked your rating
                  {GameName ? <> of {GameName}</> : null}.
                </>
              );
            } else if (n.type === 'comment') {
              const preview = n.meta?.preview
                ? String(n.meta.preview)
                : null;
              text = (
                <>
                  {ActorName} commented on your rating
                  {GameName ? <> of {GameName}</> : null}.
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

            return (
              <li key={n.id} className="flex items-start gap-3 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{text}</div>
                  <div className="text-xs text-white/40 mt-0.5">
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