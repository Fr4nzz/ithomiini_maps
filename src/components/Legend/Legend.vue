<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import { generateSpeciesBorderColors, generateSpeciesBaseHues } from '../../utils/colors'
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
const isHovered = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const hasOpenPopup = ref(false) // Track if any popup (color picker, settings) is open

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
  left: false,
  right: false,
  top: false,
  bottom: false
})

// Previous container bounds (for detecting changes)
const prevContainerBounds = ref({ width: 0, height: 0 })

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
  // Show subspecies name first, then abbreviation on the right
  return `${subspecies} ${abbreviation}`
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
    groups.push({
      species,
      borderColor: getSpeciesBorderColor(species),
      baseHue: speciesBaseHues.value[species] || 210,
      shape: legendStore.getGroupShape(species),
      abbreviation: legendStore.getSpeciesAbbreviation(species),
      abbreviationVisible: legendStore.isAbbreviationVisible(species),
      customLabel: legendStore.customLabels[species] || '',
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
// DRAG HANDLING
// ═══════════════════════════════════════════════════════════════════════════

function startDrag(e) {
  // Allow drag from toolbar area (but not from buttons, dropdowns, or other interactive elements)
  const toolbar = e.target.closest('.legend-toolbar')
  if (!toolbar) return

  // Don't start drag if clicking on interactive elements
  if (e.target.closest('button') ||
      e.target.closest('select') ||
      e.target.closest('input') ||
      e.target.closest('.color-by-select')) return

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

  // If stuck to bottom edge, maintain bottom-edge position
  if (stickyEdge.value.bottom) {
    newY = newBounds.height - legendHeight - margin
  }
  // If stuck to top edge, keep at top
  else if (stickyEdge.value.top) {
    newY = margin
  }
  // Otherwise, scale proportionally to new height
  else if (oldBounds.height > 0) {
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
 */
function detectStickyEdges() {
  const bounds = containerBounds.value
  if (!bounds.width || !bounds.height) return

  const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
  const legendHeight = legendRef.value?.offsetHeight || 200
  const threshold = 20 // Detection threshold

  stickyEdge.value = {
    left: posX.value <= threshold,
    right: posX.value >= bounds.width - legendWidth - threshold,
    top: posY.value <= threshold,
    bottom: posY.value >= bounds.height - legendHeight - threshold
  }
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

function handleResetCustomizations() {
  // Reset is handled by store
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
  legendStore.setCustomLabel(species, customLabel)
}

function handleShowHeaders() {
  legendStore.setShowHeaders(true)
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  // If no Y position set, calculate based on container
  if (posY.value === null && props.containerRef) {
    const containerHeight = props.containerRef.clientHeight || 600
    posY.value = containerHeight - 250 // Approximate legend height + margin
  }

  // Initialize previous bounds and detect sticky edges after a short delay
  // to let the DOM settle
  setTimeout(() => {
    if (props.containerRef) {
      prevContainerBounds.value = {
        width: props.containerRef.clientWidth || 800,
        height: props.containerRef.clientHeight || 600
      }
      detectStickyEdges()
    }
  }, 100)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', endDrag)
})

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

// Watch for container bounds changes (triggered by export mode toggle)
watch(containerBounds, (newBounds, oldBounds) => {
  // Only adjust if we have valid previous bounds and not currently dragging
  if (isDragging.value || !prevContainerBounds.value.width) {
    prevContainerBounds.value = { ...newBounds }
    return
  }

  // Detect sticky state before adjusting
  if (!stickyEdge.value.left && !stickyEdge.value.right &&
      !stickyEdge.value.top && !stickyEdge.value.bottom) {
    detectStickyEdges()
  }

  // Adjust position for new bounds
  adjustPositionForNewBounds(prevContainerBounds.value, newBounds)

  // Update previous bounds
  prevContainerBounds.value = { ...newBounds }
}, { deep: true })

// Watch for export mode changes to force bounds recalculation
watch(isExportMode, () => {
  // Small delay to let the container resize first
  setTimeout(() => {
    const bounds = containerBounds.value
    if (bounds.width && bounds.height) {
      detectStickyEdges()
      // Force position adjustment by setting prev bounds
      if (prevContainerBounds.value.width) {
        adjustPositionForNewBounds(prevContainerBounds.value, bounds)
      }
      prevContainerBounds.value = { ...bounds }
    }
  }, 50)
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
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <!-- Toolbar (hidden by default, shown on hover) -->
    <LegendToolbar
      v-show="showToolbar"
      :is-export-mode="isExportMode"
      @reset-customizations="handleResetCustomizations"
      @settings-open="hasOpenPopup = true"
      @settings-close="hasOpenPopup = false"
    />

    <!-- Legend content -->
    <div class="legend-content">
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
            @open-style-popup="openGroupStylePopup(group.species, $event)"
            @show-headers="handleShowHeaders"
            @update:abbreviation="(val) => handleUpdateAbbreviation(group.species, val)"
            @update:abbreviation-visible="(val) => legendStore.setAbbreviationVisible(group.species, val)"
            @update:custom-label="(val) => handleUpdateSpeciesCustomLabel(group.species, val)"
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
