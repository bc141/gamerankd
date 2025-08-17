// src/app/(whatever-your-path-is)/NotificationsBell.tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { getUnreadCount } from '@/lib/notifications';

export default function NotificationsBell() {
  const supabase = supabaseBrowser();

  const mounted = useRef(false);
  const [me, setMe] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);

  const clampUp = (n: number) => Math.min(99, n);
  const clampDown = (n: number) => Math.max(0, n);

  // Auth + count (re)compute
  const refreshAuthAndCount = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!mounted.current) return;

    const uid = data.user?.id ?? null;
    setMe(uid);
    setReady(true);

    if (!uid) {
      setCount(0);
      return;
    }
    const c = await getUnreadCount(supabase);
    if (mounted.current) setCount(typeof c === 'number' ? c : 0);
  }, [supabase]);

  // Initial load + auth changes + visibility/focus refresh
  useEffect(() => {
    mounted.current = true;
    refreshAuthAndCount();

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      refreshAuthAndCount();
      try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
    });

    const onFocus = () => { if (me) refreshAuthAndCount(); };
    const onVis = () => { if (!document.hidden && me) refreshAuthAndCount(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mounted.current = false;
      authSub.subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [supabase, refreshAuthAndCount, me]);

  // Realtime: delta updates, tolerant to user_id/recipient_id
  useEffect(() => {
    if (!me) return;

    const isMine = (row: any) => row?.user_id === me || row?.recipient_id === me;

    const onInsert = (payload: any) => {
      const r = payload?.new;
      if (!isMine(r)) return;
      const unread = !r?.read_at;
      if (unread) setCount(c => clampUp(c + 1));
    };

    const onUpdate = (payload: any) => {
      const oldMine = isMine(payload?.old);
      const newMine = isMine(payload?.new);
      if (!oldMine && !newMine) return;

      const wasUnread = !payload?.old?.read_at;
      const nowUnread = !payload?.new?.read_at;

      if (wasUnread && !nowUnread) setCount(c => clampDown(c - 1));   // became read
      else if (!wasUnread && nowUnread) setCount(c => clampUp(c + 1)); // became unread (rare)
    };

    const onDelete = (payload: any) => {
      const r = payload?.old;
      if (!isMine(r)) return;
      const wasUnread = !r?.read_at;
      if (wasUnread) setCount(c => clampDown(c - 1));
    };

    const channel = supabase
      .channel(`notif-bell-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, onInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, onUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, onDelete)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, me]);

  // Cross-tab sync (mark-all, auth, block)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!me) return;
      if (e.key === 'gb-notif-sync' || e.key === 'gb-auth-sync' || e.key === 'gb-block-sync') {
        refreshAuthAndCount();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshAuthAndCount, me]);

  // UI
  if (!ready) {
    return <div className="relative h-8 w-8 rounded-full bg-white/10 animate-pulse" aria-hidden />;
  }

  if (!me) {
    return (
      <Link
        href="/login"
        prefetch={false}
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        aria-label="Sign in"
        title="Sign in"
      >
        <BellIcon />
      </Link>
    );
  }

  const badge = count > 99 ? '99+' : String(count);

  return (
    <Link
      href="/notifications"
      prefetch={false}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      title="Notifications"
    >
      <BellIcon />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[11px] leading-[18px] text-white text-center shadow"
          aria-hidden
        >
          {badge}
        </span>
      )}
      {/* SR-only live region so screen readers get count updates */}
      <span className="sr-only" aria-live="polite">
        {count} unread notifications
      </span>
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