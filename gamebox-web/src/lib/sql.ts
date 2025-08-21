// src/lib/sql.ts
export function toInList(ids: string[]) {
    // PostgREST expects: in.(val1,val2,...) — quote UUIDs
    return `(${ids.map(id => `"${id}"`).join(',')})`;
  }