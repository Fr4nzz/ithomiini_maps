import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Separator } from '@/shared/ui/separator'
import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { Slider } from '@/shared/ui/slider'
import { Input } from '@/shared/ui/input'
import { useFilteredRecords, useDataStore } from '@/features/data'
import { exportToCSV, exportToGeoJSON } from '@/shared/lib/export'
import { Download, Copy, Check, FileJson, FileSpreadsheet, Quote, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

// Aspect ratio presets
const ASPECT_RATIOS = [
  { name: '16:9', width: 1920, height: 1080 },
  { name: '4:3', width: 1600, height: 1200 },
  { name: '1:1', width: 1200, height: 1200 },
  { name: '3:2', width: 1800, height: 1200 },
  { name: 'A4', width: 2480, height: 3508 },
  { name: 'A4L', width: 3508, height: 2480 },
] as const

// Build-time constants
declare const __BUILD_TIME__: string
declare const __COMMIT_HASH__: string

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const records = useFilteredRecords()
  const mapExportFn = useDataStore((s) => s.mapExportFn)
  const view = useDataStore((s) => s.ui.view)
  const exportSettings = useDataStore((s) => s.exportSettings)
  const setExportSettings = useDataStore((s) => s.setExportSettings)

  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [citationCopied, setCitationCopied] = useState<'plain' | 'bibtex' | null>(null)
  const [mapExportSuccess, setMapExportSuccess] = useState(false)
  const [mapExportError, setMapExportError] = useState<string | null>(null)

  // Local state for custom dimensions
  const [customWidth, setCustomWidth] = useState(exportSettings.customWidth)
  const [customHeight, setCustomHeight] = useState(exportSettings.customHeight)

  // Get build info
  const buildTime =
    typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()
  const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
  const shortHash = commitHash.substring(0, 7)

  // Citations
  const citationText = useMemo(() => {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return `Ithomiini Distribution Maps. Data accessed on ${date}. ${records.length.toLocaleString()} records retrieved. Version: ${shortHash}. URL: ${window.location.href}`
  }, [records.length, shortHash])

  const bibtexCitation = useMemo(() => {
    const year = new Date().getFullYear()
    const month = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()
    return `@misc{ithomiini_maps_${year},
  title = {Ithomiini Distribution Maps},
  author = {Meier, Joana and Dore, M. and {Sanger Institute}},
  year = {${year}},
  month = {${month}},
  note = {Data version ${shortHash}},
  howpublished = {\\url{${window.location.href.split('?')[0]}}},
}`
  }, [shortHash])

  // Export handlers
  const handleExportCSV = () => {
    setIsExporting(true)
    try {
      exportToCSV(records, `ithomiini_data_${shortHash}`)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      console.error('CSV export failed:', err)
      alert('Export failed: ' + (err as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportGeoJSON = () => {
    setIsExporting(true)
    try {
      exportToGeoJSON(records, `ithomiini_data_${shortHash}`, shortHash)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      console.error('GeoJSON export failed:', err)
      alert('Export failed: ' + (err as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyCitation = (type: 'plain' | 'bibtex') => {
    const text = type === 'bibtex' ? bibtexCitation : citationText
    navigator.clipboard.writeText(text)
    setCitationCopied(type)
    setTimeout(() => setCitationCopied(null), 2000)
  }

  const handleExportMapImage = async (format: 'png' | 'jpeg') => {
    if (!mapExportFn) return
    setIsExporting(true)
    setMapExportError(null)
    try {
      const date = new Date().toISOString().split('T')[0]
      await mapExportFn(format, `ithomiini_map_${date}`, {
        width: customWidth,
        height: customHeight,
        includeLegend: exportSettings.includeLegend,
        includeScaleBar: exportSettings.includeScaleBar,
        uiScale: exportSettings.uiScale,
      })
      setMapExportSuccess(true)
      setTimeout(() => setMapExportSuccess(false), 3000)
    } catch (err) {
      setMapExportError((err as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export filtered data or copy citation information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="data" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="data" className="gap-2">
              <Download className="h-4 w-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Map
            </TabsTrigger>
            <TabsTrigger value="citation" className="gap-2">
              <Quote className="h-4 w-4" />
              Cite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Current Selection</p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-primary">{records.length.toLocaleString()}</strong>{' '}
                  records
                </p>
              </div>
              <Badge variant="secondary">v{shortHash}</Badge>
            </div>

            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-4"
                onClick={handleExportCSV}
                disabled={isExporting || records.length === 0}
              >
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                <div className="text-left">
                  <p className="font-medium">Export as CSV</p>
                  <p className="text-xs text-muted-foreground">
                    Spreadsheet format, compatible with Excel
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-4"
                onClick={handleExportGeoJSON}
                disabled={isExporting || records.length === 0}
              >
                <FileJson className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">Export as GeoJSON</p>
                  <p className="text-xs text-muted-foreground">
                    Geographic format for mapping tools
                  </p>
                </div>
              </Button>
            </div>

            {exportSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-green-500">
                <Check className="h-4 w-4" />
                <span className="text-sm">Export completed successfully!</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            {view !== 'map' ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                <p className="text-sm">
                  Switch to Map view to export the map as an image.
                </p>
              </div>
            ) : !mapExportFn ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                <p className="text-sm">
                  Map is loading... Please wait.
                </p>
              </div>
            ) : (
              <>
                {/* Aspect ratio presets */}
                <div>
                  <Label className="mb-2.5 block text-xs uppercase tracking-wider text-muted-foreground">
                    Preset Sizes
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map(({ name, width, height }) => (
                      <Button
                        key={name}
                        variant="outline"
                        size="sm"
                        className={cn(
                          'text-xs',
                          exportSettings.aspectRatio === name &&
                            'border-primary bg-primary/15 text-primary'
                        )}
                        onClick={() => {
                          setExportSettings({ aspectRatio: name as typeof exportSettings.aspectRatio })
                          setCustomWidth(width)
                          setCustomHeight(height)
                        }}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom dimensions */}
                <div>
                  <Label className="mb-2.5 block text-xs uppercase tracking-wider text-muted-foreground">
                    Dimensions (pixels)
                  </Label>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] text-muted-foreground">Width</label>
                      <Input
                        type="number"
                        value={customWidth}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1920
                          setCustomWidth(val)
                          setExportSettings({ customWidth: val, aspectRatio: 'custom' })
                        }}
                        min={100}
                        max={8000}
                        className="tabular-nums"
                      />
                    </div>
                    <span className="pb-2 text-lg text-muted-foreground">×</span>
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] text-muted-foreground">Height</label>
                      <Input
                        type="number"
                        value={customHeight}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1080
                          setCustomHeight(val)
                          setExportSettings({ customHeight: val, aspectRatio: 'custom' })
                        }}
                        min={100}
                        max={8000}
                        className="tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                {/* Include options */}
                <div>
                  <Label className="mb-2.5 block text-xs uppercase tracking-wider text-muted-foreground">
                    Include Elements
                  </Label>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={exportSettings.includeLegend}
                        onCheckedChange={(c) => setExportSettings({ includeLegend: !!c })}
                      />
                      <span className="text-sm">Legend</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={exportSettings.includeScaleBar}
                        onCheckedChange={(c) => setExportSettings({ includeScaleBar: !!c })}
                      />
                      <span className="text-sm">Scale bar</span>
                    </label>
                  </div>
                </div>

                {/* UI Scale slider */}
                <div>
                  <Label className="mb-2.5 block text-xs uppercase tracking-wider text-muted-foreground">
                    UI Scale
                  </Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[exportSettings.uiScale]}
                      onValueChange={([v]) => setExportSettings({ uiScale: v })}
                      min={0.5}
                      max={2}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-semibold text-primary">
                      {exportSettings.uiScale}x
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Export buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExportMapImage('png')}
                    disabled={isExporting}
                  >
                    <ImageIcon className="h-4 w-4 text-purple-500" />
                    Export PNG
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExportMapImage('jpeg')}
                    disabled={isExporting}
                  >
                    <ImageIcon className="h-4 w-4 text-orange-500" />
                    Export JPEG
                  </Button>
                </div>

                {mapExportSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-green-500">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Map exported successfully!</span>
                  </div>
                )}

                {mapExportError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                    <span className="text-sm">Export failed: {mapExportError}</span>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="citation" className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Plain Text Citation</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleCopyCitation('plain')}
                  >
                    {citationCopied === 'plain' ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">{citationText}</div>
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">BibTeX Citation</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleCopyCitation('bibtex')}
                  >
                    {citationCopied === 'bibtex' ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs">
                  {bibtexCitation}
                </pre>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Build info:</strong> Version {shortHash} • Built{' '}
                {new Date(buildTime).toLocaleDateString()}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
