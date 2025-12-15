<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { X, Download, Image, Quote, Copy, Check, AlertCircle, Info } from 'lucide-vue-next'

const store = useDataStore()
const emit = defineEmits(['close'])
const props = defineProps({ map: { type: Object, default: null } })

const isExporting = ref(false)
const exportSuccess = ref(false)
const citationCopied = ref(false)
const imageExportProgress = ref(0)
const imageExportError = ref(null)

const filteredData = computed(() => store.filteredGeoJSON?.features?.map(f => f.properties) || [])
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const shortHash = commitHash.substring(0, 7)

const citationText = computed(() => {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return `Ithomiini Distribution Maps. Data accessed on ${date}. ${filteredData.value.length.toLocaleString()} records retrieved. Version: ${shortHash}. URL: ${window.location.href}`
})

const bibtexCitation = computed(() => {
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
})

const exportCSV = () => {
  isExporting.value = true
  try {
    const data = filteredData.value
    if (data.length === 0) { alert('No data to export'); return }
    const columns = ['id', 'scientific_name', 'genus', 'species', 'subspecies', 'family', 'tribe', 'mimicry_ring', 'sequencing_status', 'source', 'country', 'lat', 'lng', 'image_url']
    const header = columns.join(',')
    const rows = data.map(row => columns.map(col => {
      let val = row[col] ?? ''
      val = String(val)
      if (val.includes(',') || val.includes('"') || val.includes('\n')) val = '"' + val.replace(/"/g, '""') + '"'
      return val
    }).join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `ithomiini_data_${shortHash}_${Date.now()}.csv`; link.click()
    URL.revokeObjectURL(url)
    exportSuccess.value = true; setTimeout(() => { exportSuccess.value = false }, 3000)
  } catch (e) { console.error('CSV export failed:', e); alert('Export failed: ' + e.message) }
  finally { isExporting.value = false }
}

const exportGeoJSON = () => {
  isExporting.value = true
  try {
    const geo = store.filteredGeoJSON
    if (!geo?.features?.length) { alert('No data to export'); return }
    const exportData = { type: 'FeatureCollection', metadata: { title: 'Ithomiini Distribution Data', version: shortHash, exportDate: new Date().toISOString(), recordCount: geo.features.length, source: 'https://fr4nzz.github.io/ithomiini_maps/' }, features: geo.features }
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `ithomiini_data_${shortHash}_${Date.now()}.geojson`; link.click()
    URL.revokeObjectURL(url)
    exportSuccess.value = true; setTimeout(() => { exportSuccess.value = false }, 3000)
  } catch (e) { console.error('GeoJSON export failed:', e); alert('Export failed: ' + e.message) }
  finally { isExporting.value = false }
}

const copyCitation = (type = 'plain') => {
  navigator.clipboard.writeText(type === 'bibtex' ? bibtexCitation.value : citationText.value)
  citationCopied.value = true; setTimeout(() => { citationCopied.value = false }, 2000)
}

const ASPECT_RATIOS = { '16:9': { width: 1920, height: 1080 }, '4:3': { width: 1600, height: 1200 }, '1:1': { width: 1200, height: 1200 }, '3:2': { width: 1800, height: 1200 }, 'A4': { width: 2480, height: 3508 }, 'A4L': { width: 3508, height: 2480 } }
const exportDimensions = computed(() => {
  const ratio = store.exportSettings.aspectRatio
  return ratio === 'custom' ? { width: store.exportSettings.customWidth, height: store.exportSettings.customHeight } : ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
})

const calculateExportRegion = (containerWidth, containerHeight, targetWidth, targetHeight) => {
  const targetAspectRatio = targetWidth / targetHeight, containerAspectRatio = containerWidth / containerHeight, maxPercent = 92
  let holeWidthPercent, holeHeightPercent
  if (targetAspectRatio > containerAspectRatio) { holeWidthPercent = maxPercent; holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio }
  else { holeHeightPercent = maxPercent; holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio }
  return { x: Math.max(2, (100 - holeWidthPercent) / 2), y: Math.max(2, (100 - holeHeightPercent) / 2), width: Math.min(96, holeWidthPercent), height: Math.min(96, holeHeightPercent) }
}

const loadImage = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Failed to load image')); img.src = src })

const roundRect = (ctx, x, y, w, h, r) => { if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); return ctx }

const drawLegendOnCanvas = (ctx, width, height) => {
  const colorMap = store.activeColorMap, entries = Object.entries(colorMap).slice(0, store.legendSettings.maxItems), uiScale = store.exportSettings.uiScale || 1
  const referenceHeight = 650, resolutionScale = height / referenceHeight, scale = uiScale * resolutionScale
  const sidePadding = 15 * resolutionScale * uiScale, topPadding = 50 * resolutionScale * uiScale, bottomPadding = 15 * resolutionScale * uiScale
  const itemHeight = 24 * scale, leftPadding = 12 * scale, dotSpace = 32 * scale, rightPadding = 12 * scale
  const isItalic = ['species', 'subspecies', 'genus'].includes(store.colorBy)
  ctx.font = isItalic ? `italic ${13 * scale}px system-ui, sans-serif` : `${13 * scale}px system-ui, sans-serif`
  let maxLabelWidth = 0; entries.forEach(([label]) => { const labelWidth = ctx.measureText(label).width; if (labelWidth > maxLabelWidth) maxLabelWidth = labelWidth })
  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  const titleWidth = ctx.measureText(store.legendTitle.toUpperCase()).width
  const contentWidth = Math.max(maxLabelWidth + dotSpace, titleWidth) + leftPadding + rightPadding
  const legendWidth = Math.max(180 * scale, Math.min(contentWidth, 300 * scale)), legendHeight = entries.length * itemHeight + 45 * scale
  let x, y; const pos = store.legendSettings.position
  if (pos === 'top-left') { x = sidePadding; y = topPadding } else if (pos === 'top-right') { x = width - legendWidth - sidePadding; y = topPadding }
  else if (pos === 'bottom-right') { x = width - legendWidth - sidePadding; y = height - legendHeight - bottomPadding } else { x = sidePadding; y = height - legendHeight - bottomPadding }
  ctx.fillStyle = 'rgba(26, 26, 46, 0.95)'; roundRect(ctx, x, y, legendWidth, legendHeight, 8 * scale); ctx.fill()
  ctx.fillStyle = '#888'; ctx.font = `bold ${12 * scale}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(store.legendTitle.toUpperCase(), x + leftPadding, y + 22 * scale)
  const maxTextWidth = legendWidth - dotSpace - rightPadding
  ctx.font = isItalic ? `italic ${13 * scale}px system-ui, sans-serif` : `${13 * scale}px system-ui, sans-serif`
  entries.forEach(([label, color], i) => {
    const itemY = y + 40 * scale + i * itemHeight
    ctx.beginPath(); ctx.arc(x + 18 * scale, itemY, 5 * scale, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
    ctx.fillStyle = '#e0e0e0'; let displayLabel = label, labelWidth = ctx.measureText(displayLabel).width
    if (labelWidth > maxTextWidth) { while (labelWidth > maxTextWidth && displayLabel.length > 0) { displayLabel = displayLabel.slice(0, -1); labelWidth = ctx.measureText(displayLabel + '…').width }; displayLabel += '…' }
    ctx.fillText(displayLabel, x + dotSpace, itemY + 4 * scale)
  })
  if (Object.keys(colorMap).length > store.legendSettings.maxItems) { ctx.fillStyle = '#666'; ctx.font = `italic ${11 * scale}px system-ui, sans-serif`; ctx.fillText(`+ ${Object.keys(colorMap).length - store.legendSettings.maxItems} more`, x + 12 * scale, y + legendHeight - 12 * scale) }
}

const drawScaleBarOnCanvas = (ctx, width, height) => {
  const uiScale = store.exportSettings.uiScale || 1, referenceHeight = 650, resolutionScale = height / referenceHeight, scale = uiScale * resolutionScale
  const sidePadding = 15 * resolutionScale * uiScale, bottomPadding = 15 * resolutionScale * uiScale, barWidth = 100 * scale, barHeight = 4 * scale
  let x = (store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend) ? sidePadding : width - barWidth - sidePadding
  const y = height - bottomPadding - barHeight - 20 * scale
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, barWidth, barHeight); ctx.fillRect(x, y - 4 * scale, 2 * scale, barHeight + 8 * scale); ctx.fillRect(x + barWidth - 2 * scale, y - 4 * scale, 2 * scale, barHeight + 8 * scale)
  ctx.font = `bold ${11 * scale}px system-ui, sans-serif`; ctx.textAlign = (store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend) ? 'left' : 'right'; ctx.textBaseline = 'top'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3
  ctx.fillText('Scale varies with latitude', (store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend) ? x : x + barWidth, y + barHeight + 6 * scale); ctx.shadowBlur = 0
}

const drawAttributionOnCanvas = (ctx, width, height) => {
  const uiScale = store.exportSettings.uiScale || 1, text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF', padding = 15 * uiScale
  ctx.font = `${11 * uiScale}px system-ui, sans-serif`; const textWidth = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; roundRect(ctx, width - textWidth - padding - 12 * uiScale, height - 28 * uiScale, textWidth + 12 * uiScale, 22 * uiScale, 4 * uiScale); ctx.fill()
  ctx.fillStyle = '#aaa'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(text, width - padding, height - 17 * uiScale)
}

const exportImage = async () => {
  if (!props.map) { imageExportError.value = 'Map not available. Please ensure you are on the Map view.'; return }
  isExporting.value = true; imageExportProgress.value = 0; imageExportError.value = null
  try {
    const map = props.map
    if (!map.isStyleLoaded()) await new Promise(resolve => map.once('style.load', resolve))
    map.triggerRepaint(); await new Promise(resolve => map.once('idle', resolve))
    imageExportProgress.value = 10
    const mapCanvas = map.getCanvas(), { width: exportWidth, height: exportHeight } = exportDimensions.value
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); canvas.width = exportWidth; canvas.height = exportHeight
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    imageExportProgress.value = 20
    const mapDataUrl = mapCanvas.toDataURL('image/png'), mapImage = await loadImage(mapDataUrl)
    imageExportProgress.value = 40
    if (store.exportSettings.enabled) {
      const region = calculateExportRegion(mapImage.width, mapImage.height, exportWidth, exportHeight)
      const srcX = (region.x / 100) * mapImage.width, srcY = (region.y / 100) * mapImage.height, srcW = (region.width / 100) * mapImage.width, srcH = (region.height / 100) * mapImage.height
      ctx.drawImage(mapImage, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    } else {
      const scale = Math.min(canvas.width / mapImage.width, canvas.height / mapImage.height), scaledWidth = mapImage.width * scale, scaledHeight = mapImage.height * scale
      ctx.drawImage(mapImage, (canvas.width - scaledWidth) / 2, (canvas.height - scaledHeight) / 2, scaledWidth, scaledHeight)
    }
    imageExportProgress.value = 60
    if (store.exportSettings.includeLegend && store.legendSettings.showLegend) drawLegendOnCanvas(ctx, canvas.width, canvas.height)
    imageExportProgress.value = 75
    if (store.exportSettings.includeScaleBar) drawScaleBarOnCanvas(ctx, canvas.width, canvas.height)
    imageExportProgress.value = 85
    drawAttributionOnCanvas(ctx, canvas.width, canvas.height)
    imageExportProgress.value = 95
    const dataUrl = canvas.toDataURL('image/png', 1.0), link = document.createElement('a'); link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.png`; link.href = dataUrl; link.click()
    imageExportProgress.value = 100; exportSuccess.value = true
    setTimeout(() => { isExporting.value = false; imageExportProgress.value = 0; exportSuccess.value = false }, 2000)
  } catch (e) { console.error('[Export] Image export failed:', e); imageExportError.value = e.message || 'Export failed'; isExporting.value = false }
}
</script>

<template>
  <div class="bg-card rounded-xl shadow-2xl w-[420px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-border">
      <h3 class="text-lg font-semibold text-foreground">Export & Citation</h3>
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')"><X class="w-4 h-4" /></Button>
    </div>

    <Tabs default-value="image" class="flex-1 flex flex-col">
      <TabsList class="grid w-full grid-cols-3 mx-4 mt-2" style="width: calc(100% - 2rem);">
        <TabsTrigger value="image">Export Image</TabsTrigger>
        <TabsTrigger value="export">Export Data</TabsTrigger>
        <TabsTrigger value="citation">Citation</TabsTrigger>
      </TabsList>

      <div class="flex-1 overflow-y-auto p-5">
        <!-- Export Image Tab -->
        <TabsContent value="image" class="mt-0 space-y-5">
          <div>
            <span class="inline-block px-3 py-1.5 rounded-md text-xs font-semibold mb-2.5" :class="store.exportSettings.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'">
              {{ store.exportSettings.enabled ? 'Export Preview Mode ON' : 'Export Preview Mode OFF' }}
            </span>
            <p class="text-sm text-secondary-foreground leading-relaxed">
              {{ store.exportSettings.enabled ? 'Will export the area shown in the export preview rectangle.' : 'Will export the current map view. Enable Export Preview in sidebar to define a specific region.' }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-muted rounded-lg p-4 text-center">
              <span class="block text-2xl font-bold text-primary tabular-nums">{{ exportDimensions.width }}</span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider">Width (px)</span>
            </div>
            <div class="bg-muted rounded-lg p-4 text-center">
              <span class="block text-2xl font-bold text-primary tabular-nums">{{ exportDimensions.height }}</span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider">Height (px)</span>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2 block">Include in Export:</Label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox :checked="store.exportSettings.includeLegend" @update:checked="store.exportSettings.includeLegend = $event" />
                  <span class="text-sm text-foreground">Legend</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox :checked="store.exportSettings.includeScaleBar" @update:checked="store.exportSettings.includeScaleBar = $event" />
                  <span class="text-sm text-foreground">Scale Bar</span>
                </label>
              </div>
            </div>
            <div>
              <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2 block">UI Scale: {{ Math.round(store.exportSettings.uiScale * 100) }}%</Label>
              <Slider :model-value="[store.exportSettings.uiScale]" @update:model-value="store.exportSettings.uiScale = $event[0]" :min="0.5" :max="2" :step="0.1" class="w-full" />
            </div>
          </div>

          <div v-if="imageExportError" class="flex items-center gap-2.5 p-3 bg-destructive/15 rounded-lg text-destructive text-sm">
            <AlertCircle class="w-4 h-4 flex-shrink-0" />{{ imageExportError }}
          </div>

          <div v-if="isExporting" class="bg-muted rounded-lg p-4 space-y-2">
            <div class="h-2 bg-background rounded-full overflow-hidden"><div class="h-full bg-primary rounded-full transition-all duration-300" :style="{ width: imageExportProgress + '%' }"></div></div>
            <span class="text-sm text-secondary-foreground text-center block">{{ imageExportProgress < 100 ? 'Exporting...' : 'Complete!' }}</span>
          </div>

          <Button v-else class="w-full h-auto py-4" :disabled="!map" @click="exportImage">
            <Image class="w-6 h-6 mr-3" />
            <div class="text-left"><div class="font-semibold">Download PNG Image</div><div class="text-xs opacity-80">{{ exportDimensions.width }} × {{ exportDimensions.height }} pixels</div></div>
          </Button>

          <Transition name="fade"><div v-if="exportSuccess" class="flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Check class="w-4 h-4" />Image exported!</div></Transition>
        </TabsContent>

        <!-- Export Data Tab -->
        <TabsContent value="export" class="mt-0 space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-muted rounded-lg p-4 text-center">
              <span class="block text-2xl font-bold text-primary tabular-nums">{{ filteredData.length.toLocaleString() }}</span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider">Records</span>
            </div>
            <div class="bg-muted rounded-lg p-4 text-center">
              <span class="block text-2xl font-bold text-primary">{{ shortHash }}</span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider">Version</span>
            </div>
          </div>

          <div class="space-y-2.5">
            <Button variant="outline" class="w-full h-auto py-3.5 justify-start" :disabled="isExporting || filteredData.length === 0" @click="exportCSV">
              <Download class="w-5 h-5 mr-3 text-primary" />
              <div class="text-left"><div class="font-medium">Download CSV</div><div class="text-xs text-muted-foreground">Spreadsheet format</div></div>
            </Button>
            <Button variant="outline" class="w-full h-auto py-3.5 justify-start" :disabled="isExporting || filteredData.length === 0" @click="exportGeoJSON">
              <Download class="w-5 h-5 mr-3 text-primary" />
              <div class="text-left"><div class="font-medium">Download GeoJSON</div><div class="text-xs text-muted-foreground">GIS/mapping format</div></div>
            </Button>
          </div>

          <Transition name="fade"><div v-if="exportSuccess" class="flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Check class="w-4 h-4" />Export complete!</div></Transition>
        </TabsContent>

        <!-- Citation Tab -->
        <TabsContent value="citation" class="mt-0 space-y-5">
          <div>
            <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2 block">Plain Text</Label>
            <div class="relative bg-muted border border-border rounded-lg p-3.5 pr-16">
              <p class="text-sm text-foreground leading-relaxed break-words">{{ citationText }}</p>
              <Button variant="outline" size="sm" class="absolute top-2.5 right-2.5 h-7" @click="copyCitation('plain')"><Copy class="w-3 h-3 mr-1" />Copy</Button>
            </div>
          </div>

          <div>
            <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2 block">BibTeX</Label>
            <div class="relative bg-muted border border-border rounded-lg p-3.5 pb-12">
              <pre class="font-mono text-xs text-secondary-foreground leading-relaxed whitespace-pre-wrap break-all">{{ bibtexCitation }}</pre>
              <Button variant="outline" size="sm" class="absolute bottom-2.5 right-2.5 h-7" @click="copyCitation('bibtex')"><Copy class="w-3 h-3 mr-1" />Copy</Button>
            </div>
          </div>

          <div class="flex gap-2.5 p-3 bg-primary/10 rounded-lg text-sm text-secondary-foreground">
            <Info class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p class="leading-relaxed m-0">Citations include a version hash for reproducibility. The URL preserves your current filter settings.</p>
          </div>

          <Transition name="fade"><div v-if="citationCopied" class="flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Check class="w-4 h-4" />Citation copied!</div></Transition>
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
