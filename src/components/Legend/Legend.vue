<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'
import { useElementResize } from '../../composables/useElementResize'
import { generateSpeciesBorderColors } from '../../utils/colors'
import { applyAbbreviationFormat } from '../../utils/abbreviations'
import { computePopupPosition } from '../../composables/usePopupPosition'
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
const isDragging = ref(false)
const hasOpenPopup = ref(false) // Track if any popup (color picker, settings) is open

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

// Should show toolbar/edit UI? (hidden by default, shown on hover OR when popup is open)
// Suppressed during resize so user sees normal (non-edit) layout for accurate item count feedback
const showEditUI = computed(() => (isHovered.value || hasOpenPopup.value) && !isResizing.value)
const showToolbar = showEditUI

// (hasModalOpen removed — showEditUI now used directly for group headers)

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

// Color map from data store (includes custom overrides - used for display)
const colorMap = computed(() => dataStore.activeColorMap)
// Base color map (without custom overrides - used for defaultColor/reset)
const baseColors = computed(() => dataStore.baseColorMap)

// Map groupBy setting to GeoJSON property name
const groupByPropertyMap = {
  'subspecies': 'subspecies',
  'species': 'scientific_name',
  'genus': 'genus',
  'tribe': 'tribe',
  'subfamily': 'subfamily',
  'family': 'family',
  'status': 'sequencing_status',
  'mimicry': 'mimicry_ring',
  'source': 'source'
}

// Build item→group mapping from displayed data (generic for any colorBy/groupBy)
const itemGroupMap = computed(() => {
  const geo = dataStore.displayGeoJSON
  if (!geo?.features) return {}

  const groupBy = legendStore.effectiveGroupBy
  const groupProperty = groupByPropertyMap[groupBy]
  if (!groupProperty) return {}

  const itemProperty = dataStore.colorByAttribute

  const map = {}
  for (const feature of geo.features) {
    const groupVal = feature.properties[groupProperty]
    const itemVal = feature.properties[itemProperty]

    if (!groupVal || !itemVal) continue
    if (itemVal === 'Unknown' || itemVal === 'NA') continue

    if (!map[groupVal]) {
      map[groupVal] = new Set()
    }
    map[groupVal].add(itemVal)
  }

  // Convert sets to sorted arrays
  const result = {}
  for (const [group, items] of Object.entries(map)) {
    result[group] = [...items].sort()
  }

  return result
})

// Get list of groups (sorted)
const groupList = computed(() => Object.keys(itemGroupMap.value).sort())

// Generate border colors for groups
const groupBorderColors = computed(() => {
  if (!legendStore.speciesStyling.borderColor) return {}
  return generateSpeciesBorderColors(groupList.value, legendStore.speciesBorderColors)
})

// Get border color for a group
function getGroupBorderColor(groupName) {
  return groupBorderColors.value[groupName] || dataStore.mapStyle.borderColor
}

// Check if group has customized style (shape or border color)
function hasCustomizedStyle(groupName) {
  const shape = legendStore.getGroupShape(groupName)
  const hasCustomShape = shape && shape !== 'circle'
  const hasCustomBorder = !!legendStore.speciesBorderColors[groupName]
  return hasCustomShape || hasCustomBorder
}

// Check if ANY group has customized style (for showing all indicators when one is customized)
const anyGroupHasCustomStyle = computed(() => {
  return groupList.value.some(name => hasCustomizedStyle(name))
})

// Get the group that an item belongs to (reverse lookup)
function getGroupForItem(itemLabel) {
  for (const [group, items] of Object.entries(itemGroupMap.value)) {
    if (items.includes(itemLabel)) {
      return group
    }
  }
  return null
}

// Format label based on per-group abbreviation visibility
function formatLabel(itemLabel, groupName) {
  if (!groupName || !legendStore.isAbbreviationVisible(groupName)) {
    return itemLabel
  }

  const abbreviation = legendStore.getSpeciesAbbreviation(groupName)
  return `${abbreviation} ${itemLabel}`
}

// All visible items from color map, sorted by current sort criteria
// This sorts ALL items BEFORE slicing to effectiveMaxItems, so the top-N
// by the chosen sort are shown (e.g., most abundant subspecies).
const sortedAllItems = computed(() => {
  const sortByVal = legendStore.sortBy
  const sortOrderVal = legendStore.sortOrder
  const counts = legendCounts.value
  const entries = Object.entries(colorMap.value)

  // Build full list of visible items
  const items = []
  const baseMap = baseColors.value
  for (const [label, color] of entries) {
    if (!legendStore.isItemVisible(label)) continue
    items.push({
      label,
      color,
      defaultColor: baseMap[label] || color,
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

// Fair distribution of legend slots across groups.
// When grouped, allocates slots equally to each group so every group
// gets representation (e.g., half Sanger, half iNaturalist).
function fairGroupedSlice(allItems, maxItems) {
  const groups = new Map()
  for (const item of allItems) {
    const group = getGroupForItem(item.label)
    if (group) {
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(item)
    }
  }

  const groupNames = [...groups.keys()]
  const numGroups = groupNames.length
  if (numGroups === 0) return allItems.slice(0, maxItems)

  // Equal base allocation per group
  const basePerGroup = Math.floor(maxItems / numGroups)
  let remainder = maxItems - basePerGroup * numGroups

  // Allocate: base + up to 1 extra (remainder goes to largest groups first)
  const allocations = new Map()
  const bySize = [...groupNames].sort((a, b) => groups.get(b).length - groups.get(a).length)

  for (const name of bySize) {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    allocations.set(name, Math.min(basePerGroup + extra, groups.get(name).length))
  }

  // Redistribute unused slots from small groups to larger ones
  let totalAlloc = 0
  for (const v of allocations.values()) totalAlloc += v
  let surplus = maxItems - totalAlloc

  while (surplus > 0) {
    let distributed = false
    for (const name of bySize) {
      if (surplus <= 0) break
      if (allocations.get(name) < groups.get(name).length) {
        allocations.set(name, allocations.get(name) + 1)
        surplus--
        distributed = true
      }
    }
    if (!distributed) break
  }

  // Collect items preserving original group order
  const result = []
  for (const name of groupNames) {
    const quota = allocations.get(name) || 0
    result.push(...groups.get(name).slice(0, quota))
  }

  return result
}

// Get items sliced to fit, with hidden items appended for edit mode
const legendItems = computed(() => {
  const maxItems = effectiveMaxItems.value
  let items

  // When grouping is active, distribute slots fairly across groups
  if (legendStore.isGrouped) {
    items = fairGroupedSlice(sortedAllItems.value, maxItems)
  } else {
    items = sortedAllItems.value.slice(0, maxItems)
  }

  // Add hidden items at the end (for edit mode)
  if (!isExportMode.value) {
    const baseMap = baseColors.value
    for (const label of legendStore.hiddenItems) {
      if (colorMap.value[label]) {
        items.push({
          label,
          color: colorMap.value[label],
          defaultColor: baseMap[label] || colorMap.value[label],
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

function groupItemsByGroup(items) {
  const byGroup = {}
  for (const item of items) {
    const group = getGroupForItem(item.label)
    if (group) {
      if (!byGroup[group]) byGroup[group] = []
      byGroup[group].push(item)
    }
  }
  return byGroup
}

function sortGroups(groups, sortBy, sortOrder, counts) {
  if (sortBy === 'abundance') {
    groups.sort((a, b) => {
      const totalA = a.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
      const totalB = b.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
      return sortOrder === 'asc' ? totalA - totalB : totalB - totalA
    })
  } else {
    groups.sort((a, b) => {
      const textA = a.name.toLowerCase()
      const textB = b.name.toLowerCase()
      return sortOrder === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
    })
  }
  return groups
}

function buildGroupData(groupName, items, sortByVal, sortOrderVal, counts) {
  let customLabel = legendStore.getSpeciesDisplayName(groupName)
  if (!customLabel && legendStore.displayNameFormat !== 'firstLetterGenus') {
    customLabel = applyAbbreviationFormat(groupName, legendStore.displayNameFormat)
  }

  let mappedItems = items.map(item => ({
    ...item,
    displayLabel: formatLabel(item.label, groupName)
  }))

  mappedItems = sortByVal === 'abundance'
    ? sortItemsByAbundance(mappedItems, sortOrderVal, counts)
    : sortItemsByText(mappedItems, sortOrderVal)

  return {
    name: groupName,
    borderColor: getGroupBorderColor(groupName),
    shape: legendStore.getGroupShape(groupName),
    abbreviation: legendStore.getSpeciesAbbreviation(groupName),
    abbreviationVisible: legendStore.isAbbreviationVisible(groupName),
    customLabel: customLabel || '',
    items: mappedItems
  }
}

// Grouped legend data structure
const groupedLegendData = computed(() => {
  const sortByVal = legendStore.sortBy
  const sortOrderVal = legendStore.sortOrder
  const counts = legendCounts.value

  if (!legendStore.isGrouped) {
    return { type: 'flat', items: legendItems.value.slice() }
  }

  const itemsByGroup = groupItemsByGroup(legendItems.value)
  const groups = Object.keys(itemsByGroup).map(groupName =>
    buildGroupData(groupName, itemsByGroup[groupName], sortByVal, sortOrderVal, counts)
  )

  return { type: 'grouped', groups: sortGroups(groups, sortByVal, sortOrderVal, counts) }
})

// More items indicator (based on visible items that didn't fit)
const moreCount = computed(() => {
  const totalVisible = sortedAllItems.value.length
  const maxItems = effectiveMaxItems.value
  return Math.max(0, totalVisible - maxItems)
})

// Total point count for overflow (grey) items — shown when counts enabled
const morePointCount = computed(() => {
  if (!legendStore.showCounts || moreCount.value === 0) return null
  const shownSet = new Set(legendItems.value.filter(i => i.visible !== false).map(i => i.label))
  const counts = legendCounts.value
  let total = 0
  for (const [label, cnt] of Object.entries(counts)) {
    if (!shownSet.has(label)) {
      total += cnt
    }
  }
  return total
})

// ═══════════════════════════════════════════════════════════════════════════
// LEGEND COUNTS (for abundance sorting and display)
// Counts features by the current colorBy attribute (subspecies, species, genus, etc.)
// ═══════════════════════════════════════════════════════════════════════════

const legendCounts = computed(() => {
  const geo = dataStore.displayGeoJSON
  if (!geo?.features) return {}
  const attr = dataStore.colorByAttribute
  const hidden = new Set(legendStore.hiddenItems)
  const counts = {}
  for (const feature of geo.features) {
    const val = feature.properties[attr]
    if (val && val !== 'Unknown' && val !== 'NA' && !hidden.has(val)) {
      counts[val] = (counts[val] || 0) + 1
    }
  }
  return counts
})

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-SIZING
// ═══════════════════════════════════════════════════════════════════════════

// Measure text width using a hidden DOM element (matches actual CSS font rendering)
let _measureSpan = null
function measureTextWidth(text, fontSizePx) {
  if (!_measureSpan) {
    _measureSpan = document.createElement('span')
    _measureSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-style:italic;pointer-events:none;top:-9999px;left:-9999px;'
    document.body.appendChild(_measureSpan)
  }
  _measureSpan.style.fontSize = fontSizePx + 'px'
  _measureSpan.textContent = text
  return _measureSpan.getBoundingClientRect().width
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
      // Include group header text
      if (legendStore.groupingSettings.showHeaders || legendStore.isNonTaxonomyGroupBy) {
        labels.push(group.name)
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

  const maxContainerWidth = containerBounds.value.width * 0.25
  const fontSizePx = Math.round(14 * legendStore.textScale)

  let maxTextWidth = 0
  for (const label of labels) {
    const width = measureTextWidth(label, fontSizePx)
    if (width > maxTextWidth) maxTextWidth = width
  }

  // Add dot size + gap + padding + extra margin
  const dotSz = Math.max(6, Math.min(16, dataStore.mapStyle.pointSize))
  const padding = 16 * 2 // left + right content padding
  const gap = 8
  const scrollbarWidth = 8
  const extraMargin = 12

  const idealWidth = maxTextWidth + dotSz + gap + padding + scrollbarWidth + extraMargin

  return Math.min(Math.max(Math.ceil(idealWidth), 150), maxContainerWidth, 600)
})

// Max legend height based on container (80% of map height) — hard cap for resize
const maxLegendHeight = computed(() => {
  return Math.floor(containerBounds.value.height * 0.80)
})

// Target height for auto-sizing (smaller than the hard cap to avoid giant legends)
const targetLegendHeight = computed(() => {
  return Math.floor(containerBounds.value.height * 0.75)
})

// Generous upper-bound: how many items COULD fit (deliberately over-estimates).
// The actual count is determined by post-render DOM measurement.
const renderUpperBound = computed(() => {
  const minItemHeight = 22 // smallest possible: fontSize(14) + padding(4+4)
  const gap = 2
  const titleHeight = 32
  const padding = 24
  const moreReserve = 40

  let availableHeight
  if (isResizing.value && resizeOverride.value) {
    availableHeight = resizeOverride.value.height
  } else if (!isAutoHeight.value) {
    availableHeight = currentHeight.value || targetLegendHeight.value
  } else {
    availableHeight = targetLegendHeight.value
  }

  const available = availableHeight - titleHeight - padding - moreReserve
  return Math.max(1, Math.ceil(available / (minItemHeight + gap)))
})

// Post-render measured count (null = not yet measured, use upper bound)
const measuredItemCount = ref(null)

// The actual item limit: measured value when available, upper bound otherwise
const effectiveMaxItems = computed(() => {
  if (isResizing.value) return renderUpperBound.value
  if (measuredItemCount.value !== null) return measuredItemCount.value
  return renderUpperBound.value
})

// Calculate auto height from content.
// Before measurement: use full target height so container is large enough
// for measureAndTrimItems() to find the real cutoff.
// After measurement: if items were trimmed (overflow), keep full target height
// so the container doesn't shrink due to inaccurate per-item estimates.
// Only shrink-to-fit when ALL items fit (small data set).
const autoHeight = computed(() => {
  if (measuredItemCount.value === null) {
    return targetLegendHeight.value
  }
  // Items were trimmed → keep full target height (don't shrink)
  if (measuredItemCount.value < sortedAllItems.value.length) {
    return targetLegendHeight.value
  }
  // All items fit → size to content (estimate is fine for small counts)
  const fontSizePx = Math.round(14 * legendStore.textScale)
  const titleHeight = 32
  const padding = 24
  const itemCount = sortedAllItems.value.length
  const itemHeight = fontSizePx + 10 + 2
  const idealHeight = titleHeight + (itemCount * itemHeight) + padding
  return Math.min(Math.max(Math.ceil(idealHeight), 80), targetLegendHeight.value)
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

// Max resize width (45% of container for manual, more generous than auto's 25%)
const maxResizeWidth = computed(() => {
  return Math.min(Math.round(containerBounds.value.width * 0.45), 600)
})

// Multi-directional resize (composable handles all mouse/touch events)
const { isResizing, resizeOverride, startResize, startResizeTouch } = useElementResize(legendRef, {
  getPosition: () => ({ x: posX.value, y: posY.value ?? 0 }),
  getLimits: () => ({ minW: 150, maxW: maxResizeWidth.value, minH: 100, maxH: maxLegendHeight.value }),
  onEnd: ({ x, y, width, height }) => {
    posX.value = x
    posY.value = y
    currentWidth.value = width
    currentHeight.value = height
    legendStore.updateSize(width, height)
    legendStore.updatePosition(x, y)
    detectStickyEdges()
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// POST-RENDER DOM MEASUREMENT (render-then-measure pattern)
// Instead of estimating item heights, we render a generous number of items
// with overflow:hidden, then measure the actual DOM to find the exact cutoff.
// ═══════════════════════════════════════════════════════════════════════════

function measureAndTrimItems() {
  const contentEl = contentRef.value
  if (!contentEl || isResizing.value) return

  const itemsEl = contentEl.querySelector('.legend-items')
  if (!itemsEl || !itemsEl.children.length) return

  const contentBottom = contentEl.getBoundingClientRect().top + contentEl.clientHeight
  const contentPaddingBottom = 12
  const moreIndicatorReserve = 40

  const children = itemsEl.children
  const totalSorted = sortedAllItems.value.length

  console.log('[Legend measure]', {
    childrenInDOM: children.length,
    totalSorted,
    contentClientHeight: Math.round(contentEl.clientHeight),
    renderUpperBound: renderUpperBound.value,
    prevMeasured: measuredItemCount.value,
    containerH: containerBounds.value.height,
    targetH: targetLegendHeight.value
  })

  // Check if ALL items fit without needing "+N more"
  const lastChild = children[children.length - 1]
  if (children.length >= totalSorted &&
      lastChild.getBoundingClientRect().bottom <= contentBottom - contentPaddingBottom) {
    if (measuredItemCount.value !== totalSorted) {
      measuredItemCount.value = totalSorted
    }
    console.log('[Legend measure] all fit:', totalSorted)
    return
  }

  // Not all fit — reserve space for "+N more" and find cutoff
  const maxBottom = contentBottom - contentPaddingBottom - moreIndicatorReserve
  let count = 0
  for (let i = 0; i < children.length; i++) {
    if (children[i].getBoundingClientRect().bottom > maxBottom) break
    count++
  }

  count = Math.max(1, count)
  if (count !== measuredItemCount.value) {
    measuredItemCount.value = count
  }
  console.log('[Legend measure] result:', count, '| maxBottom:', Math.round(maxBottom - contentEl.getBoundingClientRect().top))
}

// Initial measurement: when contentRef first becomes a DOM element
// (legend appears via v-if after data loads), trigger the first measurement.
watch(contentRef, (el, oldEl) => {
  if (el && !oldEl) {
    nextTick(() => measureAndTrimItems())
  }
})

// Re-measure when layout-affecting settings change
watch([() => legendStore.wrapLabels, () => legendStore.textScale, () => legendStore.showCounts], () => {
  measuredItemCount.value = null
  nextTick(() => measureAndTrimItems())
})

// Re-measure when data changes (new items, filters applied, colorBy changed)
// NOTE: effectiveWidth is NOT watched here — it depends transitively on
// measuredItemCount (via legendItems → autoWidth), which would create an
// infinite reactive loop.
watch(sortedAllItems, () => {
  measuredItemCount.value = null
  nextTick(() => measureAndTrimItems())
})

// Re-measure after resize ends
watch(isResizing, (resizing) => {
  if (!resizing) {
    measuredItemCount.value = null
    nextTick(() => measureAndTrimItems())
  }
})

// Scaled sizes
const dotSize = computed(() => Math.max(6, Math.min(16, dataStore.mapStyle.pointSize)))
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

  // Height - always set explicit height so the container has a known size
  // for measureAndTrimItems(). In auto mode, autoHeight returns targetLegendHeight
  // before measurement (giving room to measure) and the exact fit after.
  const h = effectiveHeight.value
  if (h && h !== 'auto') {
    style.height = h + 'px'
  }

  return style
})

// ═══════════════════════════════════════════════════════════════════════════
// HOVER HANDLING (Lock content height to prevent growing when headers appear)
// ═══════════════════════════════════════════════════════════════════════════

function handleMouseEnter() {
  isHovered.value = true
}

function handleMouseLeave() {
  isHovered.value = false
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

function openGroupStylePopup(groupName, event) {
  const rect = event.target.getBoundingClientRect()
  const pos = computePopupPosition(rect, {
    placement: 'bottom',
    offset: 5,
    popupWidth: 280,
    popupHeight: 400
  })
  stylePopupState.value = {
    open: true,
    groupName,
    position: {
      x: parseInt(pos.left),
      y: parseInt(pos.top)
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

const sortOptions = [
  { by: 'alphabetical', order: 'asc', icon: ArrowUpAZ, label: 'A \u2192 Z' },
  { by: 'alphabetical', order: 'desc', icon: ArrowDownZA, label: 'Z \u2192 A' },
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

  // Apply format to all groups
  for (const groupName of groupList.value) {
    const formatted = applyAbbreviationFormat(groupName, format)
    if (format === 'none') {
      legendStore.setSpeciesAbbreviation(groupName, '')
    } else {
      legendStore.setSpeciesAbbreviation(groupName, formatted)
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

  // Setup legend resize observer for bottom-sticky repositioning
  setTimeout(() => {
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

// (Auto-sizing is handled by overflow:hidden on .legend-content,
// combined with post-render DOM measurement in measureAndTrimItems.)

// Sync shown labels to the store so the map can grey out overflow items.
// During resize, defer the sync to avoid rebuilding the map layer on every frame.
watch(legendItems, (items) => {
  if (isResizing.value) return // Defer — will sync when resize ends
  const labels = new Set()
  for (const item of items) {
    if (item.visible !== false) labels.add(item.label)
  }
  legendStore.setShownLabels(labels)
}, { immediate: true })

// When resize ends, sync the final shown labels to trigger one map update
watch(isResizing, (resizing) => {
  if (!resizing) {
    const items = legendItems.value
    const labels = new Set()
    for (const item of items) {
      if (item.visible !== false) labels.add(item.label)
    }
    legendStore.setShownLabels(labels)
  }
})

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
              :count="legendStore.showCounts ? (legendCounts[item.label] || 0) : null"
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
    <template v-if="showToolbar && !isExportMode">
      <div v-for="dir in resizeDirections" :key="dir"
           :class="['resize-zone', `resize-${dir}`]"
           @mousedown.stop.prevent="startResize($event, dir)"
           @touchstart.stop="startResizeTouch($event, dir)">
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

<style scoped>
.legend-container {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-overlay, rgba(26, 26, 46, 0.95));
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  z-index: 25; /* Above search bar (10) and map controls (20) so toolbar overlaps them */
  min-width: 150px;
  max-width: 600px;
  min-height: 80px;
  /* max-height is set dynamically via positionStyle */
  overflow: visible; /* Allow toolbar to float above and resize zones to extend beyond edges */
  box-shadow: 0 2px 10px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(4px);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  user-select: none;
  cursor: grab; /* Indicate draggable */
}

.legend-container.is-hovered:not(.is-export) {
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
}

/* Invisible hover bridge above legend — keeps mouse "inside" the container
   when crossing the gap between legend and floating toolbar */
.legend-container::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: -1px;
  right: -1px;
  height: 10px; /* Covers the 2px gap plus toolbar overlap */
  pointer-events: auto;
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
  overflow: hidden;
  /* flex-basis: auto so the container sizes to content, then max-height caps it.
     flex-basis: 0% (from flex:1) would collapse the container without explicit height. */
  flex: 1 1 auto;
  min-height: 0;
  /* Flex column so .legend-more can use margin-top:auto to fill empty space */
  display: flex;
  flex-direction: column;
}

.legend-container.is-export .legend-content {
  padding: 10px 14px;
}

.legend-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  gap: 6px;
  font-style: italic;
  color: var(--color-text-muted, #666);
  padding-top: 8px;
  margin-top: auto;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.more-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
  flex-shrink: 0;
}

.more-count {
  margin-left: auto;
  font-style: normal;
  font-size: 0.85em;
  opacity: 0.6;
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
  touch-action: none;
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
