'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import BlockButtons from '@/components/BlockButtons';
import { getBlockSets } from '@/lib/blocks';

type MiniProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function FollowingPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();

  const slug = Array.isArray((params as any)?.username)
    ? (params as any).username[0]
    : (params as any)?.username;

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [owner, setOwner] = useState<MiniProfile | null>(null);
  const [people, setPeople] = useState<MiniProfile[] | null>(null);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!ready || !slug) return;
    let cancelled = false;

    (async () => {
      setError(null);

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .eq('username', String(slug).toLowerCase())
        .single();

      if (cancelled) return;
      if (pErr || !prof) return setError('Profile not found');

      setOwner(prof as MiniProfile);

      // People this owner follows (edges where follower_id = owner.id)
      const { data: followingEdges, error: fErr } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', (prof as any).id);

      if (cancelled) return;
      if (fErr) return setError(fErr.message);

      const ids = Array.from(new Set((followingEdges ?? []).map((r: any) => String(r.followee_id))));
      if (ids.length === 0) {
        setPeople([]);
      } else {
        const { data: ppl, error: pplErr } = await supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url')
          .in('id', ids);

        if (cancelled) return;
        if (pplErr) return setError(pplErr.message);

        const sorted = (ppl ?? []).slice().sort((a: any, b: any) => {
          const an = (a.display_name || a.username || '').toLowerCase();
          const bn = (b.display_name || b.username || '').toLowerCase();
          return an.localeCompare(bn);
        });

        setPeople(sorted as MiniProfile[]);
      }

      // My following set for buttons
      if (me) {
        const { data: edges } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', me.id);
        setMyFollowing(new Set((edges ?? []).map((r: any) => String(r.followee_id))));
      } else {
        setMyFollowing(new Set());
      }
    })();

    return () => { cancelled = true; };
  }, [ready, slug, supabase, me?.id]);

  async function toggleFollow(targetId: string, currentlyFollowing: boolean) {
    if (!me) return router.push('/login');
    setSavingId(targetId);
    if (currentlyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('followee_id', targetId);
      setMyFollowing(prev => { const next = new Set(prev); next.delete(targetId); return next; });
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, followee_id: targetId });
      setMyFollowing(prev => new Set(prev).add(targetId));
    }
    setSavingId(null);
  }

  const title = useMemo(() => {
    if (!owner) return 'Following';
    const name = owner.display_name || owner.username;
    return `${name} · Following`;
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
        <p className="text-white/60">Not following anyone yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded border border-white/10 bg-white/5">
          {people.map(p => {
            const following = myFollowing.has(p.id);
            const isMe = me?.id === p.id;
            return (
              <li key={p.id} className="p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar_url || '/avatar-placeholder.svg'} alt="" className="h-9 w-9 rounded-full object-cover border border-white/10" />
                <div className="flex-1 min-w-0">
                  <Link href={`/u/${p.username}`} className="font-medium hover:underline truncate">
                    {p.display_name || p.username}
                  </Link>
                  {p.display_name && <div className="text-xs text-white/50 truncate">@{p.username}</div>}
                </div>
                {!isMe && (
                  <BlockedUserButton 
                    user={p} 
                    me={me} 
                    following={following}
                    savingId={savingId}
                    onToggleFollow={toggleFollow}
                    supabase={supabase}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function BlockedUserButton({ 
  user, 
  me, 
  following, 
  savingId, 
  onToggleFollow, 
  supabase 
}: {
  user: MiniProfile;
  me: { id: string } | null;
  following: boolean;
  savingId: string | null;
  onToggleFollow: (targetId: string, currentlyFollowing: boolean) => Promise<void>;
  supabase: any;
}) {
  const [blockedEitherWay, setBlockedEitherWay] = useState(false);

  useEffect(() => {
    let m = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const me = data.user?.id;
      if (!m || !me) return;
      const sets = await getBlockSets(supabase, me, { force: true });
      if (!m) return;
      setBlockedEitherWay(sets.iBlocked.has(user.id) || sets.blockedMe.has(user.id));
    })();
    return () => { m = false; };
  }, [supabase, user.id]);

  return (
    <div className="flex items-center gap-2">
      {blockedEitherWay ? (
        <BlockButtons
          targetId={user.id}
          username={user.username}
          onChange={() => {/* optionally refetch this page */}}
        />
      ) : (
        <button
          onClick={() => onToggleFollow(user.id, following)}
          disabled={savingId === user.id}
          className={`px-3 py-1 rounded text-sm ${following ? 'bg-white/10' : 'bg-indigo-600'} disabled:opacity-50`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}