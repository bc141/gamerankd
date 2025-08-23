// src/components/home/HomeClient.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import StarRating from '@/components/StarRating';
import { useReviewContextModal } from '@/components/ReviewContext/useReviewContextModal';
import { onRowClick, onRowKeyDown } from '@/lib/safeOpenContext';
import LikePill from '@/components/LikePill';
import {
  likeKey,
  fetchLikesBulk,
  toggleLike,
  broadcastLike,
  addLikeListener,
  type LikeEntry,
} from '@/lib/likes';
import {
  commentKey,
  fetchCommentCountsBulk,
  addCommentListener,
} from '@/lib/comments';
import { getBlockSets } from '@/lib/blocks';
import { toInList } from '@/lib/sql';

// ---------- types ----------
type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Game = { id: number; name: string; cover_url: string | null };

type Review = {
  user_id: string;
  game_id: number;
  rating: number; // 1..100
  review: string | null;
  created_at: string;
  author: Profile | null;
  game: Game | null;
};

type LibRow = {
  status: 'Playing' | 'Backlog' | 'Completed' | 'Dropped';
  updated_at: string;
  game: Game | null;
};

type Scope = 'following' | 'global' | 'foryou';

// ---------- component ----------
export default function HomeClient() {
  const supabase = supabaseBrowser();

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // center feed
  const [feed, setFeed] = useState<Review[] | null>(null);
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>(() => {
    if (typeof window === 'undefined') return 'following';
    const p = new URLSearchParams(window.location.search).get('feed');
    return p === 'global' ? 'global' : p === 'foryou' ? 'foryou' : 'following';
  });

  // right rail
  const [continueList, setContinueList] = useState<LibRow[] | null>(null);
  const [whoToFollow, setWhoToFollow] = useState<Profile[] | null>(null);
  const [trending, setTrending] = useState<Game[] | null>(null);

  // context modal (same as Feed)
  const { open: openContext, modal: contextModal } = useReviewContextModal(
    supabase,
    me ?? null
  );

  // ❤️ likes for visible items
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  // 💬 comment counts
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await waitForSession(supabase);
      if (cancelled) return;

      const uid = session?.user?.id ?? null;
      setMe(uid);
      setReady(true);

      if (uid) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', uid)
          .single();
        if (!cancelled) setMyUsername(data?.username ?? null);
      }

      // always fetch right-rail
      fetchTrending().then((g) => !cancelled && setTrending(g));
      fetchContinue(uid).then((rows) => !cancelled && setContinueList(rows));
      fetchWhoToFollow(uid).then((p) => !cancelled && setWhoToFollow(p));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // cross-tab / same-tab like sync
  useEffect(() => {
    const off = addLikeListener(({ reviewUserId, gameId, liked, delta }) => {
      const k = likeKey(reviewUserId, gameId);
      setLikes(prev => {
        const cur = prev[k] ?? { liked: false, count: 0 };
        return { ...prev, [k]: { liked, count: Math.max(0, cur.count + delta) } };
      });
    });
    return off;
  }, []);

  // cross-tab / same-tab comment count sync
  useEffect(() => {
    const off = addCommentListener(({ reviewUserId, gameId, delta }) => {
      const k = commentKey(reviewUserId, gameId);
      setCommentCounts(prev => ({ ...prev, [k]: Math.max(0, (prev[k] ?? 0) + delta) }));
    });
    return off;
  }, []);

  // keep URL in sync + (re)load feed on scope changes / login state ready
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      if (scope === 'following') qs.delete('feed');
      else qs.set('feed', scope);
      const next = qs.size ? `?${qs.toString()}` : window.location.pathname;
      window.history.replaceState(null, '', next);
    }

    if (!ready) return;

    setFeed(null);
    setFeedErr(null);

    if (!me && scope === 'following') {
      setFeed([]); // not signed-in: show empty with CTA
      return;
    }

    const load = async () => {
      try {
                 if (scope === 'following') {
           const { data } = await fetchFollowingFeed(supabase, me!);
           setFeed(data);
         } else if (scope === 'global') {
           const { data } = await fetchGlobalFeed(supabase, me);
           setFeed(data);
         } else {
           const { data } = await fetchForYou(supabase, me);
           setFeed(data);
         }
       } catch (e: any) {
         setFeedErr(String(e?.message ?? e));
       }
     };
     load();
  }, [scope, me, ready, supabase]);

  // Preload likes & comment counts when feed changes
  useEffect(() => {
    (async () => {
      if (!me || !Array.isArray(feed) || feed.length === 0) {
        setLikes({});
        setCommentCounts({});
        return;
      }
      const pairs = feed
        .filter(r => r.author?.id)
        .map(r => ({ reviewUserId: r.author!.id, gameId: r.game_id }));

      if (!pairs.length) {
        setLikes({});
        setCommentCounts({});
        return;
      }

      const [likesMap, commentsMap] = await Promise.all([
        fetchLikesBulk(supabase, me, pairs),
        fetchCommentCountsBulk(supabase, pairs),
      ]);
      setLikes(likesMap ?? {});
      setCommentCounts(commentsMap ?? {});
    })();
  }, [feed, me, supabase]);

  // Like/Unlike handler
  async function onToggleLike(reviewUserId: string, gameId: number) {
    if (!me) { window.location.href = '/login'; return; }
    const k = likeKey(reviewUserId, gameId);
    if (likeBusy[k]) return;

    const before = likes[k] ?? { liked: false, count: 0 };

    // optimistic
    setLikes((p) => ({
      ...p,
      [k]: { liked: !before.liked, count: before.count + (before.liked ? -1 : 1) },
    }));
    setLikeBusy((p) => ({ ...p, [k]: true }));

    try {
      const { liked, count, error } = await toggleLike(supabase, reviewUserId, gameId);
      if (error) {
        setLikes((p) => ({ ...p, [k]: before }));
        return;
      }
      setLikes((p) => ({ ...p, [k]: { liked, count } }));
      broadcastLike(reviewUserId, gameId, liked, liked ? 1 : -1);

      // tiny re-fetch to reconcile
      setTimeout(async () => {
        const map = await fetchLikesBulk(supabase, me, [{ reviewUserId, gameId }]);
        setLikes((p) => ({ ...p, ...map }));
      }, 120);
    } finally {
      setLikeBusy((p) => ({ ...p, [k]: false }));
    }
  }

  // ---------- UI ----------
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* CENTER */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Home</h1>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
              {(['following', 'foryou', 'global'] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    scope === s
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                  aria-pressed={scope === s}
                >
                  {s === 'following' ? 'Following' : s === 'foryou' ? 'For You' : 'Everyone'}
                </button>
              ))}
            </div>
          </div>

          {!ready ? (
            <p className="text-white/60">Loading…</p>
          ) : !me && scope === 'following' ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Sign in to see reviews from people you follow. In the meantime,
                check <Link className="underline" href="/discover">Discover</Link>.
              </p>
            </div>
          ) : feedErr ? (
            <p className="text-red-400">{feedErr}</p>
          ) : feed == null ? (
            <p className="text-white/60">Loading your feed…</p>
          ) : feed.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Nothing here yet. Try <Link className="underline" href="/discover">Discover</Link> or follow more players.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
              {feed.map((r, i) => {
                const a = r.author;
                const g = r.game;
                const stars = Number((r.rating / 20).toFixed(1));
                const actorHref = a?.username ? `/u/${a.username}` : '#';
                const gameHref = g ? `/game/${g.id}` : '#';

                return (
                  <li
                    key={`${r.user_id}-${r.game_id}-${r.created_at}-${i}`}
                    className="group p-3 hover:bg-white/5 focus-within:bg-white/5 transition rounded-[6px]"
                    onClick={(e) =>
                      onRowClick(e, () => {
                        if (a?.id) openContext(a.id, r.game_id);
                      })
                    }
                    onKeyDown={(e) =>
                      onRowKeyDown(e, () => {
                        if (a?.id) openContext(a.id, r.game_id);
                      })
                    }
                    tabIndex={0}
                    role="button"
                    aria-label="Open rating in context"
                  >
                    <div className="flex items-center gap-3">
                      {/* avatar */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a?.avatar_url || '/avatar-placeholder.svg'}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-white/90">
                          <Link
                            href={actorHref}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a?.display_name || a?.username || 'Player'}
                          </Link>{' '}
                          rated{' '}
                          <Link
                            href={gameHref}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {g?.name ?? 'a game'}
                          </Link>
                          <span className="ml-2 inline-flex items-center gap-1 text-white/70">
                            <StarRating value={stars} readOnly size={14} />
                            <span className="text-xs">{stars} / 5</span>
                          </span>
                        </div>
                        <div className="text-xs text-white/40">{timeAgo(r.created_at)}</div>
                      </div>

                      {g?.cover_url && (
                        <Link
                          href={gameHref}
                          className="ml-auto shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.cover_url}
                            alt=""
                            className="h-12 w-9 rounded object-cover border border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                      )}
                    </div>

                    {r.review?.trim() && (
                      <p className="mt-2 whitespace-pre-wrap text-white/85">
                        {r.review.trim()}
                      </p>
                    )}

                    {/* actions */}
                    <div className="mt-2 flex items-center gap-2 pointer-events-none">
                      {r.author?.id && (
                        <span className="pointer-events-auto" data-ignore-context>
                          {(() => {
                            const k = likeKey(r.author!.id, r.game_id);
                            const entry = likes[k] ?? { liked: false, count: 0 };
                            return (
                              <LikePill
                                liked={entry.liked}
                                count={entry.count}
                                busy={likeBusy[k]}
                                onClick={() => onToggleLike(r.author!.id, r.game_id)}
                              />
                            );
                          })()}
                        </span>
                      )}

                      {r.author?.id && (
                        <span className="pointer-events-auto" data-ignore-context>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openContext(r.author!.id, r.game_id);
                            }}
                            className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                            title="View comments"
                            aria-label="View comments"
                          >
                            {(() => {
                              const ck = commentKey(r.author!.id, r.game_id);
                              const cCount = commentCounts[ck] ?? 0;
                              return <>💬 {cCount}</>;
                            })()}
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* mount context modal once */}
          {contextModal}
        </section>

        {/* RIGHT RAIL */}
        <aside className="space-y-6">
          {/* Continue playing */}
          <Panel title="Continue playing" rightAction={
            me ? (
              <Link
                href={myUsername ? `/u/${myUsername}/library?status=playing` : '/login'}
                className="text-xs text-white/60 hover:text-white"
              >
                See all
              </Link>
            ) : null
          }>
            {!me ? (
              <div className="p-3 text-sm text-white/60">Sign in to see your library.</div>
            ) : continueList == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : continueList.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No games yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {continueList.map((r, i) => (
                  <li key={`${r.game?.id}-${i}`}>
                    <Link href={r.game ? `/game/${r.game.id}` : '#'} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.game?.cover_url || '/cover-fallback.png'}
                        alt={r.game?.name || ''}
                        className="h-24 w-full rounded object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[11px] text-white/80 truncate">{r.game?.name}</div>
                      <div className="text-[10px] text-white/40">
                        {r.status} · {timeAgo(r.updated_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Who to follow */}
          <Panel title="Who to follow">
            {whoToFollow == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : whoToFollow.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No suggestions right now.</div>
            ) : (
              <ul className="p-2 space-y-2">
                {whoToFollow.map((u) => {
                  const href = u.username ? `/u/${u.username}` : '#';
                  return (
                    <li key={u.id} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.avatar_url || '/avatar-placeholder.svg'}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">
                          {u.display_name || u.username || 'Player'}
                        </div>
                        {u.username && (
                          <div className="text-xs text-white/40 truncate">@{u.username}</div>
                        )}
                      </Link>
                      <FollowButton targetId={u.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Trending */}
          <Panel
            title="Trending this week"
            rightAction={
              <Link href="/discover" className="text-xs text-white/60 hover:text-white">
                Discover
              </Link>
            }
          >
            {trending == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : trending.length === 0 ? (
              <div className="p-3 text-sm text-white/60">Nothing yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {trending.map((g) => (
                  <li key={g.id}>
                    <Link href={`/game/${g.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.cover_url || '/cover-fallback.png'}
                        alt={g.name}
                        className="h-24 w-full rounded object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[11px] text-white/80 truncate">{g.name}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

// ---------- small pieces ----------
function Panel({
  title,
  rightAction,
  children,
}: {
  title: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white/90">{title}</h2>
        {rightAction}
      </div>
      {children}
    </div>
  );
}

/** Lightweight follow button (optimistic). */
function FollowButton({ targetId }: { targetId: string }) {
  const supabase = supabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <button
      disabled={busy || done}
      onClick={async () => {
        setBusy(true);
        try {
          const session = await waitForSession(supabase);
          const uid = session?.user?.id;
          if (!uid) {
            window.location.href = '/login';
            return;
          }
          await supabase.from('follows').insert({ follower_id: uid, followee_id: targetId });
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
      className={`text-xs px-2 py-1 rounded border ${
        done ? 'border-white/20 text-white/40' : 'border-white/20 hover:border-white/30'
      }`}
    >
      {done ? 'Following' : busy ? '…' : 'Follow'}
    </button>
  );
}

// ---------- fetchers ----------
async function fetchFollowingFeed(sb: ReturnType<typeof supabaseBrowser>, uid: string) {
  // who I follow
  const fl = await sb.from('follows').select('followee_id').eq('follower_id', uid).limit(1000);
  const followingIds = (fl.data ?? []).map((r: any) => String(r.followee_id));

  if (!followingIds.length) return { data: [] as Review[] };

  // blocks & mutes
  const { iBlocked, blockedMe, iMuted } = await getBlockSets(sb, uid);
  const hidden = new Set<string>([...iBlocked, ...blockedMe].map(String));
  const mutedIds = Array.from(iMuted ?? new Set<string>()).map(String);

  const allowed = followingIds.filter(id => !hidden.has(id));
  if (!allowed.length) return { data: [] as Review[] };

  let q = sb
    .from('reviews')
    .select(`
      user_id, game_id, rating, review, created_at,
      author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
      game:games ( id, name, cover_url )
    `)
    .in('user_id', allowed)
    .order('created_at', { ascending: false })
    .limit(40);

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));

  const { data, error } = await q;
  if (error) throw error;

  // final safety pass
  const safe = normalizeReviews(data).filter(r => {
    const uid = r.author?.id;
    return !(uid && (hidden.has(uid) || mutedIds.includes(uid)));
  });

  return { data: safe };
}

async function fetchGlobalFeed(sb: ReturnType<typeof supabaseBrowser>, viewerId?: string | null) {
  // optional blocks/mutes (viewer may be null)
  let hidden = new Set<string>();
  let mutedIds: string[] = [];
  if (viewerId) {
    const { iBlocked, blockedMe, iMuted } = await getBlockSets(sb, viewerId);
    hidden = new Set([...iBlocked, ...blockedMe].map(String));
    mutedIds = Array.from(iMuted ?? new Set<string>()).map(String);
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  let q = sb
    .from('reviews')
    .select(`
      user_id, game_id, rating, review, created_at,
      author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
      game:games ( id, name, cover_url )
    `)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(60);

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));

  const { data, error } = await q;
  if (error) throw error;

  const safe = normalizeReviews(data).filter(r => {
    const uid = r.author?.id;
    return !(uid && (hidden.has(uid) || mutedIds.includes(uid)));
  });

  return { data: safe };
}

/** “For You”: recent reviews, lightly boosted if you follow the author. */
async function fetchForYou(sb: ReturnType<typeof supabaseBrowser>, uid: string | null) {
  // gather followees (optional)
  let followSet = new Set<string>();
  if (uid) {
    const fl = await sb.from('follows').select('followee_id').eq('follower_id', uid).limit(1000);
    (fl.data ?? []).forEach((r: any) => followSet.add(String(r.followee_id)));
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);

  // blocks/mutes (viewer may be null)
  let hidden = new Set<string>();
  let mutedIds: string[] = [];
  if (uid) {
    const { iBlocked, blockedMe, iMuted } = await getBlockSets(sb, uid);
    hidden = new Set([...iBlocked, ...blockedMe].map(String));
    mutedIds = Array.from(iMuted ?? new Set<string>()).map(String);
  }

  let q = sb
    .from('reviews')
    .select(`
      user_id, game_id, rating, review, created_at,
      author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
      game:games ( id, name, cover_url )
    `)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(120);

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));

  const { data, error } = await q;
  if (error) throw error;

  const rows = normalizeReviews(data).filter(r => {
    const aid = r.author?.id;
    return !(aid && (hidden.has(aid) || mutedIds.includes(aid)));
  });

  // tiny score: recency + follow bonus
  const scored = rows.map(r => {
    const ageHrs = Math.max(1, (Date.now() - new Date(r.created_at).getTime()) / 36e5);
    const recency = 1 / ageHrs;
    const bonus = r.author?.id && followSet.has(r.author.id) ? 0.5 : 0;
    return { r, s: recency + bonus };
  }).sort((a,b) => b.s - a.s);

  return { data: scored.slice(0, 40).map(x => x.r) };
}

async function fetchContinue(uid: string | null): Promise<LibRow[]> {
  if (!uid) return [];
  const { data, error } = await supabaseBrowser()
    .from('library')
    .select('status,updated_at,game:games(id,name,cover_url)')
    .eq('user_id', uid)
    .in('status', ['Playing', 'Backlog'])
    .order('updated_at', { ascending: false })
    .limit(6);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    status: r.status,
    updated_at: r.updated_at,
    game: r.game ? { id: r.game.id, name: r.game.name, cover_url: r.game.cover_url } : null,
  }));
}

async function fetchWhoToFollow(uid: string | null): Promise<Profile[]> {
  const recent = await supabaseBrowser()
    .from('reviews')
    .select('user_id')
    .order('created_at', { ascending: false })
    .limit(250);
  const recentIds = Array.from(new Set((recent.data ?? []).map((r: any) => String(r.user_id))));

  const exclude = new Set<string>();
  if (uid) {
    exclude.add(uid);
    const fl = await supabaseBrowser().from('follows').select('followee_id').eq('follower_id', uid).limit(1000);
    (fl.data ?? []).forEach((r: any) => exclude.add(String(r.followee_id)));
  }

  const candidates = recentIds.filter((id) => !exclude.has(id)).slice(0, 12);
  if (!candidates.length) return [];

  const { data } = await supabaseBrowser()
    .from('profiles')
    .select('id,username,display_name,avatar_url')
    .in('id', candidates);

  return (data ?? []).map((p: any) => ({
    id: String(p.id),
    username: p.username ?? null,
    display_name: p.display_name ?? null,
    avatar_url: p.avatar_url ?? null,
  }));
}

async function fetchTrending(): Promise<Game[]> {
  try {
    const res = await fetch('/api/games/browse?sections=trending&limit=6', {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    const json = await res.json();
    const items: any[] =
      json?.items ?? json?.trending ?? json?.sections?.trending ?? [];
    return items.map((g: any) => ({
      id: Number(g.id),
      name: String(g.name ?? ''),
      cover_url: g.cover_url ?? null,
    }));
  } catch {
    return [];
  }
}

function normalizeReviews(rows: any[] | null): Review[] {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map((r: any): Review => ({
    user_id: String(r.user_id),
    game_id: Number(r.game_id),
    rating: Number(r.rating ?? 0),
    review: r.review ?? null,
    created_at: String(r.created_at),
    author: r.author
      ? {
          id: String(r.author.id),
          username: r.author.username ?? null,
          display_name: r.author.display_name ?? null,
          avatar_url: r.author.avatar_url ?? null,
        }
      : null,
    game: r.game
      ? {
          id: Number(r.game.id),
          name: String(r.game.name ?? ''),
          cover_url: r.game.cover_url ?? null,
        }
      : null,
  }));
}