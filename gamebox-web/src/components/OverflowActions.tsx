// src/components/OverflowActions.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { copyToClipboard } from '@/lib/copy';
import { getBlockSets, blockUser, unblockUser, broadcastBlockSync } from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string;
  className?: string;
  /** Optional: parent can refresh counts / following / banners immediately */
  onBlockChange?: (nextBlocked: boolean) => Promise<void> | void;
};

export default function OverflowActions({ targetId, username, className, onBlockChange }: Props) {
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);

  // Initial block state (viewer perspective)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const sets = await getBlockSets(supabase, u.user.id);
      if (!mounted) return;
      setIsBlocked(sets.iBlocked.has(targetId) || sets.blockedMe.has(targetId));
    })();
    return () => { mounted = false; };
  }, [supabase, targetId]);

  // Shareable profile URL
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

  async function handleCopy() {
    const ok = await copyToClipboard(shareUrl);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleToggleBlock() {
    if (busy || isBlocked == null) return;
    setBusy(true);

    // optimistic flip
    const next = !isBlocked;
    setIsBlocked(next);

    try {
      if (next) {
        await blockUser(supabase, targetId);
      } else {
        await unblockUser(supabase, targetId);
      }

      // notify other tabs
      try { broadcastBlockSync(); } catch {}

      // allow parent to refresh same-tab UI immediately
      if (onBlockChange) {
        await onBlockChange(next);
      }
    } catch {
      // revert on failure
      setIsBlocked(!next);
    } finally {
      setBusy(false);
    }
  }

  // -- simple minimal menu UI (keeps your existing styling assumptions) --
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
          <div className="px-3 py-2 text-sm text-white/60">
            {isBlocked ? (
              <>You’re blocked by this user or have blocked them.</>
            ) : (
              <>Quick actions</>
            )}
          </div>

          <button
            role="menuitem"
            onClick={handleToggleBlock}
            disabled={busy}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
          >
            {busy
              ? '…'
              : isBlocked
              ? `Unblock${username ? ` @${username}` : ''}`
              : `Block${username ? ` @${username}` : ''}`}
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