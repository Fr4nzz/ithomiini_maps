import { useState, useMemo } from 'react'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import { useDataStore, useFilteredRecords } from '@/features/data'

// Helper to get date offset from today
function getDateOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

const QUICK_RANGES = [
  { label: 'All Time', start: '', end: '' },
  { label: 'Last Year', start: getDateOffset(-365), end: '' },
  { label: 'Last 5 Years', start: getDateOffset(-365 * 5), end: '' },
  { label: 'Last 10 Years', start: getDateOffset(-365 * 10), end: '' },
  { label: '2020s', start: '2020-01-01', end: '2029-12-31' },
  { label: '2010s', start: '2010-01-01', end: '2019-12-31' },
  { label: '2000s', start: '2000-01-01', end: '2009-12-31' },
  { label: 'Pre-2000', start: '', end: '1999-12-31' },
]

// Hook to get date statistics
function useDateStats() {
  const records = useFilteredRecords()

  return useMemo(() => {
    let withDates = 0
    let withoutDates = 0
    let earliest: string | null = null
    let latest: string | null = null

    for (const record of records) {
      if (record.observation_date) {
        withDates++
        if (!earliest || record.observation_date < earliest) {
          earliest = record.observation_date
        }
        if (!latest || record.observation_date > latest) {
          latest = record.observation_date
        }
      } else {
        withoutDates++
      }
    }

    return { withDates, withoutDates, earliest, latest }
  }, [records])
}

export function DateFilter() {
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const dateStats = useDateStats()

  const [startDate, setStartDate] = useState(filters.dateStart || '')
  const [endDate, setEndDate] = useState(filters.dateEnd || '')

  const applyFilter = () => {
    setFilters({
      dateStart: startDate || null,
      dateEnd: endDate || null,
    })
  }

  const clearFilter = () => {
    setStartDate('')
    setEndDate('')
    setFilters({ dateStart: null, dateEnd: null })
  }

  const applyQuickRange = (range: (typeof QUICK_RANGES)[0]) => {
    setStartDate(range.start)
    setEndDate(range.end)
    setFilters({
      dateStart: range.start || null,
      dateEnd: range.end || null,
    })
  }

  const isActive = !!filters.dateStart || !!filters.dateEnd

  return (
    <div className="rounded-lg bg-muted p-3.5">
      {/* Header with stats */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-primary" />
          Date Filter
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-primary">{dateStats.withDates.toLocaleString()} with dates</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            {dateStats.withoutDates.toLocaleString()} without
          </span>
        </div>
      </div>

      {/* Date range info */}
      {dateStats.earliest && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-background px-2.5 py-2 text-xs text-muted-foreground">
          Range: {dateStats.earliest} to {dateStats.latest}
        </div>
      )}

      {/* Quick range buttons */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_RANGES.map((range) => (
          <Badge
            key={range.label}
            variant={
              filters.dateStart === (range.start || null) &&
              filters.dateEnd === (range.end || null)
                ? 'default'
                : 'outline'
            }
            className="cursor-pointer text-xs"
            onClick={() => applyQuickRange(range)}
          >
            {range.label}
          </Badge>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <Label className="mb-1 block text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={applyFilter}>
          Apply
        </Button>
        {isActive && (
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={clearFilter}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
