export const COLOR_PICKER_PALETTE = [
  // Colorblind-safe row (Okabe-Ito + Paul Tol)
  '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9',
  '#D55E00', '#F0E442', '#332288', '#882255', '#44AA99',
  '#DDCC77', '#117733', '#AA4499', '#88CCEE', '#DC3220',
  '#6699CC', '#999933',
  // Extended colors
  '#CC6677', '#855C75', '#661100', '#004949', '#924900',
  '#B66DFF', '#6DB6FF', '#490092', '#FF6DB6', '#FFB677',
  '#DBD100', '#24FF24', '#B6DBFF', '#009292', '#920000',
  '#FDB368', '#006DDB',
  // Neutral row
  '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4',
  '#e5e5e5', '#f5f5f5', '#ffffff', '#262626', '#000000'
]

// Colorblind-safe border colors for distinguishing species
const SPECIES_BORDER_PALETTE = [
  '#ffffff', '#0072B2', '#D55E00', '#009E73', '#E69F00',
  '#CC79A7', '#56B4E9', '#332288', '#882255', '#000000',
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
