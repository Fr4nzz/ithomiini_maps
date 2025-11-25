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
    <div class="map-container">
      <MapEngine v-if="!store.loading" />
      <div v-else class="loading-overlay">
        <div class="spinner"></div>
        <p>Loading data...</p>
      </div>
    </div>
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
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  color: #e0e0e0;
  gap: 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #333;
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  font-size: 1.1em;
  color: #888;
}
</style>
