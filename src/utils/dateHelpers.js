/**
 * Date parsing and formatting utilities
 */

/**
 * Parse date strings in various formats (DD-MMM-YY, YYYY-MM-DD, etc.)
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateStr) {
  if (!dateStr) return null

  // Handle DD-MMM-YY format (e.g., "18-Jan-22")
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

  // Fallback to standard Date parsing
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Get date offset from today
 * @param {number} days - Number of days to offset (negative for past)
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function getDateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Format coordinates for display
 * @param {number} value - Coordinate value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted coordinate string
 */
export function formatCoordinate(value, decimals = 4) {
  return value ? parseFloat(value).toFixed(decimals) : '—'
}

/**
 * Format a date for display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!date) return ''
  const d = typeof date === 'string' ? parseDate(date) : date
  if (!d) return ''
  return d.toLocaleDateString('en-US', options)
}

/**
 * Get ISO date string from a Date object
 * @param {Date} date - Date object
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date) {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}
