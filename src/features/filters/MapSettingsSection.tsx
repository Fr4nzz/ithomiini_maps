import { ChevronRight, Palette } from 'lucide-react'
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
import { Label } from '@/shared/ui/label'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { useDataStore } from '@/features/data'
import { cn } from '@/shared/lib/utils'

interface MapSettingsSectionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MapSettingsSection({ open, onOpenChange }: MapSettingsSectionProps) {
  const colorBy = useDataStore((s) => s.colorBy)
  const setColorBy = useDataStore((s) => s.setColorBy)
  const mapStyle = useDataStore((s) => s.mapStyle)
  const setMapStyle = useDataStore((s) => s.setMapStyle)
  const legendSettings = useDataStore((s) => s.legendSettings)
  const setLegendSettings = useDataStore((s) => s.setLegendSettings)

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 rounded-lg border p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')}
        />
        <Palette className="h-4 w-4 text-primary" />
        Map & Legend Settings
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-3 pb-3 pt-2">
        {/* Color By selector */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Color By</Label>
          <Select value={colorBy} onValueChange={(v) => setColorBy(v as typeof colorBy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="species">Species</SelectItem>
              <SelectItem value="subspecies">Subspecies</SelectItem>
              <SelectItem value="genus">Genus</SelectItem>
              <SelectItem value="mimicry_ring">Mimicry Ring</SelectItem>
              <SelectItem value="sequencing_status">Sequencing Status</SelectItem>
              <SelectItem value="source">Source</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show Legend toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Show Legend</Label>
          <Switch
            checked={legendSettings.showLegend}
            onCheckedChange={(checked) => setLegendSettings({ showLegend: checked })}
          />
        </div>

        {/* Legend position */}
        {legendSettings.showLegend && (
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Legend Position</Label>
            <Select
              value={legendSettings.position}
              onValueChange={(v) =>
                setLegendSettings({ position: v as typeof legendSettings.position })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Point radius */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Point Radius</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[mapStyle.pointRadius]}
              onValueChange={([v]) => setMapStyle({ pointRadius: v })}
              min={2}
              max={15}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm font-semibold text-primary">
              {mapStyle.pointRadius}px
            </span>
          </div>
        </div>

        {/* Point opacity */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Point Opacity</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[mapStyle.pointOpacity]}
              onValueChange={([v]) => setMapStyle({ pointOpacity: v })}
              min={0.1}
              max={1}
              step={0.05}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm font-semibold text-primary">
              {Math.round(mapStyle.pointOpacity * 100)}%
            </span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
