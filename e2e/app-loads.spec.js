import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('renders the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#app')).toBeVisible()
    await page.waitForTimeout(5000)
    const text = await page.locator('#app').textContent()
    expect(text.length).toBeGreaterThan(0)
  })

  test('shows numeric content', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(5000)
    const text = await page.textContent('body')
    expect(text).toMatch(/\d+/)
  })
})

test.describe('Desktop sidebar', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('sidebar is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const sidebar = page.locator('.sidebar, [class*="sidebar"]')
    await expect(sidebar.first()).toBeVisible()
  })
})
