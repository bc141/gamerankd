// src/components/OverflowActions.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { copyToClipboard } from '@/lib/copy';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  broadcastBlockSync,
  type BlockSets,
} from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string;
  className?: string;
  /** Parent can refresh counts / following / banners immediately */
  onBlockChange?: (nextBlocked: boolean) => Promise<void> | void;
};

export default function OverflowActions({
  targetId,
  username,
  className,
  onBlockChange,
}: Props) {
  const supabase = supabaseBrowser();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // finer state than a single boolean
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [ready, setReady] = useState(false);

  const meRef = useRef<string | null>(null);

  // --- helpers -------------------------------------------------------------

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return new URL(
        username ? `/u/${username}` : window.location.pathname,
        window.location.origin
      ).toString();
    } catch {
      return username ? `/u/${username}` : window.location.pathname;
    }
  }, [username]);

  async function refreshBlockState(force = false) {
    const { data: u } = await supabase.auth.getUser();
    const me = u?.user?.id ?? null;
    meRef.current = me;

    if (!me) {
      setIBlocked(false);
      setBlockedMe(false);
      setReady(true);
      return;
    }

    const sets: BlockSets = await getBlockSets(supabase, me, { force });
    setIBlocked(sets.iBlocked.has(targetId));
    setBlockedMe(sets.blockedMe.has(targetId));
    setReady(true);
  }

  // --- effects -------------------------------------------------------------

  // initial + on target change
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refreshBlockState(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, supabase]);

  // cross-tab sync listener
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gb-block-sync') refreshBlockState(true);
    };
    try {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {
      return () => {};
    }
  }, [supabase, targetId]);

  // --- actions -------------------------------------------------------------

  async function handleCopy() {
    const ok = await copyToClipboard(shareUrl);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1200);
  }

  async function handleToggleBlock() {
    if (busy || !ready) return;
    setBusy(true);

    // Decide intended next state:
    // - If I already blocked them => we are unblocking.
    // - If they blocked me (and I haven't) => allow "Block back".
    // - Else normal "Block".
    const willBlock = iBlocked ? false : true;

    // Optimistic UI
    const prev = { iBlocked, blockedMe };
    if (willBlock) {
      setIBlocked(true);
      // they may or may not have blocked me; leave blockedMe as-is
    } else {
      setIBlocked(false);
    }

    try {
      if (willBlock) {
        const { error } = await blockUser(supabase, targetId);
        if (error) throw error;
      } else {
        const { error } = await unblockUser(supabase, targetId);
        if (error) throw error;
      }

      // Cross-tab notify + force-refresh local snapshot (busts cache)
      try { broadcastBlockSync(); } catch {}
      await refreshBlockState(true);

      // Allow parent to refresh counts/following banners immediately
      if (onBlockChange) await onBlockChange(willBlock);
    } catch (err: any) {
      // Revert optimistic UI and surface the error
      setIBlocked(prev.iBlocked);
      setBlockedMe(prev.blockedMe);
      const msg =
        err?.message ||
        err?.hint ||
        'Sorry, something went wrong while updating block state.';
      // Use whatever toast you have; fallback to alert
      // eslint-disable-next-line no-alert
      alert(msg);
      // Also log for debugging
      // eslint-disable-next-line no-console
      console.error('Block toggle failed:', err);
    } finally {
      setBusy(false);
    }
  }

  // --- render --------------------------------------------------------------

  // Labeling logic
  const canUnblock = iBlocked;
  const canBlockBack = !iBlocked && blockedMe; // they blocked me; allow "block back"
  const actionLabel = busy
    ? '…'
    : canUnblock
    ? `Unblock${username ? ` @${username}` : ''}`
    : canBlockBack
    ? `Block back${username ? ` @${username}` : ''}`
    : `Block${username ? ` @${username}` : ''}`;

  const bannerText = iBlocked
    ? 'You blocked this user.'
    : blockedMe
    ? 'This user has blocked you.'
    : 'Quick actions';

  return (
    <div className={className} data-ignore-context>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded hover:bg-white/10"
        title="More actions"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-neutral-900 shadow-lg p-2 z-20"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 text-sm text-white/60">{bannerText}</div>

          <button
            role="menuitem"
            onClick={handleToggleBlock}
            disabled={busy || (!iBlocked && !blockedMe && !ready)}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
            title={
              blockedMe && !iBlocked
                ? 'They blocked you; you can optionally block back.'
                : undefined
            }
          >
            {actionLabel}
          </button>

          <button
            role="menuitem"
            onClick={handleCopy}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
          >
            Copy profile link
          </button>

          <div
            aria-live="polite"
            className={`px-3 pt-1 text-xs ${copied ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          >
            {copied ? 'Link copied' : '\u00A0'}
          </div>
        </div>
      )}
    </div>
  );
}