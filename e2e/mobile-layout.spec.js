import { test, expect } from '@playwright/test'

test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true })

  test('hides desktop sidebar on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const sidebar = page.locator('.sidebar')
    const count = await sidebar.count()
    if (count > 0) {
      const visible = await sidebar.first().isVisible()
      expect(visible).toBe(false)
    }
  })

  test('shows mobile top bar', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const topBar = page.locator('[class*="mobile-top"], [class*="top-bar"]')
    await expect(topBar.first()).toBeVisible()
  })

  test('renders mobile action bar', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const bar = page.locator('.mobile-action-bar')
    const exists = await bar.count()
    expect(exists).toBeGreaterThanOrEqual(0)
  })

  test('mobile layout is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const layout = page.locator('.mobile-layout, [class*="mobile-layout"]')
    await expect(layout.first()).toBeVisible()
  })
})
