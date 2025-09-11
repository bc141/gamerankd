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
    borderColor: 'border-red-500/30',
    activeBorderColor: 'border-red-500',
  },
  comment: {
    icon: '💬',
    activeIcon: '💬',
    activeColor: 'text-blue-500',
    hoverColor: 'hover:text-blue-500',
    bgHover: 'hover:bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    activeBorderColor: 'border-blue-500',
  },
  share: {
    icon: '↗',
    activeIcon: '↗',
    activeColor: 'text-green-500',
    hoverColor: 'hover:text-green-500',
    bgHover: 'hover:bg-green-500/10',
    borderColor: 'border-green-500/30',
    activeBorderColor: 'border-green-500',
  },
  bookmark: {
    icon: '🔖',
    activeIcon: '🔖',
    activeColor: 'text-yellow-500',
    hoverColor: 'hover:text-yellow-500',
    bgHover: 'hover:bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    activeBorderColor: 'border-yellow-500',
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
  
  // Optimized dimensions for maximum clarity
  const dimensions = size === 'md' 
    ? 'h-10 px-3' 
    : 'h-8 px-2.5';
  
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  const iconSize = size === 'md' ? 'text-base' : 'text-sm';
  
  const base = `
    inline-flex items-center justify-center gap-1.5 
    rounded-full border-2 transition-all duration-200 
    ${dimensions} ${textSize}
    ${active ? config.activeColor : 'text-white/60'}
    ${active ? config.activeBorderColor : config.borderColor}
    ${active ? 'bg-transparent' : 'bg-transparent'}
    ${!busy ? `${config.hoverColor} ${config.bgHover}` : ''}
    ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:scale-105'}
    font-medium antialiased
    ${className}
  `.trim();

  const safeCount = count < 0 ? 0 : count;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    onClick();
  };

  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel;
    switch (type) {
      case 'like': return active ? 'Unlike' : 'Like';
      case 'comment': return 'View comments';
      case 'share': return 'Share';
      case 'bookmark': return active ? 'Remove bookmark' : 'Bookmark';
      default: return 'Interact';
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
        className={`${iconSize} transition-colors ${active ? config.activeColor : ''}`}
        aria-hidden
      >
        {active ? config.activeIcon : config.icon}
      </span>
      {count > 0 && (
        <span className={`${textSize} tabular-nums font-semibold tracking-tight`}>
          {safeCount}
        </span>
      )}
    </button>
  );
}

export default memo(InteractionButtonImpl);
