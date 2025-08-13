'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import StarRating from '@/components/StarRating';

// ---------- helpers ----------
const to100 = (stars: number) => Math.round(stars * 20); // 3.5 -> 70
const from100 = (score: number) => score / 20;           // 78  -> 3.9
const MAX_REVIEW_LEN = 500;

// ---------- types ----------
type Review = { user_id: string; rating: number; review?: string | null };

type Game = {
  id: number;
  name: string;
  summary: string | null;
  cover_url: string | null;
  reviews?: Review[];
};

type RawRecent = {
  created_at?: string | null;
  rating?: number | null;
  review?: string | null;
  author?: {
    id?: string | null;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type RecentItem = {
  created_at: string;
  rating: number; // 1–100
  review: string | null;
  author: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

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
  const [myText, setMyText] = useState<string>('');

  // editing buffers
  const [tempStars, setTempStars] = useState<number | null>(null);
  const [tempText, setTempText] = useState<string>('');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // recent reviews for this game
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentErr, setRecentErr] = useState<string | null>(null);

  // 1) Hydrate session first to avoid “signed out” flash, then load game + my rating and recent reviews
  useEffect(() => {
    if (!validId) return;

    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      const user = session?.user ?? null;
      if (!mounted) return;

      setMe(user ? { id: user.id } : null);
      setReady(true);

      // Load game with embedded reviews (for avg + my rating preload)
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

      // recent reviews list
      await refetchRecent();
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

  const refetchRecent = async () => {
    setRecentErr(null);

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        created_at,
        rating,
        review,
        author:profiles!reviews_user_id_profiles_fkey (
          id, username, display_name, avatar_url
        )
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      setRecentErr(error.message);
      setRecent([]);
      return;
    }

    const rows: RawRecent[] = Array.isArray(data) ? (data as RawRecent[]) : [];

    setRecent(
      rows.map((r) => ({
        created_at: r.created_at ?? new Date(0).toISOString(),
        rating: typeof r.rating === 'number' ? r.rating : 0,
        review: r.review ?? null,
        author:
          r.author && r.author.id
            ? {
                id: String(r.author.id),
                username: r.author.username ?? null,
                display_name: r.author.display_name ?? null,
                avatar_url: r.author.avatar_url ?? null,
              }
            : null,
      }))
    );
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
  try {
    const payload = {
      user_id: me.id,
      game_id: gameId,
      rating: to100(tempStars),
      review: trimmed.length ? trimmed : null,
    };

    // Key fix: declare the conflict target so updates don’t hit the unique index
    const { error } = await supabase
      .from('reviews')
      .upsert(payload, { onConflict: 'user_id,game_id' });

    if (error) {
      setError(error.message);
      return;
    }

    setMyStars(tempStars);
    setMyText(trimmed);
    setEditing(false);

    // refresh UI
    await Promise.all([refetchGame(), refetchRecent()]);
  } finally {
    setSaving(false);
  }
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
    await Promise.all([refetchGame(), refetchRecent()]);
  }

  // 4) UI branches
  if (!validId) return <main className="p-8 text-red-600">Invalid game URL.</main>;
  if (error) return <main className="p-8 text-red-600">{error}</main>;
  if (!game) return <main className="p-8">Loading…</main>;

  const showAuthControls = ready; // only decide after hydration

  return (
    <main className="p-8 max-w-4xl mx-auto text-white">
      {/* Cover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={game.cover_url ?? ''}
        alt={game.name}
        className="rounded mb-4 max-h-[360px] object-cover"
      />

      {/* Title */}
      <h1 className="text-3xl font-bold">{game.name}</h1>

      {/* Community average + quick CTA */}
      <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
        <StarRating value={avgStars ?? 0} readOnly size={18} />
        <span>{avgStars == null ? 'No ratings yet' : `${avgStars} / 5`}</span>
        <span className="text-white/40">· {ratingsCount} rating{ratingsCount === 1 ? '' : 's'}</span>

        {/* NEW: quick jump to editor (engagement micro-boost) */}
        {showAuthControls && me && (
          <button
            onClick={() =>
              document.getElementById('review-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            className="ml-auto px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white/90"
          >
            Write a review
          </button>
        )}
      </div>

      {/* My rating + review controls */}
      <div id="review-editor" className="mt-5 flex flex-col gap-3">
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
                    onChange={setTempStars}
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
          showAuthControls ? (
            <a className="underline" href="/login">Sign in to rate & review</a>
          ) : null
        )}
      </div>

      {/* Summary */}
      {game.summary && (
        <p className="mt-6 whitespace-pre-wrap text-white/80">{game.summary}</p>
      )}

      {/* Recent reviews */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Recent reviews</h2>

        {recentErr && <p className="text-red-400 text-sm mb-2">{recentErr}</p>}

        {recent.length === 0 ? (
          <p className="text-white/60">No recent activity.</p>
        ) : (
          <ul className="space-y-5">
            {recent.map((r, i) => {
              const stars = (r.rating / 20).toFixed(1);
              const a = r.author;
              return (
                <li key={`${r.created_at}-${i}`} className="flex items-start gap-3">
                  {/* avatar */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a?.avatar_url || '/avatar-placeholder.svg'}
                    alt="avatar"
                    className="h-9 w-9 rounded-full object-cover border border-white/15"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80">
                      {a ? (
                        <Link
                          href={a.username ? `/u/${a.username}` : '#'}
                          className="font-medium hover:underline"
                        >
                          {a.display_name || a.username || 'Player'}
                        </Link>
                      ) : 'Someone'}
                      {' '}rated{' '}
                      <span className="text-white/60">{stars} / 5</span>
                      {' '}<span className="text-white/30">· {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    {r.review && r.review.trim() !== '' && (
                      <p className="mt-1 whitespace-pre-wrap text-white/85">{r.review.trim()}</p>
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