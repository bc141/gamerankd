'use client';

import { memo, type MouseEvent } from 'react';

export type Props = {
  liked: boolean;
  count: number;
  onClick: () => void;
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';         // optional sizing
  stopPropagation?: boolean;  // default true; prevents parent row click
};

function LikePillImpl({
  liked,
  count,
  onClick,
  busy = false,
  className = '',
  ariaLabel,
  size = 'sm',
  stopPropagation = true,
}: Props) {
  const pad = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';
  const base =
    `inline-flex items-center gap-1 rounded border border-white/10 transition-colors ` +
    `${pad} ${liked ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'} ` +
    `${busy ? 'opacity-60 pointer-events-none' : ''} ${className}`;

  // guard against negative flicker during very fast toggles
  const safeCount = count < 0 ? 0 : count;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={base}
      aria-pressed={liked}
      aria-busy={busy || undefined}
      aria-label={ariaLabel ?? (liked ? 'Unlike' : 'Like')}
      title={liked ? 'Unlike' : 'Like'}
      disabled={busy}
      data-ignore-context
    >
      <span aria-hidden>❤️</span>
      <span className="tabular-nums">{safeCount}</span>
    </button>
  );
}

export default memo(LikePillImpl);