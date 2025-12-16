import { useState, useRef } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Checkbox } from '@/shared/ui/checkbox'
import { useFilteredRecords } from '@/features/data'
import { getThumbnailUrl } from '@/shared/lib/imageProxy'
import { ChevronUp, LayoutGrid, Search } from 'lucide-react'
import type { Record as DataRecord } from '@/features/data/types'

// Status colors
const STATUS_COLORS: { [key: string]: string } = {
  Sequenced: 'bg-blue-500',
  'Tissue Available': 'bg-emerald-500',
  'Preserved Specimen': 'bg-amber-500',
  Published: 'bg-purple-500',
}

// Row height for virtualization
const ROW_HEIGHT = 60

// Column definitions
const columnDefs: ColumnDef<DataRecord>[] = [
  {
    id: 'photo',
    header: 'Photo',
    size: 70,
    enableSorting: false,
    cell: ({ row }) => {
      const imageUrl = row.original.image_url
      if (!imageUrl) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <div className="relative h-[50px] w-[50px] overflow-hidden rounded-md bg-muted">
          <img
            src={getThumbnailUrl(imageUrl)}
            alt={row.original.id}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    },
  },
  {
    accessorKey: 'id',
    header: 'ID',
    size: 120,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'scientific_name',
    header: 'Species',
    size: 200,
    cell: ({ getValue }) => <em className="text-foreground">{getValue<string>()}</em>,
  },
  {
    accessorKey: 'subspecies',
    header: 'Subspecies',
    size: 130,
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? <span className="italic text-secondary-foreground">{val}</span> : '—'
    },
  },
  {
    accessorKey: 'mimicry_ring',
    header: 'Mimicry Ring',
    size: 120,
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      if (!val || val === 'Unknown') return '—'
      return (
        <Badge variant="secondary" className="bg-purple-500/15 text-purple-400">
          {val}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'sequencing_status',
    header: 'Status',
    size: 130,
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      if (!val) return '—'
      return (
        <span className="inline-flex items-center gap-1.5 rounded bg-white/5 px-2 py-0.5 text-xs">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[val] || 'bg-gray-500'}`} />
          {val}
        </span>
      )
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
    size: 130,
  },
  {
    accessorKey: 'observation_date',
    header: 'Date',
    size: 100,
    cell: ({ getValue }) => getValue<string | null>() || '—',
  },
  {
    accessorKey: 'country',
    header: 'Country',
    size: 100,
    cell: ({ getValue }) => getValue<string | null>() || '—',
  },
  {
    accessorKey: 'lat',
    header: 'Latitude',
    size: 90,
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return val ? (
        <span className="font-mono text-xs text-muted-foreground">{val.toFixed(4)}</span>
      ) : (
        '—'
      )
    },
  },
  {
    accessorKey: 'lng',
    header: 'Longitude',
    size: 90,
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return val ? (
        <span className="font-mono text-xs text-muted-foreground">{val.toFixed(4)}</span>
      ) : (
        '—'
      )
    },
  },
]

export function TableView() {
  const records = useFilteredRecords()
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    photo: true,
    id: true,
    scientific_name: true,
    subspecies: true,
    mimicry_ring: true,
    sequencing_status: true,
    source: true,
    observation_date: true,
    country: true,
    lat: false,
    lng: false,
  })

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'scientific_name', desc: false },
  ])

  // Show column settings popup
  const [showColumnSettings, setShowColumnSettings] = useState(false)

  // Table instance (no pagination)
  const table = useReactTable({
    data: records,
    columns: columnDefs,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtual row renderer with Firefox fix
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    // Firefox fix for measureElement
    measureElement:
      navigator.userAgent.indexOf('Firefox') === -1
        ? (el) => el?.getBoundingClientRect().height
        : undefined,
    overscan: 10,
  })

  const totalRows = records.length

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary-foreground">
            <strong className="text-primary">{totalRows.toLocaleString()}</strong> records
          </span>
        </div>
        <div className="relative flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className={showColumnSettings ? 'bg-accent' : ''}
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
            Columns
          </Button>

          {/* Column settings popup */}
          {showColumnSettings && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border border-border bg-popover p-2 shadow-xl">
              {columnDefs.map((col) => {
                const key = col.id || (col as { accessorKey?: string }).accessorKey || ''
                const label = typeof col.header === 'string' ? col.header : key
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary-foreground hover:bg-accent"
                  >
                    <Checkbox
                      checked={columnVisibility[key as keyof typeof columnVisibility] ?? true}
                      onCheckedChange={(checked) => {
                        setColumnVisibility((prev) => ({
                          ...prev,
                          [key]: !!checked,
                        }))
                      }}
                    />
                    {label}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Virtualized Table */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={`whitespace-nowrap border-b-2 border-border px-3 py-2.5 text-left font-semibold text-secondary-foreground ${
                      header.column.getCanSort()
                        ? 'cursor-pointer hover:text-foreground'
                        : ''
                    } ${header.column.getIsSorted() ? 'text-primary' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <ChevronUp
                          className={`h-3.5 w-3.5 transition-transform ${
                            header.column.getIsSorted() === 'desc' ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length > 0 ? (
              <>
                {/* Spacer for virtualization */}
                <tr>
                  <td
                    colSpan={table.getVisibleFlatColumns().length}
                    style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }}
                  />
                </tr>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={(node) => rowVirtualizer.measureElement(node)}
                      className="border-b border-border hover:bg-primary/5"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {/* Bottom spacer */}
                <tr>
                  <td
                    colSpan={table.getVisibleFlatColumns().length}
                    style={{
                      height: `${
                        rowVirtualizer.getTotalSize() -
                        (rowVirtualizer.getVirtualItems()[
                          rowVirtualizer.getVirtualItems().length - 1
                        ]?.end ?? 0)
                      }px`,
                    }}
                  />
                </tr>
              </>
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Search className="h-12 w-12 opacity-50" />
                    <p>No records match your filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
