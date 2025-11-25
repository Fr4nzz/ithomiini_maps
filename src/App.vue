<script setup>
import MapEngine from './components/MapEngine.vue'
import Sidebar from './components/Sidebar.vue'
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar (Fixed Width) -->
    <Sidebar />
    
    <!-- Map (Takes remaining space) -->
    <div class="map-container">
      <MapEngine />
    </div>
  </div>
</template>

<style>
/* Global Reset */
body { 
  margin: 0; 
  padding: 0; 
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden; /* Prevent full page scroll */
}

/* Flex Layout */
.app-layout { 
  display: flex; 
  height: 100vh; 
  width: 100vw; 
}

.map-container {
  flex-grow: 1; /* Take all remaining space */
  position: relative;
}
</style>