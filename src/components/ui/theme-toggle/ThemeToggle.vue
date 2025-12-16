<script setup>
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <Button
    variant="ghost"
    size="icon-sm"
    @click="toggleTheme"
    :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <Sun v-if="theme === 'dark'" class="h-4 w-4" />
    <Moon v-else class="h-4 w-4" />
  </Button>
</template>
