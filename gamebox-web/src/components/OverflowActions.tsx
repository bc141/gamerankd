// src/components/OverflowActions.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import BlockButtons from './BlockButtons';

type Props = {
  targetId: string;
  username?: string | null;
  displayName?: string | null;
  className?: string;
};

export default function OverflowActions({
  targetId,
  username,
  displayName,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // close on outside click / Esc
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(t) && !btnRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const canShare = Boolean(username && username.trim() !== '');
  const base =
    (typeof window !== 'undefined' && window.location.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    '';
  const shareUrl = canShare ? `${base}/u/${username}` : null;

  async function handleShare() {
    if (!shareUrl) return;
    const title = `${displayName ?? username} on GameRankd`;
    const text = `Check out ${displayName ?? `@${username}`} on GameRankd`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setOpen(false);
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt('Copy profile link:', shareUrl); // final fallback
    } finally {
      setTimeout(() => setOpen(false), 900);
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-3 py-2 rounded bg-white/10 hover:bg-white/15"
        title="More"
      >
        …
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded border border-white/10 bg-neutral-900 shadow-lg p-1 z-20"
        >
          {canShare && (
            <button
              role="menuitem"
              onClick={handleShare}
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-sm"
            >
              {copied ? 'Link copied!' : 'Share profile'}
            </button>
          )}

          {canShare && <div className="my-1 h-px bg-white/10" />}

          {/* Block/Unblock item(s) */}
          <BlockButtons
            targetId={targetId}
            username={username ?? undefined}
            asMenu
          />
        </div>
      )}
    </div>
  );
}