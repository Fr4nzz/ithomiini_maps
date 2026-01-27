<script setup>
import { Sun, Moon, Palette, Check } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'
import { getThemeOptions } from '../themes/presets'

// shadcn-vue components
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const themeStore = useThemeStore()
const themeOptions = getThemeOptions()

// Toggle light/dark mode
function toggleMode() {
  themeStore.toggleMode()
}

// Handle theme selection from dropdown
function handleThemeChange(value) {
  themeStore.setTheme(value)
}

// Get theme background color for swatch (based on current mode)
function getThemeBgColor(option) {
  return themeStore.isDarkMode ? option.previewBgDark : option.previewBgLight
}

// Get theme accent color for swatch
function getThemeAccentColor(option) {
  return option.accentColor
}
</script>

<template>
  <div class="theme-selector space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 text-muted-foreground">
      <Palette class="h-4 w-4" />
      <span class="text-xs font-medium uppercase tracking-wide">Theme</span>
    </div>

    <!-- Light/Dark Toggle - Custom pill toggle like tweakcn -->
    <div class="flex items-center justify-between">
      <Label class="flex items-center gap-2 text-sm">
        <component :is="themeStore.isDarkMode ? Moon : Sun" class="h-4 w-4" />
        <span>{{ themeStore.isDarkMode ? 'Dark' : 'Light' }} Mode</span>
      </Label>

      <!-- Custom toggle button with sun/moon icons -->
      <button
        class="mode-toggle"
        :class="{ 'is-light': !themeStore.isDarkMode }"
        @click="toggleMode"
        :title="themeStore.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <span class="toggle-track">
          <Sun class="toggle-icon sun-icon" />
          <Moon class="toggle-icon moon-icon" />
          <span class="toggle-thumb" />
        </span>
      </button>
    </div>

    <Separator />

    <!-- Theme Preset Dropdown -->
    <div class="space-y-2">
      <Label class="text-sm text-muted-foreground">Theme Preset</Label>
      <Select
        :model-value="themeStore.currentTheme"
        @update:model-value="handleThemeChange"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in themeOptions"
            :key="option.value"
            :value="option.value"
          >
            <div class="flex items-center gap-3">
              <div
                class="theme-preview-swatch"
                :style="{ backgroundColor: getThemeBgColor(option) }"
              >
                <div
                  class="accent-indicator"
                  :style="{ backgroundColor: getThemeAccentColor(option) }"
                />
              </div>
              <span>{{ option.label }}</span>
              <span v-if="option.value === 'scientific'" class="text-xs text-muted-foreground ml-auto">(Default)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Theme Preview Swatches -->
    <div class="flex gap-2 flex-wrap pt-1">
      <button
        v-for="option in themeOptions"
        :key="option.value"
        class="theme-swatch"
        :class="{ 'active': themeStore.currentTheme === option.value }"
        :title="`${option.label} - ${option.description}`"
        :style="{
          backgroundColor: getThemeBgColor(option),
        }"
        @click="themeStore.setTheme(option.value)"
      >
        <div
          class="accent-dot"
          :style="{ backgroundColor: getThemeAccentColor(option) }"
        />
        <Check
          v-if="themeStore.currentTheme === option.value"
          class="check-icon"
          :style="{ color: getThemeAccentColor(option) }"
        />
      </button>
    </div>

    <!-- Current Selection Info -->
    <div class="text-xs text-muted-foreground pt-2">
      <span class="font-medium">{{ themeStore.availableThemes[themeStore.currentTheme]?.name }}</span>
      <span> - {{ themeStore.isDarkMode ? 'Dark' : 'Light' }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Custom mode toggle like tweakcn */
.mode-toggle {
  position: relative;
  width: 56px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.toggle-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 4px;
  background: hsl(var(--muted));
  border-radius: 14px;
  border: 1px solid hsl(var(--border));
  position: relative;
  transition: background-color 0.2s ease;
}

.mode-toggle:hover .toggle-track {
  border-color: hsl(var(--primary) / 0.5);
}

.toggle-icon {
  width: 14px;
  height: 14px;
  z-index: 1;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.sun-icon {
  color: hsl(var(--muted-foreground));
  margin-left: 2px;
}

.moon-icon {
  color: hsl(var(--foreground));
  margin-right: 2px;
}

/* In dark mode (default): moon is active */
.mode-toggle:not(.is-light) .moon-icon {
  color: hsl(var(--primary));
}

.mode-toggle:not(.is-light) .sun-icon {
  color: hsl(var(--muted-foreground));
}

/* In light mode: sun is active */
.mode-toggle.is-light .sun-icon {
  color: hsl(var(--primary));
}

.mode-toggle.is-light .moon-icon {
  color: hsl(var(--muted-foreground));
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: hsl(var(--background));
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

/* Light mode: thumb moves to right */
.mode-toggle.is-light .toggle-thumb {
  transform: translateX(28px);
}

.theme-preview-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid hsl(var(--border));
  position: relative;
  flex-shrink: 0;
}

.theme-preview-swatch .accent-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.theme-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid hsl(var(--border));
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.theme-swatch:hover {
  transform: scale(1.1);
  border-color: hsl(var(--primary) / 0.5);
}

.theme-swatch.active {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary));
}

.accent-dot {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.check-icon {
  width: 14px;
  height: 14px;
  z-index: 1;
}
</style>
