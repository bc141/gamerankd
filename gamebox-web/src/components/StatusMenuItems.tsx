'use client';

import type { LibraryStatus } from '@/lib/library';
import { useRef } from 'react';

export const STATUS_OPTIONS: LibraryStatus[] = [
  'Playing', 'Backlog', 'Completed', 'Dropped',
];

type Props = {
  value: LibraryStatus;
  onChange: (next: LibraryStatus) => void;
  onRemove?: () => void;           // <-- NEW (optional)
  className?: string;
};

/**
 * Renders *only* the list of options (no trigger, no portal).
 * Use inside your own popover/panel.
 */
export default function StatusMenuItems({ value, onChange, onRemove, className }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={listRef}
      role="menu"
      aria-label="Change status"
      className={className}
      onKeyDown={(e) => {
        // simple keyboard support: Enter/Space activate focused item
        const active = document.activeElement as HTMLElement | null;
        if ((e.key === 'Enter' || e.key === ' ') && active?.dataset?.status) {
          e.preventDefault();
          onChange(active.dataset.status as LibraryStatus);
        }
      }}
    >
      {STATUS_OPTIONS.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            data-status={opt}
            className={`w-full text-left px-3 py-2 rounded
                        hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                        ${selected ? 'bg-white/10 text-white' : 'text-white/90'}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt);
            }}
          >
            {opt}
          </button>
        );
      })}

      {onRemove && (
        <>
          <div role="separator" className="my-1 h-px bg-white/10" />
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 rounded text-red-300 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          >
            Remove from library
          </button>
        </>
      )}
    </div>
  );
}
