import { useEffect, useState } from 'react'
import { ModeToggle } from '@/components/mode-toggle'
import { useRecords, useDataStore, loadGbifCitation } from '@/features/data'
import { MapView } from '@/features/map'
import { TableView } from '@/features/table'
import { Sidebar } from '@/features/filters'
import { ImageGallery } from '@/features/gallery'
import { ExportDialog } from '@/features/export'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useUrlState } from '@/shared/hooks'
import { Image as ImageIcon, Map, Table2, Download } from 'lucide-react'
import MapIcon from '@/assets/Map_icon.svg'

function App() {
  // Load records from JSON
  const { data: records, isLoading, error } = useRecords()
  const setRecords = useDataStore((s) => s.setRecords)
  const setGbifCitation = useDataStore((s) => s.setGbifCitation)
  const view = useDataStore((s) => s.ui.view)
  const setView = useDataStore((s) => s.setView)

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
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <a
          href="https://github.com/Fr4nzz/ithomiini_maps"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 no-underline transition-opacity hover:opacity-85"
        >
          <img src={MapIcon} alt="Ithomiini Maps" className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="text-xl font-semibold tracking-tight">Ithomiini</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Distribution Maps
            </span>
          </div>
        </a>
        <div className="flex items-center gap-4">
          {/* View toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as 'map' | 'table')}>
            <TabsList>
              <TabsTrigger value="map" className="gap-1.5">
                <Map className="h-4 w-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <Table2 className="h-4 w-4" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => openGallery()}
          >
            <ImageIcon className="h-4 w-4" />
            Gallery
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>

          <ModeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Map/Table View */}
        <main className="relative flex-1">
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
      </div>

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
