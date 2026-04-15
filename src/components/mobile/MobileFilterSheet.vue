<script setup>
import { computed, inject } from 'vue'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import Sidebar from '@/components/Sidebar.vue'

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'export-for-r'])

const mobileLayout = inject('mobileLayout')

const sheetOpen = computed({
  get: () => mobileLayout?.activeSheet?.value === 'filter',
  set: (val) => {
    if (!val) mobileLayout?.closeSheet()
  },
})
</script>

<template>
  <Drawer v-model:open="sheetOpen" :modal="false" direction="bottom">
    <DrawerOverlay class="sheet-overlay" />
    <DrawerContent class="sheet-content" @pointer-down-outside.prevent @interact-outside.prevent>
      <div class="sheet-body">
        <Sidebar
          current-view="map"
          @open-export="emit('open-export')"
          @open-mimicry="emit('open-mimicry')"
          @open-gallery="emit('open-gallery')"
          @open-map-export="emit('open-map-export')"
          @export-for-r="emit('export-for-r')"
          @set-view="() => {}"
          class="mobile-sidebar-embed"
        />
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.sheet-overlay {
  background: transparent;
  pointer-events: none;
}

.sheet-content {
  max-height: 85dvh;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  background: hsl(var(--card, 240 15% 13%));
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.4);
}

.sheet-body {
  overflow-y: auto;
  max-height: calc(85dvh - 20px);
  -webkit-overflow-scrolling: touch;
}

.mobile-sidebar-embed {
  position: static !important;
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  border: none !important;
  background: transparent !important;
}

.mobile-sidebar-embed :deep(.sidebar-header) {
  display: none;
}

.mobile-sidebar-embed :deep(.sidebar-footer) {
  display: none;
}
</style>
