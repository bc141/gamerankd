'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, footer, variant = 'default', interactive = false, children, ...props }, ref) => {
    const baseClasses = 'rounded-2xl border transition-all duration-200';
    
    const variantClasses = {
      default: 'bg-[rgb(var(--bg-card))] border-[rgb(var(--border))] shadow-[var(--shadow-sm)]',
      elevated: 'bg-[rgb(var(--bg-card))] border-[rgb(var(--border))] shadow-[var(--shadow)]',
      outlined: 'bg-transparent border-[rgb(var(--border-strong))] shadow-none',
    };
    
    const interactiveClasses = interactive 
      ? 'cursor-pointer hover:shadow-[var(--shadow)] hover:border-[rgb(var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))]'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          interactiveClasses,
          className
        )}
        {...props}
      >
        {title && (
          <div className="px-6 py-4 border-b border-[rgb(var(--border))]">
            <h2 className="text-lg font-semibold text-[rgb(var(--txt))] leading-tight">
              {title}
            </h2>
          </div>
        )}
        
        <div className={cn(
          title ? 'px-6 py-4' : 'p-6',
          footer ? 'pb-4' : ''
        )}>
          {children}
        </div>
        
        {footer && (
          <div className="px-6 py-4 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
