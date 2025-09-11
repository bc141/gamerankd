import './setup/console';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Smoke Tests', () => {
  test('@smoke home loads + a11y', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gamebox/i);
    await expect(page.getByRole('link', { name: /Sign in|Profile/i })).toBeVisible();
    
    // Accessibility testing with Axe
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(v =>
      ['critical','serious'].includes(v.impact ?? '')
    );
    const minor = results.violations.filter(v =>
      ['minor','moderate'].includes(v.impact ?? '')
    );
    
    // Log a11y counts for AI review
    console.log(`[a11y] Critical/Serious: ${severe.length}, Minor/Moderate: ${minor.length}`);
    
    expect(severe).toEqual([]); // fail on critical/serious
    if (minor.length > 0) {
      console.warn(`[a11y] Minor/Moderate issues found: ${minor.length}`);
    }
  });

  test('@smoke login page loads + a11y', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Gamebox/i);
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();
    
    // Accessibility testing with Axe
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(v =>
      ['critical','serious'].includes(v.impact ?? '')
    );
    const minor = results.violations.filter(v =>
      ['minor','moderate'].includes(v.impact ?? '')
    );
    
    // Log a11y counts for AI review
    console.log(`[a11y] Critical/Serious: ${severe.length}, Minor/Moderate: ${minor.length}`);
    
    expect(severe).toEqual([]); // fail on critical/serious
    if (minor.length > 0) {
      console.warn(`[a11y] Minor/Moderate issues found: ${minor.length}`);
    }
  });

  test('@smoke search page loads + a11y', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Gamebox/i);
    await expect(page.getByRole('textbox', { name: /Search/i })).toBeVisible();
    
    // Accessibility testing with Axe
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(v =>
      ['critical','serious'].includes(v.impact ?? '')
    );
    const minor = results.violations.filter(v =>
      ['minor','moderate'].includes(v.impact ?? '')
    );
    
    // Log a11y counts for AI review
    console.log(`[a11y] Critical/Serious: ${severe.length}, Minor/Moderate: ${minor.length}`);
    
    expect(severe).toEqual([]); // fail on critical/serious
    if (minor.length > 0) {
      console.warn(`[a11y] Minor/Moderate issues found: ${minor.length}`);
    }
  });

  test('@smoke discover page loads + a11y', async ({ page }) => {
    await page.goto('/discover');
    await expect(page).toHaveTitle(/Gamebox/i);
    
    // Accessibility testing with Axe
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(v =>
      ['critical','serious'].includes(v.impact ?? '')
    );
    const minor = results.violations.filter(v =>
      ['minor','moderate'].includes(v.impact ?? '')
    );
    
    // Log a11y counts for AI review
    console.log(`[a11y] Critical/Serious: ${severe.length}, Minor/Moderate: ${minor.length}`);
    
    expect(severe).toEqual([]); // fail on critical/serious
    if (minor.length > 0) {
      console.warn(`[a11y] Minor/Moderate issues found: ${minor.length}`);
    }
  });

  test('@smoke API endpoints respond', async ({ request }) => {
    // Test ping endpoint
    const pingResponse = await request.get('/api/ping');
    expect(pingResponse.status()).toBe(200);
    
    const pingData = await pingResponse.json();
    expect(pingData).toHaveProperty('message', 'pong');
    expect(pingData).toHaveProperty('status', 'ok');
  });
});
