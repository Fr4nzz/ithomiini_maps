#!/usr/bin/env node
/**
 * Playwright runner for legend overflow tests.
 * Launches a headless browser, loads the app, and runs window.runLegendTests().
 */
const { chromium } = require('/home/user/ithomiini_maps/node_modules/playwright')

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

  // Collect console output
  const logs = []
  page.on('console', msg => {
    const text = msg.text()
    logs.push(text)
    if (text.includes('[Legend]'))
      process.stdout.write(`  ${text}\n`)
  })

  console.log('Loading app...')
  await page.goto('http://localhost:5176/ithomiini_maps/', { waitUntil: 'networkidle', timeout: 30000 })

  // Wait for app to initialize
  await page.waitForSelector('.legend-container', { timeout: 15000 })
  console.log('Legend found, waiting for initial measurement...')
  await page.waitForTimeout(2000)

  // Run all tests
  console.log('Running tests...\n')
  const result = await page.evaluate(() => window.runLegendTests('all'))

  // Wait for all async tests
  await page.waitForTimeout(1000)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${result.passed} passed, ${result.failed} failed, ${result.total} total`)

  if (result.failed > 0) {
    console.log('\nFailed tests:')
    for (const r of result.results.filter(r => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.info}`)
    }
  }

  await browser.close()
  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Test runner error:', err.message)
  process.exit(1)
})
