import type React from 'react';

const IGNORE = 'a,button,[data-ignore-context],input,textarea,select,svg,summary,details';

function hasSelection(): boolean {
  const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
  return !!(sel && !sel.isCollapsed);
}

export function shouldOpenFromTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return true;
  if (el.closest(IGNORE)) return false;
  if (hasSelection()) return false;
  return true;
}

export function onRowClick(
  e: React.MouseEvent,
  open: () => void
) {
  if (!shouldOpenFromTarget(e.target)) return;
  open();
}

export function onRowKeyDown(
  e: React.KeyboardEvent,
  open: () => void
) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target as HTMLElement | null;
  if (el && el.closest(IGNORE)) return; // don't trigger when focused on a button/link inside
  e.preventDefault();
  open();
}