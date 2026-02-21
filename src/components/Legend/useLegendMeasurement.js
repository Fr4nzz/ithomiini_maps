// Legend auto-sizing and DOM measurement logic
// Extracted from Legend.vue for maintainability
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
  // In cross-group mode, the number of DOM items that physically fit.
  // Used by Cap 2 in groupedLegendData to limit groups more accurately
  // than the height-based renderUpperBound estimate.
  const measuredGroupSlots = ref(null)

  let containerResizeRemeasureTimeout = null
  let pendingMeasurementRAF = null

  // ── Overflow correction state ─────────────────────────────────────────

  let overflowCorrectionPending = false
  let correctionGeneration = 0
  let lastCorrectionDir = null
  let expandReverted = false
  let correctionSteps = 0

  function resetCorrectionState() {
    lastCorrectionDir = null
    expandReverted = false
    correctionSteps = 0
    binarySearchActive = false
    lastGapBeforeExpand = 0
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

    // Always invalidate pending corrections when starting a new measurement
    // cycle. Without this, a stale overflowCorrectionPending=true from a
    // previous cycle blocks scheduleOverflowCorrection() in the new cycle.
    overflowCorrectionPending = false
    resetCorrectionState()

    if (resetState) {
      prevMeasuredCount.value = fullReset ? null : measuredItemCount.value
      measuredItemCount.value = null
      measuredSnugHeight.value = null
      measuredGroupSlots.value = null
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
    // nextTick waits for Vue to flush reactive updates and update the DOM,
    // then rAF ensures browser layout is complete before measuring.
    nextTick(() => {
      requestAnimationFrame(() => {
        overflowCorrectionPending = false
        if (gen !== correctionGeneration) return
        correctOverflow()
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

  // Detect actual scrollbar presence (more reliable than scrollHeight check
  // for small overflow amounts that may be within subpixel tolerance)
  function hasScrollbar(el) {
    return el.scrollHeight > el.clientHeight + 1
  }

  // After a failed expand, try a "re-measure from scratch" approach:
  // the initial measurement used renderUpperBound which may have been too
  // generous or too conservative. Do a fresh binary-search-like measurement.
  // After a failed expand, try a "binary search" approach to find the true
  // maximum. This handles grouped views where adding 1 item can trigger
  // a new group header that takes extra space.
  let binarySearchActive = false
  let binaryLo = 0
  let binaryHi = 0
  let binaryBest = 0
  let lastGapBeforeExpand = 0  // gap measured before last expand attempt

  function correctOverflow() {
    const el = contentRef.value
    if (!el || isResizing.value || legendStore.isManualMode) return

    correctionSteps++
    const overflow = el.scrollHeight - el.clientHeight
    const scrollbarVisible = hasScrollbar(el)
    const totalItems = sortedAllItems.value.length
    const unusedSpace = measureVisualGap(el)

    // Helper: get/set the value being adjusted (slots for cross-group, item count otherwise)
    const isCGC = measuredGroupSlots.value !== null
    const getVal = () => isCGC ? measuredGroupSlots.value : measuredItemCount.value
    const setVal = (v) => { if (isCGC) measuredGroupSlots.value = v; else measuredItemCount.value = v }
    const maxVal = isCGC ? renderUpperBound.value : totalItems
    const suffix = isCGC ? ' slots' : `/${totalItems}`

    // Safety: cap correction steps to avoid infinite loops
    if (correctionSteps > 20) {
      if (overflow > 2 || scrollbarVisible) {
        if (binarySearchActive && binaryBest > 0) {
          setVal(binaryBest)
        } else if (getVal() > 1) {
          setVal(getVal() - 1)
        }
      }
      binarySearchActive = false
      expandReverted = true
      console.log(`[Legend] correction BAIL after ${correctionSteps} steps → ${getVal()}${suffix}`)
      correctionSteps = 0
      updateSnugHeightFromDOM()
      return
    }

    // ── Binary search mode ──────────────────────────────────────────
    if (binarySearchActive) {
      if (overflow > 2 || scrollbarVisible) {
        binaryHi = getVal() - 1
        console.log(`[Legend] correction#${correctionSteps} BSEARCH overflow → hi=${binaryHi} (${overflow}px)`)
      } else {
        binaryBest = getVal()
        if (unusedSpace > 20 && getVal() < maxVal) {
          binaryLo = getVal() + 1
          console.log(`[Legend] correction#${correctionSteps} BSEARCH fits → lo=${binaryLo} best=${binaryBest} (${Math.round(unusedSpace)}px gap)`)
        } else {
          binaryLo = binaryHi + 1  // Force exit
        }
      }

      if (binaryLo <= binaryHi) {
        setVal(Math.floor((binaryLo + binaryHi) / 2))
        console.log(`[Legend] correction#${correctionSteps} BSEARCH try ${getVal()} [${binaryLo}..${binaryHi}]${isCGC ? ' slots' : ''}`)
        scheduleOverflowCorrection()
        return
      }

      binarySearchActive = false
      expandReverted = true
      if (binaryBest !== getVal()) {
        setVal(binaryBest)
        console.log(`[Legend] correction#${correctionSteps} BSEARCH done → ${binaryBest}${suffix}`)
        scheduleOverflowCorrection()
        return
      }
      // Fall through to SETTLED
    }

    // ── Normal correction ───────────────────────────────────────────

    // In cross-group mode, overflow is caused by too many groups, not too
    // many unique items. Adjust measuredGroupSlots (which Cap 2 uses to
    // limit groups) instead of measuredItemCount.
    const isCrossGroupCorrection = measuredGroupSlots.value !== null

    if (overflow > 2 || scrollbarVisible) {
      // Content overflows — reduce
      if (lastCorrectionDir === 'expand') {
        // Just expanded and it overflowed — revert
        if (isCrossGroupCorrection) {
          measuredGroupSlots.value--
        } else {
          measuredItemCount.value--
        }
        lastCorrectionDir = null

        // Use the gap we measured BEFORE the expand (not current, which is post-overflow).
        // If the pre-expand gap was large, this means adding +1 item caused a big
        // structural change (e.g. new group header in grouped view). Use binary search
        // to find the optimal count by skipping over the "bad" counts.
        const currentVal = isCrossGroupCorrection ? measuredGroupSlots.value : measuredItemCount.value
        const maxVal = isCrossGroupCorrection ? renderUpperBound.value : totalItems
        if (lastGapBeforeExpand > 60 && currentVal + 2 <= maxVal) {
          binarySearchActive = true
          binaryLo = currentVal + 2  // +1 already failed
          binaryHi = Math.min(maxVal, currentVal + Math.ceil(lastGapBeforeExpand / 20))
          binaryBest = currentVal
          console.log(`[Legend] correction#${correctionSteps} REVERT+BSEARCH → ${currentVal}/${maxVal}${isCrossGroupCorrection ? ' slots' : ''} (pre-expand gap=${Math.round(lastGapBeforeExpand)}px, searching [${binaryLo}..${binaryHi}])`)
          if (isCrossGroupCorrection) {
            measuredGroupSlots.value = Math.floor((binaryLo + binaryHi) / 2)
          } else {
            measuredItemCount.value = Math.floor((binaryLo + binaryHi) / 2)
          }
          scheduleOverflowCorrection()
          return
        }

        expandReverted = true
        console.log(`[Legend] correction#${correctionSteps} REVERT → ${currentVal}/${maxVal}${isCrossGroupCorrection ? ' slots' : ''} (expand caused ${overflow}px overflow)`)
        scheduleOverflowCorrection()
        return
      }
      if (isCrossGroupCorrection && measuredGroupSlots.value > 1) {
        measuredGroupSlots.value--
        lastCorrectionDir = 'reduce'
        console.log(`[Legend] correction#${correctionSteps} REDUCE-SLOTS → ${measuredGroupSlots.value} slots (${overflow}px overflow, scrollbar=${scrollbarVisible})`)
        scheduleOverflowCorrection()
      } else if (measuredItemCount.value !== null && measuredItemCount.value > 1) {
        measuredItemCount.value--
        lastCorrectionDir = 'reduce'
        console.log(`[Legend] correction#${correctionSteps} REDUCE → ${measuredItemCount.value}/${totalItems} (${overflow}px overflow, scrollbar=${scrollbarVisible})`)
        scheduleOverflowCorrection()
      }
      return
    }

    // No overflow — check if we can fit more
    const canExpand = isCrossGroupCorrection
      ? (measuredGroupSlots.value < renderUpperBound.value)
      : (measuredItemCount.value !== null && measuredItemCount.value < totalItems)
    if (!expandReverted && canExpand && unusedSpace > 20) {
      lastGapBeforeExpand = unusedSpace  // save gap for potential REVERT+BSEARCH
      if (isCrossGroupCorrection) {
        measuredGroupSlots.value++
        console.log(`[Legend] correction#${correctionSteps} EXPAND-SLOTS → ${measuredGroupSlots.value} slots (${Math.round(unusedSpace)}px gap)`)
      } else {
        measuredItemCount.value++
        console.log(`[Legend] correction#${correctionSteps} EXPAND → ${measuredItemCount.value}/${totalItems} (${Math.round(unusedSpace)}px gap)`)
      }
      lastCorrectionDir = 'expand'
      scheduleOverflowCorrection()
      return
    }

    // Converged — log final state
    const sizeMode = `${isAutoWidth.value ? 'auto' : 'manual'}/${isAutoHeight.value ? 'auto' : 'manual'}`
    const slotsInfo = measuredGroupSlots.value !== null ? ` slots=${measuredGroupSlots.value}` : ''
    console.log(`[Legend] SETTLED ${measuredItemCount.value}/${totalItems} items${slotsInfo} | ${sizeMode} ${Math.round(effectiveWidth.value)}×${el.clientHeight} | gap=${Math.round(unusedSpace)}px scroll=${overflow}px steps=${correctionSteps}`)
    correctionSteps = 0
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

    // Debug: detect cross-group DOM mismatch (items in multiple groups)
    const groupEls = isGroupedView ? itemsEl.querySelectorAll('.legend-group') : []
    if (groupEls.length > 0 && measurableItems.length !== totalSorted) {
      console.debug(`[Legend] DOM: ${measurableItems.length} items in ${groupEls.length} groups (${totalSorted} unique) grouped=${isGroupedView}`)
    }

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

    // Check if ALL items fit.
    // Skip this shortcut in cross-group mode (DOM items >> unique items),
    // because setting measuredItemCount=totalSorted may cause a different
    // number of groups to render, changing the DOM significantly.
    const lastItem = measurableItems[measurableItems.length - 1]
    const lastItemBottom = lastItem.getBoundingClientRect().bottom
    const allFitBoundary = contentBottom - contentPaddingBottom
    const isCrossGroup = measurableItems.length > totalSorted * 1.5

    // Clear cross-group slot limit when not in cross-group mode
    if (!isCrossGroup && measuredGroupSlots.value !== null) {
      measuredGroupSlots.value = null
    }

    if (!isCrossGroup &&
        measurableItems.length >= totalSorted &&
        lastItemBottom <= allFitBoundary) {
      if (measuredItemCount.value !== totalSorted) {
        measuredItemCount.value = totalSorted
      }
      measuredSnugHeight.value = computeSnugHeight(lastItem, false)
      console.log(`[Legend] ALL_FIT ${totalSorted} items | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→snug${measuredSnugHeight.value} | ${logContext()}`)
      scheduleOverflowCorrection()
      return
    }

    // Small item counts (≤ 5) — try fitting all without "+N more"
    if (!isCrossGroup && totalSorted <= 5 && measurableItems.length >= totalSorted) {
      const lastOfAll = measurableItems[measurableItems.length - 1]
      if (lastOfAll && lastOfAll.getBoundingClientRect().bottom <= contentBottom) {
        if (measuredItemCount.value !== totalSorted) {
          measuredItemCount.value = totalSorted
        }
        measuredSnugHeight.value = computeSnugHeight(lastOfAll, false)
        console.log(`[Legend] SMALL_FIT ${totalSorted} items | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→snug${measuredSnugHeight.value} | ${logContext()}`)
        scheduleOverflowCorrection()
        return
      }
    }

    // Not all fit — find cutoff. First try without "+N more" reserve to see
    // if N+1 items fit (saves space vs showing "+1 more" which wastes ~40px).
    const maxBottomWithMore = contentBottom - contentPaddingBottom - moreIndicatorReserve
    const maxBottomWithoutMore = contentBottom - contentPaddingBottom
    let domFitCount = 0
    let domFitCountNoMore = 0  // items that fit if we skip "+N more"
    for (let i = 0; i < measurableItems.length; i++) {
      const itemBottom = measurableItems[i].getBoundingClientRect().bottom
      if (itemBottom <= maxBottomWithMore) domFitCount = i + 1
      if (itemBottom <= maxBottomWithoutMore) domFitCountNoMore = i + 1
    }
    domFitCount = Math.max(1, domFitCount)

    // Multi-group DOM→unique item count translation
    let count = domFitCount
    let countNoMore = domFitCountNoMore
    if (isCrossGroup) {
      // In cross-group mode (items appear in multiple groups), proportional
      // translation is inaccurate because the DOM↔unique relationship is
      // non-linear. Show all unique items and let Cap 2 in groupedLegendData
      // limit the number of groups to fit the available height.
      count = totalSorted
      countNoMore = totalSorted
      // Tell Cap 2 the actual number of DOM items that fit, so it can limit
      // groups accurately instead of using the generous renderUpperBound.
      measuredGroupSlots.value = domFitCount
    } else if (measurableItems.length > totalSorted) {
      if (domFitCount < measurableItems.length) {
        count = Math.max(1, Math.floor(domFitCount * totalSorted / measurableItems.length))
      }
      countNoMore = Math.max(1, Math.floor(domFitCountNoMore * totalSorted / measurableItems.length))
    }

    // If skipping "+N more" would only leave 1-2 items hidden, AND those items
    // physically fit without the more indicator, use the higher count.
    // The "+N more" indicator itself takes ~40px which often fits 1-2 items.
    // Use translated counts (not raw DOM counts) so cross-group mode is handled.
    const hiddenWithoutMore = totalSorted - countNoMore
    if (!isCrossGroup && hiddenWithoutMore <= 2 && countNoMore >= totalSorted) {
      count = totalSorted
      measuredSnugHeight.value = computeSnugHeight(measurableItems[measurableItems.length - 1], false)
      console.log(`[Legend] TIGHT_FIT ${count}/${totalSorted} items (no +more needed) | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→snug${measuredSnugHeight.value} | ${logContext()}`)
      if (count !== measuredItemCount.value) {
        measuredItemCount.value = count
      }
      scheduleOverflowCorrection()
      return
    }

    measuredSnugHeight.value = computeSnugHeight(measurableItems[domFitCount - 1], true)

    const domInfo = isCrossGroup ? ` dom=${domFitCount}/${measurableItems.length} cross-group` : (measurableItems.length > totalSorted ? ` dom=${domFitCount}/${measurableItems.length}` : '')
    console.log(`[Legend] OVERFLOW ${count}/${totalSorted} | ${sizeMode} ${Math.round(effectiveWidth.value)}×${contentEl.clientHeight}→snug${measuredSnugHeight.value || '?'}${domInfo} | ${logContext()}`)
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
    measuredGroupSlots,
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
