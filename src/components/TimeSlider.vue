<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()

// Derived from temporal distribution
const yearRange = computed(() => {
  const dist = store.temporalDistribution
  if (!dist.length) return { min: 2000, max: 2025 }
  return { min: dist[0].year, max: dist[dist.length - 1].year }
})

// Local slider state (years as integers)
const sliderMin = ref(yearRange.value.min)
const sliderMax = ref(yearRange.value.max)

// Sync from store filters (if set externally)
watch(() => [store.filters.dateStart, store.filters.dateEnd], ([start, end]) => {
  if (start) {
    const d = new Date(start)
    sliderMin.value = d.getFullYear()
  } else {
    sliderMin.value = yearRange.value.min
  }
  if (end) {
    const d = new Date(end)
    sliderMax.value = d.getFullYear()
  } else {
    sliderMax.value = yearRange.value.max
  }
}, { immediate: true })

// Update when year range changes (e.g., new data loaded)
watch(yearRange, (range) => {
  if (!store.filters.dateStart) sliderMin.value = range.min
  if (!store.filters.dateEnd) sliderMax.value = range.max
})

// Update store when slider changes
const applySliderRange = () => {
  const isFullRange = sliderMin.value <= yearRange.value.min && sliderMax.value >= yearRange.value.max
  store.filters.dateStart = isFullRange ? null : `${sliderMin.value}-01-01`
  store.filters.dateEnd = isFullRange ? null : `${sliderMax.value}-12-31`
}

const onMinChange = (e) => {
  const val = parseInt(e.target.value)
  if (val < sliderMax.value) {
    sliderMin.value = val
    applySliderRange()
  }
}

const onMaxChange = (e) => {
  const val = parseInt(e.target.value)
  if (val > sliderMin.value) {
    sliderMax.value = val
    applySliderRange()
  }
}

const resetRange = () => {
  sliderMin.value = yearRange.value.min
  sliderMax.value = yearRange.value.max
  store.filters.dateStart = null
  store.filters.dateEnd = null
}

// Histogram bars
const maxCount = computed(() => {
  return Math.max(1, ...store.temporalDistribution.map(d => d.count))
})

const histogramBars = computed(() => {
  return store.temporalDistribution.map(d => ({
    year: d.year,
    count: d.count,
    height: (d.count / maxCount.value) * 100,
    inRange: d.year >= sliderMin.value && d.year <= sliderMax.value
  }))
})

const isFilterActive = computed(() => {
  return sliderMin.value > yearRange.value.min || sliderMax.value < yearRange.value.max
})
</script>

<template>
  <div class="time-slider" v-if="histogramBars.length > 0">
    <!-- Histogram visualization -->
    <div class="histogram">
      <div
        v-for="bar in histogramBars"
        :key="bar.year"
        class="histogram-bar"
        :class="{ 'in-range': bar.inRange, 'out-range': !bar.inRange }"
        :style="{ height: bar.height + '%' }"
        :title="`${bar.year}: ${bar.count} records`"
      />
    </div>

    <!-- Dual range slider -->
    <div class="slider-container">
      <input
        type="range"
        class="range-input range-min"
        :min="yearRange.min"
        :max="yearRange.max"
        :value="sliderMin"
        @input="onMinChange"
      />
      <input
        type="range"
        class="range-input range-max"
        :min="yearRange.min"
        :max="yearRange.max"
        :value="sliderMax"
        @input="onMaxChange"
      />
    </div>

    <!-- Year labels -->
    <div class="year-labels">
      <span class="year-label">{{ sliderMin }}</span>
      <span v-if="isFilterActive" class="year-count">
        {{ store.filteredGeoJSON?.features?.length || 0 }} records
      </span>
      <span class="year-label">{{ sliderMax }}</span>
    </div>

    <!-- Reset button -->
    <button v-if="isFilterActive" class="btn-reset-range" @click="resetRange">
      Reset to full range
    </button>
  </div>
  <div v-else class="time-slider-empty">
    <p>No date data available for the selected sources.</p>
  </div>
</template>

<style scoped>
.time-slider {
  padding: 12px 14px;
}

.time-slider-empty {
  padding: 12px 14px;
}

.time-slider-empty p {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin: 0;
}

/* Histogram */
.histogram {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 60px;
  margin-bottom: 4px;
  padding: 0 2px;
}

.histogram-bar {
  flex: 1;
  min-width: 2px;
  border-radius: 1px 1px 0 0;
  transition: background-color 0.15s, height 0.15s;
}

.histogram-bar.in-range {
  background-color: var(--color-accent, #4ade80);
  opacity: 0.7;
}

.histogram-bar.out-range {
  background-color: var(--color-text-muted, #666);
  opacity: 0.25;
}

.histogram-bar:hover {
  opacity: 1;
}

/* Dual range slider */
.slider-container {
  position: relative;
  height: 24px;
}

.range-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  outline: none;
}

/* Track styling - only show on the bottom layer */
.range-min {
  z-index: 1;
}

.range-min::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 2px;
}

.range-min::-moz-range-track {
  height: 4px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 2px;
}

.range-max {
  z-index: 2;
}

.range-max::-webkit-slider-runnable-track {
  height: 4px;
  background: transparent;
}

.range-max::-moz-range-track {
  height: 4px;
  background: transparent;
}

/* Thumb styling */
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent, #4ade80);
  cursor: pointer;
  pointer-events: all;
  margin-top: -6px;
  transition: transform 0.15s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.range-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent, #4ade80);
  cursor: pointer;
  pointer-events: all;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* Year labels */
.year-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.year-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent, #4ade80);
  font-variant-numeric: tabular-nums;
}

.year-count {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
}

/* Reset button */
.btn-reset-range {
  width: 100%;
  padding: 6px 12px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reset-range:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
  border-color: var(--color-text-muted, #666);
}
</style>
