'use client';

import { useMemo, useRef, useState } from 'react';

type Props = {
  value: number;                 // 0–5 in 0.5 steps
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;                 // px
};

export default function StarRating({ value, onChange, readOnly, size = 28 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // what we render right now
  const display = hover ?? value;
  const percent = Math.max(0, Math.min(display / 5, 1)) * 100;

  function handleMove(e: React.MouseEvent) {
    if (readOnly || !onChange || !wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    // x inside the star row, clamped
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);

    // figure out which half within which star
    const starW = rect.width / 5;               // width of one star (including any gaps)
    const halfSteps = Math.ceil((x / starW) * 2); // 1..10
    const stars = Math.min(10, Math.max(1, halfSteps)) / 2; // 0.5..5.0

    setHover(stars);
  }

  function handleLeave() {
    if (readOnly || !onChange) return;
    setHover(null);
  }

  function handleClick() {
    if (readOnly || !onChange || hover == null) return;
    onChange(hover);
  }

  const Star = useMemo(
    () => (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
        <path d="M12 17.3l-5.4 3.2 1.4-6.1-4.6-4.1 6.2-.5L12 4l2.4 5.8 6.2.5-4.6 4.1 1.4 6.1z" fill="currentColor" />
      </svg>
    ),
    [size]
  );

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      style={{ cursor: readOnly ? 'default' : 'pointer', lineHeight: 0 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      role={readOnly ? undefined : 'slider'}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={display || undefined}
    >
      {/* Base row (empty) */}
      <div className="flex text-neutral-600/40">{Star}{Star}{Star}{Star}{Star}</div>

      {/* Filled overlay */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${percent}%` }}>
        <div className="flex text-yellow-400">{Star}{Star}{Star}{Star}{Star}</div>
      </div>
    </div>
  );
}