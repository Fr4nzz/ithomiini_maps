const CATEGORIES = ['data', 'map', 'legend', 'filter', 'perf', 'export', 'goat', 'photo']

const perfStarts = new Map()
const perfStats = new Map()

const getLogConfig = () => (typeof window !== 'undefined' ? window.__LOG : undefined)

const isEnabled = (category) => {
  const config = getLogConfig()
  if (config === '*') return true
  return !!(config && typeof config === 'object' && config[category])
}

const emit = (level, category, args) => {
  if (!isEnabled(category)) return
  console[level](`[${category}]`, ...args)
}

const updatePerfStats = (label, duration) => {
  const prev = perfStats.get(label)
  if (!prev) {
    perfStats.set(label, { count: 1, min: duration, max: duration, total: duration })
    return
  }
  prev.count += 1
  prev.min = Math.min(prev.min, duration)
  prev.max = Math.max(prev.max, duration)
  prev.total += duration
}

const perfStart = (label) => {
  const stack = perfStarts.get(label) || []
  stack.push(performance.now())
  perfStarts.set(label, stack)
}

const perfEnd = (label, ...args) => {
  const stack = perfStarts.get(label)
  if (!stack || stack.length === 0) return null

  const started = stack.pop()
  if (stack.length === 0) perfStarts.delete(label)
  const duration = performance.now() - started
  updatePerfStats(label, duration)

  if (isEnabled('perf')) {
    const base = `${label}: ${duration.toFixed(1)}ms`
    console.info('[perf]', base, ...args)
  }

  return duration
}

const logSummary = () => {
  if (perfStats.size === 0) {
    console.info('[perf] No timing data collected')
    return
  }

  const rows = [...perfStats.entries()]
    .map(([label, s]) => ({
      label,
      count: s.count,
      min: Number(s.min.toFixed(1)),
      max: Number(s.max.toFixed(1)),
      avg: Number((s.total / s.count).toFixed(1)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  console.table(rows)
}

const makeCategory = (category) => ({
  error: (...args) => emit('error', category, args),
  warn: (...args) => emit('warn', category, args),
  info: (...args) => emit('info', category, args),
  debug: (...args) => emit('debug', category, args),
})

export const log = CATEGORIES.reduce((acc, category) => {
  acc[category] = makeCategory(category)
  return acc
}, {})

log.perf.start = perfStart
log.perf.end = perfEnd

if (typeof window !== 'undefined') {
  window.logSummary = logSummary
}
