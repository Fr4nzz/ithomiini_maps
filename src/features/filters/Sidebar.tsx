import { ChevronDown, RotateCcw, Map, Table2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
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

export function Sidebar() {
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const resetFilters = useDataStore((s) => s.resetFilters)
  const ui = useDataStore((s) => s.ui)
  const setView = useDataStore((s) => s.setView)
  const toggleAdvancedFilters = useDataStore((s) => s.toggleAdvancedFilters)

  const filteredCount = useFilteredCount()
  const totalCount = useTotalCount()
  const genera = useUniqueGenera()
  const species = useUniqueSpecies()
  const subspecies = useUniqueSubspecies()
  const sources = useUniqueSources()
  const countries = useUniqueCountries()

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
            {/* View Toggle */}
            <div className="flex gap-2">
              <Button
                variant={ui.view === 'map' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setView('map')}
              >
                <Map className="mr-1 h-4 w-4" />
                Map
              </Button>
              <Button
                variant={ui.view === 'table' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setView('table')}
              >
                <Table2 className="mr-1 h-4 w-4" />
                Table
              </Button>
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
                  {/* Genus */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Genus</Label>
                    <Select
                      value={filters.genus || 'all'}
                      onValueChange={(value) =>
                        setFilters({ genus: value === 'all' ? null : value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All genera" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All genera</SelectItem>
                        {genera.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Species */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Species</Label>
                    <Select
                      value={filters.species[0] || 'all'}
                      onValueChange={(value) =>
                        setFilters({ species: value === 'all' ? [] : [value] })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All species" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All species</SelectItem>
                        {species.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

            {/* Advanced Filters Toggle */}
            <Collapsible
              open={ui.showAdvancedFilters}
              onOpenChange={toggleAdvancedFilters}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground">
                Advanced Filters
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Stack gap="sm" className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    Additional filters like Family, Tribe, and date range will appear here.
                  </p>
                </Stack>
              </CollapsibleContent>
            </Collapsible>
          </Stack>
        </CardContent>
      </ScrollArea>
    </Card>
  )
}
