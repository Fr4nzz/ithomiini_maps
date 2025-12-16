import { useRef } from 'react'
import { useMaplibre } from './useMaplibre'
import { useFilteredCount, useTotalCount } from '@/features/data'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const filteredCount = useFilteredCount()
  const totalCount = useTotalCount()

  useMaplibre(containerRef, {
    onMapReady: (map) => {
      console.log('Map ready:', map)
    },
    onPointClick: (id, coords) => {
      console.log('Point clicked:', id, coords)
    },
  })

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Record count overlay */}
      <div className="absolute left-4 top-4 rounded-lg bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur">
        <span className="font-medium">
          {filteredCount.toLocaleString()}
        </span>
        <span className="text-muted-foreground">
          {' / '}
          {totalCount.toLocaleString()} records
        </span>
      </div>
    </div>
  )
}
