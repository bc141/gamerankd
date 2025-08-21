// src/app/notifications/page.tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { useReviewContextModal } from '@/components/ReviewContext/useReviewContextModal';
import { getBlockSets } from '@/lib/blocks';
import { toInList } from '@/lib/sql';

type NotifMeta = { preview?: string } | null;

type NotifType = 'like' | 'comment' | 'follow';

type Notif = {
  id: number;
  type: NotifType;
  user_id: string;
  actor_id: string;
  game_id: number | null;   // target game for like/comment
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

type LikeRollup = {
  kind: 'like-rollup';
  key: string;            // "like:game:{id}"
  created_at: string;     // newest in the group
  any_unread: boolean;
  actors: Profile[];      // up to 3
  count: number;          // total likes in group
  game?: Game;
  game_id: number;
};

type Rolled = LikeRollup | { kind: 'single'; notif: Notif };

function rollupNotifications(
  list: Notif[],
  actors: Record<string, Profile>,
  games: Record<number, Game>
): Rolled[] {
  const likeGroups = new Map<number, {
    created_at: string;
    any_unread: boolean;
    actors: Profile[];
    count: number;
  }>();
  const singles: Rolled[] = [];

  for (const n of list) {
    if (n.type === 'like' && typeof n.game_id === 'number') {
      const gid = n.game_id;
      const g = likeGroups.get(gid);
      const actor = actors[n.actor_id];
      if (!actor) {
        // Skip this row if we can't resolve actor profile yet.
        continue;
      }
      if (!g) {
        likeGroups.set(gid, {
          created_at: n.created_at,
          any_unread: !n.read_at,
          actors: [actor],
          count: 1,
        });
      } else {
        if (new Date(n.created_at) > new Date(g.created_at)) {
          g.created_at = n.created_at;
        }
        g.any_unread ||= !n.read_at;
        if (!g.actors.some(a => a.id === actor.id)) g.actors.push(actor);
        g.count += 1;
      }
    } else {
      singles.push({ kind: 'single', notif: n });
    }
  }

  const rolledLikes: Rolled[] = Array.from(likeGroups.entries()).map(([gid, g]) => ({
    kind: 'like-rollup',
    key: `like:game:${gid}`,
    created_at: g.created_at,
    any_unread: g.any_unread,
    actors: g.actors.slice(0, 3),
    count: g.count,
    game: games[gid],
    game_id: gid,
  }));

  const merged = [...rolledLikes, ...singles].sort((a, b) => {
    const ta = new Date(a.kind === 'single' ? a.notif.created_at : a.created_at).getTime();
    const tb = new Date(b.kind === 'single' ? b.notif.created_at : b.created_at).getTime();
    return tb - ta;
  });

  return merged;
}

function shouldOpenContext(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (el?.closest('a,button,[data-ignore-context],input,textarea,svg')) return false;
  const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
  if (sel && !sel.isCollapsed) return false;
  return true;
}

export default function NotificationsPage() {
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Notif[]>([]);
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [games, setGames] = useState<Record<number, Game>>({});
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  const { open: openContext, modal: contextModal } = useReviewContextModal(supabase, me);

  const broadcastNotifSync = () => {
    try { localStorage.setItem('gb-notif-sync', String(Date.now())); } catch {}
  };

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gb-notif-sync' || e.key === 'gb-block-sync') {
        void fetchAll();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    const session = await waitForSession(supabase);
    const uid = session?.user?.id ?? null;
    setMe(uid);
    setReady(true);

    if (!uid) {
      setRows([]); setActors({}); setGames({}); setLoading(false);
      return;
    }

    // Block/mute sets
    const { iBlocked, blockedMe, iMuted } = await getBlockSets(supabase, uid);

    // Base notif query (exclude muted at DB level)
    let q = supabase
      .from('notifications')
      .select('id,type,user_id,actor_id,game_id,comment_id,meta,read_at,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    const mutedIds = Array.from(iMuted ?? new Set<string>());
    if (mutedIds.length) {
      q = q.not('actor_id', 'in', toInList(mutedIds));
    }

    const { data, error } = await q;

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    // Final client filter: blocked either way OR muted (safety)
    const isHidden = (aid?: string | null) =>
      !!aid && (iBlocked.has(aid) || blockedMe.has(aid) || iMuted.has(aid));

    const all = (data ?? []) as Notif[];
    const visible = all.filter(n => !isHidden(n.actor_id));
    setRows(visible);

    // Hydrate profiles & games from filtered set
    const actorIds = Array.from(new Set(visible.map(n => n.actor_id)));
    const gameIds  = Array.from(new Set(
      visible.map(n => n.game_id).filter((x): x is number => typeof x === 'number')
    ));

    const [profsRes, gamesRes] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles')
            .select('id,username,display_name,avatar_url')
            .in('id', actorIds)
        : Promise.resolve({ data: [] as any[] }),
      gameIds.length
        ? supabase.from('games')
            .select('id,name,cover_url')
            .in('id', gameIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profMap: Record<string, Profile> = {};
    (profsRes.data ?? []).forEach((p: any) => { if (p?.id) profMap[p.id] = p; });
    setActors(profMap);

    const gameMap: Record<number, Game> = {};
    (gamesRes.data ?? []).forEach((g: any) => { if (g?.id != null) gameMap[g.id] = g; });
    setGames(gameMap);

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await fetchAll(); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    const onFocus = () => { void fetchAll(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // mark a single row read (optimistic)
  async function markRowRead(n: Notif) {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setRows(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: now } : x)));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', n.id)
      .is('read_at', null);
    if (error) {
      setRows(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: null } : x)));
      return;
    }
    broadcastNotifSync();
  }

  // mark all like rows for a game as read (optimistic)
  async function markLikeGroupRead(gameId: number) {
    if (!me) return;
    const now = new Date().toISOString();

    // Optimistic local update
    setRows(prev =>
      prev.map(x =>
        x.type === 'like' && x.user_id === me && x.game_id === gameId && !x.read_at
          ? { ...x, read_at: now }
          : x
      )
    );

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', me)
      .eq('type', 'like')
      .eq('game_id', gameId)
      .is('read_at', null);

    if (error) {
      // Re-fetch to resync rather than trying to revert all rows precisely
      await fetchAll();
      return;
    }
    broadcastNotifSync();
  }

  async function handleMarkAll() {
    if (!rows.some(r => !r.read_at)) return;
    const now = new Date().toISOString();
    const before = rows;
    setRows(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: now })));
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
        <>
          {(() => {
            const rolled = rollupNotifications(rows, actors, games);
            return (
              <ul className="space-y-2">
                {rolled.map(item => {
                  // --- single notifications (comment/follow) + like (single fallback) ---
                  if (item.kind === 'single') {
                    const n = item.notif;
                    const actor = actors[n.actor_id];
                    const actorName = actor?.display_name || actor?.username || 'Someone';
                    const actorHref = actor?.username ? `/u/${actor.username}` : null;
                    const avatar = actor?.avatar_url || '/avatar-placeholder.svg';

                    const game = n.game_id != null ? games[n.game_id] ?? null : null;
                    const gameHref = game ? `/game/${game.id}` : null;

                    const ActorName = actorHref ? (
                      <Link href={actorHref} prefetch={false} className="font-medium hover:underline">
                        {actorName}
                      </Link>
                    ) : (
                      <span className="font-medium">{actorName}</span>
                    );

                    const GameName =
                      gameHref && game ? (
                        <Link href={gameHref} prefetch={false} className="font-medium hover:underline">
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
                    const canOpenContext =
                      (n.type === 'like' || n.type === 'comment') &&
                      typeof n.game_id === 'number' &&
                      !!me;

                    const absTime = new Date(n.created_at).toLocaleString();

                    return (
                      <li
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          void markRowRead(n);
                          if (canOpenContext && shouldOpenContext(e.target)) {
                            openContext(me!, n.game_id!);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void markRowRead(n);
                            if (canOpenContext) openContext(me!, n.game_id!);
                          }
                        }}
                        className={`flex items-start gap-3 py-4 rounded-lg -mx-3 px-3 transition-colors cursor-pointer ${
                          unread ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        {actorHref ? (
                          <Link
                            href={actorHref}
                            prefetch={false}
                            className="shrink-0 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open ${actorName}'s profile`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover border border-white/10"
                              loading="lazy"
                              decoding="async"
                            />
                          </Link>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border border-white/10 mt-0.5"
                            loading="lazy"
                            decoding="async"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/90">{text}</div>
                          <div className={`text-xs mt-0.5 ${unread ? 'text-white/60' : 'text-white/40'}`}>
                            <time title={absTime}>{timeAgo(n.created_at)}</time>
                          </div>
                        </div>

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
                              loading="lazy"
                              decoding="async"
                            />
                          </Link>
                        ) : null}
                      </li>
                    );
                  }

                  // --- like roll-up row ---
                  const a = item.actors;
                  const name = item.game?.name ?? 'this game';

                  const primary   = a[0]?.display_name || a[0]?.username || 'Someone';
                  const secondary = a[1]?.display_name || a[1]?.username || null;

                  // Show at most two names in the sentence; everything else becomes "+N other(s)"
                  const others = Math.max(0, item.count - (secondary ? 2 : 1));

                  let text: string;
                  if (!secondary) {
                    text = `${primary} liked your rating of ${name}.`;
                  } else if (others > 0) {
                    text = `${primary}, ${secondary} and ${others} other${others > 1 ? 's' : ''} liked your rating of ${name}.`;
                  } else {
                    text = `${primary} and ${secondary} liked your rating of ${name}.`;
                  }

                  const canOpenContext = !!me && !!item.game;

                  return (
                    <li
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        void markLikeGroupRead(item.game_id);
                        if (canOpenContext && shouldOpenContext(e.target)) {
                          openContext(me!, item.game_id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void markLikeGroupRead(item.game_id);
                          if (canOpenContext) openContext(me!, item.game_id);
                        }
                      }}
                      className={`flex items-start gap-3 py-4 rounded-lg px-3 transition-colors cursor-pointer ${
                        item.any_unread ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* stacked avatars */}
                      <div className="flex -space-x-2 shrink-0 mt-0.5">
                        {a.slice(0, 3).map(u => {
                          const uname = u.username ?? undefined;
                          const href = uname ? `/u/${uname}` : '#';
                          return (
                            <Link
                              key={u.id}
                              href={href}
                              prefetch={false}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Open ${u.display_name || u.username || 'profile'}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u.avatar_url || '/avatar-placeholder.svg'}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover border-2 border-neutral-900"
                                loading="lazy"
                                decoding="async"
                              />
                            </Link>
                          );
                        })}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/90">{text}</div>
                        <div className={`text-xs mt-0.5 ${item.any_unread ? 'text-white/60' : 'text-white/40'}`}>
                          <time title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</time>
                        </div>
                      </div>

                      {item.game?.cover_url && (
                        <Link
                          href={`/game/${item.game.id}`}
                          prefetch={false}
                          aria-label={`Open ${item.game.name}`}
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.game.cover_url}
                            alt={item.game.name}
                            className="h-14 w-10 rounded object-cover border border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </>
      )}

      {contextModal}
    </main>
  );
}