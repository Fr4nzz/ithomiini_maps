<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import { useElementResize } from '../../composables/useElementResize'
import { applyAbbreviationFormat } from '../../utils/abbreviations'
import { computePopupPosition } from '../../composables/usePopupPosition'
import { useLegendItemData } from './useLegendItemData'
import { useLegendMeasurement } from './useLegendMeasurement'
import { useLegendPosition } from './useLegendPosition'
import { ArrowUpAZ, ArrowDownZA, ChartBarDecreasing, ChartBarIncreasing, ChevronDown, Hash } from 'lucide-vue-next'
import LegendItem from './LegendItem.vue'
import LegendToolbar from './LegendToolbar.vue'
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
const contentRef = ref(null)
const isHovered = ref(false)
const hasOpenPopup = ref(false)

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

// Previous container bounds (for detecting changes)
const prevContainerBounds = ref({ width: 0, height: 0 })

// Attribution state
const attributionHeight = ref(24)
const isAttributionOpen = ref(true)

// Is export mode active?
const isExportMode = computed(() => dataStore.exportSettings.enabled)

const bottomAttributionMargin = computed(() => {
  if (!isAttributionOpen.value) return 0
  return attributionHeight.value
})

// Container dimensions
const containerBounds = computed(() => {
  if (prevContainerBounds.value.width > 0) {
    return prevContainerBounds.value
  }
  if (props.containerRef) {
    return {
      width: props.containerRef.clientWidth || 800,
      height: props.containerRef.clientHeight || 600
    }
  }
  return { width: 800, height: 600 }
})

// ═══════════════════════════════════════════════════════════════════════════
// POSITION (extracted composable)
// ═══════════════════════════════════════════════════════════════════════════

const {
  STICKY_MARGIN, posX, posY, isDragging, stickyEdge,
  startDrag, endDrag, detectStickyEdges,
  applyPositionForBounds, repositionForAttributionChange,
  repositionIfBottomSticky, setupLegendResizeObserver,
  cleanup: cleanupPosition
} = useLegendPosition({
  legendRef,
  getEffectiveWidth: () => effectiveWidth.value,
  containerBounds,
  prevContainerBounds,
  bottomAttributionMargin,
  isAttributionOpen,
  currentWidth,
  currentHeight,
  legendStore,
  props
})

// ═══════════════════════════════════════════════════════════════════════════
// MEASUREMENT (extracted composable)
// ═══════════════════════════════════════════════════════════════════════════

// We need a temporary placeholder for sortedAllItems/legendCounts since
// measurement composable and item data composable have a dependency chain:
// measurement → effectiveMaxItems → useLegendItemData → sortedAllItems → measurement
// Solution: pass refs that get populated after useLegendItemData is called.
const sortedAllItemsRef = ref([])
const legendCountsRef = ref({})

// Multi-directional resize (must come before measurement for isResizing)
const { isResizing, resizeOverride, startResize, startResizeTouch } = useElementResize(legendRef, {
  getPosition: () => ({ x: posX.value, y: posY.value ?? 0 }),
  getLimits: () => ({ minW: 200, maxW: maxResizeWidth.value, minH: 120, maxH: maxLegendHeight.value }),
  onEnd: ({ x, y, width, height }) => {
    console.debug(`[Legend] resize end: ${width}x${height} at (${x},${y})`)
    posX.value = x
    posY.value = y
    currentWidth.value = width
    currentHeight.value = height
    legendStore.updateSize(width, height)
    legendStore.updatePosition(x, y)
    detectStickyEdges()
  }
})

const {
  measuredItemCount, measuredSnugHeight, prevMeasuredCount,
  maxLegendHeight, effectiveMaxItems, effectiveWidth, effectiveHeight,
  maxResizeWidth, scheduleMeasurement, scheduleContainerResizeMeasurement,
  resetToAutoSize, cleanup: cleanupMeasurement
} = useLegendMeasurement({
  legendRef, contentRef, containerBounds,
  isAutoWidth, isAutoHeight, currentWidth, currentHeight,
  isResizing, resizeOverride,
  sortedAllItems: sortedAllItemsRef,
  legendCounts: legendCountsRef,
  legendStore, dataStore
})

// Should show toolbar/edit UI?
const showEditUI = computed(() => (isHovered.value || hasOpenPopup.value) && !isResizing.value)

// ═══════════════════════════════════════════════════════════════════════════
// ITEM DATA (extracted composable)
// ═══════════════════════════════════════════════════════════════════════════

const {
  colorMap, baseColors, itemGroupMap, itemToGroupsMap, subspeciesSpeciesMap,
  groupList, groupBorderColors, getGroupBorderColor, hasCustomizedStyle, anyGroupHasCustomStyle,
  getGroupForItem, getGroupsForItem, formatLabel,
  legendCounts, legendGroupCounts, getGroupItemCount,
  sortedAllItems, legendItems, groupedLegendData,
  moreCount, morePointCount
} = useLegendItemData(dataStore, legendStore, () => effectiveMaxItems.value, isExportMode)

// Bridge: keep measurement composable's refs in sync with item data
watch(sortedAllItems, (items) => { sortedAllItemsRef.value = items }, { immediate: true })
watch(legendCounts, (counts) => { legendCountsRef.value = counts }, { immediate: true })

// ═══════════════════════════════════════════════════════════════════════════
// WATCHERS (measurement triggers)
// ═══════════════════════════════════════════════════════════════════════════

// Initial measurement on mount
watch(contentRef, (el, oldEl) => {
  if (el && !oldEl) scheduleMeasurement(false, 'mount')
})

// Re-measure when layout-affecting settings change
watch([
  () => legendStore.wrapLabels,
  () => legendStore.textScale,
  () => legendStore.showCounts,
  () => legendStore.isGrouped,
  () => legendStore.groupingSettings,
], (newVals, oldVals) => {
  const settingNames = ['wrapLabels', 'textScale', 'showCounts', 'isGrouped', 'groupingSettings']
  const changed = settingNames.filter((_, i) => JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
  resetToAutoSize()
  measuredItemCount.value = null
  prevMeasuredCount.value = null
  measuredSnugHeight.value = null
  scheduleMeasurement(false, `setting:${changed.join(',')}`)
}, { deep: true })

// Re-measure when data changes
watch(sortedAllItems, (newItems, oldItems) => {
  const delta = newItems.length - (oldItems?.length || 0)
  resetToAutoSize()
  measuredItemCount.value = null
  prevMeasuredCount.value = null
  measuredSnugHeight.value = null
  scheduleMeasurement(false, `data:${newItems.length}items(${delta >= 0 ? '+' : ''}${delta})`)
})

// Re-measure after resize ends
watch(isResizing, (resizing) => {
  if (!resizing) {
    scheduleMeasurement(true, 'resizeEnd', true)
    const labels = new Set()
    for (const item of legendItems.value) {
      if (item.visible !== false) labels.add(item.label)
    }
    legendStore.setShownLabels(labels)
  }
})

// Manual mode watchers
watch(() => legendStore.maxItemsMode, (newMode) => {
  console.log(`[Legend] items mode → ${newMode}${newMode === 'manual' ? ` (${legendStore.maxItemsManual})` : ''}`)
  if (newMode === 'auto') scheduleMeasurement(true, 'modeChange')
})

watch(() => legendStore.maxItemsManual, (newCount) => {
  if (legendStore.isManualMode) console.log(`[Legend] manual items → ${newCount}`)
})

// Container resize triggers re-measurement
watch(prevContainerBounds, (newBounds, oldBounds) => {
  if (oldBounds.width > 0 && measuredItemCount.value !== null) {
    scheduleContainerResizeMeasurement()
  }
}, { deep: true })

// Sync shown labels to store
watch(legendItems, (items) => {
  if (isResizing.value) return
  const labels = new Set()
  for (const item of items) {
    if (item.visible !== false) labels.add(item.label)
  }
  legendStore.setShownLabels(labels)
}, { immediate: true })

// Position/size sync from store
watch(() => legendStore.position, (newPos) => {
  if (!isDragging.value) {
    posX.value = newPos.x
    posY.value = newPos.y
  }
}, { deep: true })

watch(() => legendStore.size, (newSize, oldSize) => {
  if (!isResizing.value) {
    currentWidth.value = newSize.width === 'auto' ? null : newSize.width
    currentHeight.value = newSize.height === 'auto' ? null : newSize.height
    // Re-measure when size changes externally (e.g. settings panel, tests)
    const widthChanged = newSize.width !== oldSize?.width
    const heightChanged = newSize.height !== oldSize?.height
    if (widthChanged || heightChanged) {
      scheduleMeasurement(true, 'sizeChange', true)
    }
  }
}, { deep: true })

// Export mode → capture sticky state before container resizes
watch(isExportMode, (enabled, wasEnabled) => {
  detectStickyEdges(wasEnabled)
})

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const dotSize = computed(() => Math.max(6, Math.min(16, dataStore.mapStyle.pointSize)))
const fontSize = computed(() => Math.round(14 * legendStore.textScale))

const positionStyle = computed(() => {
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

  if (posY.value !== null) {
    style.top = posY.value + 'px'
  } else {
    style.bottom = '30px'
  }

  style.left = posX.value + 'px'

  const h = effectiveHeight.value
  if (h && h !== 'auto') {
    style.height = h + 'px'
  }

  return style
})

function handleMouseEnter() { isHovered.value = true }
function handleMouseLeave() { isHovered.value = false }

// ═══════════════════════════════════════════════════════════════════════════
// ITEM HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleLabelUpdate(label, customLabel) { legendStore.setCustomLabel(label, customLabel) }
function handleColorUpdate(label, color) { legendStore.setCustomColor(label, color) }
function handleToggleVisibility(label) { legendStore.toggleItemVisibility(label) }
function handleResetColor(label) { legendStore.setCustomColor(label, '') }

// ═══════════════════════════════════════════════════════════════════════════
// GROUP STYLE POPUP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function openGroupStylePopup(groupName, event) {
  const rect = event.target.getBoundingClientRect()
  const pos = computePopupPosition(rect, {
    placement: 'bottom', offset: 5, popupWidth: 280, popupHeight: 400
  })
  stylePopupState.value = {
    open: true, groupName,
    position: { x: parseInt(pos.left), y: parseInt(pos.top) }
  }
  hasOpenPopup.value = true
}

function closeGroupStylePopup() {
  stylePopupState.value.open = false
  hasOpenPopup.value = false
}

function handleUpdateShape(shape) { legendStore.setGroupShape(stylePopupState.value.groupName, shape) }
function handleUpdateBorderColor(color) { legendStore.setSpeciesBorderColor(stylePopupState.value.groupName, color) }

// ═══════════════════════════════════════════════════════════════════════════
// ABBREVIATION / DISPLAY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleUpdateAbbreviation(species, abbreviation) { legendStore.setSpeciesAbbreviation(species, abbreviation) }
function handleToggleAbbreviationVisible(species) { legendStore.toggleAbbreviationVisible(species) }
function handleUpdateSpeciesCustomLabel(species, customLabel) { legendStore.setSpeciesDisplayName(species, customLabel) }
function handleShowHeaders() { legendStore.setShowHeaders(true) }
function handleHideHeaders() { legendStore.setShowHeaders(false) }
function handleApplyDisplayFormatToAll(format) { legendStore.setDisplayNameFormat(format) }

function handleApplyPrefixFormatToAll(format) {
  legendStore.setPrefixFormat(format)
  for (const groupName of groupList.value) {
    const formatted = applyAbbreviationFormat(groupName, format)
    legendStore.setSpeciesAbbreviation(groupName, format === 'none' ? '' : formatted)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SORT / UI
// ═══════════════════════════════════════════════════════════════════════════

const sortDropdownOpen = ref(false)

const sortOptions = [
  { by: 'alphabetical', order: 'asc', icon: ArrowUpAZ, label: 'A → Z' },
  { by: 'alphabetical', order: 'desc', icon: ArrowDownZA, label: 'Z → A' },
  { divider: true },
  { by: 'abundance', order: 'desc', icon: ChartBarDecreasing, label: 'Most abundant' },
  { by: 'abundance', order: 'asc', icon: ChartBarIncreasing, label: 'Least abundant' },
]

const resizeDirections = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function applySortOption(sortBy, sortOrder) {
  legendStore.setSortBy(sortBy)
  legendStore.setSortOrder(sortOrder)
  sortDropdownOpen.value = false
}

function toggleSortDropdown() { sortDropdownOpen.value = !sortDropdownOpen.value }
function closeSortDropdowns() { sortDropdownOpen.value = false }
function toggleShowCounts() { legendStore.toggleShowCounts() }

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
  const wasOpen = isAttributionOpen.value
  isAttributionOpen.value = attrEl.hasAttribute('open')
  attributionHeight.value = attrEl.offsetHeight || 24
  if (wasOpen !== isAttributionOpen.value && stickyEdge.value.bottom) {
    repositionForAttributionChange()
  }
}

function setupAttributionObserver() {
  if (!props.containerRef) return
  const attrEl = props.containerRef.querySelector('.maplibregl-ctrl-attrib')
  if (!attrEl) {
    setTimeout(setupAttributionObserver, 100)
    return
  }
  updateAttributionState()
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
      const newBounds = { width: entry.contentRect.width, height: entry.contentRect.height }
      if (isDragging.value) return
      if (newBounds.width === prevContainerBounds.value.width &&
          newBounds.height === prevContainerBounds.value.height) return
      if (prevContainerBounds.value.width > 0) {
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

function handleGlobalClick() { closeSortDropdowns() }

let resizeTimeout = null
function handleWindowResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (!props.containerRef) return
    const newBounds = {
      width: props.containerRef.clientWidth || 800,
      height: props.containerRef.clientHeight || 600
    }
    if (newBounds.width === prevContainerBounds.value.width &&
        newBounds.height === prevContainerBounds.value.height) return
    applyPositionForBounds(prevContainerBounds.value, newBounds)
    prevContainerBounds.value = { ...newBounds }
  }, 100)
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)

  setTimeout(() => {
    if (props.containerRef) {
      const bounds = {
        width: props.containerRef.clientWidth || 800,
        height: props.containerRef.clientHeight || 600
      }
      prevContainerBounds.value = { ...bounds }
      setupAttributionObserver()
      setupContainerResizeObserver()

      const legendHeight = legendRef.value?.offsetHeight || 200
      const margin = STICKY_MARGIN

      const isDefaultPosition = posY.value === null || (posX.value === 40 && posY.value === legendStore.position.y)
      const isOutsideBounds = posY.value !== null && (
        posY.value < 0 || posY.value > bounds.height - legendHeight - margin
      )

      if (isDefaultPosition || isOutsideBounds) {
        posX.value = margin
        posY.value = bounds.height - legendHeight - margin - bottomAttributionMargin.value
        stickyEdge.value = { left: true, right: false, top: false, bottom: true }
        legendStore.updatePosition(posX.value, posY.value)
      } else {
        detectStickyEdges()
      }
    }
  }, 150)

  setTimeout(() => { setupLegendResizeObserver() }, 300)
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('resize', handleWindowResize)
  if (attributionObserver) { attributionObserver.disconnect(); attributionObserver = null }
  if (containerResizeObserver) { containerResizeObserver.disconnect(); containerResizeObserver = null }
  if (resizeTimeout) clearTimeout(resizeTimeout)
  cleanupPosition()
  cleanupMeasurement()
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
    @touchstart.prevent="startDrag"
  >
    <!-- Toolbar (hidden by default, shown on hover) -->
    <LegendToolbar
      v-show="showEditUI"
      :is-export-mode="isExportMode"
      @settings-open="hasOpenPopup = true"
      @settings-close="hasOpenPopup = false"
      @dropdown-open="hasOpenPopup = true"
      @dropdown-close="hasOpenPopup = false"
    />

    <!-- Legend content -->
    <div
      ref="contentRef"
      class="legend-content"
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
              <template v-for="(opt, i) in sortOptions" :key="i">
                <div v-if="opt.divider" class="sort-dropdown-divider" />
                <button
                  v-else
                  class="sort-dropdown-item"
                  :class="{ selected: legendStore.sortBy === opt.by && legendStore.sortOrder === opt.order }"
                  @click="applySortOption(opt.by, opt.order)"
                >
                  <component :is="opt.icon" :size="14" />
                  <span>{{ opt.label }}</span>
                </button>
              </template>
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
          :count="legendStore.showCounts ? (legendCounts[item.label] || 0) : null"
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
          :key="group.name"
          class="legend-group"
        >
          <!-- Group header -->
          <LegendGroupHeader
            :species-name="group.name"
            :abbreviation="group.abbreviation"
            :abbreviation-visible="group.abbreviationVisible"
            :custom-label="group.customLabel"
            :border-color="group.borderColor"
            :count="group.items.length"
            :dot-size="dotSize"
            :is-export-mode="isExportMode"
            :headers-hidden="!legendStore.groupingSettings.showHeaders && !legendStore.isNonTaxonomyGroupBy"
            :is-legend-hovered="showEditUI"
            :is-non-taxonomy="legendStore.isNonTaxonomyGroupBy"
            :shape="group.shape"
            :any-group-has-custom-style="anyGroupHasCustomStyle"
            @open-style-popup="openGroupStylePopup(group.name, $event)"
            @show-headers="handleShowHeaders"
            @hide-headers="handleHideHeaders"
            @update:abbreviation="(val) => handleUpdateAbbreviation(group.name, val)"
            @update:abbreviation-visible="(val) => legendStore.setAbbreviationVisible(group.name, val)"
            @update:custom-label="(val) => handleUpdateSpeciesCustomLabel(group.name, val)"
            @apply-display-format-to-all="handleApplyDisplayFormatToAll"
            @apply-prefix-format-to-all="handleApplyPrefixFormatToAll"
            @dropdown-open="hasOpenPopup = true"
            @dropdown-close="hasOpenPopup = false"
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
              :indented="legendStore.groupingSettings.showHeaders || legendStore.isNonTaxonomyGroupBy"
              :shape="group.shape"
              :wrap-label="legendStore.wrapLabels"
              :count="legendStore.showCounts ? getGroupItemCount(group.name, item.label) : null"
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

      <!-- More indicator (overflow items appear grey on the map) -->
      <div
        v-if="moreCount > 0"
        class="legend-more"
        :style="{ fontSize: fontSize + 'px' }"
      >
        <span class="more-dot" />
        + {{ moreCount }} more
        <span v-if="morePointCount !== null" class="more-count">{{ morePointCount.toLocaleString() }}</span>
      </div>
    </div>

    <!-- Multi-directional resize zones (shown on hover) -->
    <template v-if="showEditUI && !isExportMode">
      <div v-for="dir in resizeDirections" :key="dir"
           :class="['resize-zone', `resize-${dir}`]"
           @mousedown.stop.prevent="startResize($event, dir)"
           @touchstart.stop.prevent="startResizeTouch($event, dir)">
        <!-- Visual affordance for SE corner -->
        <svg v-if="dir === 'se'" viewBox="0 0 10 10" class="resize-icon">
          <path d="M 8 2 L 2 8 M 8 5 L 5 8 M 8 8 L 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      </div>
    </template>

    <!-- Group Style Popup -->
    <LegendGroupStylePopup
      :open="stylePopupState.open"
      :group-name="stylePopupState.groupName"
      :current-shape="legendStore.getGroupShape(stylePopupState.groupName)"
      :border-color="legendStore.speciesBorderColors[stylePopupState.groupName] || dataStore.mapStyle.borderColor"
      :position="stylePopupState.position"
      @close="closeGroupStylePopup"
      @update:shape="handleUpdateShape"
      @update:border-color="handleUpdateBorderColor"
    />
  </div>
</template>

<style scoped src="./legend-styles.css"></style>
