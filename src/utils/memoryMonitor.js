const snapshots = []
let warnedUnavailable = false

const toFixed = value => Number(value.toFixed(2))
const toMb = bytes => bytes / (1024 * 1024)

function getMemoryApi() {
  const api = performance?.memory
  if (api && typeof api.usedJSHeapSize === 'number') return api
  if (!warnedUnavailable) {
    warnedUnavailable = true
    console.info('[Memory] Memory API not available (Chrome-only)')
  }
  return null
}

export const mem = {
  current() {
    const api = getMemoryApi()
    return api ? toFixed(toMb(api.usedJSHeapSize)) : null
  },

  snapshot(label = 'snapshot') {
    const heapMb = this.current()
    if (heapMb == null) return null
    const entry = { Label: label, Timestamp: new Date().toISOString(), HeapMB: heapMb }
    snapshots.push(entry)
    return entry
  },

  report() {
    if (!snapshots.length) {
      console.info('[Memory] No snapshots recorded yet')
      return []
    }
    const rows = snapshots.map((entry, index) => {
      const prev = snapshots[index - 1]
      return {
        '#': index + 1,
        Label: entry.Label,
        Timestamp: entry.Timestamp,
        HeapMB: entry.HeapMB,
        DeltaMB: toFixed(prev ? entry.HeapMB - prev.HeapMB : 0)
      }
    })
    console.table(rows)
    return rows
  },

  reset() {
    snapshots.length = 0
  }
}

if (typeof window !== 'undefined') {
  window.mem = mem
  window.memReport = () => mem.report()
}
