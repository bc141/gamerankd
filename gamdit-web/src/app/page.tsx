// src/app/page.tsx
import HomeClient from '@/components/home/HomeClient';
import HomeClientV0 from '@/components/home/HomeClientV0';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Temporary switch to test v0 integration
const USE_V0 = true;

export default function Page() {
  return USE_V0 ? <HomeClientV0 /> : <HomeClient />;
}