// src/lib/sort.ts
export type SortKey = 'recent' | 'az' | 'za' | 'status' | 'rating_desc' | 'rating_asc';

export type SortOption = {
  key: SortKey;
  label: string;
  hint?: string;
};

export const BASE_SORTS: SortOption[] = [
  { key: 'recent', label: 'Recently updated' },
  { key: 'az',     label: 'A → Z' },
  { key: 'za',     label: 'Z → A' },
];

export const LIBRARY_SORTS: SortOption[] = [
  ...BASE_SORTS,
  { key: 'status', label: 'Status' },
];

export type SupabaseSortMap = {
  recent: { column: string; table?: string }; // table optional (base table when undefined)
  name:   { column: string; table?: string }; // relation alias (e.g., 'game')
  status?: { column: string; table?: string }; // optional; base table when undefined
  rating?: { column: string; table?: string }; // optional
};

// helper to only add foreignTable when present
function orderOpts(table: string | undefined, ascending: boolean) {
  return table ? { ascending, foreignTable: table as string } : { ascending };
}

// Loosen the bound so any Supabase builder with `order` is accepted.
type AnyOrderable = {
  order: (
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
      foreignTable?: string;
    }
  ) => any;
};

/**
 * Apply sort to a Supabase query builder (chainable).
 */
export function applySortToSupabase<T extends AnyOrderable>(
  qb: T,
  sort: SortKey,
  map: SupabaseSortMap
): T {
  switch (sort) {
    case 'recent':
      // base table column: DO NOT pass foreignTable
      return qb.order(map.recent.column, orderOpts(map.recent.table, false));

    case 'az':
      return qb.order(map.name.column, orderOpts(map.name.table, true));

    case 'za':
      return qb.order(map.name.column, orderOpts(map.name.table, false));

    case 'status': {
      if (!map.status) return qb;

      // 1) order by status (base), 2) stable sort by name (relation)
      const q1 = (qb as any).order(map.status.column, orderOpts(map.status.table, true));
      const q2 = (q1 as any).order(map.name.column, orderOpts(map.name.table, true));
      return q2;
    }

    case 'rating_desc': {
      if (!map.rating) return qb;
      return (qb as any).order(map.rating.column, {
        ascending: false,
        foreignTable: map.rating.table,
        nullsLast: true,
      });
    }

    case 'rating_asc': {
      if (!map.rating) return qb;
      return (qb as any).order(map.rating.column, {
        ascending: true,
        foreignTable: map.rating.table,
        nullsLast: true,
      });
    }

    default:
      return qb;
  }
}

/**
 * Apply sort to an in-memory list (client-only / fallback).
 */
export function applySortToArray<T>(
  items: T[],
  sort: SortKey,
  accessors: {
    updatedAt: (x: T) => string | number | Date | null | undefined;
    name: (x: T) => string | null | undefined;
    status?: (x: T) => string | null | undefined;
  }
) {
  const safeTime = (v: any) => (v ? new Date(v).getTime() : 0);
  const safeStr  = (v: any) => (v ?? '').toString().toLowerCase();

  const arr = [...items];

  switch (sort) {
    case 'recent':
      arr.sort((a, b) => safeTime(accessors.updatedAt(b)) - safeTime(accessors.updatedAt(a)));
      break;

    case 'az':
      arr.sort((a, b) => safeStr(accessors.name(a)).localeCompare(safeStr(accessors.name(b))));
      break;

    case 'za':
      arr.sort((a, b) => safeStr(accessors.name(b)).localeCompare(safeStr(accessors.name(a))));
      break;

    case 'status':
      if (accessors.status) {
        arr.sort((a, b) => {
          const s = safeStr(accessors.status!(a)).localeCompare(safeStr(accessors.status!(b)));
          if (s !== 0) return s;
          return safeStr(accessors.name(a)).localeCompare(safeStr(accessors.name(b)));
        });
      }
      break;
  }
  return arr;
}