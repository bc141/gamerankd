'use client';

import { SortKey } from '@/lib/sort';

type Props = {
  value: SortKey;
  onChange: (s: SortKey) => void;
  className?: string;
};

export default function SortSelect({ value, onChange, className }: Props) {
  return (
    <div className={className}>
      <label className="mr-2 text-sm text-white/70">Sort</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="rounded-md border border-white/15 bg-neutral-900 text-white px-2 py-1 text-sm"
      >
        <option value="recent">Most recent</option>
        <option value="az">A–Z</option>
        <option value="za">Z–A</option>
        <option value="status">By status</option>
      </select>
    </div>
  );
}
