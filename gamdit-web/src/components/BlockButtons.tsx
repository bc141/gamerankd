// src/components/BlockButtons.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  broadcastBlockSync,
} from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string;
  asMenu?: boolean;               // kept for compat with any dropdown layout
  className?: string;
  /** Called after a successful block/unblock with the *new* blocked state. */
  onChange?: (nextBlocked: boolean) => Promise<void> | void;
};

const SYNC_KEY = 'gb-block-sync';

export default function BlockButtons({ targetId, username, className, onChange }: Props) {
  const supabase = supabaseBrowser();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [busy, setBusy] = useState(false);

  // auth + cross-tab sync + first load
  useEffect(() => {
    let mounted = true;

    const refresh = async (force = false) => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted) return;

      setViewerId(uid);
      if (!uid) {
        setIBlocked(false);
        setBlockedMe(false);
        return;
      }

      const sets = await getBlockSets(supabase, uid, force ? { force: true } : undefined);
      if (!mounted) return;
      setIBlocked(sets.iBlocked.has(targetId));
      setBlockedMe(sets.blockedMe.has(targetId));
    };

    // initial truthy load
    refresh(true);

    // auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh(true));

    // cross-tab storage signal
    const onStorage = (e: StorageEvent) => {
      if (e.key === SYNC_KEY) refresh(true);
    };
    try { window.addEventListener('storage', onStorage); } catch {}

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      try { window.removeEventListener('storage', onStorage); } catch {}
    };
  }, [supabase, targetId]);

  if (!viewerId || viewerId === targetId) return null;

  const label = username ? `@${username}` : 'this user';

  const finish = async (nextBlocked: boolean) => {
    broadcastBlockSync(); // other tabs
    // force refresh our local copy
    const sets = await getBlockSets(supabase, viewerId!, { force: true });
    setIBlocked(sets.iBlocked.has(targetId));
    setBlockedMe(sets.blockedMe.has(targetId));
    // let the parent react immediately (refresh counts/banners/etc)
    try { await onChange?.(nextBlocked); } catch {}
  };

  async function onBlock() {
    if (busy) return;
    setBusy(true);
    setIBlocked(true); // optimistic
    try {
      const { error } = await blockUser(supabase, targetId);
      if (error) {
        setIBlocked(false);
        alert(error.message);
        return;
      }
      await finish(true);
    } finally {
      setBusy(false);
    }
  }

  async function onUnblock() {
    if (busy) return;
    setBusy(true);
    setIBlocked(false); // optimistic
    try {
      const { error } = await unblockUser(supabase, targetId);
      if (error) {
        setIBlocked(true);
        alert(error.message);
        return;
      }
      await finish(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        {iBlocked ? (
          <button
            onClick={onUnblock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm text-white disabled:opacity-50"
            aria-busy={busy}
          >
            {busy ? '…' : `Unblock ${label}`}
          </button>
        ) : (
          <button
            onClick={onBlock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm text-red-300 disabled:opacity-50"
            title={blockedMe ? 'They already blocked you' : undefined}
            aria-busy={busy}
          >
            {busy ? '…' : `Block ${label}`}
          </button>
        )}

        {blockedMe && (
          <span className="text-xs text-white/50 px-1 py-0.5" aria-live="polite">
            You’re blocked by {label}.
          </span>
        )}
      </div>
    </div>
  );
}