import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  retries: 2,                  // helps with minor network flakes
  use: {
    baseURL: process.env.BASE_URL || 'https://gamdit-git-fix-v0-parity-home-brandonc141s-projects.vercel.app',
    headless: true,
    trace: 'on-first-retry',   // produce .zip traces when a test retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }] // machine-readable
  ],
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
});
