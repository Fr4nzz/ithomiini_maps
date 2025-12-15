<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getProxiedUrl, getThumbnailUrl } from '../utils/imageProxy'
import Panzoom from '@panzoom/panzoom'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MapPin, ExternalLink, Image, AlertCircle, ChevronDown } from 'lucide-vue-next'

const store = useDataStore()
const emit = defineEmits(['close'])

const currentIndex = ref(0)
const isLoading = ref(true)
const loadError = ref(false)
const zoomLevel = ref(1)
const selectedSpecies = ref(null)
const selectedSubspecies = ref(null)
const collapsedSpecies = ref(new Set())
const collapsedSubspecies = ref(new Set())
const thumbnailStripRef = ref(null)
const stripInitialized = ref(false)
const skipAutoExpand = ref(false)
const imageContainer = ref(null)
const imageEl = ref(null)
let panzoomInstance = null

const STATUS_COLORS = { 'Sequenced': '#3b82f6', 'Tissue Available': '#10b981', 'Preserved Specimen': '#f59e0b', 'Published': '#a855f7', 'GBIF Record': '#6b7280', 'Observation': '#22c55e', 'Museum Specimen': '#8b5cf6', 'Living Specimen': '#14b8a6' }

const allFilteredIndividuals = computed(() => store.filteredGeoJSON?.features?.map(f => f.properties) || [])
const specimensWithImages = computed(() => store.filteredGeoJSON?.features?.filter(f => f.properties?.image_url).map(f => f.properties) || [])
const groupedBySpecies = computed(() => store.groupPointsBySpecies(specimensWithImages.value))
const speciesList = computed(() => store.getSpeciesWithPhotos(specimensWithImages.value))
const subspeciesList = computed(() => { if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) return []; return Object.entries(groupedBySpecies.value[selectedSpecies.value].subspecies).map(([name, data]) => ({ name, count: data.count, hasPhoto: data.individuals.some(i => i.image_url) })).filter(s => s.hasPhoto).sort((a, b) => b.count - a.count) })
const individualsList = computed(() => { if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) return specimensWithImages.value; const speciesGroup = groupedBySpecies.value[selectedSpecies.value]; if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) return speciesGroup.subspecies[selectedSubspecies.value].individuals.filter(i => i.image_url); return Object.values(speciesGroup.subspecies).flatMap(s => s.individuals).filter(i => i.image_url) })

const selectSpecies = (species) => { selectedSpecies.value = species; if (species && groupedBySpecies.value[species]) { const speciesGroup = groupedBySpecies.value[species]; const sorted = Object.keys(speciesGroup.subspecies).map(name => ({ name, hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url) })).filter(s => s.hasPhoto); selectedSubspecies.value = sorted.length > 0 ? sorted[0].name : null } else selectedSubspecies.value = null; updateCurrentIndexFromSelection() }
const selectSubspecies = (subspecies) => { selectedSubspecies.value = subspecies; updateCurrentIndexFromSelection() }
const updateCurrentIndexFromSelection = () => { const list = individualsList.value; if (list.length > 0) { const idx = specimensWithImages.value.findIndex(s => s.id === list[0].id); if (idx >= 0) { currentIndex.value = idx; resetView() } } }
const selectIndividual = (id, autoExpand = true) => { if (!autoExpand) skipAutoExpand.value = true; const idx = specimensWithImages.value.findIndex(s => s.id === id); if (idx >= 0) { currentIndex.value = idx; resetView() } }
const initializeSidebarFromCurrent = () => { const specimen = currentSpecimen.value; if (!specimen) return; selectedSpecies.value = specimen.scientific_name; selectedSubspecies.value = specimen.subspecies; expandOnly(specimen.scientific_name, specimen.subspecies) }

const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
const totalIndividuals = computed(() => specimensWithImages.value.length)
const subspeciesCount = computed(() => subspeciesList.value.length)
const allFilteredTotal = computed(() => allFilteredIndividuals.value.length)
const allFilteredWithoutImages = computed(() => allFilteredTotal.value - totalIndividuals.value)
const totalSubspeciesCount = computed(() => { const set = new Set(); allFilteredIndividuals.value.forEach(ind => { if (ind.subspecies) set.add(`${ind.scientific_name}|${ind.subspecies}`) }); return set.size })

const speciesColors = computed(() => { const species = Object.keys(groupedBySpecies.value); const colors = {}; const baseHues = [210, 150, 30, 280, 350, 180, 60, 320, 120, 240]; species.forEach((sp, idx) => { const hue = baseHues[idx % baseHues.length]; colors[sp] = { main: `hsl(${hue}, 70%, 50%)`, border: `hsl(${hue}, 70%, 40%)`, bg: `hsla(${hue}, 70%, 50%, 0.15)`, hue } }); return colors })
const getSubspeciesColor = (species, subspeciesName) => { const speciesColor = speciesColors.value[species]; if (!speciesColor) return { main: '#666', border: '#555', bg: 'rgba(100, 100, 100, 0.15)' }; const subspeciesList = groupedBySpecies.value[species]?.subspecies || {}; const subspeciesNames = Object.keys(subspeciesList); const idx = subspeciesNames.indexOf(subspeciesName); const total = subspeciesNames.length; const lightness = 45 + (idx / Math.max(total - 1, 1)) * 20; return { main: `hsl(${speciesColor.hue}, 60%, ${lightness}%)`, border: `hsl(${speciesColor.hue}, 60%, ${lightness - 10}%)`, bg: `hsla(${speciesColor.hue}, 60%, ${lightness}%, 0.12)` } }

const groupedThumbnails = computed(() => { const result = []; Object.entries(groupedBySpecies.value).forEach(([speciesName, speciesData]) => { const speciesGroup = { type: 'species', name: speciesName, color: speciesColors.value[speciesName], subspecies: [], totalImages: 0 }; Object.entries(speciesData.subspecies).forEach(([subspeciesName, subspeciesData]) => { const individualsWithImages = subspeciesData.individuals.filter(i => i.image_url); if (individualsWithImages.length === 0) return; speciesGroup.totalImages += individualsWithImages.length; speciesGroup.subspecies.push({ type: 'subspecies', name: subspeciesName, color: getSubspeciesColor(speciesName, subspeciesName), individuals: individualsWithImages, parentSpecies: speciesName }) }); if (speciesGroup.totalImages > 0) result.push(speciesGroup) }); return result })

const collapseAll = () => { const allSpecies = new Set(); const allSubspecies = new Set(); groupedThumbnails.value.forEach(speciesGroup => { allSpecies.add(speciesGroup.name); speciesGroup.subspecies.forEach(subspGroup => { allSubspecies.add(`${speciesGroup.name}|${subspGroup.name}`) }) }); collapsedSpecies.value = allSpecies; collapsedSubspecies.value = allSubspecies }
const expandOnly = (species, subspecies) => { collapseAll(); if (species) { const newSpeciesSet = new Set(collapsedSpecies.value); newSpeciesSet.delete(species); collapsedSpecies.value = newSpeciesSet }; if (species && subspecies) { const key = `${species}|${subspecies}`; const newSubspSet = new Set(collapsedSubspecies.value); newSubspSet.delete(key); collapsedSubspecies.value = newSubspSet } }
const toggleSpeciesCollapse = (speciesName) => { const newSet = new Set(collapsedSpecies.value); if (newSet.has(speciesName)) newSet.delete(speciesName); else newSet.add(speciesName); collapsedSpecies.value = newSet }
const toggleSubspeciesCollapse = (key) => { const newSet = new Set(collapsedSubspecies.value); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); collapsedSubspecies.value = newSet }

const scrollThumbnails = (direction) => { if (!thumbnailStripRef.value) return; thumbnailStripRef.value.scrollBy({ left: direction * 300, behavior: 'smooth' }) }
const positionToActiveThumbnail = () => { nextTick(() => { const activeThumb = thumbnailStripRef.value?.querySelector('.thumbnail.active'); if (activeThumb && thumbnailStripRef.value) { const stripRect = thumbnailStripRef.value.getBoundingClientRect(); const thumbRect = activeThumb.getBoundingClientRect(); thumbnailStripRef.value.scrollLeft = Math.max(0, thumbnailStripRef.value.scrollLeft + (thumbRect.left - stripRect.left) - (stripRect.width / 2) + (thumbRect.width / 2)) } }) }

const locationName = computed(() => { const point = currentSpecimen.value; return point?.collection_location || point?.locality || point?.location || null })
const coordinates = computed(() => { const point = currentSpecimen.value; if (point?.lat && point?.lng) return { lat: point.lat, lng: point.lng }; if (point?.latitude && point?.longitude) return { lat: point.latitude, lng: point.longitude }; return null })
const currentSpecimen = computed(() => specimensWithImages.value[currentIndex.value] || null)

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < specimensWithImages.value.length - 1)
const goToPrev = () => { if (hasPrev.value) { currentIndex.value--; resetView() } }
const goToNext = () => { if (hasNext.value) { currentIndex.value++; resetView() } }
const resetView = () => { isLoading.value = true; loadError.value = false; zoomLevel.value = 1; if (panzoomInstance) panzoomInstance.reset({ animate: false }) }

const initPanzoom = () => { if (!imageEl.value) return; if (panzoomInstance) { panzoomInstance.destroy(); panzoomInstance = null }; panzoomInstance = Panzoom(imageEl.value, { maxScale: 5, minScale: 1, cursor: 'grab' }); imageContainer.value?.addEventListener('wheel', handleWheel, { passive: false }); imageEl.value.addEventListener('panzoomzoom', (e) => { zoomLevel.value = e.detail.scale }); imageEl.value.addEventListener('panzoomreset', () => { zoomLevel.value = 1 }) }
const handleWheel = (e) => { if (panzoomInstance) { e.preventDefault(); panzoomInstance.zoomWithWheel(e) } }
const onImageLoad = () => { isLoading.value = false; loadError.value = false; nextTick(() => { initPanzoom() }) }
const onImageError = () => { isLoading.value = false; loadError.value = true }
const zoomIn = () => { if (panzoomInstance) panzoomInstance.zoomIn({ animate: true }) }
const zoomOut = () => { if (panzoomInstance) panzoomInstance.zoomOut({ animate: true }) }
const resetZoom = () => { if (panzoomInstance) panzoomInstance.reset({ animate: true }) }
const viewOnMap = () => { if (!currentSpecimen.value || !coordinates.value) return; store.focusPoint = { lat: coordinates.value.lat, lng: coordinates.value.lng, properties: currentSpecimen.value }; emit('close') }

const onKeyDown = (e) => { switch (e.key) { case 'ArrowLeft': goToPrev(); break; case 'ArrowRight': goToNext(); break; case 'Escape': if (zoomLevel.value > 1.05) resetZoom(); else emit('close'); break; case '+': case '=': zoomIn(); break; case '-': zoomOut(); break } }
const handleGallerySelection = () => { const selection = store.gallerySelection; if (!selection) return; if (selection.species) selectedSpecies.value = selection.species; if (selection.subspecies) selectedSubspecies.value = selection.subspecies; if (selection.individualId) { const idx = specimensWithImages.value.findIndex(s => s.id === selection.individualId); if (idx >= 0) currentIndex.value = idx } else if (selection.species) updateCurrentIndexFromSelection(); expandOnly(selection.species, selection.subspecies); store.gallerySelection = null; positionToActiveThumbnail() }
const initializeThumbnailStrip = () => { if (stripInitialized.value) return; collapseAll(); stripInitialized.value = true }

onMounted(() => { document.addEventListener('keydown', onKeyDown); nextTick(() => { initializeThumbnailStrip() }); if (store.gallerySelection) handleGallerySelection(); else initializeSidebarFromCurrent() })
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown); if (panzoomInstance) panzoomInstance.destroy(); imageContainer.value?.removeEventListener('wheel', handleWheel) })
watch(() => store.filteredGeoJSON, () => { currentIndex.value = 0; resetView(); stripInitialized.value = false; nextTick(() => { initializeThumbnailStrip(); initializeSidebarFromCurrent() }) })
watch(currentIndex, () => { const specimen = currentSpecimen.value; if (specimen) { const speciesChanged = specimen.scientific_name !== selectedSpecies.value; const subspeciesChanged = specimen.subspecies !== selectedSubspecies.value; if (speciesChanged) selectedSpecies.value = specimen.scientific_name; if (subspeciesChanged) selectedSubspecies.value = specimen.subspecies; if ((speciesChanged || subspeciesChanged) && !skipAutoExpand.value) { if (specimen.scientific_name && collapsedSpecies.value.has(specimen.scientific_name)) { const newSet = new Set(collapsedSpecies.value); newSet.delete(specimen.scientific_name); collapsedSpecies.value = newSet }; if (specimen.scientific_name && specimen.subspecies) { const key = `${specimen.scientific_name}|${specimen.subspecies}`; if (collapsedSubspecies.value.has(key)) { const newSet = new Set(collapsedSubspecies.value); newSet.delete(key); collapsedSubspecies.value = newSet } }; positionToActiveThumbnail() }; skipAutoExpand.value = false } })
</script>

<template>
  <div class="fixed inset-0 bg-black/95 z-[2000] flex flex-col">
    <Button variant="ghost" size="icon" class="absolute top-4 right-4 z-10 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full" @click="emit('close')"><X class="w-6 h-6" /></Button>

    <!-- Empty state -->
    <div v-if="specimensWithImages.length === 0" class="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center px-10">
      <Image class="w-20 h-20 mb-5 opacity-50" /><h3 class="text-2xl text-secondary-foreground mb-2.5">No Images Available</h3><p class="mb-6">No specimens in the current filter have images attached.</p>
      <Button @click="emit('close')">Back to Map</Button>
    </div>

    <template v-else>
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar -->
        <div class="w-[220px] flex-shrink-0 bg-background border-r border-border p-4 flex flex-col gap-3 overflow-y-auto">
          <!-- Species -->
          <div><div class="flex items-center gap-1.5 mb-1.5"><span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ totalSpecies }}</span><span class="text-[11px] text-muted-foreground uppercase tracking-wider">Species</span></div>
            <select :value="selectedSpecies || ''" @change="selectSpecies($event.target.value || null)" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground italic cursor-pointer focus:outline-none focus:border-primary"><option value="" disabled>Select species...</option><option v-for="sp in speciesList" :key="sp.species" :value="sp.species">{{ sp.species }} ({{ sp.count }})</option></select></div>
          <!-- Subspecies -->
          <div v-if="subspeciesList.length > 0"><div class="flex items-center gap-1.5 mb-1.5"><span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ subspeciesCount }}</span><span class="text-[11px] text-muted-foreground uppercase tracking-wider">Subspecies</span></div>
            <select :value="selectedSubspecies || ''" @change="selectSubspecies($event.target.value || null)" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground italic cursor-pointer focus:outline-none focus:border-primary"><option v-for="ssp in subspeciesList" :key="ssp.name" :value="ssp.name">{{ ssp.name }} ({{ ssp.count }})</option></select></div>
          <!-- Individuals -->
          <div><div class="flex items-center gap-1.5 mb-1.5"><span class="bg-primary/20 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{{ individualsList.length }}</span><span class="text-[11px] text-muted-foreground uppercase tracking-wider">Individuals</span></div>
            <select v-if="individualsList.length > 1" :value="currentSpecimen?.id || ''" @change="selectIndividual($event.target.value)" class="w-full px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-foreground font-mono cursor-pointer focus:outline-none focus:border-primary"><option v-for="ind in individualsList" :key="ind.id" :value="ind.id">{{ ind.id }}</option></select>
            <div v-else class="px-2.5 py-2 bg-muted border border-border rounded-md text-sm text-teal-400 font-mono">{{ currentSpecimen?.id || 'N/A' }}</div></div>
          <div class="h-px bg-border my-1"></div>
          <!-- Details -->
          <div class="flex flex-col gap-1 text-xs">
            <div v-if="currentSpecimen?.observation_date" class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Date:</span><span>{{ currentSpecimen.observation_date }}</span></div>
            <div v-if="currentSpecimen?.mimicry_ring && currentSpecimen.mimicry_ring !== 'Unknown'" class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Mimicry:</span><span>{{ currentSpecimen.mimicry_ring }}</span></div>
            <div class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Source:</span><span>{{ currentSpecimen?.source || 'Unknown' }}</span></div>
            <div class="flex gap-1.5 items-center"><span class="text-muted-foreground min-w-[50px]">Status:</span><span class="flex items-center gap-1.5" :style="{ color: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"><span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"></span>{{ currentSpecimen?.sequencing_status || 'Unknown' }}</span></div>
            <div v-if="currentSpecimen?.country && currentSpecimen.country !== 'Unknown'" class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Country:</span><span>{{ currentSpecimen.country }}</span></div>
            <div v-if="locationName" class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Location:</span><span class="italic">{{ locationName }}</span></div>
            <div v-if="coordinates" class="flex gap-1.5"><span class="text-muted-foreground min-w-[50px]">Coords:</span><span class="font-mono text-[11px]">{{ coordinates.lat.toFixed(4) }}, {{ coordinates.lng.toFixed(4) }}</span></div>
            <a v-if="currentSpecimen?.observation_url" :href="currentSpecimen.observation_url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded text-primary text-xs hover:bg-primary/20 transition-colors"><ExternalLink class="w-3.5 h-3.5" />{{ currentSpecimen?.source === 'iNaturalist' ? 'View on iNaturalist' : 'View on GBIF' }}</a>
            <button v-if="coordinates" @click="viewOnMap" class="flex items-center justify-center gap-1.5 w-full mt-2 px-2.5 py-2 bg-blue-500/15 border border-blue-500/40 rounded text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-colors"><MapPin class="w-3.5 h-3.5" />View on Map</button>
          </div>
          <div class="h-px bg-border my-1"></div>
          <!-- Search Summary -->
          <div class="bg-primary/5 border border-primary/15 rounded-md p-2.5">
            <div class="text-[11px] text-primary uppercase tracking-wider mb-2">Search Summary</div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between"><span class="text-muted-foreground">Species:</span><span class="text-primary font-semibold">{{ totalSpecies }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">Subspecies:</span><span class="text-primary font-semibold">{{ totalSubspeciesCount }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">With images:</span><span class="text-primary font-semibold">{{ totalIndividuals }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">Without images:</span><span class="text-primary font-semibold">{{ allFilteredWithoutImages }}</span></div>
              <div class="flex justify-between pt-1.5 mt-1.5 border-t border-primary/15"><span class="text-muted-foreground">Total:</span><span class="text-primary font-bold text-sm">{{ allFilteredTotal }}</span></div>
            </div>
          </div>
        </div>

        <!-- Image viewer wrapper -->
        <div class="flex-1 relative flex flex-col">
          <div ref="imageContainer" class="flex-1 flex items-center justify-center overflow-hidden select-none">
            <div v-if="isLoading" class="w-12 h-12 border-3 border-white/10 border-t-primary rounded-full animate-spin"></div>
            <div v-else-if="loadError" class="flex flex-col items-center text-muted-foreground"><AlertCircle class="w-14 h-14 mb-3" /><p>Failed to load image</p></div>
            <img v-if="currentSpecimen?.image_url" v-show="!isLoading && !loadError" ref="imageEl" :src="getProxiedUrl(currentSpecimen.image_url)" :alt="currentSpecimen.scientific_name" class="max-w-[90%] max-h-full object-contain cursor-grab active:cursor-grabbing" @load="onImageLoad" @error="onImageError" draggable="false" />
          </div>
          <!-- Nav buttons -->
          <button class="absolute top-1/2 left-0 -translate-y-1/2 w-12 h-20 bg-black/40 hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center rounded-r-lg z-5" :disabled="!hasPrev" @click="goToPrev"><ChevronLeft class="w-7 h-7" /></button>
          <button class="absolute top-1/2 right-0 -translate-y-1/2 w-12 h-20 bg-black/40 hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center rounded-l-lg z-5" :disabled="!hasNext" @click="goToNext"><ChevronRight class="w-7 h-7" /></button>
          <!-- Zoom controls -->
          <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg z-5">
            <button class="w-9 h-9 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-md flex items-center justify-center text-white" :disabled="zoomLevel <= 1" @click="zoomOut"><ZoomOut class="w-5 h-5" /></button>
            <span class="text-sm text-muted-foreground min-w-[50px] text-center tabular-nums">{{ Math.round(zoomLevel * 100) }}%</span>
            <button class="w-9 h-9 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-md flex items-center justify-center text-white" :disabled="zoomLevel >= 5" @click="zoomIn"><ZoomIn class="w-5 h-5" /></button>
            <button class="px-3 h-9 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-md text-sm text-white" :disabled="zoomLevel <= 1.05" @click="resetZoom">Reset</button>
          </div>
          <!-- Counter -->
          <div class="absolute bottom-5 right-5 text-sm text-muted-foreground bg-black/60 px-3 py-1.5 rounded-md tabular-nums z-5">{{ currentIndex + 1 }} / {{ specimensWithImages.length }}</div>
        </div>
      </div>

      <!-- Thumbnail strip -->
      <div v-if="specimensWithImages.length > 1" class="h-[130px] flex bg-black/70 border-t border-white/10">
        <button class="w-9 flex-shrink-0 flex items-center justify-center bg-black/50 hover:bg-black/80 text-muted-foreground hover:text-white border-r border-white/10" @click="scrollThumbnails(-1)"><ChevronLeft class="w-5 h-5" /></button>
        <div ref="thumbnailStripRef" class="flex-1 flex items-stretch gap-0.5 overflow-x-auto overflow-y-hidden scroll-smooth">
          <template v-for="speciesGroup in groupedThumbnails" :key="speciesGroup.name">
            <div class="flex flex-col flex-shrink-0 min-w-[80px]" :style="{ background: speciesGroup.color?.bg, borderLeft: `3px solid ${speciesGroup.color?.main}` }">
              <button @click="toggleSpeciesCollapse(speciesGroup.name)" :title="speciesGroup.name" class="flex items-center gap-1 px-2 py-1 bg-black/30 border-b border-white/10 text-xs font-semibold italic whitespace-nowrap hover:bg-black/50 transition-colors" :style="{ color: speciesGroup.color?.main }">
                <ChevronDown class="w-3 h-3 flex-shrink-0 transition-transform" :class="collapsedSpecies.has(speciesGroup.name) ? '-rotate-90' : ''" />
                <span class="max-w-[120px] truncate">{{ speciesGroup.name }}</span>
                <span class="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold not-italic" :style="{ background: speciesGroup.color?.main, color: '#000' }">{{ speciesGroup.totalImages }}</span>
              </button>
              <!-- Collapsed preview -->
              <div v-if="collapsedSpecies.has(speciesGroup.name)" class="flex items-center justify-center p-2 cursor-pointer hover:bg-white/5" @click="toggleSpeciesCollapse(speciesGroup.name)">
                <button class="relative w-[90px] h-[90px] bg-[#333] border-2 border-transparent rounded hover:border-white/40" :class="speciesGroup.subspecies.some(s => s.individuals.some(i => i.id === currentSpecimen?.id)) ? 'border-primary shadow-[0_0_8px_rgba(74,222,128,0.5)]' : ''" @click.stop="selectIndividual(speciesGroup.subspecies[0]?.individuals[0]?.id, false)">
                  <img v-if="speciesGroup.subspecies[0]?.individuals[0]?.image_url" :src="getThumbnailUrl(speciesGroup.subspecies[0].individuals[0].image_url)" loading="lazy" class="w-full h-full object-contain bg-[#222]" />
                  <span class="absolute bottom-1 right-1 w-5 h-5 bg-black/85 text-white text-sm font-bold leading-5 text-center rounded cursor-pointer hover:bg-primary hover:text-black hover:scale-110 transition-all" @click.stop="toggleSpeciesCollapse(speciesGroup.name)">+</span>
                </button>
              </div>
              <!-- Expanded -->
              <div v-show="!collapsedSpecies.has(speciesGroup.name)" class="flex overflow-x-visible overflow-y-hidden">
                <template v-for="subspGroup in speciesGroup.subspecies" :key="`${speciesGroup.name}-${subspGroup.name}`">
                  <div class="flex flex-col flex-shrink-0 min-w-[60px]" :style="{ background: subspGroup.color?.bg, borderLeft: `2px solid ${subspGroup.color?.main}` }">
                    <button @click="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)" :title="subspGroup.name" class="flex items-center gap-1 px-1.5 py-0.5 border-b border-white/5 text-[10px] italic whitespace-nowrap hover:bg-black/20 transition-colors" :style="{ color: subspGroup.color?.main }">
                      <ChevronDown class="w-2.5 h-2.5 flex-shrink-0 transition-transform" :class="collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`) ? '-rotate-90' : ''" />
                      <span class="max-w-[100px] truncate">{{ subspGroup.name }}</span>
                      <span class="ml-auto px-1 rounded text-[9px] font-bold not-italic" :style="{ background: subspGroup.color?.main, color: '#000' }">{{ subspGroup.individuals.length }}</span>
                    </button>
                    <!-- Collapsed subspecies preview -->
                    <div v-if="collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`)" class="flex items-center justify-center p-2 cursor-pointer hover:bg-white/5" @click="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)">
                      <button class="relative w-[90px] h-[90px] bg-[#333] border-2 border-transparent rounded hover:border-white/40" :class="subspGroup.individuals.some(i => i.id === currentSpecimen?.id) ? 'border-primary shadow-[0_0_8px_rgba(74,222,128,0.5)]' : ''" @click.stop="selectIndividual(subspGroup.individuals[0]?.id, false)">
                        <img v-if="subspGroup.individuals[0]?.image_url" :src="getThumbnailUrl(subspGroup.individuals[0].image_url)" loading="lazy" class="w-full h-full object-contain bg-[#222]" />
                        <span class="absolute bottom-1 right-1 w-5 h-5 bg-black/85 text-white text-sm font-bold leading-5 text-center rounded cursor-pointer hover:bg-primary hover:text-black hover:scale-110 transition-all" @click.stop="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)">+</span>
                      </button>
                    </div>
                    <!-- Expanded thumbnails -->
                    <div v-show="!collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`)" class="flex items-stretch gap-1 p-1 overflow-x-visible overflow-y-hidden">
                      <button v-for="specimen in subspGroup.individuals" :key="specimen.id" class="thumbnail flex-shrink-0 w-20 h-20 p-0 bg-[#333] border-2 border-transparent rounded cursor-pointer overflow-hidden transition-all hover:border-white/40 hover:scale-105" :class="currentSpecimen?.id === specimen.id ? 'active border-primary shadow-[0_0_8px_rgba(74,222,128,0.5)]' : ''" @click="selectIndividual(specimen.id)" :title="specimen.id">
                        <img :src="getThumbnailUrl(specimen.image_url)" :alt="specimen.id" loading="lazy" class="w-full h-full object-cover" />
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
        <button class="w-9 flex-shrink-0 flex items-center justify-center bg-black/50 hover:bg-black/80 text-muted-foreground hover:text-white border-l border-white/10" @click="scrollThumbnails(1)"><ChevronRight class="w-5 h-5" /></button>
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "../index.css";
@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }
</style>
