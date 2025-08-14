// gamebox-web/src/app/feed/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

// If your FK alias differs, update this:
const AUTHOR_JOIN = 'profiles!reviews_user_id_profiles_fkey';

export default function FeedPage() {
  const supabase = supabaseBrowser();

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // likes state for visible rows
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // cross-tab/same-tab like sync (applies updates coming from other pages/tabs)
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

  // Load session then feed + initial likes
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      const user = session?.user ?? null;
      setMe(user ? { id: user.id } : null);
      setReady(true);

      if (!user) {
        setRows([]);
        return;
      }

      // 1) who am I following?
      const { data: flw, error: fErr } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', user.id);

      if (!mounted) return;
      if (fErr) { setError(fErr.message); return; }

      const followingIds = (flw ?? []).map(r => String(r.followee_id));
      if (followingIds.length === 0) { setRows([]); return; }

      // 2) recent reviews by those people
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
      if (error) { setError(error.message); return; }

      const safe: Row[] = (data ?? []).map((r: any) => ({
        reviewer_id: String(r?.user_id ?? r?.author?.id ?? ''),
        created_at: r?.created_at ?? new Date(0).toISOString(),
        rating: typeof r?.rating === 'number' ? r.rating : 0,
        review: r?.review ?? null,
        games: r?.games
          ? {
              id: Number(r.games.id),
              name: String(r.games.name ?? 'Unknown'),
              cover_url: r.games.cover_url ?? null,
            }
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

      // 3) hydrate likes for visible set
      const pairs = safe
        .filter(r => r.reviewer_id && r.games?.id)
        .map(r => ({ reviewUserId: r.reviewer_id, gameId: r.games!.id }));
      const map = await fetchLikesBulk(supabase, user.id, pairs);
      setLikes(map);
    })();

    return () => { mounted = false; };
  }, [supabase]);

  // Like/Unlike with optimistic UI + authoritative snap + broadcast
  async function onToggleLike(reviewUserId: string, gameId: number) {
    if (!me) return; // page already asks to sign in
    const k = likeKey(reviewUserId, gameId);
    if (busy[k]) return;

    const before = likes[k] ?? { liked: false, count: 0 };

    // optimistic flip
    const optimistic = {
      liked: !before.liked,
      count: before.count + (before.liked ? -1 : 1),
    };
    setLikes(prev => ({ ...prev, [k]: optimistic }));
    setBusy(prev => ({ ...prev, [k]: true }));

    try {
      // RPC returns authoritative {liked,count}
      const { liked, count, error } = await toggleLike(supabase, reviewUserId, gameId);
      if (error) {
        setLikes(prev => ({ ...prev, [k]: before })); // revert on error
        return;
      }

      // Snap to DB only if different from optimistic (no flicker)
      if (liked !== optimistic.liked || count !== optimistic.count) {
        setLikes(prev => ({ ...prev, [k]: { liked, count } }));
      }

      // Broadcast delta so profile/game tabs update instantly
      const delta = liked === before.liked ? 0 : (liked ? 1 : -1);
      if (delta !== 0) {
        broadcastLike(reviewUserId, gameId, liked, delta);
      }
    } finally {
      setBusy(prev => ({ ...prev, [k]: false }));
    }
  }

  // Top-level branches
  if (!ready) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8 text-red-500">{error}</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <section className="min-w-0">
          <h1 className="text-2xl font-bold mb-4">Your feed</h1>

          {!me ? (
            <p className="text-white/70">
              <Link className="underline" href="/login">Sign in</Link> to see activity from people you follow.
            </p>
          ) : !rows ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-white/70">No activity yet. Follow players from search or their profiles.</p>
          ) : (
            <ul className="space-y-6">
              {rows.map((r, i) => {
                const a = r.author;
                const g = r.games;
                const stars = (r.rating / 20).toFixed(1);

                const canLike = Boolean(r.reviewer_id && g?.id);
                const k = canLike ? likeKey(r.reviewer_id, g!.id) : '';
                const entry = canLike ? (likes[k] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

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
                          <Link
                            href={a.username ? `/u/${a.username}` : '#'}
                            className="font-medium hover:underline"
                          >
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
                          <button
                            onClick={() => onToggleLike(r.reviewer_id, g!.id)}
                            disabled={busy[k]}
                            className={`ml-2 text-xs px-2 py-1 rounded border border-white/10 ${
                              entry.liked ? 'bg-white/15' : 'bg-white/5'
                            } ${busy[k] ? 'opacity-50' : ''}`}
                            aria-pressed={entry.liked}
                            title={entry.liked ? 'Unlike' : 'Like'}
                          >
                            ❤️ {entry.count}
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
    </main>
  );
}