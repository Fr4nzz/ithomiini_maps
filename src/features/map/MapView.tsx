import { useRef, useState, useCallback, useEffect } from 'react'
import { useMaplibre } from './useMaplibre'
import { PointDetailsSheet } from './PointDetailsSheet'
import { useFilteredCount, useTotalCount, useDataStore } from '@/features/data'

interface SelectedPoint {
  ids: string[]
  coordinates: { lat: number; lng: number }
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const filteredCount = useFilteredCount()
  const totalCount = useTotalCount()
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)
  const setMapExportFn = useDataStore((s) => s.setMapExportFn)

  // Sheet state for point details
  const [selectedPoint, setSelectedPointState] = useState<SelectedPoint | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handlePointClick = useCallback(
    (ids: string | string[], coords: { lat: number; lng: number }) => {
      const idArray = Array.isArray(ids) ? ids : [ids]
      setSelectedPointState({ ids: idArray, coordinates: coords })
      setSheetOpen(true)
      // Also update the store for potential use elsewhere
      setSelectedPoint(idArray[0])
    },
    [setSelectedPoint]
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      setSheetOpen(open)
      if (!open) {
        setSelectedPointState(null)
        setSelectedPoint(null)
      }
    },
    [setSelectedPoint]
  )

  const { exportMapImage } = useMaplibre(containerRef, {
    onPointClick: handlePointClick,
  })

  // Register export function with store
  useEffect(() => {
    setMapExportFn(exportMapImage)
    return () => setMapExportFn(null)
  }, [exportMapImage, setMapExportFn])

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Record count overlay */}
      <div className="absolute left-4 top-4 rounded-lg bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur">
        <span className="font-medium">{filteredCount.toLocaleString()}</span>
        <span className="text-muted-foreground">
          {' / '}
          {totalCount.toLocaleString()} records
        </span>
      </div>

      {/* Point details sheet */}
      <PointDetailsSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        pointIds={selectedPoint?.ids || []}
        coordinates={selectedPoint?.coordinates}
      />
    </div>
  )
}
