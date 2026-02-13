export const COLOR_PICKER_PALETTE = [
  // Primary row - bright colors
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
  // Secondary row - muted/pastel
  '#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#bef264',
  '#86efac', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc',
  '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc',
  '#f9a8d4', '#fda4af',
  // Neutral row
  '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4',
  '#e5e5e5', '#f5f5f5', '#ffffff', '#262626', '#000000'
]

// High-contrast border colors for distinguishing species
const SPECIES_BORDER_PALETTE = [
  '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#000000',
]

export function generateSpeciesBorderColors(speciesList, existing = {}) {
  const result = { ...existing }
  let colorIndex = 0

  for (const species of speciesList) {
    if (!result[species]) {
      result[species] = SPECIES_BORDER_PALETTE[colorIndex % SPECIES_BORDER_PALETTE.length]
      colorIndex++
    }
  }

  return result
}
