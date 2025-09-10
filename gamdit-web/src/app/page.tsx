// src/app/page.tsx
import HomeClient from '@/components/home/HomeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <HomeClient />;
}