// src/components/OverflowActions.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import BlockButtons from './BlockButtons';

type Props = {
  targetId: string;
  username?: string | null; // allow null here if your callers may provide it
  className?: string;
};

export default function OverflowActions({ targetId, username, className }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
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

  return (
    <div className={className} data-ignore-context>
      <div className="relative inline-block text-left">
        <button
          ref={btnRef}
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          aria-haspopup="menu"
          aria-expanded={open}
          title="More actions"
        >
          ⋯
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 mt-2 w-40 rounded border border-white/10 bg-neutral-900 shadow-lg p-1 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pass undefined, not null */}
            <BlockButtons
              targetId={targetId}
              username={username ?? undefined}
              asMenu
            />
          </div>
        )}
      </div>
    </div>
  );
}