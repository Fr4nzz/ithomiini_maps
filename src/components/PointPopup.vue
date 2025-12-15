<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'
import { getThumbnailUrl } from '../utils/imageProxy'
import { Button } from '@/components/ui/button'
import { X, Image, ExternalLink, Maximize2 } from 'lucide-vue-next'

const props = defineProps({
  coordinates: { type: Object, required: true },
  points: { type: Array, required: true },
  initialSpecies: { type: String, default: null },
  initialSubspecies: { type: String, default: null }
})

const emit = defineEmits(['close', 'open-gallery'])
const store = useDataStore()

const selectedSpecies = ref(null)
const selectedSubspecies = ref(null)
const selectedIndividualIndex = ref(0)

const STATUS_COLORS = { 'Sequenced': '#3b82f6', 'Tissue Available': '#10b981', 'Preserved Specimen': '#f59e0b', 'Published': '#a855f7', 'GBIF Record': '#6b7280', 'Observation': '#22c55e', 'Museum Specimen': '#8b5cf6', 'Living Specimen': '#14b8a6' }

const groupedBySpecies = computed(() => store.groupPointsBySpecies(props.points))
const speciesList = computed(() => store.getSpeciesWithPhotos(props.points))

const subspeciesList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) return []
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
  return Object.entries(speciesGroup.subspecies).map(([name, data]) => ({ name, count: data.count, hasPhoto: data.individuals.some(i => i.image_url) }))
    .sort((a, b) => { if (a.hasPhoto && !b.hasPhoto) return -1; if (!a.hasPhoto && b.hasPhoto) return 1; return b.count - a.count })
})

const individualsList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) return props.points
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
  if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) return speciesGroup.subspecies[selectedSubspecies.value].individuals
  return Object.values(speciesGroup.subspecies).flatMap(s => s.individuals)
})

const currentIndividual = computed(() => { const list = individualsList.value; if (list.length === 0) return null; return list[Math.min(selectedIndividualIndex.value, list.length - 1)] })
const currentPhoto = computed(() => currentIndividual.value ? store.getPhotoForItem(currentIndividual.value) : null)

const selectSpecies = (species) => {
  selectedSpecies.value = species
  if (species && groupedBySpecies.value[species]) {
    const speciesGroup = groupedBySpecies.value[species]
    const sortedSubspecies = Object.keys(speciesGroup.subspecies).map(name => ({ name, data: speciesGroup.subspecies[name], hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url) }))
      .sort((a, b) => { if (a.hasPhoto && !b.hasPhoto) return -1; if (!a.hasPhoto && b.hasPhoto) return 1; return b.data.count - a.data.count })
    selectedSubspecies.value = sortedSubspecies.length > 0 ? sortedSubspecies[0].name : null
  } else selectedSubspecies.value = null
  selectedIndividualIndex.value = 0
}

const selectSubspecies = (subspecies) => { selectedSubspecies.value = subspecies; selectedIndividualIndex.value = 0 }
const selectIndividual = (index) => { selectedIndividualIndex.value = index }

const initializeSelection = () => {
  if (props.points.length === 0) return
  if (props.initialSpecies && groupedBySpecies.value[props.initialSpecies]) {
    selectedSpecies.value = props.initialSpecies
    const speciesGroup = groupedBySpecies.value[props.initialSpecies]
    if (props.initialSubspecies && speciesGroup.subspecies[props.initialSubspecies]) selectedSubspecies.value = props.initialSubspecies
    else { const subspeciesNames = Object.keys(speciesGroup.subspecies); if (subspeciesNames.length > 0) selectedSubspecies.value = subspeciesNames[0] }
    selectedIndividualIndex.value = 0; return
  }
  const pointsWithPhoto = props.points.filter(p => p.image_url)
  const firstPoint = pointsWithPhoto.length > 0 ? pointsWithPhoto[0] : props.points[0]
  const species = firstPoint.scientific_name
  if (species && groupedBySpecies.value[species]) {
    selectedSpecies.value = species
    const subspecies = firstPoint.subspecies, speciesGroup = groupedBySpecies.value[species]
    if (subspecies && speciesGroup.subspecies[subspecies]) {
      selectedSubspecies.value = subspecies
      const individuals = speciesGroup.subspecies[subspecies].individuals
      const idx = individuals.findIndex(ind => ind.id === firstPoint.id)
      selectedIndividualIndex.value = idx >= 0 ? idx : 0
    } else { const subspeciesNames = Object.keys(speciesGroup.subspecies); if (subspeciesNames.length > 0) selectedSubspecies.value = subspeciesNames[0]; selectedIndividualIndex.value = 0 }
  }
}

initializeSelection()
watch(() => props.points, () => { initializeSelection() }, { deep: true })

const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
const totalIndividuals = computed(() => props.points.length)
const subspeciesCount = computed(() => selectedSpecies.value && groupedBySpecies.value[selectedSpecies.value] ? Object.keys(groupedBySpecies.value[selectedSpecies.value].subspecies).length : 0)
const individualsCount = computed(() => individualsList.value.length)
const locationName = computed(() => { const point = currentIndividual.value || props.points[0]; return point?.collection_location || point?.locality || point?.location || null })

const openGallery = () => { store.gallerySelection = { species: selectedSpecies.value, subspecies: selectedSubspecies.value, individualId: currentIndividual.value?.id }; emit('open-gallery') }
</script>

<template>
  <div class="relative bg-background text-foreground rounded-xl p-4 min-w-[420px] max-w-[500px] shadow-2xl border border-border">
    <Button variant="ghost" size="icon" class="absolute top-2.5 right-2.5 h-7 w-7 z-10" @click="emit('close')"><X class="w-4 h-4" /></Button>

    <div class="flex gap-4">
      <!-- Left Column -->
      <div class="w-[170px] flex-shrink-0 flex flex-col gap-2.5">
        <!-- Photo -->
        <div class="relative w-[170px] h-[170px] bg-muted rounded-lg overflow-hidden border border-border">
          <img v-if="currentPhoto?.url" :src="getThumbnailUrl(currentPhoto.url)" :alt="currentIndividual?.id || 'Specimen'" loading="lazy" @error="$event.target.style.display = 'none'" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Image class="w-10 h-10 opacity-50" /><span class="text-xs">No photo</span>
          </div>
          <div v-if="!currentPhoto?.sameIndividual && currentPhoto?.url" class="absolute bottom-1.5 left-1.5 right-1.5 bg-black/70 text-muted-foreground text-[10px] py-1 px-1.5 rounded text-center">Same species</div>
          <Button v-if="currentPhoto?.url" variant="ghost" size="icon" class="absolute bottom-1.5 left-1.5 h-7 w-7 bg-black/70 hover:bg-primary/90 text-white opacity-70 hover:opacity-100" @click="openGallery"><Maximize2 class="w-4 h-4" /></Button>
        </div>

        <!-- Individuals -->
        <div>
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ individualsCount }}</span>
            <span class="text-[11px] text-muted-foreground uppercase tracking-wider">Individuals</span>
          </div>
          <select v-if="individualsList.length > 1" :value="selectedIndividualIndex" @change="selectIndividual(Number($event.target.value))" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground font-mono cursor-pointer focus:outline-none focus:border-primary">
            <option v-for="(ind, idx) in individualsList" :key="ind.id" :value="idx">{{ ind.id }}</option>
          </select>
          <div v-else class="px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-teal-400 font-mono">{{ currentIndividual?.id || 'N/A' }}</div>
        </div>

        <!-- Details -->
        <div class="flex flex-col gap-1 pt-2 border-t border-border text-xs">
          <div v-if="currentIndividual?.observation_date" class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Date:</span><span>{{ currentIndividual.observation_date }}</span></div>
          <div v-if="currentIndividual?.mimicry_ring && currentIndividual.mimicry_ring !== 'Unknown'" class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Mimicry:</span><span>{{ currentIndividual.mimicry_ring }}</span></div>
          <div class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Source:</span><span>{{ currentIndividual?.source || 'Unknown' }}</span></div>
          <div class="flex gap-1.5 items-center"><span class="text-muted-foreground min-w-[55px]">Status:</span>
            <span class="flex items-center gap-1.5" :style="{ color: STATUS_COLORS[currentIndividual?.sequencing_status] || '#6b7280' }">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: STATUS_COLORS[currentIndividual?.sequencing_status] || '#6b7280' }"></span>{{ currentIndividual?.sequencing_status || 'Unknown' }}
            </span>
          </div>
          <a v-if="currentIndividual?.observation_url" :href="currentIndividual.observation_url" target="_blank" rel="noopener noreferrer"
            class="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded text-primary text-xs hover:bg-primary/20 hover:border-primary/50 transition-colors">
            <ExternalLink class="w-3.5 h-3.5" />{{ currentIndividual?.source === 'iNaturalist' ? 'View on iNaturalist' : 'View on GBIF' }}
          </a>
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex-1 min-w-0 flex flex-col gap-3">
        <!-- Species -->
        <div>
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ totalSpecies }}</span>
            <span class="text-[11px] text-muted-foreground uppercase tracking-wider">Species</span>
          </div>
          <select :value="selectedSpecies || ''" @change="selectSpecies($event.target.value || null)" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground italic cursor-pointer focus:outline-none focus:border-primary">
            <option v-for="sp in speciesList" :key="sp.species" :value="sp.species">{{ sp.species }} ({{ sp.count }})</option>
          </select>
        </div>

        <!-- Subspecies -->
        <div v-if="subspeciesList.length > 0">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ subspeciesCount }}</span>
            <span class="text-[11px] text-muted-foreground uppercase tracking-wider">Subspecies</span>
          </div>
          <select :value="selectedSubspecies || ''" @change="selectSubspecies($event.target.value || null)" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground italic cursor-pointer focus:outline-none focus:border-primary">
            <option v-for="ssp in subspeciesList" :key="ssp.name" :value="ssp.name">{{ ssp.name }} ({{ ssp.count }})</option>
          </select>
        </div>

        <div class="h-px bg-border my-1"></div>

        <!-- Location Summary -->
        <div class="bg-primary/5 border border-primary/15 rounded-md p-2.5">
          <div class="text-[11px] text-primary uppercase tracking-wider mb-2">Location Summary</div>
          <div class="space-y-1 text-xs">
            <div v-if="locationName" class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Location:</span><span class="italic">{{ locationName }}</span></div>
            <div v-if="currentIndividual?.country && currentIndividual.country !== 'Unknown'" class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Country:</span><span>{{ currentIndividual.country }}</span></div>
            <div class="flex gap-1.5"><span class="text-muted-foreground min-w-[55px]">Coords:</span><span class="font-mono text-[11px]">{{ coordinates.lat.toFixed(4) }}, {{ coordinates.lng.toFixed(4) }}</span></div>
          </div>
          <div class="flex gap-4 mt-2.5 pt-2.5 border-t border-primary/15">
            <div class="flex items-baseline gap-1"><span class="text-lg font-bold text-primary">{{ totalSpecies }}</span><span class="text-[11px] text-muted-foreground">species</span></div>
            <div class="flex items-baseline gap-1"><span class="text-lg font-bold text-primary">{{ totalIndividuals }}</span><span class="text-[11px] text-muted-foreground">individuals</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
