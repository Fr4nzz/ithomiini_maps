import { useState, useMemo, useCallback, useEffect } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Badge } from '@/shared/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { useDataStore, useFilteredRecords } from '@/features/data'
import { getProxiedUrl, getThumbnailUrl } from '@/shared/lib/imageProxy'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  Calendar,
  Dna,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import type { Record as DataRecord } from '@/features/data/types'

// Status colors matching the rest of the app
const STATUS_COLORS: { [key: string]: string } = {
  Sequenced: '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  Published: '#a855f7',
}

interface ImageGalleryProps {
  open: boolean
  onClose: () => void
  initialSpecimenId?: string
}

interface GroupedBySpecies {
  [species: string]: {
    count: number
    subspecies: {
      [subspecies: string]: {
        count: number
        individuals: DataRecord[]
      }
    }
  }
}

function groupBySpecies(records: DataRecord[]): GroupedBySpecies {
  const grouped: GroupedBySpecies = {}

  for (const record of records) {
    if (!record.image_url) continue

    const species = record.scientific_name || 'Unknown'
    const subspecies = record.subspecies || 'No subspecies'

    if (!grouped[species]) {
      grouped[species] = { count: 0, subspecies: {} }
    }

    if (!grouped[species].subspecies[subspecies]) {
      grouped[species].subspecies[subspecies] = { count: 0, individuals: [] }
    }

    grouped[species].count++
    grouped[species].subspecies[subspecies].count++
    grouped[species].subspecies[subspecies].individuals.push(record)
  }

  return grouped
}

export function ImageGallery({ open, onClose, initialSpecimenId }: ImageGalleryProps) {
  const filteredRecords = useFilteredRecords()
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)

  // Get all specimens with images
  const specimensWithImages = useMemo(
    () => filteredRecords.filter((r) => r.image_url),
    [filteredRecords]
  )

  // Group by species
  const groupedBySpecies = useMemo(
    () => groupBySpecies(specimensWithImages),
    [specimensWithImages]
  )

  // Species list sorted by count
  const speciesList = useMemo(
    () =>
      Object.entries(groupedBySpecies)
        .map(([species, data]) => ({ species, count: data.count }))
        .sort((a, b) => b.count - a.count),
    [groupedBySpecies]
  )

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectedSubspecies, setSelectedSubspecies] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Initialize from initial specimen
  useEffect(() => {
    if (!open) return

    if (initialSpecimenId) {
      const idx = specimensWithImages.findIndex((s) => s.id === initialSpecimenId)
      if (idx >= 0) {
        setCurrentIndex(idx)
        const specimen = specimensWithImages[idx]
        setSelectedSpecies(specimen.scientific_name)
        setSelectedSubspecies(specimen.subspecies)
      }
    } else if (specimensWithImages.length > 0) {
      setCurrentIndex(0)
      const first = specimensWithImages[0]
      setSelectedSpecies(first.scientific_name)
      setSelectedSubspecies(first.subspecies)
    }
  }, [open, initialSpecimenId, specimensWithImages])

  // Subspecies list for selected species
  const subspeciesList = useMemo(() => {
    if (!selectedSpecies || !groupedBySpecies[selectedSpecies]) return []
    return Object.entries(groupedBySpecies[selectedSpecies].subspecies)
      .map(([name, data]) => ({ name, count: data.count }))
      .sort((a, b) => b.count - a.count)
  }, [selectedSpecies, groupedBySpecies])

  // Individuals list for selected species/subspecies
  const individualsList = useMemo(() => {
    if (!selectedSpecies || !groupedBySpecies[selectedSpecies]) {
      return specimensWithImages
    }

    const speciesGroup = groupedBySpecies[selectedSpecies]
    if (selectedSubspecies && speciesGroup.subspecies[selectedSubspecies]) {
      return speciesGroup.subspecies[selectedSubspecies].individuals
    }

    return Object.values(speciesGroup.subspecies).flatMap((s) => s.individuals)
  }, [selectedSpecies, selectedSubspecies, groupedBySpecies, specimensWithImages])

  const currentSpecimen = specimensWithImages[currentIndex] || null

  // Navigation
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < specimensWithImages.length - 1

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIndex((i) => i - 1)
      setIsLoading(true)
      setLoadError(false)
    }
  }, [hasPrev])

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex((i) => i + 1)
      setIsLoading(true)
      setLoadError(false)
    }
  }, [hasNext])

  const selectSpecimen = useCallback(
    (id: string) => {
      const idx = specimensWithImages.findIndex((s) => s.id === id)
      if (idx >= 0) {
        setCurrentIndex(idx)
        setIsLoading(true)
        setLoadError(false)
      }
    },
    [specimensWithImages]
  )

  // Update selection when current specimen changes
  useEffect(() => {
    if (currentSpecimen) {
      setSelectedSpecies(currentSpecimen.scientific_name)
      setSelectedSubspecies(currentSpecimen.subspecies)
    }
  }, [currentSpecimen])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrev()
          break
        case 'ArrowRight':
          goToNext()
          break
        case 'Escape':
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, goToPrev, goToNext, onClose])

  // View on map
  const viewOnMap = useCallback(() => {
    if (currentSpecimen) {
      setSelectedPoint(currentSpecimen.id)
      onClose()
    }
  }, [currentSpecimen, setSelectedPoint, onClose])

  if (!open) return null

  // Empty state
  if (specimensWithImages.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
        <ImageIcon className="mb-5 h-20 w-20 opacity-50 text-muted-foreground" />
        <h3 className="mb-2.5 text-2xl text-secondary-foreground">No Images Available</h3>
        <p className="mb-6 text-muted-foreground">
          No specimens in the current filter have images attached.
        </p>
        <Button onClick={onClose}>Back to Map</Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-10 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex w-56 flex-shrink-0 flex-col gap-3 border-r border-border bg-background p-4">
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3">
              {/* Species selector */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-primary">
                    {speciesList.length}
                  </Badge>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Species
                  </span>
                </div>
                <Select
                  value={selectedSpecies || ''}
                  onValueChange={(value) => {
                    setSelectedSpecies(value)
                    const subspeciesNames = Object.keys(
                      groupedBySpecies[value]?.subspecies || {}
                    )
                    setSelectedSubspecies(subspeciesNames[0] || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select species" />
                  </SelectTrigger>
                  <SelectContent>
                    {speciesList.map((sp) => (
                      <SelectItem key={sp.species} value={sp.species}>
                        <span className="italic">{sp.species}</span>
                        <span className="ml-2 text-muted-foreground">({sp.count})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subspecies selector */}
              {subspeciesList.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-primary">
                      {subspeciesList.length}
                    </Badge>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Subspecies
                    </span>
                  </div>
                  <Select
                    value={selectedSubspecies || ''}
                    onValueChange={setSelectedSubspecies}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subspecies" />
                    </SelectTrigger>
                    <SelectContent>
                      {subspeciesList.map((ssp) => (
                        <SelectItem key={ssp.name} value={ssp.name}>
                          <span className="italic">{ssp.name}</span>
                          <span className="ml-2 text-muted-foreground">({ssp.count})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Individual selector */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-primary">
                    {individualsList.length}
                  </Badge>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Individuals
                  </span>
                </div>
                <Select
                  value={currentSpecimen?.id || ''}
                  onValueChange={selectSpecimen}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Select individual" />
                  </SelectTrigger>
                  <SelectContent>
                    {individualsList.map((ind) => (
                      <SelectItem key={ind.id} value={ind.id} className="font-mono">
                        {ind.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Current specimen details */}
              {currentSpecimen && (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">ID</span>
                    <p className="font-mono text-primary">{currentSpecimen.id}</p>
                  </div>

                  {currentSpecimen.observation_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{currentSpecimen.observation_date}</span>
                    </div>
                  )}

                  {currentSpecimen.collection_location && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span>{currentSpecimen.collection_location}</span>
                    </div>
                  )}

                  {currentSpecimen.sequencing_status && (
                    <div className="flex items-center gap-2">
                      <Dna className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[currentSpecimen.sequencing_status] || '#6b7280',
                          }}
                        />
                        <span>{currentSpecimen.sequencing_status}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground">Source</span>
                    <p>{currentSpecimen.source}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full gap-2"
                    onClick={viewOnMap}
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </Button>
                </div>
              )}

              <Separator />

              {/* Summary */}
              <div className="rounded-md border border-primary/15 bg-primary/5 p-2.5">
                <div className="mb-2 text-xs uppercase tracking-wider text-primary">
                  Summary
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Species:</span>
                    <span className="font-semibold text-primary">{speciesList.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">With images:</span>
                    <span className="font-semibold text-primary">
                      {specimensWithImages.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total filtered:</span>
                    <span className="font-semibold text-primary">
                      {filteredRecords.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Image viewer */}
        <div className="relative flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {isLoading && !loadError && (
              <div className="absolute h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-primary" />
            )}

            {loadError && (
              <div className="flex flex-col items-center text-muted-foreground">
                <AlertCircle className="mb-3 h-14 w-14" />
                <p>Failed to load image</p>
              </div>
            )}

            {currentSpecimen?.image_url && (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                centerOnInit
                onTransformed={(_, state) => setZoomLevel(state.scale)}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <TransformComponent
                      wrapperClass="!w-full !h-full"
                      contentClass="!w-full !h-full flex items-center justify-center"
                    >
                      <img
                        src={getProxiedUrl(currentSpecimen.image_url)}
                        alt={currentSpecimen.scientific_name}
                        className={`max-h-full max-w-[90%] object-contain ${
                          isLoading ? 'invisible' : 'visible'
                        }`}
                        onLoad={() => {
                          setIsLoading(false)
                          setLoadError(false)
                        }}
                        onError={() => {
                          setIsLoading(false)
                          setLoadError(true)
                        }}
                        draggable={false}
                      />
                    </TransformComponent>

                    {/* Zoom controls */}
                    <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                        onClick={() => zoomOut()}
                        disabled={zoomLevel <= 0.5}
                      >
                        <ZoomOut className="h-5 w-5" />
                      </Button>
                      <span className="min-w-[50px] text-center text-sm tabular-nums text-muted-foreground">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                        onClick={() => zoomIn()}
                        disabled={zoomLevel >= 5}
                      >
                        <ZoomIn className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 bg-white/10 px-3 text-white hover:bg-white/20 disabled:opacity-30"
                        onClick={() => resetTransform()}
                        disabled={zoomLevel <= 1.05}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </>
                )}
              </TransformWrapper>
            )}
          </div>

          {/* Navigation buttons */}
          <button
            className="absolute left-0 top-1/2 z-5 flex h-20 w-12 -translate-y-1/2 items-center justify-center rounded-r-lg bg-black/40 text-white hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!hasPrev}
            onClick={goToPrev}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            className="absolute right-0 top-1/2 z-5 flex h-20 w-12 -translate-y-1/2 items-center justify-center rounded-l-lg bg-black/40 text-white hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!hasNext}
            onClick={goToNext}
          >
            <ChevronRight className="h-7 w-7" />
          </button>

          {/* Counter */}
          <div className="absolute bottom-5 right-5 z-5 rounded-md bg-black/60 px-3 py-1.5 text-sm tabular-nums text-muted-foreground">
            {currentIndex + 1} / {specimensWithImages.length}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {specimensWithImages.length > 1 && (
        <div className="flex h-28 overflow-x-auto border-t border-white/10 bg-black/70">
          <div className="flex gap-1 p-2">
            {specimensWithImages.map((specimen, idx) => (
              <button
                key={specimen.id}
                className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition-all hover:border-white/40 ${
                  currentIndex === idx
                    ? 'border-primary shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                    : 'border-transparent'
                }`}
                onClick={() => selectSpecimen(specimen.id)}
                title={specimen.id}
              >
                <img
                  src={getThumbnailUrl(specimen.image_url)}
                    alt={specimen.id}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
