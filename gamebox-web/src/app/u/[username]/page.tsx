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

const from100 = (n: number) => n / 20;

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  rating: number;                           // 1–100
  review: string | null;                    // textual review
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

  const [ready, setReady] = useState(false); // auth hydration
  const [viewerId, setViewerId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // follow UI
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const isOwnProfile = viewerId && profile?.id ? viewerId === profile.id : false;
  const [togglingFollow, setTogglingFollow] = useState(false);

  // ❤️ likes for this profile’s review list
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [togglingLike, setTogglingLike] = useState<Record<string, boolean>>({});
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

  // 1) Hydrate session
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

  // 2) Fetch profile + their ratings + follow counts/state
  useEffect(() => {
    if (!ready || !slug) return;

    let cancelled = false;

    (async () => {
      setError(null);

      const uname = String(slug).toLowerCase();

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
      setProfile(prof as Profile);

      // reviews
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select('rating, review, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', prof.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) setError(error.message);
      else {
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

        // preload likes for these rows — all reviews are by prof.id
        const viewer = viewerId ?? null;
        const pairs = safe
          .filter(r => r.games?.id)
          .map(r => ({ reviewUserId: String(prof.id), gameId: r.games!.id }));
        const map = await fetchLikesBulk(supabase, viewer, pairs);
        if (!cancelled) setLikes(map);
      }

      // counts
      const c = await getFollowCounts(supabase, prof.id);
      if (!cancelled) setCounts(c);

      // following state (only if signed in & not self)
      if (viewerId && viewerId !== prof.id) {
        const f = await checkIsFollowing(supabase, prof.id);
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

  async function onToggleFollow() {
    if (!profile) return;
    if (!viewerId) return router.push('/login');
    if (isOwnProfile) return;

    setTogglingFollow(true);
    const { error } = await toggleFollow(supabase, profile.id, isFollowing);
    setTogglingFollow(false);
    if (error) return alert(error.message);

    // optimistic update
    setIsFollowing(!isFollowing);
    setCounts((prev) => ({
      followers: prev.followers + (isFollowing ? -1 : 1),
      following: prev.following,
    }));
  }

  async function onToggleLike(gameId: number) {
    if (!profile || !gameId) return;
    if (!viewerId) return router.push('/login');
    if (viewerId === profile.id) return; // don't like own review
  
    const k = likeKey(profile.id, gameId);
    if (togglingLike[k]) return;
  
    const cur = likes[k] ?? { liked: false, count: 0 };
  
    // mark busy + optimistic flip
    setTogglingLike(p => ({ ...p, [k]: true }));
    setLikes(p => ({ ...p, [k]: { liked: !cur.liked, count: cur.count + (cur.liked ? -1 : 1) } }));
  
    try {
      // NEW 3-arg API returns authoritative state
      const { liked, count, error } = await toggleLike(supabase, profile.id, gameId);
      if (error) {
        // revert on failure
        setLikes(p => ({ ...p, [k]: cur }));
        console.error('toggleLike failed:', error.message);
        return;
      }
      // snap to DB result + notify other tabs/pages
      setLikes(p => ({ ...p, [k]: { liked, count } }));
      broadcastLike(profile.id, gameId, liked, liked ? 1 : -1);
    } catch (e) {
      setLikes(p => ({ ...p, [k]: cur }));
      console.error('toggleLike crashed:', e);
    } finally {
      setTogglingLike(p => ({ ...p, [k]: false }));
    }
  }

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
            <h1 className="text-2xl font-bold">
              {profile.display_name || profile.username}
            </h1>
            {profile.display_name && (
              <div className="text-white/60">@{profile.username}</div>
            )}
            {profile.bio && <p className="text-white/70 mt-1">{profile.bio}</p>}

            {/* CLICKABLE follow counts */}
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
          {viewerId === profile.id ? (
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

            const k = gameId ? likeKey(profile.id, gameId) : '';
            const entry = gameId ? (likes[k] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

            const canLike = Boolean(gameId) && viewerId !== profile.id;

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
                    <span className="text-xs text-white/40">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>

                    {canLike && gameId && (
                      <button
                      onClick={() => onToggleLike(gameId)}
                      aria-pressed={entry.liked}
                      aria-disabled={Boolean(togglingLike[k])}
                      className={`ml-2 text-xs px-2 py-1 rounded border border-white/10 ${
                        entry.liked ? 'bg-white/15' : 'bg-white/5'
                      } ${togglingLike[k] ? 'opacity-50' : ''}`}
                      title={entry.liked ? 'Unlike' : 'Like'}
                    >
                      ❤️ {entry.count}
                    </button>
                    )}
                    {!canLike && gameId && (
                      <span className="ml-2 text-xs text-white/50">❤️ {entry.count}</span>
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
    </main>
  );
}