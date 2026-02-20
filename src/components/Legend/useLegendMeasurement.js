// Legend auto-sizing and DOM measurement logic
// Extracted from Legend.vue for maintainability (~400 lines)
//
// Implements the "render-then-measure" pattern:
// 1. Render a generous upper-bound of items with overflow:hidden
// 2. Measure actual DOM to find exact cutoff
// 3. Bidirectional convergence loop corrects over/under-estimation

import { ref, computed, nextTick } from 'vue'

/**
 * Composable for legend measurement and auto-sizing
 * @param {Object} params
 * @param {import('vue').Ref} params.legendRef - Template ref to legend container
 * @param {import('vue').Ref} params.contentRef - Template ref to legend content area
 * @param {import('vue').ComputedRef} params.containerBounds - Container dimensions
 * @param {import('vue').ComputedRef} params.isAutoWidth - Whether width is auto
 * @param {import('vue').ComputedRef} params.isAutoHeight - Whether height is auto
 * @param {import('vue').Ref} params.currentWidth - Current manual width
 * @param {import('vue').Ref} params.currentHeight - Current manual height
 * @param {import('vue').ComputedRef} params.isResizing - Whether resize is active
 * @param {import('vue').ComputedRef} params.resizeOverride - Resize override dimensions
 * @param {import('vue').ComputedRef} params.sortedAllItems - All sorted legend items
 * @param {import('vue').ComputedRef} params.legendCounts - Item count map
 * @param {Object} params.legendStore - Legend Pinia store
 * @param {Object} params.dataStore - Data Pinia store
 */
export function useLegendMeasurement({
  legendRef, contentRef, containerBounds,
  isAutoWidth, isAutoHeight, currentWidth, currentHeight,
  isResizing, resizeOverride, sortedAllItems, legendCounts,
  legendStore, dataStore
}) {
  // ── Text measurement ──────────────────────────────────────────────────
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

  function cleanupMeasureSpan() {
    if (_measureSpan) {
      _measureSpan.remove()
      _measureSpan = null
    }
  }

  // ── Auto-width ────────────────────────────────────────────────────────
  // Uses ALL sorted items' labels (not just displayed ones) so autoWidth is
  // stable across measurement changes.
  const autoWidth = computed(() => {
    const items = sortedAllItems.value
    if (!items.length) return 200

    const maxContainerWidth = containerBounds.value.width * 0.30
    const fontSizePx = Math.round(14 * legendStore.textScale)
    const isGrouped = legendStore.isGrouped

    let maxTextWidth = 0
    for (const item of items) {
      const label = item.displayLabel || item.label
      const width = measureTextWidth(label, fontSizePx)
      if (width > maxTextWidth) {
        maxTextWidth = width
      }
    }

    const dotSz = Math.max(6, Math.min(16, dataStore.mapStyle.pointSize))
    const padding = 16 * 2
    const gap = 8
    const safetyMargin = 4
    const indentation = isGrouped ? 20 : 0

    let countWidth = 0
    if (legendStore.showCounts) {
      const counts = legendCounts.value
      let maxCount = 0
      for (const item of items) {
        const c = counts[item.label] || 0
        if (c > maxCount) maxCount = c
      }
      const countFontSize = fontSizePx - 2
      countWidth = measureTextWidth(maxCount.toLocaleString(), countFontSize) + 8
    }

    const idealWidth = maxTextWidth + dotSz + gap + padding + indentation + countWidth + safetyMargin
    return Math.min(Math.max(Math.ceil(idealWidth), 200), maxContainerWidth, 600)
  })

  // ── Height computations ───────────────────────────────────────────────

  const maxLegendHeight = computed(() => {
    return Math.floor(containerBounds.value.height * 0.80)
  })

  const targetLegendHeight = computed(() => {
    return Math.floor(containerBounds.value.height * 0.75)
  })

  // ── Render upper bound ────────────────────────────────────────────────
  // Generous over-estimate of how many items COULD fit. Actual count is
  // determined by post-render DOM measurement.
  const renderUpperBound = computed(() => {
    const minItemHeight = 22
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
    const estimate = Math.max(1, Math.ceil(available / (minItemHeight + gap)))

    const total = sortedAllItems.value.length
    if (total <= 20) return Math.max(estimate, total)
    return estimate
  })

  // ── Measurement state ─────────────────────────────────────────────────

  const measuredItemCount = ref(null)
  const measuredSnugHeight = ref(null)
  const prevMeasuredCount = ref(null)

  let containerResizeRemeasureTimeout = null
  let pendingMeasurementRAF = null

  // ── Overflow correction state ─────────────────────────────────────────

  let overflowCorrectionPending = false
  let correctionGeneration = 0
  let lastCorrectionDir = null
  let expandReverted = false

  function resetCorrectionState() {
    lastCorrectionDir = null
    expandReverted = false
    correctionGeneration++
  }

  // ── effectiveMaxItems ─────────────────────────────────────────────────
  // The actual item limit: measured value when available, upper bound otherwise

  const effectiveMaxItems = computed(() => {
    if (legendStore.isManualMode) return legendStore.maxItemsManual

    if (isResizing.value) {
      return renderUpperBound.value
    } else if (measuredItemCount.value !== null) {
      return measuredItemCount.value
    } else if (prevMeasuredCount.value !== null) {
      return prevMeasuredCount.value
    } else {
      return renderUpperBound.value
    }
  })

  // ── Scheduling ────────────────────────────────────────────────────────

  /**
   * Schedule a full measurement cycle. Uses double-rAF for accurate layout.
   * @param {boolean} resetState - true → reset measuredItemCount
   * @param {string} source - label for debug logging
   * @param {boolean} fullReset - also clear prevMeasuredCount
   */
  function scheduleMeasurement(resetState = true, source = '', fullReset = false) {
    if (pendingMeasurementRAF !== null) {
      cancelAnimationFrame(pendingMeasurementRAF)
      pendingMeasurementRAF = null
    }
    if (containerResizeRemeasureTimeout) {
      clearTimeout(containerResizeRemeasureTimeout)
      containerResizeRemeasureTimeout = null
    }
    if (legendStore.isManualMode) return
    if (resetState) {
      prevMeasuredCount.value = fullReset ? null : measuredItemCount.value
      measuredItemCount.value = null
      measuredSnugHeight.value = null
      resetCorrectionState()
    }
    console.debug(`[Legend] scheduleMeasurement(reset=${resetState}${fullReset ? ',full' : ''}) from: ${source || 'unknown'}`)
    pendingMeasurementRAF = requestAnimationFrame(() => {
      pendingMeasurementRAF = requestAnimationFrame(() => {
        pendingMeasurementRAF = null
        measureAndTrimItems()
      })
    })
  }

  function scheduleContainerResizeMeasurement() {
    if (containerResizeRemeasureTimeout) clearTimeout(containerResizeRemeasureTimeout)
    containerResizeRemeasureTimeout = setTimeout(() => {
      scheduleMeasurement(true, 'containerResize', true)
    }, 150)
  }

  // ── Overflow correction ───────────────────────────────────────────────

  function scheduleOverflowCorrection() {
    if (overflowCorrectionPending) return
    overflowCorrectionPending = true
    const gen = correctionGeneration
    nextTick(() => {
      nextTick(() => {
        requestAnimationFrame(() => {
          overflowCorrectionPending = false
          if (gen !== correctionGeneration) return
          correctOverflow()
        })
      })
    })
  }

  function measureVisualGap(contentEl) {
    const moreEl = contentEl.querySelector('.legend-more')
    const itemsEl = contentEl.querySelector('.legend-items')
    if (!itemsEl) return 0

    const lastItem = itemsEl.lastElementChild
    if (!lastItem) return 0
    const itemsBottom = lastItem.getBoundingClientRect().bottom

    if (moreEl) {
      const moreTop = moreEl.getBoundingClientRect().top
      return moreTop - itemsBottom
    } else {
      const contentBottom = contentEl.getBoundingClientRect().top + contentEl.clientHeight
      return contentBottom - itemsBottom
    }
  }

  function updateSnugHeightFromDOM() {
    const el = contentRef.value
    const legendEl = legendRef.value
    if (!el || !legendEl || !isAutoHeight.value) return

    const moreEl = el.querySelector('.legend-more')
    const itemsEl = el.querySelector('.legend-items')
    if (!itemsEl) return

    const lastContent = moreEl || itemsEl.lastElementChild
    if (!lastContent) return

    const legendTop = legendEl.getBoundingClientRect().top
    const lastBottom = lastContent.getBoundingClientRect().bottom
    const padding = 12
    const newSnug = Math.max(120, Math.ceil(lastBottom - legendTop + padding))

    if (measuredSnugHeight.value && Math.abs(newSnug - measuredSnugHeight.value) > 4) {
      measuredSnugHeight.value = newSnug
    }
  }

  function correctOverflow() {
    const el = contentRef.value
    if (!el || isResizing.value || legendStore.isManualMode) return

    const overflow = el.scrollHeight - el.clientHeight

    if (overflow > 4) {
      if (lastCorrectionDir === 'expand') {
        measuredItemCount.value--
        lastCorrectionDir = null
        expandReverted = true
        console.log(`[Legend] expand overflowed → reverted to ${measuredItemCount.value} items`)
        scheduleOverflowCorrection()
        return
      }
      if (measuredItemCount.value !== null && measuredItemCount.value > 1) {
        measuredItemCount.value--
        lastCorrectionDir = 'reduce'
        console.log(`[Legend] overflow correction: ${overflow}px over → reduced to ${measuredItemCount.value} items`)
        scheduleOverflowCorrection()
      }
      return
    }

    const unusedSpace = measureVisualGap(el)
    const totalItems = sortedAllItems.value.length

    if (!expandReverted &&
        measuredItemCount.value !== null &&
        measuredItemCount.value < totalItems &&
        unusedSpace > 20) {
      measuredItemCount.value++
      lastCorrectionDir = 'expand'
      console.log(`[Legend] expand: ${unusedSpace}px visual gap → trying ${measuredItemCount.value} items`)
      scheduleOverflowCorrection()
      return
    }

    lastCorrectionDir = null
    if (measuredItemCount.value !== null && measuredItemCount.value < totalItems) {
      console.log(`[Legend] converged: ${measuredItemCount.value}/${totalItems} items | gap=${unusedSpace}px`)
    }
    updateSnugHeightFromDOM()
  }

  // ── Log context ───────────────────────────────────────────────────────

  function logContext() {
    const parts = []
    parts.push(`colorBy=${dataStore.colorBy}`)
    if (legendStore.isGrouped) {
      parts.push(`groupBy=${legendStore.effectiveGroupBy}`)
    }
    const f = dataStore.filters
    const activeFilters = []
    if (f.species?.length) activeFilters.push(`species=${f.species.length}`)
    if (f.subspecies?.length) activeFilters.push(`subsp=${f.subspecies.length}`)
    if (f.mimicry?.length) activeFilters.push(`mimicry=${f.mimicry.length}`)
    if (f.status?.length) activeFilters.push(`status=${f.status.length}`)
    if (f.source?.length > 1 || (f.source?.length === 1 && f.source[0] !== 'Sanger Institute')) {
      activeFilters.push(`source=${f.source.join(',')}`)
    }
    if (f.genus !== 'All') activeFilters.push(`genus=${f.genus}`)
    if (f.country !== 'All') activeFilters.push(`country=${f.country}`)
    if (activeFilters.length) parts.push(`filters=[${activeFilters.join(' ')}]`)
    return parts.join(' ')
  }

  // ── Main measurement ──────────────────────────────────────────────────

  function measureAndTrimItems() {
    const contentEl = contentRef.value
    if (!contentEl || isResizing.value) return

    const itemsEl = contentEl.querySelector('.legend-items')
    if (!itemsEl || !itemsEl.children.length) return

    const contentRect = contentEl.getBoundingClientRect()
    const contentBottom = contentRect.top + contentEl.clientHeight
    const contentPaddingBottom = 12
    const moreIndicatorReserve = 40

    const isGroupedView = itemsEl.classList.contains('grouped')
    const allMeasurableItems = isGroupedView
      ? itemsEl.querySelectorAll('.legend-group-items > .legend-item')
      : itemsEl.children

    const measurableItems = [...allMeasurableItems].filter(el => !el.classList.contains('is-hidden'))

    const totalSorted = sortedAllItems.value.length
    const sizeMode = `${isAutoWidth.value ? 'auto' : 'manual'}/${isAutoHeight.value ? 'auto' : 'manual'}`

    if (!measurableItems.length) return

    function computeSnugHeight(lastItemEl, includeMoreIndicator) {
      const legendEl = legendRef.value
      if (!legendEl || !lastItemEl) return null
      const legendTop = legendEl.getBoundingClientRect().top
      const lastBottom = lastItemEl.getBoundingClientRect().bottom
      const extra = includeMoreIndicator
        ? moreIndicatorReserve + contentPaddingBottom
        : contentPaddingBottom
      return Math.max(120, Math.ceil(lastBottom - legendTop + extra))
    }

    // Check if ALL items fit
    const lastItem = measurableItems[measurableItems.length - 1]
    const lastItemBottom = lastItem.getBoundingClientRect().bottom
    const allFitBoundary = contentBottom - contentPaddingBottom

    if (measurableItems.length >= totalSorted &&
        lastItemBottom <= allFitBoundary) {
      if (measuredItemCount.value !== totalSorted) {
        measuredItemCount.value = totalSorted
      }
      measuredSnugHeight.value = computeSnugHeight(lastItem, false)
      console.log(`[Legend] ALL_FIT ${totalSorted} items | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→${measuredSnugHeight.value} | ${logContext()}`)
      scheduleOverflowCorrection()
      return
    }

    // Small item counts (≤ 5) — try fitting all without "+N more"
    if (totalSorted <= 5 && measurableItems.length >= totalSorted) {
      const lastOfAll = measurableItems[measurableItems.length - 1]
      if (lastOfAll && lastOfAll.getBoundingClientRect().bottom <= contentBottom) {
        if (measuredItemCount.value !== totalSorted) {
          measuredItemCount.value = totalSorted
        }
        measuredSnugHeight.value = computeSnugHeight(lastOfAll, false)
        console.log(`[Legend] SMALL_FIT ${totalSorted} items | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→${measuredSnugHeight.value} | ${logContext()}`)
        scheduleOverflowCorrection()
        return
      }
    }

    // Not all fit — reserve space for "+N more" and find cutoff
    const maxBottom = contentBottom - contentPaddingBottom - moreIndicatorReserve
    let domFitCount = 0
    for (let i = 0; i < measurableItems.length; i++) {
      const itemBottom = measurableItems[i].getBoundingClientRect().bottom
      if (itemBottom > maxBottom) break
      domFitCount++
    }
    domFitCount = Math.max(1, domFitCount)

    // Multi-group DOM→unique item count translation
    let count = domFitCount
    if (measurableItems.length > totalSorted && domFitCount < measurableItems.length) {
      count = Math.max(1, Math.floor(domFitCount * totalSorted / measurableItems.length))
    }

    measuredSnugHeight.value = computeSnugHeight(measurableItems[domFitCount - 1], true)

    const domInfo = measurableItems.length > totalSorted ? ` dom=${domFitCount}/${measurableItems.length}` : ''
    console.log(`[Legend] OVERFLOW ${count}/${totalSorted} | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→${measuredSnugHeight.value || '?'}${domInfo} | ${logContext()}`)
    if (count !== measuredItemCount.value) {
      measuredItemCount.value = count
    }
    scheduleOverflowCorrection()
  }

  // ── Derived computeds ─────────────────────────────────────────────────

  const autoHeight = computed(() => {
    if (measuredItemCount.value === null) {
      return targetLegendHeight.value
    }
    return measuredSnugHeight.value || targetLegendHeight.value
  })

  const effectiveWidth = computed(() => {
    return isAutoWidth.value ? autoWidth.value : (currentWidth.value || 200)
  })

  const effectiveHeight = computed(() => {
    return isAutoHeight.value ? autoHeight.value : currentHeight.value
  })

  const maxResizeWidth = computed(() => {
    return Math.min(Math.round(containerBounds.value.width * 0.45), 600)
  })

  // ── Cleanup ───────────────────────────────────────────────────────────

  function cleanup() {
    if (pendingMeasurementRAF !== null) cancelAnimationFrame(pendingMeasurementRAF)
    if (containerResizeRemeasureTimeout) clearTimeout(containerResizeRemeasureTimeout)
    cleanupMeasureSpan()
  }

  function resetToAutoSize() {
    if (!isAutoWidth.value || !isAutoHeight.value) {
      console.debug(`[Legend] resetToAutoSize (was ${currentWidth.value}x${currentHeight.value})`)
      currentWidth.value = null
      currentHeight.value = null
      legendStore.updateSize('auto', 'auto')
    }
  }

  return {
    // Refs
    measuredItemCount,
    measuredSnugHeight,
    prevMeasuredCount,

    // Computeds
    autoWidth,
    maxLegendHeight,
    targetLegendHeight,
    renderUpperBound,
    effectiveMaxItems,
    autoHeight,
    effectiveWidth,
    effectiveHeight,
    maxResizeWidth,

    // Functions
    measureTextWidth,
    scheduleMeasurement,
    scheduleContainerResizeMeasurement,
    resetToAutoSize,
    cleanup
  }
}
