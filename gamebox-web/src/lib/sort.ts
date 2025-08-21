export type SortKey = 'new' | 'old' | 'top' | 'high' | 'low';

export function compareDatesDesc(a: string, b: string) {
  return b.localeCompare(a);
}
export function compareDatesAsc(a: string, b: string) {
  return a.localeCompare(b);
}

/** Generic comparator factory used everywhere */
export function getComparator<T>(key: SortKey, opts: {
  getCreatedAt: (x: T) => string;
  getLikeCount?: (x: T) => number; // optional for "top"
  getRating?: (x: T) => number;    // optional for "high"/"low"
}): (a: T, b: T) => number {
  const { getCreatedAt, getLikeCount, getRating } = opts;
  if (key === 'new')  return (a,b)=> compareDatesDesc(getCreatedAt(a), getCreatedAt(b));
  if (key === 'old')  return (a,b)=> compareDatesAsc(getCreatedAt(a), getCreatedAt(b));
  if (key === 'top')  return (a,b)=> {
    const ca = (getLikeCount?.(a) ?? 0), cb = (getLikeCount?.(b) ?? 0);
    if (cb !== ca) return cb - ca;
    return compareDatesDesc(getCreatedAt(a), getCreatedAt(b));
  };
  if (key === 'high') return (a,b)=> (getRating?.(b) ?? 0) - (getRating?.(a) ?? 0);
  if (key === 'low')  return (a,b)=> (getRating?.(a) ?? 0) - (getRating?.(b) ?? 0);
  return () => 0;
}