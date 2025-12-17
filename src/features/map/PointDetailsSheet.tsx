import { useMemo, useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/ui/sheet'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useDataStore } from '@/features/data'
import { getProxiedUrl } from '@/shared/lib/imageProxy'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ExternalLink, Image as ImageIcon, MapPin, Calendar, Dna } from 'lucide-react'
import type { Record as DataRecord } from '@/features/data/types'

// Status colors matching Vue implementation
const STATUS_COLORS: { [key: string]: string } = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

interface PointDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pointIds: string[]
  coordinates?: { lat: number; lng: number }
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

// Group points by species and subspecies
function groupPointsBySpecies(points: DataRecord[]): GroupedBySpecies {
  const grouped: GroupedBySpecies = {}

  for (const point of points) {
    const species = point.scientific_name || 'Unknown'
    const subspecies = point.subspecies || 'No subspecies'

    if (!grouped[species]) {
      grouped[species] = { count: 0, subspecies: {} }
    }

    if (!grouped[species].subspecies[subspecies]) {
      grouped[species].subspecies[subspecies] = { count: 0, individuals: [] }
    }

    grouped[species].count++
    grouped[species].subspecies[subspecies].count++
    grouped[species].subspecies[subspecies].individuals.push(point)
  }

  return grouped
}

// Get species list sorted by those with photos first
function getSpeciesList(grouped: GroupedBySpecies) {
  return Object.entries(grouped)
    .map(([species, data]) => ({
      species,
      count: data.count,
      hasPhoto: Object.values(data.subspecies).some((ssp) =>
        ssp.individuals.some((i) => i.image_url)
      ),
    }))
    .sort((a, b) => {
      if (a.hasPhoto && !b.hasPhoto) return -1
      if (!a.hasPhoto && b.hasPhoto) return 1
      return b.count - a.count
    })
}

export function PointDetailsSheet({
  open,
  onOpenChange,
  pointIds,
  coordinates,
}: PointDetailsSheetProps) {
  const recordsById = useDataStore((s) => s.recordsById)
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)

  // Get records for the given IDs
  const points = useMemo(() => {
    return pointIds
      .map((id) => recordsById.get(id))
      .filter((r): r is DataRecord => r !== undefined)
  }, [pointIds, recordsById])

  // Group by species
  const groupedBySpecies = useMemo(() => groupPointsBySpecies(points), [points])
  const speciesList = useMemo(() => getSpeciesList(groupedBySpecies), [groupedBySpecies])

  // Selection state
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectedSubspecies, setSelectedSubspecies] = useState<string | null>(null)
  const [selectedIndividualIndex, setSelectedIndividualIndex] = useState(0)

  // Initialize selection when points change
  useEffect(() => {
    if (points.length === 0) return

    // Find first point with photo
    const pointWithPhoto = points.find((p) => p.image_url)
    const firstPoint = pointWithPhoto || points[0]

    const species = firstPoint.scientific_name || 'Unknown'
    setSelectedSpecies(species)

    if (groupedBySpecies[species]) {
      const subspeciesNames = Object.keys(groupedBySpecies[species].subspecies)
      // Prefer subspecies with photos
      const subspeciesWithPhoto = subspeciesNames.find((ssp) =>
        groupedBySpecies[species].subspecies[ssp].individuals.some((i) => i.image_url)
      )
      setSelectedSubspecies(subspeciesWithPhoto || subspeciesNames[0] || null)
    }

    setSelectedIndividualIndex(0)
  }, [points, groupedBySpecies])

  // Derived data
  const subspeciesList = useMemo(() => {
    if (!selectedSpecies || !groupedBySpecies[selectedSpecies]) return []
    return Object.entries(groupedBySpecies[selectedSpecies].subspecies)
      .map(([name, data]) => ({
        name,
        count: data.count,
        hasPhoto: data.individuals.some((i) => i.image_url),
      }))
      .sort((a, b) => {
        if (a.hasPhoto && !b.hasPhoto) return -1
        if (!a.hasPhoto && b.hasPhoto) return 1
        return b.count - a.count
      })
  }, [selectedSpecies, groupedBySpecies])

  const individualsList = useMemo(() => {
    if (!selectedSpecies || !groupedBySpecies[selectedSpecies]) return points

    const speciesGroup = groupedBySpecies[selectedSpecies]
    if (selectedSubspecies && speciesGroup.subspecies[selectedSubspecies]) {
      return speciesGroup.subspecies[selectedSubspecies].individuals
    }

    return Object.values(speciesGroup.subspecies).flatMap((s) => s.individuals)
  }, [selectedSpecies, selectedSubspecies, groupedBySpecies, points])

  const currentIndividual = useMemo(() => {
    if (individualsList.length === 0) return null
    return individualsList[Math.min(selectedIndividualIndex, individualsList.length - 1)]
  }, [individualsList, selectedIndividualIndex])

  // Sync selected point to store when current individual changes (for map highlight)
  useEffect(() => {
    if (currentIndividual && open) {
      setSelectedPoint(currentIndividual.id)
    }
  }, [currentIndividual, open, setSelectedPoint])

  // Statistics
  const totalSpecies = Object.keys(groupedBySpecies).length
  const totalIndividuals = points.length

  if (points.length === 0) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent className="w-[420px] sm:max-w-[420px]" modal={false}>
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Point Details
          </SheetTitle>
          <SheetDescription>
            {coordinates && (
              <span className="font-mono text-xs">
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="flex flex-col gap-4 py-4">
            {/* Summary badges */}
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1">
                <span className="font-bold text-primary">{totalSpecies}</span> species
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <span className="font-bold text-primary">{totalIndividuals}</span> individuals
              </Badge>
            </div>

            {/* Photo with panzoom */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
              {currentIndividual?.image_url ? (
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={5}
                  centerOnInit
                  wheel={{ step: 0.5 }}
                  doubleClick={{ step: 0.7 }}
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <img
                      src={getProxiedUrl(currentIndividual.image_url)}
                      alt={currentIndividual.id}
                      className="h-full w-full object-cover cursor-grab active:cursor-grabbing"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      draggable={false}
                    />
                  </TransformComponent>
                </TransformWrapper>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-50" />
                  <span className="text-xs">No photo available</span>
                </div>
              )}
            </div>

            {/* Species selector */}
            {speciesList.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Species ({totalSpecies})
                </label>
                <Select
                  value={selectedSpecies || ''}
                  onValueChange={(value) => {
                    setSelectedSpecies(value)
                    const subspeciesNames = Object.keys(
                      groupedBySpecies[value]?.subspecies || {}
                    )
                    setSelectedSubspecies(subspeciesNames[0] || null)
                    setSelectedIndividualIndex(0)
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
            )}

            {/* Subspecies selector */}
            {subspeciesList.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Subspecies ({subspeciesList.length})
                </label>
                <Select
                  value={selectedSubspecies || ''}
                  onValueChange={(value) => {
                    setSelectedSubspecies(value)
                    setSelectedIndividualIndex(0)
                  }}
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
            {individualsList.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Individual ({individualsList.length})
                </label>
                <Select
                  value={selectedIndividualIndex.toString()}
                  onValueChange={(value) => setSelectedIndividualIndex(parseInt(value))}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Select individual" />
                  </SelectTrigger>
                  <SelectContent>
                    {individualsList.map((ind, idx) => (
                      <SelectItem key={ind.id} value={idx.toString()} className="font-mono">
                        {ind.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Individual details */}
            {currentIndividual && (
              <>
                <Separator />

                <div className="space-y-3">
                  {/* Scientific name */}
                  <div>
                    <span className="text-xs text-muted-foreground">Scientific Name</span>
                    <p className="text-sm font-medium italic">
                      {currentIndividual.scientific_name}
                      {currentIndividual.subspecies && (
                        <span className="ml-1">{currentIndividual.subspecies}</span>
                      )}
                    </p>
                  </div>

                  {/* ID */}
                  <div>
                    <span className="text-xs text-muted-foreground">ID</span>
                    <p className="font-mono text-sm text-primary">{currentIndividual.id}</p>
                  </div>

                  {/* Date */}
                  {currentIndividual.observation_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{currentIndividual.observation_date}</span>
                    </div>
                  )}

                  {/* Location */}
                  {currentIndividual.collection_location && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <span className="text-sm">{currentIndividual.collection_location}</span>
                    </div>
                  )}

                  {/* Country */}
                  {currentIndividual.country && currentIndividual.country !== 'Unknown' && (
                    <div>
                      <span className="text-xs text-muted-foreground">Country</span>
                      <p className="text-sm">{currentIndividual.country}</p>
                    </div>
                  )}

                  {/* Mimicry Ring */}
                  {currentIndividual.mimicry_ring &&
                    currentIndividual.mimicry_ring !== 'Unknown' && (
                      <div>
                        <span className="text-xs text-muted-foreground">Mimicry Ring</span>
                        <p className="text-sm">{currentIndividual.mimicry_ring}</p>
                      </div>
                    )}

                  {/* Sequencing Status */}
                  {currentIndividual.sequencing_status && (
                    <div className="flex items-center gap-2">
                      <Dna className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[currentIndividual.sequencing_status] || '#6b7280',
                          }}
                        />
                        <span className="text-sm">{currentIndividual.sequencing_status}</span>
                      </div>
                    </div>
                  )}

                  {/* Source */}
                  <div>
                    <span className="text-xs text-muted-foreground">Source</span>
                    <p className="text-sm">{currentIndividual.source}</p>
                  </div>
                </div>

                {/* External link button */}
                {currentIndividual.source === 'GBIF' && (
                  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                    <a
                      href={`https://www.gbif.org/occurrence/search?occurrenceId=${currentIndividual.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on GBIF
                    </a>
                  </Button>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
