import { test, expect } from '@playwright/test'

test.describe('@ux FeedCardV2', () => {
  test('renders post, review, rating and action bar', async ({ page }) => {
    await page.goto('/test/feedcard')

    // Post card: should have Like/Comment/Share buttons
    const postLike = page.getByRole('button', { name: 'Like' }).first()
    await expect(postLike).toBeVisible()

    const commentBtn = page.getByRole('button', { name: 'Comment' }).first()
    await expect(commentBtn).toBeVisible()

    const shareBtn = page.getByRole('button', { name: 'Share' }).first()
    await expect(shareBtn).toBeVisible()

    // Review card: should contain a Read review affordance and rating strip
    await expect(page.getByRole('button', { name: 'Read review →' })).toBeVisible()

    // Rating card: should show score badge
    await expect(page.getByText(/\d+\/100/).first()).toBeVisible()
  })

  test('has exactly four vertical sections', async ({ page }) => {
    await page.goto('/test/feedcard')

    // Check that each card has exactly four vertical sections
    const cards = page.locator('article[role="article"]')
    const cardCount = await cards.count()
    
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i)
      const sections = card.locator('> div > *') // Direct children of the space-y-4 container
      await expect(sections).toHaveCount(4) // header, body, media/rating, actions
    }
  })

  test('images load with naturalWidth > 0', async ({ page }) => {
    await page.goto('/test/feedcard')

    // Wait for images to load
    await page.waitForLoadState('networkidle')

    // Check that at least one image has naturalWidth > 0
    const images = page.locator('img')
    const imageCount = await images.count()
    
    let hasLoadedImage = false
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      if (naturalWidth > 0) {
        hasLoadedImage = true
        break
      }
    }
    
    expect(hasLoadedImage).toBe(true)
  })
})


