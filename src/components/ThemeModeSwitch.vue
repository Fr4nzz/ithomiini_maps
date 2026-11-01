<script setup>
// The way back to System in the palette menus: shown only while Light or Dark was chosen with the sun/moon
// button (ThemeToggleButton.vue). The choice is remembered on this device (stores/theme.js).
import { MonitorSmartphone } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <button
    v-if="themeStore.modePref !== 'system'"
    type="button"
    class="mode-system"
    data-theme-system
    @click.stop="themeStore.setModePref('system')"
  >
    <MonitorSmartphone class="mode-system-icon" aria-hidden="true" />
    <span>Use the system theme</span>
  </button>
</template>

<style scoped>
.mode-system {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  padding: 4px 8px;
  margin-bottom: 6px;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.mode-system:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.mode-system:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.mode-system-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

@media (pointer: coarse) {
  .mode-system { min-height: 44px; }
}
</style>
