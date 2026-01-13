<script setup>
import { ref, computed } from 'vue'
import {
  Settings,
  RotateCcw,
  Lock,
  Unlock,
  GripVertical,
  ChevronDown,
  Palette,
  Type,
  Circle
} from 'lucide-vue-next'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'

const props = defineProps({
  isExportMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['reset-customizations'])

const legendStore = useLegendStore()
const dataStore = useDataStore()

// Settings panel visibility
const showSettings = ref(false)

// Color by options
const colorByOptions = [
  { value: 'subspecies', label: 'Subspecies' },
  { value: 'species', label: 'Species' },
  { value: 'genus', label: 'Genus' },
  { value: 'status', label: 'Sequencing Status' },
  { value: 'mimicry', label: 'Mimicry Ring' },
  { value: 'source', label: 'Data Source' }
]

// Current colorBy
const colorBy = computed({
  get: () => dataStore.colorBy,
  set: (value) => { dataStore.colorBy = value }
})

// Toggle settings
function toggleSettings() {
  showSettings.value = !showSettings.value
}

// Handle reset
function handleReset() {
  legendStore.resetCustomizations()
  emit('reset-customizations')
}

// Toggle sticky edges
function toggleSticky() {
  legendStore.setStickyEdges(!legendStore.stickyEdges)
}

// Update text scale
function updateTextScale(e) {
  legendStore.setTextScale(parseFloat(e.target.value))
}

// Update dot scale
function updateDotScale(e) {
  legendStore.setDotScale(parseFloat(e.target.value))
}

// Update max items
function updateMaxItems(e) {
  legendStore.setMaxItems(parseInt(e.target.value))
}
</script>

<template>
  <div
    v-if="!isExportMode"
    class="legend-toolbar"
  >
    <!-- Drag handle -->
    <div class="drag-handle" title="Drag to move legend">
      <GripVertical :size="16" />
    </div>

    <!-- Color by dropdown -->
    <div class="toolbar-item color-by-select">
      <Palette :size="14" />
      <select v-model="colorBy" class="color-by-dropdown">
        <option
          v-for="option in colorByOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <ChevronDown :size="12" class="dropdown-icon" />
    </div>

    <!-- Sticky toggle -->
    <button
      class="toolbar-button"
      :class="{ active: legendStore.stickyEdges }"
      :title="legendStore.stickyEdges ? 'Sticky edges ON (click to disable)' : 'Sticky edges OFF (click to enable)'"
      @click="toggleSticky"
    >
      <Lock v-if="legendStore.stickyEdges" :size="14" />
      <Unlock v-else :size="14" />
    </button>

    <!-- Settings toggle -->
    <button
      class="toolbar-button"
      :class="{ active: showSettings }"
      title="Legend settings"
      @click="toggleSettings"
    >
      <Settings :size="14" />
    </button>

    <!-- Reset button (only show if customizations exist) -->
    <button
      v-if="legendStore.hasCustomizations"
      class="toolbar-button reset-button"
      title="Reset all customizations"
      @click="handleReset"
    >
      <RotateCcw :size="14" />
    </button>

    <!-- Settings panel -->
    <Transition name="settings-slide">
      <div v-if="showSettings" class="settings-panel">
        <div class="settings-header">
          <span>Legend Settings</span>
          <button class="close-button" @click="showSettings = false">
            &times;
          </button>
        </div>

        <!-- Text size -->
        <div class="settings-row">
          <label class="settings-label">
            <Type :size="14" />
            Text Size
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.1"
              :value="legendStore.textScale"
              @input="updateTextScale"
            />
            <span class="value-display">{{ (legendStore.textScale * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Dot size -->
        <div class="settings-row">
          <label class="settings-label">
            <Circle :size="14" />
            Dot Size
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              :value="legendStore.dotScale"
              @input="updateDotScale"
            />
            <span class="value-display">{{ (legendStore.dotScale * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Max items -->
        <div class="settings-row">
          <label class="settings-label">
            Max Items
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              :value="legendStore.maxItems"
              @input="updateMaxItems"
            />
            <span class="value-display">{{ legendStore.maxItems }}</span>
          </div>
        </div>

        <!-- Quick reset -->
        <div class="settings-actions">
          <button
            class="action-button"
            @click="handleReset"
          >
            <RotateCcw :size="14" />
            Reset All
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.legend-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, rgba(255,255,255,0.02));
  border-radius: 8px 8px 0 0;
  position: relative;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: var(--color-text-muted, #666);
  cursor: grab;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.drag-handle:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  color: var(--color-text-secondary, #aaa);
}

.drag-handle:active {
  cursor: grabbing;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-by-select {
  position: relative;
  padding: 4px 8px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
}

.color-by-dropdown {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  padding-right: 16px;
  outline: none;
}

.color-by-dropdown option {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
}

.dropdown-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-text-muted, #666);
}

.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.toolbar-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  color: var(--color-text-primary, #e0e0e0);
}

.toolbar-button.active {
  background: var(--color-accent-subtle, rgba(74, 222, 128, 0.1));
  color: var(--color-accent, #4ade80);
}

.reset-button:hover {
  color: var(--color-warning, #f59e0b);
}

/* Settings Panel */
.settings-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 12px;
  z-index: 10;
  box-shadow: 0 4px 12px var(--color-shadow-color, rgba(0, 0, 0, 0.2));
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-button:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.settings-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.settings-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary, #aaa);
}

.settings-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-control input[type="range"] {
  flex: 1;
  height: 4px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 2px;
  appearance: none;
  cursor: pointer;
}

.settings-control input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-accent, #4ade80);
  border-radius: 50%;
  cursor: pointer;
}

.value-display {
  min-width: 40px;
  text-align: right;
  font-size: 12px;
  color: var(--color-text-muted, #666);
  font-family: var(--font-family-mono, monospace);
}

.settings-actions {
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  border-color: var(--color-warning, #f59e0b);
  color: var(--color-warning, #f59e0b);
}

/* Transitions */
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: all 0.2s ease;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
