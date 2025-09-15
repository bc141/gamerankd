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
})


