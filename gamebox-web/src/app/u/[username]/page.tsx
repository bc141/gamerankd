'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';
import { waitForSession } from '@/lib/waitForSession';
import { getFollowCounts, checkIsFollowing, toggleFollow } from '@/lib/follows';
import {
  likeKey,
  fetchLikesBulk,
  toggleLike as toggleLikeRPC,
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
import { timeAgo } from '@/lib/timeAgo';
import { useReviewContextModal } from '@/components/ReviewContext/useReviewContextModal';
import OverflowActions from '@/components/OverflowActions';
import { getBlockSets, unblockUser, broadcastBlockSync, unmuteUser } from '@/lib/blocks';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';
import Badge from '@/components/ui/Badge';

const from100 = (n: number) => n / 20;

// keep in sync with lib/blocks
type BlockSets = { iBlocked: Set<string>; blockedMe: Set<string>; iMuted: Set<string> };

function openContextIfSafe(
  e: React.MouseEvent | React.KeyboardEvent,
  open: (reviewUserId: string, gameId: number) => void,
  reviewUserId: string,
  gameId?: number | null
) {
  if (!gameId) return;
  const target = e.target as HTMLElement;
  if (target.closest('a,button,[data-ignore-context],input,textarea,svg')) return;
  open(reviewUserId, gameId);
}

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  rating: number;
  review: string | null;
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
};

// library helpers
type LibraryEntry = {
  game_id: number;
  status: LibraryStatus;
  games: { id: number; cover_url: string | null } | null;
};
type LibraryCounts = { total: number } & { [K in LibraryStatus]?: number };

export default function PublicProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const slug: string | undefined = useMemo(() => {
    const raw = (params as any)?.username;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

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

  // blocks/mutes
  const [blockSets, setBlockSets] = useState<BlockSets | null>(null);
  const isOwnProfile = Boolean(viewerId && profile?.id && viewerId === profile.id);
  const blockedEitherWay =
    !!(viewerId && profile?.id && blockSets && (blockSets.iBlocked.has(profile.id) || blockSets.blockedMe.has(profile.id)));
  const iBlocked = !!(viewerId && profile?.id && blockSets?.iBlocked.has(profile.id));

  // Pathname logic for tab highlighting
  const pathname = usePathname();
  const base = profile ? `/u/${profile.username}` : '';
  const isOverview = base && (pathname === base || pathname === `${base}/`);
  const isLibrary = base && pathname.startsWith(`${base}/library`);
  const isMuted  = !!(viewerId && profile?.id && blockSets?.iMuted.has(profile.id));

  // likes
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [likesReady, setLikesReady] = useState(false);
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});

  // comments
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openThread, setOpenThread] = useState<{ reviewUserId: string; gameId: number } | null>(null);

  // Context modal
  const { open: openContext, modal: contextModal } = useReviewContextModal(supabase, viewerId ?? null);

  // ---- Library state (new) ----
  const [libByGame, setLibByGame] = useState<Record<number, LibraryStatus>>({});
  const [libCounts, setLibCounts] = useState<LibraryCounts>({ total: 0 });
  const [libPreview, setLibPreview] = useState<Array<{ id: number; cover_url: string | null; status: LibraryStatus; name: string; updated_at: string }>>([]);

  // cross-tab/same-tab like & comment sync
  useEffect(() => {
    const off1 = addLikeListener(({ reviewUserId, gameId, liked, delta }) => {
      const k = likeKey(reviewUserId, gameId);
      setLikes(prev => {
        const cur = prev[k] ?? { liked: false, count: 0 };
        return { ...prev, [k]: { liked, count: Math.max(0, cur.count + delta) } };
      });
    });
    const off2 = addCommentListener(({ reviewUserId, gameId, delta }) => {
      const k = commentKey(reviewUserId, gameId);
      setCommentCounts(prev => ({ ...prev, [k]: Math.max(0, (prev[k] ?? 0) + delta) }));
    });
    return () => { off1(); off2(); };
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

  async function refreshFollowBits(ownerId: string, viewer: string | null) {
    const [c, f] = await Promise.all([
      getFollowCounts(supabase, ownerId),
      viewer && viewer !== ownerId ? checkIsFollowing(supabase, ownerId) : Promise.resolve(false),
    ]);
    setCounts(c);
    setIsFollowing(Boolean(f));
  }

  // 2) profile + reviews (+likes/comments preload)
  useEffect(() => {
    if (!ready || !slug) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setLikesReady(false);

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
      const owner = prof as Profile;
      setProfile(owner);

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
            ? { id: Number(r.games.id), name: String(r.games.name ?? 'Unknown game'), cover_url: r.games.cover_url ?? null }
            : null,
        }));
        setRows(safe);

        const pairs = safe.filter(r => r.games?.id).map(r => ({ reviewUserId: owner.id, gameId: r.games!.id }));
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

      await refreshFollowBits(owner.id, viewerId);

      // kick off library fetch in parallel (no await needed for UI first paint)
      void fetchLibrary(owner.id);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slug, viewerId, supabase]);

  // 3) block/mute state + storage sync
  useEffect(() => {
    let mounted = true;

    const refreshBlocks = async (force = false) => {
      if (!viewerId || !profile?.id) return;
      const sets = (await getBlockSets(supabase, viewerId, force ? { force: true } : undefined)) as BlockSets;
      if (mounted) setBlockSets(sets);
    };

    (async () => { await refreshBlocks(true); })();

    const onStorage = async (e: StorageEvent) => {
      if (e.key !== 'gb-block-sync' || !profile?.id) return;
      await refreshBlocks(true);
      await refreshFollowBits(profile.id, viewerId);
    };

    try { window.addEventListener('storage', onStorage); } catch {}
    return () => {
      mounted = false;
      try { window.removeEventListener('storage', onStorage); } catch {}
    };
  }, [viewerId, profile?.id, supabase]);

  // ---- Library loader (counts, preview, map for chips) ----
  async function fetchLibrary(ownerId: string) {
    // Pull most-recent first; join covers for preview
    const { data, error } = await supabase
      .from('user_game_library')
      .select('game_id,status,updated_at,games:game_id (id,cover_url,name)')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(400);

    if (error || !data) {
      setLibCounts({ total: 0 });
      setLibByGame({});
      setLibPreview([]);
      return;
    }

    const list: LibraryEntry[] = (data ?? []).map((r: any) => ({
      game_id: Number(r.game_id),
      status: r.status as LibraryStatus,
      games: r.games
        ? { id: Number(r.games.id), cover_url: r.games.cover_url ?? null }
        : null,
    }));

    // counts (typed concrete so indexing is safe)
    type LibraryCountsFull = { total: number } & Record<LibraryStatus, number>;

    const base = LIBRARY_STATUSES.reduce((acc, s) => {
      acc[s] = 0;
      return acc;
    }, {} as Record<LibraryStatus, number>);
    
    const counts: LibraryCountsFull = { total: list.length, ...base };
    for (const r of list) counts[r.status] += 1;
    
    setLibCounts(counts);

    // quick map for status chips on the reviews list
    const map: Record<number, LibraryStatus> = {};
    for (const r of list) map[r.game_id] = r.status;
    setLibByGame(map);

    // preview: prioritize Playing → Backlog → Completed, cap 6
    const pickOrder: LibraryStatus[] = ['Playing', 'Backlog', 'Completed', 'Dropped'];
    const chosen: Array<{ id: number; cover_url: string | null; status: LibraryStatus; name: string; updated_at: string }> = [];
    for (const status of pickOrder) {
      for (const row of list) {
        if (row.status !== status) continue;
        if (!row.games?.id) continue;
        // Find the original data row to get name and updated_at
        const originalRow = data.find((r: any) => r.game_id === row.game_id);
        chosen.push({ 
          id: row.games.id, 
          cover_url: row.games.cover_url ?? null, 
          status,
          name: (originalRow?.games as any)?.name ?? 'Unknown',
          updated_at: originalRow?.updated_at ?? new Date(0).toISOString()
        });
        if (chosen.length >= 6) break;
      }
      if (chosen.length >= 6) break;
    }
    setLibPreview(chosen);
  }

  // follow toggle
  async function onToggleFollow() {
    if (!profile) return;
    if (!viewerId) return router.push('/login');
    if (isOwnProfile) return;
    if (blockedEitherWay) return;

    setTogglingFollow(true);
    try {
      const next = !isFollowing;
      const { error } = await toggleFollow(supabase, profile.id);
      if (error) { alert(error.message); return; }
      setIsFollowing(next);
      setCounts(prev => ({ followers: prev.followers + (next ? 1 : -1), following: prev.following }));
    } finally {
      setTogglingFollow(false);
    }
  }

  const avatarSrc = useMemo<string>(() => {
    const url = (profile?.avatar_url ?? '').trim();
    return url !== '' ? url : '/avatar-placeholder.svg';
  }, [profile?.avatar_url]);

  // like toggle
  async function onToggleLike(gameId: number) {
    if (!profile || !gameId) return;
    if (!viewerId) return router.push('/login');
    if (blockedEitherWay) return;

    const reviewUserId = profile.id;
    const k = likeKey(reviewUserId, gameId);
    if (likeBusy[k]) return;

    const before = likes[k] ?? { liked: false, count: 0 };

    setLikes(p => ({ ...p, [k]: { liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) } }));
    setLikeBusy(p => ({ ...p, [k]: true }));

    try {
      const { liked, count, error } = await toggleLikeRPC(supabase, reviewUserId, gameId);
      if (error) { setLikes(p => ({ ...p, [k]: before })); return; }

      setLikes(p => {
        const cur = p[k] ?? { liked: false, count: 0 };
        if (cur.liked === liked && cur.count === count) return p;
        return { ...p, [k]: { liked, count } };
      });

      broadcastLike(reviewUserId, gameId, liked, liked ? 1 : -1);

      setTimeout(async () => {
        const map = await fetchLikesBulk(supabase, viewerId, [{ reviewUserId, gameId }]);
        setLikes(p => ({ ...p, ...map }));
      }, 120);
    } finally {
      setLikeBusy(p => ({ ...p, [k]: false }));
    }
  }

  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!ready || !profile || !rows) return <main className="p-8">Loading…</main>;

  const username = profile.username;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <section className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={`${username} avatar`}
            className="h-16 w-16 rounded-full object-cover border border-white/20"
            loading="lazy"
            decoding="async"
          />
          <div>
            <h1 className="text-2xl font-bold">{profile.display_name || username}</h1>
            {profile.display_name && <div className="text-white/60">@{username}</div>}
            {profile.bio && <p className="text-white/70 mt-1">{profile.bio}</p>

            }
            {/* counts */}
            <div className="mt-2 text-sm text-white/60 flex items-center gap-4">
              <Link href={`/u/${username}/followers`} className="hover:underline">
                <strong className="text-white">{counts.followers}</strong> Followers
              </Link>
              <Link href={`/u/${username}/following`} className="hover:underline">
                <strong className="text-white">{counts.following}</strong> Following
              </Link>
              {/* quick library count */}
              <Link href={`/u/${username}/library`} className="hover:underline">
                <strong className="text-white">{libCounts.total}</strong> Library
              </Link>
            </div>

            {/* Block banner */}
            {!isOwnProfile && blockedEitherWay && (
              <div className="mt-3 text-xs rounded-lg border border-white/10 bg-white/5 text-white/80 px-3 py-2 flex items-center gap-2">
                {iBlocked ? (
                  <>
                    <span>You blocked this user.</span>
                    <button
                      onClick={async () => {
                        await unblockUser(supabase, profile.id);
                        try { broadcastBlockSync(); } catch {}
                        if (viewerId) {
                          const sets = (await getBlockSets(supabase, viewerId, { force: true })) as BlockSets;
                          setBlockSets(sets);
                        }
                        await refreshFollowBits(profile.id, viewerId);
                      }}
                      className="ml-auto text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      Unblock
                    </button>
                  </>
                ) : (
                  <span>This user has blocked you.</span>
                )}
              </div>
            )}

            {/* Mute banner */}
            {!isOwnProfile && !blockedEitherWay && isMuted && (
              <div className="mt-3 text-xs rounded-lg border border-white/10 bg-white/5 text-white/80 px-3 py-2 flex items-center gap-2">
                <span>You muted this user. Their posts/alerts are hidden in your feed.</span>
                <button
                  onClick={async () => {
                    await unmuteUser(supabase, profile.id);
                    try { broadcastBlockSync(); } catch {}
                    if (viewerId) {
                      const sets = (await getBlockSets(supabase, viewerId, { force: true })) as BlockSets;
                      setBlockSets(sets);
                    }
                  }}
                  className="ml-auto text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  Unmute
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Follow / Edit / Overflow */}
        <div className="shrink-0 flex items-center gap-2 relative">
          {isOwnProfile ? (
            <Link href="/settings/profile" className="bg-white/10 px-3 py-2 rounded text-sm hover:bg-white/15 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              Edit profile
            </Link>
          ) : (
            <>
              <button
                onClick={onToggleFollow}
                disabled={togglingFollow || blockedEitherWay}
                aria-disabled={togglingFollow || blockedEitherWay}
                title={blockedEitherWay ? 'Following disabled for blocked users' : undefined}
                aria-pressed={isFollowing}
                className={`px-3 py-2 rounded text-sm disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isFollowing ? 'bg-white/10 hover:bg-white/15' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {togglingFollow ? '…' : isFollowing ? 'Following' : 'Follow'}
              </button>

              <OverflowActions
                targetId={profile.id}
                username={username}
                onBlockChange={async () => {
                  if (viewerId) {
                    const sets = (await getBlockSets(supabase, viewerId, { force: true })) as BlockSets;
                    setBlockSets(sets);
                  }
                  await refreshFollowBits(profile.id, viewerId);
                }}
              />
            </>
          )}
        </div>
      </section>

      {/* Tabs — simplified: Overview | Library */}
      <nav className="mt-6 flex items-center gap-6 border-b border-white/10">
        <TabLink href={base} active={Boolean(isOverview)}>Overview</TabLink>
        <TabLink href={`${base}/library`} active={Boolean(isLibrary)}>Library</TabLink>
      </nav>

      {/* Library preview */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wide text-white/40">Library</h3>
          <Link href={`/u/${username}/library`} className="text-xs text-white/70 hover:underline">
            View all · {libCounts.total}
          </Link>
        </div>
        {!ready ? (
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 w-28 rounded bg-white/10 animate-pulse" />
            ))}
          </div>
        ) : libPreview.length === 0 ? (
          <p className="mt-2 text-white/60">No games in library yet.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {libPreview.map((g) => (
              <Link
                key={g.id}
                href={`/game/${g.id}`}
                className="group block rounded-lg overflow-hidden border border-white/10 hover:border-white/20 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.cover_url || '/cover-fallback.png'} alt={g.name} className="h-28 w-20 object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge tone="neutral" className="absolute left-2 bottom-2">{g.status}</Badge>
                </div>
                <div className="px-2 py-1 flex items-center gap-2">
                  <time className="text-[11px] text-white/40">{timeAgo(g.updated_at)}</time>
                </div>
              </Link>
            ))}
          </ul>
        )}
      </section>

      {/* Reviews */}
      {rows.length === 0 ? (
        <p className="mt-8 text-white/70">No ratings yet.</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {rows.map((r, i) => {
            const stars = from100(r.rating);
            const gameId = r.games?.id;
            const gameName = r.games?.name ?? 'Unknown game';
            const cover = r.games?.cover_url ?? '';

            const likeK = gameId ? likeKey(profile.id, gameId) : '';
            const entry = gameId ? (likes[likeK] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

            const cKey = gameId ? commentKey(profile.id, gameId) : '';
            const cCount = gameId ? (commentCounts[cKey] ?? 0) : 0;

            const statusChip = gameId ? libByGame[gameId] : undefined;

            return (
              <li
                key={`${gameId ?? 'g'}-${i}`}
                className="flex items-start gap-4 py-3 rounded-lg -mx-3 px-3 hover:bg-white/5 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                onClick={(e) => openContextIfSafe(e, openContext, profile.id, gameId)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openContextIfSafe(e, openContext, profile.id, gameId);
                  }
                }}
                aria-label={gameName ? `Open ${gameName} rating` : 'Open rating'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover || '/cover-fallback.png'}
                  alt={gameName}
                  className="h-16 w-12 object-cover rounded border border-white/10"
                  loading="lazy"
                  decoding="async"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={gameId ? `/game/${gameId}` : '#'}
                      className="font-medium hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {gameName}
                    </Link>
                    {statusChip && (
                      <Badge tone="neutral" className="ml-2">
                        {statusChip}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <StarRating value={stars} readOnly size={18} />
                    <span className="text-sm text-white/60">{stars.toFixed(1)} / 5</span>
                    <span className="text-white/30">·</span>
                    <span className="text-xs text-white/40">{timeAgo(r.created_at)}</span>

                    {gameId && (
                      <div className="flex items-center gap-2" data-ignore-context>
                        {likesReady ? (
                          <span
                            className={`ml-2 inline-flex ${blockedEitherWay ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={blockedEitherWay ? 'Likes disabled for blocked users' : undefined}
                            data-ignore-context
                          >
                            <LikePill
                              liked={entry.liked}
                              count={entry.count}
                              busy={likeBusy[likeKey(profile.id, gameId)]}
                              onClick={() => {
                                if (blockedEitherWay) return;
                                onToggleLike(gameId);
                              }}
                            />
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-white/40">❤️ …</span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!blockedEitherWay) setOpenThread({ reviewUserId: profile.id, gameId });
                          }}
                          disabled={blockedEitherWay}
                          className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          title={blockedEitherWay ? 'Comments disabled for blocked users' : 'View comments'}
                          aria-label="View comments"
                        >
                          💬 {cCount}
                        </button>
                      </div>
                    )}
                  </div>

                  {r.review && r.review.trim() !== '' && (
                    <p className="text-white/70 mt-2 whitespace-pre-wrap break-words">{r.review.trim()}</p>
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

      {contextModal}
    </main>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'px-2 pb-3 -mb-px text-sm',
        active
          ? 'text-white border-b-2 border-indigo-500'
          : 'text-white/60 hover:text-white hover:border-b-2 hover:border-white/20',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}