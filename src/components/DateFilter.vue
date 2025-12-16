<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'
import { Button } from '@/components/ui/button'
import { Calendar, Filter, Info } from 'lucide-vue-next'

const store = useDataStore()
const startDate = ref('')
const endDate = ref('')

function parseDate(dateStr) {
  if (!dateStr) return null
  const ddMmmYy = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/
  const match = dateStr.match(ddMmmYy)
  if (match) {
    const [, day, monthStr, yearShort] = match
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      const year = parseInt(yearShort) + (parseInt(yearShort) > 50 ? 1900 : 2000)
      return new Date(year, month, parseInt(day))
    }
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

const getDateOffset = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

const quickRanges = [
  { label: 'All Time', start: '', end: '' },
  { label: 'Last Year', start: getDateOffset(-365), end: '' },
  { label: 'Last 5 Years', start: getDateOffset(-365 * 5), end: '' },
  { label: 'Last 10 Years', start: getDateOffset(-365 * 10), end: '' },
  { label: '2020s', start: '2020-01-01', end: '2029-12-31' },
  { label: '2010s', start: '2010-01-01', end: '2019-12-31' },
  { label: '2000s', start: '2000-01-01', end: '2009-12-31' },
  { label: 'Pre-2000', start: '', end: '1999-12-31' },
]

const dateStats = computed(() => {
  const features = store.allFeatures || []
  let earliest = null, latest = null, withDates = 0, withoutDates = 0
  features.forEach(f => {
    const dateStr = f.observation_date || f.date || f.preservation_date
    const d = parseDate(dateStr)
    if (d) {
      withDates++
      if (!earliest || d < earliest) earliest = d
      if (!latest || d > latest) latest = d
    } else withoutDates++
  })
  return {
    earliest: earliest ? earliest.toISOString().split('T')[0] : null,
    latest: latest ? latest.toISOString().split('T')[0] : null,
    withDates, withoutDates, total: features.length
  }
})

const applyQuickRange = (range) => { startDate.value = range.start; endDate.value = range.end; applyFilter() }
const applyFilter = () => { store.filters.dateStart = startDate.value || null; store.filters.dateEnd = endDate.value || null }
const clearFilter = () => { startDate.value = ''; endDate.value = ''; store.filters.dateStart = null; store.filters.dateEnd = null }
const isFilterActive = computed(() => !!store.filters.dateStart || !!store.filters.dateEnd)

watch(() => [store.filters.dateStart, store.filters.dateEnd], ([start, end]) => {
  startDate.value = start || ''; endDate.value = end || ''
})
</script>

<template>
  <div class="bg-muted rounded-lg p-3.5 mb-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2 text-sm font-medium text-foreground">
        <Calendar class="w-4 h-4 text-primary" />
        <span>Date Filter</span>
      </div>
      <div class="flex items-center gap-1.5 text-[11px]">
        <span class="text-primary">{{ dateStats.withDates.toLocaleString() }} with dates</span>
        <span class="text-muted-foreground">•</span>
        <span class="text-muted-foreground">{{ dateStats.withoutDates.toLocaleString() }} without</span>
      </div>
    </div>

    <!-- Date range info -->
    <div v-if="dateStats.earliest" class="flex items-center gap-1.5 px-2.5 py-2 bg-background rounded-md text-xs text-muted-foreground mb-3">
      <span>Data range:</span>
      <strong class="text-secondary-foreground font-medium">{{ dateStats.earliest }}</strong>
      <span>to</span>
      <strong class="text-secondary-foreground font-medium">{{ dateStats.latest }}</strong>
    </div>

    <!-- Quick ranges -->
    <div class="flex flex-wrap gap-1.5 mb-3">
      <Button
        v-for="range in quickRanges"
        :key="range.label"
        variant="outline"
        size="sm"
        class="h-7 px-2.5 text-[11px]"
        :class="startDate === range.start && endDate === range.end ? 'bg-primary/15 border-primary text-primary' : ''"
        @click="applyQuickRange(range)"
      >
        {{ range.label }}
      </Button>
    </div>

    <!-- Custom date inputs -->
    <div class="flex items-end gap-2.5 mb-3">
      <div class="flex-1">
        <label class="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">From</label>
        <input type="date" v-model="startDate" :max="endDate || dateStats.latest" @change="applyFilter"
          class="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
      <span class="text-muted-foreground pb-1.5">—</span>
      <div class="flex-1">
        <label class="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">To</label>
        <input type="date" v-model="endDate" :min="startDate || dateStats.earliest" @change="applyFilter"
          class="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary" />
      </div>
    </div>

    <!-- Active filter indicator -->
    <div v-if="isFilterActive" class="flex items-center justify-between px-2.5 py-2 bg-primary/10 rounded-md mb-2.5">
      <span class="flex items-center gap-1.5 text-xs text-primary">
        <Filter class="w-3 h-3" />
        Date filter active
      </span>
      <Button variant="ghost" size="sm" class="h-6 px-2.5 text-[11px] text-primary hover:bg-primary/15" @click="clearFilter">
        Clear
      </Button>
    </div>

    <!-- Note -->
    <p class="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed m-0">
      <Info class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      Records without dates are hidden when a date filter is active.
    </p>
  </div>
</template>

<!-- Styles moved to src/styles/components.css for reliable Tailwind v4 processing -->
