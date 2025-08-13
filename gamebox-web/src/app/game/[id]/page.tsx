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

type RecentReview = {
  user_id: string;
  rating: number;        // 1..100
  review: string | null;
  created_at: string;
};

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

// helpers (db keeps 1–100, UI is 0.5 steps out of 5)
const to100 = (stars: number) => Math.round(stars * 20); // 3.5 -> 70
const from100 = (score: number) => score / 20;           // 78  -> 3.9
const MAX_REVIEW_LEN = 500;

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

  // committed rating/text
  const [myStars, setMyStars] = useState<number | null>(null);
  const [myText, setMyText] = useState<string>(''); // committed

  // editing buffers
  const [tempStars, setTempStars] = useState<number | null>(null);
  const [tempText, setTempText] = useState<string>(''); // draft

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // recent reviews + reviewer profiles
  const [recent, setRecent] = useState<RecentReview[] | null>(null);
  const [reviewers, setReviewers] = useState<Map<string, ProfileLite>>(new Map());

  // 1) Hydrate session first to avoid “signed out” flash, then load game + my rating + recent reviews
  useEffect(() => {
    if (!validId) return;

    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      const user = session?.user ?? null;
      if (!mounted) return;

      setMe(user ? { id: user.id } : null);
      setReady(true);

      // Load game + my rating
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

      // preload my rating + text
      if (user && g?.reviews?.length) {
        const mine = g.reviews.find(r => r.user_id === user.id);
        if (mine) {
          const stars = from100(mine.rating);
          setMyStars(stars);
          setTempStars(stars);
          setMyText(mine.review ?? '');
          setTempText(mine.review ?? '');
        } else {
          setMyStars(null);
          setTempStars(null);
          setMyText('');
          setTempText('');
        }
      } else {
        setMyStars(null);
        setTempStars(null);
        setMyText('');
        setTempText('');
      }

      // Load recent reviews list
      await fetchRecentReviews();
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchRecentReviews = async () => {
    // latest 10 reviews for this game
    const { data: rlist, error: rErr } = await supabase
      .from('reviews')
      .select('user_id,rating,review,created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (rErr) {
      // don't kill the page; just show no recent
      setRecent([]);
      return;
    }

    const rows = (rlist ?? []) as RecentReview[];
    setRecent(rows);

    // fetch minimal profile info for the authors
    const ids = Array.from(new Set(rows.map(r => r.user_id)));
    if (ids.length === 0) {
      setReviewers(new Map());
      return;
    }

    const { data: ppl } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url')
      .in('id', ids);

    const map = new Map<string, ProfileLite>(
      (ppl ?? []).map((p: any) => [p.id as string, {
        id: p.id,
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      }])
    );
    setReviewers(map);
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

    const trimmed = (tempText ?? '').trim();
    if (trimmed.length > MAX_REVIEW_LEN) {
      return setError(`Review is too long (max ${MAX_REVIEW_LEN} chars).`);
    }

    setError(null);
    setSaving(true);
    const { error } = await supabase.from('reviews').upsert({
      user_id: me.id,
      game_id: gameId,
      rating: to100(tempStars),
      review: trimmed.length ? trimmed : null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMyStars(tempStars);
    setMyText(trimmed);
    setEditing(false);
    await refetchGame();
    await fetchRecentReviews(); // refresh the public feed too
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
    setMyText('');
    setTempText('');
    setEditing(false);
    await refetchGame();
    await fetchRecentReviews();
  }

  // 4) UI branches
  if (!validId) return <main className="p-8 text-red-600">Invalid game URL.</main>;
  if (error) return <main className="p-8 text-red-600">{error}</main>;
  if (!game) return <main className="p-8">Loading…</main>;

  const showAuthControls = ready; // only decide after hydration

  return (
    <main className="p-8 max-w-2xl mx-auto text-white">
      {/* cover */}
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

      {/* My rating + review controls */}
      <div className="mt-5 flex flex-col gap-3">
        {showAuthControls && me ? (
          <>
            {myStars != null && !editing ? (
              <>
                <div className="flex items-center gap-3">
                  <StarRating value={myStars} readOnly />
                  <button
                    onClick={() => {
                      setEditing(true);
                      setTempStars(myStars);
                      setTempText(myText);
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
                </div>
                {myText && (
                  <p className="text-white/80 whitespace-pre-wrap mt-1">{myText}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <StarRating
                    value={tempStars ?? 0}
                    onChange={setTempStars}   // 0.5 steps via hover/click
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
                        setTempText(myText);
                      }}
                      className="bg-white/10 px-3 py-1 rounded"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Review text area */}
                <textarea
                  value={tempText}
                  onChange={(e) => setTempText(e.target.value)}
                  placeholder="Add an optional short review (max 500 chars)…"
                  rows={4}
                  maxLength={MAX_REVIEW_LEN}
                  className="mt-2 w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2"
                />
                <div className="text-xs text-white/50">
                  {tempText.length}/{MAX_REVIEW_LEN}
                </div>
              </>
            )}
          </>
        ) : (
          // don’t show “Sign in” until auth hydration completes
          showAuthControls ? (
            <a className="underline" href="/login">Sign in to rate & review</a>
          ) : null
        )}
      </div>

      {/* Summary */}
      {game.summary && (
        <p className="mt-6 whitespace-pre-wrap text-gray-200">{game.summary}</p>
      )}

      {/* Recent reviews from everyone */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Recent reviews</h2>

        {recent == null ? (
          <p className="text-white/60">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-white/60">No reviews yet.</p>
        ) : (
          <ul className="space-y-4">
            {recent.map((r, i) => {
              const u = reviewers.get(r.user_id);
              const name = u?.display_name || u?.username || 'Anonymous';
              const avatar =
                u?.avatar_url && u.avatar_url.trim() !== ''
                  ? u.avatar_url
                  : '/avatar-placeholder.svg';

              return (
                <li key={`${r.user_id}-${i}`} className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt={name}
                    className="h-8 w-8 rounded-full object-cover border border-white/10"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {u?.username ? (
                        <a
                          href={`/u/${u.username}`}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </a>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                      <span className="text-xs text-white/40">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <StarRating value={from100(r.rating)} readOnly size={16} />
                      <span className="text-sm text-white/60">
                        {from100(r.rating).toFixed(1)} / 5
                      </span>
                    </div>

                    {r.review && r.review.trim() !== '' && (
                      <p className="mt-2 text-white/70 whitespace-pre-wrap break-words">
                        {r.review.trim()}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}