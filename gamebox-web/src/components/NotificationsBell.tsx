'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { getUnreadCount } from '@/lib/notifications';

export default function NotificationsBell() {
  const supabase = supabaseBrowser();
  const [me, setMe] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const [ready, setReady] = useState(false);

  // Load user + initial unread count
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;

      const uid = auth.user?.id ?? null;
      setMe(uid);
      setReady(true);

      if (!uid) {
        setCount(0);
        return;
      }
      const c = await getUnreadCount(supabase);
      if (!cancelled) setCount(c);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime updates (INSERT -> +1, UPDATE read_at -> -1, DELETE of unread -> -1)
  useEffect(() => {
    if (!me) return;

    const channel = supabase
      .channel(`notif-bell-${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
        () => setCount(c => c + 1)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
        (payload: any) => {
          const wasUnread = !payload?.old?.read_at;
          const nowRead = !!payload?.new?.read_at;
          if (wasUnread && nowRead) setCount(c => Math.max(0, c - 1));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
        (payload: any) => {
          const wasUnread = !payload?.old?.read_at;
          if (wasUnread) setCount(c => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, me]);

  // Cross-tab auth sync (if you sign out in another tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gb-auth-sync') {
        supabase.auth.getUser().then(({ data }) => {
          const uid = data.user?.id ?? null;
          setMe(uid);
          if (!uid) setCount(0);
        });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [supabase]);

  if (!ready) {
    return (
      <div className="relative h-8 w-8 rounded-full bg-white/10 animate-pulse" aria-hidden />
    );
  }

  if (!me) {
    // Not signed in: show a simple link to login or hide entirely
    return (
      <Link
        href="/login"
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        aria-label="Sign in"
        title="Sign in"
      >
        <BellIcon />
      </Link>
    );
  }

  const badge = Math.min(count, 99);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
      aria-label={badge > 0 ? `${badge} unread notifications` : 'Notifications'}
      title="Notifications"
    >
      <BellIcon />
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[11px] leading-[18px] text-white text-center shadow"
          aria-hidden
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-white/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 19a2 2 0 1 1-4 0" />
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
    </svg>
  );
}