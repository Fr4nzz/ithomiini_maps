import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Badge } from '@/shared/ui/badge'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useDataStore, useUniqueMimicryRings } from '@/features/data'
import { cn } from '@/shared/lib/utils'
import MimicryIcon from '@/assets/Mimicry_bttn.svg'

interface MimicrySelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MimicrySelectorDialog({ open, onOpenChange }: MimicrySelectorDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownInputRef = useRef<HTMLInputElement>(null)

  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const records = useDataStore((s) => s.records)
  const allRings = useUniqueMimicryRings()

  // Get all mimicry rings with counts
  const ringCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const ring = r.mimicry_ring || 'Unknown'
      counts[ring] = (counts[ring] || 0) + 1
    })
    return counts
  }, [records])

  // Filtered rings based on search
  const filteredRings = useMemo(() => {
    if (!searchQuery) return allRings
    const query = searchQuery.toLowerCase()
    return allRings.filter((ring) => ring.toLowerCase().includes(query))
  }, [allRings, searchQuery])

  const selectedRings = filters.mimicryRings

  const toggleRing = (ring: string) => {
    const newRings = selectedRings.includes(ring)
      ? selectedRings.filter((r) => r !== ring)
      : [...selectedRings, ring]
    setFilters({ mimicryRings: newRings })
  }

  const removeRing = (ring: string) => {
    setFilters({ mimicryRings: selectedRings.filter((r) => r !== ring) })
  }

  const clearSelection = () => {
    setFilters({ mimicryRings: [] })
  }

  const selectAll = () => {
    setFilters({ mimicryRings: [...allRings] })
  }

  // Focus input when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      setTimeout(() => dropdownInputRef.current?.focus(), 0)
    }
  }, [showDropdown])

  // Close dropdown when dialog closes
  useEffect(() => {
    if (!open) {
      setShowDropdown(false)
      setSearchQuery('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[700px] flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <img src={MimicryIcon} alt="Mimicry" className="h-7 w-7" />
            Mimicry Rings
          </DialogTitle>
        </DialogHeader>

        {/* Selected rings badges */}
        {selectedRings.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-lg bg-muted p-3">
            {selectedRings.map((ring) => (
              <Badge
                key={ring}
                variant="secondary"
                className="gap-1.5 pr-1"
              >
                {ring}
                <button
                  onClick={() => removeRing(ring)}
                  className="ml-1 rounded-full p-0.5 hover:bg-background/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={clearSelection}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Search dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border bg-muted px-3.5 py-2.5 text-sm transition-colors',
              showDropdown && 'border-primary'
            )}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left text-muted-foreground">
              {selectedRings.length === 0
                ? 'Select mimicry rings...'
                : `${selectedRings.length} ring${selectedRings.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showDropdown && 'rotate-180')}
            />
          </button>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-lg">
              {/* Search input */}
              <div className="border-b p-2">
                <Input
                  ref={dropdownInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mimicry rings..."
                  className="h-8"
                />
              </div>

              {/* Ring list */}
              <ScrollArea className="max-h-[300px]">
                <div className="p-2">
                  {filteredRings.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No mimicry rings found
                    </p>
                  ) : (
                    filteredRings.map((ring) => {
                      const isSelected = selectedRings.includes(ring)
                      const count = ringCounts[ring] || 0

                      return (
                        <button
                          key={ring}
                          onClick={() => toggleRing(ring)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="flex-1 text-left">{ring}</span>
                          <span className="text-xs text-muted-foreground">
                            {count.toLocaleString()}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Quick actions */}
              <div className="flex gap-2 border-t p-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={selectAll}>
                  Select All ({allRings.length})
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {allRings.length} mimicry rings available
          </span>
          {selectedRings.length > 0 && (
            <span className="font-medium text-primary">
              {selectedRings.reduce((sum, ring) => sum + (ringCounts[ring] || 0), 0).toLocaleString()}{' '}
              records selected
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onOpenChange(false)}>Apply Filter</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
