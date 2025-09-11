'use client';

import { memo, type MouseEvent } from 'react';

export type InteractionType = 'like' | 'comment' | 'share' | 'bookmark';

export type Props = {
  type: InteractionType;
  count: number;
  active?: boolean;
  onClick: () => void;
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  stopPropagation?: boolean;
};

const interactionConfig = {
  like: {
    icon: '♡',
    activeIcon: '♥',
    activeColor: 'text-red-500',
    hoverColor: 'hover:text-red-500',
    bgHover: 'hover:bg-red-500/10',
  },
  comment: {
    icon: '💬',
    activeIcon: '💬',
    activeColor: 'text-blue-500',
    hoverColor: 'hover:text-blue-500',
    bgHover: 'hover:bg-blue-500/10',
  },
  share: {
    icon: '↗',
    activeIcon: '↗',
    activeColor: 'text-green-500',
    hoverColor: 'hover:text-green-500',
    bgHover: 'hover:bg-green-500/10',
  },
  bookmark: {
    icon: '🔖',
    activeIcon: '🔖',
    activeColor: 'text-yellow-500',
    hoverColor: 'hover:text-yellow-500',
    bgHover: 'hover:bg-yellow-500/10',
  },
};

function InteractionButtonImpl({
  type,
  count,
  active = false,
  onClick,
  busy = false,
  className = '',
  ariaLabel,
  size = 'sm',
  stopPropagation = true,
}: Props) {
  const config = interactionConfig[type];
  const pad = size === 'md' ? 'px-3 py-1.5' : 'px-2 py-1';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  
  const base = `
    inline-flex items-center gap-1.5 rounded-full border border-white/10 
    transition-all duration-200 ${pad} ${textSize}
    ${active ? config.activeColor : 'text-white/70'}
    ${active ? 'bg-white/10' : 'bg-white/5'}
    ${!busy ? `${config.hoverColor} ${config.bgHover}` : ''}
    ${busy ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
    ${className}
  `.trim();

  const safeCount = count < 0 ? 0 : count;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    onClick();
  };

  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel;
    const action = active ? 'Unlike' : 'Like';
    switch (type) {
      case 'like': return active ? 'Unlike' : 'Like';
      case 'comment': return 'View comments';
      case 'share': return 'Share';
      case 'bookmark': return active ? 'Remove bookmark' : 'Bookmark';
      default: return action;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={base}
      aria-pressed={active}
      aria-busy={busy || undefined}
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
      disabled={busy}
      data-ignore-context
    >
      <span 
        className={`transition-colors ${active ? config.activeColor : ''}`}
        aria-hidden
      >
        {active ? config.activeIcon : config.icon}
      </span>
      {count > 0 && (
        <span className="tabular-nums font-medium">
          {safeCount}
        </span>
      )}
    </button>
  );
}

export default memo(InteractionButtonImpl);
