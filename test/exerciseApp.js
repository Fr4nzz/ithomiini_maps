import { nextTick } from 'vue'
import { perf } from '../src/utils/perfMonitor'
import { mem } from '../src/utils/memoryMonitor'

const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms))
async function settle(ms = 120) {
  await nextTick()
  await wait(ms)
  await nextTick()
}

async function getStores() {
  const app = document.querySelector('#app')?.__vue_app__
  const pinia = app?.config?.globalProperties?.$pinia
  if (!pinia) throw new Error('Pinia instance not found')

  const { useDataStore } = await import('../src/stores/data')
  const { useLegendStore } = await import('../src/stores/legend')

  return {
    dataStore: useDataStore(pinia),
    legendStore: useLegendStore(pinia)
  }
}

function featureCount(dataStore) {
  return dataStore.filteredGeoJSON?.features?.length ?? 0
}

async function ensureDataLoaded(dataStore) {
  if (!dataStore.loading && dataStore.allFeatures.length > 0) return
  await dataStore.loadMapData()
  await settle(250)
}

async function waitForSourceClear(dataStore, source, timeoutMs = 20000) {
  const started = performance.now()
  while (dataStore.sourceLoading.has(source)) {
    if (performance.now() - started > timeoutMs) {
      throw new Error(`Timeout waiting for source: ${source}`)
    }
    await wait(100)
  }
}

function summarize(results, title = 'Exercise App Summary') {
  const rows = results.map(r => ({
    Operation: r.operation,
    Pass: r.pass,
    DurationMs: Number(r.durationMs.toFixed(2)),
    MemBeforeMB: r.memBeforeMB,
    MemAfterMB: r.memAfterMB,
    MemDeltaMB: r.memDeltaMB,
    Error: r.error || ''
  }))

  console.group(title)
  console.table(rows)
  const passed = results.filter(r => r.pass).length
  const failed = results.length - passed
  console.log(`Passed: ${passed}/${results.length} • Failed: ${failed}`)
  console.groupEnd()
  return { passed, failed, results: rows }
}

async function createRunner(prefix) {
  const { dataStore, legendStore } = await getStores()
  await ensureDataLoaded(dataStore)
  const results = []

  async function runStep(operation, action, settleMs = 180) {
    const label = `${prefix}:${operation}`
    const before = mem.current()
    mem.snapshot(`${label}:before`)
    perf.start(label)

    let pass = true
    let error = ''
    try {
      await action()
      await settle(settleMs)
    } catch (err) {
      pass = false
      error = err instanceof Error ? err.message : String(err)
    }

    const durationRaw = perf.end(label)
    const durationMs = durationRaw ?? 0
    const after = mem.current()
    mem.snapshot(`${label}:after`)
    const delta = before != null && after != null ? Number((after - before).toFixed(2)) : null
    const entry = {
      operation: label,
      pass,
      durationMs,
      memBeforeMB: before,
      memAfterMB: after,
      memDeltaMB: delta,
      error
    }
    results.push(entry)
    if (pass) {
      console.log(`✅ ${label} (${durationMs.toFixed(1)}ms, Δ${delta ?? 'n/a'}MB)`)
    } else {
      console.error(`❌ ${label}: ${error}`)
    }
    return entry
  }
  return { dataStore, legendStore, results, runStep }
}

async function runFilterChange(dataStore, pick, apply, message) {
  dataStore.resetAllFilters()
  await settle(200)
  const selected = pick()
  if (!selected) throw new Error(`No ${message} available`)
  const before = featureCount(dataStore)
  apply(selected)
  await settle(220)
  const after = featureCount(dataStore)
  const changed = after !== before || before === 0
  if (!changed) throw new Error(`filteredGeoJSON did not change for ${message} filter`)
}

async function testVisualizations() {
  const { dataStore, runStep, results } = await createRunner('visualizations')
  for (const mode of ['points', 'clusters', 'heatmap', 'ranges']) {
    await runStep(`mode:${mode}`, async () => { dataStore.visualizationMode = mode }, 260)
  }
  await runStep('scatter:on', async () => { dataStore.scatterOverlappingPoints = true })
  await runStep('scatter:off', async () => { dataStore.scatterOverlappingPoints = false })
  await runStep('mode:points:restore', async () => { dataStore.visualizationMode = 'points' })
  summarize(results, 'Visualization Test Summary')
  return results
}

async function testFilters() {
  const { dataStore, runStep, results } = await createRunner('filters')
  await runStep('species', async () => {
    await runFilterChange(
      dataStore,
      () => dataStore.uniqueSpecies[0],
      selected => { dataStore.filters.species = [selected] },
      'species'
    )
  })
  await runStep('status', async () => {
    await runFilterChange(
      dataStore,
      () => dataStore.uniqueStatuses[0],
      selected => { dataStore.filters.status = [selected] },
      'status'
    )
  })
  await runStep('country', async () => {
    await runFilterChange(
      dataStore,
      () => dataStore.uniqueCountries[0],
      selected => { dataStore.filters.country = selected },
      'country'
    )
  })
  await runStep('sex:male', async () => {
    dataStore.resetAllFilters()
    await settle(200)
    dataStore.filters.sex = 'male'
    await settle(220)
    if (dataStore.filters.sex !== 'male') throw new Error('sex filter not applied')
  })
  await runStep('dateStart:2020-01-01', async () => {
    dataStore.resetAllFilters()
    await settle(200)
    dataStore.filters.dateStart = '2020-01-01'
    await settle(220)
    if (dataStore.filters.dateStart !== '2020-01-01') throw new Error('dateStart not applied')
  })
  await runStep('resetAllFilters', async () => { dataStore.resetAllFilters() })
  summarize(results, 'Filter Test Summary')
  return results
}

async function testDataSources() {
  const { dataStore, runStep, results } = await createRunner('sources')
  const sourceNames = [...dataStore.uniqueSources]
  for (const source of sourceNames) {
    if (dataStore.loadedSources.has(source)) continue
    await runStep(`load:${source}`, async () => {
      if (!dataStore.filters.source.includes(source)) {
        dataStore.filters.source = [...dataStore.filters.source, source]
      }
      await waitForSourceClear(dataStore, source)
      mem.snapshot(`source-loaded:${source}`)
    }, 260)
  }
  summarize(results, 'Data Source Test Summary')
  return results
}

async function testLegend() {
  const { dataStore, legendStore, runStep, results } = await createRunner('legend')
  for (const mode of ['subspecies', 'species', 'genus', 'status', 'mimicry', 'source']) {
    await runStep(`colorBy:${mode}`, async () => { dataStore.colorBy = mode }, 240)
  }
  await runStep('grouping:toggle', async () => {
    legendStore.groupingSettings = {
      ...legendStore.groupingSettings,
      enabled: !legendStore.groupingSettings.enabled
    }
  })
  await runStep('showCounts:toggle', async () => { legendStore.showCounts = !legendStore.showCounts })
  await runStep('wrapLabels:toggle', async () => { legendStore.wrapLabels = !legendStore.wrapLabels })
  summarize(results, 'Legend Test Summary')
  return results
}

async function testColorBy() {
  const { dataStore, runStep, results } = await createRunner('colorBy')
  const modes = ['subspecies', 'species', 'genus', 'status', 'mimicry', 'source']
  for (const mode of modes) {
    await runStep(`cycle:${mode}`, async () => { dataStore.colorBy = mode }, 180)
  }
  summarize(results, 'ColorBy Cycle Summary')
  return results
}

async function runAll() {
  console.log('🧪 Running full feature exerciser')
  mem.reset()
  perf.reset()
  const allResults = [
    ...(await testVisualizations()),
    ...(await testFilters()),
    ...(await testDataSources()),
    ...(await testLegend()),
    ...(await testColorBy())
  ]
  const summary = summarize(allResults, 'Full Exercise Summary')
  perf.report()
  mem.report()
  return summary
}

export const exerciseApp = {
  runAll, testVisualizations, testFilters, testDataSources, testLegend, testColorBy, perf, mem
}
if (typeof window !== 'undefined') window.exerciseApp = exerciseApp
