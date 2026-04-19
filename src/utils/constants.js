// Aspect ratio presets for map export
export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
}

// Colorblind-safe status colors (Okabe-Ito derived)
export const STATUS_COLORS = {
  'Sequenced': '#0072B2',
  'Tissue Available': '#009E73',
  'Preserved Specimen': '#E69F00',
  'Published': '#CC79A7',
  'GBIF Record': '#999999',
  'Observation': '#56B4E9',
  'Museum Specimen': '#D55E00',
  'Living Specimen': '#F0E442',
}

// Colorblind-safe source colors
export const SOURCE_COLORS = {
  'Sanger Institute': '#0072B2',
  'Dore et al.': '#E69F00',
  'Dore et al. (2022)': '#E69F00',
  'iNaturalist': '#009E73',
  'GBIF': '#999999',
  'GBIF (UNAM)': '#CC79A7',
  'GBIF (Other Institutions)': '#999999',
}

// Colorblind-safe palette for dynamic categories (Okabe-Ito base + Paul Tol extended)
export const DYNAMIC_COLORS = [
  '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9',
  '#D55E00', '#F0E442', '#332288', '#882255', '#44AA99',
  '#DDCC77', '#117733', '#AA4499', '#88CCEE', '#661100',
  '#6699CC', '#999933', '#CC6677', '#855C75', '#DC3220'
]

// Get status color with fallback
export const getStatusColor = (status) => STATUS_COLORS[status] || '#6b7280'
