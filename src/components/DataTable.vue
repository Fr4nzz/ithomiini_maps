<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, Search } from 'lucide-vue-next'

const store = useDataStore()
const pageSize = ref(50)
const currentPage = ref(1)
const sortColumn = ref('scientific_name')
const sortDirection = ref('asc')
const showColumnSettings = ref(false)

const visibleColumns = ref({
  photo: true, id: true, scientific_name: true, subspecies: true, mimicry_ring: true,
  sequencing_status: true, source: true, observation_date: true, country: true, lat: false, lng: false,
})

const columns = [
  { key: 'photo', label: 'Photo', width: '70px' },
  { key: 'id', label: 'ID', width: '120px' },
  { key: 'scientific_name', label: 'Species', width: '200px' },
  { key: 'subspecies', label: 'Subspecies', width: '130px' },
  { key: 'mimicry_ring', label: 'Mimicry Ring', width: '120px' },
  { key: 'sequencing_status', label: 'Status', width: '130px' },
  { key: 'source', label: 'Source', width: '130px' },
  { key: 'observation_date', label: 'Date', width: '100px' },
  { key: 'country', label: 'Country', width: '100px' },
  { key: 'lat', label: 'Latitude', width: '90px' },
  { key: 'lng', label: 'Longitude', width: '90px' },
]

const rawData = computed(() => {
  const geo = store.filteredGeoJSON
  return geo?.features?.map(f => f.properties) || []
})

function parseDate(dateStr) {
  if (!dateStr) return null
  const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (match) {
    const [, day, monthStr, yearShort] = match
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) return new Date(parseInt(yearShort) + (parseInt(yearShort) > 50 ? 1900 : 2000), month, parseInt(day))
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

const sortedData = computed(() => {
  const data = [...rawData.value]
  data.sort((a, b) => {
    let valA = a[sortColumn.value] || '', valB = b[sortColumn.value] || ''
    if (sortColumn.value === 'lat' || sortColumn.value === 'lng') { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0 }
    else if (sortColumn.value === 'observation_date') {
      const dateA = parseDate(valA), dateB = parseDate(valB)
      if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1
      valA = dateA.getTime(); valB = dateB.getTime()
    } else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase() }
    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  return data
})

const paginatedData = computed(() => sortedData.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
const totalPages = computed(() => Math.ceil(sortedData.value.length / pageSize.value))
const visiblePages = computed(() => {
  const pages = [], total = totalPages.value, current = currentPage.value
  if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i) }
  else {
    pages.push(1)
    if (current > 3) pages.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

watch(rawData, () => { currentPage.value = 1 })

const toggleSort = (column) => {
  if (column === 'photo') return
  if (sortColumn.value === column) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else { sortColumn.value = column; sortDirection.value = 'asc' }
  currentPage.value = 1
}

const statusColors = { 'Sequenced': 'bg-blue-500', 'Tissue Available': 'bg-emerald-500', 'Preserved Specimen': 'bg-amber-500', 'Published': 'bg-purple-500', 'GBIF Record': 'bg-gray-500', 'Observation': 'bg-green-500', 'Museum Specimen': 'bg-violet-500', 'Living Specimen': 'bg-teal-500' }
const activeColumns = computed(() => columns.filter(col => visibleColumns.value[col.key]))
const getPhotoInfo = (row) => store.getPhotoForItem(row)
const getProxiedUrl = (url) => url ? `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=60&h=60&fit=cover&output=webp` : null
const handleImageError = (e, originalUrl) => { if (originalUrl && !e.target.src.includes('drive.google.com')) e.target.src = originalUrl; else e.target.style.display = 'none' }
</script>

<template>
  <div class="flex flex-col h-full bg-card rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="flex justify-between items-center px-4 py-3 bg-background border-b border-border">
      <div class="flex items-center gap-4">
        <span class="text-sm text-secondary-foreground"><strong class="text-primary">{{ sortedData.length.toLocaleString() }}</strong> records</span>
        <span class="text-xs text-muted-foreground">Page {{ currentPage }} of {{ totalPages }}</span>
      </div>
      <div class="flex items-center gap-3 relative">
        <select v-model="pageSize" @change="currentPage = 1" class="px-2.5 py-1.5 bg-muted border border-border rounded-md text-sm text-foreground">
          <option :value="25">25 rows</option>
          <option :value="50">50 rows</option>
          <option :value="100">100 rows</option>
          <option :value="200">200 rows</option>
        </select>
        <Button variant="outline" size="sm" @click="showColumnSettings = !showColumnSettings" :class="showColumnSettings ? 'bg-accent' : ''">
          <LayoutGrid class="w-3.5 h-3.5 mr-1.5" />Columns
        </Button>
        <Transition name="fade">
          <div v-if="showColumnSettings" class="absolute top-full right-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-xl z-50 min-w-[150px]">
            <label v-for="col in columns" :key="col.key" class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm text-secondary-foreground">
              <Checkbox :checked="visibleColumns[col.key]" @update:checked="visibleColumns[col.key] = $event" />
              {{ col.label }}
            </label>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th v-for="col in activeColumns" :key="col.key" :style="{ width: col.width }" @click="toggleSort(col.key)"
              class="sticky top-0 bg-background px-3 py-2.5 text-left font-semibold text-secondary-foreground border-b-2 border-border whitespace-nowrap z-10"
              :class="[col.key !== 'photo' ? 'cursor-pointer hover:text-foreground' : '', sortColumn === col.key ? 'text-primary' : '']">
              <div class="flex items-center gap-1">
                <span>{{ col.label }}</span>
                <ChevronUp v-if="sortColumn === col.key && col.key !== 'photo'" class="w-3.5 h-3.5 transition-transform" :class="sortDirection === 'desc' ? 'rotate-180' : ''" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in paginatedData" :key="row.id || idx" class="hover:bg-primary/5 border-b border-border">
            <td v-if="visibleColumns.photo" class="px-2 py-1">
              <div class="flex justify-center">
                <template v-if="getPhotoInfo(row)">
                  <div class="relative w-[50px] h-[50px] rounded-md overflow-hidden bg-muted" :class="!getPhotoInfo(row).sameIndividual ? 'border-2 border-dashed border-muted-foreground' : ''">
                    <img :src="getProxiedUrl(getPhotoInfo(row).url)" @error="(e) => handleImageError(e, getPhotoInfo(row).url)" loading="lazy" class="w-full h-full object-cover" />
                    <span v-if="!getPhotoInfo(row).sameIndividual" class="absolute bottom-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center text-[10px] text-amber-500 font-bold">≠</span>
                  </div>
                </template>
                <span v-else class="text-muted-foreground">—</span>
              </div>
            </td>
            <td v-if="visibleColumns.id" class="px-3 py-2 font-mono text-xs text-muted-foreground">{{ row.id }}</td>
            <td v-if="visibleColumns.scientific_name" class="px-3 py-2"><em class="text-foreground">{{ row.scientific_name }}</em></td>
            <td v-if="visibleColumns.subspecies" class="px-3 py-2 italic text-secondary-foreground">{{ row.subspecies || '—' }}</td>
            <td v-if="visibleColumns.mimicry_ring" class="px-3 py-2">
              <Badge v-if="row.mimicry_ring && row.mimicry_ring !== 'Unknown'" variant="secondary" class="bg-purple-500/15 text-purple-400">{{ row.mimicry_ring }}</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td v-if="visibleColumns.sequencing_status" class="px-3 py-2">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded text-xs">
                <span class="w-2 h-2 rounded-full" :class="statusColors[row.sequencing_status] || 'bg-gray-500'"></span>
                {{ row.sequencing_status }}
              </span>
            </td>
            <td v-if="visibleColumns.source" class="px-3 py-2 text-foreground">{{ row.source }}</td>
            <td v-if="visibleColumns.observation_date" class="px-3 py-2 text-foreground">{{ row.observation_date || '—' }}</td>
            <td v-if="visibleColumns.country" class="px-3 py-2 text-foreground">{{ row.country || '—' }}</td>
            <td v-if="visibleColumns.lat" class="px-3 py-2 font-mono text-xs text-muted-foreground">{{ row.lat ? parseFloat(row.lat).toFixed(4) : '—' }}</td>
            <td v-if="visibleColumns.lng" class="px-3 py-2 font-mono text-xs text-muted-foreground">{{ row.lng ? parseFloat(row.lng).toFixed(4) : '—' }}</td>
          </tr>
          <tr v-if="paginatedData.length === 0">
            <td :colspan="activeColumns.length" class="text-center py-16">
              <div class="flex flex-col items-center gap-3 text-muted-foreground">
                <Search class="w-12 h-12 opacity-50" />
                <p>No records match your filters</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center items-center gap-1 px-4 py-3 bg-background border-t border-border">
      <Button variant="outline" size="icon" class="h-8 w-8" :disabled="currentPage === 1" @click="currentPage = 1"><ChevronsLeft class="w-4 h-4" /></Button>
      <Button variant="outline" size="icon" class="h-8 w-8" :disabled="currentPage === 1" @click="currentPage--"><ChevronLeft class="w-4 h-4" /></Button>
      <template v-for="page in visiblePages" :key="page">
        <span v-if="page === '...'" class="px-2 text-muted-foreground">...</span>
        <Button v-else variant="outline" size="sm" class="h-8 min-w-[32px]" :class="page === currentPage ? 'bg-primary text-primary-foreground border-primary' : ''" @click="currentPage = page">{{ page }}</Button>
      </template>
      <Button variant="outline" size="icon" class="h-8 w-8" :disabled="currentPage === totalPages" @click="currentPage++"><ChevronRight class="w-4 h-4" /></Button>
      <Button variant="outline" size="icon" class="h-8 w-8" :disabled="currentPage === totalPages" @click="currentPage = totalPages"><ChevronsRight class="w-4 h-4" /></Button>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
