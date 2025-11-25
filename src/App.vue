<script setup>
import { onMounted } from 'vue'
import { useDataStore } from './stores/data'
import Sidebar from './components/Sidebar.vue'
import MapEngine from './components/MapEngine.vue'

const store = useDataStore()

onMounted(() => {
  store.loadMapData()
})
</script>

<template>
  <div class="app-container">
    <Sidebar />
    <main class="map-container">
      <MapEngine v-if="!store.loading" />
      <div v-else class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">Loading distribution data...</p>
          <p class="loading-subtext">Preparing {{ store.allFeatures.length || '~30,000' }} records</p>
        </div>
      </div>
    </main>
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

.map-container {
  flex: 1;
  position: relative;
  height: 100%;
  background: var(--color-bg-primary, #1a1a2e);
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

/* Responsive Layout */
@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
}
</style>
