// src/components/icons/IconTypes.ts
import * as React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement> & {
  /** Optional accessible text. If omitted, icon will be aria-hidden. */
  title?: string;
  /** Default stroke width across the app; override per icon if needed */
  strokeWidth?: number;
};