<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getProxiedUrl, getThumbnailUrl, notifyTierFailed, getProxyState } from '../utils/imageProxy'
import { useGalleryData } from '../composables/useGalleryData'
import GallerySidebar from './GallerySidebar.vue'
import Panzoom from '@panzoom/panzoom'

const store = useDataStore()
const emit = defineEmits(['close'])
const proxyState = getProxyState()

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

// Resolved image URL — reactive to proxy mode/tier changes
const resolvedImageUrl = computed(() => {
  // Touch reactive refs so Vue tracks the dependency
  void proxyState.mode.value
  void proxyState.tierStatus.value
  return currentSpecimen.value?.image_url
    ? getProxiedUrl(currentSpecimen.value.image_url)
    : ''
})

// Proxy-version counter — forces re-evaluation of thumbnail URLs in v-for
const proxyVersion = computed(() =>
  `${proxyState.mode.value}-${JSON.stringify(proxyState.tierStatus.value)}`
)

// Thumbnail URL helper — reactive wrapper for use in v-for templates
const resolvedThumbUrl = (url) => {
  void proxyVersion.value
  return getThumbnailUrl(url)
}

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
  // In auto mode, mark the current tier as blocked and retry with next tier
  const currentUrl = resolvedImageUrl.value
  if (proxyState.mode.value === 'auto' && currentUrl) {
    const ts = proxyState.tierStatus.value
    // Only retry if there's a tier below that isn't blocked yet
    const hasLowerTier =
      (currentUrl.includes('wsrv.nl') && ts.lh3 !== 'blocked') ||
      (currentUrl.includes('lh3.google') && ts.thumbnail !== 'blocked')
    if (hasLowerTier) {
      notifyTierFailed(currentUrl)
      isLoading.value = true
      loadError.value = false
      return
    }
  }
  // No more fallbacks — show error
  if (currentUrl) notifyTierFailed(currentUrl)
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
              :src="resolvedImageUrl"
              referrerpolicy="no-referrer"
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
                    :src="resolvedThumbUrl(speciesGroup.subspecies[0].individuals[0].image_url)"
                    :alt="speciesGroup.name"
                    loading="lazy"
                    referrerpolicy="no-referrer"
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
                          :src="resolvedThumbUrl(subspGroup.individuals[0].image_url)"
                          :alt="subspGroup.name"
                          loading="lazy"
                          referrerpolicy="no-referrer"
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
                          :src="resolvedThumbUrl(specimen.image_url)"
                          :alt="specimen.id"
                          loading="lazy"
                          referrerpolicy="no-referrer"
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


<style scoped src="./image-gallery-styles.css"></style>
