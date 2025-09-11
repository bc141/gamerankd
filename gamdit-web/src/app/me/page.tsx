// src/app/me/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import StarRating from '@/components/StarRating';

const from100 = (n: number) => n / 20;

export default function MePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { router.replace('/login'); return; }
        setUserEmail(user.email ?? user.id);

        // simple join; if embed ever fails, still set [] so UI doesn’t hang
        const { data, error } = await supabase
          .from('reviews')
          .select('rating, created_at, game_id, games:game_id (id, name, cover_url)')
          .eq('user_id', user.id)
          .order('rating', { ascending: false })
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (error) setError(error.message);
        setRows(data ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Something went wrong');
        setRows([]); // prevent infinite "Loading…"
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!rows) return <main className="p-8">Loading…</main>;
  if (error)  return <main className="p-8 text-red-500">{error}</main>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-2">Your profile</h1>
      <p className="text-sm text-white/60 mb-6">{userEmail}</p>

      {rows.length === 0 ? (
        <p className="text-white/70">No ratings yet. Go rate some games!</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.games?.cover_url ?? ''} alt={r.games?.name ?? 'cover'} className="h-16 w-12 object-cover rounded" />
              <div className="flex-1">
                <a href={`/game/${r.games?.id}`} className="font-medium hover:underline">{r.games?.name}</a>
                <div className="flex items-center gap-2">
                  <StarRating value={from100(r.rating)} readOnly size={18} />
                  <span className="text-sm text-white/60">{from100(r.rating).toFixed(1)} / 5</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}