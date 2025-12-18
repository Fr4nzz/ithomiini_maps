/**
 * Shared constants for the Ithomiini Maps application
 */

// Aspect ratio presets for map export
export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
}

// Preset size options for export
export const PRESET_SIZES = [
  { name: 'HD (16:9)', width: 1920, height: 1080 },
  { name: '4K (16:9)', width: 3840, height: 2160 },
  { name: 'A4 Landscape', width: 3508, height: 2480 },
  { name: 'A4 Portrait', width: 2480, height: 3508 },
  { name: 'Square', width: 2000, height: 2000 },
  { name: 'Letter Landscape', width: 3300, height: 2550 },
]

// Status colors for sequencing status badges
export const STATUS_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

// Source colors for data source badges
export const SOURCE_COLORS = {
  'Sanger Institute': '#3b82f6',
  'Dore et al.': '#f59e0b',
  'iNaturalist': '#74ac00',
  'GBIF': '#6b7280',
}

// Default color palette for dynamic categories
export const DYNAMIC_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444',
  '#22d3ee', '#f97316', '#84cc16', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308', '#8b5cf6', '#06b6d4', '#f43f5e',
  '#0ea5e9', '#22c55e', '#d946ef', '#64748b', '#fb923c'
]

// Get status color with fallback
export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || '#6b7280'
}

// Get source color with fallback
export const getSourceColor = (source) => {
  return SOURCE_COLORS[source] || '#6b7280'
}
