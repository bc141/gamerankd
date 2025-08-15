'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';
import { waitForSession } from '@/lib/waitForSession';
import { getFollowCounts, checkIsFollowing, toggleFollow } from '@/lib/follows';
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

const from100 = (n: number) => n / 20;

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  rating: number; // 1–100
  review: string | null;
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
};

export default function PublicProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  // auth
  const [ready, setReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // data
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // follows
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const isOwnProfile = viewerId && profile?.id ? viewerId === profile.id : false;

// ❤️ likes (owner.id, gameId)
const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
const [likesReady, setLikesReady] = useState(false);
const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  // 💬 comments
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openThread, setOpenThread] = useState<{ reviewUserId: string; gameId: number } | null>(null);

  // cross-tab/same-tab like sync
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

  // cross-tab/same-tab comment count sync
  useEffect(() => {
    const off = addCommentListener(({ reviewUserId, gameId, delta }) => {
      const k = commentKey(reviewUserId, gameId);
      setCommentCounts(prev => ({ ...prev, [k]: Math.max(0, (prev[k] ?? 0) + delta) }));
    });
    return off;
  }, []);

  // 1) hydrate session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      setViewerId(session?.user?.id ?? null);
      setReady(true);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  // 2) fetch profile + reviews + follow data + preload likes & comment counts
  useEffect(() => {
    if (!ready || !slug) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setLikesReady(false);

      const uname = String(slug).toLowerCase();

      // profile
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,username,display_name,bio,avatar_url')
        .eq('username', uname)
        .single();

      if (cancelled) return;
      if (pErr || !prof) {
        setError('Profile not found');
        return;
      }
      const owner = prof as Profile;
      setProfile(owner);

      // reviews by this profile
      const { data: reviewsData, error: rErr } = await supabase
        .from('reviews')
        .select('rating, review, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', owner.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (rErr) {
        setError(rErr.message);
      } else {
        const safe: ReviewRow[] = (reviewsData ?? []).map((r: any) => ({
          rating: typeof r?.rating === 'number' ? r.rating : 0,
          review: r?.review ?? null,
          created_at: r?.created_at ?? new Date(0).toISOString(),
          games: r?.games
            ? {
                id: Number(r.games.id),
                name: String(r.games.name ?? 'Unknown game'),
                cover_url: r.games.cover_url ?? null,
              }
            : null,
        }));
        setRows(safe);

        // preload likes & comment counts for all (owner.id, gameId) pairs
        const pairs = safe
          .filter(r => r.games?.id)
          .map(r => ({ reviewUserId: owner.id, gameId: r.games!.id }));

        const viewer = viewerId ?? null;
        const [likeMap, commentMap] = await Promise.all([
          fetchLikesBulk(supabase, viewer, pairs),
          fetchCommentCountsBulk(supabase, pairs),
        ]);

        if (!cancelled) {
          setLikes(likeMap ?? {});
          setCommentCounts(commentMap ?? {});
          setLikesReady(true);
        }
      }

      // follow counts + state
      const c = await getFollowCounts(supabase, owner.id);
      if (!cancelled) setCounts(c);

      if (viewerId && viewerId !== owner.id) {
        const f = await checkIsFollowing(supabase, owner.id);
        if (!cancelled) setIsFollowing(f);
      } else {
        if (!cancelled) setIsFollowing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ready, slug, viewerId, supabase]);

  const avatarSrc = useMemo(
    () => (profile?.avatar_url && profile.avatar_url.trim() !== '' ? profile.avatar_url : '/avatar-placeholder.svg'),
    [profile?.avatar_url]
  );

  // follow toggle
  async function onToggleFollow() {
    if (!profile) return;
    if (!viewerId) return router.push('/login');
    if (isOwnProfile) return;

    setTogglingFollow(true);
    const { error } = await toggleFollow(supabase, profile.id, isFollowing);
    setTogglingFollow(false);
    if (error) return alert(error.message);

    setIsFollowing(!isFollowing);
    setCounts(prev => ({
      followers: prev.followers + (isFollowing ? -1 : 1),
      following: prev.following,
    }));
  }

  // like toggle for one row (reviewUserId = profile.id)
  async function onToggleLike(gameId: number) {
    if (!profile || !gameId) return;
    if (!viewerId) return router.push('/login');
  
    const reviewUserId = profile.id; // likes are keyed by (profile.id, gameId)
    const k = likeKey(reviewUserId, gameId);
    if (likeBusy[k]) return;
  
    const before = likes[k] ?? { liked: false, count: 0 };
  
    // optimistic
    setLikes(p => ({
      ...p,
      [k]: { liked: !before.liked, count: before.count + (before.liked ? -1 : 1) },
    }));
    setLikeBusy(p => ({ ...p, [k]: true }));
  
    try {
      const { liked, count, error } = await toggleLike(supabase, reviewUserId, gameId);
      if (error) {
        // revert on failure
        setLikes(p => ({ ...p, [k]: before }));
        return;
      }
      // snap only if different -> avoids flicker
      setLikes(p => {
        const cur = p[k] ?? { liked: false, count: 0 };
        if (cur.liked === liked && cur.count === count) return p;
        return { ...p, [k]: { liked, count } };
      });
  
      broadcastLike(reviewUserId, gameId, liked, liked ? 1 : -1);
  
      // tiny truth-sync in case of races
      setTimeout(async () => {
        const map = await fetchLikesBulk(supabase, viewerId, [{ reviewUserId, gameId }]);
        setLikes(p => ({ ...p, ...map }));
      }, 120);
    } finally {
      setLikeBusy(p => ({ ...p, [k]: false }));
    }
  }

  // branches
  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!ready || !profile || !rows) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <section className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={`${profile.username} avatar`}
            className="h-16 w-16 rounded-full object-cover border border-white/20"
          />
          <div>
            <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
            {profile.display_name && <div className="text-white/60">@{profile.username}</div>}
            {profile.bio && <p className="text-white/70 mt-1">{profile.bio}</p>}

            {/* clickable counts */}
            <div className="mt-2 text-sm text-white/60 flex items-center gap-4">
              <Link href={`/u/${profile.username}/followers`} className="hover:underline">
                <strong className="text-white">{counts.followers}</strong> Followers
              </Link>
              <Link href={`/u/${profile.username}/following`} className="hover:underline">
                <strong className="text-white">{counts.following}</strong> Following
              </Link>
            </div>
          </div>
        </div>

        {/* Follow / Edit */}
        <div className="shrink-0">
          {isOwnProfile ? (
            <a href="/settings/profile" className="bg-white/10 px-3 py-2 rounded text-sm">Edit profile</a>
          ) : (
            <button
              onClick={onToggleFollow}
              disabled={togglingFollow}
              className={`px-3 py-2 rounded text-sm ${isFollowing ? 'bg-white/10' : 'bg-indigo-600 text-white'} disabled:opacity-50`}
            >
              {togglingFollow ? '…' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </section>

      {/* Reviews */}
      {rows.length === 0 ? (
        <p className="mt-8 text-white/70">No ratings yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {rows.map((r, i) => {
            const stars = from100(r.rating);
            const gameId = r.games?.id;
            const gameName = r.games?.name ?? 'Unknown game';
            const cover = r.games?.cover_url ?? '';

            const likeK = gameId ? likeKey(profile.id, gameId) : '';
            const entry = gameId ? (likes[likeK] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

            const cKey = gameId ? commentKey(profile.id, gameId) : '';
            const cCount = gameId ? (commentCounts[cKey] ?? 0) : 0;

            return (
              <li key={`${gameId ?? 'g'}-${i}`} className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt={gameName}
                  className="h-16 w-12 object-cover rounded border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <a
                    href={gameId ? `/game/${gameId}` : '#'}
                    className="font-medium hover:underline truncate block"
                  >
                    {gameName}
                  </a>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <StarRating value={stars} readOnly size={18} />
                    <span className="text-sm text-white/60">{stars.toFixed(1)} / 5</span>
                    <span className="text-white/30">·</span>
                    <span className="text-xs text-white/40">{new Date(r.created_at).toLocaleDateString()}</span>

                    {gameId && (
                      <>
                        {gameId && (
  likesReady ? (
    <LikePill
      liked={entry.liked}
      count={entry.count}
      busy={likeBusy[likeKey(profile.id, gameId)]}
      onClick={() => onToggleLike(gameId)}
      className="ml-2"
    />
  ) : (
    <span className="ml-2 text-xs text-white/40">❤️ …</span>
  )
)}

                        <button
                          onClick={() => setOpenThread({ reviewUserId: profile.id, gameId })}
                          className="ml-2 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                          title="View comments"
                        >
                          💬 {cCount}
                        </button>
                      </>
                    )}
                  </div>

                  {r.review && r.review.trim() !== '' && (
                    <p className="text-white/70 mt-2 whitespace-pre-wrap break-words">
                      {r.review.trim()}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Comment modal */}
      {openThread && (
  <CommentThread
    supabase={supabase}
    viewerId={viewerId}
    reviewUserId={openThread.reviewUserId}
    gameId={openThread.gameId}
    onCountChange={(next) => {
      const k = commentKey(openThread.reviewUserId, openThread.gameId);
      setCommentCounts(p => ({ ...p, [k]: next }));
    }}
    onClose={async () => {
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