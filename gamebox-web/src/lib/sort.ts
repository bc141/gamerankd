// src/lib/sort.ts
export type SortKey = 'recent' | 'az' | 'za' | 'status';

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
  recent: { column: string; table?: string };
  name:   { column: string; table?: string };
  status?: { column: string; table?: string };
};

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

// Return the same builder type T, unchanged.
export function applySortToSupabase<T extends AnyOrderable>(
  qb: T,
  sort: SortKey,
  map: SupabaseSortMap
): T {
  switch (sort) {
    case 'recent':
      return qb.order(map.recent.column, { ascending: false, foreignTable: map.recent.table });

    case 'az':
      return qb.order(map.name.column, { ascending: true, foreignTable: map.name.table });

    case 'za':
      return qb.order(map.name.column, { ascending: false, foreignTable: map.name.table });

    case 'status': {
      if (!map.status) return qb;
      // group by status, then stable by name
      const q2 = qb.order(map.status.column, {
        ascending: true,
        foreignTable: map.status.table,
      });
      return q2.order(map.name.column, {
        ascending: true,
        foreignTable: map.name.table,
      }) as T;
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