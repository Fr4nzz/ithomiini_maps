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
  }
})

const emit = defineEmits(['update:color', 'reset', 'picker-open', 'picker-close'])

const isOpen = ref(false)
const pickerRef = ref(null)
const dotRef = ref(null)

// Internal color state for picker
const pickerColor = ref(props.color)

watch(() => props.color, (newColor) => {
  pickerColor.value = newColor
})

// Is color customized (different from default)?
const isCustomColor = computed(() => {
  return props.color !== props.defaultColor
})

// Uppercase palette for matching
const paletteColors = COLOR_PICKER_PALETTE.map(c => c.toUpperCase())

function togglePicker(e) {
  e.stopPropagation()
  if (!isOpen.value) {
    isOpen.value = true
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
  emit('update:color', upper)
}

// Handle hex input change
function handleHexInput(e) {
  let value = e.target.value.trim()
  // Add # if missing
  if (value && !value.startsWith('#')) {
    value = '#' + value
  }
  // Validate hex format
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    pickerColor.value = value.toUpperCase()
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
      popupHeight: pickerEl ? pickerEl.offsetHeight : 220
    })
  }
}

function resetColor(e) {
  e.stopPropagation()
  emit('reset')
  emit('update:color', props.defaultColor)
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
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="legend-color-picker">
    <!-- Color shape trigger -->
    <button
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

          <!-- Color grid -->
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

          <div class="picker-footer">
            <div class="color-preview">
              <span class="preview-label">Selected:</span>
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

.picker-popover {
  position: fixed;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  z-index: 1000;
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

/* Color grid */
.color-grid {
  display: grid;
  grid-template-columns: repeat(17, 1fr);
  gap: 2px;
  margin-bottom: 8px;
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

.preview-label {
  color: var(--color-text-muted, #666);
}

.preview-swatch {
  width: 16px;
  height: 16px;
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
