'use client';

import { memo } from 'react';

type Props = {
  liked: boolean;
  count: number;
  onClick: () => void;
  busy?: boolean;
  className?: string;
  size?: 'sm' | 'md';
};

function LikePillImpl({
  liked,
  count,
  onClick,
  busy = false,
  className = '',
  size = 'sm',
}: Props) {
  const pad = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';
  const base =
    `inline-flex items-center gap-1 rounded border border-white/10 ` +
    `${pad} ${liked ? 'bg-white/15' : 'bg-white/5'} ` +
    `${busy ? 'opacity-60 pointer-events-none' : ''} ${className}`;

  // guard against negative flicker during very fast toggles
  const safeCount = count < 0 ? 0 : count;

  return (
    <button
      type="button"
      onClick={onClick}
      className={base}
      aria-pressed={liked}
      aria-busy={busy || undefined}
      title={liked ? 'Unlike' : 'Like'}
    >
      <span aria-hidden>❤️</span>
      <span className="tabular-nums">{safeCount}</span>
    </button>
  );
}

// memo = no re-render if liked/count/busy/className/size unchanged
const LikePill = memo(LikePillImpl);
export default LikePill;