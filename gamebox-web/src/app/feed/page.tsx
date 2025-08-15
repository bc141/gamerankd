// gamebox-web/src/app/feed/page.tsx
'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import WhoToFollow from '@/components/WhoToFollow';
import {
  likeKey,
  fetchLikesBulk,
  toggleLike,
  broadcastLike,
  addLikeListener,
  type LikeEntry,
} from '@/lib/likes';
import LikePill from '@/components/LikePill';
import CommentThread from '@/components/comments/CommentThread';
import {
  commentKey,
  fetchCommentCountsBulk,
  addCommentListener,
} from '@/lib/comments';

// If your FK alias differs, update this to match your DB
const AUTHOR_JOIN = 'profiles!reviews_user_id_profiles_fkey';

type Author = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Row = {
  reviewer_id: string; // reviews.user_id
  created_at: string;
  rating: number; // 1–100
  review: string | null;
  games: { id: number; name: string; cover_url: string | null } | null;
  author: Author | null;
};

// --- Inner client component with all logic ---
function FeedPageInner() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab: 'following' | 'foryou' = tabParam === 'foryou' ? 'foryou' : 'following';

  function setTab(next: 'following' | 'foryou') {
    const sp = new URLSearchParams(searchParams as any);
    sp.set('tab', next);
    router.push(`/feed?${sp.toString()}`, { scroll: false });
  }

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string } | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ❤️ likes for visible items
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  // 💬 comment counts + which thread is open
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openThread, setOpenThread] =
    useState<{ reviewUserId: string; gameId: number } | null>(null);

  // cross-tab/same-tab LIKE sync
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

  // cross-tab/same-tab COMMENT count sync
  useEffect(() => {
    const off = addCommentListener(({ reviewUserId, gameId, delta }) => {
      const k = commentKey(reviewUserId, gameId);
      setCommentCounts(prev => ({ ...prev, [k]: Math.max(0, (prev[k] ?? 0) + delta) }));
    });
    return off;
  }, []);

  // 1) session + load feed + preload likes & comment counts
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      // Clear lists when switching tabs so we don't flash stale data
      setRows(null);
      setLikes({});
      setCommentCounts({});

      const session = await waitForSession(supabase);
      if (!mounted) return;

      const user = session?.user ?? null;
      setMe(user ? { id: user.id } : null);
      setReady(true);

      // Not signed in? Show empty state for both tabs
      if (!user) {
        setRows([]);
        setLoading(false);
        return;
      }

      // --- Following tab (existing behavior)
      if (tab === 'following') {
        const { data: flw, error: fErr } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', user.id);

        if (!mounted) return;
        if (fErr) {
          setError(fErr.message);
          setRows([]);
          setLoading(false);
          return;
        }

        const followingIds = (flw ?? []).map(r => String(r.followee_id));
        if (followingIds.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('reviews')
          .select(`
            user_id,
            created_at,
            rating,
            review,
            games:game_id ( id, name, cover_url ),
            author:${AUTHOR_JOIN} ( id, username, display_name, avatar_url )
          `)
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!mounted) return;
        if (error) {
          setError(error.message);
          setRows([]);
          setLoading(false);
          return;
        }

        const safe: Row[] = (data ?? []).map((r: any) => ({
          reviewer_id: String(r?.user_id ?? r?.author?.id ?? ''),
          created_at: r?.created_at ?? new Date(0).toISOString(),
          rating: typeof r?.rating === 'number' ? r.rating : 0,
          review: r?.review ?? null,
          games: r?.games
            ? { id: Number(r.games.id), name: String(r.games.name ?? 'Unknown'), cover_url: r.games.cover_url ?? null }
            : null,
          author: r?.author
            ? {
                id: String(r.author.id),
                username: r.author.username ?? null,
                display_name: r.author.display_name ?? null,
                avatar_url: r.author.avatar_url ?? null,
              }
            : null,
        }));

        setRows(safe);

        const pairs = safe
          .filter(r => r.reviewer_id && r.games?.id)
          .map(r => ({ reviewUserId: r.reviewer_id, gameId: r.games!.id }));

        const [likesMap, commentsMap] = await Promise.all([
          fetchLikesBulk(supabase, user.id, pairs),
          fetchCommentCountsBulk(supabase, pairs),
        ] as const);

        if (!mounted) return;
        setLikes(likesMap ?? {});
        setCommentCounts(commentsMap ?? {});
        setLoading(false);
        return;
      }

      // --- For You tab (RPC)
      if (tab === 'foryou') {
        const { data, error } = await supabase.rpc('get_for_you_feed', {
          p_viewer_id: user.id,
          p_limit: 50,
        });

        if (!mounted) return;
        if (error) {
          // Surface error but keep UI usable
          setError(error.message);
          setRows([]);
          setLoading(false);
          return;
        }

        // Map RPC rows -> existing Row shape
        const safe: Row[] = (data ?? []).map((r: any) => ({
          reviewer_id: String(r?.user_id ?? r?.author_id ?? ''),
          created_at: r?.created_at ?? new Date(0).toISOString(),
          rating: typeof r?.rating === 'number' ? r.rating : 0,
          review: r?.review ?? null,
          games: r?.game_id
            ? {
                id: Number(r.game_id),
                name: String(r.game_name ?? 'Unknown'),
                cover_url: r.game_cover_url ?? null,
              }
            : null,
          author: {
            id: String(r?.author_id ?? r?.user_id ?? ''),
            username: r?.username ?? null,
            display_name: r?.display_name ?? null,
            avatar_url: r?.avatar_url ?? null,
          },
        }));

        setRows(safe);

        const pairs = safe
          .filter(r => r.reviewer_id && r.games?.id)
          .map(r => ({ reviewUserId: r.reviewer_id, gameId: r.games!.id }));

        const [likesMap, commentsMap] = await Promise.all([
          fetchLikesBulk(supabase, user.id, pairs),
          fetchCommentCountsBulk(supabase, pairs),
        ] as const);

        if (!mounted) return;
        setLikes(likesMap ?? {});
        setCommentCounts(commentsMap ?? {});
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // NOTE: depend on `tab` only (not the `searchParams` object) to avoid unnecessary re-runs
  }, [supabase, tab]);

  // 2) Like/Unlike (optimistic → RPC → snap → tiny truth-sync → broadcast)
  async function onToggleLike(reviewUserId: string, gameId: number) {
    if (!me) return; // page already suggests sign in
    const k = likeKey(reviewUserId, gameId);
    if (likeBusy[k]) return;

    const before = likes[k] ?? { liked: false, count: 0 };

    // optimistic
    setLikes(p => ({ ...p, [k]: { liked: !before.liked, count: before.count + (before.liked ? -1 : 1) } }));
    setLikeBusy(p => ({ ...p, [k]: true }));

    try {
      const { liked, count, error } = await toggleLike(supabase, reviewUserId, gameId);
      if (error) {
        setLikes(p => ({ ...p, [k]: before })); // revert
        return;
      }
      setLikes(p => {
        const cur = p[k] ?? { liked: false, count: 0 };
        if (cur.liked === liked && cur.count === count) return p; // no-op -> no flicker
        return { ...p, [k]: { liked, count } };
      });
      broadcastLike(reviewUserId, gameId, liked, liked ? 1 : -1);

      // small truth-sync in case of races
      if (me?.id) {
        setTimeout(async () => {
          const map = await fetchLikesBulk(supabase, me.id, [{ reviewUserId, gameId }]);
          setLikes(p => ({ ...p, ...map }));
        }, 120);
      }
    } finally {
      setLikeBusy(p => ({ ...p, [k]: false }));
    }
  }

  if (!ready) return <main className="p-8">Loading…</main>;
  if (error && rows?.length) {
    // keep feed visible if we still have rows
    console.warn('Feed error:', error);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <section className="min-w-0">
          <h1 className="text-2xl font-bold mb-4">Your feed</h1>

          <nav className="mb-4 flex gap-2 border-b border-white/10" aria-label="Feed tabs">
            <button
              onClick={() => setTab('following')}
              aria-pressed={tab === 'following'}
              className={`px-3 py-1.5 rounded-t ${
                tab === 'following' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setTab('foryou')}
              aria-pressed={tab === 'foryou'}
              className={`px-3 py-1.5 rounded-t ${
                tab === 'foryou' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              For You
            </button>
          </nav>

          {(!me || loading) ? (
            <p className="text-white/70">{!me ? (
              <> <Link className="underline" href="/login">Sign in</Link> to see your personalized feed.</>
            ) : 'Loading…'}</p>
          ) : rows && rows.length === 0 ? (
            <p className="text-white/70">
              {tab === 'foryou'
                ? 'No recommendations yet. Rate a few games and follow some players to train your feed.'
                : 'No activity yet. Follow players from search or their profiles.'}
            </p>
          ) : (
            <ul className="space-y-6">
              {rows!.map((r, i) => {
                const a = r.author;
                const g = r.games;
                const stars = (r.rating / 20).toFixed(1);

                const canLike = Boolean(r.reviewer_id && g?.id);
                const likeK = canLike ? likeKey(r.reviewer_id, g!.id) : '';
                const entry = canLike ? (likes[likeK] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

                const canComment = Boolean(r.reviewer_id && g?.id);
                const cKey = canComment ? commentKey(r.reviewer_id, g!.id) : '';
                const cCount = canComment ? (commentCounts[cKey] ?? 0) : 0;

                return (
                  <li key={`${r.created_at}-${i}`} className="flex items-start gap-3">
                    {/* avatar */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a?.avatar_url || '/avatar-placeholder.svg'}
                      alt="avatar"
                      className="h-10 w-10 rounded-full object-cover border border-white/15"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/80 flex items-center gap-2 flex-wrap">
                        {a ? (
                          <Link href={a.username ? `/u/${a.username}` : '#'} className="font-medium hover:underline">
                            {a.display_name || a.username || 'Player'}
                          </Link>
                        ) : 'Someone'}
                        <span>rated</span>
                        {g ? (
                          <Link href={`/game/${g.id}`} className="hover:underline font-medium">
                            {g.name}
                          </Link>
                        ) : (
                          <span>a game</span>
                        )}
                        <span className="text-white/60">· {stars} / 5</span>
                        <span className="text-white/30">·</span>
                        <span className="text-white/40">{new Date(r.created_at).toLocaleDateString()}</span>

                        {canLike && (
                          <LikePill
                            liked={entry.liked}
                            count={entry.count}
                            busy={likeBusy[likeK]}
                            onClick={() => onToggleLike(r.reviewer_id, g!.id)}
                            className="ml-2"
                          />
                        )}

                        {canComment && (
                          <button
                            onClick={() => setOpenThread({ reviewUserId: r.reviewer_id, gameId: g!.id })}
                            className="ml-2 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                            title="View comments"
                          >
                            💬 {cCount}
                          </button>
                        )}
                      </div>

                      {r.review && r.review.trim() !== '' && (
                        <p className="mt-2 whitespace-pre-wrap text-white/80">{r.review.trim()}</p>
                      )}
                    </div>

                    {/* cover */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g?.cover_url && (
                      <img
                        src={g.cover_url}
                        alt={g.name}
                        className="h-16 w-12 rounded object-cover border border-white/10"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Mobile suggestions */}
          <div className="mt-10 lg:hidden">
            <WhoToFollow limit={6} />
          </div>
        </section>

        {/* Desktop sticky suggestions */}
        <aside className="hidden lg:block lg:sticky lg:top-16">
          <WhoToFollow limit={6} />
        </aside>
      </div>

      {/* Comment modal */}
      {openThread && (
        <CommentThread
          supabase={supabase}
          viewerId={me?.id ?? null}
          reviewUserId={openThread.reviewUserId}
          gameId={openThread.gameId}
          onClose={async () => {
            // single-pair refresh to ensure accuracy after close
            const map = await fetchCommentCountsBulk(supabase, [
              { reviewUserId: openThread.reviewUserId, gameId: openThread.gameId },
            ]);
            setCommentCounts(p => ({ ...p, ...map }));
            setOpenThread(null);
          }}
        />
      )}
    </main>
  );
}

// --- Default export wrapped in Suspense (fixes useSearchParams build error) ---
export default function FeedPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading…</main>}>
      <FeedPageInner />
    </Suspense>
  );
}