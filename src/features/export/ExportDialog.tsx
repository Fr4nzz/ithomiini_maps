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
import { useFilteredRecords, useDataStore } from '@/features/data'
import { exportToCSV, exportToGeoJSON } from '@/shared/lib/export'
import { Download, Copy, Check, FileJson, FileSpreadsheet, Quote, Image as ImageIcon } from 'lucide-react'

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

  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [citationCopied, setCitationCopied] = useState<'plain' | 'bibtex' | null>(null)
  const [mapExportSuccess, setMapExportSuccess] = useState(false)
  const [mapExportError, setMapExportError] = useState<string | null>(null)

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
      await mapExportFn(format, `ithomiini_map_${date}`)
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
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Export the current map view as an image. The export includes all visible points and map controls.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-auto py-4"
                    onClick={() => handleExportMapImage('png')}
                    disabled={isExporting}
                  >
                    <ImageIcon className="h-5 w-5 text-purple-500" />
                    <div className="text-left">
                      <p className="font-medium">Export as PNG</p>
                      <p className="text-xs text-muted-foreground">
                        High-quality image with transparency
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-auto py-4"
                    onClick={() => handleExportMapImage('jpeg')}
                    disabled={isExporting}
                  >
                    <ImageIcon className="h-5 w-5 text-orange-500" />
                    <div className="text-left">
                      <p className="font-medium">Export as JPEG</p>
                      <p className="text-xs text-muted-foreground">
                        Smaller file size, white background
                      </p>
                    </div>
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
