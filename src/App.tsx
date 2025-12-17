import { useEffect, useState } from 'react'
import { useRecords, useDataStore, loadGbifCitation } from '@/features/data'
import { MapView } from '@/features/map'
import { TableView } from '@/features/table'
import { Sidebar } from '@/features/filters'
import { ImageGallery } from '@/features/gallery'
import { ExportDialog } from '@/features/export'
import { useUrlState } from '@/shared/hooks'

function App() {
  // Load records from JSON
  const { data: records, isLoading, error } = useRecords()
  const setRecords = useDataStore((s) => s.setRecords)
  const setGbifCitation = useDataStore((s) => s.setGbifCitation)
  const view = useDataStore((s) => s.ui.view)

  // URL state sync
  useUrlState()

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryInitialId, setGalleryInitialId] = useState<string | undefined>()

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false)

  // Populate store when data loads
  useEffect(() => {
    if (records) {
      setRecords(records)
    }
  }, [records, setRecords])

  // Load GBIF citation data
  useEffect(() => {
    loadGbifCitation().then((citation) => {
      if (citation) {
        setGbifCitation(citation)
      }
    })
  }, [setGbifCitation])

  // Open gallery from external trigger (e.g., PointDetailsSheet)
  const openGallery = (specimenId?: string) => {
    setGalleryInitialId(specimenId)
    setGalleryOpen(true)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar with integrated header */}
      <Sidebar
        onGalleryOpen={() => openGallery()}
        onExportOpen={() => setExportOpen(true)}
      />

      {/* Map/Table View */}
      <main className="relative flex-1 h-full overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <p className="text-muted-foreground">Loading records...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <p className="text-destructive">Error: {error.message}</p>
          </div>
        )}
        {view === 'map' ? <MapView /> : <TableView />}
      </main>

      {/* Image Gallery */}
      <ImageGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialSpecimenId={galleryInitialId}
      />

      {/* Export Dialog */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}

export default App
