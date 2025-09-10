import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', msg => {
    if (['error','warning'].includes(msg.type())) {
      console.error(`[console.${msg.type()}]`, msg.text());
    }
  });
});
