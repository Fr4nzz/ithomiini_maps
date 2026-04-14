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
  <aside class="flex h-screen min-w-[340px] w-[340px] flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] print:hidden max-md:h-auto max-md:max-h-[50vh] max-md:min-w-full max-md:w-full">
    <header class="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5">
      <a
        :href="config.repoUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-3 no-underline transition-opacity duration-200 hover:opacity-85"
      >
        <img :src="config.logoPath" :alt="`${config.title} Maps`" class="h-10 w-10">
        <div class="flex flex-col">
          <span class="text-[1.25rem] font-semibold tracking-[-0.5px] text-[var(--color-text-primary)]">{{ config.title }}</span>
          <span class="text-xs uppercase tracking-[1px] text-[var(--color-text-muted)]">{{ config.subtitle }}</span>
        </div>
      </a>
    </header>

    <div class="flex-1 overflow-y-auto p-4 pt-3.5">
      <QuickActions
        :current-view="currentView"
        @change-tab="activeTab = $event"
        @open-gallery="emit('open-gallery')"
        @open-mimicry="emit('open-mimicry')"
        @set-view="emit('set-view', $event)"
      />

      <Tabs v-model="activeTab" class="flex flex-col gap-2.5">
        <TabsList class="grid w-full grid-cols-3 gap-1.5 border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1">
          <TabsTrigger value="filter" class="text-[var(--color-text-secondary)]">{{ filterTabLabel }}</TabsTrigger>
          <TabsTrigger value="style" class="text-[var(--color-text-secondary)]">Style</TabsTrigger>
          <TabsTrigger value="export" class="text-[var(--color-text-secondary)]">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="filter">
          <FilterTab @open-mimicry="emit('open-mimicry')" />
        </TabsContent>

        <TabsContent value="style">
          <StyleTab :current-view="currentView" />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab
            :current-view="currentView"
            @open-map-export="emit('open-map-export')"
            @export-for-r="emit('export-for-r')"
          />
        </TabsContent>
      </Tabs>
    </div>

    <footer class="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 pb-4 pt-3">
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          @click="store.resetAllFilters"
        >
          Reset
        </button>
        <button
          class="flex-1 rounded-md bg-[var(--color-accent)] px-2 py-2.5 text-xs font-medium text-[var(--color-bg-primary)] transition-colors duration-200 hover:bg-[var(--color-accent-hover)]"
          @click="activeTab = 'export'"
        >
          Export Tab
        </button>
      </div>
    </footer>
  </aside>
</template>
