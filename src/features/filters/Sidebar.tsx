import { useState, useEffect } from 'react'
import { ChevronDown, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Input } from '@/shared/ui/input'
import { Combobox } from '@/shared/ui/combobox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import { Stack } from '@/shared/layout'
import { useDebounce } from '@/shared/hooks'
import {
  useDataStore,
  useFilteredCount,
  useTotalCount,
  useUniqueSpecies,
  useUniqueSubspecies,
  useUniqueGenera,
  useUniqueSources,
  useUniqueCountries,
} from '@/features/data'
import { DateFilter } from './DateFilter'
import { MapSettingsSection } from './MapSettingsSection'
import { GbifCitationSection } from './GbifCitationSection'
import { MimicrySelectorDialog } from './MimicrySelectorDialog'
import MimicryIcon from '@/assets/Mimicry_bttn.svg'

export function Sidebar() {
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const resetFilters = useDataStore((s) => s.resetFilters)
  const ui = useDataStore((s) => s.ui)
  const toggleAdvancedFilters = useDataStore((s) => s.toggleAdvancedFilters)

  const filteredCount = useFilteredCount()
  const totalCount = useTotalCount()
  const genera = useUniqueGenera()
  const species = useUniqueSpecies()
  const subspecies = useUniqueSubspecies()
  const sources = useUniqueSources()
  const countries = useUniqueCountries()

  // Collapsible section states
  const [showMapSettings, setShowMapSettings] = useState(false)
  const [showCitation, setShowCitation] = useState(false)
  const [showMimicryDialog, setShowMimicryDialog] = useState(false)

  // CAMID search with debounce (300ms)
  const [camidInput, setCamidInput] = useState(filters.camidSearch)
  const debouncedCamid = useDebounce(camidInput, 300)

  // Sync debounced value to store
  useEffect(() => {
    if (debouncedCamid !== filters.camidSearch) {
      setFilters({ camidSearch: debouncedCamid })
    }
  }, [debouncedCamid, filters.camidSearch, setFilters])

  // Reset local state when filters are reset
  useEffect(() => {
    if (filters.camidSearch === '' && camidInput !== '') {
      setCamidInput('')
    }
  }, [filters.camidSearch, camidInput])

  return (
    <Card className="flex h-full w-80 flex-col rounded-none border-r border-l-0 border-t-0 border-b-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">
            {filteredCount.toLocaleString()} / {totalCount.toLocaleString()}
          </Badge>
          <span>records</span>
        </div>
      </CardHeader>

      <Separator />

      <ScrollArea className="flex-1">
        <CardContent className="p-4">
          <Stack gap="md">
            {/* CAMID Search */}
            <div>
              <Label className="text-xs text-muted-foreground">CAMID Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by CAMID..."
                  value={camidInput}
                  onChange={(e) => setCamidInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Separator />

            {/* Source Filter */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Data Source
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Stack gap="sm" className="pt-2">
                  {sources.map((source) => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`source-${source}`}
                        checked={filters.sources.includes(source)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters({ sources: [...filters.sources, source] })
                          } else {
                            setFilters({
                              sources: filters.sources.filter((s) => s !== source),
                            })
                          }
                        }}
                      />
                      <Label
                        htmlFor={`source-${source}`}
                        className="text-sm font-normal"
                      >
                        {source}
                      </Label>
                    </div>
                  ))}
                </Stack>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Taxonomy - Genus */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Taxonomy
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Stack gap="sm" className="pt-2">
                  {/* Genus - with fuzzy search */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Genus</Label>
                    <div className="mt-1">
                      <Combobox
                        value={filters.genus || ''}
                        onChange={(value) =>
                          // Clear species and subspecies when genus changes
                          setFilters({
                            genus: value || null,
                            species: [],
                            subspecies: [],
                          })
                        }
                        options={genera}
                        placeholder="All genera"
                        emptyText="No genera found"
                      />
                    </div>
                  </div>

                  {/* Species - with fuzzy search */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Species</Label>
                    <div className="mt-1">
                      <Combobox
                        value={filters.species[0] || ''}
                        onChange={(value) =>
                          // Clear subspecies when species changes
                          setFilters({
                            species: value ? [value] : [],
                            subspecies: [],
                          })
                        }
                        options={species}
                        placeholder="All species"
                        emptyText="No species found"
                      />
                    </div>
                  </div>

                  {/* Subspecies */}
                  {subspecies.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Subspecies
                      </Label>
                      <Select
                        value={filters.subspecies[0] || 'all'}
                        onValueChange={(value) =>
                          setFilters({ subspecies: value === 'all' ? [] : [value] })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="All subspecies" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All subspecies</SelectItem>
                          {subspecies.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Stack>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Country Filter */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Country
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-2">
                  <Select
                    value={filters.country || 'all'}
                    onValueChange={(value) =>
                      setFilters({ country: value === 'all' ? null : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Mimicry Ring Filter */}
            <div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShowMimicryDialog(true)}
              >
                <img src={MimicryIcon} alt="Mimicry" className="h-5 w-5" />
                <span>Mimicry Rings</span>
                {filters.mimicryRings.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {filters.mimicryRings.length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Date Filter */}
            <DateFilter />

            <Separator />

            {/* Map & Legend Settings */}
            <MapSettingsSection open={showMapSettings} onOpenChange={setShowMapSettings} />
          </Stack>
        </CardContent>
      </ScrollArea>

      {/* GBIF Citation (at bottom) */}
      <GbifCitationSection open={showCitation} onOpenChange={setShowCitation} />

      {/* Mimicry Selector Dialog */}
      <MimicrySelectorDialog open={showMimicryDialog} onOpenChange={setShowMimicryDialog} />
    </Card>
  )
}
