// src/components/icons/Bell.tsx
import * as React from 'react';
import { IconProps } from './IconTypes';

export default function BellIcon({
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
        d="M6 8a6 6 0 1112 0v4l1.5 3H4.5L6 12V8z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 19a2.5 2.5 0 005 0"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}