'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { blockUser, unblockUser, getBlockSets, broadcastBlockSync } from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string | null;
  className?: string;
};

export default function OverflowActions({ targetId, username, className }: Props) {
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setViewerId(uid);

      if (uid) {
        const { iBlocked } = await getBlockSets(supabase, uid);
        if (!mounted) return;
        setIsBlocked(iBlocked.has(targetId));
      }
    })();
    return () => { mounted = false; };
  }, [supabase, targetId]);

  // close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!btnRef.current) return;
      if (e.target instanceof Node && !btnRef.current.parentElement?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function onToggleBlock() {
    if (!viewerId || viewerId === targetId || busy) return;
    setBusy(true);
    const fn = isBlocked ? unblockUser : blockUser;
    const { error } = await fn(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIsBlocked(!isBlocked);
    setOpen(false);
    broadcastBlockSync();
  }

  async function shareProfile() {
    const url = `${window.location.origin}/u/${username ?? targetId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${username ?? 'player'}`, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Link copied!');
      } else {
        prompt('Copy profile URL', url);
      }
    } catch {}
    setOpen(false);
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        className="rounded px-3 py-2 bg-white/10 hover:bg-white/15"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        title="More"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded border border-white/10 bg-neutral-900 shadow-lg z-20 p-1"
        >
          <button
            role="menuitem"
            onClick={shareProfile}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
          >
            Share {username ? `@${username}` : 'profile'}
          </button>

          <button
            role="menuitem"
            onClick={onToggleBlock}
            disabled={busy || !viewerId || viewerId === targetId}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300 disabled:opacity-50"
          >
            {isBlocked ? 'Unblock' : 'Block'} {username ? `@${username}` : 'user'}
          </button>
        </div>
      )}
    </div>
  );
}