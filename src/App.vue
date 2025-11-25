<script setup>
import { ref, onMounted } from 'vue'
import { useDataStore } from './stores/data'
import Sidebar from './components/Sidebar.vue'
import MapEngine from './components/MapEngine.vue'
import DataTable from './components/DataTable.vue'
import ExportPanel from './components/ExportPanel.vue'

const store = useDataStore()

// View state
const currentView = ref('map') // 'map' or 'table'
const showExportPanel = ref(false)

// Provide to children
const setView = (view) => {
  currentView.value = view
}

const openExport = () => {
  showExportPanel.value = true
}

const closeExport = () => {
  showExportPanel.value = false
}

onMounted(() => {
  store.loadMapData()
  
  // Check URL for view param
  const params = new URLSearchParams(window.location.search)
  if (params.get('view') === 'table') {
    currentView.value = 'table'
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Sidebar with filters -->
    <Sidebar 
      @open-export="openExport"
      :current-view="currentView"
      @set-view="setView"
    />
    
    <!-- Main content area -->
    <main class="main-content">
      <!-- View Toggle (visible on mobile) -->
      <div class="view-toggle-bar">
        <button 
          :class="{ active: currentView === 'map' }"
          @click="setView('map')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/>
            <line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          Map
        </button>
        <button 
          :class="{ active: currentView === 'table' }"
          @click="setView('table')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Table
        </button>
        <button 
          class="btn-export-mobile"
          @click="openExport"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="store.loading" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">Loading distribution data...</p>
          <p class="loading-subtext">Preparing records</p>
        </div>
      </div>

      <!-- Map View -->
      <MapEngine 
        v-else-if="currentView === 'map'"
        class="view-container"
      />

      <!-- Table View -->
      <DataTable 
        v-else-if="currentView === 'table'"
        class="view-container"
      />
    </main>

    <!-- Export Panel Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showExportPanel" 
          class="modal-overlay"
          @click.self="closeExport"
        >
          <ExportPanel @close="closeExport" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Global Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.main-content {
  flex: 1;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary, #1a1a2e);
}

.view-container {
  flex: 1;
  width: 100%;
  height: 100%;
}

/* View Toggle Bar (Desktop: hidden in sidebar, Mobile: visible) */
.view-toggle-bar {
  display: none;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #252540);
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.view-toggle-bar button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle-bar button:hover {
  background: #353558;
  color: var(--color-text-secondary, #aaa);
}

.view-toggle-bar button.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-accent, #4ade80);
}

.view-toggle-bar button svg {
  width: 16px;
  height: 16px;
}

.btn-export-mobile {
  margin-left: auto;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #252540 100%);
  z-index: 100;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 60px;
  height: 60px;
  margin: 0 auto 24px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.2em;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.loading-subtext {
  font-size: 0.9em;
  color: #666;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .export-panel,
.modal-leave-active .export-panel {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .export-panel,
.modal-leave-to .export-panel {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

/* Responsive Layout */
@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .view-toggle-bar {
    display: flex;
  }
}
</style>
