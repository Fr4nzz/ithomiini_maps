<script setup>
import { computed } from 'vue'
import { useDataStore } from '../../stores/data'
import { Image, Layers3, Map as MapIcon, ScanSearch, Table2 } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import TooltipProvider from '../ui/tooltip/TooltipProvider.vue'
import config from '../../config'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-gallery', 'open-mimicry', 'set-view', 'change-tab'])

const store = useDataStore()

const imageCount = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo?.features) return 0
  return geo.features.filter(feature => feature.properties?.image_url).length
})

const quickActions = computed(() => [
  {
    key: 'map',
    label: 'Map view',
    icon: MapIcon,
    active: props.currentView === 'map',
    hidden: false,
    disabled: false,
    badge: null,
    onClick: () => emit('set-view', 'map')
  },
  {
    key: 'table',
    label: 'Table view',
    icon: Table2,
    active: props.currentView === 'table',
    hidden: false,
    disabled: false,
    badge: null,
    onClick: () => emit('set-view', 'table')
  },
  {
    key: 'gallery',
    label: 'Open gallery',
    icon: Image,
    active: false,
    hidden: !config.features.imageGallery,
    disabled: imageCount.value === 0,
    badge: imageCount.value > 0 ? imageCount.value : null,
    onClick: () => emit('open-gallery')
  },
  {
    key: 'mimicry',
    label: 'Open mimicry selector',
    icon: ScanSearch,
    active: store.filters.mimicry.length > 0,
    hidden: !config.features.mimicrySelector,
    disabled: false,
    badge: store.filters.mimicry.length || null,
    onClick: () => emit('open-mimicry')
  },
  {
    key: 'export',
    label: store.exportSettings.enabled ? 'Hide export preview' : 'Show export preview',
    icon: Layers3,
    active: store.exportSettings.enabled,
    hidden: props.currentView !== 'map',
    disabled: false,
    badge: null,
    onClick: () => {
      store.exportSettings.enabled = !store.exportSettings.enabled
      emit('change-tab', 'export')
    }
  }
].filter(action => !action.hidden))
</script>

<template>
  <TooltipProvider>
    <div class="quick-actions-strip">
      <Tooltip v-for="action in quickActions" :key="action.key">
        <TooltipTrigger as-child>
          <button
            class="quick-action-icon"
            :class="{ active: action.active }"
            :disabled="action.disabled"
            :aria-label="action.label"
            :title="action.label"
            @click="action.onClick"
          >
            <component :is="action.icon" :size="16" />
            <span v-if="action.badge" class="quick-action-badge">{{ action.badge }}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ action.label }}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.quick-actions-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.quick-action-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-icon:hover:not(:disabled) {
  border-color: var(--color-accent, #4ade80);
  color: var(--color-text-primary, #e0e0e0);
  background: #353558;
}

.quick-action-icon.active {
  background: rgba(74, 222, 128, 0.14);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-accent, #4ade80);
}

.quick-action-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.quick-action-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  padding: 2px 5px;
  border-radius: 999px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}
</style>
