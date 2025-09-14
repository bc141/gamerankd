// src/app/page.tsx
import HomeClient from '@/components/home/HomeClient';
import HomeClientV0 from '@/components/home/HomeClientV0';
import V0TestPage from './v0-test/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// V0 Test - Completely isolated from main app
const USE_V0_TEST = false;
const USE_V0 = false;

export default function Page() {
  if (USE_V0_TEST) {
    return <V0TestPage />;
  }
  return USE_V0 ? <HomeClientV0 /> : <HomeClient />;
}