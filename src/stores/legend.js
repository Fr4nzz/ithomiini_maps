import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePersistenceStore } from './persistence'

// Helper to get/set localStorage with fallback (uses persistence store)
const getStorage = (key, defaultValue) => {
  const persistenceStore = usePersistenceStore()
  return persistenceStore.get(key, defaultValue)
}

const setStorage = (key, value) => {
  const persistenceStore = usePersistenceStore()
  persistenceStore.set(key, value)
}

export const useLegendStore = defineStore('legend', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // POSITION & SIZE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Position (x, y coordinates for free positioning)
  const position = ref(getStorage('legend-position', { x: 40, y: null }))

  // Size
  const size = ref(getStorage('legend-size', { width: 200, height: 'auto' }))

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  const showLegend = ref(true)
  const textScale = ref(getStorage('legend-text-scale', 1))
  const dotScale = ref(getStorage('legend-dot-scale', 1))
  const maxItems = ref(getStorage('legend-max-items', 15))

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  const stickyEdges = ref(getStorage('legend-sticky', true))
  const snapThreshold = ref(20) // pixels

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Custom labels (overrides for auto-generated labels)
  // Format: { 'originalLabel': 'customLabel' }
  const customLabels = ref(getStorage('legend-custom-labels', {}))

  // Custom colors (overrides for auto-generated colors)
  // Format: { 'label': '#hexcolor' }
  const customColors = ref(getStorage('legend-custom-colors', {}))

  // Hidden items (labels to hide from legend)
  const hiddenItems = ref(getStorage('legend-hidden-items', []))

  // Item order (for custom reordering, array of labels)
  const itemOrder = ref(getStorage('legend-item-order', []))

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if there are any customizations
  const hasCustomizations = computed(() => {
    return Object.keys(customLabels.value).length > 0 ||
           Object.keys(customColors.value).length > 0 ||
           hiddenItems.value.length > 0 ||
           itemOrder.value.length > 0
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function updatePosition(x, y) {
    position.value = { x, y }
    setStorage('legend-position', position.value)
  }

  function updateSize(width, height) {
    size.value = { width, height }
    setStorage('legend-size', size.value)
  }

  function setTextScale(scale) {
    textScale.value = scale
    setStorage('legend-text-scale', scale)
  }

  function setDotScale(scale) {
    dotScale.value = scale
    setStorage('legend-dot-scale', scale)
  }

  function setMaxItems(max) {
    maxItems.value = max
    setStorage('legend-max-items', max)
  }

  function setStickyEdges(enabled) {
    stickyEdges.value = enabled
    setStorage('legend-sticky', enabled)
  }

  function setCustomLabel(originalLabel, customLabel) {
    if (customLabel && customLabel !== originalLabel) {
      customLabels.value[originalLabel] = customLabel
    } else {
      // Remove custom label if it matches original or is empty
      delete customLabels.value[originalLabel]
    }
    setStorage('legend-custom-labels', customLabels.value)
  }

  function getDisplayLabel(originalLabel) {
    return customLabels.value[originalLabel] || originalLabel
  }

  function setCustomColor(label, color) {
    if (color) {
      customColors.value[label] = color
    } else {
      delete customColors.value[label]
    }
    setStorage('legend-custom-colors', customColors.value)
  }

  function getDisplayColor(label, defaultColor) {
    return customColors.value[label] || defaultColor
  }

  function toggleItemVisibility(label) {
    const index = hiddenItems.value.indexOf(label)
    if (index > -1) {
      hiddenItems.value.splice(index, 1)
    } else {
      hiddenItems.value.push(label)
    }
    setStorage('legend-hidden-items', hiddenItems.value)
  }

  function isItemVisible(label) {
    return !hiddenItems.value.includes(label)
  }

  function setItemOrder(order) {
    itemOrder.value = order
    setStorage('legend-item-order', order)
  }

  function resetCustomizations() {
    customLabels.value = {}
    customColors.value = {}
    hiddenItems.value = []
    itemOrder.value = []
    setStorage('legend-custom-labels', {})
    setStorage('legend-custom-colors', {})
    setStorage('legend-hidden-items', [])
    setStorage('legend-item-order', [])
  }

  function resetPosition() {
    position.value = { x: 40, y: null }
    setStorage('legend-position', position.value)
  }

  function resetSize() {
    size.value = { width: 200, height: 'auto' }
    setStorage('legend-size', size.value)
  }

  function resetAll() {
    resetCustomizations()
    resetPosition()
    resetSize()
    textScale.value = 1
    dotScale.value = 1
    maxItems.value = 15
    stickyEdges.value = true
    setStorage('legend-text-scale', 1)
    setStorage('legend-dot-scale', 1)
    setStorage('legend-max-items', 15)
    setStorage('legend-sticky', true)
  }

  return {
    // State
    position,
    size,
    showLegend,
    textScale,
    dotScale,
    maxItems,
    stickyEdges,
    snapThreshold,
    customLabels,
    customColors,
    hiddenItems,
    itemOrder,

    // Computed
    hasCustomizations,

    // Actions
    updatePosition,
    updateSize,
    setTextScale,
    setDotScale,
    setMaxItems,
    setStickyEdges,
    setCustomLabel,
    getDisplayLabel,
    setCustomColor,
    getDisplayColor,
    toggleItemVisibility,
    isItemVisible,
    setItemOrder,
    resetCustomizations,
    resetPosition,
    resetSize,
    resetAll
  }
})
