'use client';

export default function ViewInContextButton(props: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  const { onClick, className, label = 'View' } = props;
  return (
    <button
      onClick={onClick}
      className={
        className ??
        'text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10'
      }
      aria-label="View in context"
    >
      {label}
    </button>
  );
}