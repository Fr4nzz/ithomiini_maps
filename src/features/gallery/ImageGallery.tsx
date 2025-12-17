import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  ChevronDown,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  Calendar,
  Dna,
  Image as ImageIcon,
  AlertCircle,
  Plus,
} from 'lucide-react'
import type { Record as DataRecord } from '@/features/data/types'

// Status colors matching the rest of the app
const STATUS_COLORS: { [key: string]: string } = {
  Sequenced: '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  Published: '#a855f7',
}

// Generate consistent colors for species
function generateSpeciesColor(species: string): { main: string; bg: string } {
  let hash = 0
  for (let i = 0; i < species.length; i++) {
    hash = species.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return {
    main: `hsl(${hue}, 70%, 55%)`,
    bg: `hsla(${hue}, 70%, 20%, 0.3)`,
  }
}

interface ImageGalleryProps {
  open: boolean
  onClose: () => void
  initialSpecimenId?: string
}

interface GroupedBySpecies {
  [species: string]: {
    count: number
    color: { main: string; bg: string }
    subspecies: {
      [subspecies: string]: {
        count: number
        individuals: DataRecord[]
      }
    }
  }
}

interface SpeciesGroup {
  name: string
  count: number
  color: { main: string; bg: string }
  subspecies: SubspeciesGroup[]
}

interface SubspeciesGroup {
  name: string
  count: number
  individuals: DataRecord[]
  parentSpecies: string
}

function groupBySpecies(records: DataRecord[]): GroupedBySpecies {
  const grouped: GroupedBySpecies = {}

  for (const record of records) {
    if (!record.image_url) continue

    const species = record.scientific_name || 'Unknown'
    const subspecies = record.subspecies || 'No subspecies'

    if (!grouped[species]) {
      grouped[species] = {
        count: 0,
        color: generateSpeciesColor(species),
        subspecies: {},
      }
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

function createGroupedThumbnails(groupedBySpecies: GroupedBySpecies): SpeciesGroup[] {
  return Object.entries(groupedBySpecies)
    .map(([speciesName, speciesData]) => ({
      name: speciesName,
      count: speciesData.count,
      color: speciesData.color,
      subspecies: Object.entries(speciesData.subspecies).map(([subspName, subspData]) => ({
        name: subspName,
        count: subspData.count,
        individuals: subspData.individuals,
        parentSpecies: speciesName,
      })),
    }))
    .sort((a, b) => b.count - a.count)
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

  // Grouped thumbnails for strip
  const groupedThumbnails = useMemo(
    () => createGroupedThumbnails(groupedBySpecies),
    [groupedBySpecies]
  )

  // Species list sorted by count
  const speciesList = useMemo(
    () =>
      Object.entries(groupedBySpecies)
        .map(([species, data]) => ({ species, count: data.count }))
        .sort((a, b) => b.count - a.count),
    [groupedBySpecies]
  )

  // Refs
  const thumbnailStripRef = useRef<HTMLDivElement>(null)

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectedSubspecies, setSelectedSubspecies] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Collapsed species (starts collapsed)
  const [collapsedSpecies, setCollapsedSpecies] = useState<Set<string>>(() => new Set())

  // Initialize collapsed state when data changes
  useEffect(() => {
    if (open && groupedThumbnails.length > 0) {
      // Collapse all species initially
      setCollapsedSpecies(new Set(groupedThumbnails.map((g) => g.name)))
    }
  }, [open, groupedThumbnails.length])

  // Initialize from initial specimen
  useEffect(() => {
    if (!open || !initialSpecimenId || specimensWithImages.length === 0) return

    const idx = specimensWithImages.findIndex((s) => s.id === initialSpecimenId)
    if (idx >= 0) {
      setCurrentIndex(idx)
      const specimen = specimensWithImages[idx]
      setSelectedSpecies(specimen.scientific_name)
      setSelectedSubspecies(specimen.subspecies)
      // Expand the specimen's species
      setCollapsedSpecies((prev) => {
        const next = new Set(prev)
        next.delete(specimen.scientific_name)
        return next
      })
    }
  }, [open, initialSpecimenId, specimensWithImages])

  // Current specimen
  const currentSpecimen = specimensWithImages[currentIndex] || null

  // Auto-expand current species when navigating
  useEffect(() => {
    if (currentSpecimen) {
      const species = currentSpecimen.scientific_name
      if (species && collapsedSpecies.has(species)) {
        setCollapsedSpecies((prev) => {
          const next = new Set(prev)
          next.delete(species)
          return next
        })
      }
      // Update selection to match current
      setSelectedSpecies(species)
      setSelectedSubspecies(currentSpecimen.subspecies)
    }
  }, [currentSpecimen])

  // Toggle species collapse
  const toggleSpeciesCollapse = useCallback((speciesName: string) => {
    setCollapsedSpecies((prev) => {
      const next = new Set(prev)
      if (next.has(speciesName)) {
        next.delete(speciesName)
      } else {
        next.add(speciesName)
      }
      return next
    })
  }, [])

  // Select specimen by ID
  const selectSpecimen = useCallback(
    (id: string, autoExpand = true) => {
      const idx = specimensWithImages.findIndex((s) => s.id === id)
      if (idx >= 0) {
        setCurrentIndex(idx)
        setIsLoading(true)
        setLoadError(false)
        if (autoExpand) {
          const specimen = specimensWithImages[idx]
          setCollapsedSpecies((prev) => {
            const next = new Set(prev)
            next.delete(specimen.scientific_name)
            return next
          })
        }
      }
    },
    [specimensWithImages]
  )

  // Subspecies list for selected species
  const subspeciesList = useMemo(() => {
    if (!selectedSpecies || !groupedBySpecies[selectedSpecies]) return []
    return Object.entries(groupedBySpecies[selectedSpecies].subspecies)
      .map(([name, data]) => ({ name, count: data.count }))
      .sort((a, b) => b.count - a.count)
  }, [selectedSpecies, groupedBySpecies])

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
          if (zoomLevel > 1.05) {
            // Would need ref to resetTransform - skip for now
          } else {
            onClose()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, goToPrev, goToNext, onClose, zoomLevel])

  // View on map
  const viewOnMap = useCallback(() => {
    if (currentSpecimen) {
      setSelectedPoint(currentSpecimen.id)
      onClose()
    }
  }, [currentSpecimen, setSelectedPoint, onClose])

  // Scroll thumbnail strip functions
  const scrollThumbnails = useCallback((direction: -1 | 1) => {
    if (thumbnailStripRef.current) {
      thumbnailStripRef.current.scrollBy({
        left: direction * 300,
        behavior: 'smooth',
      })
    }
  }, [])

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
                    // Select first individual of new species
                    const firstIndividual =
                      groupedBySpecies[value]?.subspecies[subspeciesNames[0]]?.individuals[0]
                    if (firstIndividual) {
                      selectSpecimen(firstIndividual.id)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All species" />
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
                    onValueChange={(value) => {
                      setSelectedSubspecies(value)
                      // Select first individual of new subspecies
                      const firstIndividual =
                        groupedBySpecies[selectedSpecies!]?.subspecies[value]?.individuals[0]
                      if (firstIndividual) {
                        selectSpecimen(firstIndividual.id)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All subspecies" />
                    </SelectTrigger>
                    <SelectContent>
                      {subspeciesList.map((ssp) => (
                        <SelectItem key={ssp.name} value={ssp.name}>
                          {ssp.name}
                          <span className="ml-2 text-muted-foreground">({ssp.count})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* Current specimen details */}
              {currentSpecimen && (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">ID</span>
                    <p className="font-mono">{currentSpecimen.id}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Species</span>
                    <p className="italic">{currentSpecimen.scientific_name}</p>
                  </div>

                  {currentSpecimen.subspecies && (
                    <div>
                      <span className="text-muted-foreground">Subspecies</span>
                      <p className="italic">{currentSpecimen.subspecies}</p>
                    </div>
                  )}

                  {currentSpecimen.observation_date && (
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
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
                wheel={{ step: 0.5 }}
                doubleClick={{ step: 0.7 }}
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
                        size="icon"
                        className="h-9 w-9 bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                        onClick={() => resetTransform()}
                        disabled={zoomLevel <= 1.05}
                      >
                        <RotateCcw className="h-5 w-5" />
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

      {/* Grouped Thumbnail strip */}
      {specimensWithImages.length > 1 && (
        <div className="flex h-[130px] border-t border-white/10 bg-black/70">
          {/* Scroll left button */}
          <button
            className="flex w-9 flex-shrink-0 items-center justify-center border-r border-white/10 bg-black/50 text-muted-foreground hover:bg-black/80 hover:text-white"
            onClick={() => scrollThumbnails(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Thumbnail strip */}
          <div
            ref={thumbnailStripRef}
            className="flex flex-1 items-stretch gap-0.5 overflow-x-auto overflow-y-hidden scroll-smooth"
          >
            {groupedThumbnails.map((speciesGroup) => (
              <div
                key={speciesGroup.name}
                className="flex flex-shrink-0 flex-col"
                style={{
                  background: speciesGroup.color.bg,
                  borderLeft: `3px solid ${speciesGroup.color.main}`,
                  minWidth: '80px',
                }}
              >
                {/* Species header */}
                <button
                  onClick={() => toggleSpeciesCollapse(speciesGroup.name)}
                  title={speciesGroup.name}
                  className="flex items-center gap-1 whitespace-nowrap border-b border-white/10 bg-black/30 px-2 py-1 text-xs font-semibold italic transition-colors hover:bg-black/50"
                  style={{ color: speciesGroup.color.main }}
                >
                  <ChevronDown
                    className={`h-3 w-3 flex-shrink-0 transition-transform ${
                      collapsedSpecies.has(speciesGroup.name) ? '-rotate-90' : ''
                    }`}
                  />
                  <span className="max-w-[120px] truncate">{speciesGroup.name}</span>
                  <span
                    className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold not-italic"
                    style={{ background: speciesGroup.color.main, color: '#000' }}
                  >
                    {speciesGroup.count}
                  </span>
                </button>

                {/* Collapsed preview */}
                {collapsedSpecies.has(speciesGroup.name) ? (
                  <div
                    className="flex cursor-pointer items-center justify-center p-2 hover:bg-white/5"
                    onClick={() => toggleSpeciesCollapse(speciesGroup.name)}
                  >
                    <button
                      className={`relative h-[90px] w-[90px] overflow-hidden rounded border-2 bg-[#333] transition-all hover:border-white/40 ${
                        speciesGroup.subspecies.some((s) =>
                          s.individuals.some((i) => i.id === currentSpecimen?.id)
                        )
                          ? 'border-primary shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                          : 'border-transparent'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const firstIndividual = speciesGroup.subspecies[0]?.individuals[0]
                        if (firstIndividual) {
                          selectSpecimen(firstIndividual.id, false)
                        }
                      }}
                    >
                      {speciesGroup.subspecies[0]?.individuals[0]?.image_url && (
                        <img
                          src={getThumbnailUrl(
                            speciesGroup.subspecies[0].individuals[0].image_url
                          )}
                          loading="lazy"
                          className="h-full w-full object-contain bg-[#222]"
                          alt=""
                        />
                      )}
                      <span
                        className="absolute bottom-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-black/85 text-sm font-bold text-white transition-all hover:scale-110 hover:bg-primary hover:text-black"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSpeciesCollapse(speciesGroup.name)
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Expanded thumbnails */
                  <div className="flex items-stretch gap-1 overflow-x-visible overflow-y-hidden p-1">
                    {speciesGroup.subspecies.flatMap((subsp) =>
                      subsp.individuals.map((specimen) => (
                        <button
                          key={specimen.id}
                          className={`h-20 w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded border-2 bg-[#333] transition-all hover:scale-105 hover:border-white/40 ${
                            currentSpecimen?.id === specimen.id
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
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scroll right button */}
          <button
            className="flex w-9 flex-shrink-0 items-center justify-center border-l border-white/10 bg-black/50 text-muted-foreground hover:bg-black/80 hover:text-white"
            onClick={() => scrollThumbnails(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
