<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { COLOR_PICKER_PALETTE } from '../../utils/colors'
import { computePopupPosition } from '../../composables/usePopupPosition'
import ShapeIcon from './ShapeIcon.vue'

const props = defineProps({
  color: {
    type: String,
    required: true
  },
  defaultColor: {
    type: String,
    default: '#3b82f6'
  },
  size: {
    type: Number,
    default: 10
  },
  showReset: {
    type: Boolean,
    default: true
  },
  borderColor: {
    type: String,
    default: '#ffffff'
  },
  borderWidth: {
    type: Number,
    default: 1.5
  },
  shape: {
    type: String,
    default: 'circle',
    validator: (v) => ['circle', 'square', 'triangle', 'rhombus'].includes(v)
  },
  triggerType: {
    type: String,
    default: 'shape',
    validator: (v) => ['shape', 'swatch'].includes(v)
  }
})

const emit = defineEmits(['update:color', 'reset', 'picker-open', 'picker-close'])

const isOpen = ref(false)
const pickerRef = ref(null)
const dotRef = ref(null)
const activeTab = ref('presets') // 'presets' | 'custom'

// Internal color state for picker
const pickerColor = ref(props.color)

// HSV state for custom picker
const hsvState = ref({ h: 0, s: 1, v: 1 })
const svPanelRef = ref(null)
const huePanelRef = ref(null)
const isDraggingSV = ref(false)
const isDraggingHue = ref(false)

watch(() => props.color, (newColor) => {
  pickerColor.value = newColor
  syncHsvFromHex(newColor)
})

// Is color customized (different from default)?
const isCustomColor = computed(() => {
  return props.color !== props.defaultColor
})

// Uppercase palette for matching
const paletteColors = COLOR_PICKER_PALETTE.map(c => c.toUpperCase())

// ═══════════════════════════════════════════════════════════════════════════
// HSV ↔ RGB CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0, s = max === 0 ? 0 : d / max, v = max
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s, v }
}

function hsvToRgb(h, s, v) {
  h = h / 360
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r, g, b
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v)
  return rgbToHex(r, g, b)
}

function syncHsvFromHex(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return
  const { r, g, b } = hexToRgb(hex)
  const hsv = rgbToHsv(r, g, b)
  // Preserve hue when s or v is 0 (black/white/gray)
  if (hsv.s > 0.01 && hsv.v > 0.01) {
    hsvState.value = hsv
  } else {
    hsvState.value = { ...hsv, h: hsvState.value.h }
  }
}

// The pure hue color for the SV panel background
const hueColor = computed(() => {
  const { r, g, b } = hsvToRgb(hsvState.value.h, 1, 1)
  return `rgb(${r},${g},${b})`
})

// SV cursor position (percentages)
const svCursorLeft = computed(() => hsvState.value.s * 100 + '%')
const svCursorTop = computed(() => (1 - hsvState.value.v) * 100 + '%')

// Hue cursor position (percentage)
const hueCursorLeft = computed(() => (hsvState.value.h / 360) * 100 + '%')

// ═══════════════════════════════════════════════════════════════════════════
// SV PANEL INTERACTION
// ═══════════════════════════════════════════════════════════════════════════

function handleSVDown(e) {
  e.preventDefault()
  isDraggingSV.value = true
  updateSV(e)
  document.addEventListener('mousemove', handleSVMove)
  document.addEventListener('mouseup', handleSVUp)
  document.addEventListener('touchmove', handleSVMove, { passive: false })
  document.addEventListener('touchend', handleSVUp)
}

function handleSVMove(e) {
  if (!isDraggingSV.value) return
  e.preventDefault()
  updateSV(e)
}

function handleSVUp() {
  isDraggingSV.value = false
  document.removeEventListener('mousemove', handleSVMove)
  document.removeEventListener('mouseup', handleSVUp)
  document.removeEventListener('touchmove', handleSVMove)
  document.removeEventListener('touchend', handleSVUp)
}

function updateSV(e) {
  if (!svPanelRef.value) return
  const rect = svPanelRef.value.getBoundingClientRect()
  const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
  const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  hsvState.value = { ...hsvState.value, s: x, v: 1 - y }
  applyHsvColor()
}

// ═══════════════════════════════════════════════════════════════════════════
// HUE BAR INTERACTION
// ═══════════════════════════════════════════════════════════════════════════

function handleHueDown(e) {
  e.preventDefault()
  isDraggingHue.value = true
  updateHue(e)
  document.addEventListener('mousemove', handleHueMove)
  document.addEventListener('mouseup', handleHueUp)
  document.addEventListener('touchmove', handleHueMove, { passive: false })
  document.addEventListener('touchend', handleHueUp)
}

function handleHueMove(e) {
  if (!isDraggingHue.value) return
  e.preventDefault()
  updateHue(e)
}

function handleHueUp() {
  isDraggingHue.value = false
  document.removeEventListener('mousemove', handleHueMove)
  document.removeEventListener('mouseup', handleHueUp)
  document.removeEventListener('touchmove', handleHueMove)
  document.removeEventListener('touchend', handleHueUp)
}

function updateHue(e) {
  if (!huePanelRef.value) return
  const rect = huePanelRef.value.getBoundingClientRect()
  const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  hsvState.value = { ...hsvState.value, h: x * 360 }
  applyHsvColor()
}

function applyHsvColor() {
  const hex = hsvToHex(hsvState.value.h, hsvState.value.s, hsvState.value.v)
  pickerColor.value = hex
  emit('update:color', hex)
}

// ═══════════════════════════════════════════════════════════════════════════
// POPUP LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function togglePicker(e) {
  e.stopPropagation()
  if (!isOpen.value) {
    isOpen.value = true
    syncHsvFromHex(pickerColor.value)
    emit('picker-open')
    nextTick(() => updatePickerPosition())
  } else {
    isOpen.value = false
    emit('picker-close')
  }
}

function closePicker() {
  if (isOpen.value) {
    isOpen.value = false
    emit('picker-close')
  }
}

function handleSwatchClick(hexColor) {
  const upper = hexColor.toUpperCase()
  pickerColor.value = upper
  syncHsvFromHex(upper)
  emit('update:color', upper)
}

// Handle hex input change
function handleHexInput(e) {
  let value = e.target.value.trim()
  if (value && !value.startsWith('#')) {
    value = '#' + value
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    pickerColor.value = value.toUpperCase()
    syncHsvFromHex(pickerColor.value)
    emit('update:color', pickerColor.value)
  }
}

// Picker position
const pickerStyle = ref({})

function updatePickerPosition() {
  if (dotRef.value) {
    const rect = dotRef.value.getBoundingClientRect()
    const pickerEl = pickerRef.value
    pickerStyle.value = computePopupPosition(rect, {
      placement: 'right',
      popupWidth: pickerEl ? pickerEl.offsetWidth : 280,
      popupHeight: pickerEl ? pickerEl.offsetHeight : 350
    })
  }
}

function resetColor(e) {
  e.stopPropagation()
  emit('reset')
  emit('update:color', props.defaultColor)
  syncHsvFromHex(props.defaultColor)
  closePicker()
}

// Close picker when clicking outside
function handleClickOutside(e) {
  if (pickerRef.value && !pickerRef.value.contains(e.target) &&
      dotRef.value && !dotRef.value.contains(e.target)) {
    closePicker()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  syncHsvFromHex(props.color)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // Clean up any lingering drag listeners
  document.removeEventListener('mousemove', handleSVMove)
  document.removeEventListener('mouseup', handleSVUp)
  document.removeEventListener('mousemove', handleHueMove)
  document.removeEventListener('mouseup', handleHueUp)
})
</script>

<template>
  <div class="legend-color-picker">
    <!-- Shape trigger (default) -->
    <button
      v-if="triggerType === 'shape'"
      ref="dotRef"
      class="color-dot"
      :class="{ 'is-custom': isCustomColor }"
      :title="isCustomColor ? 'Custom color (click to change)' : 'Click to change color'"
      @click="togglePicker"
    >
      <ShapeIcon
        :shape="shape"
        :color="color"
        :size="size"
        :border-color="borderColor"
        :border-width="borderWidth"
      />
      <span v-if="isCustomColor" class="custom-indicator" />
    </button>

    <!-- Swatch trigger (for border colors etc.) -->
    <button
      v-else
      ref="dotRef"
      class="color-swatch-trigger"
      :title="'Click to change color'"
      @click="togglePicker"
    >
      <span class="swatch-preview" :style="{ backgroundColor: color }" />
    </button>

    <!-- Color picker popover (teleported to body to overflow legend) -->
    <Teleport to="body">
      <Transition name="picker-fade">
        <div
          v-if="isOpen"
          ref="pickerRef"
          class="picker-popover"
          :style="pickerStyle"
          @click.stop
        >
          <div class="picker-header">
            <span class="picker-title">CHOOSE COLOR</span>
            <button class="picker-close" @click="closePicker" title="Close">
              &times;
            </button>
          </div>

          <!-- Tabs -->
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ active: activeTab === 'presets' }"
              @click="activeTab = 'presets'"
            >Presets</button>
            <button
              class="picker-tab"
              :class="{ active: activeTab === 'custom' }"
              @click="activeTab = 'custom'"
            >Custom</button>
          </div>

          <!-- Presets tab: color grid -->
          <div v-if="activeTab === 'presets'" class="tab-content">
            <div class="color-grid">
              <button
                v-for="c in paletteColors"
                :key="c"
                class="color-swatch"
                :class="{
                  'is-selected': c === pickerColor?.toUpperCase(),
                  'is-white': c === '#FFFFFF'
                }"
                :style="{ backgroundColor: c }"
                :title="c"
                @click.stop="handleSwatchClick(c)"
              >
                <span v-if="c === pickerColor?.toUpperCase()" class="swatch-check" />
              </button>
            </div>
          </div>

          <!-- Custom tab: HSV picker -->
          <div v-else class="tab-content">
            <!-- Saturation/Value panel -->
            <div
              ref="svPanelRef"
              class="sv-panel"
              :style="{ backgroundColor: hueColor }"
              @mousedown="handleSVDown"
              @touchstart.prevent="handleSVDown"
            >
              <div class="sv-white" />
              <div class="sv-black" />
              <div
                class="sv-cursor"
                :style="{ left: svCursorLeft, top: svCursorTop }"
              />
            </div>

            <!-- Hue bar -->
            <div
              ref="huePanelRef"
              class="hue-bar"
              @mousedown="handleHueDown"
              @touchstart.prevent="handleHueDown"
            >
              <div
                class="hue-cursor"
                :style="{ left: hueCursorLeft }"
              />
            </div>
          </div>

          <!-- Footer: preview + hex + reset (shared across tabs) -->
          <div class="picker-footer">
            <div class="color-preview">
              <span
                class="preview-swatch"
                :style="{ backgroundColor: pickerColor }"
              />
              <input
                type="text"
                class="hex-input"
                :value="pickerColor"
                @change="handleHexInput"
                @keydown.enter="$event.target.blur()"
                placeholder="#000000"
              />
            </div>
            <button
              v-if="showReset && isCustomColor"
              class="reset-button"
              title="Reset to default color"
              @click="resetColor"
            >
              <RotateCcw :size="12" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.legend-color-picker {
  position: relative;
  display: inline-flex;
}

.color-dot {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-dot:hover {
  transform: scale(1.2);
}

.custom-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  background: var(--color-accent, #4ade80);
  border-radius: 50%;
  border: 1px solid var(--color-bg-primary, #1a1a2e);
}

/* Swatch trigger (for border colors) */
.color-swatch-trigger {
  display: flex;
  align-items: center;
  padding: 0;
  background: none;
  border: 2px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  cursor: pointer;
  width: 36px;
  height: 36px;
  overflow: hidden;
}

.color-swatch-trigger:hover {
  border-color: var(--color-text-secondary, #aaa);
}

.swatch-preview {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

.picker-popover {
  position: fixed;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  z-index: 3000;
  width: 268px;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.picker-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.picker-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}

.picker-close:hover {
  color: var(--color-text-primary, #e0e0e0);
}

/* Tabs */
.picker-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 6px;
  padding: 2px;
}

.picker-tab {
  flex: 1;
  padding: 5px 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted, #666);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.picker-tab:hover {
  color: var(--color-text-secondary, #aaa);
}

.picker-tab.active {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Tab content */
.tab-content {
  margin-bottom: 8px;
}

/* Color grid (presets) */
.color-grid {
  display: grid;
  grid-template-columns: repeat(17, 1fr);
  gap: 2px;
}

.color-swatch {
  width: 13px;
  height: 13px;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: transform 0.1s ease;
}

.color-swatch:hover {
  transform: scale(1.3);
  z-index: 1;
}

.color-swatch.is-white {
  border-color: var(--color-border, #3d3d5c);
}

.color-swatch.is-selected {
  border-color: #fff;
  box-shadow: 0 0 0 1px var(--color-bg-primary, #1a1a2e);
}

.swatch-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  width: 5px;
  height: 5px;
  margin: auto;
}

/* HSV Picker */
.sv-panel {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: 6px;
  cursor: crosshair;
  overflow: hidden;
  margin-bottom: 8px;
}

.sv-white {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, #fff, transparent);
}

.sv-black {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent, #000);
}

.sv-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.6), inset 0 0 2px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hue-bar {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
}

.hue-cursor {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: transparent;
}

/* Footer */
.picker-footer {
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #3d3d5c);
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex: 1;
}

.preview-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--color-border, #3d3d5c);
  flex-shrink: 0;
}

.hex-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-primary, #e0e0e0);
  font-family: var(--font-family-mono, monospace);
  font-size: 11px;
  text-transform: uppercase;
}

.hex-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.reset-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  white-space: nowrap;
}

.reset-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  color: var(--color-text-primary, #e0e0e0);
  border-color: var(--color-accent, #4ade80);
}

/* Transitions */
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: all 0.15s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
