'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import StarRating from '@/components/StarRating';

// ── helpers ────────────────────────────────────────────────────────────────────
const from100 = (n: number) => n / 20;

// ── types ──────────────────────────────────────────────────────────────────────
type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  rating: number;
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
};

// ── page ───────────────────────────────────────────────────────────────────────
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

  // 1) Hydrate session first (prevents brief "signed out" flashes)
  useEffect(() => {
    let mounted = true;
    (async () => {
      await waitForSession(supabase);
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // 2) Fetch profile + reviews once hydrated
  useEffect(() => {
    if (!ready || !slug) return;

    (async () => {
      setError(null);

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,username,display_name,bio,avatar_url')
        .eq('username', String(slug).toLowerCase())
        .single();

      if (pErr || !prof) {
        setError('Profile not found');
        return;
      }
      setProfile(prof as Profile);

      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('rating, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', prof.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }

      // Normalize to a typed array (avoids TS casting gripes)
      const normalized: ReviewRow[] = (reviews ?? []).map((r: any) => ({
        rating: r?.rating ?? 0,
        created_at: r?.created_at ?? '',
        games: r?.games
          ? {
              id: r.games.id as number,
              name: r.games.name as string,
              cover_url: (r.games.cover_url as string | null) ?? null,
            }
          : null,
      }));
      setRows(normalized);
    })();
  }, [ready, slug, supabase]);

  // ── UI states ────────────────────────────────────────────────────────────────
  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!ready || !profile || !rows) return <main className="p-8">Loading…</main>;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">
        {profile.display_name || profile.username}
      </h1>
      {profile.display_name && (
        <div className="text-white/60">@{profile.username}</div>
      )}
      {profile.bio && <p className="text-white/70 mt-1">{profile.bio}</p>}

      {rows.length === 0 ? (
        <p className="mt-6 text-white/70">No ratings yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.games?.cover_url ?? ''}
                alt={r.games?.name ?? 'cover'}
                className="h-16 w-12 object-cover rounded"
              />
              <div className="flex-1">
                {r.games ? (
                  <a
                    href={`/game/${r.games.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.games.name}
                  </a>
                ) : (
                  <span className="font-medium text-white/70">Unknown game</span>
                )}
                <div className="flex items-center gap-2">
                  <StarRating value={from100(r.rating)} readOnly size={18} />
                  <span className="text-sm text-white/60">
                    {from100(r.rating).toFixed(1)} / 5
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}