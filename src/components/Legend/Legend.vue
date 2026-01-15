<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import { generateSpeciesBorderColors, generateSpeciesBaseHues } from '../../utils/colors'
import { applyAbbreviationFormat } from '../../utils/abbreviations'
import LegendItem from './LegendItem.vue'
import LegendToolbar from './LegendToolbar.vue'
import LegendResizeHandle from './LegendResizeHandle.vue'
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

// Popup state
const stylePopupState = ref({
  open: false,
  groupName: '',
  position: { x: 0, y: 0 }
})

// Current size
const currentWidth = ref(legendStore.size.width || 200)
const currentHeight = ref(legendStore.size.height === 'auto' ? null : legendStore.size.height)

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

// Attribution height (space reserved at bottom for map attribution)
const ATTRIBUTION_HEIGHT = 24  // Height of the collapsed attribution info button

// Is export mode active?
const isExportMode = computed(() => dataStore.exportSettings.enabled)

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

// Get items with visibility and custom settings applied
const legendItems = computed(() => {
  const items = []
  const maxItems = legendStore.maxItems

  let count = 0
  for (const [label, color] of Object.entries(colorMap.value)) {
    // Skip hidden items
    if (!legendStore.isItemVisible(label)) continue

    if (count >= maxItems) {
      break
    }

    items.push({
      label,
      color,
      defaultColor: color,
      customLabel: legendStore.customLabels[label] || '',
      customColor: legendStore.customColors[label] || '',
      visible: true
    })
    count++
  }

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

// Grouped legend data structure
const groupedLegendData = computed(() => {
  // If not grouped mode or not in subspecies colorBy, return flat
  if (!legendStore.isGrouped) {
    return { type: 'flat', items: legendItems.value }
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

  // Sort species alphabetically
  const sortedSpecies = Object.keys(itemsBySpecies).sort()

  // Build groups
  for (const species of sortedSpecies) {
    const items = itemsBySpecies[species]

    // Get custom display name - either per-species or apply global format
    let customLabel = legendStore.getSpeciesDisplayName(species)
    if (!customLabel && legendStore.displayNameFormat !== 'firstLetterGenus') {
      // If global format is not default, apply it
      customLabel = applyAbbreviationFormat(species, legendStore.displayNameFormat)
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
      items: items.map(item => ({
        ...item,
        displayLabel: formatLabel(item.label, species)
      }))
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

// More items indicator
const moreCount = computed(() => {
  const total = Object.keys(colorMap.value).length
  const maxItems = legendStore.maxItems
  const hidden = legendStore.hiddenItems.length

  return Math.max(0, total - hidden - maxItems)
})

// Scaled sizes
const dotSize = computed(() => Math.round(10 * legendStore.dotScale))
const fontSize = computed(() => Math.round(14 * legendStore.textScale))

// Position style
const positionStyle = computed(() => {
  const style = {
    width: currentWidth.value + 'px'
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

  // Height if set (allows vertical resize)
  if (currentHeight.value && currentHeight.value !== 'auto') {
    style.height = currentHeight.value + 'px'
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
    const bounds = containerBounds.value
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
    // Snap to bottom edge
    if (newY > bounds.height - legendHeight - threshold && newY <= bounds.height - legendHeight) {
      newY = bounds.height - legendHeight - margin
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
// RESIZE HANDLING
// ═══════════════════════════════════════════════════════════════════════════

function onResizeStart() {
  isResizing.value = true
}

function onResize({ width, height }) {
  currentWidth.value = width
  if (height) {
    currentHeight.value = height
  }
}

function onResizeEnd() {
  isResizing.value = false
  legendStore.updateSize(currentWidth.value, currentHeight.value || 'auto')
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

  // Use the provided wasExportMode if available (for mode transitions), otherwise use current
  const useExportMode = wasExportMode !== null ? wasExportMode : isExportMode.value

  // Calculate bottom edge position (where legend would be if at bottom)
  // The legend is considered "at bottom" if it's within threshold of:
  // - In export mode: bounds.height - legendHeight - margin
  // - Not in export mode: bounds.height - legendHeight - margin - ATTRIBUTION_HEIGHT
  const bottomMargin = useExportMode ? margin : margin + ATTRIBUTION_HEIGHT
  const bottomEdgeY = bounds.height - legendHeight - bottomMargin

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
  const bottomMargin = isExportMode.value ? margin : margin + ATTRIBUTION_HEIGHT

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
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  // Initialize previous bounds and position after a short delay to let the DOM settle
  setTimeout(() => {
    if (props.containerRef) {
      const bounds = {
        width: props.containerRef.clientWidth || 800,
        height: props.containerRef.clientHeight || 600
      }
      prevContainerBounds.value = { ...bounds }

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
        posY.value = bounds.height - legendHeight - margin - ATTRIBUTION_HEIGHT
        stickyEdge.value = { left: true, right: false, top: false, bottom: true }
        legendStore.updatePosition(posX.value, posY.value)
      } else {
        // Detect sticky edges from existing position
        detectStickyEdges()
      }
    }
  }, 150)

  // Add window resize listener
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', endDrag)
  window.removeEventListener('resize', handleWindowResize)
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
    currentWidth.value = newSize.width
    currentHeight.value = newSize.height === 'auto' ? null : newSize.height
  }
}, { deep: true })

// Watch for container bounds changes (triggered by export mode toggle or other factors)
// Note: This is a backup - main handling is in handleWindowResize and isExportMode watcher
watch(containerBounds, (newBounds) => {
  // Only update if not currently dragging
  if (isDragging.value) return

  // Just track bounds changes, don't reposition here
  // Repositioning is handled by handleWindowResize and isExportMode watcher
}, { deep: true })

// Watch for export mode changes to force bounds recalculation
watch(isExportMode, (enabled, wasEnabled) => {
  // Capture current sticky state BEFORE container resizes
  // IMPORTANT: Pass the OLD export mode state since the container hasn't resized yet
  detectStickyEdges(wasEnabled)

  // Save pre-resize bounds for interpolation
  const oldBounds = { ...prevContainerBounds.value }

  // Wait for the CSS styles to be applied and the browser to reflow
  // Use requestAnimationFrame + setTimeout to ensure the container has been resized
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (!props.containerRef) return

      // Get fresh bounds AFTER container has resized
      const newBounds = {
        width: props.containerRef.clientWidth || 800,
        height: props.containerRef.clientHeight || 600
      }

      if (newBounds.width && newBounds.height) {
        // Apply position for new bounds while preserving sticky edges
        applyPositionForBounds(oldBounds, newBounds)
        prevContainerBounds.value = { ...newBounds }
      }
    }, 250) // Delay for CSS transitions
  })
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
      <!-- Title -->
      <div class="legend-title">
        {{ dataStore.legendTitle }}
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

    <!-- Resize handle (shown on hover) -->
    <LegendResizeHandle
      v-show="showToolbar"
      :min-width="150"
      :max-width="400"
      :min-height="100"
      :max-height="600"
      @resize-start="onResizeStart"
      @resize="onResize"
      @resize-end="onResizeEnd"
    />

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
  max-width: 400px;
  min-height: 100px;
  max-height: 600px;
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
  flex: 1;
  max-height: 100%;
}

.legend-container.is-export .legend-content {
  padding: 10px 14px;
}

.legend-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
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
</style>
