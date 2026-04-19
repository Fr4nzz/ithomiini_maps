import { ref, computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export function useMobileLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = computed(() => !isMobile.value && !isTablet.value)

  const activeSheet = ref('none')
  const sheetSnapPoint = ref(0.15)
  const detailPointData = ref(null)

  const showActionBar = computed(() => {
    if (!isMobile.value) return false
    return activeSheet.value === 'none' || sheetSnapPoint.value <= 0.5
  })

  function openSheet(name) {
    activeSheet.value = name
    if (name !== 'detail') {
      detailPointData.value = null
    }
    sheetSnapPoint.value = 0.5
  }

  function closeSheet() {
    activeSheet.value = 'none'
    detailPointData.value = null
    sheetSnapPoint.value = 0.15
  }

  function openDetailSheet(pointData) {
    detailPointData.value = pointData
    activeSheet.value = 'detail'
    sheetSnapPoint.value = 0.15
  }

  function clearDetailSheet() {
    detailPointData.value = null
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    activeSheet,
    sheetSnapPoint,
    detailPointData,
    showActionBar,
    openSheet,
    closeSheet,
    clearDetailSheet,
    openDetailSheet,
  }
}
