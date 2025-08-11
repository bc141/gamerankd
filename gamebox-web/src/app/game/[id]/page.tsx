'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import StarRating from '@/components/StarRating';

type ReviewRow = { user_id: string; rating: number; review: string | null; created_at: string };
type Game = {
  id: number;
  name: string;
  summary: string | null;
  cover_url: string | null;
  reviews?: ReviewRow[];
};

type Profile = { id: string; username: string | null; display_name: string | null };

const to100 = (stars: number) => Math.round(stars * 20);
const from100 = (score: number) => score / 20;

export default function GamePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const idParam = Array.isArray((params as any)?.id) ? (params as any).id[0] : (params as any)?.id;
  const gameId = Number(idParam);
  const validId = Number.isFinite(gameId);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  const [game, setGame] = useState<Game | null>(null);

  const [myStars, setMyStars] = useState<number | null>(null);     // committed
  const [tempStars, setTempStars] = useState<number | null>(null); // editing

  const [myReview, setMyReview] = useState<string>('');            // committed text
  const [tempReview, setTempReview] = useState<string>('');        // editing text

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recent, setRecent] = useState<Array<ReviewRow & { user?: Profile }>>([]);

  // hydrate session, load game + my rating/review + recent reviews
  useEffect(() => {
    if (!validId) return;
    let mounted = true;

    (async () => {
      const session = await waitForSession(supabase);
      const user = session?.user ?? null;
      if (!mounted) return;

      setMe(user ? { id: user.id } : null);
      setReady(true);

      const { data, error } = await supabase
        .from('games')
        .select('id,name,summary,cover_url,reviews(user_id,rating,review,created_at)')
        .eq('id', gameId)
        .single();

      if (!mounted) return;
      if (error) {
        setError(error.message);
        return;
      }

      const g = data as Game | null;
      setGame(g);

      // preload my rating + review
      if (user && g?.reviews?.length) {
        const mine = g.reviews.find(r => r.user_id === user.id);
        if (mine) {
          const stars = from100(mine.rating);
          setMyStars(stars);
          setTempStars(stars);
          setMyReview(mine.review ?? '');
          setTempReview(mine.review ?? '');
        } else {
          setMyStars(null);
          setTempStars(null);
          setMyReview('');
          setTempReview('');
        }
      } else {
        setMyStars(null);
        setTempStars(null);
        setMyReview('');
        setTempReview('');
      }

      await loadRecent(); // after base load
    })();

    async function loadRecent() {
      // latest 12 reviews for this game
      const { data: revs } = await supabase
        .from('reviews')
        .select('user_id,rating,review,created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(12);

      const list = (revs ?? []) as ReviewRow[];
      const ids = Array.from(new Set(list.map(r => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id,username,display_name')
          .in('id', ids);
        const map = new Map((profs ?? []).map(p => [p.id, p as Profile]));
        setRecent(list.map(r => ({ ...r, user: map.get(r.user_id) })));
      } else {
        setRecent([]);
      }
    }

    return () => { mounted = false; };
  }, [validId, gameId, supabase]);

  const avgStars = useMemo(() => {
    const list = game?.reviews ?? [];
    if (!list.length) return null;
    const sum = list.reduce((t, r) => t + (r.rating || 0), 0);
    return Number((sum / list.length / 20).toFixed(1));
  }, [game]);

  const ratingsCount = game?.reviews?.length ?? 0;

  async function refetchGame() {
    const { data } = await supabase
      .from('games')
      .select('id,name,summary,cover_url,reviews(user_id,rating,review,created_at)')
      .eq('id', gameId)
      .single();
    setGame(data as Game);
  }

  async function saveRatingAndReview() {
    if (!me) return router.push('/login');
    if (!validId) return setError('Invalid game id.');
    if (tempStars == null) return;

    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from('reviews')
      .upsert(
        {
          user_id: me.id,
          game_id: gameId,
          rating: to100(tempStars),
          review: tempReview.trim() || null,
        },
        { onConflict: 'user_id,game_id' }
      );
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMyStars(tempStars);
    setMyReview(tempReview);
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

    if (error) return setError(error.message);

    setMyStars(null);
    setTempStars(null);
    setMyReview('');
    setTempReview('');
    setEditing(false);
    await refetchGame();
  }

  if (!validId) return <main className="p-8 text-red-600">Invalid game URL.</main>;
  if (error) return <main className="p-8 text-red-600">{error}</main>;
  if (!game) return <main className="p-8">Loading…</main>;

  const showAuthControls = ready;

  return (
    <main className="p-8 max-w-2xl mx-auto text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={game.cover_url ?? ''} alt={game.name} className="rounded mb-4 max-h-[360px] object-cover" />

      <h1 className="text-3xl font-bold">{game.name}</h1>

      <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
        <StarRating value={avgStars ?? 0} readOnly size={18} />
        <span>{avgStars == null ? 'No ratings yet' : `${avgStars} / 5`}</span>
        <span className="text-white/40">· {ratingsCount} rating{ratingsCount === 1 ? '' : 's'}</span>
      </div>

      {/* My rating + review */}
      <div className="mt-5 space-y-3">
        {showAuthControls && me ? (
          <>
            {myStars != null && !editing ? (
              <div className="flex items-center gap-3">
                <StarRating value={myStars} readOnly />
                {myReview && <span className="text-white/80">{myReview}</span>}
                <button
                  onClick={() => { setEditing(true); setTempStars(myStars); setTempReview(myReview); }}
                  className="bg-indigo-600 text-white px-3 py-1 rounded"
                >
                  Change
                </button>
                <button onClick={removeRating} className="bg-white/10 px-3 py-1 rounded" disabled={saving}>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <StarRating value={tempStars ?? 0} onChange={setTempStars} />
                  <button
                    onClick={saveRatingAndReview}
                    disabled={saving || tempStars == null}
                    className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : (myStars == null ? 'Rate' : 'Save')}
                  </button>
                  {myStars != null && (
                    <button
                      onClick={() => { setEditing(false); setTempStars(myStars); setTempReview(myReview); }}
                      className="bg-white/10 px-3 py-1 rounded"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <textarea
                  value={tempReview}
                  onChange={(e) => setTempReview(e.target.value)}
                  placeholder="Write a short review (optional)…"
                  rows={3}
                  className="w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2"
                />
              </>
            )}
          </>
        ) : (
          showAuthControls ? <a className="underline" href="/login">Sign in to rate & review</a> : null
        )}
      </div>

      {/* Recent community reviews */}
      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-3">Recent reviews</h2>
          <ul className="space-y-4">
            {recent.map((r, i) => (
              <li key={i} className="border border-white/10 rounded p-3">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <StarRating value={from100(r.rating)} readOnly size={16} />
                  <span>{from100(r.rating).toFixed(1)} / 5</span>
                  <span className="text-white/40">· {new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.review && <p className="mt-2">{r.review}</p>}
                <div className="mt-1 text-sm text-white/60">
                  {r.user?.username ? <a className="underline" href={`/u/${r.user.username}`}>{r.user.display_name || r.user.username}</a> : 'Unknown user'}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary */}
      <p className="mt-8 whitespace-pre-wrap text-gray-200">{game.summary}</p>
    </main>
  );
}