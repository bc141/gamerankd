'use client';

import { useEffect, useRef, useState } from 'react';
import type { LibraryStatus } from '@/lib/library';

type Props = {
  value: LibraryStatus;
  onChange: (next: LibraryStatus) => void;
  size?: 'sm' | 'md';
};

const ALL: LibraryStatus[] = ['Playing', 'Backlog', 'Completed', 'Dropped'];

export default function StatusMenu({ value, onChange, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Change status"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-white/80
          ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
        title="Change status"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-md border border-white/15 bg-neutral-900 shadow-lg"
          role="menu"
        >
          {ALL.map((s) => {
            const active = s === value;
            return (
              <button
                key={s}
                role="menuitem"
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm
                  ${active ? 'bg-indigo-600/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}