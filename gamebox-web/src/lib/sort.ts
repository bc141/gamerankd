// src/lib/sort.ts
export type SortKey =
  | 'recent'
  | 'az'
  | 'za'
  | 'status'
  | 'ratingHigh'
  | 'ratingLow';

type Orderable<T> = {
  order: (
    column: string,
    opts?: { ascending?: boolean; foreignTable?: string }
  ) => Orderable<T>;
};

export type SupabaseSortMap = {
  recent: { column: string; table?: string };
  name: { column: string; table: string };   // <-- must be the alias used in .select(...)
  status?: { column: string; table?: string };
};

export function applySortToSupabase<T>(
  qb: Orderable<T>,
  sort: SortKey,
  map: SupabaseSortMap
): Orderable<T> {
  switch (sort) {
    case 'recent':
      return qb.order(map.recent.column, {
        ascending: false,
        foreignTable: map.recent.table,
      });

    case 'az':
      return qb.order(map.name.column, {
        ascending: true,
        foreignTable: map.name.table, // e.g. 'game' (the alias), not 'games'
      });

    case 'za':
      return qb.order(map.name.column, {
        ascending: false,
        foreignTable: map.name.table,
      });

    // We'll do status ranking client-side for custom order; here just a stable secondary.
    case 'status': {
      // Group by status, then stable by name (client will re-rank buckets)
      const q2 = qb.order(map.status?.column ?? 'status', {
        ascending: true,
        foreignTable: map.status?.table,
      });
      return q2.order(map.name.column, {
        ascending: true,
        foreignTable: map.name.table,
      });
    }

    default:
      return qb;
  }
}

// -------- client-side fallback / refiners --------

export function applySortToArray<T extends object>(
  items: T[],
  sort: SortKey,
  get: (row: T) => {
    name: string;          // for A-Z / Z-A
    recent: string;        // ISO date
    status: string;        // 'Playing' | 'Backlog' | 'Completed' | 'Dropped'
    rating?: number | null; // 0..100 (if you store /100)
  }
): T[] {
  const by = (fn: (x: T) => any, asc = true) =>
    [...items].sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });

  switch (sort) {
    case 'recent': {
      // recent first (desc)
      return by((r) => get(r).recent, false);
    }
    case 'az': {
      return by((r) => get(r).name.toLowerCase(), true);
    }
    case 'za': {
      return by((r) => get(r).name.toLowerCase(), false);
    }
    case 'status': {
      const rank: Record<string, number> = {
        Playing: 0,
        Backlog: 1,
        Completed: 2,
        Dropped: 3,
      };
      return [...items].sort((a, b) => {
        const ga = get(a);
        const gb = get(b);
        const ra = rank[ga.status] ?? 999;
        const rb = rank[gb.status] ?? 999;
        if (ra !== rb) return ra - rb;
        return ga.name.localeCompare(gb.name);
      });
    }
    case 'ratingHigh': {
      // rating is /100; higher first; keep nulls last
      return [...items].sort((a, b) => {
        const ra = get(a).rating ?? -1;
        const rb = get(b).rating ?? -1;
        return rb - ra || get(a).name.localeCompare(get(b).name);
      });
    }
    case 'ratingLow': {
      return [...items].sort((a, b) => {
        const ra = get(a).rating ?? 101;
        const rb = get(b).rating ?? 101;
        return ra - rb || get(a).name.localeCompare(get(b).name);
      });
    }
    default:
      return items;
  }
}