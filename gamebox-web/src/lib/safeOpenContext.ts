// src/lib/safeOpenContext.ts
import type React from 'react';

/** Elements that should *not* bubble into "open context". */
export const INTERACTIVE_SELECTOR =
  'a,button,input,textarea,select,label,[role="button"],[role="link"],[contenteditable="true"],[data-ignore-context],.no-context,svg,summary,details';

/** True if the click target is inside something interactive. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(el.closest(INTERACTIVE_SELECTOR));
}

/** True if the user currently has a text selection. */
export function hasActiveSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection?.();
  return !!sel && !sel.isCollapsed;
}

/** Guard for mouse/touch clicks on a row. Calls `open()` only when safe. */
export function onRowClick(
  e: React.MouseEvent,
  open: () => void
): void {
  if (e.defaultPrevented) return;
  // Only primary button without modifiers
  if ('button' in e && e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

  // Don’t open if the user clicked on an interactive element or is selecting text
  if (isInteractiveTarget(e.target)) return;
  if (hasActiveSelection()) return;

  open();
}

/** Keyboard affordance for rows (Enter / Space). */
export function onRowKeyDown(
  e: React.KeyboardEvent,
  open: () => void
): void {
  if (e.defaultPrevented) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    open();
  }
}

/** Convenience: props you can spread onto any "row" element. */
export function rowHandlers(open: () => void) {
  return {
    onClick: (e: React.MouseEvent) => onRowClick(e, open),
    onKeyDown: (e: React.KeyboardEvent) => onRowKeyDown(e, open),
    tabIndex: 0 as const, // make the row focusable for keyboard users
    role: 'button' as const,
  };
}