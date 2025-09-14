'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import StarRating from '@/components/StarRating';
import { useUnifiedContextModal } from '@/components/ContextModal/useUnifiedContextModal';
import { onRowClick, onRowKeyDown } from '@/lib/safeOpenContext';
import InteractionButton from '@/components/InteractionButton';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton, PostCardSkeleton, SidebarSkeleton } from '@/components/common/Skeleton';

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
const POST_COLS = 'id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

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
  media_urls?: string[] | null;
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

  // unified context modal
  const { openReview, openPost, modal: contextModal } = useUnifiedContextModal(
    supabase,
    me ?? null,
    async () => {
      // refresh comment counts when modal closes
      if (posts) {
        const ids = posts.map(p => String(p.id));
        const map = await fetchPostCommentCountsBulk(supabase, ids);
        setPostCommentCounts(prev => ({ ...prev, ...map }));
      }
    }
  );

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
  const [postMedia, setPostMedia] = useState<Record<string, { url: string; media_type: 'image' | 'video' }[]>>({});

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

          // fetch media for these posts
          if (ids.length) {
            const med = await fetchPostMediaBulk(supabase, ids);
            setPostMedia(med);
          }
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
    // Open post by deep link (?postId=)
    try {
      if (typeof window !== 'undefined') {
        const postId = new URLSearchParams(window.location.search).get('postId');
        if (postId) {
          openPost(postId);
        }
      }
    } catch {}
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

        // Debug logging
        console.log(`[HomeClient] ${scope} feed loaded:`, {
          reviews: revs.length,
          posts: postsRows.length,
          userId: me,
          scope
        });

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
          openReview(item.review.author.id, item.review.game_id);
        } else if (item?.kind === 'post') {
          openPost(item.post.id);
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
          openReview(item.review.author.id, item.review.game_id);
        } else if (item?.kind === 'post') {
          openPost(item.post.id, { focusInput: true });
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
  }, [unifiedFeed, sel, openReview, openPost]); // eslint-disable-line

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
    <main className="mx-auto max-w-[1240px] px-4 py-6 lg:px-6 lg:py-8">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
        {/* CENTER */}
        <section className="min-w-0 space-y-6">
          {/* Hero Section - Brief welcome, not main attraction */}
          <section className="relative rounded-xl overflow-hidden">
            <div className="bg-midnight-nova p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-spark"></span>
                  <span className="text-sm text-white/90 font-medium">Your gaming feed</span>
                </div>
                <div className="text-xs text-white/60">
                  {scope === 'following' ? 'From people you follow' : 'Personalized for you'}
                </div>
              </div>
            </div>
          </section>

          {/* Segmented tabs - Primary navigation */}
          <div className="flex justify-center">
            <Segmented
              options={[
                { value: 'following', label: 'Following' },
                { value: 'foryou', label: 'For You' },
              ]}
              value={scope}
              onValueChange={(value) => switchScope(value as Scope)}
              size="lg"
            />
          </div>

          {/* Composer (temporary lightweight) */}
          <QuickComposer
            onPosted={(row) => {
              setPosts(prev => [row, ...(prev ?? [])]);
              setUnifiedFeed(prev => [{ kind: 'post', created_at: row.created_at, post: row }, ...(prev ?? [])]);

              // seed local UI maps
              setPostLikes(m => ({ ...m, [postLikeKey(row.id)]: { liked: false, count: 0 } }));
              setPostCommentCounts(m => ({ ...m, [postCKey(row.id)]: 0 }));

              // fetch media for this new post so it appears immediately
              (async () => {
                const med = await fetchPostMediaBulk(supabase, [row.id]);
                setPostMedia(prev => ({ ...prev, ...med }));
              })();
            }}
          />

          {!ready ? (
            <div className="space-y-6">
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : !me && scope === 'following' ? (
            <Card className="text-center py-16">
              <div className="space-y-4">
                <div className="text-3xl">👋</div>
                <h3 className="text-lg font-semibold text-[rgb(var(--txt))]">Sign in to see Following</h3>
                <p className="text-[rgb(var(--txt-muted))] max-w-sm mx-auto text-sm">
                  View reviews from people you follow. Check out trending games in the meantime.
                </p>
                <Link 
                  href="/discover" 
                  className="btn btn--primary btn-md"
                >
                  Discover Games
                </Link>
              </div>
            </Card>
          ) : feedErr ? (
            <Card className="text-center py-12">
              <div className="text-[rgb(var(--danger))]">
                <div className="text-2xl mb-3">⚠️</div>
                <p className="font-medium mb-1">Something went wrong</p>
                <p className="text-sm text-[rgb(var(--txt-muted))]">{feedErr}</p>
              </div>
            </Card>
          ) : unifiedFeed == null ? (
            <div className="space-y-6">
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : unifiedFeed.length === 0 ? (
            <Card className="text-center py-16">
              <div className="space-y-4">
                <div className="text-3xl">🎮</div>
                <h3 className="text-lg font-semibold text-[rgb(var(--txt))]">No content yet</h3>
                <p className="text-[rgb(var(--txt-muted))] max-w-sm mx-auto text-sm">
                  Follow more players or discover trending games to see content here.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link 
                    href="/discover" 
                    className="btn btn--primary btn-md"
                  >
                    Discover Games
                  </Link>
                  <Link 
                    href="/search" 
                    className="btn btn--neutral btn-md"
                  >
                    Find Players
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="space-y-6">
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
                      <Card
                        key={`rev-${r.user_id}-${r.game_id}-${r.created_at}-${i}`}
                        id={`feed-row-${i}`}
                        interactive
                        className="group cursor-pointer"
                        onClick={(e) =>
                          onRowClick(e, () => {
                            if (a?.id) openReview(a.id, r.game_id);
                          })
                        }
                        onKeyDown={(e) =>
                          onRowKeyDown(e, () => {
                            if (a?.id) openReview(a.id, r.game_id);
                          })
                        }
                        tabIndex={0}
                        role="button"
                        aria-label={`${a?.display_name || a?.username || 'Player'} rated ${g?.name || 'a game'}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <Link
                            href={actorHref}
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a?.avatar_url || '/avatar-placeholder.svg'}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover border border-[rgb(var(--border))]"
                              loading="lazy"
                              decoding="async"
                            />
                          </Link>

                          <div className="min-w-0 flex-1">
                            {/* Header Row - Single scan line */}
                            <div className="flex items-center gap-2 mb-2">
                              <Link
                                href={actorHref}
                                className="font-semibold text-[rgb(var(--txt))] hover:text-[rgb(var(--brand-accent))] transition-colors text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {a?.display_name || a?.username || 'Player'}
                              </Link>
                              <span className="text-[rgb(var(--txt-muted))] text-sm">rated</span>
                              <Link
                                href={gameHref}
                                className="font-semibold text-[rgb(var(--txt))] hover:text-[rgb(var(--brand-accent))] transition-colors text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {g?.name ?? 'a game'}
                              </Link>
                              <span className="text-[rgb(var(--txt-subtle))]">·</span>
                              <span className="text-xs text-[rgb(var(--txt-subtle))]">{timeAgo(r.created_at)}</span>
                            </div>

                            {/* Rating Display - Inline and clean */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgb(var(--bg-elev))]">
                                <StarRating value={stars} readOnly size={14} />
                                <span className="text-sm font-medium text-[rgb(var(--txt))]">{stars}/5</span>
                              </div>
                              <div className="text-xs px-2 py-1 rounded-md bg-[rgb(var(--brand-accent))] text-white">
                                Review
                              </div>
                            </div>

                            {/* Review Text */}
                            {r.review?.trim() && (
                              <div className="mb-4">
                                <p className="text-[rgb(var(--txt))] whitespace-pre-wrap leading-relaxed text-sm">
                                  {r.review.trim()}
                                </p>
                              </div>
                            )}

                            {/* Actions - Better spacing and consistency */}
                            <div className="flex items-center gap-2">
                              {a?.id && (
                                <InteractionButton
                                  type="like"
                                  count={(likes[likeK]?.count) ?? 0}
                                  active={(likes[likeK]?.liked) ?? false}
                                  busy={!!likeBusy[likeK]}
                                  onClick={() => onToggleLike(a.id!, r.game_id)}
                                  size="sm"
                                />
                              )}

                              {a?.id && (
                                <InteractionButton
                                  type="comment"
                                  count={commentCounts[cKey] ?? 0}
                                  onClick={() => openReview(a!.id, r.game_id)}
                                  size="sm"
                                />
                              )}
                            </div>
                          </div>

                          {/* Game Cover - Slightly larger */}
                          {g?.cover_url && (
                            <Link
                              href={gameHref}
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={g.cover_url}
                                alt=""
                                className="h-24 w-16 rounded-lg object-cover border border-[rgb(var(--border))]"
                                loading="lazy"
                                decoding="async"
                              />
                            </Link>
                          )}
                        </div>
                      </Card>
                    );
                  } else {
                    const p = it.post;
                    const media = (p.media_urls && p.media_urls.length)
                      ? p.media_urls.map(u => ({ url: /^https?:\/\//i.test(u) ? u : supabase.storage.from('post-media').getPublicUrl(u).data.publicUrl, media_type: u.match(/\.(mp4|mov|webm|mkv)$/i) ? 'video' : 'image' }))
                      : (postMedia[p.id] ?? []);
                    const actorHref = p.username ? `/u/${p.username}` : '#';
                    const gameHref = p.game_id ? `/game/${p.game_id}` : '#';
                    const likeK = postLikeKey(p.id);
                    const entry = postLikes[likeK] ?? { liked: false, count: (p.like_count || 0) };
                    const cKey = postCKey(p.id);
                    const cCount = postCommentCounts[cKey] ?? (p.comment_count || 0);
                    const isOwner = me && p.user_id && me === p.user_id;
                    const copyLink = async () => {
                      try {
                        const base = typeof window !== 'undefined' ? window.location.origin : '';
                        const url = `${base}/u/${p.username ?? ''}?postId=${encodeURIComponent(p.id)}`;
                        await navigator.clipboard.writeText(url);
                      } catch {}
                    };
                    const shareLink = async () => {
                      try {
                        const base = typeof window !== 'undefined' ? window.location.origin : '';
                        const url = `${base}/u/${p.username ?? ''}?postId=${encodeURIComponent(p.id)}`;
                        if (navigator.share) await navigator.share({ title: p.game_name ?? 'Post', url, text: p.body ?? undefined });
                        else await navigator.clipboard.writeText(url);
                      } catch {}
                    };
                    const deletePost = async (e?: React.MouseEvent) => {
                      e?.stopPropagation();
                      if (!me || !isOwner) return;
                      await supabase
                        .from('posts')
                        .delete()
                        .eq('id', p.id)
                        .eq('user_id', me);
                      setUnifiedFeed(prev => (prev ?? []).filter(it => !(it.kind === 'post' && it.post.id === p.id)));
                      setPosts(prev => (prev ?? []).filter(row => row.id !== p.id));
                    };

                    return (
                      <Card
                        key={`post-${p.id}`}
                        id={`feed-row-${i}`}
                        interactive
                        className="group cursor-pointer"
                        tabIndex={0}
                        role="button"
                        aria-label={`${p.display_name || p.username || 'Player'} posted${p.game_name ? ` about ${p.game_name}` : ''}`}
                        onClick={() => openPost(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openPost(p.id);
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <Link
                            href={actorHref}
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.avatar_url || '/avatar-placeholder.svg'}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover border border-[rgb(var(--border))]"
                              loading="lazy"
                              decoding="async"
                            />
                          </Link>

                          <div className="min-w-0 flex-1">
                            {/* Header Row - Single scan line */}
                            <div className="flex items-center gap-2 mb-2">
                              <Link
                                href={actorHref}
                                className="font-semibold text-[rgb(var(--txt))] hover:text-[rgb(var(--brand-accent))] transition-colors text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {p.display_name || p.username || 'Player'}
                              </Link>
                              <span className="text-[rgb(var(--txt-muted))] text-sm">posted</span>
                              {p.game_id && (
                                <>
                                  <span className="text-[rgb(var(--txt-muted))] text-sm">about</span>
                                  <Link
                                    href={gameHref}
                                    className="font-semibold text-[rgb(var(--txt))] hover:text-[rgb(var(--brand-accent))] transition-colors text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {p.game_name}
                                  </Link>
                                </>
                              )}
                              <span className="text-[rgb(var(--txt-subtle))]">·</span>
                              <span className="text-xs text-[rgb(var(--txt-subtle))]">{timeAgo(p.created_at)}</span>
                              <div className="ml-auto relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); const el = (e.currentTarget.nextSibling as HTMLElement | null); if (el) el.classList.toggle('hidden'); }}
                                  className="icon-btn btn btn--ghost text-[rgb(var(--txt-muted))] hover:text-[rgb(var(--txt))]"
                                  aria-label="More actions"
                                  aria-expanded="false"
                                  aria-haspopup="menu"
                                  type="button"
                                >
                                  ⋯
                                </button>
                                <div className="hidden absolute right-0 mt-2 w-44 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] shadow-[var(--shadow-md)] z-[60]" role="menu" onClick={(e)=>e.stopPropagation()}>
                                  {isOwner ? (
                                    <button onClick={(e)=>{ if (!confirm('Delete this post?')) return; (e.currentTarget.parentElement as HTMLElement).classList.add('hidden'); deletePost(e); }} className="block w-full text-left px-3 py-2 text-[rgb(var(--danger))] hover:bg-[rgb(var(--hover))] rounded-t-lg" role="menuitem">Delete</button>
                                  ) : null}
                                  <button onClick={(e)=>{ (e.currentTarget.parentElement as HTMLElement).classList.add('hidden'); copyLink(); }} className={`block w-full text-left px-3 py-2 hover:bg-[rgb(var(--hover))] ${isOwner ? '' : 'rounded-t-lg'}`} role="menuitem">Copy link</button>
                                  <button onClick={(e)=>{ (e.currentTarget.parentElement as HTMLElement).classList.add('hidden'); shareLink(); }} className="block w-full text-left px-3 py-2 hover:bg-[rgb(var(--hover))] rounded-b-lg" role="menuitem">Share</button>
                                </div>
                              </div>
                            </div>

                            {/* Content Type Badge - Inline */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="text-xs px-2 py-1 rounded-md bg-[rgb(var(--brand-accent))] text-white">
                                Post
                              </div>
                            </div>

                            {/* Post Content */}
                            {p.body?.trim() && (
                              <div className="mb-4">
                                <p className="text-[rgb(var(--txt))] whitespace-pre-wrap leading-relaxed text-sm">
                                  {p.body.trim()}
                                </p>
                              </div>
                            )}

                            {/* Media - Better grid layout */}
                            {media.length > 0 && (
                              <div className="mb-4 grid grid-cols-2 gap-3">
                                {media.slice(0,4).map((m, idx) => (
                                  m.media_type === 'video' ? (
                                    <video key={idx} controls className="w-full rounded-lg border border-[rgb(var(--border))]">
                                      <source src={m.url} />
                                    </video>
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={idx} src={m.url} alt="" className="w-full rounded-lg object-cover border border-[rgb(var(--border))]" />
                                  )
                                ))}
                              </div>
                            )}

                            {/* Actions - Better spacing and consistency */}
                            <div className="flex items-center gap-2">
                              <InteractionButton
                                type="like"
                                count={entry.count}
                                active={entry.liked}
                                busy={postLikeBusy[likeK]}
                                onClick={() => onTogglePostLike(p.id)}
                                size="sm"
                              />
                              <InteractionButton
                                type="comment"
                                count={cCount}
                                onClick={() => openPost(p.id, { focusInput: true })}
                                size="sm"
                              />
                            </div>
                          </div>

                          {/* Game Cover - Slightly larger */}
                          {p.game_cover_url && (
                            <Link
                              href={gameHref}
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.game_cover_url}
                                alt=""
                                className="h-24 w-16 rounded-lg object-cover border border-[rgb(var(--border))]"
                                loading="lazy"
                                decoding="async"
                              />
                            </Link>
                          )}
                        </div>
                      </Card>
                    );
                  }
                })}
              </div>

              {/* infinite loader row */}
              <div ref={loaderRef} className="py-4 flex items-center justify-center">
                {loadingMore ? <Dots /> : hasMore ? <span className="text-xs text-white/40">Loading more…</span> : <span className="text-xs text-white/30">You're up to date</span>}
              </div>
            </>
          )}

          {/* mount unified context modal */}
          {contextModal}


        </section>

        {/* RIGHT RAIL - Weighted down, supportive */}
        <aside className="space-y-4 lg:sticky lg:top-16">
          {/* Continue playing */}
          <Panel title="Continue playing" rightAction={
            me ? (
              <Link
                href={myUsername ? `/u/${myUsername}/library?status=playing` : '/login'}
                className="text-xs text-[rgb(var(--txt-subtle))] hover:text-[rgb(var(--txt-muted))] transition-colors"
              >
                See all
              </Link>
            ) : null
          }>
            {!me ? (
              <div className="p-3 text-xs text-[rgb(var(--txt-subtle))]">Sign in to see your library.</div>
            ) : continueList == null ? (
              <TilesSkeleton />
            ) : continueList.length === 0 ? (
              <div className="p-3 text-xs text-[rgb(var(--txt-subtle))]">No games yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {continueList.map((r, i) => (
                  <li key={`${r.game?.id}-${i}`} className="relative group">
                    <Link href={r.game ? `/game/${r.game.id}` : '#'} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.game?.cover_url || '/cover-fallback.png'}
                        alt={r.game?.name || ''}
                        className="h-16 w-full rounded object-cover border border-[rgb(var(--border-subtle))]"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[10px] text-[rgb(var(--txt-muted))] truncate">{r.game?.name}</div>
                      <div className="text-[9px] text-[rgb(var(--txt-subtle))]">
                        {r.status} · {timeAgo(r.updated_at)}
                      </div>
                    </Link>

                    {/* quick action */}
                    {r.game?.id && (
                      <button
                        onClick={(e) => { e.preventDefault(); markCompleted(r.game!.id); }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition text-[9px] px-1.5 py-0.5 rounded border border-[rgb(var(--border-subtle))] bg-[rgb(var(--bg-elev))] hover:bg-[rgb(var(--hover))] text-[rgb(var(--txt-muted))]"
                        title="Mark completed"
                        aria-label="Mark completed"
                      >
                        ✓
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
              <div className="p-3 text-xs text-[rgb(var(--txt-subtle))]">No suggestions right now.</div>
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
                        className="h-6 w-6 rounded-full object-cover border border-[rgb(var(--border-subtle))]"
                        loading="lazy"
                        decoding="async"
                      />
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="text-xs text-[rgb(var(--txt-muted))] truncate font-medium">
                          {u.display_name || u.username || 'Player'}
                        </div>
                        {u.username && (
                          <div className="text-[10px] text-[rgb(var(--txt-subtle))] truncate">@{u.username}</div>
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
              <Link href="/discover" className="text-xs text-[rgb(var(--txt-subtle))] hover:text-[rgb(var(--txt-muted))] transition-colors">
                Discover
              </Link>
            }
          >
            {trending == null ? (
              <TilesSkeleton />
            ) : trending.length === 0 ? (
              <div className="p-3 text-xs text-[rgb(var(--txt-subtle))]">Nothing yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {trending.map((g) => (
                  <li key={g.id}>
                    <Link href={`/game/${g.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.cover_url || '/cover-fallback.png'}
                        alt={g.name}
                        className="h-16 w-full rounded object-cover border border-[rgb(var(--border-subtle))]"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[10px] text-[rgb(var(--txt-muted))] truncate">{g.name}</div>
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
  const [files, setFiles] = useState<File[]>([]);

  async function handlePost() {
    if (busy || (body.trim().length === 0 && files.length === 0)) return;
    setBusy(true);
    try {
      const session = await waitForSession(sb);
      const uid = session?.user?.id;
      if (!uid) { window.location.href = '/login'; return; }

      // Generate a post id client-side to tie uploads and row
      const postId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Upload any selected media first and collect storage paths
      let mediaPaths: string[] = [];
      if (files.length) {
        for (const file of files) {
          const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
          const path = `${uid}/${postId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const up = await sb.storage.from('post-media').upload(path, file, { upsert: true, contentType: file.type || undefined });
          if (up.error) {
            console.warn('media upload failed', up.error);
            continue;
          }
          mediaPaths.push(path);
        }
      }

      // Insert the post with our generated id and media_urls
      const { data: inserted, error: insErr } = await sb
        .from('posts')
        .insert({ id: postId, user_id: uid, body: body.trim().length ? body.trim() : null, tags: [], game_id: null, media_urls: mediaPaths.length ? mediaPaths : null })
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
        setFiles([]);
      } else {
        alert('Posted, but could not fetch the hydrated row.');
      }
    } finally {
      setBusy(false);
    }
  }

  const canPost = body.trim().length > 0 || files.length > 0;

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] p-3">
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e)=>setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={2}
          className="w-full resize-none border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--txt))] rounded-md px-3 py-2 text-sm placeholder:text-[rgb(var(--txt-muted))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand-accent))] focus:border-transparent"
        />
        
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.slice(0,4).map((f, i) => (
              <div key={i} className="inline-flex items-center gap-1 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-xs text-[rgb(var(--txt-muted))]">
                <span className="text-xs">
                  {f.type.startsWith('image') ? '🖼️' : f.type.startsWith('video') ? '🎬' : '📎'}
                </span>
                <span className="truncate max-w-16">{f.name}</span>
                <button
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-[rgb(var(--txt-muted))] hover:text-[rgb(var(--txt))] ml-1"
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <label className="btn btn--ghost btn-sm cursor-pointer">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e)=>setFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
            <span className="text-xs">Add media</span>
          </label>
          
          <button
            type="button"
            disabled={busy || !canPost}
            onClick={handlePost}
            className={`btn btn-sm ${canPost ? 'btn--primary' : 'btn--ghost'}`}
            aria-busy={busy}
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
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
    <div className="rounded-lg border border-[rgb(var(--border-subtle))] bg-[rgb(var(--bg-elev))]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--border-subtle))]">
        <h2 className="text-xs font-medium text-[rgb(var(--txt-muted))]">{title}</h2>
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
      className={`btn btn-sm ${done ? 'btn--neutral' : 'btn--accent'}`}
      aria-busy={busy}
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

/** "For You": personalized feed with reviews and posts. */
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

  // Get user's game preferences from their library
  let userGameIds = new Set<number>();
  if (uid) {
    const { data: library } = await sb
      .from('library')
      .select('game_id')
      .eq('user_id', uid)
      .limit(100);
    if (library) {
      library.forEach((l: any) => userGameIds.add(Number(l.game_id)));
    }
  }

  // Get user's review history for preference analysis
  let userReviewedGames = new Set<number>();
  if (uid) {
    const { data: userReviews } = await sb
      .from('reviews')
      .select('game_id, rating')
      .eq('user_id', uid)
      .limit(100);
    if (userReviews) {
      userReviews.forEach((r: any) => userReviewedGames.add(Number(r.game_id)));
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 30); // Extended to 30 days for more content

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
    .limit(limit * 2); // Fetch more to allow for better filtering

  if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));
  if (opts?.before) q = q.lt('created_at', opts.before);

  const { data, error } = await q;
  if (error) throw error;

  const rows = normalizeReviews(data).filter(r => {
    const aid = r.author?.id;
    return !(aid && (hidden.has(aid) || mutedIds.includes(aid)));
  });

  // Enhanced scoring algorithm
  const scored = rows.map(r => {
    const ageHrs = Math.max(1, (Date.now() - new Date(r.created_at).getTime()) / 36e5);
    const recency = 1 / ageHrs;
    
    // Follow bonus
    const followBonus = r.author?.id && followSet.has(r.author.id) ? 0.8 : 0;
    
    // Game preference bonus (if user has this game in library)
    const gamePreferenceBonus = r.game?.id && userGameIds.has(r.game.id) ? 0.6 : 0;
    
    // Similar game bonus (if user has reviewed similar games)
    const similarGameBonus = r.game?.id && userReviewedGames.has(r.game.id) ? 0.4 : 0;
    
    // Rating quality bonus (higher rated reviews get slight boost)
    const ratingBonus = r.rating > 80 ? 0.2 : r.rating > 60 ? 0.1 : 0;
    
    // Review content bonus (reviews with text get slight boost)
    const contentBonus = r.review && r.review.trim().length > 10 ? 0.1 : 0;
    
    const totalScore = recency + followBonus + gamePreferenceBonus + similarGameBonus + ratingBonus + contentBonus;
    
    return { r, s: totalScore };
  }).sort((a,b) => b.s - a.s);

  // Return top scored items, but ensure we have some content even if scores are low
  const result = scored.map(x => x.r).slice(0, limit);
  
  // If we don't have enough content, fall back to recent reviews
  if (result.length < Math.min(10, limit)) {
    const fallbackQ = sb
      .from('reviews')
      .select(`
        user_id, game_id, rating, review, created_at,
        author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
        game:games ( id, name, cover_url )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    const { data: fallbackData } = await fallbackQ;
    if (fallbackData) {
      const fallbackRows = normalizeReviews(fallbackData).filter(r => {
        const aid = r.author?.id;
        return !(aid && (hidden.has(aid) || mutedIds.includes(aid)));
      });
      
      // Merge with existing results, avoiding duplicates
      const existingIds = new Set(result.map(r => `${r.user_id}-${r.game_id}-${r.created_at}`));
      const newRows = fallbackRows.filter(r => 
        !existingIds.has(`${r.user_id}-${r.game_id}-${r.created_at}`)
      );
      
      return { data: [...result, ...newRows].slice(0, limit) };
    }
  }

  return { data: result };
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
  since.setDate(since.getDate() - 30); // Extended to 30 days for more content

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
      if (scope === 'following') {
        q = q.in('user_id', followingIds);
      } else {
        // For "For You" scope, fetch more posts and apply personalization
        q = q.gte('created_at', since.toISOString());
      }
      if (mutedIds.length) q = q.not('user_id', 'in', toInList(mutedIds));
      if (opts?.before) q = q.lt('created_at', opts.before);
      return q;
    },
    scope === 'foryou' ? limit * 2 : limit // Fetch more for personalization
  );

  // Apply personalization for "For You" scope
  if (scope === 'foryou' && uid) {
    // Get user's game preferences
    const { data: library } = await sb
      .from('library')
      .select('game_id')
      .eq('user_id', uid)
      .limit(100);
    
    const userGameIds = new Set<number>();
    if (library) {
      library.forEach((l: any) => userGameIds.add(Number(l.game_id)));
    }

    // Score posts based on personalization
    const scored = rows.map(post => {
      const ageHrs = Math.max(1, (Date.now() - new Date(post.created_at).getTime()) / 36e5);
      const recency = 1 / ageHrs;
      
      // Game preference bonus
      const gameBonus = post.game_id && userGameIds.has(post.game_id) ? 0.5 : 0;
      
      // Content quality bonus (posts with more text get slight boost)
      const contentBonus = post.body && post.body.trim().length > 20 ? 0.2 : 0;
      
      // Engagement bonus (posts with likes/comments get slight boost)
      const engagementBonus = (post.like_count || 0) > 0 ? 0.1 : 0;
      
      const totalScore = recency + gameBonus + contentBonus + engagementBonus;
      
      return { post, score: totalScore };
    }).sort((a, b) => b.score - a.score);

    // Return top scored posts
    return scored.map(x => x.post).slice(0, limit);
  }

  // final safety-pass
  return rows.filter(r => !hidden.has(String(r.user_id)));
}

async function fetchPostMediaBulk(
  sb: ReturnType<typeof supabaseBrowser>,
  postIds: string[]
): Promise<Record<string, { url: string; media_type: 'image' | 'video' }[]>> {
  if (!postIds.length) return {};
  const { data, error } = await sb
    .from('post_media')
    .select('post_id,url,media_type')
    .in('post_id', postIds)
    .limit(5000);
  if (error || !Array.isArray(data)) return {};
  const map: Record<string, { url: string; media_type: 'image' | 'video' }[]> = {};
  for (const row of data as any[]) {
    const pid = String(row.post_id);
    const path = String(row.url || '');
    const isHttp = /^https?:\/\//i.test(path);
    const publicUrl = isHttp ? path : sb.storage.from('post-media').getPublicUrl(path).data.publicUrl;
    (map[pid] ||= []).push({ url: publicUrl, media_type: row.media_type === 'video' ? 'video' : 'image' });
  }
  return map;
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