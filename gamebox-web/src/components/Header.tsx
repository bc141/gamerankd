// src/components/Header.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type MinimalUser = { id: string; email?: string };

export default function Header() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<MinimalUser | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  async function fetchProfile(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username, avatar_url, display_name')
      .eq('id', userId)
      .maybeSingle();
    setUsername(prof?.username ?? null);
    setAvatarUrl(prof?.avatar_url ?? null);
    setDisplayName(prof?.display_name ?? null);
  }

  // Mount once: seed from existing session and subscribe to auth changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const u = data.session?.user ?? null;
      setUser(u ?? null);
      if (u) await fetchProfile(u.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u ?? null);
      if (u) fetchProfile(u.id);
      else {
        setUsername(null);
        setAvatarUrl(null);
        setDisplayName(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Cross-tab sync: react to magic-link tab setting gb-auth-sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'gb-auth-sync') return;
      supabase.auth.getSession().then(({ data }) => {
        const u = data.session?.user ?? null;
        setUser(u ?? null);
        if (u) fetchProfile(u.id);
        else {
          setUsername(null);
          setAvatarUrl(null);
          setDisplayName(null);
        }
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [supabase]);

  // On navigation, refresh profile only if already signed in
  useEffect(() => {
    if (user) fetchProfile(user.id);
  }, [pathname, user]);

  // Prefetch likely routes for snappier UX
  useEffect(() => {
    router.prefetch('/search');
    router.prefetch('/settings/profile');
    if (username) router.prefetch(`/u/${username}`);
  }, [router, username]);

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
    router.replace('/');
    router.refresh();
  };

  const nameForHeader = useMemo(
    () => (displayName || username || 'My profile'),
    [displayName, username]
  );

  const NavLink = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`text-sm underline ${isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
      >
        {children}
      </Link>
    );
  };

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">Gamebox</Link>
          <NavLink href="/search">Search</NavLink>
        </div>

        {!user ? (
          <NavLink href="/login">Sign in</NavLink>
        ) : (
          <div className="flex items-center gap-4">
            {/* Avatar + Profile */}
            <Link
              href={username ? `/u/${username}` : `/onboarding/username`}
              className="flex items-center gap-2 text-sm underline"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || '/avatar-placeholder.svg'}
                alt="avatar"
                className="h-6 w-6 rounded-full object-cover border border-white/20"
              />
              {username ? nameForHeader : 'Pick username'}
            </Link>

            {/* Edit Profile */}
            <NavLink href="/settings/profile">Edit profile</NavLink>

            {/* Sign out */}
            <button
              type="button"
              onClick={signOut}
              className="text-sm bg-white/10 px-3 py-1 rounded"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}