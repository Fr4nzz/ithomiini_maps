import { ref, computed } from 'vue'

export function useTableSort(data, options = {}) {
  const sortKey = ref(options.defaultSortKey ?? null)
  const sortDirection = ref(options.defaultDirection ?? 'asc')
  const unsortableColumns = options.unsortableColumns ?? []

  const sortedData = computed(() => {
    const list = [...data.value]
    if (!sortKey.value) return list

    if (options.compareRows) {
      list.sort((a, b) => options.compareRows(a, b, sortKey.value, sortDirection.value))
      return list
    }

    list.sort((a, b) => {
      const valA = a?.[sortKey.value] ?? ''
      const valB = b?.[sortKey.value] ?? ''
      if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
      return 0
    })
    return list
  })

  const toggleSort = (column) => {
    if (unsortableColumns.includes(column)) return false

    if (sortKey.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = column
      sortDirection.value = 'asc'
    }

    return true
  }

  return {
    sortKey,
    sortDirection,
    sortedData,
    toggleSort
  }
}
