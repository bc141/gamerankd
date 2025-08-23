'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import StarRating from '@/components/StarRating';

// Types
type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Game = { id: number; name: string; cover_url: string | null };
type Review = {
  user_id: string; game_id: number; rating: number; review: string | null; created_at: string;
  author: Profile | null; game: Game | null;
};
type LibRow = { status: 'Playing' | 'Backlog' | 'Completed' | 'Dropped'; updated_at: string; game: Game | null };

export default function HomeClient() {
  const supabase = supabaseBrowser();

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // Center feed
  const [feed, setFeed] = useState<Review[] | null>(null);
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const [feedScope, setFeedScope] = useState<'following' | 'global'>(
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('feed') === 'global') ? 'global' : 'following'
  );

  // Right rail
  const [continueList, setContinueList] = useState<LibRow[] | null>(null);
  const [whoToFollow, setWhoToFollow] = useState<Profile[] | null>(null);
  const [trending, setTrending] = useState<Game[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await waitForSession(supabase);
      if (cancelled) return;
      const uid = session?.user?.id ?? null;
      setMe(uid);
      setReady(true);

      // Get username for the current user
      if (uid) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', uid)
          .single();
        if (!cancelled) {
          setMyUsername(data?.username ?? null);
        }
      }

      // Fire all panels in parallel (feed only if signed in)
      const tasks: Promise<any>[] = [
        fetchTrending().then(v => { if (!cancelled) setTrending(v); }),
        fetchContinue(uid).then(v => { if (!cancelled) setContinueList(v); }),
        fetchWhoToFollow(uid).then(v => { if (!cancelled) setWhoToFollow(v); }),
      ];
      if (uid) {
        if (feedScope === 'following') {
          tasks.push(fetchFeed(uid).then(v => { if (!cancelled) setFeed(v.data); }).catch((e) => !cancelled && setFeedErr(String(e?.message ?? e))));
        } else {
          tasks.push(fetchGlobalFeed().then(v => { if (!cancelled) setFeed(v.data); }).catch((e) => !cancelled && setFeedErr(String(e?.message ?? e))));
        }
      }
      await Promise.all(tasks);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Persist feed scope in URL and refetch feed when scope changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const url = new URLSearchParams(window.location.search);
    if (feedScope === 'global') {
      url.set('feed', 'global');
    } else {
      url.delete('feed');
    }
    
    const newUrl = url.size ? `?${url}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);

    // Refetch feed when scope changes
    if (me && ready) {
      setFeed(null);
      setFeedErr(null);
      if (feedScope === 'following') {
        fetchFeed(me).then(v => setFeed(v.data)).catch((e) => setFeedErr(String(e?.message ?? e)));
      } else {
        fetchGlobalFeed().then(v => setFeed(v.data)).catch((e) => setFeedErr(String(e?.message ?? e)));
      }
    }
  }, [feedScope, me, ready]);

  // ---------- Fetchers ----------
  async function fetchFeed(uid: string): Promise<{ data: Review[] }> {
    // who I follow
    const fl = await supabase.from('follows').select('followee_id').eq('follower_id', uid).limit(400);
    const followedIds = (fl.data ?? []).map((r: any) => String(r.followee_id));
    if (followedIds.length === 0) return { data: [] };

    // latest reviews by followed users
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        user_id, game_id, rating, review, created_at,
        author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
        game:games ( id, name, cover_url )
      `)
      .in('user_id', followedIds)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    const rows = (data ?? []) as any[];
    // normalize
    return {
      data: rows.map(r => ({
        user_id: String(r.user_id),
        game_id: Number(r.game_id),
        rating: Number(r.rating ?? 0),
        review: r.review ?? null,
        created_at: String(r.created_at),
        author: r.author ? {
          id: String(r.author.id),
          username: r.author.username ?? null,
          display_name: r.author.display_name ?? null,
          avatar_url: r.author.avatar_url ?? null,
        } : null,
        game: r.game ? {
          id: Number(r.game.id),
          name: String(r.game.name ?? ''),
          cover_url: r.game.cover_url ?? null,
        } : null,
      })),
    };
  }

  async function fetchGlobalFeed(): Promise<{ data: Review[] }> {
    // Recent reviews from everyone (last 7 days), excluding blocks/mutes
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        user_id, game_id, rating, review, created_at,
        author:profiles!reviews_user_id_profiles_fkey ( id, username, display_name, avatar_url ),
        game:games ( id, name, cover_url )
      `)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    const rows = (data ?? []) as any[];
    // normalize
    return {
      data: rows.map(r => ({
        user_id: String(r.user_id),
        game_id: Number(r.game_id),
        rating: Number(r.rating ?? 0),
        review: r.review ?? null,
        created_at: String(r.created_at),
        author: r.author ? {
          id: String(r.author.id),
          username: r.author.username ?? null,
          display_name: r.author.display_name ?? null,
          avatar_url: r.author.avatar_url ?? null,
        } : null,
        game: r.game ? {
          id: Number(r.game.id),
          name: String(r.game.name ?? ''),
          cover_url: r.game.cover_url ?? null,
        } : null,
      })),
    };
  }

  async function fetchContinue(uid: string | null): Promise<LibRow[]> {
    if (!uid) return [];
    const { data, error } = await supabase
      .from('library')
      .select('status,updated_at,game:games(id,name,cover_url)')
      .eq('user_id', uid)
      .in('status', ['Playing', 'Backlog'])
      .order('updated_at', { ascending: false })
      .limit(6);
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      status: r.status,
      updated_at: r.updated_at,
      game: r.game ? { id: r.game.id, name: r.game.name, cover_url: r.game.cover_url } : null,
    }));
  }

  async function fetchWhoToFollow(uid: string | null): Promise<Profile[]> {
    // recently active authors in reviews, not me, not already followed
    const recent = await supabase
      .from('reviews')
      .select('user_id')
      .order('created_at', { ascending: false })
      .limit(200);
    const recentIds = Array.from(new Set((recent.data ?? []).map((r: any) => String(r.user_id))));

    const exclude = new Set<string>();
    if (uid) {
      exclude.add(uid);
      const fl = await supabase.from('follows').select('followee_id').eq('follower_id', uid).limit(1000);
      (fl.data ?? []).forEach((r: any) => exclude.add(String(r.followee_id)));
    }

    const candidates = recentIds.filter(id => !exclude.has(id)).slice(0, 12);
    if (candidates.length === 0) return [];

    const { data } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url')
      .in('id', candidates);

    return (data ?? []).map((p: any) => ({
      id: String(p.id),
      username: p.username ?? null,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
    }));
  }

  async function fetchTrending(): Promise<Game[]> {
    try {
      const res = await fetch('/api/games/browse?sections=trending&limit=6', { cache: 'no-store' });
      const json = await res.json();
      const items: any[] = json?.items ?? json?.trending ?? json?.sections?.trending ?? [];
      return items.map((g: any) => ({
        id: Number(g.id),
        name: String(g.name ?? ''),
        cover_url: g.cover_url ?? null,
      }));
    } catch {
      return [];
    }
  }

  // ---------- UI ----------

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* CENTER: Feed */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold">Home</h1>
            {me && (
              <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setFeedScope('following')}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    feedScope === 'following'
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  Following
                </button>
                <button
                  onClick={() => setFeedScope('global')}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    feedScope === 'global'
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  Everyone
                </button>
              </div>
            )}
          </div>
          {!ready ? (
            <p className="text-white/60">Loading…</p>
          ) : me == null ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Sign in to see reviews from people you follow. Meanwhile, check out{' '}
                <Link className="underline" href="/discover">Discover</Link>.
              </p>
            </div>
          ) : feedErr ? (
            <p className="text-red-400">{feedErr}</p>
          ) : feed == null ? (
            <p className="text-white/60">Loading your feed…</p>
          ) : feed.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white/80">
                Your feed is empty. Try <Link className="underline" href="/discover">Discover</Link> or follow more players.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {feed.map((r, i) => {
                const stars = Number((r.rating / 20).toFixed(1));
                const a = r.author;
                const g = r.game;
                const actorHref = a?.username ? `/u/${a.username}` : '#';
                const gameHref = g ? `/game/${g.id}` : '#';
                return (
                  <li key={`${r.user_id}-${r.game_id}-${r.created_at}-${i}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a?.avatar_url || '/avatar-placeholder.svg'}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-white/90">
                          <Link className="font-medium hover:underline" href={actorHref}>
                            {a?.display_name || a?.username || 'Player'}
                          </Link>{' '}
                          rated{' '}
                          <Link className="font-medium hover:underline" href={gameHref}>
                            {g?.name ?? 'a game'}
                          </Link>{' '}
                          <span className="text-white/70">{stars} / 5</span>
                        </div>
                        <div className="text-xs text-white/40">{timeAgo(r.created_at)}</div>
                      </div>
                      {g?.cover_url && (
                        <Link href={gameHref} className="ml-auto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.cover_url}
                            alt=""
                            className="h-12 w-9 rounded object-cover border border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                      )}
                    </div>
                    {r.review?.trim() && (
                      <p className="mt-2 whitespace-pre-wrap text-white/85">{r.review.trim()}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT RAIL */}
        <aside className="space-y-6">
          {/* Continue playing */}
          <div className="rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white/90">Continue playing</h2>
              {me && <Link href={myUsername ? `/u/${myUsername}/library?status=playing` : '/login'} className="text-xs text-white/60 hover:text-white">See all</Link>}
            </div>
            {!me ? (
              <div className="p-3 text-sm text-white/60">Sign in to see your library.</div>
            ) : continueList == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : continueList.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No games yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {continueList.map((r, i) => (
                  <li key={`${r.game?.id}-${i}`}>
                    <Link href={r.game ? `/game/${r.game.id}` : '#'} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.game?.cover_url || '/avatar-placeholder.svg'}
                        alt={r.game?.name || ''}
                        className="h-24 w-full rounded object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[11px] text-white/80 truncate">{r.game?.name}</div>
                      <div className="text-[10px] text-white/40">{r.status} · {timeAgo(r.updated_at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Who to follow */}
          <div className="rounded-lg border border-white/10 bg-white/5">
            <div className="px-3 py-2 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white/90">Who to follow</h2>
            </div>
            {whoToFollow == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : whoToFollow.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No suggestions right now.</div>
            ) : (
              <ul className="p-2 space-y-2">
                {whoToFollow.map(u => {
                  const href = u.username ? `/u/${u.username}` : '#';
                  return (
                    <li key={u.id} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.avatar_url || '/avatar-placeholder.svg'}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{u.display_name || u.username || 'Player'}</div>
                        {u.username && <div className="text-xs text-white/40 truncate">@{u.username}</div>}
                      </Link>
                      <FollowButton targetId={u.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Trending this week */}
          <div className="rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white/90">Trending this week</h2>
              <Link href="/discover" className="text-xs text-white/60 hover:text-white">Discover</Link>
            </div>
            {trending == null ? (
              <div className="p-3 text-sm text-white/60">Loading…</div>
            ) : trending.length === 0 ? (
              <div className="p-3 text-sm text-white/60">Nothing yet.</div>
            ) : (
              <ul className="p-2 grid grid-cols-3 gap-2">
                {trending.map(g => (
                  <li key={g.id}>
                    <Link href={`/game/${g.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.cover_url || '/avatar-placeholder.svg'}
                        alt={g.name}
                        className="h-24 w-full rounded object-cover border border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="mt-1 text-[11px] text-white/80 truncate">{g.name}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

/** Lightweight follow button (optimistic). */
function FollowButton({ targetId }: { targetId: string }) {
  const supabase = supabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <button
      disabled={busy || done}
      onClick={async () => {
        setBusy(true);
        try {
          const session = await waitForSession(supabase);
          const uid = session?.user?.id;
          if (!uid) { window.location.href = '/login'; return; }
          await supabase.from('follows').insert({ follower_id: uid, followee_id: targetId });
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
      className={`text-xs px-2 py-1 rounded border ${
        done ? 'border-white/20 text-white/40' : 'border-white/20 hover:border-white/30'
      }`}
    >
      {done ? 'Following' : busy ? '…' : 'Follow'}
    </button>
  );
}
