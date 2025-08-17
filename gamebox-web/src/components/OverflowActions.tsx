// src/components/OverflowActions.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  broadcastBlockSync,
} from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string | null;
  className?: string;
};

export default function OverflowActions({ targetId, username, className }: Props) {
  const supabase = supabaseBrowser();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // hydrate auth + initial block state
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setViewerId(uid);

      if (!uid || uid === targetId) return;
      const sets = await getBlockSets(supabase, uid);
      if (!mounted) return;
      setIBlocked(sets.iBlocked.has(targetId));
      setBlockedMe(sets.blockedMe.has(targetId));
    })();
    return () => { mounted = false; };
  }, [supabase, targetId]);

  // dismiss on outside click / ESC
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // actions
  async function onBlock() {
    if (!viewerId) return location.assign('/login');
    if (viewerId === targetId) return;
    setBusy(true);
    const { error } = await blockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(true);
    broadcastBlockSync();
    setOpen(false);
  }

  async function onUnblock() {
    if (!viewerId) return location.assign('/login');
    if (viewerId === targetId) return;
    setBusy(true);
    const { error } = await unblockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(false);
    broadcastBlockSync();
    setOpen(false);
  }

  async function copyLink() {
    // Prefer the canonical username route if available
    const url =
      typeof window === 'undefined'
        ? ''
        : username
        ? `${window.location.origin}/u/${username}`
        : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // best effort: fall back to prompt
      try {
        // eslint-disable-next-line no-alert
        window.prompt('Copy this link:', url);
      } catch {}
    }
    setOpen(false);
  }

  const canShowBlock = viewerId && viewerId !== targetId;

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="px-2 py-1.5 rounded bg-white/10 hover:bg-white/15"
      >
        ⋯
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded border border-white/10 bg-neutral-900 shadow-lg p-1 z-20"
        >
          {/* Block / Unblock (only for signed-in non-self) */}
          {canShowBlock ? (
            iBlocked ? (
              <button
                role="menuitem"
                onClick={onUnblock}
                disabled={busy}
                className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-white/90"
              >
                Unblock {username ? `@${username}` : 'user'}
              </button>
            ) : (
              <button
                role="menuitem"
                onClick={onBlock}
                disabled={busy}
                className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300"
                title={blockedMe ? `${username ? '@' + username : 'This user'} has blocked you` : undefined}
              >
                Block {username ? `@${username}` : 'user'}
              </button>
            )
          ) : null}

          {/* Show who blocked whom (non-interactive, if applicable) */}
          {canShowBlock && blockedMe && (
            <div className="px-3 py-2 text-xs text-white/50">
              You’re blocked by {username ? `@${username}` : 'this user'}.
            </div>
          )}

          {/* Divider (only if we also showed a block item or info) */}
          {(canShowBlock || blockedMe) && (
            <div className="h-px my-1 bg-white/10" />
          )}

          {/* Copy profile link (always) */}
          <button
            role="menuitem"
            onClick={copyLink}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-white/90"
          >
            {copied ? 'Copied!' : 'Copy profile link'}
          </button>
        </div>
      )}
    </div>
  );
}