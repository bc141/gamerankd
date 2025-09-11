'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    className, 
    variant = 'rectangular', 
    width, 
    height, 
    animation = 'pulse',
    style,
    ...props 
  }, ref) => {
    const variantClasses = {
      text: 'h-4 w-full',
      rectangular: 'h-4 w-full',
      circular: 'rounded-full aspect-square',
    };

    const animationClasses = {
      pulse: 'animate-pulse',
      wave: 'animate-wave',
      none: '',
    };

    const customStyle = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-[rgb(var(--bg-elev))] rounded-md',
          variantClasses[variant],
          animationClasses[animation],
          className
        )}
        style={customStyle}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Pre-built skeleton components for common use cases
export const PostCardSkeleton = () => (
  <div className="space-y-4 p-6">
    <div className="flex items-start gap-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={14} />
        </div>
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={14} />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <Skeleton width={60} height={32} />
      <Skeleton width={80} height={32} />
    </div>
  </div>
);

export const SidebarSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-1">
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={12} />
        </div>
      </div>
    ))}
  </div>
);

export const FeedSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <PostCardSkeleton key={i} />
    ))}
  </div>
);

export { Skeleton };
