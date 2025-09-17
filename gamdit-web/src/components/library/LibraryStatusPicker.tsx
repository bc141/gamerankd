// src/components/library/LibraryStatusPicker.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/library';

type Props = {
  value: LibraryStatus | null;
  busy?: boolean;
  onSet: (next: LibraryStatus) => void;
  onRemove?: () => void;
  className?: string;
  buttonLabel?: string;
};

export default function LibraryStatusPicker({
  value,
  busy = false,
  onSet,
  onRemove,
  className,
  buttonLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => {
    const base = LIBRARY_STATUSES.map((s) => ({
      type: 'status' as const,
      key: `status:${s}`,
      label: s,
      value: s,
      selected: value === s,
    }));

    const items: Array<
      | { type: 'status'; key: string; label: string; value: LibraryStatus; selected: boolean }
      | { type: 'remove'; key: string; label: string }
      | { type: 'separator'; key: string }
    > = [...base];

    if (onRemove && value) {
      items.push({ type: 'separator', key: 'sep' });
      items.push({ type: 'remove', key: 'remove', label: 'Remove from library' });
    }
    return items;
  }, [value, onRemove]);

  useEffect(() => {
    if (!open) return;

    const selectedIdx = options.findIndex((o) => o.type === 'status' && o.selected);
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : options.findIndex((o) => o.type === 'status'));

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, options]);

  function onButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (busy) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let i = activeIdx;
      do i = Math.min(options.length - 1, i + 1);
      while (options[i]?.type === 'separator' && i < options.length - 1);
      setActiveIdx(i);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let i = activeIdx;
      do i = Math.max(0, i - 1);
      while (options[i]?.type === 'separator' && i > 0);
      setActiveIdx(i);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[activeIdx];
      if (!opt) return;
      if (opt.type === 'status') onSet(opt.value);
      else if (opt.type === 'remove') onRemove?.();
      setOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const label = buttonLabel ?? (value ? value : 'Add to Library');

  return (
    <div className={`relative ${className ?? ''}`} data-ignore-context>
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy || undefined}
        className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white/90 disabled:opacity-50"
      >
        {label}
      </button>

      {open && (
        <div
          ref={popRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className="absolute z-40 mt-2 w-56 rounded-lg border border-white/10 bg-neutral-900/95 shadow-xl p-1"
        >
          {options.map((opt, i) => {
            if (opt.type === 'separator') {
              return <div key={opt.key} className="my-1 h-px bg-white/10" />;
            }
            if (opt.type === 'remove') {
              const active = i === activeIdx;
              return (
                <button
                  key={opt.key}
                  role="menuitem"
                  type="button"
                  disabled={busy}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    onRemove?.();
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10 ${
                    active ? 'bg-white/10' : ''
                  }`}
                >
                  {opt.label}
                </button>
              );
            }
            // status row
            const active = i === activeIdx;
            return (
              <button
                key={opt.key}
                role="menuitemradio"
                aria-checked={opt.selected}
                type="button"
                disabled={busy}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  onSet(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 ${
                  active ? 'bg-white/10' : ''
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${
                      opt.selected ? 'bg-indigo-400' : 'bg-white/20'
                    }`}
                  />
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}