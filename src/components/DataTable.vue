<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()

// Pagination
const pageSize = ref(50)
const currentPage = ref(1)

// Sorting
const sortColumn = ref('scientific_name')
const sortDirection = ref('asc')

// Column visibility
const visibleColumns = ref({
  photo: true,
  id: true,
  scientific_name: true,
  subspecies: true,
  mimicry_ring: true,
  sequencing_status: true,
  source: true,
  observation_date: true,
  country: true,
  lat: false,
  lng: false,
})

// Column definitions
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

// Get raw data from filtered GeoJSON
const rawData = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features.map(f => f.properties)
})

// Sorted data
const sortedData = computed(() => {
  const data = [...rawData.value]
  
  data.sort((a, b) => {
    let valA = a[sortColumn.value] || ''
    let valB = b[sortColumn.value] || ''
    
    // Handle numeric columns
    if (sortColumn.value === 'lat' || sortColumn.value === 'lng') {
      valA = parseFloat(valA) || 0
      valB = parseFloat(valB) || 0
    } else {
      valA = String(valA).toLowerCase()
      valB = String(valB).toLowerCase()
    }
    
    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  
  return data
})

// Paginated data
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedData.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => {
  return Math.ceil(sortedData.value.length / pageSize.value)
})

// Page numbers to display
const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    
    if (current > 3) pages.push('...')
    
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    
    for (let i = start; i <= end; i++) pages.push(i)
    
    if (current < total - 2) pages.push('...')
    
    pages.push(total)
  }
  
  return pages
})

// Reset to page 1 when data changes
watch(rawData, () => {
  currentPage.value = 1
})

// Sort handler
const toggleSort = (column) => {
  if (column === 'photo') return // Don't sort by photo
  
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
  currentPage.value = 1
}

// Column toggle panel
const showColumnSettings = ref(false)

// Status color helper - Updated with new GBIF statuses
const getStatusColor = (status) => {
  const colors = {
    'Sequenced': '#3b82f6',
    'Tissue Available': '#10b981',
    'Preserved Specimen': '#f59e0b',
    'Published': '#a855f7',
    'GBIF Record': '#6b7280',
    'Observation': '#22c55e',      // Green - Research Grade equivalent
    'Museum Specimen': '#8b5cf6',
    'Living Specimen': '#14b8a6',
  }
  return colors[status] || '#6b7280'
}

// Visible columns array for v-for
const activeColumns = computed(() => {
  return columns.filter(col => visibleColumns.value[col.key])
})

// Photo helpers using store's getPhotoForItem
const getPhotoInfo = (row) => {
  return store.getPhotoForItem(row)
}

// Image proxy URL
const getProxiedUrl = (url) => {
  if (!url) return null
  // Use wsrv.nl proxy for smaller thumbnails
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=60&h=60&fit=cover&output=webp`
}

// Image load error handling
const handleImageError = (e, originalUrl) => {
  // Try original URL without proxy if proxy fails
  if (originalUrl && !e.target.src.includes('drive.google.com')) {
    e.target.src = originalUrl
  } else {
    // Hide broken image
    e.target.style.display = 'none'
  }
}
</script>

<template>
  <div class="data-table-container">
    <!-- Header Bar -->
    <div class="table-header">
      <div class="header-left">
        <span class="record-count">
          <strong>{{ sortedData.length.toLocaleString() }}</strong> records
        </span>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
      </div>
      
      <div class="header-right">
        <!-- Page Size -->
        <select v-model="pageSize" class="page-size-select" @change="currentPage = 1">
          <option :value="25">25 rows</option>
          <option :value="50">50 rows</option>
          <option :value="100">100 rows</option>
          <option :value="200">200 rows</option>
        </select>
        
        <!-- Column Settings -->
        <button 
          class="btn-columns"
          @click="showColumnSettings = !showColumnSettings"
          :class="{ active: showColumnSettings }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Columns
        </button>
        
        <!-- Column Settings Dropdown -->
        <Transition name="fade">
          <div v-if="showColumnSettings" class="column-dropdown">
            <label 
              v-for="col in columns" 
              :key="col.key"
              class="column-toggle"
            >
              <input 
                type="checkbox" 
                v-model="visibleColumns[col.key]"
              />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th 
              v-for="col in activeColumns"
              :key="col.key"
              :style="{ width: col.width }"
              @click="toggleSort(col.key)"
              class="sortable"
              :class="{ sorted: sortColumn === col.key, 'no-sort': col.key === 'photo' }"
            >
              <div class="th-content">
                <span>{{ col.label }}</span>
                <svg 
                  v-if="sortColumn === col.key && col.key !== 'photo'"
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2"
                  class="sort-icon"
                  :class="{ desc: sortDirection === 'desc' }"
                >
                  <path d="m18 15-6-6-6 6"/>
                </svg>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in paginatedData" :key="row.id || idx">
            <!-- Photo Column -->
            <td v-if="visibleColumns.photo" class="cell-photo">
              <div class="photo-cell">
                <template v-if="getPhotoInfo(row)">
                  <div class="photo-wrapper" :class="{ 'other-individual': !getPhotoInfo(row).sameIndividual }">
                    <img 
                      :src="getProxiedUrl(getPhotoInfo(row).url)"
                      @error="(e) => handleImageError(e, getPhotoInfo(row).url)"
                      loading="lazy"
                      :title="getPhotoInfo(row).sameIndividual ? 'Photo of this individual' : 'Photo from another individual of same species'"
                    />
                    <span 
                      v-if="!getPhotoInfo(row).sameIndividual" 
                      class="other-indicator"
                      title="Photo from another individual"
                    >
                      ≠
                    </span>
                  </div>
                </template>
                <span v-else class="no-photo">—</span>
              </div>
            </td>
            <td v-if="visibleColumns.id" class="cell-id">
              {{ row.id }}
            </td>
            <td v-if="visibleColumns.scientific_name" class="cell-species">
              <em>{{ row.scientific_name }}</em>
            </td>
            <td v-if="visibleColumns.subspecies" class="cell-subspecies">
              {{ row.subspecies || '—' }}
            </td>
            <td v-if="visibleColumns.mimicry_ring" class="cell-mimicry">
              <span 
                v-if="row.mimicry_ring && row.mimicry_ring !== 'Unknown'"
                class="mimicry-badge"
              >
                {{ row.mimicry_ring }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td v-if="visibleColumns.sequencing_status" class="cell-status">
              <span 
                class="status-badge"
                :style="{ '--status-color': getStatusColor(row.sequencing_status) }"
              >
                {{ row.sequencing_status }}
              </span>
            </td>
            <td v-if="visibleColumns.source" class="cell-source">
              {{ row.source }}
            </td>
            <td v-if="visibleColumns.country" class="cell-country">
              {{ row.country || '—' }}
            </td>
            <td v-if="visibleColumns.lat" class="cell-coord">
              {{ row.lat ? parseFloat(row.lat).toFixed(4) : '—' }}
            </td>
            <td v-if="visibleColumns.lng" class="cell-coord">
              {{ row.lng ? parseFloat(row.lng).toFixed(4) : '—' }}
            </td>
          </tr>
          
          <!-- Empty state -->
          <tr v-if="paginatedData.length === 0">
            <td :colspan="activeColumns.length" class="empty-state">
              <div class="empty-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <p>No records match your filters</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button 
        class="page-btn"
        :disabled="currentPage === 1"
        @click="currentPage = 1"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m11 17-5-5 5-5"/>
          <path d="m18 17-5-5 5-5"/>
        </svg>
      </button>
      
      <button 
        class="page-btn"
        :disabled="currentPage === 1"
        @click="currentPage--"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      
      <template v-for="page in visiblePages" :key="page">
        <span v-if="page === '...'" class="page-ellipsis">...</span>
        <button 
          v-else
          class="page-btn page-number"
          :class="{ active: page === currentPage }"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
      </template>
      
      <button 
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
      
      <button 
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="currentPage = totalPages"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m13 17 5-5-5-5"/>
          <path d="m6 17 5-5-5-5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.data-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary, #252540);
  border-radius: 8px;
  overflow: hidden;
}

/* Header Bar */
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-primary, #1a1a2e);
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.record-count {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #aaa);
}

.record-count strong {
  color: var(--color-accent, #4ade80);
}

.page-info {
  font-size: 0.8rem;
  color: var(--color-text-muted, #666);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.page-size-select {
  padding: 6px 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-columns {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-columns:hover,
.btn-columns.active {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.btn-columns svg {
  width: 14px;
  height: 14px;
}

/* Column Dropdown */
.column-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 8px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  min-width: 150px;
}

.column-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
  transition: background 0.2s;
}

.column-toggle:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
}

.column-toggle input {
  accent-color: var(--color-accent, #4ade80);
}

/* Table */
.table-wrapper {
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table th {
  position: sticky;
  top: 0;
  background: var(--color-bg-primary, #1a1a2e);
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-secondary, #aaa);
  border-bottom: 2px solid var(--color-border, #3d3d5c);
  white-space: nowrap;
  z-index: 10;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.data-table th.no-sort {
  cursor: default;
}

.data-table th.sorted {
  color: var(--color-accent, #4ade80);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}

.sort-icon.desc {
  transform: rotate(180deg);
}

.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  color: var(--color-text-primary, #e0e0e0);
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: rgba(74, 222, 128, 0.05);
}

/* Cell Types */
.cell-id {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--color-text-muted, #888);
}

.cell-species em {
  color: var(--color-text-primary, #e0e0e0);
}

.cell-subspecies {
  font-style: italic;
  color: var(--color-text-secondary, #aaa);
}

.cell-coord {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--color-text-muted, #888);
}

/* Photo Cell */
.cell-photo {
  padding: 4px 8px;
}

.photo-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.photo-wrapper {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-tertiary, #2d2d4a);
}

.photo-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-wrapper.other-individual {
  border: 2px dashed var(--color-text-muted, #666);
}

.other-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #f59e0b;
  font-weight: bold;
}

.no-photo {
  color: var(--color-text-muted, #666);
}

/* Badges */
.mimicry-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.75rem;
}

.status-badge::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-color);
}

.text-muted {
  color: var(--color-text-muted, #666);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px !important;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-text-muted, #666);
}

.empty-content svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: var(--color-bg-primary, #1a1a2e);
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-accent, #4ade80);
}

.page-btn svg {
  width: 14px;
  height: 14px;
}

.page-ellipsis {
  padding: 0 8px;
  color: var(--color-text-muted, #666);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
