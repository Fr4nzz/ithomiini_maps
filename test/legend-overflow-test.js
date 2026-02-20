/**
 * Legend Overflow Test Harness
 *
 * In-app test module that verifies the legend never shows a scrollbar
 * when it shouldn't, and fits as many items as space allows.
 *
 * Usage: Open the app in a browser and run from the console:
 *   window.runLegendTests()           // Run all tests
 *   window.runLegendTests('resize')   // Run only resize tests
 *
 * To remove: Delete this file and remove the import from main.js
 */

// Wait for DOM to settle after a reactive change
function waitForSettle(ms = 300) {
  return new Promise(resolve => {
    // Wait for Vue reactivity + double rAF (measurement cycle) + extra buffer
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, ms)
        })
      })
    }, 50)
  })
}

function getContentEl() {
  return document.querySelector('.legend-content')
}

function getLegendEl() {
  return document.querySelector('.legend-container')
}

function getOverflow() {
  const el = getContentEl()
  if (!el) return { hasOverflow: false, amount: 0, scrollH: 0, clientH: 0 }
  const amount = el.scrollHeight - el.clientHeight
  return {
    hasOverflow: amount > 4, // 4px tolerance for subpixel rounding
    amount,
    scrollH: el.scrollHeight,
    clientH: el.clientHeight
  }
}

function getItemCount() {
  const el = getContentEl()
  if (!el) return 0
  const items = el.querySelectorAll('.legend-item:not(.is-hidden)')
  return items.length
}

function getGroupCount() {
  const el = getContentEl()
  if (!el) return 0
  return el.querySelectorAll('.legend-group').length
}

function getMoreCount() {
  const el = getContentEl()
  if (!el) return 0
  const moreEl = el.querySelector('.legend-more')
  if (!moreEl) return 0
  const text = moreEl.textContent.trim()
  const match = text.match(/\+\s*(\d+)\s*more/)
  return match ? parseInt(match[1]) : 0
}

function getLegendSize() {
  const el = getLegendEl()
  if (!el) return { width: 0, height: 0 }
  const rect = el.getBoundingClientRect()
  return { width: Math.round(rect.width), height: Math.round(rect.height) }
}

// Get Pinia stores from the app
function getStores() {
  // Access Pinia stores via the Vue app instance
  const app = document.querySelector('#app')?.__vue_app__
  if (!app) throw new Error('Vue app not found')
  const pinia = app.config.globalProperties.$pinia
  if (!pinia) throw new Error('Pinia not found')

  // Import store definitions dynamically
  const dataStore = pinia._s.get('data')
  const legendStore = pinia._s.get('legend')

  if (!dataStore || !legendStore) throw new Error('Stores not found')
  return { dataStore, legendStore }
}

// Test result tracking
const results = []
function pass(name, info = '') {
  results.push({ name, passed: true, info })
  console.log(`  ✅ ${name}${info ? ' — ' + info : ''}`)
}
function fail(name, info = '') {
  results.push({ name, passed: false, info })
  console.error(`  ❌ ${name}${info ? ' — ' + info : ''}`)
}

// ═══════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════

async function testBasicOverflow() {
  console.group('📐 Basic Overflow Tests')
  const { dataStore, legendStore } = getStores()

  // Test 1: Default state (subspecies, grouped by species)
  await waitForSettle()
  const ov = getOverflow()
  const items = getItemCount()
  const size = getLegendSize()
  if (ov.hasOverflow) {
    fail('Default state: no scrollbar', `${ov.amount}px overflow, ${items} items, ${size.width}×${size.height}`)
  } else {
    pass('Default state: no scrollbar', `${items} items, ${size.width}×${size.height}`)
  }

  // Verify items are shown (not empty)
  if (items > 0) {
    pass('Default state: items visible', `${items} items`)
  } else {
    fail('Default state: items visible', 'no items rendered')
  }

  console.groupEnd()
}

async function testColorByModes() {
  console.group('🎨 Color By Mode Tests')
  const { dataStore } = getStores()

  const modes = ['subspecies', 'species', 'genus', 'status', 'mimicry', 'source']

  for (const mode of modes) {
    dataStore.colorBy = mode
    await waitForSettle(500)

    const ov = getOverflow()
    const items = getItemCount()
    const more = getMoreCount()
    const size = getLegendSize()

    if (ov.hasOverflow) {
      fail(`colorBy=${mode}: no scrollbar`, `${ov.amount}px overflow, ${items} items +${more} more, ${size.width}×${size.height}`)
    } else {
      pass(`colorBy=${mode}: no scrollbar`, `${items} items +${more} more, ${size.width}×${size.height}`)
    }
  }

  // Restore default
  dataStore.colorBy = 'subspecies'
  await waitForSettle()

  console.groupEnd()
}

async function testGroupByModes() {
  console.group('📂 Group By Mode Tests')
  const { dataStore, legendStore } = getStores()

  // First set colorBy to species (common case for grouping)
  dataStore.colorBy = 'species'
  await waitForSettle(500)

  const groupByOptions = ['none', 'genus', 'tribe', 'subfamily']

  for (const groupBy of groupByOptions) {
    if (groupBy === 'none') {
      legendStore.isGrouped = false
    } else {
      legendStore.isGrouped = true
      legendStore.groupBy = groupBy
    }
    await waitForSettle(500)

    const ov = getOverflow()
    const items = getItemCount()
    const groups = getGroupCount()
    const size = getLegendSize()

    const label = groupBy === 'none' ? 'ungrouped' : `groupBy=${groupBy}`
    if (ov.hasOverflow) {
      fail(`${label}: no scrollbar`, `${ov.amount}px, ${items} items in ${groups} groups, ${size.width}×${size.height}`)
    } else {
      pass(`${label}: no scrollbar`, `${items} items in ${groups} groups, ${size.width}×${size.height}`)
    }
  }

  // Test non-taxonomy grouping (sequencing_status, source)
  dataStore.colorBy = 'subspecies'
  await waitForSettle(500)

  for (const groupBy of ['status', 'source']) {
    legendStore.isGrouped = true
    legendStore.groupBy = groupBy
    await waitForSettle(500)

    const ov = getOverflow()
    const items = getItemCount()
    const groups = getGroupCount()

    if (ov.hasOverflow) {
      fail(`groupBy=${groupBy}: no scrollbar`, `${ov.amount}px, ${items} items in ${groups} groups`)
    } else {
      pass(`groupBy=${groupBy}: no scrollbar`, `${items} items in ${groups} groups`)
    }
  }

  // Restore
  legendStore.isGrouped = true
  legendStore.groupBy = 'species'
  dataStore.colorBy = 'subspecies'
  await waitForSettle()

  console.groupEnd()
}

async function testGroupHeaders() {
  console.group('📋 Group Header Toggle Tests')
  const { dataStore, legendStore } = getStores()

  dataStore.colorBy = 'subspecies'
  legendStore.isGrouped = true
  legendStore.groupBy = 'species'
  await waitForSettle(500)

  // Test with headers shown
  legendStore.groupingSettings = { ...legendStore.groupingSettings, showHeaders: true }
  await waitForSettle(500)

  let ov = getOverflow()
  let items = getItemCount()
  if (ov.hasOverflow) {
    fail('Headers shown: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Headers shown: no scrollbar', `${items} items`)
  }

  // Test with headers hidden
  legendStore.groupingSettings = { ...legendStore.groupingSettings, showHeaders: false }
  await waitForSettle(500)

  ov = getOverflow()
  items = getItemCount()
  if (ov.hasOverflow) {
    fail('Headers hidden: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Headers hidden: no scrollbar', `${items} items`)
  }

  // Restore
  legendStore.groupingSettings = { ...legendStore.groupingSettings, showHeaders: true }
  await waitForSettle()

  console.groupEnd()
}

async function testFiltering() {
  console.group('🔍 Filter Tests')
  const { dataStore, legendStore } = getStores()

  // Reset to known state
  dataStore.colorBy = 'subspecies'
  legendStore.isGrouped = true
  legendStore.groupBy = 'species'
  await waitForSettle(500)

  // Filter to a few species
  const speciesList = ['Mechanitis polymnia', 'Mechanitis lysimnia', 'Mechanitis messenoides']
  for (let i = 1; i <= speciesList.length; i++) {
    dataStore.filters = { ...dataStore.filters, species: speciesList.slice(0, i) }
    await waitForSettle(500)

    const ov = getOverflow()
    const items = getItemCount()
    const size = getLegendSize()

    if (ov.hasOverflow) {
      fail(`${i} species filter: no scrollbar`, `${ov.amount}px, ${items} items, ${size.width}×${size.height}`)
    } else {
      pass(`${i} species filter: no scrollbar`, `${items} items, ${size.width}×${size.height}`)
    }
  }

  // Test with non-taxonomy grouping + filter
  legendStore.groupBy = 'status'
  await waitForSettle(500)

  let ov = getOverflow()
  let items = getItemCount()
  if (ov.hasOverflow) {
    fail('Filtered + groupBy=status: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Filtered + groupBy=status: no scrollbar', `${items} items`)
  }

  // Clear filter
  dataStore.filters = { ...dataStore.filters, species: [] }
  legendStore.groupBy = 'species'
  await waitForSettle()

  console.groupEnd()
}

async function testResize() {
  console.group('↔️ Manual Resize Tests')
  const { legendStore } = getStores()

  // Store original state
  const origSize = legendStore.size
  const origPos = legendStore.position

  // Simulate manual resize to various dimensions
  const resizeTests = [
    { w: 200, h: 300, label: 'narrow+short (200×300)' },
    { w: 400, h: 300, label: 'wide+short (400×300)' },
    { w: 200, h: 500, label: 'narrow+tall (200×500)' },
    { w: 350, h: 400, label: 'medium (350×400)' },
  ]

  for (const { w, h, label } of resizeTests) {
    legendStore.updateSize(w, h)
    await waitForSettle(500)

    const ov = getOverflow()
    const items = getItemCount()

    if (ov.hasOverflow) {
      fail(`Resize ${label}: no scrollbar`, `${ov.amount}px, ${items} items`)
    } else {
      pass(`Resize ${label}: no scrollbar`, `${items} items`)
    }
  }

  // Reset to auto
  legendStore.updateSize('auto', 'auto')
  await waitForSettle()

  console.groupEnd()
}

async function testTextSettings() {
  console.group('🔤 Text Settings Tests')
  const { legendStore } = getStores()

  // Test wrap labels
  legendStore.wrapLabels = true
  await waitForSettle(500)

  let ov = getOverflow()
  let items = getItemCount()
  if (ov.hasOverflow) {
    fail('Wrap labels ON: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Wrap labels ON: no scrollbar', `${items} items`)
  }

  legendStore.wrapLabels = false
  await waitForSettle(500)

  ov = getOverflow()
  items = getItemCount()
  if (ov.hasOverflow) {
    fail('Wrap labels OFF: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Wrap labels OFF: no scrollbar', `${items} items`)
  }

  // Test show counts
  legendStore.showCounts = true
  await waitForSettle(500)

  ov = getOverflow()
  items = getItemCount()
  if (ov.hasOverflow) {
    fail('Show counts ON: no scrollbar', `${ov.amount}px, ${items} items`)
  } else {
    pass('Show counts ON: no scrollbar', `${items} items`)
  }

  legendStore.showCounts = false
  await waitForSettle(500)

  // Test text scale
  for (const scale of [0.8, 1.0, 1.2, 1.5]) {
    legendStore.textScale = scale
    await waitForSettle(500)

    ov = getOverflow()
    items = getItemCount()
    if (ov.hasOverflow) {
      fail(`Text scale ${scale}: no scrollbar`, `${ov.amount}px, ${items} items`)
    } else {
      pass(`Text scale ${scale}: no scrollbar`, `${items} items`)
    }
  }

  // Restore
  legendStore.textScale = 1.0
  legendStore.wrapLabels = true
  await waitForSettle()

  console.groupEnd()
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

async function runLegendTests(suite = 'all') {
  console.log('%c╔══════════════════════════════════════════╗', 'color: #4ade80; font-weight: bold')
  console.log('%c║   Legend Overflow Test Harness            ║', 'color: #4ade80; font-weight: bold')
  console.log('%c╚══════════════════════════════════════════╝', 'color: #4ade80; font-weight: bold')

  results.length = 0

  const suites = {
    basic: testBasicOverflow,
    colorby: testColorByModes,
    groupby: testGroupByModes,
    headers: testGroupHeaders,
    filter: testFiltering,
    resize: testResize,
    text: testTextSettings,
  }

  try {
    if (suite === 'all') {
      for (const [name, fn] of Object.entries(suites)) {
        await fn()
      }
    } else if (suites[suite]) {
      await suites[suite]()
    } else {
      console.error(`Unknown suite: ${suite}. Available: ${Object.keys(suites).join(', ')}`)
      return
    }
  } catch (err) {
    console.error('Test error:', err)
  }

  // Summary
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log('')
  if (failed === 0) {
    console.log(`%c✅ ALL ${total} TESTS PASSED`, 'color: #4ade80; font-weight: bold; font-size: 14px')
  } else {
    console.log(`%c❌ ${failed}/${total} TESTS FAILED`, 'color: #ef4444; font-weight: bold; font-size: 14px')
    console.log('Failed tests:')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.info}`)
    }
  }

  return { passed, failed, total, results }
}

// Export for use in main.js
export { runLegendTests }
