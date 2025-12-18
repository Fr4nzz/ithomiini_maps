<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getProxiedUrl, getThumbnailUrl } from '../utils/imageProxy'
import { useGalleryData } from '../composables/useGalleryData'
import GallerySidebar from './GallerySidebar.vue'
import Panzoom from '@panzoom/panzoom'

const store = useDataStore()
const emit = defineEmits(['close'])

// Gallery data from composable
const {
  allFilteredIndividuals,
  specimensWithImages,
  groupedBySpecies,
  speciesList,
  totalSpecies,
  totalIndividuals,
  allFilteredTotal,
  allFilteredWithoutImages,
  totalSubspeciesCount,
  speciesColors,
  getSubspeciesColor,
  groupedThumbnails
} = useGalleryData(store)

// Gallery state
const currentIndex = ref(0)
const isLoading = ref(true)
const loadError = ref(false)
const zoomLevel = ref(1)

// Sidebar state
const selectedSpecies = ref(null)
const selectedSubspecies = ref(null)

// Thumbnail strip state - all collapsed by default (populated on mount)
const collapsedSpecies = ref(new Set())
const collapsedSubspecies = ref(new Set())
const thumbnailStripRef = ref(null)
const stripInitialized = ref(false)
const skipAutoExpand = ref(false)

// Refs
const imageContainer = ref(null)
const imageEl = ref(null)

// Panzoom instance
let panzoomInstance = null

// Get subspecies list for selected species
const subspeciesList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
    return []
  }
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
  return Object.entries(speciesGroup.subspecies)
    .map(([name, data]) => ({
      name,
      count: data.count,
      hasPhoto: data.individuals.some(i => i.image_url)
    }))
    .filter(s => s.hasPhoto)
    .sort((a, b) => b.count - a.count)
})

// Get individuals list for selected species+subspecies (only those with images)
const individualsList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
    return specimensWithImages.value
  }
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]

  if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) {
    return speciesGroup.subspecies[selectedSubspecies.value].individuals.filter(i => i.image_url)
  }

  return Object.values(speciesGroup.subspecies)
    .flatMap(s => s.individuals)
    .filter(i => i.image_url)
})

// Handle species selection
const selectSpecies = (species) => {
  selectedSpecies.value = species

  if (species && groupedBySpecies.value[species]) {
    const speciesGroup = groupedBySpecies.value[species]
    const subspeciesNames = Object.keys(speciesGroup.subspecies)

    const sortedSubspecies = subspeciesNames
      .map(name => ({
        name,
        hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url)
      }))
      .filter(s => s.hasPhoto)

    if (sortedSubspecies.length > 0) {
      selectedSubspecies.value = sortedSubspecies[0].name
    } else {
      selectedSubspecies.value = null
    }
  } else {
    selectedSubspecies.value = null
  }

  updateCurrentIndexFromSelection()
}

// Handle subspecies selection
const selectSubspecies = (subspecies) => {
  selectedSubspecies.value = subspecies
  updateCurrentIndexFromSelection()
}

// Update currentIndex when species/subspecies selection changes
const updateCurrentIndexFromSelection = () => {
  const list = individualsList.value
  if (list.length > 0) {
    const firstIndividual = list[0]
    const idx = specimensWithImages.value.findIndex(s => s.id === firstIndividual.id)
    if (idx >= 0) {
      currentIndex.value = idx
      resetView()
    }
  }
}

// Handle individual selection (by specimen ID)
// When autoExpand is false, the group won't auto-expand when selecting
const selectIndividual = (id, autoExpand = true) => {
  if (!autoExpand) {
    skipAutoExpand.value = true
  }
  const idx = specimensWithImages.value.findIndex(s => s.id === id)
  if (idx >= 0) {
    currentIndex.value = idx
    resetView()
  }
}

// Initialize sidebar selection from current specimen
const initializeSidebarFromCurrent = () => {
  const specimen = currentSpecimen.value
  if (!specimen) return

  selectedSpecies.value = specimen.scientific_name
  selectedSubspecies.value = specimen.subspecies

  // Expand only the current species/subspecies group
  expandOnly(specimen.scientific_name, specimen.subspecies)
}

// Subspecies count for sidebar
const subspeciesCount = computed(() => subspeciesList.value.length)

// Initialize all species/subspecies as collapsed
const collapseAll = () => {
  const allSpecies = new Set()
  const allSubspecies = new Set()

  groupedThumbnails.value.forEach(speciesGroup => {
    allSpecies.add(speciesGroup.name)
    speciesGroup.subspecies.forEach(subspGroup => {
      allSubspecies.add(`${speciesGroup.name}|${subspGroup.name}`)
    })
  })

  collapsedSpecies.value = allSpecies
  collapsedSubspecies.value = allSubspecies
}

// Expand only a specific species and subspecies (keeping others collapsed)
const expandOnly = (species, subspecies) => {
  // Start with all collapsed
  collapseAll()

  // Expand the target species
  if (species) {
    const newSpeciesSet = new Set(collapsedSpecies.value)
    newSpeciesSet.delete(species)
    collapsedSpecies.value = newSpeciesSet
  }

  // Expand the target subspecies
  if (species && subspecies) {
    const key = `${species}|${subspecies}`
    const newSubspSet = new Set(collapsedSubspecies.value)
    newSubspSet.delete(key)
    collapsedSubspecies.value = newSubspSet
  }
}

// Toggle collapsed state for species
const toggleSpeciesCollapse = (speciesName) => {
  const newSet = new Set(collapsedSpecies.value)
  if (newSet.has(speciesName)) {
    newSet.delete(speciesName)
  } else {
    newSet.add(speciesName)
  }
  collapsedSpecies.value = newSet
}

// Toggle collapsed state for subspecies
const toggleSubspeciesCollapse = (key) => {
  const newSet = new Set(collapsedSubspecies.value)
  if (newSet.has(key)) {
    newSet.delete(key)
  } else {
    newSet.add(key)
  }
  collapsedSubspecies.value = newSet
}

// Scroll thumbnail strip with arrows
const scrollThumbnails = (direction) => {
  if (!thumbnailStripRef.value) return
  const scrollAmount = 300
  thumbnailStripRef.value.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  })
}

// Position thumbnail strip to show active thumbnail (instant, no animation)
const positionToActiveThumbnail = () => {
  nextTick(() => {
    const activeThumb = thumbnailStripRef.value?.querySelector('.thumbnail.active')
    if (activeThumb && thumbnailStripRef.value) {
      // Get positions
      const stripRect = thumbnailStripRef.value.getBoundingClientRect()
      const thumbRect = activeThumb.getBoundingClientRect()

      // Calculate scroll position to center the thumbnail
      const scrollLeft = thumbnailStripRef.value.scrollLeft +
        (thumbRect.left - stripRect.left) -
        (stripRect.width / 2) +
        (thumbRect.width / 2)

      // Set scroll position instantly (no smooth scroll to avoid loading intermediate images)
      thumbnailStripRef.value.scrollLeft = Math.max(0, scrollLeft)
    }
  })
}

// Location name from current individual
const locationName = computed(() => {
  const point = currentSpecimen.value
  return point?.collection_location || point?.locality || point?.location || null
})

// Coordinates from current individual
const coordinates = computed(() => {
  const point = currentSpecimen.value
  if (point?.lat && point?.lng) {
    return { lat: point.lat, lng: point.lng }
  }
  if (point?.latitude && point?.longitude) {
    return { lat: point.latitude, lng: point.longitude }
  }
  return null
})

// Current specimen
const currentSpecimen = computed(() => {
  return specimensWithImages.value[currentIndex.value] || null
})

// Navigation
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < specimensWithImages.value.length - 1)

const goToPrev = () => {
  if (hasPrev.value) {
    currentIndex.value--
    resetView()
  }
}

const goToNext = () => {
  if (hasNext.value) {
    currentIndex.value++
    resetView()
  }
}

const goToIndex = (idx) => {
  currentIndex.value = idx
  resetView()
}

// Reset view state
const resetView = () => {
  isLoading.value = true
  loadError.value = false
  zoomLevel.value = 1
  // Reset panzoom if it exists
  if (panzoomInstance) {
    panzoomInstance.reset({ animate: false })
  }
}

// Initialize panzoom on image
const initPanzoom = () => {
  if (!imageEl.value) return

  // Destroy existing instance
  if (panzoomInstance) {
    panzoomInstance.destroy()
    panzoomInstance = null
  }

  panzoomInstance = Panzoom(imageEl.value, {
    maxScale: 5,
    minScale: 1,
    cursor: 'grab'
  })

  // Enable wheel zoom on container
  imageContainer.value?.addEventListener('wheel', handleWheel, { passive: false })

  // Track zoom level changes
  imageEl.value.addEventListener('panzoomzoom', (e) => {
    zoomLevel.value = e.detail.scale
  })

  imageEl.value.addEventListener('panzoomreset', () => {
    zoomLevel.value = 1
  })
}

const handleWheel = (e) => {
  if (panzoomInstance) {
    e.preventDefault()
    panzoomInstance.zoomWithWheel(e)
  }
}

// Image loaded handler
const onImageLoad = () => {
  isLoading.value = false
  loadError.value = false
  nextTick(() => {
    initPanzoom()
  })
}

const onImageError = () => {
  isLoading.value = false
  loadError.value = true
}

// Zoom controls
const zoomIn = () => {
  if (panzoomInstance) {
    panzoomInstance.zoomIn({ animate: true })
  }
}

const zoomOut = () => {
  if (panzoomInstance) {
    panzoomInstance.zoomOut({ animate: true })
  }
}

const resetZoom = () => {
  if (panzoomInstance) {
    panzoomInstance.reset({ animate: true })
  }
}

// View on map - set focus point and close gallery
const viewOnMap = () => {
  if (!currentSpecimen.value || !coordinates.value) return

  // Set the focus point in the store
  store.focusPoint = {
    lat: coordinates.value.lat,
    lng: coordinates.value.lng,
    properties: currentSpecimen.value
  }

  // Close the gallery
  emit('close')
}

// Keyboard navigation
const onKeyDown = (e) => {
  switch (e.key) {
    case 'ArrowLeft':
      goToPrev()
      break
    case 'ArrowRight':
      goToNext()
      break
    case 'Escape':
      if (zoomLevel.value > 1.05) {
        resetZoom()
      } else {
        emit('close')
      }
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
  }
}

// Handle pre-selection from store (when opening from popup)
const handleGallerySelection = () => {
  const selection = store.gallerySelection
  if (!selection) return

  // Set species and subspecies from selection
  if (selection.species) {
    selectedSpecies.value = selection.species
  }
  if (selection.subspecies) {
    selectedSubspecies.value = selection.subspecies
  }

  // Find and select the individual by ID
  if (selection.individualId) {
    const idx = specimensWithImages.value.findIndex(s => s.id === selection.individualId)
    if (idx >= 0) {
      currentIndex.value = idx
    }
  } else if (selection.species) {
    // If no individual ID, find first individual of the species/subspecies with image
    updateCurrentIndexFromSelection()
  }

  // Expand only the selected species/subspecies (others stay collapsed)
  expandOnly(selection.species, selection.subspecies)

  // Clear the selection after handling
  store.gallerySelection = null

  // Position to active thumbnail instantly (no smooth scroll to avoid loading all images)
  positionToActiveThumbnail()
}

// Initialize thumbnail strip - collapse all by default
const initializeThumbnailStrip = () => {
  if (stripInitialized.value) return
  collapseAll()
  stripInitialized.value = true
}

// Setup/cleanup
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)

  // Initialize thumbnail strip with all collapsed
  nextTick(() => {
    initializeThumbnailStrip()
  })

  // Check for gallery selection from popup
  if (store.gallerySelection) {
    handleGallerySelection()
  } else {
    initializeSidebarFromCurrent()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (panzoomInstance) {
    panzoomInstance.destroy()
  }
  imageContainer.value?.removeEventListener('wheel', handleWheel)
})

// Watch for filter changes
watch(() => store.filteredGeoJSON, () => {
  currentIndex.value = 0
  resetView()
  // Reset strip initialization flag so it re-collapses
  stripInitialized.value = false
  nextTick(() => {
    initializeThumbnailStrip()
    initializeSidebarFromCurrent()
  })
})

// Watch for currentIndex changes to sync sidebar and expand current group
watch(currentIndex, () => {
  const specimen = currentSpecimen.value
  if (specimen) {
    const speciesChanged = specimen.scientific_name !== selectedSpecies.value
    const subspeciesChanged = specimen.subspecies !== selectedSubspecies.value

    if (speciesChanged) {
      selectedSpecies.value = specimen.scientific_name
    }
    if (subspeciesChanged) {
      selectedSubspecies.value = specimen.subspecies
    }

    // If navigating to a different species/subspecies, expand that group (unless skipAutoExpand is set)
    if ((speciesChanged || subspeciesChanged) && !skipAutoExpand.value) {
      // Expand the new species if collapsed
      if (specimen.scientific_name && collapsedSpecies.value.has(specimen.scientific_name)) {
        const newSet = new Set(collapsedSpecies.value)
        newSet.delete(specimen.scientific_name)
        collapsedSpecies.value = newSet
      }

      // Expand the new subspecies if collapsed
      if (specimen.scientific_name && specimen.subspecies) {
        const key = `${specimen.scientific_name}|${specimen.subspecies}`
        if (collapsedSubspecies.value.has(key)) {
          const newSet = new Set(collapsedSubspecies.value)
          newSet.delete(key)
          collapsedSubspecies.value = newSet
        }
      }

      // Position to the thumbnail
      positionToActiveThumbnail()
    }

    // Reset the skip flag
    skipAutoExpand.value = false
  }
})
</script>

<template>
  <div class="image-gallery">
    <!-- Close button -->
    <button class="btn-close" @click="emit('close')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- Empty state -->
    <div v-if="specimensWithImages.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <h3>No Images Available</h3>
      <p>No specimens in the current filter have images attached.</p>
      <button class="btn-back" @click="emit('close')">Back to Map</button>
    </div>

    <!-- Main gallery -->
    <template v-else>
      <!-- Gallery layout with sidebar -->
      <div class="gallery-layout">
        <!-- Sidebar -->
        <GallerySidebar
          :current-specimen="currentSpecimen"
          :selected-species="selectedSpecies"
          :selected-subspecies="selectedSubspecies"
          :species-list="speciesList"
          :subspecies-list="subspeciesList"
          :individuals-list="individualsList"
          :total-species="totalSpecies"
          :total-individuals="totalIndividuals"
          :total-subspecies-count="totalSubspeciesCount"
          :all-filtered-total="allFilteredTotal"
          :all-filtered-without-images="allFilteredWithoutImages"
          :coordinates="coordinates"
          :location-name="locationName"
          @select-species="selectSpecies"
          @select-subspecies="selectSubspecies"
          @select-individual="selectIndividual"
          @view-on-map="viewOnMap"
        />

        <!-- Image viewer wrapper (for positioning nav buttons) -->
        <div class="image-viewer-wrapper">
          <!-- Image viewer -->
          <div
            ref="imageContainer"
            class="image-viewer"
          >
            <!-- Loading spinner -->
            <div v-if="isLoading" class="image-loading">
              <div class="spinner"></div>
            </div>

            <!-- Error state -->
            <div v-else-if="loadError" class="image-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>Failed to load image</p>
            </div>

            <!-- Image (hidden while loading) -->
            <img
              v-if="currentSpecimen?.image_url"
              v-show="!isLoading && !loadError"
              ref="imageEl"
              :src="getProxiedUrl(currentSpecimen.image_url)"
              :alt="currentSpecimen.scientific_name"
              class="gallery-image"
              @load="onImageLoad"
              @error="onImageError"
              draggable="false"
            />
          </div>

          <!-- Navigation arrows (inside wrapper) -->
          <button
            class="nav-btn nav-prev"
            :disabled="!hasPrev"
            @click="goToPrev"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>

          <button
            class="nav-btn nav-next"
            :disabled="!hasNext"
            @click="goToNext"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>

          <!-- Zoom controls -->
          <div class="zoom-controls">
            <button @click="zoomOut" :disabled="zoomLevel <= 1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <button @click="zoomIn" :disabled="zoomLevel >= 5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button @click="resetZoom" :disabled="zoomLevel <= 1.05" class="reset-btn">
              Reset
            </button>
          </div>

          <!-- Image counter -->
          <div class="image-counter">
            {{ currentIndex + 1 }} / {{ specimensWithImages.length }}
          </div>
        </div>
      </div>

      <!-- Thumbnail strip with grouped layout -->
      <div class="thumbnail-strip" v-if="specimensWithImages.length > 1">
        <!-- Left scroll arrow -->
        <button class="scroll-arrow scroll-arrow-left" @click="scrollThumbnails(-1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        <!-- Thumbnail content area -->
        <div ref="thumbnailStripRef" class="thumbnail-scroll">
          <!-- Species groups -->
          <template v-for="speciesGroup in groupedThumbnails" :key="speciesGroup.name">
            <div
              class="species-group"
              :style="{ '--species-color': speciesGroup.color?.main, '--species-bg': speciesGroup.color?.bg, '--species-border': speciesGroup.color?.border }"
            >
              <!-- Species header -->
              <button
                class="species-header"
                @click="toggleSpeciesCollapse(speciesGroup.name)"
                :title="speciesGroup.name"
              >
                <svg class="collapse-icon" :class="{ collapsed: collapsedSpecies.has(speciesGroup.name) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
                <span class="species-name">{{ speciesGroup.name }}</span>
                <span class="species-count">{{ speciesGroup.totalImages }}</span>
              </button>

              <!-- Preview thumbnail when species is collapsed -->
              <div
                v-if="collapsedSpecies.has(speciesGroup.name)"
                class="preview-container"
                @click="toggleSpeciesCollapse(speciesGroup.name)"
              >
                <button
                  class="thumbnail preview-thumb"
                  :class="{ active: speciesGroup.subspecies.some(s => s.individuals.some(i => i.id === currentSpecimen?.id)) }"
                  @click.stop="selectIndividual(speciesGroup.subspecies[0]?.individuals[0]?.id, false)"
                  :title="speciesGroup.subspecies[0]?.individuals[0]?.id || 'View'"
                >
                  <img
                    v-if="speciesGroup.subspecies[0]?.individuals[0]?.image_url"
                    :src="getThumbnailUrl(speciesGroup.subspecies[0].individuals[0].image_url)"
                    :alt="speciesGroup.name"
                    loading="lazy"
                  />
                  <span class="expand-badge" @click.stop="toggleSpeciesCollapse(speciesGroup.name)" title="Expand group">+</span>
                </button>
              </div>

              <!-- Species content (subspecies groups) -->
              <div class="species-content" v-show="!collapsedSpecies.has(speciesGroup.name)">
                <template v-for="subspGroup in speciesGroup.subspecies" :key="`${speciesGroup.name}-${subspGroup.name}`">
                  <div
                    class="subspecies-group"
                    :style="{ '--subsp-color': subspGroup.color?.main, '--subsp-bg': subspGroup.color?.bg, '--subsp-border': subspGroup.color?.border }"
                  >
                    <!-- Subspecies header -->
                    <button
                      class="subspecies-header"
                      @click="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)"
                      :title="subspGroup.name"
                    >
                      <svg class="collapse-icon" :class="{ collapsed: collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                      <span class="subspecies-name">{{ subspGroup.name }}</span>
                      <span class="subspecies-count">{{ subspGroup.individuals.length }}</span>
                    </button>

                    <!-- Preview thumbnail when subspecies is collapsed -->
                    <div
                      v-if="collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`)"
                      class="preview-container"
                      @click="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)"
                    >
                      <button
                        class="thumbnail preview-thumb"
                        :class="{ active: subspGroup.individuals.some(i => i.id === currentSpecimen?.id) }"
                        @click.stop="selectIndividual(subspGroup.individuals[0]?.id, false)"
                        :title="subspGroup.individuals[0]?.id || 'View'"
                      >
                        <img
                          v-if="subspGroup.individuals[0]?.image_url"
                          :src="getThumbnailUrl(subspGroup.individuals[0].image_url)"
                          :alt="subspGroup.name"
                          loading="lazy"
                        />
                        <span class="expand-badge" @click.stop="toggleSubspeciesCollapse(`${speciesGroup.name}|${subspGroup.name}`)" title="Expand group">+</span>
                      </button>
                    </div>

                    <!-- Thumbnails -->
                    <div class="thumbnails-container" v-show="!collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`)">
                      <button
                        v-for="specimen in subspGroup.individuals"
                        :key="specimen.id"
                        class="thumbnail"
                        :class="{ active: currentSpecimen?.id === specimen.id }"
                        @click="selectIndividual(specimen.id)"
                        :title="specimen.id"
                      >
                        <img
                          :src="getThumbnailUrl(specimen.image_url)"
                          :alt="specimen.id"
                          loading="lazy"
                        />
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>

        <!-- Right scroll arrow -->
        <button class="scroll-arrow scroll-arrow-right" @click="scrollThumbnails(1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.image-gallery {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

/* Close button */
.btn-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-close svg {
  width: 24px;
  height: 24px;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  text-align: center;
  padding: 40px;
}

.empty-state svg {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 1.5rem;
  color: #ccc;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 1rem;
  margin-bottom: 24px;
}

.btn-back {
  padding: 12px 24px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 8px;
  color: #1a1a2e;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}

/* Gallery layout with sidebar */
.gallery-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Image viewer wrapper */
.image-viewer-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* Image viewer */
.image-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.gallery-image {
  max-width: 90%;
  max-height: 100%;
  object-fit: contain;
  cursor: grab;
}

.gallery-image:active {
  cursor: grabbing;
}

/* Loading */
.image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-loading .spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-accent, #4ade80);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error */
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #888;
}

.image-error svg {
  width: 60px;
  height: 60px;
  margin-bottom: 12px;
}

/* Navigation buttons - positioned within wrapper */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 80px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.6);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 30px;
  height: 30px;
}

.nav-prev {
  left: 0;
  border-radius: 0 8px 8px 0;
}

.nav-next {
  right: 0;
  border-radius: 8px 0 0 8px;
}

/* Zoom controls */
.zoom-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  z-index: 5;
}

.zoom-controls button {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.zoom-controls button.reset-btn {
  width: auto;
  padding: 0 12px;
  font-size: 0.8rem;
}

.zoom-controls button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.zoom-controls button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-controls button svg {
  width: 20px;
  height: 20px;
}

.zoom-level {
  font-size: 0.85rem;
  color: #aaa;
  min-width: 50px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Image counter */
.image-counter {
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 0.9rem;
  color: #888;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 12px;
  border-radius: 6px;
  z-index: 5;
}

/* Thumbnail strip with grouped layout */
.thumbnail-strip {
  display: flex;
  align-items: stretch;
  background: rgba(0, 0, 0, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  height: 130px;
}

/* Scroll arrows */
.scroll-arrow {
  flex-shrink: 0;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
}

.scroll-arrow:hover {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
}

.scroll-arrow svg {
  width: 20px;
  height: 20px;
}

.scroll-arrow-left {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.scroll-arrow-right {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.thumbnail-scroll {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
}

/* Species group */
.species-group {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--species-bg, rgba(100, 100, 100, 0.1));
  border-left: 3px solid var(--species-color, #666);
  min-width: 80px;
}

.species-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--species-color, #888);
  font-size: 0.7rem;
  font-weight: 600;
  font-style: italic;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.species-header:hover {
  background: rgba(0, 0, 0, 0.5);
}

.collapse-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.species-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.species-count {
  margin-left: auto;
  padding: 1px 5px;
  background: var(--species-color, #666);
  color: #000;
  font-size: 0.6rem;
  font-weight: 700;
  font-style: normal;
  border-radius: 3px;
}

.species-content {
  display: flex;
  overflow-x: visible;
  overflow-y: hidden;
}

/* Preview container for collapsed groups */
.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  cursor: pointer;
}

.preview-container:hover {
  background: rgba(255, 255, 255, 0.05);
}

.preview-thumb {
  position: relative;
  width: 90px;
  height: 90px;
}

.preview-thumb img {
  object-fit: contain;
  background: #222;
}

.preview-thumb:hover {
  border-color: rgba(255, 255, 255, 0.5);
}

.expand-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  line-height: 20px;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.expand-badge:hover {
  background: var(--color-accent, #4ade80);
  color: #000;
  transform: scale(1.1);
}

/* Subspecies group */
.subspecies-group {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--subsp-bg, rgba(100, 100, 100, 0.08));
  border-left: 2px solid var(--subsp-color, #555);
  min-width: 60px;
}

.subspecies-header {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--subsp-color, #777);
  font-size: 0.65rem;
  font-style: italic;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.subspecies-header:hover {
  background: rgba(0, 0, 0, 0.2);
}

.subspecies-header .collapse-icon {
  width: 10px;
  height: 10px;
}

.subspecies-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subspecies-count {
  margin-left: auto;
  padding: 0 4px;
  background: var(--subsp-color, #555);
  color: #000;
  font-size: 0.55rem;
  font-weight: 700;
  font-style: normal;
  border-radius: 2px;
}

/* Thumbnails container */
.thumbnails-container {
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 3px;
  overflow-x: visible;
  overflow-y: hidden;
}

.thumbnail {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  padding: 0;
  background: #333;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s;
}

.thumbnail:hover {
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.thumbnail.active {
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Scrollbar */
.thumbnail-scroll::-webkit-scrollbar,
.species-content::-webkit-scrollbar,
.thumbnails-container::-webkit-scrollbar {
  height: 4px;
}

.thumbnail-scroll::-webkit-scrollbar-track,
.species-content::-webkit-scrollbar-track,
.thumbnails-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.thumbnail-scroll::-webkit-scrollbar-thumb,
.species-content::-webkit-scrollbar-thumb,
.thumbnails-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.thumbnail-scroll::-webkit-scrollbar-thumb:hover,
.species-content::-webkit-scrollbar-thumb:hover,
.thumbnails-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Responsive */
@media (max-width: 768px) {
  .gallery-sidebar {
    display: none;
  }

  .nav-btn {
    width: 40px;
    height: 60px;
  }

  .zoom-controls {
    bottom: 160px;
  }

  .image-counter {
    bottom: 160px;
  }

  .thumbnail-strip {
    height: 120px;
  }

  .species-header {
    font-size: 0.6rem;
    padding: 3px 6px;
  }

  .subspecies-header {
    font-size: 0.55rem;
    padding: 2px 4px;
  }

  .scroll-arrow {
    width: 28px;
  }

  .expand-badge {
    width: 18px;
    height: 18px;
    font-size: 12px;
    line-height: 18px;
  }
}
</style>
