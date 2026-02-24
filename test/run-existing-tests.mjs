import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
const page = await browser.newContext({ viewport: { width: 1280, height: 720 } }).then(c => c.newPage())

const logs = []
page.on('console', msg => logs.push(msg.text()))

await page.goto('http://localhost:5173/ithomiini_maps/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

const result = await page.evaluate(async () => {
  if (typeof window.runLegendTests !== 'function') return { error: 'runLegendTests not found' }
  return await window.runLegendTests()
})

// Print test output
for (const log of logs) {
  if (log.includes('✅') || log.includes('❌') || log.includes('PASSED') || log.includes('FAILED')) {
    console.log(log)
  }
}

if (result?.error) {
  console.log('Error:', result.error)
}
console.log(`\nResult: ${result?.passed}/${result?.total} passed, ${result?.failed} failed`)

await browser.close()
process.exit(result?.failed > 0 ? 1 : 0)
