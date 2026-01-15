<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Settings,
  RotateCcw,
  Lock,
  Unlock,
  GripVertical,
  ChevronDown,
  Palette,
  Type,
  Circle,
  MapPin
} from 'lucide-vue-next'
import { useLegendStore } from '../../stores/legend'
import { useDataStore } from '../../stores/data'

const props = defineProps({
  isExportMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['settings-open', 'settings-close'])

const legendStore = useLegendStore()
const dataStore = useDataStore()

// Settings panel visibility
const showSettings = ref(false)
const settingsButtonRef = ref(null)
const settingsPanelRef = ref(null)
const settingsPanelStyle = ref({})

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
  if (!showSettings.value && settingsButtonRef.value) {
    // Position the panel near the button
    const rect = settingsButtonRef.value.getBoundingClientRect()
    settingsPanelStyle.value = {
      top: `${rect.bottom + 8}px`,
      left: `${Math.max(10, rect.left - 100)}px`
    }
    showSettings.value = true
    emit('settings-open')
  } else {
    showSettings.value = false
    emit('settings-close')
  }
}

// Close settings panel
function closeSettings() {
  if (showSettings.value) {
    showSettings.value = false
    emit('settings-close')
  }
}

// Handle reset - resets all legend customizations
function handleReset() {
  legendStore.resetCustomizations()
}

// Toggle sticky edges
function toggleSticky() {
  legendStore.setStickyEdges(!legendStore.stickyEdges)
}

// Update text scale
function updateTextScale(e) {
  legendStore.setTextScale(parseFloat(e.target.value))
}

// Update legend dot scale
function updateLegendDotScale(e) {
  legendStore.setDotScale(parseFloat(e.target.value))
}

// Update map point size
function updateMapPointSize(e) {
  dataStore.mapStyle.pointSize = parseInt(e.target.value)
}

// Update map border width
function updateMapBorderWidth(e) {
  dataStore.mapStyle.borderWidth = parseFloat(e.target.value)
}

// Update map fill opacity
function updateMapFillOpacity(e) {
  dataStore.mapStyle.fillOpacity = parseFloat(e.target.value)
}

// Update max items
function updateMaxItems(e) {
  legendStore.setMaxItems(parseInt(e.target.value))
}

// Click outside handler
function handleClickOutside(e) {
  if (!showSettings.value) return

  // Check if click is inside the settings panel or the settings button
  const clickedInsidePanel = settingsPanelRef.value?.contains(e.target)
  const clickedInsideButton = settingsButtonRef.value?.contains(e.target)

  if (!clickedInsidePanel && !clickedInsideButton) {
    closeSettings()
  }
}

// Add/remove click outside listener
onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div
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
      ref="settingsButtonRef"
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

    <!-- Settings panel (popup window that can overflow legend) -->
    <Teleport to="body">
      <Transition name="settings-slide">
        <div v-if="showSettings" ref="settingsPanelRef" class="settings-panel" :style="settingsPanelStyle" @click.stop>
        <div class="settings-header">
          <span>LEGEND SETTINGS</span>
          <button class="close-button" @click="closeSettings">
            &times;
          </button>
        </div>

        <!-- Legend Text size -->
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

        <!-- Legend Dot size -->
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
              @input="updateLegendDotScale"
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

        <!-- Divider -->
        <div class="settings-divider"></div>

        <!-- Map Point Style Section -->
        <div class="settings-section-header">
          <MapPin :size="14" />
          <span>MAP POINTS</span>
        </div>

        <!-- Map Point Size -->
        <div class="settings-row">
          <label class="settings-label">
            Point Size
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="4"
              max="20"
              step="1"
              :value="dataStore.mapStyle.pointSize"
              @input="updateMapPointSize"
            />
            <span class="value-display">{{ dataStore.mapStyle.pointSize }}</span>
          </div>
        </div>

        <!-- Map Border Width -->
        <div class="settings-row">
          <label class="settings-label">
            Border Width
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              :value="dataStore.mapStyle.borderWidth"
              @input="updateMapBorderWidth"
            />
            <span class="value-display">{{ dataStore.mapStyle.borderWidth.toFixed(1) }}</span>
          </div>
        </div>

        <!-- Map Fill Opacity -->
        <div class="settings-row">
          <label class="settings-label">
            Fill Opacity
          </label>
          <div class="settings-control">
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              :value="dataStore.mapStyle.fillOpacity"
              @input="updateMapFillOpacity"
            />
            <span class="value-display">{{ Math.round(dataStore.mapStyle.fillOpacity * 100) }}%</span>
          </div>
        </div>

        <!-- Map Border Color -->
        <div class="settings-row">
          <label class="settings-label">
            Border Color
          </label>
          <div class="settings-control color-control">
            <input
              type="color"
              v-model="dataStore.mapStyle.borderColor"
              class="color-picker"
            />
            <input
              type="text"
              class="color-input"
              v-model="dataStore.mapStyle.borderColor"
              @keydown.enter="$event.target.blur()"
            />
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
    </Teleport>
  </div>
</template>

<style scoped>
.legend-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--color-accent, #4ade80); /* Accent border when visible */
  border-bottom: none; /* Merge with legend below */
  background: var(--color-bg-overlay, rgba(26, 26, 46, 0.95));
  border-radius: 8px 8px 0 0; /* Only round top corners */
  position: absolute;
  bottom: 100%; /* Position above the legend */
  left: -1px; /* Align with legend border */
  right: -1px;
  cursor: grab;
  box-shadow: 0 -2px 10px var(--color-shadow-color, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(4px);
}

.legend-toolbar:active {
  cursor: grabbing;
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

/* Settings Panel - Now a floating popup that can overflow */
.settings-panel {
  position: fixed;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 12px;
  z-index: 1000;
  box-shadow: 0 4px 20px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
  min-width: 280px;
  max-height: 80vh;
  overflow-y: auto;
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

/* Settings divider */
.settings-divider {
  height: 1px;
  background: var(--color-border, #3d3d5c);
  margin: 12px 0;
}

/* Settings section header */
.settings-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
  margin-bottom: 12px;
}

/* Color control */
.color-control {
  gap: 8px;
}

.color-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border-radius: 2px;
  border: none;
}

.color-input {
  flex: 1;
  padding: 6px 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-primary, #e0e0e0);
  font-family: monospace;
  font-size: 12px;
  text-transform: uppercase;
}

.color-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

/* Scrollbar for settings panel */
.settings-panel::-webkit-scrollbar {
  width: 6px;
}

.settings-panel::-webkit-scrollbar-track {
  background: transparent;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: var(--color-border, #3d3d5c);
  border-radius: 3px;
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
