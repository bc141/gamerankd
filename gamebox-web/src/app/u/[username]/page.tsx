'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';
import { waitForSession } from '@/lib/waitForSession';
import { getFollowCounts, checkIsFollowing, toggleFollow } from '@/lib/follows';

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

type SortMode = 'recent' | 'top' | 'low';

export default function PublicProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  // auth hydration
  const [ready, setReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // profile + reviews
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // follow UI
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [toggling, setToggling] = useState(false);

  // sort (read from URL)
  const urlSort = searchParams.get('sort');
  const initialSort: SortMode =
    urlSort === 'top' ? 'top' : urlSort === 'low' ? 'low' : 'recent';
  const [sort, setSort] = useState<SortMode>(initialSort);

  const isOwnProfile = !!(viewerId && profile?.id && viewerId === profile.id);
  const avatarSrc = profile?.avatar_url || '/avatar-placeholder.svg';

  // 1) hydrate session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      setViewerId(session?.user?.id ?? null);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // 2) fetch profile (by slug)
  useEffect(() => {
    if (!ready || !slug) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setRows(null);

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

      const c = await getFollowCounts(supabase, (prof as any).id);
      if (!cancelled) setCounts(c);

      if (viewerId && viewerId !== (prof as any).id) {
        const f = await checkIsFollowing(supabase, (prof as any).id);
        if (!cancelled) setIsFollowing(f);
      } else {
        if (!cancelled) setIsFollowing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, slug, supabase, viewerId]);

  // 3) fetch reviews whenever profile or sort changes
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const q = supabase
        .from('reviews')
        .select('rating, review, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', profile.id)
        .limit(50);

      if (sort === 'top') {
        q.order('rating', { ascending: false }).order('created_at', { ascending: false });
      } else if (sort === 'low') {
        q.order('rating', { ascending: true }).order('created_at', { ascending: false });
      } else {
        // recent
        q.order('created_at', { ascending: false });
      }

      const { data, error } = await q;
      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        const safe: ReviewRow[] = (data ?? []).map((r: any) => ({
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, sort, supabase]);

  // keep URL ?sort= in sync (no full nav)
  useEffect(() => {
    const current = searchParams.get('sort');
    const want =
      sort === 'recent' ? null : sort === 'top' ? 'top' : 'low';
    if ((current || null) !== want) {
      const params = new URLSearchParams(searchParams.toString());
      if (want) params.set('sort', want);
      else params.delete('sort');
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  async function onToggleFollow() {
    if (!profile) return;
    if (!viewerId) return router.push('/login');
    if (isOwnProfile) return;

    setToggling(true);
    const { error } = await toggleFollow(supabase, profile.id, isFollowing);
    setToggling(false);
    if (error) return alert(error.message);

    // optimistic update
    setIsFollowing(!isFollowing);
    setCounts((prev) => ({
      followers: prev.followers + (isFollowing ? -1 : 1),
      following: prev.following,
    }));
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

            {/* CLICKABLE counts */}
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
            <Link href="/settings/profile" className="bg-white/10 px-3 py-2 rounded text-sm">Edit profile</Link>
          ) : (
            <button
              onClick={onToggleFollow}
              disabled={toggling}
              className={`px-3 py-2 rounded text-sm ${isFollowing ? 'bg-white/10' : 'bg-indigo-600 text-white'}`}
            >
              {toggling ? '…' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </section>

      {/* Sort toggle */}
      <div className="mt-8 flex items-center gap-2">
        <button
          onClick={() => setSort('recent')}
          className={`px-3 py-1.5 rounded-full text-sm ${
            sort === 'recent' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          Recent
        </button>
        <button
          onClick={() => setSort('top')}
          className={`px-3 py-1.5 rounded-full text-sm ${
            sort === 'top' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          Highest
        </button>
        <button
          onClick={() => setSort('low')}
          className={`px-3 py-1.5 rounded-full text-sm ${
            sort === 'low' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          Lowest
        </button>
      </div>

      {/* Reviews */}
      {rows.length === 0 ? (
        <p className="mt-6 text-white/70">No ratings yet.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {rows.map((r, i) => {
            const stars = from100(r.rating);
            const gameId = r.games?.id;
            const gameName = r.games?.name ?? 'Unknown game';
            const cover = r.games?.cover_url ?? '';

            return (
              <li key={`${r.created_at}-${i}`} className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt={gameName}
                  className="h-16 w-12 object-cover rounded border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  {gameId ? (
                    <Link href={`/game/${gameId}`} className="font-medium hover:underline truncate block">
                      {gameName}
                    </Link>
                  ) : (
                    <span className="font-medium truncate block">{gameName}</span>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating value={stars} readOnly size={18} />
                    <span className="text-sm text-white/60">{stars.toFixed(1)} / 5</span>
                    <span className="text-white/30">·</span>
                    <span className="text-xs text-white/40">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
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