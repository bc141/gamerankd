'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { toggleFollow } from '@/lib/follows';

type Mini = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Ranked = Mini & {
  score: number;
  recentCount: number;
  followersCount: number;
  followsYou: boolean;
};

const DEFAULT_LIMIT = 6;
const SHOW_MORE_STEP = 6;
const LOOKBACK_DAYS = 30;
const DISMISS_KEY = 'wtf:dismissed:v1';

// deterministic shuffle (stable per viewer/day)
function seededShuffle<T>(arr: T[], seed: string) {
  const a = arr.slice();
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}
function saveDismissed(s: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  } catch {}
}

export default function WhoToFollow({ limit = DEFAULT_LIMIT }: { limit?: number }) {
  const supabase = supabaseBrowser();

  const [me, setMe] = useState<string | null>(null);
  const [pool, setPool] = useState<Ranked[] | null>(null); // pre-ranked big list
  const [targetCount, setTargetCount] = useState<number>(limit);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // load dismissed once
  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      const myId = session?.user?.id ?? null;
      setMe(myId);

      // Build exclude set: self + already-followed
      const exclude = new Set<string>();
      if (myId) exclude.add(myId);

      let followingSet = new Set<string>();
      if (myId) {
        const { data: flw } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', myId);
        for (const r of flw ?? []) {
          const id = r.followee_id as string;
          if (id) {
            followingSet.add(id);
            exclude.add(id);
          }
        }
      }

      // Followers-of-me (for "Follow back" and score boost)
      let followersOfMe = new Set<string>();
      if (myId) {
        const { data: back } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('followee_id', myId);
        for (const r of back ?? []) {
          const id = r.follower_id as string;
          if (id && id !== myId && !followingSet.has(id)) {
            followersOfMe.add(id);
          }
        }
      }

      // 1) recent activity map
      const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('reviews')
        .select('user_id, created_at')
        .gte('created_at', sinceIso)
        .limit(2000);

      const recentMap = new Map<string, number>();
      for (const r of recent ?? []) {
        const uid = r.user_id as string;
        if (!uid || exclude.has(uid)) continue;
        recentMap.set(uid, (recentMap.get(uid) ?? 0) + 1);
      }

      // 2) popularity map
      const { data: pop } = await supabase
        .from('follows')
        .select('followee_id')
        .limit(4000);
      const followersMap = new Map<string, number>();
      for (const r of pop ?? []) {
        const uid = r.followee_id as string;
        if (!uid || exclude.has(uid)) continue;
        followersMap.set(uid, (followersMap.get(uid) ?? 0) + 1);
      }

      // 3) candidates
      const candidateIds = new Set<string>([
        ...recentMap.keys(),
        ...followersMap.keys(),
        ...followersOfMe.values(),
      ]);

      if (!candidateIds.size) {
        if (mounted) setPool([]);
        return;
      }

      // 4) fetch profiles for candidates
      const idList = [...candidateIds];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', idList);

      // 5) rank
      const W_RECENT = 3.0;
      const W_FOLLOW = 1.0;
      const BONUS_FOLLOWS_YOU = 2.0;

      const raw: Ranked[] = [];
      const profById = new Map<string, Mini>();
      for (const p of profs ?? []) {
        profById.set(p.id, {
          id: p.id,
          username: p.username ?? null,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }

      for (const id of candidateIds) {
        const mini = profById.get(id);
        if (!mini) continue;
        const rc = recentMap.get(id) ?? 0;
        const fc = followersMap.get(id) ?? 0;
        const fy = followersOfMe.has(id);
        const base = rc * W_RECENT + fc * W_FOLLOW + (fy ? BONUS_FOLLOWS_YOU : 0);
        raw.push({
          ...mini,
          score: base + Math.random() * 0.1,
          recentCount: rc,
          followersCount: fc,
          followsYou: fy,
        });
      }

      // sort by score, deterministic shuffle inside the top slice (seed with user + day)
      raw.sort((a, b) => b.score - a.score);
      const daySeed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const seeded = myId ? seededShuffle(raw, `${myId}:${daySeed}`) : raw;

      if (mounted) setPool(seeded);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // filtered visible list from the pool
  const visible = useMemo(() => {
    if (!pool) return null;
    const list = pool.filter(u => !dismissed.has(u.id)).slice(0, targetCount);
    return list;
  }, [pool, dismissed, targetCount]);

  const remainingCount = useMemo(() => {
    if (!pool) return 0;
    return pool.filter(u => !dismissed.has(u.id)).length - (visible?.length ?? 0);
  }, [pool, dismissed, visible]);

  const handleDismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  if (pool === null) {
    // skeleton
    return (
      <div className="space-y-3">
        {[...Array(DEFAULT_LIMIT)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!visible?.length) {
    return <div className="text-sm text-white/60">No suggestions right now.</div>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {visible.map((u) => {
          const reason =
            u.followsYou
              ? 'Follows you'
              : u.recentCount > 0
                ? (u.recentCount >= 3 ? `Active · ${u.recentCount} reviews this month` : `Active this month`)
                : (u.followersCount > 0 ? `Popular · ${u.followersCount} followers` : undefined);

          return (
            <li key={u.id} className="flex items-center justify-between gap-3">
              <Link
                href={u.username ? `/u/${u.username}` : '#'}
                className="flex items-center gap-3 min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.avatar_url || '/avatar-placeholder.svg'}
                  alt="avatar"
                  className="h-9 w-9 rounded-full object-cover border border-white/15"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {u.display_name || u.username || 'Player'}
                  </div>
                  <div className="text-xs text-white/50 truncate">
                    {reason || (u.username ? `@${u.username}` : '')}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-2 shrink-0">
                {/* Dismiss */}
                <button
                  onClick={() => handleDismiss(u.id)}
                  aria-label="Dismiss suggestion"
                  className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
                  title="Dismiss"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-70">
                    <path fillRule="evenodd" d="M10 8.586L4.757 3.343 3.343 4.757 8.586 10l-5.243 5.243 1.414 1.414L10 11.414l5.243 5.243 1.414-1.414L11.414 10l5.243-5.243-1.414-1.414L10 8.586z" clipRule="evenodd" />
                  </svg>
                </button>

                {me && (
                  <button
                    onClick={async () => {
                      setBusyId(u.id);
                      const { error } = await toggleFollow(supabase, u.id, /* isFollowing */ false);
                      setBusyId(null);
                      if (!error) {
                        // Hide immediately after following
                        handleDismiss(u.id);
                      }
                    }}
                    disabled={busyId === u.id}
                    className={`px-3 py-1.5 rounded text-sm disabled:opacity-50 ${
                      u.followsYou
                        ? 'bg-white/10 hover:bg-white/15' // Follow back → secondary style
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {busyId === u.id ? '…' : (u.followsYou ? 'Follow back' : 'Follow')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {remainingCount > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setTargetCount((c) => c + SHOW_MORE_STEP)}
            className="w-full bg-white/10 hover:bg-white/15 px-3 py-2 rounded text-sm"
          >
            Show more · {remainingCount} more
          </button>
        </div>
      )}
    </div>
  );
}