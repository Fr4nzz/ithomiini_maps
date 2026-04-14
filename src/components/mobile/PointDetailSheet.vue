<script setup>
import { computed, inject, ref } from 'vue'
import { useDataStore } from '../../stores/data'
import { getThumbnailUrl } from '../../utils/imageProxy'
import { STATUS_COLORS } from '../../utils/constants'
import { getGoatUrl } from '../../utils/goatHelpers'
import { usePopupSelection } from '../../composables/usePopupSelection'
import { Drawer, DrawerContent } from '../ui/drawer'

const mobileLayout = inject('mobileLayout')
const openImageGallery = inject('openImageGallery', () => {})

if (!mobileLayout) {
  throw new Error('PointDetailSheet requires mobileLayout injection')
}

const store = useDataStore()
const copyFeedback = ref('')
const SNAP_POINTS = [0.15, 0.5, 0.9]

const sheetOpen = computed({
  get: () => mobileLayout.activeSheet.value === 'detail' && !!mobileLayout.detailPointData.value,
  set: (value) => {
    if (!value) {
      mobileLayout.closeSheet()
    }
  },
})

const activeSnapPoint = computed({
  get: () => mobileLayout.sheetSnapPoint.value,
  set: (value) => {
    mobileLayout.sheetSnapPoint.value = typeof value === 'number' ? value : 0.15
  },
})

const detailData = computed(() => mobileLayout.detailPointData.value)
const points = computed(() => detailData.value?.points || [])
const groupedBySpecies = computed(() => store.groupPointsBySpecies(points.value))
const speciesList = computed(() => store.getSpeciesWithPhotos(points.value))

const {
  selectedSpecies,
  selectedSubspecies,
  selectedIndividualIndex,
  subspeciesList,
  individualsList,
  selectSpecies,
  selectSubspecies,
  locationName,
} = usePopupSelection(points, groupedBySpecies, speciesList, {
  initialSpecies: computed(() => detailData.value?.initialSpecies || null),
  initialSubspecies: computed(() => detailData.value?.initialSubspecies || null),
})

const currentIndividual = computed(() => {
  const list = individualsList.value
  if (!list.length) return null
  const idx = Math.min(selectedIndividualIndex.value, list.length - 1)
  return list[idx]
})

const currentPhoto = computed(() => {
  if (!currentIndividual.value) return null
  return store.getPhotoForItem(currentIndividual.value)
})

const isPeekStage = computed(() => activeSnapPoint.value <= 0.15)
const isExpandedStage = computed(() => activeSnapPoint.value > 0.15 && activeSnapPoint.value < 0.9)
const isFullStage = computed(() => activeSnapPoint.value >= 0.9)

const scientificLabel = computed(() => {
  const species = selectedSpecies.value || currentIndividual.value?.scientific_name || currentIndividual.value?.species || 'Unknown species'
  const subspecies = selectedSubspecies.value && selectedSubspecies.value !== species
    ? selectedSubspecies.value
    : currentIndividual.value?.subspecies

  return {
    species,
    subspecies: subspecies && subspecies !== 'Unknown' ? subspecies : null,
  }
})

const summaryDate = computed(() => currentIndividual.value?.observation_date || currentIndividual.value?.date || 'Date unavailable')

const coordinatesLabel = computed(() => {
  const lat = currentIndividual.value?.lat ?? detailData.value?.coordinates?.lat
  const lng = currentIndividual.value?.lng ?? detailData.value?.coordinates?.lng

  if (typeof lat !== 'number' || typeof lng !== 'number') return 'Coordinates unavailable'
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
})

const sourceLabel = computed(() => currentIndividual.value?.source || 'Unknown source')
const camidLabel = computed(() => currentIndividual.value?.id || currentIndividual.value?.CAMID || currentIndividual.value?.camid || 'Unknown')
const statusLabel = computed(() => currentIndividual.value?.sequencing_status || currentIndividual.value?.status || 'Unknown')
const statusColor = computed(() => STATUS_COLORS[statusLabel.value] || '#7c8aa5')

const goatInfo = computed(() => {
  const species = selectedSpecies.value || currentIndividual.value?.scientific_name
  if (!species) return null
  return store.getGoatForSpecies(species)
})

const goatTaxonUrl = computed(() => getGoatUrl(selectedSpecies.value || currentIndividual.value?.scientific_name, store.getGoatForSpecies))
const bioprojectUrl = computed(() => {
  const bioproject = goatInfo.value?.bioproject?.value
  return bioproject ? `https://www.ncbi.nlm.nih.gov/bioproject/${bioproject}` : null
})

const visibleFields = computed(() => {
  const individual = currentIndividual.value
  if (!individual) return []

  return [
    ['Species', individual.scientific_name],
    ['Subspecies', individual.subspecies],
    ['Genus', individual.genus],
    ['Family', individual.family],
    ['Country', individual.country],
    ['Location', locationName.value],
    ['Date', individual.observation_date || individual.date],
    ['Source', individual.source],
    ['CAMID', individual.id || individual.CAMID || individual.camid],
    ['Status', individual.sequencing_status || individual.status],
    ['Coordinates', coordinatesLabel.value],
    ['Mimicry ring', individual.mimicry_ring],
    ['Sex', individual.sex],
  ].filter(([, value]) => value && value !== 'Unknown' && value !== 'NA')
})

const externalRecordUrl = computed(() => currentIndividual.value?.observation_url || currentIndividual.value?.gbif_url || null)
const showGalleryButton = computed(() => !!currentPhoto.value?.url)

const navigateIndividual = (direction) => {
  const nextIndex = selectedIndividualIndex.value + direction
  if (nextIndex < 0 || nextIndex >= individualsList.value.length) return
  selectedIndividualIndex.value = nextIndex
}

const openGallery = () => {
  if (!currentIndividual.value) return

  store.gallerySelection = {
    species: selectedSpecies.value,
    subspecies: selectedSubspecies.value,
    individualId: currentIndividual.value.id,
  }

  openImageGallery()
}

const copyCoordinates = async () => {
  if (!coordinatesLabel.value || coordinatesLabel.value === 'Coordinates unavailable' || !navigator?.clipboard) return

  try {
    await navigator.clipboard.writeText(coordinatesLabel.value)
    copyFeedback.value = 'Copied'
  } catch {
    copyFeedback.value = 'Copy failed'
  }

  window.setTimeout(() => {
    copyFeedback.value = ''
  }, 1600)
}

const isEstimated = (field) => field?.source === 'ancestor'
const goatSourceLabel = (field) => field?.source === 'ancestor'
  ? `Estimated from ${field.aggregation_rank || 'relatives'}`
  : ''
</script>

<template>
  <Drawer
    v-model:open="sheetOpen"
    v-model:active-snap-point="activeSnapPoint"
    :snap-points="SNAP_POINTS"
    :modal="false"
    :dismissible="true"
    :fade-from-index="2"
    :should-scale-background="false"
    direction="bottom"
  >
    <DrawerContent
      overlay-class="bg-transparent pointer-events-none"
      class="point-detail-sheet"
      :class="{
        'is-peek': isPeekStage,
        'is-expanded': isExpandedStage,
        'is-full': isFullStage,
      }"
      @pointer-down-outside.prevent
      @interact-outside.prevent
    >
      <div v-if="currentIndividual" class="sheet-shell">
        <div class="sheet-topline">
          <div class="sheet-kicker">{{ detailData?.isCluster ? 'Cluster detail' : 'Specimen detail' }}</div>
          <button class="sheet-close" @click="mobileLayout.closeSheet()" aria-label="Close detail sheet">×</button>
        </div>

        <section class="sheet-summary">
          <div class="summary-copy">
            <p class="species-line"><strong>{{ scientificLabel.species }}</strong></p>
            <p class="location-line">{{ locationName || currentIndividual.country || 'Location unavailable' }}</p>
            <p class="date-line">{{ summaryDate }}</p>
          </div>
          <div class="stage-chip">{{ isFullStage ? 'Full' : isExpandedStage ? 'Expanded' : 'Peek' }}</div>
        </section>

        <section v-if="!isPeekStage" class="sheet-expanded-grid">
          <div class="photo-card">
            <img
              v-if="currentPhoto?.url"
              :src="getThumbnailUrl(currentPhoto.url)"
              :alt="camidLabel"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div v-else class="photo-fallback">No photo</div>
          </div>

          <div class="primary-meta">
            <div class="taxon-block">
              <p class="taxon-species">{{ scientificLabel.species }}</p>
              <p v-if="scientificLabel.subspecies" class="taxon-subspecies">{{ scientificLabel.subspecies }}</p>
            </div>

            <div class="meta-stack">
              <div class="meta-row">
                <span>Coordinates</span>
                <strong>{{ coordinatesLabel }}</strong>
              </div>
              <div class="meta-row">
                <span>Source</span>
                <strong>{{ sourceLabel }}</strong>
              </div>
              <div class="meta-row">
                <span>CAMID</span>
                <strong>{{ camidLabel }}</strong>
              </div>
              <div class="meta-row">
                <span>Status</span>
                <strong class="status-pill" :style="{ '--status-color': statusColor }">{{ statusLabel }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section v-if="isFullStage" class="sheet-full-content">
          <div class="selector-card">
            <label>
              <span>Species</span>
              <select :value="selectedSpecies || ''" @change="selectSpecies($event.target.value || null)">
                <option v-for="item in speciesList" :key="item.species" :value="item.species">
                  {{ item.species }} ({{ item.count }})
                </option>
              </select>
            </label>

            <label v-if="subspeciesList.length">
              <span>Subspecies</span>
              <select :value="selectedSubspecies || ''" @change="selectSubspecies($event.target.value || null)">
                <option v-for="item in subspeciesList" :key="item.name" :value="item.name">
                  {{ item.name }} ({{ item.count }})
                </option>
              </select>
            </label>
          </div>

          <div class="navigation-card">
            <button class="nav-btn" :disabled="selectedIndividualIndex <= 0" @click="navigateIndividual(-1)">←</button>
            <div class="nav-copy">
              <span>Individual</span>
              <strong>{{ selectedIndividualIndex + 1 }}/{{ individualsList.length }}</strong>
            </div>
            <button class="nav-btn" :disabled="selectedIndividualIndex >= individualsList.length - 1" @click="navigateIndividual(1)">→</button>
          </div>

          <div class="detail-card">
            <div class="card-title">Record fields</div>
            <div class="field-list">
              <div v-for="([label, value]) in visibleFields" :key="label" class="field-row">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </div>
            </div>
          </div>

          <div v-if="goatInfo && !store.goatLoading" class="detail-card goat-card">
            <div class="card-title-row">
              <div class="card-title">GoaT genomic data</div>
              <a v-if="goatTaxonUrl" :href="goatTaxonUrl" target="_blank" rel="noopener noreferrer">Open GoaT</a>
            </div>
            <div class="goat-grid">
              <div v-if="goatInfo.genome_size" class="goat-cell">
                <span>Genome size</span>
                <strong :title="goatSourceLabel(goatInfo.genome_size)">{{ store.formatGenomeSize(goatInfo.genome_size.value) }}</strong>
              </div>
              <div v-if="goatInfo.chromosome_number" class="goat-cell">
                <span>2n</span>
                <strong :title="goatSourceLabel(goatInfo.chromosome_number)">{{ goatInfo.chromosome_number.value }}</strong>
              </div>
              <div v-if="goatInfo.haploid_number" class="goat-cell">
                <span>n</span>
                <strong :title="goatSourceLabel(goatInfo.haploid_number)">{{ goatInfo.haploid_number.value }}</strong>
              </div>
              <div v-if="goatInfo.gc_percent" class="goat-cell">
                <span>GC%</span>
                <strong :title="goatSourceLabel(goatInfo.gc_percent)">
                  {{ typeof goatInfo.gc_percent.value === 'number' ? goatInfo.gc_percent.value.toFixed(1) + '%' : goatInfo.gc_percent.value }}
                </strong>
              </div>
              <div v-if="goatInfo.busco_completeness" class="goat-cell">
                <span>BUSCO</span>
                <strong :title="goatSourceLabel(goatInfo.busco_completeness)">
                  {{ typeof goatInfo.busco_completeness.value === 'number' ? goatInfo.busco_completeness.value.toFixed(1) + '%' : goatInfo.busco_completeness.value }}
                </strong>
              </div>
              <div v-if="goatInfo.assembly_level" class="goat-cell goat-cell-wide">
                <span>Assembly</span>
                <strong :title="goatSourceLabel(goatInfo.assembly_level)">{{ goatInfo.assembly_level.value }}</strong>
              </div>
              <div v-if="goatInfo.bioproject" class="goat-cell goat-cell-wide">
                <span>BioProject</span>
                <a v-if="bioprojectUrl" :href="bioprojectUrl" target="_blank" rel="noopener noreferrer">{{ goatInfo.bioproject.value }}</a>
                <strong v-else>{{ goatInfo.bioproject.value }}</strong>
              </div>
            </div>
            <p v-if="Object.values(goatInfo).some(isEstimated)" class="goat-note">Estimated values are inferred from related taxa.</p>
          </div>

          <div class="action-row">
            <button v-if="showGalleryButton" class="primary-btn" @click="openGallery">Open Gallery</button>
            <button class="secondary-btn" @click="copyCoordinates">{{ copyFeedback || 'Copy coordinates' }}</button>
            <a v-if="externalRecordUrl" class="secondary-btn link-btn" :href="externalRecordUrl" target="_blank" rel="noopener noreferrer">
              Open GBIF link
            </a>
          </div>
        </section>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.point-detail-sheet {
  max-height: 92dvh;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: none;
  border-radius: 28px 28px 0 0;
  background:
    linear-gradient(180deg, rgba(10, 17, 26, 0.92) 0%, rgba(13, 23, 35, 0.96) 100%),
    radial-gradient(circle at top left, rgba(74, 222, 128, 0.18), transparent 40%);
  backdrop-filter: blur(18px) saturate(150%);
  color: #ecf4ff;
}

.point-detail-sheet.is-peek,
.point-detail-sheet.is-expanded {
  background:
    linear-gradient(180deg, rgba(10, 17, 26, 0.72) 0%, rgba(13, 23, 35, 0.84) 100%),
    radial-gradient(circle at top left, rgba(74, 222, 128, 0.16), transparent 38%);
}

.point-detail-sheet.is-full {
  background:
    linear-gradient(180deg, rgba(10, 17, 26, 0.97) 0%, rgba(13, 23, 35, 1) 100%),
    radial-gradient(circle at top left, rgba(74, 222, 128, 0.18), transparent 40%);
}

.sheet-shell {
  display: flex;
  max-height: 88dvh;
  flex-direction: column;
  gap: 14px;
  padding: 12px 18px 24px;
  overflow-y: auto;
}

.sheet-topline,
.sheet-summary,
.meta-row,
.field-row,
.card-title-row,
.navigation-card,
.action-row {
  display: flex;
  align-items: center;
}

.sheet-topline,
.sheet-summary,
.meta-row,
.field-row,
.card-title-row,
.navigation-card {
  justify-content: space-between;
}

.sheet-topline {
  gap: 12px;
}

.sheet-kicker,
.card-title,
.selector-card label span,
.card-title-row a {
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sheet-kicker {
  color: rgba(196, 220, 255, 0.68);
  font-size: 0.75rem;
}

.sheet-close {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: #f4fbff;
  font-size: 1.2rem;
}

.sheet-summary {
  align-items: flex-start;
  gap: 14px;
}

.species-line {
  font-size: 1rem;
}

.location-line,
.date-line {
  margin-top: 2px;
  color: rgba(226, 238, 255, 0.76);
  font-size: 0.82rem;
}

.stage-chip {
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.14);
  color: #a3f3c0;
  padding: 6px 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.sheet-expanded-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
}

.photo-card {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.photo-card img,
.photo-fallback {
  width: 100%;
  height: 100%;
}

.photo-card img {
  object-fit: cover;
}

.photo-fallback {
  display: grid;
  place-items: center;
  color: rgba(226, 238, 255, 0.62);
  font-size: 0.78rem;
}

.primary-meta,
.meta-stack,
.sheet-full-content,
.field-list,
.selector-card {
  display: flex;
  flex-direction: column;
}

.primary-meta,
.detail-card,
.selector-card,
.navigation-card {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

.primary-meta {
  padding: 12px;
  gap: 12px;
}

.taxon-species {
  font-size: 1rem;
  font-weight: 700;
}

.taxon-subspecies {
  margin-top: 2px;
  color: #a3f3c0;
  font-size: 0.8rem;
}

.meta-stack,
.sheet-full-content,
.field-list {
  gap: 10px;
}

.meta-row,
.field-row {
  gap: 12px;
  font-size: 0.8rem;
}

.meta-row span,
.field-row span,
.goat-cell span,
.nav-copy span {
  color: rgba(208, 223, 245, 0.66);
}

.meta-row strong,
.field-row strong,
.goat-cell strong,
.goat-cell a {
  color: #f4fbff;
  text-align: right;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--status-color) 18%, rgba(255, 255, 255, 0.06));
  color: var(--status-color);
  padding: 6px 10px;
}

.status-pill::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--status-color);
}

.selector-card,
.detail-card,
.navigation-card {
  padding: 14px;
}

.selector-card {
  gap: 12px;
}

.selector-card label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-card select {
  width: 100%;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 13, 22, 0.62);
  color: #f4fbff;
}

.nav-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: #f4fbff;
  font-size: 1rem;
}

.nav-btn:disabled {
  opacity: 0.35;
}

.nav-copy {
  text-align: center;
}

.nav-copy span {
  display: block;
  margin-bottom: 3px;
  font-size: 0.75rem;
}

.card-title,
.card-title-row a {
  font-size: 0.75rem;
}

.card-title,
.card-title-row a,
.goat-cell a,
.link-btn {
  color: #a3f3c0;
}

.card-title {
  margin-bottom: 10px;
}

.field-row {
  align-items: flex-start;
}

.field-row strong {
  max-width: 62%;
  word-break: break-word;
}

.goat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.goat-cell {
  display: flex;
  min-height: 60px;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(6, 12, 20, 0.5);
}

.goat-cell-wide {
  grid-column: 1 / -1;
}

.goat-note {
  margin-top: 10px;
  color: rgba(208, 223, 245, 0.62);
  font-size: 0.75rem;
}

.action-row {
  flex-wrap: wrap;
  gap: 10px;
}

.primary-btn,
.secondary-btn {
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 0 16px;
  font-weight: 700;
  text-decoration: none;
}

.primary-btn {
  background: linear-gradient(135deg, #95f0b7 0%, #49d98b 100%);
  color: #061018;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #f4fbff;
}

@media (max-width: 420px) {
  .sheet-shell {
    padding-inline: 14px;
  }

  .sheet-expanded-grid {
    grid-template-columns: 80px minmax(0, 1fr);
  }

  .action-row > * {
    flex: 1 1 100%;
  }
}
</style>
