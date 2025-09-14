// src/components/controls/SortControl.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SortKey, SortOption } from '@/lib/sort';

type Props = {
  value?: SortKey;                         // external controlled value (optional)
  onChange?: (next: SortKey) => void;      // external change (optional)
  options: SortOption[];
  className?: string;
  /** URL param to sync with (e.g., 'sort'). If provided, we read + update query string. */
  queryKey?: string;
  /** Default if neither value nor query string present */
  defaultValue?: SortKey;
};

export default function SortControl({
  value,
  onChange,
  options,
  className,
  queryKey = 'sort',
  defaultValue = options[0]?.key ?? 'recent',
}: Props) {
  const initialFromUrl: SortKey | undefined = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const v = sp.get(queryKey) as SortKey | null;
      return (v && options.some(o => o.key === v)) ? v : undefined;
    } catch { return undefined; }
  }, [queryKey, options]);

  const [internal, setInternal] = useState<SortKey>(value ?? initialFromUrl ?? defaultValue);

  // external value control
  useEffect(() => {
    if (value && value !== internal) setInternal(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL sync
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set(queryKey, internal);
    const next = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState(null, '', next);
  }, [internal, queryKey]);

  function commit(next: SortKey) {
    setInternal(next);
    onChange?.(next);
  }

  return (
    <label className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <span className="text-sm text-white/60">Sort</span>
      <select
        value={internal}
        onChange={(e) => commit(e.target.value as SortKey)}
        aria-label="Sort items"
        className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}