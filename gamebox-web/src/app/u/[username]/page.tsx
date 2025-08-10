'use client';

import { useEffect, useState } from 'react';
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

export default function PublicProfilePage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  const [ready, setReady] = useState(false);         // ← waits for session hydration
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // STEP 2: hydrate the auth session before we fetch (tolerates route changes)
  useEffect(() => {
    let mounted = true;
    (async () => {
      await waitForSession(supabase);  // ok if user is logged out; we just wait briefly
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  // Fetch profile + ratings once session hydration is done
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
      setProfile(prof);

      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('rating, created_at, games:game_id (id,name,cover_url)')
        .eq('user_id', prof.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) setError(error.message);
      else setRows(reviews ?? []);
    })();
  }, [ready, slug, supabase]);

  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!ready || !profile || !rows) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
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
                <a href={`/game/${r.games?.id}`} className="font-medium hover:underline">
                  {r.games?.name}
                </a>
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