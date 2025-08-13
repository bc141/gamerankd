// gamebox-web/src/app/feed/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';

type Author = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Row = {
  created_at: string;
  rating: number;              // 1–100
  review: string | null;
  games: { id: number; name: string; cover_url: string | null } | null;
  author: Author | null;
};

export default function FeedPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

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

      const followingIds = (flw ?? []).map(r => r.followee_id as string);
      if (followingIds.length === 0) { setRows([]); return; }

      // 2) recent reviews from those users, with author & game embedded
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          created_at,
          rating,
          review,
          games:game_id ( id, name, cover_url ),
          author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url )
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!mounted) return;
      if (error) { setError(error.message); return; }

      // normalize defensively
      const safe: Row[] = (data ?? []).map((r: any) => ({
        created_at: r?.created_at ?? new Date(0).toISOString(),
        rating: typeof r?.rating === 'number' ? r.rating : 0,
        review: r?.review ?? null,
        games: r?.games ? {
          id: Number(r.games.id),
          name: String(r.games.name ?? 'Unknown'),
          cover_url: r.games.cover_url ?? null,
        } : null,
        author: r?.author ? {
          id: String(r.author.id),
          username: r.author.username ?? null,
          display_name: r.author.display_name ?? null,
          avatar_url: r.author.avatar_url ?? null,
        } : null,
      }));

      setRows(safe);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  if (!ready) return <main className="p-8">Loading…</main>;
  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!me) return <main className="p-8"><Link className="underline" href="/login">Sign in</Link> to see your feed.</main>;
  if (!rows) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your feed</h1>

      {rows.length === 0 ? (
        <p className="text-white/70">No activity yet. Find people to follow from the search or their profiles.</p>
      ) : (
        <ul className="space-y-6">
          {rows.map((r, i) => {
            const author = r.author;
            const game = r.games;
            const stars = (r.rating / 20).toFixed(1);

            return (
              <li key={`${r.created_at}-${i}`} className="flex items-start gap-3">
                {/* author avatar */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={author?.avatar_url || '/avatar-placeholder.svg'}
                  alt="avatar"
                  className="h-10 w-10 rounded-full object-cover border border-white/15"
                />

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80">
                    {author ? (
                      <Link href={author.username ? `/u/${author.username}` : '#'} className="font-medium hover:underline">
                        {author.display_name || author.username || 'Player'}
                      </Link>
                    ) : 'Someone'}
                    {' '}rated{' '}
                    {game ? (
                      <Link href={`/game/${game.id}`} className="hover:underline font-medium">{game.name}</Link>
                    ) : 'a game'}
                    {' '}<span className="text-white/60">· {stars} / 5</span>
                    {' '}<span className="text-white/30">· {new Date(r.created_at).toLocaleDateString()}</span>
                  </div>

                  {r.review && r.review.trim() !== '' && (
                    <p className="mt-2 whitespace-pre-wrap text-white/80">{r.review.trim()}</p>
                  )}
                </div>

                {/* game cover */}
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
    </main>
  );
}