<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import { generateSpeciesBorderColors, generateSpeciesBaseHues } from '../../utils/colors'
import { applyAbbreviationFormat } from '../../utils/abbreviations'
import { ArrowUpAZ, ArrowDownZA, ChartBarDecreasing, ChartBarIncreasing, ChevronDown, Hash } from 'lucide-vue-next'
import LegendItem from './LegendItem.vue'
import LegendToolbar from './LegendToolbar.vue'
// LegendResizeHandle replaced by inline multi-directional resize zones
import LegendGroupHeader from './LegendGroupHeader.vue'
import LegendGroupStylePopup from './LegendGroupStylePopup.vue'

const props = defineProps({
  containerRef: {
    type: Object,
    default: null
  }
})

const legendStore = useLegendStore()
const dataStore = useDataStore()

// Refs
const legendRef = ref(null)
const contentRef = ref(null) // Reference to legend-content for height locking
const isHovered = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const hasOpenPopup = ref(false) // Track if any popup (color picker, settings) is open
const contentMaxHeight = ref(null) // Max height for content during hover to prevent growing
const adjustingUp = ref(false) // Track increase phase in adjustItemsToFit

// Multi-directional resize state
const resizeDirection = ref(null) // 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
const resizeStartMousePos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0 })
const resizeStartLegendPos = ref({ x: 0, y: 0 })
const resizeOverride = ref(null) // { x, y, width, height } during active resize

// Legend resize observer (for bottom-sticky repositioning)
let legendResizeObserver = null
let lastLegendHeight = 0

// Popup state
const stylePopupState = ref({
  open: false,
  groupName: '',
  position: { x: 0, y: 0 }
})

// Current size - 'auto' means auto-fit to content
const isAutoWidth = computed(() => legendStore.size.width === 'auto')
const isAutoHeight = computed(() => legendStore.size.height === 'auto')
const currentWidth = ref(isAutoWidth.value ? null : legendStore.size.width)
const currentHeight = ref(isAutoHeight.value ? null : legendStore.size.height)

// Position state
const posX = ref(legendStore.position.x || 40)
const posY = ref(legendStore.position.y)

// Drag state
const dragStart = ref({ x: 0, y: 0 })
const dragStartPos = ref({ x: 0, y: 0 })

// Sticky edge state (which edges legend is stuck to)
const stickyEdge = ref({
  left: true,  // Default to left-bottom sticky
  right: false,
  top: false,
  bottom: true  // Default to left-bottom sticky
})

// Previous container bounds (for detecting changes)
const prevContainerBounds = ref({ width: 0, height: 0 })

// Attribution state - dynamically calculated based on actual attribution element
const attributionHeight = ref(24)  // Default fallback
const isAttributionOpen = ref(true)  // Track if attribution is expanded

// Is export mode active?
const isExportMode = computed(() => dataStore.exportSettings.enabled)

// Get the actual bottom margin needed based on attribution state
// If attribution is open/visible, we need space above it (even in export mode, since it will be in the export)
// If attribution is collapsed, no extra space needed (it won't be in export either)
const bottomAttributionMargin = computed(() => {
  if (!isAttributionOpen.value) return 0  // Attribution collapsed, no extra space needed
  return attributionHeight.value
})

// Should show toolbar? (hidden by default, shown on hover OR when popup is open)
const showToolbar = computed(() => isHovered.value || hasOpenPopup.value)

// Should show edit UI? (editable on hover OR when popup is open)
const showEditUI = computed(() => isHovered.value || hasOpenPopup.value)

// Track if any popup is open (keeps legend interactive)
const hasModalOpen = computed(() => stylePopupState.value.open)

// Get container dimensions
const containerBounds = computed(() => {
  if (props.containerRef) {
    return {
      width: props.containerRef.clientWidth || 800,
      height: props.containerRef.clientHeight || 600
    }
  }
  return { width: 800, height: 600 }
})

// Color map from data store
const colorMap = computed(() => dataStore.activeColorMap)

// Build species-subspecies mapping from displayed data
const speciesSubspeciesMap = computed(() => {
  const geo = dataStore.displayGeoJSON
  if (!geo?.features) return {}

  const map = {}
  for (const feature of geo.features) {
    const species = feature.properties.scientific_name
    const subspecies = feature.properties.subspecies

    if (!species || !subspecies) continue
    if (subspecies === 'Unknown' || subspecies === 'NA') continue

    if (!map[species]) {
      map[species] = new Set()
    }
    map[species].add(subspecies)
  }

  // Convert sets to sorted arrays
  const result = {}
  for (const [species, subspeciesSet] of Object.entries(map)) {
    result[species] = [...subspeciesSet].sort()
  }

  return result
})

// Get list of species (sorted)
const speciesList = computed(() => Object.keys(speciesSubspeciesMap.value).sort())

// Generate border colors for species
const speciesBorderColors = computed(() => {
  if (!legendStore.speciesStyling.borderColor) return {}
  return generateSpeciesBorderColors(speciesList.value, legendStore.speciesBorderColors)
})

// Generate base hues for species gradients
const speciesBaseHues = computed(() => {
  return generateSpeciesBaseHues(speciesList.value, legendStore.speciesBaseHues)
})

// Get border color for a species
function getSpeciesBorderColor(species) {
  return speciesBorderColors.value[species] || dataStore.mapStyle.borderColor
}

// Check if species has customized style (shape or border color)
function hasCustomizedStyle(species) {
  // Check if user set a custom shape (not default 'circle')
  const shape = legendStore.getGroupShape(species)
  const hasCustomShape = shape && shape !== 'circle'

  // Check if user set a custom border color
  const hasCustomBorder = !!legendStore.speciesBorderColors[species]

  return hasCustomShape || hasCustomBorder
}

// Check if ANY group has customized style (for showing all indicators when one is customized)
const anyGroupHasCustomStyle = computed(() => {
  return speciesList.value.some(species => hasCustomizedStyle(species))
})

// Get species for a subspecies
function getSpeciesForSubspecies(subspecies) {
  for (const [species, subspeciesList] of Object.entries(speciesSubspeciesMap.value)) {
    if (subspeciesList.includes(subspecies)) {
      return species
    }
  }
  return null
}

// Format label based on per-species abbreviation visibility
function formatLabel(subspecies, species) {
  // Check if abbreviation should be shown for this species
  if (!species || !legendStore.isAbbreviationVisible(species)) {
    return subspecies
  }

  // Get the abbreviation for this species (custom or default)
  const abbreviation = legendStore.getSpeciesAbbreviation(species)
  // Show abbreviation as prefix before subspecies name (e.g., "M. p. casabranca")
  return `${abbreviation} ${subspecies}`
}

// All visible items from color map, sorted by current sort criteria
// This sorts ALL items BEFORE slicing to effectiveMaxItems, so the top-N
// by the chosen sort are shown (e.g., most abundant subspecies).
const sortedAllItems = computed(() => {
  const sortByVal = legendStore.sortBy
  const sortOrderVal = legendStore.sortOrder
  const counts = subspeciesCounts.value
  const entries = Object.entries(colorMap.value)

  // Build full list of visible items
  const items = []
  for (const [label, color] of entries) {
    if (!legendStore.isItemVisible(label)) continue
    items.push({
      label,
      color,
      defaultColor: color,
      customLabel: legendStore.customLabels[label] || '',
      customColor: legendStore.customColors[label] || '',
      visible: true
    })
  }

  // Sort ALL items before slicing
  if (sortByVal === 'abundance') {
    items.sort((a, b) => {
      const countA = counts[a.label] || 0
      const countB = counts[b.label] || 0
      return sortOrderVal === 'asc' ? countA - countB : countB - countA
    })
  } else {
    items.sort((a, b) => {
      const textA = a.label.toLowerCase()
      const textB = b.label.toLowerCase()
      return sortOrderVal === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
    })
  }

  return items
})

// Get items sliced to fit, with hidden items appended for edit mode
const legendItems = computed(() => {
  const maxItems = effectiveMaxItems.value
  const items = sortedAllItems.value.slice(0, maxItems)

  // Add hidden items at the end (for edit mode)
  if (!isExportMode.value) {
    for (const label of legendStore.hiddenItems) {
      if (colorMap.value[label]) {
        items.push({
          label,
          color: colorMap.value[label],
          defaultColor: colorMap.value[label],
          customLabel: legendStore.customLabels[label] || '',
          customColor: legendStore.customColors[label] || '',
          visible: false
        })
      }
    }
  }

  return items
})

// Sort helper functions
function sortItemsByText(items, order) {
  return items.slice().sort((a, b) => {
    const textA = (a.displayLabel || a.label).toLowerCase()
    const textB = (b.displayLabel || b.label).toLowerCase()
    return order === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
  })
}

function sortItemsByAbundance(items, order, counts) {
  return items.slice().sort((a, b) => {
    const countA = counts[a.label] || 0
    const countB = counts[b.label] || 0
    return order === 'asc' ? countA - countB : countB - countA
  })
}

// Grouped legend data structure
const groupedLegendData = computed(() => {
  const sortByVal = legendStore.sortBy
  const sortOrderVal = legendStore.sortOrder
  const counts = subspeciesCounts.value

  // If not grouped mode or not in subspecies colorBy, return flat
  // Items are already sorted in sortedAllItems and sliced in legendItems
  if (!legendStore.isGrouped) {
    return { type: 'flat', items: legendItems.value.slice() }
  }

  // Group items by species
  const groups = []
  const itemsBySpecies = {}

  // First, categorize items by species
  for (const item of legendItems.value) {
    const species = getSpeciesForSubspecies(item.label)
    if (species) {
      if (!itemsBySpecies[species]) {
        itemsBySpecies[species] = []
      }
      itemsBySpecies[species].push(item)
    }
  }

  // Build groups
  for (const species of Object.keys(itemsBySpecies)) {
    const items = itemsBySpecies[species]

    // Get custom display name - either per-species or apply global format
    let customLabel = legendStore.getSpeciesDisplayName(species)
    if (!customLabel && legendStore.displayNameFormat !== 'firstLetterGenus') {
      // If global format is not default, apply it
      customLabel = applyAbbreviationFormat(species, legendStore.displayNameFormat)
    }

    // Map items with display labels
    let mappedItems = items.map(item => ({
      ...item,
      displayLabel: formatLabel(item.label, species)
    }))

    // Sort items within group
    if (sortByVal === 'abundance') {
      mappedItems = sortItemsByAbundance(mappedItems, sortOrderVal, counts)
    } else {
      mappedItems = sortItemsByText(mappedItems, sortOrderVal)
    }

    groups.push({
      species,
      borderColor: getSpeciesBorderColor(species),
      baseHue: speciesBaseHues.value[species] || 210,
      shape: legendStore.getGroupShape(species),
      abbreviation: legendStore.getSpeciesAbbreviation(species),
      abbreviationVisible: legendStore.isAbbreviationVisible(species),
      customLabel: customLabel || '',
      hasCustomizedStyle: hasCustomizedStyle(species),
      items: mappedItems
    })
  }

  // Sort groups
  if (sortByVal === 'abundance') {
    groups.sort((a, b) => {
      const totalA = a.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
      const totalB = b.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
      return sortOrderVal === 'asc' ? totalA - totalB : totalB - totalA
    })
  } else {
    groups.sort((a, b) => {
      const textA = a.species.toLowerCase()
      const textB = b.species.toLowerCase()
      return sortOrderVal === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
    })
  }

  return { type: 'grouped', groups }
})

// Count of hidden items
const hiddenCount = computed(() => {
  const total = Object.keys(colorMap.value).length
  const visible = legendItems.value.filter(i => i.visible).length
  return total - visible
})

// More items indicator (based on visible items that didn't fit)
const moreCount = computed(() => {
  const totalVisible = sortedAllItems.value.length
  const maxItems = effectiveMaxItems.value
  return Math.max(0, totalVisible - maxItems)
})

// ═══════════════════════════════════════════════════════════════════════════
// SUBSPECIES COUNTS (for abundance sorting)
// ═══════════════════════════════════════════════════════════════════════════

const subspeciesCounts = computed(() => {
  const geo = dataStore.displayGeoJSON
  if (!geo?.features) return {}
  const counts = {}
  for (const feature of geo.features) {
    const ssp = feature.properties.subspecies
    if (ssp && ssp !== 'Unknown' && ssp !== 'NA') {
      counts[ssp] = (counts[ssp] || 0) + 1
    }
  }
  return counts
})

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-SIZING
// ═══════════════════════════════════════════════════════════════════════════

// Measure text width using canvas
let _measureCanvas = null
function measureTextWidth(text, fontSizePx) {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas')
  }
  const ctx = _measureCanvas.getContext('2d')
  ctx.font = `italic ${fontSizePx}px system-ui, -apple-system, sans-serif`
  return ctx.measureText(text).width
}

// Collect all displayed label texts for width calculation
const allDisplayedLabels = computed(() => {
  const labels = []
  const data = groupedLegendData.value
  if (data.type === 'flat') {
    for (const item of data.items) {
      labels.push(item.label)
    }
  } else if (data.groups) {
    for (const group of data.groups) {
      // Include species group header text
      if (legendStore.groupingSettings.showHeaders) {
        labels.push(group.species)
      }
      for (const item of group.items) {
        labels.push(item.displayLabel || item.label)
      }
    }
  }
  return labels
})

// Calculate auto width from content
const autoWidth = computed(() => {
  const labels = allDisplayedLabels.value
  if (!labels.length) return 200

  const maxContainerWidth = containerBounds.value.width * 0.3
  const fontSizePx = Math.round(14 * legendStore.textScale)

  let maxTextWidth = 0
  for (const label of labels) {
    const width = measureTextWidth(label, fontSizePx)
    if (width > maxTextWidth) maxTextWidth = width
  }

  // Add dot size + gap + padding + extra margin
  const dotSz = Math.round(10 * legendStore.dotScale)
  const padding = 16 * 2 // left + right content padding
  const gap = 8
  const scrollbarWidth = 8
  const extraMargin = 12

  const idealWidth = maxTextWidth + dotSz + gap + padding + scrollbarWidth + extraMargin

  return Math.min(Math.max(Math.ceil(idealWidth), 150), maxContainerWidth, 600)
})

// Max legend height based on container (75% of map height)
const maxLegendHeight = computed(() => {
  return Math.floor(containerBounds.value.height * 0.75)
})

// Dynamic item limit — adjusted after render to eliminate scrollbar.
// Starts with a generous estimate, then post-render adjustment trims if needed.
const itemLimitOverride = ref(null)

const effectiveMaxItems = computed(() => {
  if (itemLimitOverride.value !== null) {
    return itemLimitOverride.value
  }
  // Initial estimate: use conservative per-item height
  const fontSizePx = Math.round(14 * legendStore.textScale)
  // Generous estimate for wrapped text (allows 2-line items)
  const itemHeight = legendStore.wrapLabels ? fontSizePx * 2 + 10 : fontSizePx + 10
  const titleHeight = 32
  const padding = 24

  const available = maxLegendHeight.value - titleHeight - padding
  const groupOverhead = legendStore.isGrouped ? 1.2 : 1.0
  const effectiveItemHeight = itemHeight * groupOverhead

  const est = Math.max(1, Math.floor(available / effectiveItemHeight))
  console.debug(`[Legend] effectiveMaxItems estimate: ${est} (maxH=${maxLegendHeight.value}, avail=${available}, itemH=${effectiveItemHeight.toFixed(1)})`)
  return est
})

// Calculate auto height from content (using effectiveMaxItems)
const autoHeight = computed(() => {
  const data = groupedLegendData.value
  const fontSizePx = Math.round(14 * legendStore.textScale)
  const itemHeight = legendStore.wrapLabels ? fontSizePx + 12 : fontSizePx + 8
  const titleHeight = 32 // title + border
  const moreHeight = moreCount.value > 0 ? 30 : 0
  const padding = 24 // top + bottom content padding

  let totalItems = 0
  let groupHeaders = 0

  if (data.type === 'flat') {
    totalItems = data.items.length
  } else if (data.groups) {
    for (const group of data.groups) {
      if (legendStore.groupingSettings.showHeaders) {
        groupHeaders++
      }
      totalItems += group.items.length
    }
  }

  const groupHeaderHeight = fontSizePx + 10
  const idealHeight = titleHeight + (totalItems * itemHeight) + (groupHeaders * groupHeaderHeight) + moreHeight + padding

  // Cap at 75% of container height
  return Math.min(Math.max(Math.ceil(idealHeight), 80), maxLegendHeight.value)
})

// Effective width (auto or manual)
const effectiveWidth = computed(() => {
  if (isAutoWidth.value) return autoWidth.value
  return currentWidth.value || 200
})

// Effective height (auto or manual)
const effectiveHeight = computed(() => {
  if (isAutoHeight.value) return autoHeight.value
  return currentHeight.value
})

// Max resize width (50% of container for manual, more generous than auto's 30%)
const maxResizeWidth = computed(() => {
  return Math.min(Math.round(containerBounds.value.width * 0.5), 600)
})

// Scaled sizes
const dotSize = computed(() => Math.round(10 * legendStore.dotScale))
const fontSize = computed(() => Math.round(14 * legendStore.textScale))

// Position style
const positionStyle = computed(() => {
  // During active resize, use override for immediate visual feedback
  if (resizeOverride.value) {
    return {
      width: resizeOverride.value.width + 'px',
      height: resizeOverride.value.height + 'px',
      maxHeight: maxLegendHeight.value + 'px',
      left: resizeOverride.value.x + 'px',
      top: resizeOverride.value.y + 'px'
    }
  }

  const style = {
    width: effectiveWidth.value + 'px',
    maxHeight: maxLegendHeight.value + 'px'
  }

  // Y position
  if (posY.value !== null) {
    style.top = posY.value + 'px'
  } else {
    // Default to bottom
    style.bottom = '30px'
  }

  // X position
  style.left = posX.value + 'px'

  // Height - only set explicit height in manual mode (user has resized).
  // In auto mode, let the container size to its content, capped by maxHeight.
  // This allows adjustItemsToFit() to correctly detect overflow by comparing
  // scrollHeight vs maxLegendHeight.
  if (!isAutoHeight.value) {
    const h = effectiveHeight.value
    if (h && h !== 'auto') {
      style.height = h + 'px'
    }
  }

  return style
})

// ═══════════════════════════════════════════════════════════════════════════
// HOVER HANDLING (Lock content height to prevent growing when headers appear)
// ═══════════════════════════════════════════════════════════════════════════

function handleMouseEnter() {
  // Capture the current content height before hover effects cause growth
  // This prevents the legend from expanding when group headers appear on hover
  if (contentRef.value && !contentMaxHeight.value) {
    contentMaxHeight.value = contentRef.value.offsetHeight
  }
  isHovered.value = true
}

function handleMouseLeave() {
  isHovered.value = false
  // Release the height constraint when mouse leaves
  contentMaxHeight.value = null
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAG HANDLING
// ═══════════════════════════════════════════════════════════════════════════

function startDrag(e) {
  // Allow drag from anywhere in the legend except interactive elements
  // Don't start drag if clicking on interactive elements
  if (e.target.closest('button') ||
      e.target.closest('select') ||
      e.target.closest('input') ||
      e.target.closest('.color-by-select') ||
      e.target.closest('.legend-item') ||
      e.target.closest('.legend-group-header') ||
      e.target.closest('.color-picker-portal') ||
      e.target.closest('.abbreviation-dropdown')) return

  e.preventDefault()
  isDragging.value = true

  dragStart.value = {
    x: e.clientX || e.touches?.[0]?.clientX || 0,
    y: e.clientY || e.touches?.[0]?.clientY || 0
  }

  // Get current position
  const rect = legendRef.value.getBoundingClientRect()
  const containerRect = props.containerRef?.getBoundingClientRect() || { left: 0, top: 0 }

  dragStartPos.value = {
    x: rect.left - containerRect.left,
    y: rect.top - containerRect.top
  }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', endDrag)
}

function onDrag(e) {
  if (!isDragging.value) return

  e.preventDefault()

  const clientX = e.clientX || e.touches?.[0]?.clientX || 0
  const clientY = e.clientY || e.touches?.[0]?.clientY || 0

  const deltaX = clientX - dragStart.value.x
  const deltaY = clientY - dragStart.value.y

  let newX = dragStartPos.value.x + deltaX
  let newY = dragStartPos.value.y + deltaY

  // Reset sticky edges
  stickyEdge.value = { left: false, right: false, top: false, bottom: false }

  // Apply sticky edges if enabled (soft snapping, not constraint)
  if (legendStore.stickyEdges) {
    const threshold = legendStore.snapThreshold
    // Use prevContainerBounds (updated by ResizeObserver) instead of containerBounds
    // containerBounds computed doesn't track DOM size changes reactively
    const bounds = prevContainerBounds.value.width > 0 ? prevContainerBounds.value : containerBounds.value
    const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
    const legendHeight = legendRef.value?.offsetHeight || 200
    const margin = 10

    // Snap to left edge
    if (newX >= 0 && newX < threshold) {
      newX = margin
      stickyEdge.value.left = true
    }
    // Snap to right edge
    if (newX > bounds.width - legendWidth - threshold && newX <= bounds.width - legendWidth) {
      newX = bounds.width - legendWidth - margin
      stickyEdge.value.right = true
    }
    // Snap to top edge
    if (newY >= 0 && newY < threshold) {
      newY = margin
      stickyEdge.value.top = true
    }
    // Snap to bottom edge (above attribution)
    const bottomSnapY = bounds.height - legendHeight - margin - bottomAttributionMargin.value
    if (newY > bottomSnapY - threshold && newY <= bounds.height - legendHeight) {
      newY = bottomSnapY
      stickyEdge.value.bottom = true
    }
  }

  // No constraint - allow legend to be positioned outside visible area
  posX.value = newX
  posY.value = newY
}

function endDrag() {
  if (isDragging.value) {
    isDragging.value = false
    legendStore.updatePosition(posX.value, posY.value)
  }

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', endDrag)
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-DIRECTIONAL RESIZE HANDLING
// ═══════════════════════════════════════════════════════════════════════════

function startResize(e, direction) {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartMousePos.value = { x: e.clientX, y: e.clientY }

  const el = legendRef.value
  if (el) {
    resizeStartSize.value = { width: el.offsetWidth, height: el.offsetHeight }
  }
  resizeStartLegendPos.value = { x: posX.value, y: posY.value ?? 0 }

  // Clear contentMaxHeight so content can fill new size during resize
  contentMaxHeight.value = null

  document.addEventListener('mousemove', onResizeDrag)
  document.addEventListener('mouseup', endResizeDrag)
}

function onResizeDrag(e) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = e.clientX - resizeStartMousePos.value.x
  const deltaY = e.clientY - resizeStartMousePos.value.y
  const dir = resizeDirection.value

  let newWidth = resizeStartSize.value.width
  let newHeight = resizeStartSize.value.height
  let newX = resizeStartLegendPos.value.x
  let newY = resizeStartLegendPos.value.y

  const minW = 150
  const maxW = maxResizeWidth.value
  const minH = 100
  const maxH = maxLegendHeight.value

  // Width changes
  if (dir.includes('e')) {
    newWidth = Math.min(maxW, Math.max(minW, resizeStartSize.value.width + deltaX))
  } else if (dir.includes('w')) {
    const proposedWidth = Math.min(maxW, Math.max(minW, resizeStartSize.value.width - deltaX))
    // Move left edge: keep right edge fixed
    newX = resizeStartLegendPos.value.x + (resizeStartSize.value.width - proposedWidth)
    newWidth = proposedWidth
  }

  // Height changes
  if (dir.includes('s')) {
    newHeight = Math.min(maxH, Math.max(minH, resizeStartSize.value.height + deltaY))
  } else if (dir.includes('n')) {
    const proposedHeight = Math.min(maxH, Math.max(minH, resizeStartSize.value.height - deltaY))
    // Move top edge: keep bottom edge fixed
    newY = resizeStartLegendPos.value.y + (resizeStartSize.value.height - proposedHeight)
    newHeight = proposedHeight
  }

  // Apply via override for immediate visual feedback
  resizeOverride.value = { x: newX, y: newY, width: newWidth, height: newHeight }
}

function endResizeDrag() {
  if (isResizing.value && resizeOverride.value) {
    const { x, y, width, height } = resizeOverride.value

    // Commit position and size
    posX.value = x
    posY.value = y
    currentWidth.value = width
    currentHeight.value = height

    // Store values (switches from 'auto' to manual sizing)
    legendStore.updateSize(width, height)
    legendStore.updatePosition(x, y)

    // Re-detect sticky edges at new position
    detectStickyEdges()
  }

  isResizing.value = false
  resizeDirection.value = null
  resizeOverride.value = null

  document.removeEventListener('mousemove', onResizeDrag)
  document.removeEventListener('mouseup', endResizeDrag)
}

// Touch support for resize
function startResizeTouch(e, direction) {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    startResize({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    }, direction)

    document.addEventListener('touchmove', onResizeTouchMove, { passive: false })
    document.addEventListener('touchend', onResizeTouchEnd)
  }
}

function onResizeTouchMove(e) {
  if (e.touches.length === 1 && isResizing.value) {
    onResizeDrag({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
    e.preventDefault()
  }
}

function onResizeTouchEnd() {
  endResizeDrag()
  document.removeEventListener('touchmove', onResizeTouchMove)
  document.removeEventListener('touchend', onResizeTouchEnd)
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER BOUNDS CHANGE HANDLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recalculate legend position when container bounds change.
 * Maintains relative sticky edge positions when switching export modes.
 */
function adjustPositionForNewBounds(oldBounds, newBounds) {
  if (!oldBounds.width || !newBounds.width) return

  const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
  const legendHeight = legendRef.value?.offsetHeight || 200
  const margin = 10

  let newX = posX.value
  let newY = posY.value

  // If stuck to right edge, maintain right-edge position
  if (stickyEdge.value.right) {
    newX = newBounds.width - legendWidth - margin
  }
  // If stuck to left edge, keep at left
  else if (stickyEdge.value.left) {
    newX = margin
  }
  // Otherwise, scale proportionally to new width
  else if (oldBounds.width > 0) {
    const relativeX = posX.value / oldBounds.width
    newX = Math.max(margin, Math.min(newBounds.width - legendWidth - margin, relativeX * newBounds.width))
  }

  // Handle Y position - if posY is null, legend uses CSS bottom positioning
  // Treat null posY as "sticky to bottom" since that's the default position
  const isUsingBottomPosition = posY.value === null

  // If stuck to bottom edge OR using default bottom positioning, maintain bottom-edge position
  if (stickyEdge.value.bottom || isUsingBottomPosition) {
    newY = newBounds.height - legendHeight - margin
  }
  // If stuck to top edge, keep at top
  else if (stickyEdge.value.top) {
    newY = margin
  }
  // Otherwise, scale proportionally to new height
  else if (oldBounds.height > 0 && posY.value !== null) {
    const relativeY = posY.value / oldBounds.height
    newY = Math.max(margin, Math.min(newBounds.height - legendHeight - margin, relativeY * newBounds.height))
  }

  // Ensure legend stays within bounds
  newX = Math.max(margin, Math.min(newBounds.width - legendWidth - margin, newX))
  newY = Math.max(margin, Math.min(newBounds.height - legendHeight - margin, newY))

  posX.value = newX
  posY.value = newY
  legendStore.updatePosition(newX, newY)
}

/**
 * Detect current sticky edge state based on current position.
 * Used to initialize sticky state when component mounts or bounds change.
 * @param {boolean} wasExportMode - Optional: the export mode state BEFORE a mode change (for transitions)
 * @param {Object} useBounds - Optional: specific bounds to use instead of reading from DOM
 */
function detectStickyEdges(wasExportMode = null, useBounds = null) {
  // Use provided bounds, or prevContainerBounds (stable), or fall back to computed (may be stale during transitions)
  const bounds = useBounds || (prevContainerBounds.value.width ? prevContainerBounds.value : containerBounds.value)
  if (!bounds.width || !bounds.height) return

  const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
  const legendHeight = legendRef.value?.offsetHeight || 200
  const threshold = 20 // Detection threshold
  const margin = 10

  // Handle null posY (default bottom positioning via CSS)
  const effectiveY = posY.value !== null ? posY.value : bounds.height - legendHeight - 30

  // Calculate bottom edge position (where legend would be if at bottom)
  // Attribution margin is based on whether attribution is open, regardless of export mode
  // (since attribution is included in export when visible)
  const attrMargin = isAttributionOpen.value ? attributionHeight.value : 0
  const bottomEdgeY = bounds.height - legendHeight - margin - attrMargin

  // Legend is at bottom if within threshold of where it should be
  const isAtBottom = effectiveY >= bottomEdgeY - threshold

  stickyEdge.value = {
    left: posX.value <= threshold,
    right: posX.value >= bounds.width - legendWidth - threshold,
    top: effectiveY <= threshold,
    // If posY is null, it's using CSS bottom positioning, so it's sticky to bottom
    bottom: posY.value === null || isAtBottom
  }
}

/**
 * Apply position for new bounds while preserving sticky edges.
 * Used for window resize and export mode changes.
 * Also constrains legend height if too tall for new bounds.
 */
function applyPositionForBounds(oldBounds, newBounds) {
  const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
  let legendHeight = legendRef.value?.offsetHeight || 200
  const margin = 10
  const minHeight = 100

  // Calculate bottom margin (include attribution space when not in export mode)
  const bottomMargin = margin + bottomAttributionMargin.value

  // Calculate maximum allowed height
  const maxAllowedHeight = newBounds.height - margin - bottomMargin

  // If legend is too tall, constrain it
  if (legendHeight > maxAllowedHeight && maxAllowedHeight >= minHeight) {
    currentHeight.value = maxAllowedHeight
    legendHeight = maxAllowedHeight
    legendStore.updateSize(currentWidth.value, maxAllowedHeight)
  }

  let newX = posX.value
  let newY = posY.value

  // Apply sticky edges to new bounds
  if (stickyEdge.value.left) {
    newX = margin
  } else if (stickyEdge.value.right) {
    newX = newBounds.width - legendWidth - margin
  } else {
    // Scale proportionally
    if (oldBounds.width > 0) {
      const relativeX = posX.value / oldBounds.width
      newX = relativeX * newBounds.width
    }
    // Clamp to visible area
    newX = Math.max(margin, Math.min(newBounds.width - legendWidth - margin, newX))
  }

  if (stickyEdge.value.top) {
    newY = margin
  } else if (stickyEdge.value.bottom) {
    newY = newBounds.height - legendHeight - bottomMargin
  } else {
    // Scale proportionally
    if (oldBounds.height > 0) {
      const relativeY = posY.value / oldBounds.height
      newY = relativeY * newBounds.height
    }
    // Clamp to visible area
    newY = Math.max(margin, Math.min(newBounds.height - legendHeight - bottomMargin, newY))
  }

  // Final safety check
  newX = Math.max(margin, Math.min(newBounds.width - legendWidth - margin, newX))
  newY = Math.max(margin, Math.min(newBounds.height - legendHeight - bottomMargin, newY))

  posX.value = newX
  posY.value = newY
  legendStore.updatePosition(newX, newY)
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleLabelUpdate(label, customLabel) {
  legendStore.setCustomLabel(label, customLabel)
}

function handleColorUpdate(label, color) {
  legendStore.setCustomColor(label, color)
}

function handleToggleVisibility(label) {
  legendStore.toggleItemVisibility(label)
}

function handleResetColor(label) {
  legendStore.setCustomColor(label, '')
}


// ═══════════════════════════════════════════════════════════════════════════
// GROUP STYLE POPUP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function openGroupStylePopup(species, event) {
  // Position popup near the click
  const rect = event.target.getBoundingClientRect()
  stylePopupState.value = {
    open: true,
    groupName: species,
    position: {
      x: Math.min(rect.left + 20, window.innerWidth - 280),
      y: Math.min(rect.bottom + 5, window.innerHeight - 400)
    }
  }
  hasOpenPopup.value = true
}

function closeGroupStylePopup() {
  stylePopupState.value.open = false
  hasOpenPopup.value = false
}

function handleUpdateShape(shape) {
  legendStore.setGroupShape(stylePopupState.value.groupName, shape)
}

function handleUpdateBorderColor(color) {
  legendStore.setSpeciesBorderColor(stylePopupState.value.groupName, color)
}

function handleUpdateHue(hue) {
  legendStore.setSpeciesBaseHue(stylePopupState.value.groupName, parseInt(hue))
}

function handleUpdateUseGradient(enabled) {
  legendStore.setSpeciesGradientEnabledForSpecies(stylePopupState.value.groupName, enabled)
}

// ═══════════════════════════════════════════════════════════════════════════
// ABBREVIATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleUpdateAbbreviation(species, abbreviation) {
  legendStore.setSpeciesAbbreviation(species, abbreviation)
}

function handleToggleAbbreviationVisible(species) {
  legendStore.toggleAbbreviationVisible(species)
}

function handleUpdateSpeciesCustomLabel(species, customLabel) {
  // Use the new species display name setter
  legendStore.setSpeciesDisplayName(species, customLabel)
}

function handleShowHeaders() {
  legendStore.setShowHeaders(true)
}

function handleHideHeaders() {
  legendStore.setShowHeaders(false)
}

// Handle applying display name format to all species
function handleApplyDisplayFormatToAll(format) {
  // Set global format
  legendStore.setDisplayNameFormat(format)

  // Apply format to all species (clear individual customizations, use global)
  // The format will be applied via computed in groupedLegendData
}

// Sort dropdown state (single merged dropdown)
const sortDropdownOpen = ref(false)

function applySortOption(sortBy, sortOrder) {
  legendStore.setSortBy(sortBy)
  legendStore.setSortOrder(sortOrder)
  sortDropdownOpen.value = false
}

function toggleSortDropdown() {
  sortDropdownOpen.value = !sortDropdownOpen.value
}

function closeSortDropdowns() {
  sortDropdownOpen.value = false
}

function toggleShowCounts() {
  legendStore.toggleShowCounts()
}

// Handle applying prefix format to all species
function handleApplyPrefixFormatToAll(format) {
  // Set global format
  legendStore.setPrefixFormat(format)

  // Apply format to all species
  for (const species of speciesList.value) {
    const formatted = applyAbbreviationFormat(species, format)
    if (format === 'none') {
      legendStore.setSpeciesAbbreviation(species, '')
    } else {
      legendStore.setSpeciesAbbreviation(species, formatted)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTION OBSERVER
// ═══════════════════════════════════════════════════════════════════════════

let attributionObserver = null
let containerResizeObserver = null

function updateAttributionState() {
  if (!props.containerRef) return

  const attrEl = props.containerRef.querySelector('.maplibregl-ctrl-attrib')
  if (!attrEl) {
    isAttributionOpen.value = false
    attributionHeight.value = 0
    return
  }

  // Check if the details element is open
  const wasOpen = isAttributionOpen.value
  isAttributionOpen.value = attrEl.hasAttribute('open')
  attributionHeight.value = attrEl.offsetHeight || 24

  // If attribution state changed and legend is stuck to bottom, reposition
  if (wasOpen !== isAttributionOpen.value && stickyEdge.value.bottom) {
    repositionForAttributionChange()
  }
}

function repositionForAttributionChange() {
  if (!props.containerRef) return

  const bounds = {
    width: props.containerRef.clientWidth || 800,
    height: props.containerRef.clientHeight || 600
  }

  const legendHeight = legendRef.value?.offsetHeight || 200
  const margin = 10
  const bottomMargin = margin + bottomAttributionMargin.value

  // Only reposition if legend is stuck to bottom
  if (stickyEdge.value.bottom) {
    posY.value = bounds.height - legendHeight - bottomMargin
    legendStore.updatePosition(posX.value, posY.value)
  }
}

function setupAttributionObserver() {
  if (!props.containerRef) return

  const attrEl = props.containerRef.querySelector('.maplibregl-ctrl-attrib')
  if (!attrEl) {
    // Attribution element not yet mounted, retry later
    setTimeout(setupAttributionObserver, 100)
    return
  }

  // Initialize attribution state
  updateAttributionState()

  // Watch for open/close changes on the details element
  attributionObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
        updateAttributionState()
      }
    }
  })

  attributionObserver.observe(attrEl, { attributes: true })
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER RESIZE OBSERVER
// ═══════════════════════════════════════════════════════════════════════════

function setupContainerResizeObserver() {
  if (!props.containerRef || containerResizeObserver) return

  containerResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const newBounds = {
        width: entry.contentRect.width,
        height: entry.contentRect.height
      }

      // Skip if bounds haven't actually changed or if currently dragging
      if (isDragging.value) return
      if (newBounds.width === prevContainerBounds.value.width &&
          newBounds.height === prevContainerBounds.value.height) {
        return
      }

      // Only reposition if we have previous bounds to compare with
      if (prevContainerBounds.value.width > 0) {
        // Apply position for new bounds while preserving sticky edges
        // Note: sticky edges should have been captured by isExportMode watcher before resize
        applyPositionForBounds(prevContainerBounds.value, newBounds)
      }

      prevContainerBounds.value = { ...newBounds }
    }
  })

  containerResizeObserver.observe(props.containerRef)
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

// Close sort dropdowns on any click outside
function handleGlobalClick() {
  closeSortDropdowns()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)

  // Initialize previous bounds and position after a short delay to let the DOM settle
  setTimeout(() => {
    if (props.containerRef) {
      const bounds = {
        width: props.containerRef.clientWidth || 800,
        height: props.containerRef.clientHeight || 600
      }
      prevContainerBounds.value = { ...bounds }

      // Setup attribution observer (will also initialize attributionHeight)
      setupAttributionObserver()

      // Setup container resize observer to detect export mode changes
      setupContainerResizeObserver()

      const legendHeight = legendRef.value?.offsetHeight || 200
      const margin = 10

      // Check if legend is at default position (never been moved) or outside visible bounds
      const isDefaultPosition = posY.value === null || (posX.value === 40 && posY.value === legendStore.position.y)
      const isOutsideBounds = posY.value !== null && (
        posY.value < 0 ||
        posY.value > bounds.height - legendHeight - margin
      )

      if (isDefaultPosition || isOutsideBounds) {
        // Initialize to bottom-left, above attribution
        posX.value = margin
        posY.value = bounds.height - legendHeight - margin - bottomAttributionMargin.value
        stickyEdge.value = { left: true, right: false, top: false, bottom: true }
        legendStore.updatePosition(posX.value, posY.value)
      } else {
        // Detect sticky edges from existing position
        detectStickyEdges()
      }
    }
  }, 150)

  // Initial item-fit adjustment after DOM is ready
  setTimeout(() => {
    adjustItemsToFit()
    // Setup legend resize observer for bottom-sticky repositioning
    setupLegendResizeObserver()
  }, 300)

  // Add window resize listener
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', endDrag)
  window.removeEventListener('resize', handleWindowResize)

  // Clean up attribution observer
  if (attributionObserver) {
    attributionObserver.disconnect()
    attributionObserver = null
  }

  // Clean up container resize observer
  if (containerResizeObserver) {
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }

  // Clean up legend resize observer
  if (legendResizeObserver) {
    legendResizeObserver.disconnect()
    legendResizeObserver = null
  }

  // Clean up resize drag listeners
  document.removeEventListener('mousemove', onResizeDrag)
  document.removeEventListener('mouseup', endResizeDrag)
  document.removeEventListener('touchmove', onResizeTouchMove)
  document.removeEventListener('touchend', onResizeTouchEnd)
})

// Debounced window resize handler
let resizeTimeout = null
function handleWindowResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (!props.containerRef) return

    const newBounds = {
      width: props.containerRef.clientWidth || 800,
      height: props.containerRef.clientHeight || 600
    }

    // Skip if bounds haven't actually changed
    if (newBounds.width === prevContainerBounds.value.width &&
        newBounds.height === prevContainerBounds.value.height) {
      return
    }

    // Apply sticky edges to new bounds
    applyPositionForBounds(prevContainerBounds.value, newBounds)
    prevContainerBounds.value = { ...newBounds }
  }, 100)
}

// Watch for position changes from store
watch(() => legendStore.position, (newPos) => {
  if (!isDragging.value) {
    posX.value = newPos.x
    posY.value = newPos.y
  }
}, { deep: true })

// Watch for size changes from store
watch(() => legendStore.size, (newSize) => {
  if (!isResizing.value) {
    currentWidth.value = newSize.width === 'auto' ? null : newSize.width
    currentHeight.value = newSize.height === 'auto' ? null : newSize.height
  }
}, { deep: true })

// Watch auto-width changes to update currentWidth in auto mode
watch(autoWidth, (newAutoWidth) => {
  if (isAutoWidth.value && !isResizing.value) {
    currentWidth.value = newAutoWidth
  }
})

// Watch auto-height changes to update currentHeight in auto mode
watch(autoHeight, (newAutoHeight) => {
  if (isAutoHeight.value && !isResizing.value) {
    currentHeight.value = newAutoHeight
  }
})

// Post-render adjustment: measure actual content height and reduce/increase items to fill space.
// Watch sources that indicate the available space or content set changed (NOT legendItems,
// which depends on effectiveMaxItems, to avoid circular updates).
watch([maxLegendHeight, colorMap, () => legendStore.sortBy, () => legendStore.sortOrder,
       () => legendStore.wrapLabels, () => legendStore.textScale, () => legendStore.showCounts],
  () => {
    // Reset override so the estimate recalculates from scratch
    itemLimitOverride.value = null
    adjustingUp.value = false

    nextTick(() => {
      nextTick(() => {
        adjustItemsToFit()
      })
    })
  },
  { flush: 'post' }
)

function adjustItemsToFit() {
  const el = contentRef.value
  if (!el) return

  const maxH = maxLegendHeight.value
  const scrollH = el.scrollHeight
  const totalAvailable = sortedAllItems.value.length

  // Compare content's full scroll height against max allowed legend height.
  // Use maxH (not clientH) because:
  // 1. clientH gets locked by contentMaxHeight during hover
  // 2. clientH shrinks when the container auto-sizes to fewer items
  // Both cause undershooting. maxH is a stable, reliable ceiling.
  const overflows = scrollH > maxH + 2

  console.debug(
    `[Legend] adjustItemsToFit: scrollH=${scrollH}, maxH=${maxH}, ` +
    `items=${effectiveMaxItems.value}, override=${itemLimitOverride.value}, ` +
    `adjustingUp=${adjustingUp.value}, total=${totalAvailable}`
  )

  if (overflows) {
    if (adjustingUp.value) {
      // Was trying to add items but it overflowed — revert last increase and stop
      adjustingUp.value = false
      itemLimitOverride.value = Math.max(1, (itemLimitOverride.value || 2) - 1)
      console.debug(`[Legend] Increase overflow. Reverted to ${itemLimitOverride.value}`)
      return // Don't schedule another check — we know this count fits
    }
    // Normal reduction
    if (itemLimitOverride.value === null) {
      itemLimitOverride.value = Math.max(1, effectiveMaxItems.value - 1)
    } else if (itemLimitOverride.value > 1) {
      itemLimitOverride.value -= 1
    } else {
      return // Can't reduce further
    }
    console.debug(`[Legend] Reducing to ${itemLimitOverride.value}`)
    nextTick(() => nextTick(() => adjustItemsToFit()))
  } else {
    // Content fits — try adding more items to fill available space
    const currentLimit = effectiveMaxItems.value
    if (currentLimit < totalAvailable) {
      adjustingUp.value = true
      itemLimitOverride.value = (itemLimitOverride.value ?? currentLimit) + 1
      console.debug(`[Legend] Room available. Trying ${itemLimitOverride.value} items`)
      nextTick(() => nextTick(() => adjustItemsToFit()))
    } else {
      // All items fit or at maximum
      adjustingUp.value = false
      console.debug(`[Legend] Settled at ${currentLimit} items`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOTTOM-STICKY REPOSITIONING
// ═══════════════════════════════════════════════════════════════════════════

function repositionIfBottomSticky() {
  if (!stickyEdge.value.bottom || !legendRef.value || posY.value === null) return
  if (isDragging.value || isResizing.value) return

  const bounds = prevContainerBounds.value.width > 0 ? prevContainerBounds.value : containerBounds.value
  const legendHeight = legendRef.value.offsetHeight
  const margin = 10
  const bottomMargin = margin + bottomAttributionMargin.value
  const targetY = bounds.height - legendHeight - bottomMargin

  if (Math.abs(posY.value - targetY) > 2) {
    posY.value = targetY
    legendStore.updatePosition(posX.value, posY.value)
  }
}

function setupLegendResizeObserver() {
  if (!legendRef.value || legendResizeObserver) return

  lastLegendHeight = legendRef.value.offsetHeight

  legendResizeObserver = new ResizeObserver((entries) => {
    const newHeight = entries[0]?.contentRect?.height || 0
    if (newHeight === 0 || Math.abs(newHeight - lastLegendHeight) < 2) return
    lastLegendHeight = newHeight
    repositionIfBottomSticky()
  })

  legendResizeObserver.observe(legendRef.value)
}

// Watch for container bounds changes (triggered by export mode toggle or other factors)
// Note: This is a backup - main handling is in handleWindowResize and isExportMode watcher
watch(containerBounds, (newBounds) => {
  // Only update if not currently dragging
  if (isDragging.value) return

  // Just track bounds changes, don't reposition here
  // Repositioning is handled by handleWindowResize and isExportMode watcher
}, { deep: true })

// Watch for export mode changes - capture sticky state BEFORE container resizes
// The actual repositioning is handled by the containerResizeObserver
watch(isExportMode, (enabled, wasEnabled) => {
  // Capture current sticky state BEFORE container resizes
  // IMPORTANT: Pass the OLD export mode state since the container hasn't resized yet
  detectStickyEdges(wasEnabled)
})

</script>

<template>
  <div
    v-if="legendStore.showLegend && Object.keys(colorMap).length > 0"
    ref="legendRef"
    class="legend-container"
    :class="{
      'is-hovered': isHovered,
      'is-dragging': isDragging,
      'is-resizing': isResizing,
      'is-export': isExportMode,
      'show-edit-ui': showEditUI
    }"
    :style="positionStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <!-- Toolbar (hidden by default, shown on hover) -->
    <LegendToolbar
      v-show="showToolbar"
      :is-export-mode="isExportMode"
      @settings-open="hasOpenPopup = true"
      @settings-close="hasOpenPopup = false"
    />

    <!-- Legend content -->
    <div
      ref="contentRef"
      class="legend-content"
      :style="contentMaxHeight ? { maxHeight: contentMaxHeight + 'px' } : {}"
    >
      <!-- Title with hover controls (sort dropdown + counts toggle) -->
      <div class="legend-title" @click.stop>
        <span>{{ dataStore.legendTitle }}</span>
        <span v-if="showEditUI || sortDropdownOpen" class="title-hover-controls">
          <!-- Counts toggle -->
          <button
            class="title-control-button"
            :class="{ active: legendStore.showCounts }"
            title="Toggle item counts"
            @click.stop="toggleShowCounts"
          >
            <Hash :size="13" />
          </button>
          <!-- Sort dropdown -->
          <div class="sort-dropdown-wrapper">
            <button
              class="title-control-button sort-trigger"
              :class="{ active: sortDropdownOpen }"
              title="Sort options"
              @click.stop="toggleSortDropdown"
            >
              <span class="sort-label">Sort</span>
              <ChevronDown :size="10" class="sort-chevron" />
            </button>
            <div v-if="sortDropdownOpen" class="sort-dropdown" @click.stop>
              <div class="sort-dropdown-header">Sort by</div>
              <button
                class="sort-dropdown-item"
                :class="{ selected: legendStore.sortBy === 'alphabetical' && legendStore.sortOrder === 'asc' }"
                @click="applySortOption('alphabetical', 'asc')"
              >
                <ArrowUpAZ :size="14" />
                <span>A &rarr; Z</span>
              </button>
              <button
                class="sort-dropdown-item"
                :class="{ selected: legendStore.sortBy === 'alphabetical' && legendStore.sortOrder === 'desc' }"
                @click="applySortOption('alphabetical', 'desc')"
              >
                <ArrowDownZA :size="14" />
                <span>Z &rarr; A</span>
              </button>
              <div class="sort-dropdown-divider"></div>
              <button
                class="sort-dropdown-item"
                :class="{ selected: legendStore.sortBy === 'abundance' && legendStore.sortOrder === 'desc' }"
                @click="applySortOption('abundance', 'desc')"
              >
                <ChartBarDecreasing :size="14" />
                <span>Most abundant</span>
              </button>
              <button
                class="sort-dropdown-item"
                :class="{ selected: legendStore.sortBy === 'abundance' && legendStore.sortOrder === 'asc' }"
                @click="applySortOption('abundance', 'asc')"
              >
                <ChartBarIncreasing :size="14" />
                <span>Least abundant</span>
              </button>
            </div>
          </div>
        </span>
      </div>

      <!-- Items (Flat view) -->
      <div v-if="groupedLegendData.type === 'flat'" class="legend-items">
        <LegendItem
          v-for="item in groupedLegendData.items"
          :key="item.label"
          :label="item.label"
          :color="item.color"
          :default-color="item.defaultColor"
          :custom-label="item.customLabel"
          :custom-color="item.customColor"
          :visible="item.visible"
          :editable="showEditUI"
          :is-export-mode="isExportMode"
          :dot-size="dotSize"
          :font-size="fontSize"
          :border-color="dataStore.mapStyle.borderColor"
          :border-width="dataStore.mapStyle.borderWidth"
          :wrap-label="legendStore.wrapLabels"
          :count="legendStore.showCounts ? (subspeciesCounts[item.label] || 0) : null"
          @update:custom-label="(val) => handleLabelUpdate(item.label, val)"
          @update:custom-color="(val) => handleColorUpdate(item.label, val)"
          @toggle-visibility="() => handleToggleVisibility(item.label)"
          @reset-color="() => handleResetColor(item.label)"
          @picker-open="hasOpenPopup = true"
          @picker-close="hasOpenPopup = false"
        />
      </div>

      <!-- Items (Grouped view) -->
      <div v-else class="legend-items grouped">
        <div
          v-for="group in groupedLegendData.groups"
          :key="group.species"
          class="legend-group"
        >
          <!-- Group header -->
          <LegendGroupHeader
            :species-name="group.species"
            :abbreviation="group.abbreviation"
            :abbreviation-visible="group.abbreviationVisible"
            :custom-label="group.customLabel"
            :border-color="group.borderColor"
            :count="group.items.length"
            :dot-size="dotSize"
            :is-export-mode="isExportMode"
            :headers-hidden="!legendStore.groupingSettings.showHeaders"
            :is-legend-hovered="isHovered || hasModalOpen"
            :shape="group.shape"
            :has-customized-style="group.hasCustomizedStyle"
            :any-group-has-custom-style="anyGroupHasCustomStyle"
            @open-style-popup="openGroupStylePopup(group.species, $event)"
            @show-headers="handleShowHeaders"
            @hide-headers="handleHideHeaders"
            @update:abbreviation="(val) => handleUpdateAbbreviation(group.species, val)"
            @update:abbreviation-visible="(val) => legendStore.setAbbreviationVisible(group.species, val)"
            @update:custom-label="(val) => handleUpdateSpeciesCustomLabel(group.species, val)"
            @apply-display-format-to-all="handleApplyDisplayFormatToAll"
            @apply-prefix-format-to-all="handleApplyPrefixFormatToAll"
          />

          <!-- Group items (always shown) -->
          <div class="legend-group-items">
            <LegendItem
              v-for="item in group.items"
              :key="item.label"
              :label="item.displayLabel || item.label"
              :color="item.color"
              :default-color="item.defaultColor"
              :custom-label="item.customLabel"
              :custom-color="item.customColor"
              :visible="item.visible"
              :editable="showEditUI"
              :is-export-mode="isExportMode"
              :dot-size="dotSize"
              :font-size="fontSize"
              :border-color="group.borderColor"
              :border-width="dataStore.mapStyle.borderWidth"
              :indented="legendStore.groupingSettings.showHeaders"
              :shape="group.shape"
              :wrap-label="legendStore.wrapLabels"
              :count="legendStore.showCounts ? (subspeciesCounts[item.label] || 0) : null"
              @update:custom-label="(val) => handleLabelUpdate(item.label, val)"
              @update:custom-color="(val) => handleColorUpdate(item.label, val)"
              @toggle-visibility="() => handleToggleVisibility(item.label)"
              @reset-color="() => handleResetColor(item.label)"
              @picker-open="hasOpenPopup = true"
              @picker-close="hasOpenPopup = false"
            />
          </div>
        </div>
      </div>

      <!-- More indicator -->
      <div
        v-if="moreCount > 0"
        class="legend-more"
        :style="{ fontSize: fontSize + 'px' }"
      >
        + {{ moreCount }} more
      </div>
    </div>

    <!-- Multi-directional resize zones (shown on hover) -->
    <template v-if="showToolbar && !isExportMode">
      <div class="resize-zone resize-n" @mousedown.stop.prevent="startResize($event, 'n')" @touchstart.stop.prevent="startResizeTouch($event, 'n')" />
      <div class="resize-zone resize-s" @mousedown.stop.prevent="startResize($event, 's')" @touchstart.stop.prevent="startResizeTouch($event, 's')" />
      <div class="resize-zone resize-e" @mousedown.stop.prevent="startResize($event, 'e')" @touchstart.stop.prevent="startResizeTouch($event, 'e')" />
      <div class="resize-zone resize-w" @mousedown.stop.prevent="startResize($event, 'w')" @touchstart.stop.prevent="startResizeTouch($event, 'w')" />
      <div class="resize-zone resize-ne" @mousedown.stop.prevent="startResize($event, 'ne')" @touchstart.stop.prevent="startResizeTouch($event, 'ne')" />
      <div class="resize-zone resize-nw" @mousedown.stop.prevent="startResize($event, 'nw')" @touchstart.stop.prevent="startResizeTouch($event, 'nw')" />
      <div class="resize-zone resize-se" @mousedown.stop.prevent="startResize($event, 'se')" @touchstart.stop.prevent="startResizeTouch($event, 'se')">
        <!-- Visual affordance for SE corner -->
        <svg viewBox="0 0 10 10" class="resize-icon">
          <path d="M 8 2 L 2 8 M 8 5 L 5 8 M 8 8 L 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      </div>
      <div class="resize-zone resize-sw" @mousedown.stop.prevent="startResize($event, 'sw')" @touchstart.stop.prevent="startResizeTouch($event, 'sw')" />
    </template>

    <!-- Group Style Popup -->
    <LegendGroupStylePopup
      :open="stylePopupState.open"
      :group-name="stylePopupState.groupName"
      :current-shape="legendStore.getGroupShape(stylePopupState.groupName)"
      :border-color="legendStore.speciesBorderColors[stylePopupState.groupName] || dataStore.mapStyle.borderColor"
      :base-hue="speciesBaseHues[stylePopupState.groupName] || 210"
      :use-gradient="legendStore.isSpeciesGradientEnabled(stylePopupState.groupName)"
      :position="stylePopupState.position"
      @close="closeGroupStylePopup"
      @update:shape="handleUpdateShape"
      @update:border-color="handleUpdateBorderColor"
      @update:hue="handleUpdateHue"
      @update:use-gradient="handleUpdateUseGradient"
    />
  </div>
</template>

<style scoped>
.legend-container {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-overlay, rgba(26, 26, 46, 0.95));
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  z-index: 10;
  min-width: 150px;
  max-width: 600px;
  min-height: 80px;
  /* max-height is set dynamically via positionStyle */
  overflow: visible; /* Allow toolbar to overflow upwards */
  box-shadow: 0 2px 10px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(4px);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  user-select: none;
  cursor: grab; /* Indicate draggable */
}

.legend-container.is-hovered:not(.is-export) {
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
  border-radius: 0 0 8px 8px; /* Remove top corners when toolbar visible */
}

.legend-container.is-dragging {
  cursor: grabbing;
  opacity: 0.9;
}

.legend-container.is-resizing {
  opacity: 0.9;
}

/* Export mode - cleaner appearance */
.legend-container.is-export {
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.legend-content {
  padding: 12px 16px;
  overflow-y: auto;
  overflow-x: hidden;
  /* flex-basis: auto so the container sizes to content, then max-height caps it.
     flex-basis: 0% (from flex:1) would collapse the container without explicit height. */
  flex: 1 1 auto;
  min-height: 0;
}

.legend-container.is-export .legend-content {
  padding: 10px 14px;
}

.legend-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.title-hover-controls {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.title-control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
  opacity: 0.6;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.title-control-button:hover {
  opacity: 1;
  background: var(--color-bg-tertiary, rgba(255,255,255,0.08));
  color: var(--color-text-secondary, #aaa);
}

.title-control-button.active {
  opacity: 1;
  color: var(--color-accent, #4ade80);
}

.sort-label {
  text-transform: uppercase;
  font-size: 10px;
}

.sort-chevron {
  opacity: 0.5;
}

.sort-dropdown-wrapper {
  position: relative;
}

.sort-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  min-width: 150px;
  background: var(--color-bg-overlay, rgba(26, 26, 46, 0.98));
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  padding: 4px;
  margin-top: 2px;
}

.sort-dropdown-header {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
  padding: 4px 10px 2px;
}

.sort-dropdown-divider {
  height: 1px;
  background: var(--color-border, #3d3d5c);
  margin: 4px 6px;
}

.sort-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #aaa);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.1s ease;
  white-space: nowrap;
}

.sort-dropdown-item:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.08));
  color: var(--color-text-primary, #e0e0e0);
}

.sort-dropdown-item.selected {
  color: var(--color-accent, #4ade80);
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legend-more {
  font-style: italic;
  color: var(--color-text-muted, #666);
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

/* Scrollbar styling */
.legend-content::-webkit-scrollbar {
  width: 6px;
}

.legend-content::-webkit-scrollbar-track {
  background: transparent;
}

.legend-content::-webkit-scrollbar-thumb {
  background: var(--color-border, #3d3d5c);
  border-radius: 3px;
}

.legend-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted, #666);
}

/* Grouped view styles */
.legend-items.grouped {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-group {
  display: flex;
  flex-direction: column;
}

.legend-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 16px;
  padding-left: 4px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MULTI-DIRECTIONAL RESIZE ZONES
   ═══════════════════════════════════════════════════════════════════════════ */

.resize-zone {
  position: absolute;
  z-index: 5;
}

/* Edge handles: thin invisible strips */
.resize-n { top: -3px; left: 10px; right: 10px; height: 6px; cursor: n-resize; }
.resize-s { bottom: -3px; left: 10px; right: 10px; height: 6px; cursor: s-resize; }
.resize-e { right: -3px; top: 10px; bottom: 10px; width: 6px; cursor: e-resize; }
.resize-w { left: -3px; top: 10px; bottom: 10px; width: 6px; cursor: w-resize; }

/* Corner handles: small squares at each corner */
.resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; z-index: 6; }
.resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; z-index: 6; }
.resize-se { bottom: -3px; right: -3px; width: 16px; height: 16px; cursor: se-resize; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted, #666); border-radius: 0 0 8px 0; transition: color 0.15s ease; }
.resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; z-index: 6; }

.resize-se:hover { color: var(--color-text-secondary, #aaa); }
.legend-container.is-resizing .resize-se { color: var(--color-accent, #4ade80); }

.resize-icon {
  width: 10px;
  height: 10px;
}
</style>
