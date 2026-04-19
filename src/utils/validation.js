const MISSING = new Set(['unknown', 'na', 'nan', 'null', 'none'])

export function isValidValue(val) {
  if (!val || typeof val !== 'string') return false
  const cleaned = val.trim().toLowerCase()
  return cleaned.length > 0 && !MISSING.has(cleaned)
}
