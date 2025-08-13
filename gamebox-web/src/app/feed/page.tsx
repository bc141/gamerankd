'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import StarRating from '@/components/StarRating';

const from100 = (n: number) => n / 20;

type FeedRow = {
  rating: number;
  review: string | null;
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
  profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
};

export default function FeedPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hydrate session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      const user = session?.user ?? null;
      if (!user) {
        router.replace('/login');
        return;
      }
      setMe({ id: user.id });
      setReady(true);
    })();
    return () => { mounted = false; };
  }, [supabase, router]);

  // load feed
  useEffect(() => {
    if (!ready || !me) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      // who am I following?
      const { data: following, error: fErr } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', me.id);

      if (cancelled) return;
      if (fErr) {
        setError(fErr.message);
        setRows([]);
        setEmpty(true);
        setLoading(false);
        return;
      }

      const ids = (following ?? []).map(f => f.followee_id);
      if (ids.length === 0) {
        setRows([]);
        setEmpty(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          rating, review, created_at,
          games:game_id ( id, name, cover_url ),
          profiles:user_id ( id, username, display_name, avatar_url )
        `)
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(30);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setRows([]);
        setEmpty(true);
      } else {
        // ✅ Normalize shape so TS is happy
        const list = Array.isArray(data) ? data : [];
        const safe: FeedRow[] = list.map((r: any) => ({
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
          profiles: r?.profiles
            ? {
                id: String(r.profiles.id),
                username: String(r.profiles.username),
                display_name: r.profiles.display_name ?? null,
                avatar_url: r.profiles.avatar_url ?? null,
              }
            : null,
        }));
        setRows(safe);
        setEmpty(safe.length === 0);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [ready, me, supabase]);

  const content = useMemo(() => {
    if (loading) return <p>Loading…</p>;
    if (error) return <p className="text-red-400">Error: {error}</p>;
    if (empty) {
      return (
        <div className="text-white/70">
          Your feed is empty. Follow people to see their ratings here.
          <div className="mt-2">
            <a href="/search" className="underline">Search games</a>
          </div>
        </div>
      );
    }

    return (
      <ul className="space-y-6">
        {rows.map((r, i) => {
          const user = r.profiles;
          const game = r.games;
          const stars = from100(r.rating);
          const avatar = user?.avatar_url || '/avatar-placeholder.svg';

          return (
            <li key={`${user?.id ?? 'u'}-${game?.id ?? 'g'}-${i}`} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt="avatar"
                className="h-10 w-10 rounded-full object-cover border border-white/20"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/80">
                  <a href={user ? `/u/${user.username}` : '#'} className="font-medium hover:underline">
                    {user?.display_name || user?.username || 'Someone'}
                  </a>
                  <span className="text-white/40"> rated </span>
                  <a href={game ? `/game/${game.id}` : '#'} className="hover:underline">
                    {game?.name ?? 'a game'}
                  </a>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StarRating value={stars} readOnly size={18} />
                  <span className="text-sm text-white/60">{stars.toFixed(1)} / 5</span>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/40">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.review && r.review.trim() !== '' && (
                  <p className="text-white/70 mt-2 whitespace-pre-wrap break-words">
                    {r.review.trim()}
                  </p>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={game?.cover_url ?? ''}
                alt={game?.name ?? 'cover'}
                className="h-14 w-10 object-cover rounded border border-white/10"
              />
            </li>
          );
        })}
      </ul>
    );
  }, [rows, loading, empty, error]);

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your feed</h1>
      {content}
    </main>
  );
}