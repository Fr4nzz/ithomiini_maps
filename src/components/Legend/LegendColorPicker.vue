<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Compact } from '@ckpack/vue-color'
import { RotateCcw } from 'lucide-vue-next'
import { COLOR_PICKER_PALETTE } from '../../utils/colors'

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
  }
})

const emit = defineEmits(['update:color', 'reset'])

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

function togglePicker(e) {
  e.stopPropagation()
  isOpen.value = !isOpen.value
}

function closePicker() {
  isOpen.value = false
}

function handleColorChange(color) {
  const hexColor = color.hex || color
  pickerColor.value = hexColor
  emit('update:color', hexColor)
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
    <!-- Color dot trigger -->
    <button
      ref="dotRef"
      class="color-dot"
      :class="{ 'is-custom': isCustomColor }"
      :style="{
        backgroundColor: color,
        width: size + 'px',
        height: size + 'px',
        boxShadow: `0 0 4px ${color}`
      }"
      :title="isCustomColor ? 'Custom color (click to change)' : 'Click to change color'"
      @click="togglePicker"
    >
      <span v-if="isCustomColor" class="custom-indicator" />
    </button>

    <!-- Color picker popover -->
    <Transition name="picker-fade">
      <div
        v-if="isOpen"
        ref="pickerRef"
        class="picker-popover"
        @click.stop
      >
        <div class="picker-header">
          <span class="picker-title">Choose Color</span>
          <button
            v-if="showReset && isCustomColor"
            class="reset-button"
            title="Reset to default color"
            @click="resetColor"
          >
            <RotateCcw :size="14" />
          </button>
        </div>

        <Compact
          :model-value="pickerColor"
          :palette="COLOR_PICKER_PALETTE"
          @update:model-value="handleColorChange"
        />

        <div class="picker-footer">
          <div class="color-preview">
            <span class="preview-label">Selected:</span>
            <span
              class="preview-swatch"
              :style="{ backgroundColor: pickerColor }"
            />
            <span class="preview-hex">{{ pickerColor }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.legend-color-picker {
  position: relative;
  display: inline-flex;
}

.color-dot {
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.color-dot:hover {
  transform: scale(1.2);
  box-shadow: 0 0 8px currentColor !important;
}

.color-dot.is-custom::after {
  content: '';
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
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  z-index: 1000;
  min-width: 240px;
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
}

.reset-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  color: var(--color-text-primary, #e0e0e0);
  border-color: var(--color-accent, #4ade80);
}

.picker-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.color-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.preview-label {
  color: var(--color-text-muted, #666);
}

.preview-swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--color-border, #3d3d5c);
}

.preview-hex {
  font-family: var(--font-family-mono, monospace);
  color: var(--color-text-secondary, #aaa);
}

/* Picker component styling */
:deep(.vc-compact) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:deep(.vc-compact-colors) {
  display: grid !important;
  grid-template-columns: repeat(17, 1fr) !important;
  gap: 2px !important;
}

:deep(.vc-compact-color-item) {
  width: 12px !important;
  height: 12px !important;
  border-radius: 2px !important;
}

:deep(.vc-compact-dot) {
  width: 4px !important;
  height: 4px !important;
}

/* Transitions */
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: all 0.15s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(-10px);
}
</style>
