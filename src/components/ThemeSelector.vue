<script setup>
import { computed } from 'vue'
import { Sun, Moon, Palette, Check } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'
import { getThemeOptions } from '../themes/presets'

// shadcn-vue components
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

// Check if current theme is light mode
const isLightMode = computed(() => themeStore.currentTheme === 'light')

// Toggle between light and dark
function toggleLightDark(checked) {
  if (checked) {
    themeStore.setTheme('light')
  } else {
    // If currently light, go to dark. Otherwise stay on current dark theme
    if (themeStore.currentTheme === 'light') {
      themeStore.setTheme('dark')
    }
  }
}

// Handle theme selection from dropdown
function handleThemeChange(value) {
  themeStore.setTheme(value)
}

// Get theme background color for swatch
function getThemeBgColor(themeName) {
  const theme = themeStore.availableThemes[themeName]
  return theme?.colors?.bgPrimary || '#1a1a2e'
}

// Get theme accent color for swatch
function getThemeAccentColor(themeName) {
  const theme = themeStore.availableThemes[themeName]
  return theme?.colors?.accent || '#4ade80'
}
</script>

<template>
  <div class="theme-selector space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 text-muted-foreground">
      <Palette class="h-4 w-4" />
      <span class="text-xs font-medium uppercase tracking-wide">Theme</span>
    </div>

    <!-- Light/Dark Toggle -->
    <div class="flex items-center justify-between">
      <Label class="flex items-center gap-2 text-sm cursor-pointer">
        <component :is="isLightMode ? Sun : Moon" class="h-4 w-4" />
        <span>{{ isLightMode ? 'Light' : 'Dark' }} Mode</span>
      </Label>
      <Switch
        :checked="isLightMode"
        @update:checked="toggleLightDark"
      />
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
            <div class="flex items-center gap-2">
              <div
                class="h-4 w-4 rounded-full border border-border"
                :style="{ backgroundColor: getThemeBgColor(option.value) }"
              >
                <div
                  class="h-1.5 w-1.5 rounded-full absolute bottom-0.5 right-0.5"
                  :style="{ backgroundColor: getThemeAccentColor(option.value) }"
                />
              </div>
              <span>{{ option.label }}</span>
              <span v-if="option.value === 'dark'" class="text-xs text-muted-foreground">(Default)</span>
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
        :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-background': themeStore.currentTheme === option.value }"
        :title="option.label"
        :style="{
          backgroundColor: getThemeBgColor(option.value),
        }"
        @click="themeStore.setTheme(option.value)"
      >
        <div
          class="accent-dot"
          :style="{ backgroundColor: getThemeAccentColor(option.value) }"
        />
        <Check
          v-if="themeStore.currentTheme === option.value"
          class="check-icon"
          :style="{ color: getThemeAccentColor(option.value) }"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.theme-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.theme-swatch:hover {
  transform: scale(1.1);
}

.accent-dot {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.check-icon {
  width: 12px;
  height: 12px;
  z-index: 1;
}
</style>
