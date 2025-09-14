// src/app/search/page.tsx  (server component)
import { Suspense } from 'react';
import SearchPageClient from '@/components/search/SearchPageClient';

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-6">Loading…</main>}>
      <SearchPageClient />
    </Suspense>
  );
}