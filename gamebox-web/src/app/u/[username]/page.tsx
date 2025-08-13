'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';
import { waitForSession } from '@/lib/waitForSession';

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
  review: string | null; // NEW: text review
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
};

export default function PublicProfilePage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1) Hydrate auth (prevents brief “signed out” flashes)
  useEffect(() => {
    let mounted = true;
    (async () => {
      await waitForSession(supabase); // fine if logged out
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // 2) Fetch profile + their ratings
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

      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select('rating, review, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', prof.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        return;
      }

      // Normalize into ReviewRow[]
      const safeRows: ReviewRow[] = (reviewsData ?? []).map((r: any) => ({
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

      if (!cancelled) setRows(safeRows);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, slug, supabase]);

  const avatarSrc = useMemo(
    () =>
      profile?.avatar_url && profile.avatar_url.trim() !== ''
        ? profile.avatar_url
        : '/avatar-placeholder.svg',
    [profile?.avatar_url]
  );

  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!ready || !profile || !rows) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      {/* Profile header */}
      <section className="flex items-center gap-4">
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
        </div>
      </section>

      {/* Reviews list */}
      {rows.length === 0 ? (
        <p className="mt-8 text-white/70">No ratings yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {rows.map((r, i) => {
            const stars = from100(r.rating);
            const gameId = r.games?.id;
            const gameName = r.games?.name ?? 'Unknown game';
            const cover = r.games?.cover_url ?? '';

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
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating value={stars} readOnly size={18} />
                    <span className="text-sm text-white/60">
                      {stars.toFixed(1)} / 5
                    </span>
                    <span className="text-white/30">·</span>
                    <span className="text-xs text-white/40">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* NEW: text review, if present */}
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