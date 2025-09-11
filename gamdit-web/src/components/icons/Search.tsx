// src/components/icons/Search.tsx
import * as React from 'react';
import { IconProps } from './IconTypes';

export default function SearchIcon({
  title,
  strokeWidth = 1.5,
  className,
  ...rest
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}