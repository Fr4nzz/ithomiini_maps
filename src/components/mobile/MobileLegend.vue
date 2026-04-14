<script setup>
import { computed, inject, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { useDataStore } from '@/stores/data'
import { useLegendStore } from '@/stores/legend'
import { useLegendItemData } from '@/components/Legend/useLegendItemData'
import { applyAbbreviationFormat } from '@/utils/abbreviations'

const mobileLayout = inject('mobileLayout', null)

if (!mobileLayout) {
  throw new Error('MobileLegend requires mobileLayout injection')
}

const store = useDataStore()
const legendStore = useLegendStore()
const selectedLabel = ref('')
const isExportMode = computed(() => false)

const { legendItems, legendCounts, getGroupForItem, formatLabel } = useLegendItemData(
  store,
  legendStore,
  isExportMode
)

const items = computed(() => legendItems.value
  .filter(item => item.visible !== false)
  .map((item) => {
    const groupName = getGroupForItem(item.label)
    const fullLabel = item.customLabel || formatLabel(item.label, groupName)

    return {
      label: item.label,
      color: legendStore.customColors[item.label] || item.customColor || item.color,
      fullLabel,
      shortLabel: abbreviateLabel(fullLabel),
      count: legendCounts.value[item.label] || 0,
    }
  }))

const isLegendSheetOpen = computed({
  get: () => mobileLayout.activeSheet.value === 'legend',
  set: (value) => {
    if (value) {
      mobileLayout.openSheet('legend')
      return
    }

    mobileLayout.closeSheet()
  }
})

const showMiniBar = computed(() => (
  legendStore.showLegend &&
  items.value.length > 0 &&
  items.value.length <= 8 &&
  !isLegendSheetOpen.value
))

function abbreviateLabel(label) {
  if (!label) return ''
  if (label.includes(' ')) {
    const abbreviated = applyAbbreviationFormat(label, 'firstLetterGenus')
    if (abbreviated) return abbreviated
  }
  if (label.length <= 16) return label
  return `${label.slice(0, 14)}…`
}

function emitMapHighlight(label = '') {
  window.dispatchEvent(new CustomEvent('mobile-legend-highlight', {
    detail: { label }
  }))
}

function toggleHighlight(label) {
  selectedLabel.value = selectedLabel.value === label ? '' : label
  emitMapHighlight(selectedLabel.value)
}

watch(items, (nextItems) => {
  if (!selectedLabel.value) return

  if (nextItems.some(item => item.label === selectedLabel.value)) {
    emitMapHighlight(selectedLabel.value)
    return
  }

  selectedLabel.value = ''
  emitMapHighlight('')
}, { deep: true })
</script>

<template>
  <div v-if="legendStore.showLegend && items.length > 0" class="mobile-legend">
    <div v-if="showMiniBar" class="mobile-legend__mini-bar" aria-label="Legend shortcuts">
      <button
        v-for="item in items"
        :key="item.label"
        type="button"
        class="mobile-legend__mini-item"
        :class="{ 'is-selected': selectedLabel === item.label }"
        :title="item.fullLabel"
        @click="toggleHighlight(item.label)"
      >
        <span class="mobile-legend__dot" :style="{ backgroundColor: item.color }" />
        <span class="mobile-legend__mini-label">{{ item.shortLabel }}</span>
      </button>
    </div>

    <Drawer
      v-model:open="isLegendSheetOpen"
      :modal="false"
      direction="bottom"
      should-scale-background="false"
    >
      <DrawerOverlay class="mobile-legend__overlay" />

      <DrawerContent
        class="mobile-legend__sheet"
        @pointer-down-outside.prevent
        @interact-outside.prevent
      >
        <div class="mobile-legend__sheet-header">
          <div>
            <p class="mobile-legend__eyebrow">Legend</p>
            <h2>Filtered map categories</h2>
          </div>

          <button
            type="button"
            class="mobile-legend__close"
            aria-label="Close legend"
            @click="isLegendSheetOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="mobile-legend__sheet-list" role="list">
          <button
            v-for="item in items"
            :key="item.label"
            type="button"
            class="mobile-legend__sheet-item"
            :class="{ 'is-selected': selectedLabel === item.label }"
            @click="toggleHighlight(item.label)"
          >
            <span class="mobile-legend__dot mobile-legend__dot--large" :style="{ backgroundColor: item.color }" />

            <span class="mobile-legend__sheet-copy">
              <span class="mobile-legend__sheet-label">{{ item.fullLabel }}</span>
              <span class="mobile-legend__sheet-count">{{ item.count.toLocaleString() }} records</span>
            </span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<style scoped>
.mobile-legend {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 11;
}

.mobile-legend__mini-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(72px + env(safe-area-inset-bottom));
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.24);
  pointer-events: auto;
  scrollbar-width: none;
}

.mobile-legend__mini-bar::-webkit-scrollbar {
  display: none;
}

.mobile-legend__mini-item,
.mobile-legend__sheet-item,
.mobile-legend__close {
  appearance: none;
  border: 0;
  cursor: pointer;
}

.mobile-legend__mini-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary, #e0e0e0);
  transition: background-color 0.18s ease, transform 0.18s ease;
}

.mobile-legend__mini-item:active,
.mobile-legend__sheet-item:active,
.mobile-legend__close:active {
  transform: scale(0.98);
}

.mobile-legend__mini-item.is-selected,
.mobile-legend__sheet-item.is-selected {
  background: rgba(74, 222, 128, 0.16);
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.18);
}

.mobile-legend__mini-label {
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.mobile-legend__overlay {
  background: transparent;
  pointer-events: none;
}

.mobile-legend__sheet {
  height: 40dvh !important;
  max-height: 40dvh !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  border-radius: 24px 24px 0 0;
  background: rgba(26, 26, 46, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.3);
  color: var(--color-text-primary, #e0e0e0);
  pointer-events: auto;
}

.mobile-legend__sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 10px;
}

.mobile-legend__eyebrow {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-accent, #4ade80);
}

.mobile-legend__sheet-header h2 {
  margin: 0;
  font-size: 1.06rem;
  line-height: 1.2;
}

.mobile-legend__close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
}

.mobile-legend__sheet-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding: 0 16px 20px;
}

.mobile-legend__sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  text-align: left;
}

.mobile-legend__sheet-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.mobile-legend__sheet-label {
  font-size: 0.92rem;
  font-style: italic;
  line-height: 1.2;
}

.mobile-legend__sheet-count {
  font-size: 0.76rem;
  color: var(--color-text-secondary, #aaaaaa);
  font-variant-numeric: tabular-nums;
}

.mobile-legend__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.mobile-legend__dot--large {
  width: 12px;
  height: 12px;
}
</style>
