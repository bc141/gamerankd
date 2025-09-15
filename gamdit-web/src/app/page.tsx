// src/app/page.tsx
import HomeClientV0 from '@/components/home/HomeClientV0';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <HomeClientV0 />;
}