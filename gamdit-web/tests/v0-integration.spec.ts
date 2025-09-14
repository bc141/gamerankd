// Playwright tests for v0 integration

import { test, expect } from '@playwright/test'

test.describe('V0 Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/v0')
  })

  test('should load feed with real data', async ({ page }) => {
    // Wait for posts to load
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 10000 })
    
    // Check that posts are visible
    const posts = await page.locator('[data-testid="post-card"]').count()
    expect(posts).toBeGreaterThan(0)
    
    // Check that post content is visible
    const firstPost = page.locator('[data-testid="post-card"]').first()
    await expect(firstPost.locator('.post-content')).toBeVisible()
  })

  test('should handle like/unlike interactions', async ({ page }) => {
    // Wait for posts to load
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 10000 })
    
    // Get initial like count
    const likeButton = page.locator('[data-testid="like-button"]').first()
    const initialCount = await likeButton.textContent()
    
    // Click like button
    await likeButton.click()
    
    // Wait for optimistic update
    await page.waitForTimeout(500)
    
    // Check that count changed (optimistic update)
    const newCount = await likeButton.textContent()
    expect(newCount).not.toBe(initialCount)
  })

  test('should handle post creation', async ({ page }) => {
    // Wait for composer to load
    await page.waitForSelector('[data-testid="composer-submit"]', { timeout: 10000 })
    
    // Type in composer
    const composer = page.locator('.composer-textarea')
    await composer.fill('Test post from Playwright')
    
    // Check that submit button is enabled
    const submitButton = page.locator('[data-testid="composer-submit"]')
    await expect(submitButton).toBeEnabled()
    
    // Submit post
    await submitButton.click()
    
    // Wait for optimistic update
    await page.waitForTimeout(1000)
    
    // Check that post appears in feed
    await expect(page.locator('.post-content:has-text("Test post from Playwright")')).toBeVisible()
  })

  test('should handle infinite scroll', async ({ page }) => {
    // Wait for initial posts to load
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 10000 })
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Wait for load more button
    await page.waitForSelector('button:has-text("Load More")', { timeout: 5000 })
    
    // Click load more
    await page.click('button:has-text("Load More")')
    
    // Wait for new posts to load
    await page.waitForTimeout(2000)
    
    // Check that more posts are visible
    const posts = await page.locator('[data-testid="post-card"]').count()
    expect(posts).toBeGreaterThan(5) // Should have more than initial load
  })

  test('should handle follow/unfollow interactions', async ({ page }) => {
    // Wait for sidebar to load
    await page.waitForSelector('.sidebar-follow-button', { timeout: 10000 })
    
    // Get first follow button
    const followButton = page.locator('.sidebar-follow-button').first()
    const initialText = await followButton.textContent()
    
    // Click follow button
    await followButton.click()
    
    // Wait for optimistic update
    await page.waitForTimeout(500)
    
    // Check that button text changed
    const newText = await followButton.textContent()
    expect(newText).not.toBe(initialText)
  })

  test('should show loading skeletons', async ({ page }) => {
    // Check that skeletons are visible during loading
    await expect(page.locator('.skeleton')).toBeVisible()
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 10000 })
    
    // Check that skeletons are gone
    await expect(page.locator('.skeleton')).not.toBeVisible()
  })

  test('should handle tab switching', async ({ page }) => {
    // Wait for tabs to load
    await page.waitForSelector('[data-testid="following-tab"]', { timeout: 10000 })
    
    // Click following tab
    await page.click('[data-testid="following-tab"]')
    
    // Check that tab is active
    await expect(page.locator('[data-testid="following-tab"]')).toHaveClass(/active/)
    
    // Click for-you tab
    await page.click('[data-testid="for-you-tab"]')
    
    // Check that tab is active
    await expect(page.locator('[data-testid="for-you-tab"]')).toHaveClass(/active/)
  })

  test('should show scroll to top button after scrolling', async ({ page }) => {
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500))
    
    // Check that scroll to top button is visible
    await expect(page.locator('.scroll-to-top.visible')).toBeVisible()
    
    // Click scroll to top
    await page.click('.scroll-to-top')
    
    // Check that page scrolled to top
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBeLessThan(100)
  })

  test('should handle filter chips', async ({ page }) => {
    // Wait for filter chips to load
    await page.waitForSelector('.filter-chip', { timeout: 10000 })
    
    // Click a filter chip
    await page.click('.filter-chip:has-text("Clips")')
    
    // Check that chip is active
    await expect(page.locator('.filter-chip:has-text("Clips")')).toHaveClass(/active/)
  })
})

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/v0')
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 10000 })
  })

  test('should have proper focus management', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    
    // Check that focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    // Check that buttons have proper labels
    const likeButton = page.locator('[data-testid="like-button"]').first()
    await expect(likeButton).toHaveAttribute('aria-label')
    
    const submitButton = page.locator('[data-testid="composer-submit"]')
    await expect(submitButton).toHaveAttribute('aria-label')
  })

  test('should have proper keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Check that focus is on a valid element
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })
})
