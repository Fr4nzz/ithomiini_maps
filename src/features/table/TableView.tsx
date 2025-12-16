import { useState, useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useFilteredRecords } from '@/features/data'
import { getThumbnailUrl } from '@/shared/lib/imageProxy'
import {
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Search,
} from 'lucide-react'
import type { Record as DataRecord } from '@/features/data/types'

// Status colors
const STATUS_COLORS: { [key: string]: string } = {
  Sequenced: 'bg-blue-500',
  'Tissue Available': 'bg-emerald-500',
  'Preserved Specimen': 'bg-amber-500',
  Published: 'bg-purple-500',
}

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
          <span
            className={`h-2 w-2 rounded-full ${STATUS_COLORS[val] || 'bg-gray-500'}`}
          />
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

  // Table instance
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  // Pagination info
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageCount = table.getPageCount()
  const totalRows = records.length

  // Visible pages for pagination
  const visiblePages = useMemo(() => {
    const pages: (number | '...')[] = []
    const current = pageIndex + 1

    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')
      for (let i = Math.max(2, current - 1); i <= Math.min(pageCount - 1, current + 1); i++) {
        pages.push(i)
      }
      if (current < pageCount - 2) pages.push('...')
      pages.push(pageCount)
    }

    return pages
  }, [pageIndex, pageCount])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary-foreground">
            <strong className="text-primary">{totalRows.toLocaleString()}</strong> records
          </span>
          <span className="text-xs text-muted-foreground">
            Page {pageIndex + 1} of {pageCount}
          </span>
        </div>
        <div className="relative flex items-center gap-3">
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => table.setPageSize(parseInt(value))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="200">200 rows</SelectItem>
            </SelectContent>
          </Select>

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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={`sticky top-0 z-10 whitespace-nowrap border-b-2 border-border bg-background px-3 py-2.5 text-left font-semibold text-secondary-foreground ${
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
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-primary/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
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

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1 border-t border-border bg-background px-4 py-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.setPageIndex(0)}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {visiblePages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant="outline"
                size="sm"
                className={`h-8 min-w-[32px] ${
                  page === pageIndex + 1
                    ? 'border-primary bg-primary text-primary-foreground'
                    : ''
                }`}
                onClick={() => table.setPageIndex(page - 1)}
              >
                {page}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(pageCount - 1)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
