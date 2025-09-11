'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps extends React.HTMLAttributes<HTMLDivElement> {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const Segmented = forwardRef<HTMLDivElement, SegmentedProps>(
  ({ className, options, value, onValueChange, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 text-sm',
      md: 'h-10 text-sm',
      lg: 'h-12 text-base',
    };

    const paddingClasses = {
      sm: 'px-2',
      md: 'px-3',
      lg: 'px-4',
    };

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          'inline-flex rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] p-1',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          const isDisabled = option.disabled;
          
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => !isDisabled && onValueChange(option.value)}
              className={cn(
                'relative flex items-center justify-center rounded-lg font-medium transition-all duration-200',
                paddingClasses[size],
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2',
                isActive
                  ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-contrast))] shadow-sm'
                  : 'text-[rgb(var(--txt-muted))] hover:text-[rgb(var(--txt))] hover:bg-[rgb(var(--hover))]',
                isDisabled && 'opacity-50 cursor-not-allowed',
                !isDisabled && 'cursor-pointer'
              )}
            >
              {option.label}
              {isActive && (
                <span className="absolute inset-0 rounded-lg bg-[rgb(var(--accent))] opacity-10" />
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

Segmented.displayName = 'Segmented';

export { Segmented };
