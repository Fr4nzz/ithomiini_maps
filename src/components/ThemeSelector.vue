<script setup>
import { computed } from 'vue'
import { Palette, ChevronDown, Check } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'
import { getThemeOptions } from '../themes/presets'

const themeStore = useThemeStore()

const themeOptions = getThemeOptions()

const currentThemeName = computed(() => {
  const theme = themeStore.availableThemes[themeStore.currentTheme]
  return theme?.name || 'Unknown'
})

function selectTheme(themeName) {
  themeStore.setTheme(themeName)
}
</script>

<template>
  <div class="theme-selector">
    <label class="selector-label">
      <Palette :size="14" />
      <span>Theme</span>
    </label>

    <div class="theme-dropdown">
      <select
        :value="themeStore.currentTheme"
        class="theme-select"
        @change="selectTheme($event.target.value)"
      >
        <option
          v-for="option in themeOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <ChevronDown :size="14" class="dropdown-icon" />
    </div>

    <!-- Theme preview swatches -->
    <div class="theme-preview">
      <div
        v-for="option in themeOptions"
        :key="option.value"
        class="theme-swatch"
        :class="{ active: themeStore.currentTheme === option.value }"
        :title="option.label"
        :style="{
          '--swatch-bg': themeStore.availableThemes[option.value]?.colors.bgPrimary,
          '--swatch-accent': themeStore.availableThemes[option.value]?.colors.accent
        }"
        @click="selectTheme(option.value)"
      >
        <Check
          v-if="themeStore.currentTheme === option.value"
          :size="10"
          class="check-icon"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.theme-dropdown {
  position: relative;
  display: flex;
  align-items: center;
}

.theme-select {
  width: 100%;
  padding: 8px 32px 8px 12px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 14px;
  cursor: pointer;
  appearance: none;
  transition: all 0.15s ease;
}

.theme-select:hover {
  border-color: var(--color-accent, #4ade80);
}

.theme-select:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px var(--color-accent-subtle, rgba(74, 222, 128, 0.2));
}

.theme-select option {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
  padding: 8px;
}

.dropdown-icon {
  position: absolute;
  right: 10px;
  pointer-events: none;
  color: var(--color-text-muted, #666);
}

.theme-preview {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.theme-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--swatch-bg, #1a1a2e);
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-swatch::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--swatch-accent, #4ade80);
}

.theme-swatch:hover {
  transform: scale(1.1);
  border-color: var(--color-text-muted, #666);
}

.theme-swatch.active {
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 8px var(--swatch-accent, rgba(74, 222, 128, 0.4));
}

.check-icon {
  color: var(--swatch-accent, #4ade80);
  z-index: 1;
}
</style>
