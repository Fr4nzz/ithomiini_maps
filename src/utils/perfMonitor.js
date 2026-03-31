const activeTimers = new Map()
const stats = new Map()

function ensureLabel(label) {
  if (!stats.has(label)) {
    stats.set(label, { count: 0, total: 0, min: Infinity, max: 0 })
  }
  return stats.get(label)
}

function toMs(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null
}

export const perf = {
  start(label) {
    if (!label) return
    activeTimers.set(label, performance.now())
  },

  end(label) {
    const startedAt = activeTimers.get(label)
    if (startedAt == null) return null

    const durationMs = performance.now() - startedAt
    activeTimers.delete(label)
    this.mark(label, durationMs)
    return durationMs
  },

  mark(label, durationMs) {
    if (!label || !Number.isFinite(durationMs)) return null

    const entry = ensureLabel(label)
    entry.count += 1
    entry.total += durationMs
    entry.min = Math.min(entry.min, durationMs)
    entry.max = Math.max(entry.max, durationMs)

    return durationMs
  },

  report() {
    const rows = [...stats.entries()].map(([label, entry]) => {
      const avg = entry.count > 0 ? entry.total / entry.count : 0
      return {
        Label: label,
        Count: entry.count,
        Min: toMs(entry.min),
        Max: toMs(entry.max),
        Avg: toMs(avg),
        Total: toMs(entry.total)
      }
    })

    if (rows.length === 0) {
      console.info('[Perf] No measurements recorded yet')
      return []
    }

    console.table(rows)
    return rows
  },

  reset() {
    activeTimers.clear()
    stats.clear()
  }
}

if (typeof window !== 'undefined') {
  window.perf = perf
  window.perfReport = () => perf.report()
}
