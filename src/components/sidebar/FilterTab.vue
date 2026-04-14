<script setup>
import { computed, ref, watch } from 'vue'
import { useDataStore } from '../../stores/data'
import FilterSelect from '../FilterSelect.vue'
import DateFilter from '../DateFilter.vue'
import TimeSlider from '../TimeSlider.vue'
import { useCamidAutocomplete } from '../../composables/useCamidAutocomplete'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import config from '../../config'

const emit = defineEmits(['open-mimicry'])

const store = useDataStore()

const {
  camidInput,
  camidTextarea,
  showCamidDropdown,
  selectedSuggestionIndex,
  camidSuggestions,
  handleCamidInput,
  selectCamid,
  handleCamidKeydown,
  handleCamidBlur,
  handleCamidClick
} = useCamidAutocomplete(store)

const accordionSections = ref(['time-range'])
const goatChromosomeMinInput = ref(store.filters.goatChromosomeMin ?? '')
const goatChromosomeMaxInput = ref(store.filters.goatChromosomeMax ?? '')
const showExactDates = ref(false)

const totalRecords = computed(() => store.allFeatures.length)
const filteredRecords = computed(() => store.filteredGeoJSON?.features?.length ?? 0)

const GBIF_CHILDREN = ['iNaturalist', 'GBIF (UNAM)', 'GBIF (Other Institutions)']
const TOP_LEVEL_SOURCES = computed(() => store.uniqueSources.filter(source => !GBIF_CHILDREN.includes(source)))

const stagedSources = ref([...store.filters.source])
const sourceFilterDirty = computed(() => {
  const staged = [...stagedSources.value].sort()
  const applied = [...store.filters.source].sort()
  return JSON.stringify(staged) !== JSON.stringify(applied)
})

const gbifAllSelected = computed(() => GBIF_CHILDREN.every(child => stagedSources.value.includes(child)))
const gbifSomeSelected = computed(() => GBIF_CHILDREN.some(child => stagedSources.value.includes(child)))

const toggleStagedSource = (source) => {
  const index = stagedSources.value.indexOf(source)
  if (index >= 0) stagedSources.value.splice(index, 1)
  else stagedSources.value.push(source)
}

const toggleGbifParent = () => {
  if (gbifAllSelected.value) {
    stagedSources.value = stagedSources.value.filter(source => !GBIF_CHILDREN.includes(source))
    return
  }

  for (const child of GBIF_CHILDREN) {
    if (!stagedSources.value.includes(child)) stagedSources.value.push(child)
  }
}

const applySourceFilter = () => {
  store.filters.source = [...stagedSources.value]
}

const cancelSourceFilter = () => {
  stagedSources.value = [...store.filters.source]
}

const toggleGoatSource = (source) => {
  const index = store.filters.goatDataSource.indexOf(source)
  if (index >= 0) store.filters.goatDataSource.splice(index, 1)
  else store.filters.goatDataSource.push(source)
}

const parsedCamidCount = computed(() => {
  if (!store.filters.camidSearch) return 0
  return store.filters.camidSearch.split(/[\s,\n]+/).map(value => value.trim()).filter(Boolean).length
})

const taxonomyAdvancedCount = computed(() => [store.filters.family, store.filters.tribe, store.filters.genus].filter(value => value !== 'All').length)
const dateFilterCount = computed(() => [store.filters.dateStart, store.filters.dateEnd].filter(Boolean).length)
const goatFilterCount = computed(() => {
  let count = 0
  if (store.filters.goatCoverage !== 'all') count += 1
  count += store.filters.goatDataSource.length
  if (store.filters.goatChromosomeMin != null) count += 1
  if (store.filters.goatChromosomeMax != null) count += 1
  return count
})
const boundingBoxCount = computed(() => (store.boundingBox ? 1 : 0))

const activeFilterCount = computed(() => {
  let count = 0
  if (parsedCamidCount.value) count += parsedCamidCount.value
  count += store.filters.species.length
  count += store.filters.subspecies.length
  count += taxonomyAdvancedCount.value
  count += store.filters.mimicry.length
  count += store.filters.status.length
  if (!(store.filters.source.length === 1 && store.filters.source[0] === 'Sanger Institute')) count += store.filters.source.length
  count += dateFilterCount.value
  count += goatFilterCount.value
  if (store.filters.country !== 'All') count += 1
  if (store.filters.sex !== 'all') count += 1
  count += boundingBoxCount.value
  return count
})

const setAccordionOpen = (value) => {
  accordionSections.value = Array.isArray(value) ? value : value ? [value] : []
}

watch(() => store.filters.source, (value) => {
  stagedSources.value = [...value]
}, { deep: true })

watch(() => store.filters.goatChromosomeMin, (value) => {
  goatChromosomeMinInput.value = value ?? ''
})

watch(() => store.filters.goatChromosomeMax, (value) => {
  goatChromosomeMaxInput.value = value ?? ''
})
</script>

<template>
  <div class="tab-panel filter-tab">
    <div class="record-count filter-tab-banner">
      <span class="count">{{ filteredRecords.toLocaleString() }}</span>
      <span class="label">of {{ totalRecords.toLocaleString() }} records</span>
      <span v-if="activeFilterCount > 0" class="filter-tab-active-count">{{ activeFilterCount }} active</span>
    </div>

    <div v-if="store.boundingBox" class="bbox-indicator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
        <rect x="3" y="3" width="18" height="18" rx="0" />
      </svg>
      <span>Spatial filter active</span>
      <button class="bbox-clear" @click="store.boundingBox = null">Clear</button>
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search CAMIDs
        <span v-if="parsedCamidCount" class="inline-pill">{{ parsedCamidCount }}</span>
      </label>
      <p class="filter-hint filter-hint-tight">Enter or paste multiple IDs (comma/space/newline separated)</p>
      <div class="camid-autocomplete">
        <textarea
          ref="camidTextarea"
          class="camid-textarea"
          placeholder="e.g. CAM012345, CAM012346..."
          :value="camidInput"
          rows="1"
          autocomplete="off"
          spellcheck="false"
          @input="handleCamidInput"
          @keydown="handleCamidKeydown"
          @click="handleCamidClick"
          @focus="handleCamidClick"
          @blur="handleCamidBlur"
        />
        <div v-if="showCamidDropdown && camidSuggestions.length > 0" class="camid-dropdown">
          <button
            v-for="(suggestion, index) in camidSuggestions"
            :key="suggestion"
            class="camid-suggestion"
            :class="{ selected: index === selectedSuggestionIndex }"
            @mousedown.prevent="selectCamid(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v18m-6-6 6 6 6-6" />
        </svg>
        Taxonomy
      </label>

      <FilterSelect
        label="Species"
        v-model="store.filters.species"
        :options="store.uniqueSpecies"
        placeholder="Search species..."
        :multiple="true"
      />

      <FilterSelect
        label="Subspecies"
        v-model="store.filters.subspecies"
        :options="store.uniqueSubspecies"
        placeholder="Search subspecies..."
        :multiple="true"
      />

      <Accordion type="single" collapsible class="nested-accordion">
        <AccordionItem value="advanced-taxonomy" class="sidebar-accordion-item">
          <AccordionTrigger class="sidebar-accordion-trigger compact-trigger">
            <span class="accordion-trigger-copy">Family / Tribe / Genus</span>
            <span v-if="taxonomyAdvancedCount" class="active-badge">{{ taxonomyAdvancedCount }}</span>
          </AccordionTrigger>
          <AccordionContent class="sidebar-accordion-content nested-accordion-content">
            <FilterSelect
              label="Family"
              v-model="store.filters.family"
              :options="['All', ...store.uniqueFamilies]"
              placeholder="All Families"
              :multiple="false"
              :show-count="false"
            />
            <FilterSelect
              label="Tribe"
              v-model="store.filters.tribe"
              :options="['All', ...store.uniqueTribes]"
              placeholder="All Tribes"
              :multiple="false"
              :show-count="false"
            />
            <FilterSelect
              label="Genus"
              v-model="store.filters.genus"
              :options="['All', ...store.uniqueGenera]"
              placeholder="All Genera"
              :multiple="false"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>

    <div v-if="config.features.mimicrySelector" class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C8 6 4 8 4 13a8 8 0 0 0 16 0c0-5-4-7-8-11Z" />
        </svg>
        Mimicry Ring
        <span v-if="store.filters.mimicry.length" class="inline-pill">{{ store.filters.mimicry.length }}</span>
      </label>
      <button class="mimicry-launch" @click="emit('open-mimicry')">
        <img src="../../assets/Mimicry_bttn.svg" alt="Mimicry" class="mimicry-inline-icon" />
        <span>{{ store.filters.mimicry.length > 0 ? `${store.filters.mimicry.length} ring${store.filters.mimicry.length > 1 ? 's' : ''} selected` : 'Open visual mimicry selector' }}</span>
      </button>
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        Sequencing Status
      </label>
      <FilterSelect
        v-model="store.filters.status"
        :options="store.uniqueStatuses"
        placeholder="All Statuses"
        :multiple="true"
      />
      <p v-if="store.filters.status.length > 0" class="filter-hint">{{ store.filters.status.length }} status{{ store.filters.status.length > 1 ? 'es' : '' }} selected</p>
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
        Data Source
      </label>
      <div class="source-checkbox-panel">
        <label v-for="source in TOP_LEVEL_SOURCES" :key="source" class="source-checkbox">
          <input type="checkbox" :checked="stagedSources.includes(source)" @change="toggleStagedSource(source)">
          <span>{{ source }}</span>
        </label>

        <label class="source-checkbox gbif-parent">
          <input type="checkbox" :checked="gbifAllSelected" :indeterminate="gbifSomeSelected && !gbifAllSelected" @change="toggleGbifParent">
          <span>GBIF</span>
        </label>

        <label v-for="child in GBIF_CHILDREN" :key="child" class="source-checkbox gbif-child">
          <input type="checkbox" :checked="stagedSources.includes(child)" @change="toggleStagedSource(child)">
          <span>{{ child }}</span>
        </label>

        <div v-if="sourceFilterDirty" class="source-filter-actions">
          <button class="btn-source-cancel" @click="cancelSourceFilter">Cancel</button>
          <button class="btn-source-apply" @click="applySourceFilter">Apply</button>
        </div>
      </div>
      <p v-if="store.sourceLoading.size > 0" class="filter-hint">Loading {{ [...store.sourceLoading].join(', ') }}...</p>
      <p v-else-if="store.filters.source.length === 0" class="filter-hint">No sources selected - showing all data</p>
    </div>

    <Accordion type="multiple" :model-value="accordionSections" class="sidebar-accordion" @update:model-value="setAccordionOpen">
      <AccordionItem value="time-range" class="sidebar-accordion-item filter-card">
        <AccordionTrigger class="sidebar-accordion-trigger">
          <span class="accordion-trigger-copy">Time Range</span>
          <span v-if="dateFilterCount" class="active-badge">{{ dateFilterCount }}</span>
        </AccordionTrigger>
        <AccordionContent class="sidebar-accordion-content no-top-padding">
          <TimeSlider />
          <div class="exact-dates-section">
            <button class="subsection-toggle" :class="{ expanded: showExactDates }" @click="showExactDates = !showExactDates">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
              Exact Dates
            </button>
            <div v-show="showExactDates" class="subsection-content">
              <DateFilter />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="config.features.goatIntegration" value="goat" class="sidebar-accordion-item filter-card">
        <AccordionTrigger class="sidebar-accordion-trigger">
          <span class="accordion-trigger-copy">Genomic Data (GoaT)</span>
          <span v-if="goatFilterCount" class="active-badge">{{ goatFilterCount }}</span>
          <span v-if="store.goatLoading" class="active-badge active-badge-loading">Loading...</span>
        </AccordionTrigger>
        <AccordionContent class="sidebar-accordion-content">
          <div class="goat-filter-group">
            <label class="goat-filter-label">GoaT Coverage</label>
            <div class="goat-toggle-group">
              <button :class="{ active: store.filters.goatCoverage === 'all' }" @click="store.filters.goatCoverage = 'all'">All</button>
              <button :class="{ active: store.filters.goatCoverage === 'in_goat' }" @click="store.filters.goatCoverage = 'in_goat'">In GoaT</button>
              <button :class="{ active: store.filters.goatCoverage === 'not_in_goat' }" @click="store.filters.goatCoverage = 'not_in_goat'">Not in GoaT</button>
            </div>
          </div>

          <div class="goat-filter-group">
            <label class="goat-filter-label">Genome Data Source</label>
            <div class="goat-checkboxes">
              <label class="source-checkbox">
                <input type="checkbox" :checked="store.filters.goatDataSource.includes('direct')" @change="toggleGoatSource('direct')">
                <span>Direct (measured)</span>
              </label>
              <label class="source-checkbox">
                <input type="checkbox" :checked="store.filters.goatDataSource.includes('estimated')" @change="toggleGoatSource('estimated')">
                <span>Estimated (phylogenetic)</span>
              </label>
              <label class="source-checkbox">
                <input type="checkbox" :checked="store.filters.goatDataSource.includes('none')" @change="toggleGoatSource('none')">
                <span>No GoaT data</span>
              </label>
            </div>
          </div>

          <div class="goat-filter-group">
            <label class="goat-filter-label">Chromosome Number (2n)</label>
            <div class="chr-range-inputs">
              <input
                v-model="goatChromosomeMinInput"
                type="number"
                class="chr-input"
                placeholder="Min"
                :min="store.chromosomeRange.min"
                :max="store.chromosomeRange.max"
                @change="store.filters.goatChromosomeMin = goatChromosomeMinInput ? Number(goatChromosomeMinInput) : null"
              >
              <span class="chr-separator">–</span>
              <input
                v-model="goatChromosomeMaxInput"
                type="number"
                class="chr-input"
                placeholder="Max"
                :min="store.chromosomeRange.min"
                :max="store.chromosomeRange.max"
                @change="store.filters.goatChromosomeMax = goatChromosomeMaxInput ? Number(goatChromosomeMaxInput) : null"
              >
            </div>
          </div>

          <p v-if="store.goatLoaded && store.goatMeta" class="filter-hint">{{ store.goatMeta.totalSpecies.toLocaleString() }} species from GoaT</p>
          <p v-else-if="!store.goatLoaded && !store.goatLoading" class="filter-hint">GoaT data not available</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        Country
      </label>
      <FilterSelect
        v-model="store.filters.country"
        :options="['All', ...store.uniqueCountries]"
        placeholder="All Countries"
        :multiple="false"
        :show-count="false"
      />
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="9" r="5" />
          <path d="M9 14v7M6 18h6" />
          <circle cx="17" cy="15" r="5" />
          <path d="M21 11l-2.5 2.5M21 11h-4M21 11v4" />
        </svg>
        Sex
      </label>
      <select v-model="store.filters.sex" class="sex-select">
        <option value="all">All (♂ + ♀)</option>
        <option value="male">♂ Male only</option>
        <option value="female">♀ Female only</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.filter-tab-banner {
  position: relative;
}

.filter-tab-active-count {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.18);
  color: var(--color-accent, #4ade80);
  font-size: 0.72rem;
  font-weight: 700;
}

.inline-pill {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.16);
  color: var(--color-accent, #4ade80);
  font-size: 0.68rem;
  font-weight: 700;
}

.filter-hint-tight {
  margin-top: 0;
  margin-bottom: 6px;
}

.sidebar-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.nested-accordion {
  margin-top: 12px;
}

.sidebar-accordion-item {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-accordion-trigger {
  padding: 12px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none !important;
}

.sidebar-accordion-trigger:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.compact-trigger {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  background: var(--color-bg-primary, #1a1a2e);
  padding: 10px 12px;
}

.accordion-trigger-copy {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sidebar-accordion-content {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.nested-accordion-content {
  padding: 12px;
  border-top: none;
  background: var(--color-bg-primary, #1a1a2e);
}

.no-top-padding {
  padding: 0;
}

.mimicry-launch {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mimicry-launch:hover {
  border-color: var(--color-accent, #4ade80);
  background: #353558;
}

.mimicry-inline-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.active-badge-loading {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
</style>
