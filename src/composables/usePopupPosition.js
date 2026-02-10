/**
 * Shared popup positioning utility.
 * Calculates position for a popup relative to a trigger element,
 * ensuring it stays within viewport bounds.
 *
 * @param {DOMRect} triggerRect - getBoundingClientRect() of the trigger element
 * @param {Object} options
 * @param {'bottom'|'right'|'left'|'top'} options.placement - preferred placement direction
 * @param {number} options.offset - gap between trigger and popup (default 8)
 * @param {number} options.popupWidth - estimated popup width (default 280)
 * @param {number} options.popupHeight - estimated popup height (default 300)
 * @param {number} options.margin - minimum distance from viewport edge (default 10)
 * @returns {{ top: string, left: string }}
 */
export function computePopupPosition(triggerRect, options = {}) {
  const {
    placement = 'bottom',
    offset = 8,
    popupWidth = 280,
    popupHeight = 300,
    margin = 10
  } = options

  let top, left

  // Calculate initial position based on placement preference
  switch (placement) {
    case 'right':
      top = triggerRect.top
      left = triggerRect.right + offset
      break
    case 'left':
      top = triggerRect.top
      left = triggerRect.left - popupWidth - offset
      break
    case 'top':
      top = triggerRect.top - popupHeight - offset
      left = triggerRect.left
      break
    case 'bottom':
    default:
      top = triggerRect.bottom + offset
      left = triggerRect.left
      break
  }

  // Flip horizontally if overflows right
  if (left + popupWidth > window.innerWidth - margin) {
    if (placement === 'right') {
      left = triggerRect.left - popupWidth - offset
    } else {
      left = window.innerWidth - popupWidth - margin
    }
  }

  // Flip vertically if overflows bottom
  if (top + popupHeight > window.innerHeight - margin) {
    if (placement === 'bottom') {
      top = triggerRect.top - popupHeight - offset
    } else {
      top = window.innerHeight - popupHeight - margin
    }
  }

  // Clamp to viewport
  if (top < margin) top = margin
  if (left < margin) left = margin

  return { top: `${top}px`, left: `${left}px` }
}
