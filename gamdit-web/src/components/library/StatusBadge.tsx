'use client';

import type { LibraryStatus } from '@/lib/library';

type Props = {
  status: LibraryStatus;
  className?: string;
};

const LABEL: Record<LibraryStatus, string> = {
  Backlog: 'Backlog',
  Playing: 'Playing',
  Completed: 'Completed',
  Dropped: 'Dropped',
};

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded border border-white/10 bg-white/5 text-white/85 px-2 py-0.5 text-xs ${className ?? ''}`}
      aria-label={`Status: ${LABEL[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
