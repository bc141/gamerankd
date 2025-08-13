'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { toggleFollow } from '@/lib/follows';

type Mini = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

export default function FollowingPage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const slug = Array.isArray((params as any)?.username) ? (params as any).username[0] : (params as any)?.username;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Mini | null>(null);
  const [people, setPeople] = useState<Mini[] | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await waitForSession(supabase);
      if (!mounted) return;
      setViewerId(session?.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    (async () => {
      setError(null);

      // 1) profile by username
      const uname = String(slug).toLowerCase();
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .eq('username', uname)
        .single();

      if (pErr || !prof) { setError('Profile not found'); return; }
      if (!mounted) return;
      setProfile(prof);

      // 2) ids they are following (followee_id)
      const { data: rel, error: rErr } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', prof.id)
        .order('created_at', { ascending: false });

      if (rErr) { setError(rErr.message); return; }
      const followeeIds = (rel ?? []).map(r => r.followee_id as string).filter(Boolean);
      if (!mounted) return;

      if (followeeIds.length === 0) {
        setPeople([]);
      } else {
        const { data: list, error: lErr } = await supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url')
          .in('id', followeeIds);
        if (lErr) { setError(lErr.message); return; }
        setPeople((list ?? []) as Mini[]);
      }

      // 3) viewer following set for button state
      if (viewerId) {
        const { data: myFollows } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', viewerId);
        const s = new Set<string>();
        for (const r of myFollows ?? []) s.add(r.followee_id as string);
        if (mounted) setFollowingSet(s);
      } else {
        setFollowingSet(new Set());
      }
    })();

    return () => { mounted = false; };
  }, [slug, viewerId, supabase]);

  const title = useMemo(() => (profile?.display_name || profile?.username || 'User') + ' · Following', [profile]);

  if (error) return <main className="p-8 text-red-500">{error}</main>;
  if (!profile || !people) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>

      {people.length === 0 ? (
        <p className="text-white/70">Not following anyone yet.</p>
      ) : (
        <ul className="space-y-4">
          {people.map(u => {
            const isMe = viewerId === u.id;
            const isFollowing = followingSet.has(u.id);
            return (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <Link href={u.username ? `/u/${u.username}` : '#'} className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.avatar_url || '/avatar-placeholder.svg'} alt="" className="h-10 w-10 rounded-full object-cover border border-white/15" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.display_name || u.username || 'Player'}</div>
                    {u.username && <div className="text-xs text-white/50 truncate">@{u.username}</div>}
                  </div>
                </Link>

                {viewerId && !isMe && (
                  <button
                    onClick={async () => {
                      setBusy(u.id);
                      const { error } = await toggleFollow(supabase, u.id, isFollowing);
                      setBusy(null);
                      if (!error) {
                        const s = new Set(followingSet);
                        if (isFollowing) s.delete(u.id); else s.add(u.id);
                        setFollowingSet(s);
                      }
                    }}
                    disabled={busy === u.id}
                    className={`px-3 py-1.5 rounded text-sm disabled:opacity-50 ${isFollowing ? 'bg-white/10' : 'bg-indigo-600 text-white'}`}
                  >
                    {busy === u.id ? '…' : (isFollowing ? 'Following' : 'Follow')}
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