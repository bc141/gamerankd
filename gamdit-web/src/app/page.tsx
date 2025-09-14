// src/app/page.tsx
import HomeClient from '@/components/home/HomeClient';
import HomeClientV0 from '@/components/home/HomeClientV0';
import V0SandboxPage from './v0-sandbox/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Step 1: V0 Sandbox - Exact replica for parity testing
const USE_V0_SANDBOX = true;
const USE_V0 = false;

export default function Page() {
  if (USE_V0_SANDBOX) {
    return <V0SandboxPage />;
  }
  return USE_V0 ? <HomeClientV0 /> : <HomeClient />;
}