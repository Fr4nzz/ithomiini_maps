/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { computePopupPosition } from '../usePopupPosition'

// Mock window dimensions
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true })
})

function makeTriggerRect(x, y, width = 30, height = 30) {
  return {
    top: y,
    bottom: y + height,
    left: x,
    right: x + width,
    width,
    height
  }
}

describe('computePopupPosition', () => {
  it('positions below trigger by default (placement=bottom)', () => {
    const rect = makeTriggerRect(100, 100)
    const pos = computePopupPosition(rect, { popupWidth: 200, popupHeight: 200 })
    expect(parseInt(pos.top)).toBe(138) // 100 + 30 + 8 offset
    expect(parseInt(pos.left)).toBe(100)
  })

  it('positions to the right of trigger (placement=right)', () => {
    const rect = makeTriggerRect(100, 100)
    const pos = computePopupPosition(rect, {
      placement: 'right',
      popupWidth: 200,
      popupHeight: 200
    })
    expect(parseInt(pos.top)).toBe(100)
    expect(parseInt(pos.left)).toBe(138) // 100 + 30 + 8 offset
  })

  it('flips to left when right overflows viewport', () => {
    const rect = makeTriggerRect(900, 100)
    const pos = computePopupPosition(rect, {
      placement: 'right',
      popupWidth: 280,
      popupHeight: 200
    })
    // Should flip: 900 - 280 - 8 = 612
    expect(parseInt(pos.left)).toBe(612)
  })

  it('flips to top when bottom overflows viewport', () => {
    const rect = makeTriggerRect(100, 650)
    const pos = computePopupPosition(rect, {
      placement: 'bottom',
      popupWidth: 200,
      popupHeight: 200
    })
    // Should flip: 650 - 200 - 8 = 442
    expect(parseInt(pos.top)).toBe(442)
  })

  it('clamps to viewport when fully off-screen left', () => {
    const rect = makeTriggerRect(5, 100)
    const pos = computePopupPosition(rect, {
      placement: 'left',
      popupWidth: 280,
      popupHeight: 200
    })
    // left would be 5 - 280 - 8 = -283, clamped to margin (10)
    expect(parseInt(pos.left)).toBe(10)
  })

  it('clamps to viewport when fully off-screen top', () => {
    const rect = makeTriggerRect(100, 5)
    const pos = computePopupPosition(rect, {
      placement: 'top',
      popupWidth: 200,
      popupHeight: 200
    })
    // top would be 5 - 200 - 8 = -203, clamped to margin (10)
    expect(parseInt(pos.top)).toBe(10)
  })

  it('uses custom offset', () => {
    const rect = makeTriggerRect(100, 100)
    const pos = computePopupPosition(rect, {
      placement: 'bottom',
      offset: 20,
      popupWidth: 200,
      popupHeight: 200
    })
    expect(parseInt(pos.top)).toBe(150) // 100 + 30 + 20
  })

  it('uses custom margin for viewport clamping', () => {
    const rect = makeTriggerRect(950, 100)
    const pos = computePopupPosition(rect, {
      placement: 'bottom',
      margin: 20,
      popupWidth: 200,
      popupHeight: 200
    })
    // left would be 950, but 950+200 > 1024-20, so clamp
    expect(parseInt(pos.left)).toBe(804) // 1024 - 200 - 20
  })

  it('returns pixel strings', () => {
    const rect = makeTriggerRect(100, 100)
    const pos = computePopupPosition(rect)
    expect(pos.top).toMatch(/^\d+px$/)
    expect(pos.left).toMatch(/^\d+px$/)
  })
})
