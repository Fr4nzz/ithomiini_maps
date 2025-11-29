<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['close'])

// Gallery state
const currentIndex = ref(0)
const isZoomed = ref(false)
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isLoading = ref(true)
const loadError = ref(false)
const showThumbnail = ref(true)

// Image container ref
const imageContainer = ref(null)
const imageEl = ref(null)

// Get specimens with images
const specimensWithImages = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features
    .filter(f => f.properties?.image_url)
    .map(f => f.properties)
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
  isZoomed.value = false
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
  isLoading.value = true
  loadError.value = false
}

// Image loaded handler
const onImageLoad = () => {
  isLoading.value = false
  loadError.value = false
}

const onImageError = () => {
  isLoading.value = false
  loadError.value = true
}

// Zoom controls
const zoomIn = () => {
  if (zoomLevel.value < 4) {
    zoomLevel.value = Math.min(4, zoomLevel.value * 1.5)
    isZoomed.value = zoomLevel.value > 1
  }
}

const zoomOut = () => {
  if (zoomLevel.value > 1) {
    zoomLevel.value = Math.max(1, zoomLevel.value / 1.5)
    isZoomed.value = zoomLevel.value > 1
    if (zoomLevel.value === 1) {
      panX.value = 0
      panY.value = 0
    }
  }
}

const toggleZoom = () => {
  if (isZoomed.value) {
    resetView()
  } else {
    zoomLevel.value = 2
    isZoomed.value = true
  }
}

// Pan handling
let isPanning = false
let startX = 0
let startY = 0
let startPanX = 0
let startPanY = 0

const onMouseDown = (e) => {
  if (!isZoomed.value) return
  isPanning = true
  startX = e.clientX
  startY = e.clientY
  startPanX = panX.value
  startPanY = panY.value
  e.preventDefault()
}

const onMouseMove = (e) => {
  if (!isPanning) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  panX.value = startPanX + dx
  panY.value = startPanY + dy
}

const onMouseUp = () => {
  isPanning = false
}

// Touch handling
let touchStartDist = 0
let touchStartZoom = 1

const onTouchStart = (e) => {
  if (e.touches.length === 2) {
    // Pinch zoom start
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    touchStartDist = Math.sqrt(dx * dx + dy * dy)
    touchStartZoom = zoomLevel.value
  } else if (e.touches.length === 1 && isZoomed.value) {
    // Pan start
    isPanning = true
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    startPanX = panX.value
    startPanY = panY.value
  }
}

const onTouchMove = (e) => {
  if (e.touches.length === 2) {
    // Pinch zoom
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const scale = dist / touchStartDist
    zoomLevel.value = Math.max(1, Math.min(4, touchStartZoom * scale))
    isZoomed.value = zoomLevel.value > 1
    e.preventDefault()
  } else if (e.touches.length === 1 && isPanning) {
    // Pan
    const dx = e.touches[0].clientX - startX
    const dy = e.touches[0].clientY - startY
    panX.value = startPanX + dx
    panY.value = startPanY + dy
    e.preventDefault()
  }
}

const onTouchEnd = () => {
  isPanning = false
}

// Wheel zoom
const onWheel = (e) => {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
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
      if (isZoomed.value) {
        resetView()
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

// Setup/cleanup
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onMouseMove)
})

// Watch for filter changes
watch(() => store.filteredGeoJSON, () => {
  currentIndex.value = 0
  resetView()
})

// Status color helper
const getStatusColor = (status) => {
  const colors = {
    'Sequenced': '#3b82f6',
    'Tissue Available': '#10b981',
    'Preserved Specimen': '#f59e0b',
    'Published': '#a855f7',
    'GBIF Record': '#6b7280',
    'Observation': '#6b7280',
    'Museum Specimen': '#8b5cf6',
    'Living Specimen': '#14b8a6'
  }
  return colors[status] || '#6b7280'
}
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
      <!-- Image viewer -->
      <div 
        ref="imageContainer"
        class="image-viewer"
        @mousedown="onMouseDown"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @wheel="onWheel"
        @dblclick="toggleZoom"
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

        <!-- Image -->
        <img
          v-if="currentSpecimen?.image_url"
          ref="imageEl"
          :src="currentSpecimen.image_url"
          :alt="currentSpecimen.scientific_name"
          class="gallery-image"
          :class="{ zoomed: isZoomed }"
          :style="{
            transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`
          }"
          @load="onImageLoad"
          @error="onImageError"
          draggable="false"
        />
      </div>

      <!-- Info panel -->
      <div class="info-panel">
        <div class="info-content">
          <!-- Thumbnail (if enabled) -->
          <div v-if="showThumbnail && currentSpecimen?.image_url" class="info-thumbnail">
            <img
              :src="currentSpecimen.image_url"
              :alt="currentSpecimen.scientific_name"
            />
          </div>

          <!-- Specimen info -->
          <div class="specimen-info">
            <h3 class="species-name">
              <em>{{ currentSpecimen?.scientific_name }}</em>
              <span v-if="currentSpecimen?.subspecies" class="subspecies">
                {{ currentSpecimen.subspecies }}
              </span>
            </h3>
            <div class="specimen-meta">
              <span v-if="currentSpecimen?.id" class="meta-item">
                <strong>ID:</strong> {{ currentSpecimen.id }}
              </span>
              <span v-if="currentSpecimen?.sequencing_status" class="meta-item">
                <strong>Sequencing Status:</strong>
                <span class="status-badge" :style="{
                  backgroundColor: getStatusColor(currentSpecimen.sequencing_status),
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  marginLeft: '4px'
                }">
                  {{ currentSpecimen.sequencing_status }}
                </span>
              </span>
              <span v-if="currentSpecimen?.mimicry_ring" class="meta-item">
                <strong>Mimicry:</strong> {{ currentSpecimen.mimicry_ring }}
              </span>
              <span v-if="currentSpecimen?.country" class="meta-item">
                <strong>Country:</strong> {{ currentSpecimen.country }}
              </span>
              <span v-if="currentSpecimen?.source" class="meta-item">
                <strong>Source:</strong> {{ currentSpecimen.source }}
              </span>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="info-controls">
          <!-- Thumbnail toggle -->
          <label class="thumbnail-toggle">
            <input type="checkbox" v-model="showThumbnail" />
            <span>Show thumbnail</span>
          </label>

          <!-- Counter -->
          <div class="image-counter">
            {{ currentIndex + 1 }} / {{ specimensWithImages.length }}
          </div>
        </div>
      </div>

      <!-- Navigation arrows -->
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
        <button @click="zoomIn" :disabled="zoomLevel >= 4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
      </div>

      <!-- Thumbnail strip -->
      <div class="thumbnail-strip" v-if="specimensWithImages.length > 1">
        <div class="thumbnail-scroll">
          <button
            v-for="(specimen, idx) in specimensWithImages.slice(0, 20)"
            :key="specimen.id"
            class="thumbnail"
            :class="{ active: idx === currentIndex }"
            @click="goToIndex(idx)"
          >
            <img 
              :src="specimen.image_url" 
              :alt="specimen.scientific_name"
              loading="lazy"
            />
          </button>
          <span v-if="specimensWithImages.length > 20" class="thumbnail-more">
            +{{ specimensWithImages.length - 20 }} more
          </span>
        </div>
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

/* Image viewer */
.image-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.image-viewer:active {
  cursor: grabbing;
}

.gallery-image {
  max-width: 90%;
  max-height: 80vh;
  object-fit: contain;
  transition: transform 0.1s ease-out;
  will-change: transform;
}

.gallery-image.zoomed {
  cursor: move;
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

/* Info panel */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
}

.info-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.info-thumbnail {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: #333;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.info-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.specimen-info {
  flex: 1;
  min-width: 0;
}

.info-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.species-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 6px 0;
}

.species-name em {
  color: var(--color-accent, #4ade80);
}

.subspecies {
  font-style: normal;
  font-weight: 400;
  color: #aaa;
  margin-left: 8px;
}

.specimen-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  font-size: 0.85rem;
  color: #888;
}

.meta-item strong {
  color: #aaa;
  font-weight: 500;
}

.thumbnail-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.thumbnail-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-accent, #4ade80);
}

.thumbnail-toggle span {
  font-size: 0.85rem;
  color: #aaa;
}

.image-counter {
  font-size: 0.9rem;
  color: #888;
  font-variant-numeric: tabular-nums;
}

/* Navigation buttons */
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
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 8px;
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

/* Thumbnail strip */
.thumbnail-strip {
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.thumbnail-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.thumbnail {
  flex-shrink: 0;
  width: 60px;
  height: 45px;
  padding: 0;
  background: #333;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
}

.thumbnail:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.thumbnail.active {
  border-color: var(--color-accent, #4ade80);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-more {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: #666;
  padding: 0 12px;
}

/* Scrollbar */
.thumbnail-scroll::-webkit-scrollbar {
  height: 6px;
}

.thumbnail-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.thumbnail-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* Responsive */
@media (max-width: 768px) {
  .info-panel {
    padding: 12px 16px;
  }

  .info-content {
    flex-direction: column;
  }

  .info-thumbnail {
    width: 100%;
    height: auto;
    aspect-ratio: 4/3;
  }

  .info-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .specimen-meta {
    gap: 10px;
  }

  .nav-btn {
    width: 40px;
    height: 60px;
  }

  .zoom-controls {
    bottom: 100px;
  }

  .thumbnail {
    width: 50px;
    height: 38px;
  }
}
</style>
