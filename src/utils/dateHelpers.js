// Parse date strings in various formats (DD-MMM-YY, YYYY-MM-DD, etc.)
export function parseDate(dateStr) {
  if (!dateStr) return null

  const ddMmmYy = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/
  const match = dateStr.match(ddMmmYy)
  if (match) {
    const [, day, monthStr, yearShort] = match
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      const year = parseInt(yearShort) + (parseInt(yearShort) > 50 ? 1900 : 2000)
      return new Date(year, month, parseInt(day))
    }
  }

  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

// Get date offset from today (negative for past)
export function getDateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Format coordinates for display
export function formatCoordinate(value, decimals = 4) {
  return value ? parseFloat(value).toFixed(decimals) : '—'
}

// Format a date for display
export function formatDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!date) return ''
  const d = typeof date === 'string' ? parseDate(date) : date
  if (!d) return ''
  return d.toLocaleDateString('en-US', options)
}

// Get ISO date string from a Date object
export function toISODateString(date) {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}
