// gamebox-web/src/app/feed/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import WhoToFollow from '@/components/WhoToFollow';
import { toggleLike } from '@/lib/likes';

type Author = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Row = {
  reviewer_id: string; // NEW: review's author id (from reviews.user_id)
  created_at: string;
  rating: number; // 1–100
  review: string | null;
  games: { id: number; name: string; cover_url: string | null } | null;
  author: Author | null;
};

// Adjust if your FK alias differs
const AUTHOR_JOIN = 'profiles!reviews_user_id_profiles_fkey';

export default function FeedPage() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  // ❤️ likes state
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const likeKey = (reviewUserId: string, gameId: number) => `${reviewUserId}:${gameId}`;

  async function onToggleLike(reviewUserId: string, gameId: number) {
    if (!me) return; // feed already asks to sign in
    const k = likeKey(reviewUserId, gameId);
    const entry = likes[k] ?? { liked: false, count: 0 };
    const { error } = await toggleLike(supabase, me.id, reviewUserId, gameId, entry.liked);
    if (error) return; // optionally toast this
    setLikes(prev => ({
      ...prev,
      [k]: { liked: !entry.liked, count: entry.count + (entry.liked ? -1 : 1) },
    }));
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;

      const user = session?.user ?? null;
      setMe(user ? { id: user.id } : null);
      setReady(true);

      // If logged out, empty feed (suggestions still render)
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

      // 2) recent reviews by those users (embed author + game)
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
    })();

    return () => { mounted = false; };
  }, [supabase]);

  // Top-level loading / error branches
  if (!ready) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8 text-red-500">{error}</main>;

  // Layout: list + sticky suggestions
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
            <p className="text-white/70">
              No activity yet. Follow players from search or their profiles.
            </p>
          ) : (
            <ul className="space-y-6">
              {rows.map((r, i) => {
                const author = r.author;
                const game = r.games;
                const stars = (r.rating / 20).toFixed(1);

                // like state for this review
                const canLike = Boolean(r.reviewer_id && game?.id);
                const k = canLike ? `${r.reviewer_id}:${game!.id}` : '';
                const entry = canLike ? (likes[k] ?? { liked: false, count: 0 }) : { liked: false, count: 0 };

                return (
                  <li key={`${r.created_at}-${i}`} className="flex items-start gap-3">
                    {/* avatar */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={author?.avatar_url || '/avatar-placeholder.svg'}
                      alt="avatar"
                      className="h-10 w-10 rounded-full object-cover border border-white/15"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/80 flex items-center gap-2 flex-wrap">
                        {author ? (
                          <Link
                            href={author.username ? `/u/${author.username}` : '#'}
                            className="font-medium hover:underline"
                          >
                            {author.display_name || author.username || 'Player'}
                          </Link>
                        ) : 'Someone'}
                        <span>rated</span>
                        {game ? (
                          <Link href={`/game/${game.id}`} className="hover:underline font-medium">
                            {game.name}
                          </Link>
                        ) : (
                          <span>a game</span>
                        )}
                        <span className="text-white/60">· {stars} / 5</span>
                        <span className="text-white/30">·</span>
                        <span className="text-white/40">{new Date(r.created_at).toLocaleDateString()}</span>

                        {canLike && (
                          <button
                            onClick={() => onToggleLike(r.reviewer_id, game!.id)}
                            className={`ml-2 text-xs px-2 py-1 rounded border border-white/10 ${
                              entry.liked ? 'bg-white/15' : 'bg-white/5'
                            }`}
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
                    {game?.cover_url && (
                      <img
                        src={game.cover_url}
                        alt={game.name}
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