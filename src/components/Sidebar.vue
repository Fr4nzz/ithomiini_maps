<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '../stores/data'
import FilterTab from './sidebar/FilterTab.vue'
import StyleTab from './sidebar/StyleTab.vue'
import ExportTab from './sidebar/ExportTab.vue'
import QuickActions from './sidebar/QuickActions.vue'
import Tabs from './ui/tabs/Tabs.vue'
import TabsContent from './ui/tabs/TabsContent.vue'
import TabsList from './ui/tabs/TabsList.vue'
import TabsTrigger from './ui/tabs/TabsTrigger.vue'
import config from '../config'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'export-for-r', 'set-view'])

const store = useDataStore()
const activeTab = ref('filter')

const filterTabLabel = computed(() => {
  let count = 0
  count += store.filters.species.length
  count += store.filters.subspecies.length
  count += store.filters.mimicry.length
  count += store.filters.status.length
  if (store.filters.family !== 'All') count += 1
  if (store.filters.tribe !== 'All') count += 1
  if (store.filters.genus !== 'All') count += 1
  if (store.filters.country !== 'All') count += 1
  if (store.filters.sex !== 'all') count += 1
  if (store.filters.dateStart) count += 1
  if (store.filters.dateEnd) count += 1
  if (store.boundingBox) count += 1
  return count > 0 ? `Filter · ${count}` : 'Filter'
})
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar-header">
      <a :href="config.repoUrl" target="_blank" rel="noopener noreferrer" class="logo">
        <img :src="config.logoPath" :alt="`${config.title} Maps`" class="logo-icon">
        <div class="logo-text">
          <span class="title">{{ config.title }}</span>
          <span class="subtitle">{{ config.subtitle }}</span>
        </div>
      </a>
    </header>

    <div class="sidebar-content sidebar-tabs-shell">
      <QuickActions
        :current-view="currentView"
        @change-tab="activeTab = $event"
        @open-gallery="emit('open-gallery')"
        @open-mimicry="emit('open-mimicry')"
        @set-view="emit('set-view', $event)"
      />

      <Tabs v-model="activeTab" class="sidebar-tabs-root">
        <TabsList class="sidebar-tabs-list">
          <TabsTrigger value="filter" class="sidebar-tabs-trigger">{{ filterTabLabel }}</TabsTrigger>
          <TabsTrigger value="style" class="sidebar-tabs-trigger">Style</TabsTrigger>
          <TabsTrigger value="export" class="sidebar-tabs-trigger">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="filter" class="sidebar-tabs-content">
          <FilterTab @open-mimicry="emit('open-mimicry')" />
        </TabsContent>

        <TabsContent value="style" class="sidebar-tabs-content">
          <StyleTab :current-view="currentView" />
        </TabsContent>

        <TabsContent value="export" class="sidebar-tabs-content">
          <ExportTab
            :current-view="currentView"
            @open-map-export="emit('open-map-export')"
            @export-for-r="emit('export-for-r')"
          />
        </TabsContent>
      </Tabs>
    </div>

    <footer class="sidebar-footer sidebar-footer-minimal">
      <div class="footer-row">
        <button class="btn-reset" @click="store.resetAllFilters">Reset</button>
        <button class="btn-export" @click="activeTab = 'export'">Export Tab</button>
      </div>
    </footer>
  </aside>
</template>

<style src="./sidebar-styles.css"></style>
<style scoped>
.sidebar-tabs-shell {
  padding-top: 14px;
}

.sidebar-tabs-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-tabs-list {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  padding: 4px;
}

.sidebar-tabs-trigger {
  color: var(--color-text-secondary, #aaa);
}

.sidebar-tabs-content {
  margin-top: 0;
}

.sidebar-footer-minimal {
  padding-top: 12px;
}
</style>
