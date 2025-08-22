'use client';

import type { ComponentProps } from 'react';

type Tone = 'default' | 'neutral' | 'success' | 'danger' | 'indigo';
type Size = 'xs' | 'sm';

const toneClass: Record<Tone, string> = {
  default: 'bg-white/10 text-white/90',
  neutral: 'bg-white/10 text-white/70',
  success: 'bg-emerald-600/20 text-emerald-300',
  danger: 'bg-rose-600/20 text-rose-300',
  indigo: 'bg-indigo-600 text-white',
};

const sizeClass: Record<Size, string> = {
  xs: 'text-[11px] px-2 py-0.5 rounded',
  sm: 'text-sm px-2.5 py-1 rounded-md',
};

type Props = {
  tone?: Tone;
  size?: Size;
  className?: string;
} & ComponentProps<'span'>;

export default function Badge({ tone = 'default', size = 'xs', className = '', ...rest }: Props) {
  return (
    <span
      className={`${toneClass[tone]} ${sizeClass[size]} inline-flex items-center gap-1 ${className}`}
      {...rest}
    />
  );
}