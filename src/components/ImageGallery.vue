<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getProxiedUrl, getThumbnailUrl } from '../utils/imageProxy'
import Panzoom from '@panzoom/panzoom'

const store = useDataStore()
const emit = defineEmits(['close'])

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

// Refs
const imageContainer = ref(null)
const imageEl = ref(null)

// Panzoom instance
let panzoomInstance = null

// Status colors for sidebar
const STATUS_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

// Get all filtered individuals (with or without images)
const allFilteredIndividuals = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features.map(f => f.properties)
})

// Get specimens with images
const specimensWithImages = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features
    .filter(f => f.properties?.image_url)
    .map(f => f.properties)
})

// Group points by species for sidebar navigation
const groupedBySpecies = computed(() => {
  return store.groupPointsBySpecies(specimensWithImages.value)
})

// Get species list (those with images)
const speciesList = computed(() => {
  return store.getSpeciesWithPhotos(specimensWithImages.value)
})

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
const selectIndividual = (id) => {
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

// Total counts for sidebar stats
const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
const totalIndividuals = computed(() => specimensWithImages.value.length)
const subspeciesCount = computed(() => subspeciesList.value.length)

// Search summary stats (from all filtered data, not just with images)
const allFilteredTotal = computed(() => allFilteredIndividuals.value.length)
const allFilteredWithoutImages = computed(() => allFilteredTotal.value - totalIndividuals.value)

// Count total unique subspecies from all filtered data
const totalSubspeciesCount = computed(() => {
  const subspeciesSet = new Set()
  allFilteredIndividuals.value.forEach(ind => {
    if (ind.subspecies) {
      subspeciesSet.add(`${ind.scientific_name}|${ind.subspecies}`)
    }
  })
  return subspeciesSet.size
})

// Generate colors for species (main colors) and subspecies (shades)
const speciesColors = computed(() => {
  const species = Object.keys(groupedBySpecies.value)
  const colors = {}
  const baseHues = [210, 150, 30, 280, 350, 180, 60, 320, 120, 240] // Blue, teal, orange, purple, red, cyan, yellow, pink, green, indigo

  species.forEach((sp, idx) => {
    const hue = baseHues[idx % baseHues.length]
    colors[sp] = {
      main: `hsl(${hue}, 70%, 50%)`,
      border: `hsl(${hue}, 70%, 40%)`,
      bg: `hsla(${hue}, 70%, 50%, 0.15)`,
      hue
    }
  })
  return colors
})

// Generate subspecies shades within species color
const getSubspeciesColor = (species, subspeciesName) => {
  const speciesColor = speciesColors.value[species]
  if (!speciesColor) return { main: '#666', border: '#555', bg: 'rgba(100, 100, 100, 0.15)' }

  const subspeciesList = groupedBySpecies.value[species]?.subspecies || {}
  const subspeciesNames = Object.keys(subspeciesList)
  const idx = subspeciesNames.indexOf(subspeciesName)
  const total = subspeciesNames.length

  // Vary lightness based on subspecies index
  const lightness = 45 + (idx / Math.max(total - 1, 1)) * 20 // Range 45-65%

  return {
    main: `hsl(${speciesColor.hue}, 60%, ${lightness}%)`,
    border: `hsl(${speciesColor.hue}, 60%, ${lightness - 10}%)`,
    bg: `hsla(${speciesColor.hue}, 60%, ${lightness}%, 0.12)`
  }
}

// Grouped thumbnails for the strip (hierarchical structure)
const groupedThumbnails = computed(() => {
  const result = []

  Object.entries(groupedBySpecies.value).forEach(([speciesName, speciesData]) => {
    const speciesGroup = {
      type: 'species',
      name: speciesName,
      color: speciesColors.value[speciesName],
      subspecies: [],
      totalImages: 0
    }

    Object.entries(speciesData.subspecies).forEach(([subspeciesName, subspeciesData]) => {
      const individualsWithImages = subspeciesData.individuals.filter(i => i.image_url)
      if (individualsWithImages.length === 0) return

      speciesGroup.totalImages += individualsWithImages.length

      speciesGroup.subspecies.push({
        type: 'subspecies',
        name: subspeciesName,
        color: getSubspeciesColor(speciesName, subspeciesName),
        individuals: individualsWithImages,
        parentSpecies: speciesName
      })
    })

    // Only include species that have images
    if (speciesGroup.totalImages > 0) {
      result.push(speciesGroup)
    }
  })

  return result
})

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

    // If navigating to a different species/subspecies, expand that group
    if (speciesChanged || subspeciesChanged) {
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
        <div class="gallery-sidebar">
          <!-- Species Section -->
          <div class="sidebar-section">
            <div class="section-header">
              <span class="count-badge">{{ totalSpecies }}</span>
              <span class="section-label">Species</span>
            </div>
            <select
              :value="selectedSpecies || ''"
              @change="selectSpecies($event.target.value || null)"
              class="sidebar-select"
            >
              <option value="" disabled>Select species...</option>
              <option
                v-for="sp in speciesList"
                :key="sp.species"
                :value="sp.species"
              >
                {{ sp.species }} ({{ sp.count }})
              </option>
            </select>
          </div>

          <!-- Subspecies Section -->
          <div v-if="subspeciesList.length > 0" class="sidebar-section">
            <div class="section-header">
              <span class="count-badge">{{ subspeciesCount }}</span>
              <span class="section-label">Subspecies</span>
            </div>
            <select
              :value="selectedSubspecies || ''"
              @change="selectSubspecies($event.target.value || null)"
              class="sidebar-select"
            >
              <option
                v-for="ssp in subspeciesList"
                :key="ssp.name"
                :value="ssp.name"
              >
                {{ ssp.name }} ({{ ssp.count }})
              </option>
            </select>
          </div>

          <!-- Individuals Section -->
          <div class="sidebar-section">
            <div class="section-header">
              <span class="count-badge">{{ individualsList.length }}</span>
              <span class="section-label">Individuals</span>
            </div>
            <select
              v-if="individualsList.length > 1"
              :value="currentSpecimen?.id || ''"
              @change="selectIndividual($event.target.value)"
              class="sidebar-select individual-select"
            >
              <option
                v-for="ind in individualsList"
                :key="ind.id"
                :value="ind.id"
              >
                {{ ind.id }}
              </option>
            </select>
            <div v-else class="single-individual-id">
              {{ currentSpecimen?.id || 'N/A' }}
            </div>
          </div>

          <div class="sidebar-divider"></div>

          <!-- Details Section -->
          <div class="sidebar-details">
            <!-- Observation Date -->
            <div v-if="currentSpecimen?.observation_date" class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">{{ currentSpecimen.observation_date }}</span>
            </div>

            <!-- Mimicry Ring -->
            <div v-if="currentSpecimen?.mimicry_ring && currentSpecimen.mimicry_ring !== 'Unknown'" class="detail-row">
              <span class="detail-label">Mimicry:</span>
              <span class="detail-value">{{ currentSpecimen.mimicry_ring }}</span>
            </div>

            <!-- Source -->
            <div class="detail-row">
              <span class="detail-label">Source:</span>
              <span class="detail-value">{{ currentSpecimen?.source || 'Unknown' }}</span>
            </div>

            <!-- Status -->
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span
                class="detail-value status-badge"
                :style="{ color: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"
              >
                <span class="status-dot" :style="{ background: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"></span>
                {{ currentSpecimen?.sequencing_status || 'Unknown' }}
              </span>
            </div>

            <!-- Country -->
            <div v-if="currentSpecimen?.country && currentSpecimen.country !== 'Unknown'" class="detail-row">
              <span class="detail-label">Country:</span>
              <span class="detail-value">{{ currentSpecimen.country }}</span>
            </div>

            <!-- Location -->
            <div v-if="locationName" class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value location-name">{{ locationName }}</span>
            </div>

            <!-- Coordinates -->
            <div v-if="coordinates" class="detail-row">
              <span class="detail-label">Coords:</span>
              <span class="detail-value coords">{{ coordinates.lat.toFixed(4) }}, {{ coordinates.lng.toFixed(4) }}</span>
            </div>

            <!-- Observation URL Link -->
            <a
              v-if="currentSpecimen?.observation_url"
              :href="currentSpecimen.observation_url"
              target="_blank"
              rel="noopener noreferrer"
              class="observation-link"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span v-if="currentSpecimen?.source === 'iNaturalist'">View on iNaturalist</span>
              <span v-else>View on GBIF</span>
            </a>

            <!-- View on Map Button -->
            <button
              v-if="coordinates"
              class="view-on-map-btn"
              @click="viewOnMap"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              View on Map
            </button>
          </div>

          <div class="sidebar-divider"></div>

          <!-- Search Summary -->
          <div class="search-summary">
            <div class="summary-title">Search Summary</div>
            <div class="summary-stats-grid">
              <div class="stat-row">
                <span class="stat-label">Species:</span>
                <span class="stat-value">{{ totalSpecies }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Subspecies:</span>
                <span class="stat-value">{{ totalSubspeciesCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">With images:</span>
                <span class="stat-value">{{ totalIndividuals }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Without images:</span>
                <span class="stat-value">{{ allFilteredWithoutImages }}</span>
              </div>
              <div class="stat-row total-row">
                <span class="stat-label">Total individuals:</span>
                <span class="stat-value">{{ allFilteredTotal }}</span>
              </div>
            </div>
          </div>
        </div>

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
              <div v-if="collapsedSpecies.has(speciesGroup.name)" class="preview-container">
                <button
                  class="thumbnail preview-thumb"
                  :class="{ active: speciesGroup.subspecies.some(s => s.individuals.some(i => i.id === currentSpecimen?.id)) }"
                  @click="selectIndividual(speciesGroup.subspecies[0]?.individuals[0]?.id)"
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
                    <div v-if="collapsedSubspecies.has(`${speciesGroup.name}|${subspGroup.name}`)" class="preview-container">
                      <button
                        class="thumbnail preview-thumb"
                        :class="{ active: subspGroup.individuals.some(i => i.id === currentSpecimen?.id) }"
                        @click="selectIndividual(subspGroup.individuals[0]?.id)"
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

/* Sidebar styles */
.gallery-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1a1a2e;
  border-right: 1px solid #3d3d5c;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.count-badge {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.section-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-select {
  width: 100%;
  padding: 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.8rem;
  font-style: italic;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-select:hover {
  border-color: #5d5d7c;
}

.sidebar-select:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.sidebar-select.individual-select {
  font-style: normal;
  font-family: monospace;
}

.single-individual-id {
  padding: 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #14b8a6;
  font-size: 0.8rem;
  font-family: monospace;
}

.sidebar-divider {
  height: 1px;
  background: #3d3d5c;
  margin: 4px 0;
}

.sidebar-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.75rem;
}

.detail-label {
  color: #888;
  flex-shrink: 0;
  min-width: 50px;
}

.detail-value {
  color: #e0e0e0;
  word-break: break-word;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.observation-link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 5px;
  color: #4ade80;
  font-size: 0.75rem;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.observation-link:hover {
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.5);
  color: #86efac;
}

.observation-link svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.view-on-map-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 5px;
  color: #60a5fa;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-on-map-btn:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.6);
  color: #93c5fd;
}

.view-on-map-btn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.location-name {
  font-style: italic;
}

.coords {
  font-family: monospace;
  font-size: 0.7rem;
}

.search-summary {
  background: rgba(74, 222, 128, 0.05);
  border: 1px solid rgba(74, 222, 128, 0.15);
  border-radius: 6px;
  padding: 10px;
}

.summary-title {
  font-size: 0.7rem;
  color: #4ade80;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.summary-stats-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.stat-row .stat-label {
  color: #888;
}

.stat-row .stat-value {
  color: #4ade80;
  font-weight: 600;
}

.stat-row.total-row {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(74, 222, 128, 0.15);
}

.stat-row.total-row .stat-value {
  font-size: 0.9rem;
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
  height: 150px;
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
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
}

/* Preview container for collapsed groups */
.preview-container {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 2px;
}

.preview-thumb {
  position: relative;
  width: auto;
  height: 100%;
  aspect-ratio: 1;
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
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 3px;
  overflow-x: auto;
  overflow-y: hidden;
}

.thumbnail {
  flex-shrink: 0;
  width: auto;
  height: 100%;
  aspect-ratio: 1;
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
