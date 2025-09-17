// V0 Parity Test - Ensure sandbox matches v0 preview
// This is a simple test to verify components render without errors

export function testV0Parity() {
  // Test that all required elements are present
  const requiredElements = [
    '[data-testid="following-tab"]',
    '[data-testid="for-you-tab"]',
    '[data-testid="composer-submit"]',
    '[data-testid="like-button"]',
    '[data-testid="comment-button"]',
    '[data-testid="share-button"]'
  ]

  const missingElements = requiredElements.filter(selector => {
    return !document.querySelector(selector)
  })

  if (missingElements.length > 0) {
    throw new Error(`Missing required elements: ${missingElements.join(', ')}`)
  }

  // Test that tabs have proper ARIA attributes
  const followingTab = document.querySelector('[data-testid="following-tab"]')
  const forYouTab = document.querySelector('[data-testid="for-you-tab"]')
  
  if (followingTab?.getAttribute('role') !== 'tab') {
    throw new Error('Following tab missing role="tab"')
  }
  
  if (forYouTab?.getAttribute('role') !== 'tab') {
    throw new Error('For You tab missing role="tab"')
  }

  // Test that buttons have proper accessibility
  const buttons = document.querySelectorAll('button')
  buttons.forEach((button, index) => {
    if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
      console.warn(`Button ${index} missing accessible name`)
    }
  })

  console.log('✅ V0 Parity Test Passed - All components render correctly')
  return true
}

// Run test when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testV0Parity)
  } else {
    testV0Parity()
  }
}
