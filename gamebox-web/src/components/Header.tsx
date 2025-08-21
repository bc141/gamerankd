'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import NotificationsBell from '@/components/NotificationsBell';
import SearchControl from '@/components/search/SearchControl';

type Me = { id: string; email?: string };
type MiniProfile = { username: string | null; avatar_url: string | null };

export default function Header() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<Me | null>(null);
  const [prof, setProf] = useState<MiniProfile>({ username: null, avatar_url: null });

  // menu state/refs
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  async function fetchMiniProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .single();
    setProf({ username: data?.username ?? null, avatar_url: data?.avatar_url ?? null });
  }

  async function loadSession() {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user ?? null;
    setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
    if (u) await fetchMiniProfile(u.id);
    else setProf({ username: null, avatar_url: null });
  }

  // Mount: load session + subscribe to auth changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cancelled) await loadSession();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      if (u) fetchMiniProfile(u.id);
      else setProf({ username: null, avatar_url: null });
    });

    return () => {
      sub?.subscription?.unsubscribe();
      cancelled = true;
    };
  }, [supabase]);

  // Cross-tab auth sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gb-auth-sync') loadSession();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Refresh mini-profile on route change; close menu
  useEffect(() => {
    if (user) fetchMiniProfile(user.id);
    setOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // close menu on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
    setOpen(false);
    router.replace('/');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm pb-0.5 border-b-2 ${
        isActive(href)
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-white/80 hover:text-white hover:border-white/30'
      }`}
    >
      {label}
    </Link>
  );

  const avatarSrc = prof.avatar_url || '/avatar-placeholder.svg';
  const profileHref = prof.username ? `/u/${prof.username}` : '/onboarding/username';

  return (
    <header className="border-b border-white/10 sticky top-0 z-40 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold" aria-label="Home">
            gamdit
          </Link>
          {/* Primary nav */}
          <nav className="hidden sm:flex items-center gap-5">
            {navLink('/', 'Home')}
            {user && navLink('/feed', 'Feed')}
            {/* remove: {navLink('/search', 'Search')} */}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Global Search — show for everyone */}
          <SearchControl />

          {user ? (
            <>
              {/* Notifications */}
              <NotificationsBell />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  ref={btnRef}
                  type="button"
                  onClick={() => setOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label="Open profile menu"
                  className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt="Your avatar"
                    className="h-8 w-8 rounded-full object-cover border border-white/20"
                  />
                  <span className="hidden md:inline text-sm text-white/90">My profile</span>
                  <svg
                    className={`hidden md:inline h-4 w-4 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                  >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.585l3.71-3.354a.75.75 0 111.02 1.1l-4.2 3.79a.75.75 0 01-1.02 0l-4.2-3.79a.75.75 0 01.02-1.1z" />
                  </svg>
                </button>

                {open && (
                  <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-neutral-900/95 shadow-lg backdrop-blur p-1"
                  >
                    <Link
                      href={profileHref}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 rounded text-sm hover:bg-white/10"
                    >
                      View profile
                    </Link>
                    <Link
                      href="/settings/profile"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 rounded text-sm hover:bg-white/10"
                    >
                      Edit profile
                    </Link>
                    <button
                      role="menuitem"
                      onClick={signOut}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className="text-sm underline">Sign in</Link>
          )}
        </div>
      </div>

      {/* compact nav for small screens */}
      <div className="sm:hidden border-t border-white/10">
        <nav className="mx-auto max-w-5xl px-4 h-10 flex items-center gap-5">
          {navLink('/', 'Home')}
          {user && navLink('/feed', 'Feed')}
           {/* remove: {navLink('/search', 'Search')} */}
        </nav>
      </div>
    </header>
  );
}