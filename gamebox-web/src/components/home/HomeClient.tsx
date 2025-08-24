'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import StarRating from '@/components/StarRating';
import { useReviewContextModal } from '@/components/ReviewContext/useReviewContextModal';
import { usePostContextModal } from '@/components/PostContext/usePostContextModal';
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
import { postLikeKey, fetchPostLikesBulk, togglePostLike as togglePostLikeApi, addPostLikeListener, broadcastPostLike, type LikeEntry as PostLikeEntry } from '@/lib/postLikes';
import { postCommentKey as postCKey, fetchPostCommentCountsBulk } from '@/lib/postComments';
import { getBlockSets } from '@/lib/blocks';
import { toInList } from '@/lib/sql';

// ---------- constants ----------
const POSTS_VIEW = 'post_feed_v2'; // fallback to 'post_feed' if v2 isn't present
const POST_COLS = 'id,user_id,created_at,body,tags,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

// ---------- helpers ----------
async function selectPostsWithFallback(
  sb: ReturnType<typeof supabaseBrowser>,
  build: (q: any) => any,
  limit = 40
): Promise<PostRow[]> {
  // try v2
  let q = build(sb.from('post_feed_v2').select(POST_COLS))
    .order('created_at', { ascending: false })
    .limit(limit);
  let { data, error } = await q;
  if (!error) return (data ?? []) as PostRow[];

  // fallback to v1
  q = build(sb.from('post_feed').select(POST_COLS))
    .order('created_at', { ascending: false })
    .limit(limit);
  ({ data } = await q);
  return (data ?? []) as PostRow[];
}

const sortByCreated = (a: FeedItem, b: FeedItem) =>
  Date.parse(b.created_at) - Date.parse(a.created_at);

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

type PostRow = {
  id: string;
  user_id: string;
  created_at: string;
  body: string | null;
  tags: string[] | null;
  like_count: number;
  comment_count: number;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  game_id: number | null;
  game_name: string | null;
  game_cover_url: string | null;
};

type Scope = 'following' | 'foryou';

type FeedItem =
  | { kind: 'review'; created_at: string; review: Review }
  | { kind: 'post';   created_at: string; post: PostRow };

const PAGE_SIZE = 30;

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
    if (typeof window === 'undefined') return 'foryou';
    const p = new URLSearchParams(window.location.search).get('tab');
    return p === 'following' ? 'following' : 'foryou';
  });

  // pagination
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // unified feed state
  const [unifiedFeed, setUnifiedFeed] = useState<FeedItem[] | null>(null);
  const [postCursor, setPostCursor] = useState<string | null>(null);

  // right rail
  const [continueList, setContinueList] = useState<LibRow[] | null>(null);
  const [whoToFollow, setWhoToFollow] = useState<Profile[] | null>(null);
  const [trending, setTrending] = useState<Game[] | null>(null);

  // context modal (same as Feed)
  const { open: openContext, modal: contextModal } = useReviewContextModal(
    supabase,
    me ?? null
  );
  const { open: openPostContext, modal: postContextModal } = usePostContextModal(me ?? null, async () => {
    // refresh comment counts when modal closes
    if (posts) {
      const ids = posts.map(p => String(p.id));
      const map = await fetchPostCommentCountsBulk(supabase, ids);
      setPostCommentCounts(prev => ({ ...prev, ...map }));
    }
  });

  // ❤️ likes for visible items
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  // 💬 comment counts
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // posts state
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [postLikes, setPostLikes] = useState<Record<string, PostLikeEntry>>({});
  const [postLikeBusy, setPostLikeBusy] = useState<Record<string, boolean>>({});
  const [postCommentCounts, setPostCommentCounts] = useState<Record<string, number>>({});

  // selection (keyboard nav)
  const [sel, setSel] = useState<number>(-1);

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

      // fetch posts
      if (!cancelled) {
        const postRows = await fetchPostsForScope(supabase, uid, scope, { limit: 20 });
        if (!cancelled) {
          setPosts(postRows);

          const ids = postRows.map(r => String(r.id));
          const userId = uid ?? null;
          const [likesMap, cMap] = await Promise.all([
            fetchPostLikesBulk(supabase, userId, ids),
            fetchPostCommentCountsBulk(supabase, ids),
          ]);
          setPostLikes(likesMap ?? {});
          setPostCommentCounts(cMap ?? {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, scope, me]);

  // signed-out default to ForYou
  useEffect(() => {
    if (ready && !me && scope === 'following') setScope('foryou');
  }, [ready, me, scope]);

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

  // Live like sync for posts
  useEffect(() => {
    const off = addPostLikeListener(({ postId, liked, delta }) => {
      const k = postLikeKey(postId);
      setPostLikes(prev => {
        const cur = prev[k] ?? { liked: false, count: 0 };
        return { ...prev, [k]: { liked, count: Math.max(0, cur.count + delta) } };
      });
    });
    return off;
  }, []);

  // keep URL in sync + (re)load feed on scope changes / login state ready
  const restoredScrollRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      qs.set('tab', scope);
      const next = `?${qs.toString()}`;
      window.history.replaceState(null, '', next);
    }

    if (!ready) return;

    setFeed(null);
    setFeedErr(null);
    setSel(-1);
    setCursor(null);
    setHasMore(true);

    if (!me && scope === 'following') {
      setFeed([]); // not signed-in: show empty with CTA
      setHasMore(false);
      return;
    }

    const load = async () => {
      try {
        const revs = scope === 'following'
          ? (await fetchFollowingFeed(supabase, me!, { limit: PAGE_SIZE })).data
          : (await fetchForYou(supabase, me, { limit: PAGE_SIZE })).data;

        const postsRows = await fetchPostsForScope(supabase, me, scope, { limit: PAGE_SIZE });

        const merged: FeedItem[] = [
          ...revs.map(r => ({ kind: 'review' as const, created_at: r.created_at, review: r })),
          ...postsRows.map(p => ({ kind: 'post' as const, created_at: p.created_at, post: p })),
        ].sort(sortByCreated);

        setFeed(revs);
        setUnifiedFeed(merged);
        setCursor(revs.length ? revs[revs.length - 1].created_at : null);
        setPostCursor(postsRows.length ? postsRows[postsRows.length - 1].created_at : null);
        setHasMore((revs.length + postsRows.length) >= PAGE_SIZE);
        
        // per-tab scroll restore
        const key = `home:scroll:${scope}`;
        const y = Number(sessionStorage.getItem(key) || '0');
        if (y > 0 && !restoredScrollRef.current) {
          restoredScrollRef.current = true;
          requestAnimationFrame(() => window.scrollTo({ top: y }));
        }
      } catch (e: any) {
        setFeedErr(String(e?.message ?? e));
      }
    };
    restoredScrollRef.current = false;
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
        .filter(r => r.author?.id && r.game_id)
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

  // Preload post likes & comment counts when unified feed changes
  useEffect(() => {
    (async () => {
      const ids = (unifiedFeed ?? [])
        .filter(it => it.kind === 'post')
        .map(it => it.post.id);
      if (!ids.length) { setPostLikes({}); setPostCommentCounts({}); return; }
      const [pl, pc] = await Promise.all([
        fetchPostLikesBulk(supabase, me, ids),
        fetchPostCommentCountsBulk(supabase, ids),
      ]);
      setPostLikes(pl ?? {});
      setPostCommentCounts(pc ?? {});
    })();
  }, [unifiedFeed, me, supabase]);

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
        const map = await fetchLikesBulk(supabase, me!, [{ reviewUserId, gameId }]);
        setLikes((p) => ({ ...p, ...map }));
      }, 120);
    } finally {
      setLikeBusy((p) => ({ ...p, [k]: false }));
    }
  }

  // Toggle like for a post
  async function onTogglePostLike(postId: string) {
    if (!me) { window.location.href = '/login'; return; }
    const k = postLikeKey(postId);
    if (postLikeBusy[k]) return;
    const before = postLikes[k] ?? { liked: false, count: 0 };

    setPostLikes(p => ({ ...p, [k]: { liked: !before.liked, count: before.count + (before.liked ? -1 : 1) } }));
    setPostLikeBusy(p => ({ ...p, [k]: true }));

    try {
      const { liked, count, error } = await togglePostLikeApi(supabase, me, postId);
      if (error) {
        setPostLikes(p => ({ ...p, [k]: before }));
        return;
      }
      setPostLikes(p => ({ ...p, [k]: { liked, count } }));
      broadcastPostLike(postId, liked, liked ? 1 : -1);
    } finally {
      setPostLikeBusy(p => ({ ...p, [k]: false }));
    }
  }

  // Load more (infinite)
  const loadMore = async () => {
    if (!hasMore || loadingMore || (!cursor && !postCursor)) return;
    setLoadingMore(true);
    try {
      const [moreRevs, morePosts] = await Promise.all([
        cursor ? (scope === 'following'
          ? fetchFollowingFeed(supabase, me!, { before: cursor,  limit: PAGE_SIZE })
          : fetchForYou       (supabase, me,  { before: cursor,  limit: PAGE_SIZE })) : { data: [] },
        postCursor ? fetchPostsForScope(supabase, me, scope, { before: postCursor, limit: PAGE_SIZE }) : [],
      ]);

      const next: FeedItem[] = [
        ...(moreRevs.data ?? []).map(r => ({ kind: 'review' as const, created_at: r.created_at, review: r })),
        ...(morePosts ?? []).map(p => ({ kind: 'post' as const, created_at: p.created_at, post: p })),
      ].sort(sortByCreated);

      setFeed(prev => {
        const prevArr = prev ?? [];
        // de-dupe by composite key
        const seen = new Set(prevArr.map(r => `${r.user_id}-${r.game_id}-${r.created_at}`));
        const nextRevs = moreRevs.data.filter(r => !seen.has(`${r.user_id}-${r.game_id}-${r.created_at}`));
        return prevArr.concat(nextRevs);
      });

      setUnifiedFeed(prev => {
        const current = prev ?? [];
        const seen = new Set(
          current.map(it =>
            it.kind === 'post'
              ? `post:${it.post.id}`
              : `rev:${it.review.user_id}:${it.review.game_id}:${it.review.created_at}`
          )
        );
        const merged = [...current];
        for (const it of next) {
          const key =
            it.kind === 'post'
              ? `post:${it.post.id}`
              : `rev:${it.review.user_id}:${it.review.game_id}:${it.review.created_at}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(it);
          }
        }
        return merged.sort(sortByCreated);
      });
      
      if (moreRevs.data?.length)  setCursor (moreRevs.data.at(-1)!.created_at);
      if (morePosts.length)       setPostCursor(morePosts.at(-1)!.created_at);

      setHasMore((moreRevs.data?.length ?? 0) + (morePosts.length ?? 0) >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  // intersection observer for infinite scroll
  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '800px 0px 800px 0px', threshold: 0 }
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaderRef.current, cursor, postCursor, hasMore, loadingMore, scope]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!unifiedFeed?.length) return;
      // ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(unifiedFeed.length - 1, Math.max(0, sel + 1));
        setSel(next);
        focusRow(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, (sel === -1 ? 0 : sel - 1));
        setSel(prev);
        focusRow(prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = unifiedFeed[Math.max(0, sel)];
        if (item?.kind === 'review' && item.review?.author?.id && item.review?.game_id) {
          openContext(item.review.author.id, item.review.game_id);
        } else if (item?.kind === 'post') {
          openPostContext(item.post.id);
        }
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const item = unifiedFeed[Math.max(0, sel)];
        if (item?.kind === 'review' && item.review?.author?.id && item.review?.game_id) {
          onToggleLike(item.review.author.id, item.review.game_id);
        }
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const item = unifiedFeed[Math.max(0, sel)];
        if (item?.kind === 'review' && item.review?.author?.id && item.review?.game_id) {
          openContext(item.review.author.id, item.review.game_id);
        } else if (item?.kind === 'post') {
          openPostContext(item.post.id, { focusInput: true });
        }
      }
    };
    const focusRow = (i: number) => {
      const el = document.getElementById(`feed-row-${i}`);
      if (el) {
        (el as HTMLElement).focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unifiedFeed, sel, openContext, openPostContext]); // eslint-disable-line

  // remember scroll per tab when switching away
  const switchScope = (next: Scope) => {
    if (next === scope) return;
    try {
      sessionStorage.setItem(`home:scroll:${scope}`, String(window.scrollY || 0));
    } catch {}
    setScope(next);
  };

  // mark completed (right rail)
  async function markCompleted(gameId: number) {
    if (!me) { window.location.href = '/login'; return; }
    await supabase
      .from('library')
      .update({ status: 'Completed' })
      .eq('user_id', me)
      .eq('game_id', gameId);
    setContinueList(list => (list ?? []).filter(r => r.game?.id !== gameId));
  }

  // ---------- UI ----------
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* CENTER */}
        <section>
          {/* Title */}
          <h1 className="text-2xl font-bold mb-3">Home</h1>

          {/* Segmented tabs – full width, short underline */}
          <nav
            className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1 mb-4 sticky top-12 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/30"
            role="tablist"
            aria-label="Feed tabs"
          >
            {([
              { key: 'following', label: 'Following' },
              { key: 'foryou', label: 'For You' },
            ] as {key: Scope, label: string}[]).map(t => {
              const active = scope === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => switchScope(t.key)}
                  aria-pressed={active}
                  aria-current={active ? 'page' : undefined}
                  className={`relative w-full px-3 py-2 text-sm rounded transition-colors
                    ${active ? 'text-white' : 'text-white/70 hover:text-white'}`}
                >
                  <span className="font-medium">{t.label}</span>
                  {active && (
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[2px] block h-[2px] w-12 bg-white/70 rounded" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Composer (temporary lightweight) */}
          <QuickComposer
            onPosted={(row) => {
              setPosts(prev => [row, ...(prev ?? [])]);
              setUnifiedFeed(prev => [{ kind: 'post', created_at: row.created_at, post: row }, ...(prev ?? [])]);

              // seed local UI maps
              setPostLikes(m => ({ ...m, [postLikeKey(row.id)]: { liked: false, count: 0 } }));
              setPostCommentCounts(m => ({ ...m, [postCKey(row.id)]: 0 }));
            }}
          />

          {!ready ? (
            <FeedSkeleton />
          ) : !me && scope === 'following' ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Sign in to see reviews from people you follow. In the meantime,
                check <Link className="underline" href="/discover">Discover</Link>.
              </p>
            </div>
          ) : feedErr ? (
            <p className="text-red-400">{feedErr}</p>
          ) : unifiedFeed == null ? (
            <FeedSkeleton />
          ) : unifiedFeed.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Nothing here yet. Try <Link className="underline" href="/discover">Discover</Link> or follow more players.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-white/10 rounded-lg border border-white/10 overflow-hidden">
                {unifiedFeed?.map((it, i) => {
                  if (it.kind === 'review') {
                    const r = it.review;
                    const a = r.author;
                    const g = r.game;
                    const stars = Number((r.rating / 20).toFixed(1));
                    const actorHref = a?.username ? `/u/${a.username}` : '#';
                    const gameHref = g ? `/game/${g.id}` : '#';
                    const cKey = a?.id ? commentKey(a.id, r.game_id) : '';
                    const likeK = a?.id ? likeKey(a.id, r.game_id) : '';

                    return (
                      <li
                        id={`feed-row-${i}`}
                        key={`rev-${r.user_id}-${r.game_id}-${r.created_at}-${i}`}
                        className="group px-3 md:px-4 py-3 hover:bg-white/5 focus-within:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ring-inset"
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
                        aria-label={`${a?.display_name || a?.username || 'Player'} rated ${g?.name || 'a game'}`}
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
                                <span className="text-xs tabular-nums">{stars} / 5</span>
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
                          {a?.id && (
                            <span className="pointer-events-auto" data-ignore-context>
                              <LikePill
                                liked={(likes[likeK]?.liked) ?? false}
                                count={(likes[likeK]?.count) ?? 0}
                                busy={!!likeBusy[likeK]}
                                onClick={() => onToggleLike(a.id!, r.game_id)}
                              />
                            </span>
                          )}

                          {a?.id && (
                            <span className="pointer-events-auto" data-ignore-context>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openContext(a!.id, r.game_id);
                                }}
                                className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                                title="View comments"
                                aria-label="View comments"
                              >
                                💬 <span className="tabular-nums">{commentCounts[cKey] ?? 0}</span>
                              </button>
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  } else {
                    const p = it.post;
                    const actorHref = p.username ? `/u/${p.username}` : '#';
                    const gameHref = p.game_id ? `/game/${p.game_id}` : '#';
                    const likeK = postLikeKey(p.id);
                    const entry = postLikes[likeK] ?? { liked: false, count: (p.like_count || 0) };
                    const cKey = postCKey(p.id);
                    const cCount = postCommentCounts[cKey] ?? (p.comment_count || 0);

                    return (
                      <li
                        key={`post-${p.id}`}
                        id={`feed-row-${i}`}
                        className="group px-3 md:px-4 py-3 hover:bg-white/5 focus-within:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ring-inset"
                        tabIndex={0}
                        role="button"
                        aria-label={`${p.display_name || p.username || 'Player'} posted${p.game_name ? ` about ${p.game_name}` : ''}`}
                        onClick={() => openPostContext(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openPostContext(p.id);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* avatar */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.avatar_url || '/avatar-placeholder.svg'}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="min-w-0">
                            <div className="text-sm text-white/90">
                              <Link href={actorHref} className="font-medium hover:underline">
                                {p.display_name || p.username || 'Player'}
                              </Link>{' '}
                              posted
                              {p.game_id ? (
                                <>
                                  {' about '}
                                  <Link href={gameHref} className="font-medium hover:underline">{p.game_name}</Link>
                                </>
                              ) : null}
                            </div>
                            <div className="text-xs text-white/40">{timeAgo(p.created_at)}</div>
                          </div>

                          {p.game_cover_url && (
                            <Link href={gameHref} className="ml-auto shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.game_cover_url}
                                alt=""
                                className="h-12 w-9 rounded object-cover border border-white/10"
                                loading="lazy"
                                decoding="async"
                              />
                            </Link>
                          )}
                        </div>

                        {p.body?.trim() && (
                          <p className="mt-2 whitespace-pre-wrap text-white/85">{p.body.trim()}</p>
                        )}

                        {/* actions */}
                        <div className="mt-2 flex items-center gap-2">
                          <LikePill
                            liked={entry.liked}
                            count={entry.count}
                            busy={postLikeBusy[likeK]}
                            onClick={() => onTogglePostLike(p.id)}
                          />
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                            title="Comments"
                            aria-label="Comments"
                            onClick={(e) => { e.stopPropagation(); openPostContext(p.id, { focusInput: true }); }}
                          >
                            💬 {cCount}
                          </button>
                        </div>
                      </li>
                    );
                  }
                })}
              </ul>

              {/* infinite loader row */}
              <div ref={loaderRef} className="py-4 flex items-center justify-center">
                {loadingMore ? <Dots /> : hasMore ? <span className="text-xs text-white/40">Loading more…</span> : <span className="text-xs text-white/30">You're up to date</span>}
              </div>
            </>
          )}

          {/* mount context modal once */}
          {contextModal}
          {postContextModal}


        </section>

        {/* RIGHT RAIL */}
        <aside className="space-y-6 lg:sticky lg:top-16">
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
              <TilesSkeleton />
            ) : continueList.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No games yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {continueList.map((r, i) => (
                  <li key={`${r.game?.id}-${i}`} className="relative group">
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

                    {/* quick action */}
                    {r.game?.id && (
                      <button
                        onClick={(e) => { e.preventDefault(); markCompleted(r.game!.id); }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-black/50 hover:bg-black/60"
                        title="Mark completed"
                        aria-label="Mark completed"
                      >
                        ✓ Done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Who to follow */}
          <Panel title="Who to follow">
            {whoToFollow == null ? (
              <ListSkeleton rows={3} />
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
              <TilesSkeleton />
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
function QuickComposer({ onPosted }: { onPosted?: (row: PostRow) => void }) {
  const sb = supabaseBrowser();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function handlePost() {
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      const session = await waitForSession(sb);
      const uid = session?.user?.id;
      if (!uid) { window.location.href = '/login'; return; }

      // Insert (let DB generate id/created_at)
      const { data: inserted, error: insErr } = await sb
        .from('posts')
        .insert({ user_id: uid, body: body.trim(), tags: [], game_id: null })
        .select('id')
        .single();

      if (insErr || !inserted?.id) {
        console.error('post insert failed', insErr);
        alert('Failed to post. Please try again.');
        return;
      }

      // Read the hydrated row from the view so counts/user/game fields are present
      let full: PostRow | undefined;

      // 1st try: v2
      let res = await sb
        .from(POSTS_VIEW) // 'post_feed_v2'
        .select('id, user_id, created_at, body, tags, like_count, comment_count, username, display_name, avatar_url, game_id, game_name, game_cover_url')
        .eq('id', inserted.id)
        .maybeSingle();

      if (res.error || !res.data) {
        // fallback: legacy view
        res = await sb
          .from('post_feed')
          .select('id, user_id, created_at, body, tags, like_count, comment_count, username, display_name, avatar_url, game_id, game_name, game_cover_url')
          .eq('id', inserted.id)
          .maybeSingle();
      }

      full = res.data as PostRow | undefined;

      if (full) {
        onPosted?.(full);
        setBody('');
      } else {
        alert('Posted, but could not fetch the hydrated row.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
      <textarea
        value={body}
        onChange={(e)=>setBody(e.target.value)}
        placeholder="Share a thought, clip link, or screenshot URL…"
        rows={3}
        className="w-full border border-white/10 bg-black/20 text-white rounded px-3 py-2"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={busy || body.trim().length === 0}
          onClick={handlePost}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}

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

function Dots() {
  return (
    <span className="inline-flex items-center gap-1 text-white/60">
      <span className="animate-pulse">•</span>
      <span className="animate-pulse [animation-delay:.15s]">•</span>
      <span className="animate-pulse [animation-delay:.3s]">•</span>
    </span>
  );
}

// ---------- skeletons ----------
function FeedSkeleton() {
  return (
    <ul className="divide-y divide-white/10 rounded-lg border border-white/10 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/10" />
            <div className="flex-1 min-w-0">
              <div className="h-3 w-1/3 bg-white/10 rounded" />
              <div className="h-3 w-1/5 bg-white/10 rounded mt-2" />
            </div>
            <div className="h-12 w-9 rounded bg-white/10" />
          </div>
          <div className="h-3 w-2/3 bg-white/10 rounded mt-3" />
        </li>
      ))}
    </ul>
  );
}
function TilesSkeleton() {
  return (
    <ul className="p-2 grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <div className="h-24 w-full rounded bg-white/10" />
          <div className="mt-1 h-3 w-5/6 bg-white/10 rounded" />
        </li>
      ))}
    </ul>
  );
}
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="p-2 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/10" />
          <div className="flex-1 min-w-0">
            <div className="h-3 w-1/2 bg-white/10 rounded" />
            <div className="h-3 w-1/3 bg-white/10 rounded mt-1" />
          </div>
          <div className="h-6 w-14 rounded bg-white/10" />
        </li>
      ))}
    </ul>
  );
}

// ---------- fetchers ----------
async function fetchFollowingFeed(
  sb: ReturnType<typeof supabaseBrowser>,
  uid: string,
  opts?: { before?: string | null; limit?: number }
) {
  const limit = opts?.limit ?? 40;

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
    .limit(limit);

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));
  if (opts?.before) q = q.lt('created_at', opts.before);

  const { data, error } = await q;
  if (error) throw error;

  // final safety pass
  const safe = normalizeReviews(data).filter(r => {
    const aid = r.author?.id;
    return !(aid && (hidden.has(aid) || mutedIds.includes(aid)));
  });

  return { data: safe };
}

/** “For You”: recent reviews with small bonuses. */
async function fetchForYou(
  sb: ReturnType<typeof supabaseBrowser>,
  uid: string | null,
  opts?: { before?: string | null; limit?: number }
) {
  const limit = opts?.limit ?? 60;

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
    .limit(limit);

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));
  if (opts?.before) q = q.lt('created_at', opts.before);

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

  return { data: scored.map(x => x.r) };
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

async function fetchTrending(): Promise<{id:number; name:string; cover_url:string|null}[]> {
  // Temporary: don't call the API to silence 500s
  return [];
}

async function fetchPostsForScope(
  sb: ReturnType<typeof supabaseBrowser>,
  uid: string | null,
  scope: 'following' | 'foryou',
  opts?: { before?: string | null; limit?: number }
): Promise<PostRow[]> {
  const limit = opts?.limit ?? 40;

  const since = new Date();
  since.setDate(since.getDate() - 14);

  let hidden = new Set<string>();
  let mutedIds: string[] = [];
  let followingIds: string[] = [];

  if (uid) {
    const { iBlocked, blockedMe, iMuted } = await getBlockSets(sb, uid);
    hidden = new Set([...iBlocked, ...blockedMe].map(String));
    mutedIds = Array.from(iMuted ?? new Set<string>()).map(String);
    if (scope === 'following') {
      const fl = await sb.from('follows').select('followee_id').eq('follower_id', uid).limit(1000);
      followingIds = (fl.data ?? []).map((r: any) => String(r.followee_id)).filter(id => !hidden.has(id));
      if (!followingIds.length) return [];
    }
  }

  const rows = await selectPostsWithFallback(
    sb,
    (q) => {
      if (scope === 'following') q = q.in('user_id', followingIds);
      else q = q.gte('created_at', since.toISOString());
      if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));
      if (opts?.before) q = q.lt('created_at', opts.before);
      return q;
    },
    limit
  );

  // final safety-pass
  return rows.filter(r => !hidden.has(String(r.user_id)));
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