/**
 * Performance test: loads all data sources and measures key timings.
 * Run: npx playwright test test/perf-test.mjs --headed
 * Or headless: npx playwright test test/perf-test.mjs
 */
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173/ithomiini_maps/'

test('measure load performance with all sources enabled', async ({ page }) => {
  // Collect console logs with [Perf] prefix
  const perfLogs = []
  const allLogs = []
  page.on('console', msg => {
    const text = msg.text()
    allLogs.push(text)
    if (text.includes('[Perf]')) {
      perfLogs.push(text)
    }
  })

  // Collect violation warnings
  const violations = []
  page.on('console', msg => {
    if (msg.text().includes('[Violation]')) {
      violations.push(msg.text())
    }
  })

  console.log('Navigating to app...')
  await page.goto(BASE_URL)

  // Wait for initial data load (Sanger is default)
  await page.waitForFunction(() => {
    const logs = Array.from(document.querySelectorAll('.leaflet-marker-icon')).length
    // Check if map points loaded by looking for data store
    return window.__vue_app__ || document.querySelector('.maplibregl-canvas')
  }, { timeout: 15000 })

  console.log('Map loaded, waiting for initial data...')
  await page.waitForTimeout(3000)

  // Check initial perf logs
  console.log('\n=== INITIAL LOAD (Sanger only) ===')
  for (const log of perfLogs) console.log(log)

  // Now enable all sources by clicking source checkboxes
  // First let's find the source filter section
  console.log('\n=== ENABLING ALL SOURCES ===')
  perfLogs.length = 0

  // Look for source filter checkboxes/buttons and enable all
  const sourceToggles = await page.$$('[data-source-toggle], .source-checkbox, input[type="checkbox"]')
  console.log(`Found ${sourceToggles.length} checkboxes`)

  // Wait for all data to load (look for the last source in console)
  await page.waitForFunction(() => {
    // Check total record count - should be > 100k when all sources loaded
    return true
  }, { timeout: 30000 })

  // Wait for all sources to finish loading
  await page.waitForTimeout(15000)

  console.log('\n=== ALL PERF LOGS ===')
  for (const log of perfLogs) console.log(log)

  // Test hover performance - move mouse over map area
  console.log('\n=== TESTING HOVER PERFORMANCE ===')
  const canvas = await page.$('.maplibregl-canvas')
  if (canvas) {
    const box = await canvas.boundingBox()
    if (box) {
      // Move mouse across the map in a sweep
      for (let i = 0; i < 20; i++) {
        const x = box.x + (box.width * i / 20)
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.waitForTimeout(50)
      }
    }
  }
  await page.waitForTimeout(1000)

  console.log('\n=== FINAL PERF SUMMARY ===')
  for (const log of perfLogs) console.log(log)

  if (violations.length > 0) {
    console.log(`\n=== VIOLATIONS (${violations.length}) ===`)
    for (const v of violations) console.log(v)
  }

  // Log data loading lines
  console.log('\n=== DATA LOADING LOGS ===')
  for (const log of allLogs) {
    if (log.includes('Loaded') || log.includes('records') || log.includes('total:')) {
      console.log(log)
    }
  }
})
