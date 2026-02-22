/**
 * Playwright E2E test for legend measurement algorithm.
 *
 * Tests the core issue: after manual resize, the auto measurement should
 * fill available space to the maximum extent without a scrollbar.
 *
 * Run: npx playwright test test/legend-measurement-e2e.mjs
 * Or standalone: node test/legend-measurement-e2e.mjs
 */
import { chromium } from 'playwright'

const APP_URL = 'http://localhost:5173/ithomiini_maps/'
const SETTLE_MS = 1500  // Wait for data load + measurement cycles

async function waitForSettle(page, ms = SETTLE_MS) {
  await page.waitForTimeout(ms)
}

// Get legend measurement state from the browser
async function getLegendState(page) {
  return page.evaluate(() => {
    const content = document.querySelector('.legend-content')
    const legend = document.querySelector('.legend-container')
    if (!content || !legend) return null

    const items = content.querySelectorAll('.legend-item:not(.is-hidden)')
    const moreEl = content.querySelector('.legend-more')
    const moreMatch = moreEl?.textContent?.match(/\+\s*(\d+)\s*more/)

    // Measure visual gap: space between last content and container bottom
    const itemsEl = content.querySelector('.legend-items')
    let visualGap = 0
    if (itemsEl) {
      const lastChild = moreEl || itemsEl.lastElementChild
      if (lastChild) {
        const lastBottom = lastChild.getBoundingClientRect().bottom
        const contentBottom = content.getBoundingClientRect().top + content.clientHeight
        visualGap = contentBottom - lastBottom
      }
    }

    return {
      itemCount: items.length,
      moreCount: moreMatch ? parseInt(moreMatch[1]) : 0,
      scrollHeight: content.scrollHeight,
      clientHeight: content.clientHeight,
      overflow: content.scrollHeight - content.clientHeight,
      hasScrollbar: content.scrollHeight > content.clientHeight + 1,
      legendWidth: Math.round(legend.offsetWidth),
      legendHeight: Math.round(legend.offsetHeight),
      visualGap: Math.round(visualGap),
    }
  })
}

// Get Pinia store state
async function getStoreState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    if (!app) return null
    const pinia = app.config.globalProperties.$pinia
    const legend = pinia._s.get('legend')
    return {
      maxItemsMode: legend.maxItemsMode,
      maxItemsManual: legend.maxItemsManual,
      sizeWidth: legend.size.width,
      sizeHeight: legend.size.height,
    }
  })
}

// Set legend to manual size via store
async function setLegendSize(page, width, height) {
  await page.evaluate(({ w, h }) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const legend = pinia._s.get('legend')
    legend.updateSize(w, h)
  }, { w: width, h: height })
}

// Reset legend to auto size
async function resetToAuto(page) {
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const legend = pinia._s.get('legend')
    legend.updateSize('auto', 'auto')
  })
}

// Set manual item count mode
async function setManualItemCount(page, count) {
  await page.evaluate((n) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const legend = pinia._s.get('legend')
    legend.maxItemsMode = 'manual'
    legend.maxItemsManual = n
  }, count)
}

// Set auto item count mode
async function setAutoItemCount(page) {
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const legend = pinia._s.get('legend')
    legend.maxItemsMode = 'auto'
  })
}

// Find max items that fit without scrollbar in manual mode (binary search)
async function findMaxFittingItems(page, maxTotal) {
  let lo = 1, hi = maxTotal, best = 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    await setManualItemCount(page, mid)
    await waitForSettle(page, 400)
    const state = await getLegendState(page)
    if (!state.hasScrollbar) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

const results = []
function pass(name, info = '') {
  results.push({ name, passed: true, info })
  console.log(`  ✅ ${name}${info ? ' — ' + info : ''}`)
}
function fail(name, info = '') {
  results.push({ name, passed: false, info })
  console.log(`  ❌ ${name}${info ? ' — ' + info : ''}`)
}

async function testResizeThenAutoMeasurement(page) {
  console.log('\n📐 Test: Resize → auto measurement fills space')

  // Reset to auto
  await resetToAuto(page)
  await setAutoItemCount(page)
  await waitForSettle(page, 800)

  const autoState = await getLegendState(page)
  console.log(`  Auto state: ${autoState.itemCount} items, ${autoState.legendWidth}×${autoState.legendHeight}, gap=${autoState.visualGap}px`)

  // Now set to a specific manual size (simulating resize end)
  const sizes = [
    { w: 250, h: 300, label: '250×300' },
    { w: 300, h: 400, label: '300×400' },
    { w: 250, h: 500, label: '250×500' },
    { w: 350, h: 250, label: '350×250' },
  ]

  for (const { w, h, label } of sizes) {
    await setAutoItemCount(page)
    await setLegendSize(page, w, h)
    await waitForSettle(page, 800)

    const afterResize = await getLegendState(page)

    // Now find max fitting items via manual mode (ground truth)
    const totalItems = afterResize.itemCount + afterResize.moreCount
    const maxFitting = await findMaxFittingItems(page, totalItems)

    // Go back to auto mode at same size to see what auto calculates
    await setAutoItemCount(page)
    await setLegendSize(page, w, h)
    await waitForSettle(page, 800)

    const autoAtSize = await getLegendState(page)
    const autoCount = autoAtSize.itemCount

    const diff = maxFitting - autoCount
    const info = `auto=${autoCount} manual-max=${maxFitting} diff=${diff} gap=${autoAtSize.visualGap}px scroll=${autoAtSize.overflow}px`

    if (autoAtSize.hasScrollbar) {
      fail(`${label}: no scrollbar in auto mode`, info)
    } else if (diff > 1) {
      fail(`${label}: auto under-fills by ${diff} items`, info)
    } else if (diff === 1 && autoAtSize.visualGap > 24) {
      // 1 item short AND significant gap — likely a measurement issue
      fail(`${label}: 1 item short with ${autoAtSize.visualGap}px gap`, info)
    } else {
      pass(`${label}: auto fills correctly`, info)
    }
  }

  // Restore
  await resetToAuto(page)
  await setAutoItemCount(page)
  await waitForSettle(page, 500)
}

async function testDefaultStateNoScrollbar(page) {
  console.log('\n📐 Test: Default state has no scrollbar')

  await resetToAuto(page)
  await setAutoItemCount(page)
  await waitForSettle(page, 800)

  const state = await getLegendState(page)
  if (!state) {
    fail('Legend exists', 'Legend not found on page')
    return
  }

  if (state.hasScrollbar) {
    fail('Default: no scrollbar', `overflow=${state.overflow}px, ${state.itemCount} items, ${state.legendWidth}×${state.legendHeight}`)
  } else {
    pass('Default: no scrollbar', `${state.itemCount} items +${state.moreCount} more, gap=${state.visualGap}px`)
  }
}

async function testAutoModeMatchesManualMax(page) {
  console.log('\n📐 Test: Auto mode item count matches manual-mode max')

  await resetToAuto(page)
  await setAutoItemCount(page)
  await waitForSettle(page, 800)

  const autoState = await getLegendState(page)
  const autoCount = autoState.itemCount
  const total = autoCount + autoState.moreCount

  // Find max that fits in manual mode at the same dimensions
  const maxFitting = await findMaxFittingItems(page, total)

  // Restore auto
  await setAutoItemCount(page)
  await waitForSettle(page, 500)

  const diff = maxFitting - autoCount
  const info = `auto=${autoCount} manual-max=${maxFitting} diff=${diff} total=${total}`

  if (diff > 1) {
    fail(`Auto under-fills by ${diff} items`, info)
  } else if (diff === 1 && autoState.visualGap > 24) {
    fail(`Auto 1 item short with ${autoState.visualGap}px gap`, info)
  } else {
    pass(`Auto count optimal`, info)
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Legend Measurement E2E Test              ║')
  console.log('╚══════════════════════════════════════════╝')

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  // Collect console logs from the page
  const pageLogs = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[Legend]')) {
      pageLogs.push(text)
    }
  })

  try {
    console.log(`\nNavigating to ${APP_URL}...`)
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 })
    console.log('Page loaded, waiting for legend to initialize...')
    await waitForSettle(page, 3000)

    // Verify legend is visible
    const legendVisible = await page.locator('.legend-container').isVisible()
    if (!legendVisible) {
      console.log('❌ Legend not visible on page. Aborting.')
      return
    }

    await testDefaultStateNoScrollbar(page)
    await testAutoModeMatchesManualMax(page)
    await testResizeThenAutoMeasurement(page)

  } catch (err) {
    console.error('Test error:', err.message)
  } finally {
    // Print captured legend logs
    if (pageLogs.length > 0) {
      console.log('\n── Page [Legend] logs ──')
      for (const log of pageLogs.slice(-30)) {
        console.log(`  ${log}`)
      }
    }

    // Summary
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    console.log(`\n${'═'.repeat(50)}`)
    if (failed === 0) {
      console.log(`✅ ALL ${results.length} TESTS PASSED`)
    } else {
      console.log(`❌ ${failed}/${results.length} TESTS FAILED`)
      for (const r of results.filter(r => !r.passed)) {
        console.log(`  - ${r.name}: ${r.info}`)
      }
    }

    await browser.close()
    process.exit(failed > 0 ? 1 : 0)
  }
}

main()
