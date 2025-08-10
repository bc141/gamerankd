'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import StarRating from '@/components/StarRating';

type Review = { user_id: string; rating: number; review?: string | null };
type Game = {
  id: number;
  name: string;
  summary: string | null;
  cover_url: string | null;
  reviews?: Review[];
};

// helpers (db keeps 1–100, UI is 0.5 steps out of 5)
const to100 = (stars: number) => Math.round(stars * 20); // 3.5 -> 70
const from100 = (score: number) => score / 20;           // 78  -> 3.9

export default function GamePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const idParam = Array.isArray((params as any)?.id)
    ? (params as any).id[0]
    : (params as any)?.id;
  const gameId = Number(idParam);
  const validId = Number.isFinite(gameId);

  // session / readiness
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  // data + UI state
  const [game, setGame] = useState<Game | null>(null);
  const [myStars, setMyStars] = useState<number | null>(null);     // committed rating
  const [tempStars, setTempStars] = useState<number | null>(null); // editing buffer
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Hydrate session first to avoid “signed out” flash
  useEffect(() => {
    if (!validId) return;

    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      const user = session?.user ?? null;
      if (!mounted) return;

      setMe(user ? { id: user.id } : null);
      setReady(true);

      // then load game + my rating
      const { data, error } = await supabase
        .from('games')
        .select('id,name,summary,cover_url,reviews(user_id,rating,review)')
        .eq('id', gameId)
        .single();

      if (!mounted) return;
      if (error) {
        setError(error.message);
        return;
      }
      const g = data as Game | null;
      setGame(g);

      // preload my rating (if signed in and present)
      if (user && g?.reviews?.length) {
        const mine = g.reviews.find(r => r.user_id === user.id);
        if (mine) {
          const stars = from100(mine.rating);
          setMyStars(stars);
          setTempStars(stars);
        } else {
          setMyStars(null);
          setTempStars(null);
        }
      } else {
        setMyStars(null);
        setTempStars(null);
      }
    })();

    return () => { mounted = false; };
  }, [validId, gameId, supabase]);

  // 2) helpers
  const refetchGame = async () => {
    const { data } = await supabase
      .from('games')
      .select('id,name,summary,cover_url,reviews(user_id,rating,review)')
      .eq('id', gameId)
      .single();
    setGame(data as Game);
  };

  const avgStars = useMemo(() => {
    const list = game?.reviews ?? [];
    if (!list.length) return null;
    const sum = list.reduce((t, r) => t + (r.rating || 0), 0);
    return Number((sum / list.length / 20).toFixed(1));
  }, [game]);

  const ratingsCount = game?.reviews?.length ?? 0;

  // 3) actions
  async function saveRating() {
    if (!me) return router.push('/login');
    if (!validId) return setError('Invalid game id.');
    if (tempStars == null) return;

    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from('reviews')
      .upsert(
        { user_id: me.id, game_id: gameId, rating: to100(tempStars) },
        { onConflict: 'user_id,game_id' } // ✅ update existing row instead of inserting duplicate
      );
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMyStars(tempStars);
    setEditing(false);
    await refetchGame();
  }

  async function removeRating() {
    if (!me) return router.push('/login');
    if (!validId) return setError('Invalid game id.');

    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('user_id', me.id)
      .eq('game_id', gameId);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMyStars(null);
    setTempStars(null);
    setEditing(false);
    await refetchGame();
  }

  // 4) UI branches
  if (!validId) return <main className="p-8 text-red-600">Invalid game URL.</main>;
  if (error) return <main className="p-8 text-red-600">{error}</main>;
  if (!game) return <main className="p-8">Loading…</main>;

  const showAuthControls = ready; // only decide after hydration

  return (
    <main className="p-8 max-w-2xl mx-auto text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={game.cover_url ?? ''}
        alt={game.name}
        className="rounded mb-4 max-h-[360px] object-cover"
      />

      <h1 className="text-3xl font-bold">{game.name}</h1>

      {/* Community average */}
      <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
        <StarRating value={avgStars ?? 0} readOnly size={18} />
        <span>{avgStars == null ? 'No ratings yet' : `${avgStars} / 5`}</span>
        <span className="text-white/40">· {ratingsCount} rating{ratingsCount === 1 ? '' : 's'}</span>
      </div>

      {/* My rating controls */}
      <div className="mt-5 flex items-center gap-3">
        {showAuthControls && me ? (
          <>
            {myStars != null && !editing ? (
              <>
                <StarRating value={myStars} readOnly />
                <button
                  onClick={() => {
                    setEditing(true);
                    setTempStars(myStars);
                  }}
                  className="bg-indigo-600 text-white px-3 py-1 rounded"
                >
                  Change
                </button>
                <button
                  onClick={removeRating}
                  className="bg-white/10 px-3 py-1 rounded"
                  disabled={saving}
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <StarRating
                  value={tempStars ?? 0}
                  onChange={setTempStars}   // 0.5 steps via hover
                />
                <button
                  onClick={saveRating}
                  disabled={saving || tempStars == null}
                  className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50"
                >
                  {saving ? 'Saving…' : (myStars == null ? 'Rate' : 'Save')}
                </button>
                {myStars != null && (
                  <button
                    onClick={() => {
                      setEditing(false);
                      setTempStars(myStars);
                    }}
                    className="bg-white/10 px-3 py-1 rounded"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          // don’t show “Sign in” until auth hydration completes
          showAuthControls ? (
            <a className="underline" href="/login">Sign in to rate</a>
          ) : null
        )}
      </div>

      {/* Summary */}
      <p className="mt-6 whitespace-pre-wrap text-gray-200">{game.summary}</p>
    </main>
  );
}