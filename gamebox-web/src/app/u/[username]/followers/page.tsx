'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { toggleFollow } from '@/lib/follows';

type MiniProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function FollowersPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [owner, setOwner] = useState<MiniProfile | null>(null);
  const [people, setPeople] = useState<MiniProfile[] | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // hydrate auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      setViewerId(session?.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  // load owner + followers + viewer's following set
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setError(null);

      // 1) owner by username
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .eq('username', String(slug).toLowerCase())
        .single();

      if (cancelled) return;
      if (pErr || !prof) { setError('Profile not found'); return; }
      setOwner(prof as MiniProfile);

      // 2) follower IDs (users who follow this owner)
      const { data: followerEdges, error: fErr } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followee_id', (prof as any).id);

      if (cancelled) return;
      if (fErr) { setError(fErr.message); return; }

      const ids = Array.from(new Set((followerEdges ?? []).map((r: any) => String(r.follower_id))));
      if (ids.length === 0) {
        setPeople([]);
      } else {
        // 3) fetch follower profiles
        const { data: ppl, error: pplErr } = await supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url')
          .in('id', ids);
        if (cancelled) return;
        if (pplErr) { setError(pplErr.message); return; }

        const sorted = (ppl ?? []).slice().sort((a: any, b: any) => {
          const an = (a.display_name || a.username || '').toLowerCase();
          const bn = (b.display_name || b.username || '').toLowerCase();
          return an.localeCompare(bn);
        });
        setPeople(sorted as MiniProfile[]);
      }

      // 4) viewer's following set (for button state)
      if (viewerId) {
        const { data: edges } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', viewerId);
        const s = new Set<string>();
        for (const r of edges ?? []) s.add(String(r.followee_id));
        if (!cancelled) setFollowingSet(s);
      } else {
        setFollowingSet(new Set());
      }
    })();

    return () => { cancelled = true; };
  }, [slug, viewerId, supabase]);

  async function onToggle(targetId: string, currentlyFollowing: boolean) {
    if (!viewerId) return router.push('/login');
    setBusyId(targetId);
    const { error } = await toggleFollow(supabase, targetId, currentlyFollowing);
    setBusyId(null);
    if (!error) {
      const next = new Set(followingSet);
      if (currentlyFollowing) next.delete(targetId); else next.add(targetId);
      setFollowingSet(next);
    }
  }

  const title = useMemo(() => {
    if (!owner) return 'Followers';
    const name = owner.display_name || owner.username || 'User';
    return `${name} · Followers`;
  }, [owner]);

  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!owner || people == null) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link className="text-sm text-white/60 hover:underline" href={`/u/${owner.username}`}>&larr; Back to profile</Link>
        <h1 className="text-2xl font-bold mt-2">{title}</h1>
      </div>

      {people.length === 0 ? (
        <p className="text-white/60">No followers yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded border border-white/10 bg-white/5">
          {people.map(p => {
            const isMe = viewerId === p.id;
            const following = followingSet.has(p.id);
            return (
              <li key={p.id} className="p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.avatar_url || '/avatar-placeholder.svg'}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <Link href={p.username ? `/u/${p.username}` : '#'} className="font-medium hover:underline truncate">
                    {p.display_name || p.username || 'Player'}
                  </Link>
                  {p.username && p.display_name && (
                    <div className="text-xs text-white/50 truncate">@{p.username}</div>
                  )}
                </div>
                {viewerId && !isMe && (
                  <button
                    onClick={() => onToggle(p.id, following)}
                    disabled={busyId === p.id}
                    className={`px-3 py-1 rounded text-sm disabled:opacity-50 ${following ? 'bg-white/10' : 'bg-indigo-600 text-white'}`}
                  >
                    {busyId === p.id ? '…' : (following ? 'Following' : 'Follow')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}