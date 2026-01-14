<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { SHAPE_OPTIONS } from '../../utils/shapes'
import { generate3ColorPreview } from '../../utils/colors'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    default: ''
  },
  currentShape: {
    type: String,
    default: 'circle'
  },
  borderColor: {
    type: String,
    default: '#ffffff'
  },
  baseHue: {
    type: Number,
    default: 210
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
})

const emit = defineEmits([
  'close',
  'update:shape',
  'update:borderColor',
  'update:hue'
])

// Local hue for slider (updates on input, emits on change)
const localHue = ref(props.baseHue)

// Gradient preview colors
const gradientColors = computed(() => generate3ColorPreview(localHue.value))

// Gradient CSS style
const gradientStyle = computed(() => {
  const [light, medium, dark] = gradientColors.value
  return {
    background: `linear-gradient(to right, ${light}, ${medium}, ${dark})`
  }
})

// Position style for popup
const positionStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`
}))

// Format group name for display
const displayName = computed(() => {
  const parts = props.groupName.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  }
  return props.groupName
})

// Handle hue slider input (preview only)
function handleHueInput(e) {
  localHue.value = parseInt(e.target.value)
}

// Handle hue slider change (commit)
function handleHueChange(e) {
  emit('update:hue', parseInt(e.target.value))
}

// Click outside handler
function handleClickOutside(e) {
  if (!e.target.closest('.group-style-popup')) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="group-style-popup"
      :style="positionStyle"
      @click.stop
    >
      <div class="popup-header">
        <span class="popup-title">{{ displayName }}</span>
        <button class="close-button" @click="emit('close')">&times;</button>
      </div>

      <div class="popup-body">
        <!-- Shape selection -->
        <div class="style-section">
          <label class="section-label">Shape</label>
          <div class="shape-options">
            <button
              v-for="shape in SHAPE_OPTIONS"
              :key="shape.value"
              class="shape-button"
              :class="{ active: currentShape === shape.value }"
              @click="emit('update:shape', shape.value)"
              :title="shape.label"
            >
              {{ shape.icon }}
            </button>
          </div>
        </div>

        <!-- Border color -->
        <div class="style-section">
          <label class="section-label">Border Color</label>
          <div class="color-picker-row">
            <input
              type="color"
              class="color-picker"
              :value="borderColor"
              @input="emit('update:borderColor', $event.target.value)"
            />
            <input
              type="text"
              class="color-input"
              :value="borderColor"
              @input="emit('update:borderColor', $event.target.value)"
            />
          </div>
        </div>

        <!-- Gradient picker -->
        <div class="style-section">
          <label class="section-label">Color Gradient</label>
          <div class="gradient-preview" :style="gradientStyle"></div>
          <div class="hue-slider-row">
            <input
              type="range"
              class="hue-slider"
              min="0"
              max="360"
              :value="localHue"
              @input="handleHueInput"
              @change="handleHueChange"
            />
            <span class="hue-value">{{ localHue }}°</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.group-style-popup {
  position: fixed;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 12px;
  padding: 0;
  min-width: 240px;
  box-shadow: 0 8px 32px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
  z-index: 2000;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  font-style: italic;
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s ease;
}

.close-button:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.popup-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.style-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
}

/* Shape options */
.shape-options {
  display: flex;
  gap: 4px;
}

.shape-button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shape-button:hover {
  background: rgba(255,255,255,0.05);
  border-color: var(--color-text-secondary, #aaa);
}

.shape-button.active {
  background: var(--color-accent-subtle, rgba(74, 222, 128, 0.15));
  border-color: var(--color-accent, #4ade80);
  color: var(--color-accent, #4ade80);
}

/* Color picker */
.color-picker-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  cursor: pointer;
  background: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border-radius: 3px;
  border: none;
}

.color-input {
  flex: 1;
  padding: 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-family: monospace;
  font-size: 12px;
  text-transform: uppercase;
}

.color-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

/* Gradient preview */
.gradient-preview {
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--color-border, #3d3d5c);
}

.hue-slider-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hue-slider {
  flex: 1;
  height: 6px;
  appearance: none;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    hsl(0, 70%, 50%),
    hsl(60, 70%, 50%),
    hsl(120, 70%, 50%),
    hsl(180, 70%, 50%),
    hsl(240, 70%, 50%),
    hsl(300, 70%, 50%),
    hsl(360, 70%, 50%)
  );
  cursor: pointer;
}

.hue-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 2px solid var(--color-text-primary, #e0e0e0);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.hue-value {
  font-size: 11px;
  color: var(--color-text-muted, #666);
  font-family: monospace;
  min-width: 36px;
  text-align: right;
}
</style>
