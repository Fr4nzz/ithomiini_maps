<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import LegendItem from './LegendItem.vue'
import LegendToolbar from './LegendToolbar.vue'
import LegendResizeHandle from './LegendResizeHandle.vue'

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

// Current size
const currentWidth = ref(legendStore.size.width || 200)
const currentHeight = ref(legendStore.size.height === 'auto' ? null : legendStore.size.height)

// Position state
const posX = ref(legendStore.position.x || 40)
const posY = ref(legendStore.position.y)

// Drag state
const dragStart = ref({ x: 0, y: 0 })
const dragStartPos = ref({ x: 0, y: 0 })

// Is export mode active?
const isExportMode = computed(() => dataStore.exportSettings.enabled)

// Should show toolbar? (hidden by default, shown on hover OR when popup is open)
const showToolbar = computed(() => isHovered.value || hasOpenPopup.value)

// Should show edit UI? (editable on hover OR when popup is open)
const showEditUI = computed(() => isHovered.value || hasOpenPopup.value)

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
  // Only start drag from toolbar drag handle
  if (!e.target.closest('.drag-handle')) return

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

  // Apply sticky edges if enabled
  if (legendStore.stickyEdges) {
    const threshold = legendStore.snapThreshold
    const bounds = containerBounds.value
    const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
    const legendHeight = legendRef.value?.offsetHeight || 200

    // Snap to left
    if (newX < threshold) newX = 10
    // Snap to right
    if (newX > bounds.width - legendWidth - threshold) {
      newX = bounds.width - legendWidth - 10
    }
    // Snap to top
    if (newY < threshold + 60) newY = 70 // Account for controls
    // Snap to bottom
    if (newY > bounds.height - legendHeight - threshold) {
      newY = bounds.height - legendHeight - 30
    }
  }

  // Constrain to container
  const bounds = containerBounds.value
  const legendWidth = legendRef.value?.offsetWidth || currentWidth.value
  const legendHeight = legendRef.value?.offsetHeight || 200

  newX = Math.max(10, Math.min(bounds.width - legendWidth - 10, newX))
  newY = Math.max(10, Math.min(bounds.height - legendHeight - 10, newY))

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
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  // If no Y position set, calculate based on container
  if (posY.value === null && props.containerRef) {
    const containerHeight = props.containerRef.clientHeight || 600
    posY.value = containerHeight - 250 // Approximate legend height + margin
  }
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

      <!-- Items -->
      <div class="legend-items">
        <LegendItem
          v-for="item in legendItems"
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
  overflow: hidden;
  box-shadow: 0 2px 10px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(4px);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  user-select: none;
}

.legend-container.is-hovered:not(.is-export) {
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
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
  flex: 1;
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
</style>
