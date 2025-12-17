import { useDataStore, useActiveColorMap, useLegendTitle } from '@/features/data'
import { cn } from '@/shared/lib/utils'

export function Legend() {
  const colorBy = useDataStore((s) => s.colorBy)
  const legendSettings = useDataStore((s) => s.legendSettings)
  const activeColorMap = useActiveColorMap()
  const legendTitle = useLegendTitle()

  if (!legendSettings.showLegend) return null

  const entries = Object.entries(activeColorMap).slice(0, legendSettings.maxItems)
  const hasMore = Object.keys(activeColorMap).length > legendSettings.maxItems

  const positionClasses: Record<typeof legendSettings.position, string> = {
    'top-left': 'top-16 left-4', // Offset from record count overlay
    'top-right': 'top-16 right-4',
    'bottom-left': 'bottom-8 left-4',
    'bottom-right': 'bottom-8 right-4',
  }

  const isItalic = ['species', 'subspecies', 'genus'].includes(colorBy)

  return (
    <div
      className={cn(
        'absolute z-10 max-w-[200px] rounded-lg bg-card/95 p-3 shadow-lg backdrop-blur',
        positionClasses[legendSettings.position]
      )}
    >
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {legendTitle}
      </h4>
      <div className="space-y-1.5">
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="h-3 w-3 shrink-0 rounded-full border border-white/50"
              style={{ backgroundColor: color as string }}
            />
            <span
              className={cn(
                'truncate text-sm text-foreground',
                isItalic && 'italic'
              )}
              title={label}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <p className="mt-2 text-xs italic text-muted-foreground">
          + {Object.keys(activeColorMap).length - legendSettings.maxItems} more
        </p>
      )}
    </div>
  )
}
