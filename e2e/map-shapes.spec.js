import { test, expect } from '@playwright/test'

test('rebuilds the point source when circle and symbol layers switch', async ({ page }) => {
  // A local style keeps this regression independent of external basemap tiles.
  await page.route('https://basemaps.cartocdn.com/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ version: 8, sources: {}, layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e0e8ed' } },
    ] }),
  }))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const map = app?._instance.setupState.mapRef
    const data = app?.config.globalProperties.$pinia._s.get('data')
    return map?.style && map.getSource('points-source') && data?.allFeatures.length > 0
  })
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    window.shapeMap = app._instance.setupState.mapRef
    window.shapeStores = Object.fromEntries(app.config.globalProperties.$pinia._s)
    window.circleSource = shapeMap.getSource('points-source')
    shapeStores.data.filters.species = ['Mechanitis polymnia', 'Ithomia salapia']
    shapeStores.data.colorBy = 'species'
    shapeStores.legend.shapeSettings.enabled = true
    shapeStores.legend.setGroupShape('Mechanitis polymnia', 'triangle')
    shapeStores.legend.setCustomColor('Mechanitis polymnia', '#cc00ff')
  })
  await page.waitForFunction(() => window.shapeMap.getLayer('points-layer')?.type === 'symbol' && window.shapeMap.loaded())
  expect(await page.evaluate(() => shapeMap.getSource('points-source') !== circleSource)).toBe(true)

  await page.evaluate(() => {
    window.symbolSource = shapeMap.getSource('points-source')
    shapeStores.legend.shapeSettings.enabled = false
    shapeStores.legend.setGroupShape('Mechanitis polymnia', 'circle')
    shapeStores.legend.setCustomColor('Mechanitis polymnia', null)
    shapeStores.data.exportSettings.uiScale = 1.5
    shapeStores.data.exportSettings.enabled = true
  })
  await page.waitForFunction(() => window.shapeMap.getLayer('points-layer')?.type === 'circle' && window.shapeMap.loaded())
  expect(await page.evaluate(() => shapeMap.getSource('points-source') !== symbolSource)).toBe(true)
  expect(errors).toEqual([])
})
