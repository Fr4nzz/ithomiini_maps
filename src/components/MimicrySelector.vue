<script setup>
import { ref, computed, reactive, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getThumbnailUrl } from '../utils/imageProxy'
import { Button } from '@/components/ui/button'
import { X, Search, ChevronDown, ChevronLeft, ChevronRight, Check, Image } from 'lucide-vue-next'

const store = useDataStore()
const emit = defineEmits(['close'])

const searchQuery = ref('')
const showDropdown = ref(false)
const dropdownInput = ref(null)
const ringSpeciesIndex = reactive({})
const ringSubspeciesIndex = reactive({})

const allRingsForDropdown = computed(() => [...(store.availableMimicryRings || []), ...(store.unavailableMimicryRings || [])].sort())

const filteredDropdownRings = computed(() => {
  if (!searchQuery.value) return allRingsForDropdown.value
  const query = searchQuery.value.toLowerCase()
  return allRingsForDropdown.value.filter(ring => { let ringLower = ring.toLowerCase(), queryIndex = 0; for (let i = 0; i < ringLower.length && queryIndex < query.length; i++) { if (ringLower[i] === query[queryIndex]) queryIndex++ }; return queryIndex === query.length })
})

const toggleDropdown = () => { showDropdown.value = !showDropdown.value; if (showDropdown.value) nextTick(() => { dropdownInput.value?.focus() }) }
const closeDropdown = () => { showDropdown.value = false; searchQuery.value = '' }
const selectFromDropdown = (ring) => { toggleRing(ring); searchQuery.value = '' }

const getGroupedReps = (ring) => {
  const reps = store.mimicryPhotoLookup[ring]?.representatives || []
  const grouped = {}
  for (const rep of reps) { const species = rep.scientific_name || 'Unknown'; if (!grouped[species]) grouped[species] = []; grouped[species].push(rep) }
  return Object.keys(grouped).sort().map(species => ({ species, subspecies: grouped[species] }))
}

const getSpeciesList = (ring) => getGroupedReps(ring)
const getSpeciesIndex = (ring) => Math.min(ringSpeciesIndex[ring] || 0, getSpeciesList(ring).length - 1)
const getSubspeciesIndex = (ring) => ringSubspeciesIndex[ring] || 0
const getCurrentSpecies = (ring) => { const list = getSpeciesList(ring); return list.length === 0 ? null : list[getSpeciesIndex(ring)] }
const getCurrentSubspecies = (ring) => { const speciesData = getCurrentSpecies(ring); if (!speciesData) return null; return speciesData.subspecies[Math.min(getSubspeciesIndex(ring), speciesData.subspecies.length - 1)] }
const getCurrentRep = (ring) => getCurrentSubspecies(ring)

const prevSpecies = (ring, event) => { event.stopPropagation(); const list = getSpeciesList(ring); if (list.length <= 1) return; ringSpeciesIndex[ring] = (getSpeciesIndex(ring) - 1 + list.length) % list.length; ringSubspeciesIndex[ring] = 0 }
const nextSpecies = (ring, event) => { event.stopPropagation(); const list = getSpeciesList(ring); if (list.length <= 1) return; ringSpeciesIndex[ring] = (getSpeciesIndex(ring) + 1) % list.length; ringSubspeciesIndex[ring] = 0 }
const prevSubspecies = (ring, event) => { event.stopPropagation(); const speciesData = getCurrentSpecies(ring); if (!speciesData || speciesData.subspecies.length <= 1) return; ringSubspeciesIndex[ring] = (getSubspeciesIndex(ring) - 1 + speciesData.subspecies.length) % speciesData.subspecies.length }
const nextSubspecies = (ring, event) => { event.stopPropagation(); const speciesData = getCurrentSpecies(ring); if (!speciesData || speciesData.subspecies.length <= 1) return; ringSubspeciesIndex[ring] = (getSubspeciesIndex(ring) + 1) % speciesData.subspecies.length }

const ringCounts = computed(() => { const counts = {}; (store.allFeatures || []).forEach(f => { const ring = f.mimicry_ring || 'Unknown'; counts[ring] = (counts[ring] || 0) + 1 }); return counts })
const availableRings = computed(() => { const available = store.availableMimicryRings || []; if (!searchQuery.value) return available; const q = searchQuery.value.toLowerCase(); return available.filter(r => r.toLowerCase().includes(q)) })
const unavailableRings = computed(() => { const unavailable = store.unavailableMimicryRings || []; if (!searchQuery.value) return unavailable; const q = searchQuery.value.toLowerCase(); return unavailable.filter(r => r.toLowerCase().includes(q)) })
const hasTaxonomyFilter = computed(() => store.filters.genus !== 'All' || store.filters.species.length > 0 || store.filters.subspecies.length > 0)
const selectedRings = computed(() => store.filters.mimicry)

const toggleRing = (ring) => { const index = store.filters.mimicry.indexOf(ring); if (index === -1) store.filters.mimicry.push(ring); else store.filters.mimicry.splice(index, 1) }
const removeRing = (ring) => { const index = store.filters.mimicry.indexOf(ring); if (index !== -1) store.filters.mimicry.splice(index, 1) }
const clearSelection = () => { store.filters.mimicry = []; emit('close') }
</script>

<template>
  <div class="bg-card rounded-xl shadow-2xl w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-border">
      <h3 class="flex items-center gap-2.5 text-lg font-semibold text-foreground">
        <img src="../assets/Mimicry_bttn.svg" alt="Mimicry" class="w-7 h-7" />Mimicry Rings
      </h3>
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')"><X class="w-4 h-4" /></Button>
    </div>

    <!-- Dropdown Filter -->
    <div class="relative mx-5 mt-4">
      <button @click="toggleDropdown" class="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm cursor-pointer hover:border-muted-foreground/50 transition-colors" :class="showDropdown ? 'border-primary' : ''">
        <Search class="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span class="flex-1 text-left">{{ selectedRings.length === 0 ? 'Select mimicry rings...' : `${selectedRings.length} ring${selectedRings.length > 1 ? 's' : ''} selected` }}</span>
        <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform" :class="showDropdown ? 'rotate-180' : ''" />
      </button>

      <div v-if="showDropdown" class="absolute top-full left-0 right-0 mt-1 bg-muted border border-border rounded-lg shadow-xl z-[100] overflow-hidden">
        <div class="p-2.5 border-b border-border">
          <input ref="dropdownInput" type="text" v-model="searchQuery" placeholder="Type to filter..." @keydown.escape="closeDropdown"
            class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground" />
        </div>
        <div class="max-h-[250px] overflow-y-auto">
          <button v-for="ring in filteredDropdownRings" :key="ring" @click="selectFromDropdown(ring)"
            class="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-foreground text-sm text-left hover:bg-white/5 transition-colors" :class="selectedRings.includes(ring) ? 'bg-primary/10' : ''">
            <span class="w-4.5 h-4.5 flex items-center justify-center border-2 rounded flex-shrink-0" :class="selectedRings.includes(ring) ? 'bg-primary border-primary' : 'border-border'">
              <Check v-if="selectedRings.includes(ring)" class="w-3 h-3 text-primary-foreground" />
            </span>
            <span class="flex-1">{{ ring }}</span>
            <span class="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded-full">{{ ringCounts[ring] || 0 }}</span>
          </button>
          <div v-if="filteredDropdownRings.length === 0" class="py-5 text-center text-muted-foreground text-sm">No rings match "{{ searchQuery }}"</div>
        </div>
      </div>
      <div v-if="showDropdown" class="fixed inset-0 z-[99]" @click="closeDropdown"></div>
    </div>

    <!-- Current Selection -->
    <div v-if="selectedRings.length > 0" class="flex items-center flex-wrap gap-2 mx-5 mt-3 px-3.5 py-2.5 bg-primary/10 rounded-lg">
      <span class="text-sm text-secondary-foreground">Selected:</span>
      <button v-for="ring in selectedRings" :key="ring" @click="removeRing(ring)" class="flex items-center gap-2 px-2.5 py-1 bg-primary rounded text-primary-foreground text-sm font-medium">
        {{ ring }}<X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Ring Sections -->
    <div class="flex-1 overflow-y-auto px-5 py-4">
      <!-- Available Rings -->
      <div v-if="availableRings.length > 0" class="mb-6">
        <div v-if="hasTaxonomyFilter" class="flex items-center gap-2 mb-3 pb-2 border-b border-border">
          <span class="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">Available for current filter</span>
          <span class="text-[11px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">{{ availableRings.length }}</span>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          <button v-for="ring in availableRings" :key="ring" @click="toggleRing(ring)"
            class="relative flex flex-col items-center p-2.5 bg-muted rounded-lg cursor-pointer transition-all hover:bg-accent/50 hover:-translate-y-0.5"
            :class="selectedRings.includes(ring) ? 'border-2 border-primary bg-primary/10' : 'border-2 border-transparent'">
            <!-- Photo -->
            <div class="w-full aspect-square mb-2 relative">
              <div v-if="getCurrentRep(ring)" class="w-full h-full rounded-md overflow-hidden">
                <img :src="getThumbnailUrl(getCurrentRep(ring).image_url)" :alt="getCurrentRep(ring).scientific_name" loading="lazy" @error="$event.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%232d2d4a%22 width=%2260%22 height=%2260%22/></svg>'" class="w-full h-full object-cover" />
                <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase" :class="getCurrentRep(ring)?.source === 'Sanger Institute' ? 'bg-blue-500/90 text-white' : 'bg-gray-500/90 text-white'">
                  {{ getCurrentRep(ring)?.source === 'Sanger Institute' ? 'Sanger' : 'GBIF' }}
                </span>
              </div>
              <div v-else class="w-full h-full flex flex-col items-center justify-center bg-background rounded-md text-muted-foreground">
                <Image class="w-8 h-8 mb-1 opacity-50" /><span class="text-[10px]">No photo</span>
              </div>
            </div>

            <!-- Navigation -->
            <div v-if="getCurrentRep(ring)" class="w-full mb-2 space-y-1">
              <div class="flex items-center justify-between gap-1">
                <button @click="prevSpecies(ring, $event)" :disabled="getSpeciesList(ring).length <= 1" class="w-4.5 h-4.5 flex items-center justify-center bg-muted border border-border rounded text-secondary-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft class="w-2.5 h-2.5" /></button>
                <span class="flex-1 text-center text-[10px] leading-tight overflow-hidden"><span class="block text-[9px] text-muted-foreground">Spp ({{ getSpeciesIndex(ring) + 1 }}/{{ getSpeciesList(ring).length }}):</span><strong class="block italic text-foreground truncate">{{ getCurrentSpecies(ring)?.species }}</strong></span>
                <button @click="nextSpecies(ring, $event)" :disabled="getSpeciesList(ring).length <= 1" class="w-4.5 h-4.5 flex items-center justify-center bg-muted border border-border rounded text-secondary-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight class="w-2.5 h-2.5" /></button>
              </div>
              <div class="flex items-center justify-between gap-1">
                <button @click="prevSubspecies(ring, $event)" :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1" class="w-4.5 h-4.5 flex items-center justify-center bg-muted border border-border rounded text-secondary-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft class="w-2.5 h-2.5" /></button>
                <span class="flex-1 text-center text-[10px] leading-tight overflow-hidden"><span class="block text-[9px] text-muted-foreground">Subsp ({{ getSubspeciesIndex(ring) + 1 }}/{{ getCurrentSpecies(ring)?.subspecies.length || 0 }}):</span><span class="block italic text-secondary-foreground truncate">{{ getCurrentSubspecies(ring)?.subspecies || '—' }}</span></span>
                <button @click="nextSubspecies(ring, $event)" :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1" class="w-4.5 h-4.5 flex items-center justify-center bg-muted border border-border rounded text-secondary-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight class="w-2.5 h-2.5" /></button>
              </div>
            </div>

            <!-- Ring Info -->
            <div class="text-center w-full">
              <span class="block text-sm font-bold text-foreground mb-1">{{ ring }}</span>
              <span class="text-[11px] text-muted-foreground">{{ ringCounts[ring] || 0 }} records</span>
            </div>

            <!-- Selection Indicator -->
            <div class="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center transition-all z-10" :class="selectedRings.includes(ring) ? 'opacity-100 scale-100' : 'opacity-0 scale-50'">
              <Check class="w-3 h-3 text-primary-foreground" />
            </div>
          </button>
        </div>
      </div>

      <!-- Unavailable Rings -->
      <div v-if="unavailableRings.length > 0 && hasTaxonomyFilter">
        <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not in current filter</span>
          <span class="text-[11px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">{{ unavailableRings.length }}</span>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 opacity-60">
          <button v-for="ring in unavailableRings" :key="ring" @click="toggleRing(ring)"
            class="relative flex flex-col items-center p-2.5 bg-muted rounded-lg cursor-pointer transition-all hover:opacity-90"
            :class="selectedRings.includes(ring) ? 'border-2 border-primary bg-primary/10' : 'border-2 border-transparent'">
            <div class="w-full aspect-square mb-2"><div v-if="getCurrentRep(ring)" class="w-full h-full rounded-md overflow-hidden"><img :src="getThumbnailUrl(getCurrentRep(ring).image_url)" loading="lazy" class="w-full h-full object-cover" /></div><div v-else class="w-full h-full flex flex-col items-center justify-center bg-background rounded-md text-muted-foreground"><Image class="w-8 h-8 opacity-50" /></div></div>
            <div class="text-center w-full"><span class="block text-sm font-bold text-foreground mb-1">{{ ring }}</span><span class="text-[11px] text-destructive italic">Not in filter</span></div>
            <div class="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center transition-all z-10" :class="selectedRings.includes(ring) ? 'opacity-100 scale-100' : 'opacity-0 scale-50'"><Check class="w-3 h-3 text-primary-foreground" /></div>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="availableRings.length === 0 && unavailableRings.length === 0" class="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Search class="w-12 h-12 mb-3 opacity-50" /><p class="text-sm">No mimicry rings found</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-5 py-4 border-t border-border bg-background">
      <p class="text-xs text-muted-foreground italic mb-3">Mimicry ring data from Dore et al. (2025) • Photos prioritize Sanger Institute</p>
      <div class="flex gap-2.5">
        <Button variant="outline" class="flex-1" :disabled="selectedRings.length === 0" @click="clearSelection">Clear Selection</Button>
        <Button class="flex-1" @click="emit('close')">Apply Filter</Button>
      </div>
    </div>
  </div>
</template>
