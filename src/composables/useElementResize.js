import { ref } from 'vue'

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

/**
 * Multi-directional resize composable for an element.
 * Supports 8 directions (n, s, e, w, ne, nw, se, sw) with mouse and touch.
 *
 * @param {Ref} elementRef - Vue ref to the DOM element being resized
 * @param {Object} options
 * @param {() => {x: number, y: number}} options.getPosition - Returns current element position
 * @param {() => {minW: number, maxW: number, minH: number, maxH: number}} options.getLimits - Returns size limits
 * @param {(result: {x, y, width, height}) => void} options.onEnd - Called when resize completes with final values
 * @param {() => void} [options.onStart] - Called when resize begins
 * @returns {{ isResizing: Ref<boolean>, resizeOverride: Ref, startResize: Function, startResizeTouch: Function }}
 */
export function useElementResize(elementRef, options) {
  const isResizing = ref(false)
  const resizeOverride = ref(null)

  // Internal state (not exposed)
  const direction = ref(null)
  const startMouse = ref({ x: 0, y: 0 })
  const startSize = ref({ width: 0, height: 0 })
  const startPos = ref({ x: 0, y: 0 })

  function startResize(e, dir) {
    e.preventDefault()
    e.stopPropagation()

    isResizing.value = true
    direction.value = dir
    startMouse.value = { x: e.clientX, y: e.clientY }

    const el = elementRef.value
    if (el) {
      startSize.value = { width: el.offsetWidth, height: el.offsetHeight }
    }
    startPos.value = options.getPosition()
    options.onStart?.()

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', endDrag)
  }

  function onDrag(e) {
    if (!isResizing.value || !direction.value) return

    const dx = e.clientX - startMouse.value.x
    const dy = e.clientY - startMouse.value.y
    const dir = direction.value
    const { minW, maxW, minH, maxH } = options.getLimits()

    let w = startSize.value.width
    let h = startSize.value.height
    let x = startPos.value.x
    let y = startPos.value.y

    // Width: east grows right, west grows left (keeps right edge fixed)
    if (dir.includes('e')) {
      w = clamp(w + dx, minW, maxW)
    } else if (dir.includes('w')) {
      const pw = clamp(w - dx, minW, maxW)
      x += w - pw
      w = pw
    }

    // Height: south grows down, north grows up (keeps bottom edge fixed)
    if (dir.includes('s')) {
      h = clamp(h + dy, minH, maxH)
    } else if (dir.includes('n')) {
      const ph = clamp(h - dy, minH, maxH)
      y += h - ph
      h = ph
    }

    resizeOverride.value = { x, y, width: w, height: h }
  }

  function endDrag() {
    if (isResizing.value && resizeOverride.value) {
      options.onEnd(resizeOverride.value)
    }

    isResizing.value = false
    direction.value = null
    resizeOverride.value = null

    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', endDrag)
  }

  // Touch support
  function startResizeTouch(e, dir) {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      startResize({
        clientX: t.clientX,
        clientY: t.clientY,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation()
      }, dir)

      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onTouchEnd)
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 1 && isResizing.value) {
      onDrag({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
      e.preventDefault()
    }
  }

  function onTouchEnd() {
    endDrag()
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  }

  return { isResizing, resizeOverride, startResize, startResizeTouch }
}
