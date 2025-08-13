'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';

type MiniProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function WhoToFollow({ limit = 6 }: { limit?: number }) {
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [list, setList] = useState<MiniProfile[] | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      const user = session?.user ?? null;
      setMe(user ? { id: user.id } : null);
      setReady(true);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  useEffect(() => {
    if (!ready || !me) return;

    let cancelled = false;
    (async () => {
      // who am I already following?
      const { data: myEdges } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me.id);

      if (cancelled) return;
      const mySet = new Set((myEdges ?? []).map((r: any) => String(r.following_id)));
      setFollowing(mySet);

      // take the most recent 200 reviews and pull unique authors not already followed
      const { data: recent } = await supabase
        .from('reviews')
        .select('user_id')
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelled) return;
      const candidates: string[] = [];
      for (const r of (recent ?? [])) {
        const uid = String(r.user_id);
        if (uid !== me.id && !mySet.has(uid) && !candidates.includes(uid)) {
          candidates.push(uid);
        }
      }
      const pick = candidates.slice(0, limit > 12 ? 12 : limit); // sane upper bound

      if (pick.length === 0) { setList([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', pick);

      if (cancelled) return;
      setList((profiles ?? []) as MiniProfile[]);
    })();

    return () => { cancelled = true; };
  }, [ready, me, supabase, limit]);

  async function toggleFollow(targetId: string, isFollowing: boolean) {
    if (!me) return;
    setSavingId(targetId);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', targetId);
      setFollowing(prev => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: targetId });
      setFollowing(prev => new Set(prev).add(targetId));
    }
    setSavingId(null);
  }

  if (!me) return null; // only show to signed-in users
  if (list == null) return <div className="mt-8">Who to follow…</div>;
  if (list.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Who to follow</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map(p => {
          const isFollowing = following.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatar_url || '/avatar-placeholder.svg'}
                alt=""
                className="h-8 w-8 rounded-full object-cover border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <Link href={`/u/${p.username}`} className="font-medium hover:underline truncate">
                  {p.display_name || p.username}
                </Link>
                {p.display_name && (
                  <div className="text-xs text-white/50 truncate">@{p.username}</div>
                )}
              </div>
              <button
                onClick={() => toggleFollow(p.id, isFollowing)}
                disabled={savingId === p.id}
                className={`px-3 py-1 rounded text-sm ${isFollowing ? 'bg-white/10' : 'bg-indigo-600'} disabled:opacity-50`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}