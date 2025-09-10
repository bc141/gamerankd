'use client';

import Link from 'next/link';

type Props = {
  /** username slug, e.g. "brandon2" */
  username: string;
  /** optional label override */
  label?: string;
  /** optional styling */
  className?: string;
};

/** Consistent “Back to profile” link for subpages (followers, following, library, etc.) */
export default function BackToProfile({ username, label = 'Back to profile', className }: Props) {
  if (!username) return null;
  return (
    <Link
      href={`/u/${username}`}
      className={`inline-flex items-center gap-2 text-sm text-white/70 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded ${className ?? ''}`}
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}