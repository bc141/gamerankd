'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Header() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  async function fetchUsername(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    setUsername(prof?.username ?? null);
  }

  // Mount ONCE: seed from existing session, and subscribe to auth changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) await fetchUsername(u.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchUsername(u.id);
      else setUsername(null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // On navigation, refresh username only if already signed in
  useEffect(() => {
    if (user) fetchUsername(user.id);
  }, [pathname, user]); // do NOT resubscribe here

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
    router.replace('/');
    router.refresh();
  };

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Gamebox</Link>

        {!user ? (
          <Link href="/login" className="text-sm underline">Sign in</Link>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href={username ? `/u/${username}` : `/onboarding/username`}
              className="text-sm underline"
            >
              {username ? 'My profile' : 'Pick username'}
            </Link>
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