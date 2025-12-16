<script setup>
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { X, Image, Download, AlertCircle } from 'lucide-vue-next'

const props = defineProps({ map: { type: Object, required: true } })
const emit = defineEmits(['close'])

const exportWidth = ref(1920)
const exportHeight = ref(1080)
const exportDpi = ref(300)
const includeScaleBar = ref(true)
const includeLegend = ref(true)
const includeAttribution = ref(true)
const exportFormat = ref('png')
const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref(null)

const presetSizes = [
  { name: 'HD (16:9)', width: 1920, height: 1080 },
  { name: '4K (16:9)', width: 3840, height: 2160 },
  { name: 'A4 Landscape', width: 3508, height: 2480 },
  { name: 'A4 Portrait', width: 2480, height: 3508 },
  { name: 'Square', width: 2000, height: 2000 },
  { name: 'Letter Landscape', width: 3300, height: 2550 },
]

const applyPreset = (preset) => { exportWidth.value = preset.width; exportHeight.value = preset.height }
const physicalWidth = computed(() => (exportWidth.value / exportDpi.value).toFixed(2))
const physicalHeight = computed(() => (exportHeight.value / exportDpi.value).toFixed(2))

const drawScaleBar = (ctx, width, height) => {
  const padding = 30, barWidth = 200, barHeight = 8, x = padding, y = height - padding - barHeight
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.roundRect(x - 10, y - 25, barWidth + 20, 50, 6); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, barWidth, barHeight)
  ctx.fillStyle = '#333'; ctx.fillRect(x + barWidth * 0.25, y, barWidth * 0.25, barHeight); ctx.fillRect(x + barWidth * 0.75, y, barWidth * 0.25, barHeight)
  ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Scale varies with latitude', x + barWidth / 2, y - 8)
}

const drawLegend = (ctx, width, height) => {
  const statuses = [{ label: 'Sequenced', color: '#3b82f6' }, { label: 'Tissue Available', color: '#10b981' }, { label: 'Preserved Specimen', color: '#f59e0b' }, { label: 'Published', color: '#a855f7' }, { label: 'GBIF Record', color: '#6b7280' }]
  const padding = 20, itemHeight = 24, legendWidth = 180, legendHeight = statuses.length * itemHeight + 40, x = width - legendWidth - padding, y = padding
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.roundRect(x, y, legendWidth, legendHeight, 8); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Sequencing Status', x + 12, y + 22)
  ctx.font = '12px system-ui, sans-serif'
  statuses.forEach((status, i) => { const itemY = y + 40 + i * itemHeight; ctx.beginPath(); ctx.arc(x + 18, itemY, 5, 0, Math.PI * 2); ctx.fillStyle = status.color; ctx.fill(); ctx.fillStyle = '#ccc'; ctx.fillText(status.label, x + 30, itemY + 4) })
}

const drawAttribution = (ctx, width, height) => {
  const text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF', padding = 20
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.font = '12px system-ui, sans-serif'; const textWidth = ctx.measureText(text).width
  ctx.roundRect(width - textWidth - padding - 16, height - 36, textWidth + 16, 26, 4); ctx.fill()
  ctx.fillStyle = '#aaa'; ctx.textAlign = 'right'; ctx.fillText(text, width - padding, height - 18)
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2
    this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this
  }
}

const exportMap = async () => {
  if (!props.map) { exportError.value = 'Map not available'; return }
  isExporting.value = true; exportProgress.value = 0; exportError.value = null
  try {
    const mapCanvas = props.map.getCanvas(); exportProgress.value = 10
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); canvas.width = exportWidth.value; canvas.height = exportHeight.value
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height); exportProgress.value = 20
    const mapImage = await new Promise((resolve, reject) => { try { const dataUrl = mapCanvas.toDataURL('image/png'); const img = new window.Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Failed to load map image')); img.src = dataUrl } catch (e) { reject(e) } })
    exportProgress.value = 50
    const scale = Math.min(canvas.width / mapImage.width, canvas.height / mapImage.height), scaledWidth = mapImage.width * scale, scaledHeight = mapImage.height * scale
    ctx.drawImage(mapImage, (canvas.width - scaledWidth) / 2, (canvas.height - scaledHeight) / 2, scaledWidth, scaledHeight)
    exportProgress.value = 70
    if (includeScaleBar.value) drawScaleBar(ctx, canvas.width, canvas.height); exportProgress.value = 80
    if (includeLegend.value) drawLegend(ctx, canvas.width, canvas.height); exportProgress.value = 90
    if (includeAttribution.value) drawAttribution(ctx, canvas.width, canvas.height); exportProgress.value = 95
    const dataUrl = canvas.toDataURL(`image/${exportFormat.value}`, 1.0), link = document.createElement('a')
    link.download = `ithomiini_map_${exportWidth.value}x${exportHeight.value}_${exportDpi.value}dpi.${exportFormat.value}`; link.href = dataUrl; link.click()
    exportProgress.value = 100; setTimeout(() => { isExporting.value = false; exportProgress.value = 0 }, 1500)
  } catch (e) { console.error('Export failed:', e); exportError.value = e.message || 'Export failed'; isExporting.value = false }
}
</script>

<template>
  <div class="bg-card rounded-xl shadow-2xl w-[440px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-border">
      <h3 class="flex items-center gap-2.5 text-lg font-semibold text-foreground">
        <Image class="w-5 h-5 text-primary" />Export Map Image
      </h3>
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')"><X class="w-4 h-4" /></Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-5 space-y-5">
      <!-- Preset sizes -->
      <div>
        <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2.5 block">Preset Sizes</Label>
        <div class="grid grid-cols-3 gap-2">
          <Button v-for="preset in presetSizes" :key="preset.name" variant="outline" size="sm"
            class="text-xs" :class="exportWidth === preset.width && exportHeight === preset.height ? 'bg-primary/15 border-primary text-primary' : ''"
            @click="applyPreset(preset)">{{ preset.name }}</Button>
        </div>
      </div>

      <!-- Custom dimensions -->
      <div>
        <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2.5 block">Dimensions (pixels)</Label>
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-[11px] text-muted-foreground mb-1">Width</label>
            <input type="number" v-model.number="exportWidth" min="100" max="8000"
              class="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground tabular-nums focus:outline-none focus:border-primary" />
          </div>
          <span class="text-muted-foreground text-lg pb-2">×</span>
          <div class="flex-1">
            <label class="block text-[11px] text-muted-foreground mb-1">Height</label>
            <input type="number" v-model.number="exportHeight" min="100" max="8000"
              class="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground tabular-nums focus:outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <!-- DPI selection -->
      <div>
        <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2.5 block">Resolution (DPI)</Label>
        <div class="flex gap-2">
          <Button v-for="dpi in [{v:72,l:'72 (Screen)'},{v:150,l:'150 (Draft)'},{v:300,l:'300 (Print)'}]" :key="dpi.v"
            :variant="exportDpi === dpi.v ? 'default' : 'outline'" size="sm" class="flex-1 text-xs" @click="exportDpi = dpi.v">{{ dpi.l }}</Button>
        </div>
        <p class="text-xs text-muted-foreground mt-2">Physical size: {{ physicalWidth }}" × {{ physicalHeight }}" at {{ exportDpi }} DPI</p>
      </div>

      <!-- Options -->
      <div>
        <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2.5 block">Include Elements</Label>
        <div class="space-y-2">
          <label class="flex items-center gap-2.5 cursor-pointer"><Checkbox :checked="includeScaleBar" @update:checked="includeScaleBar = $event" /><span class="text-sm text-foreground">Scale bar</span></label>
          <label class="flex items-center gap-2.5 cursor-pointer"><Checkbox :checked="includeLegend" @update:checked="includeLegend = $event" /><span class="text-sm text-foreground">Status legend</span></label>
          <label class="flex items-center gap-2.5 cursor-pointer"><Checkbox :checked="includeAttribution" @update:checked="includeAttribution = $event" /><span class="text-sm text-foreground">Attribution</span></label>
        </div>
      </div>

      <!-- Format -->
      <div>
        <Label class="text-xs uppercase tracking-wider text-secondary-foreground mb-2.5 block">Format</Label>
        <div class="flex gap-2">
          <Button :variant="exportFormat === 'png' ? 'default' : 'outline'" size="sm" class="flex-1" @click="exportFormat = 'png'">PNG (Lossless)</Button>
          <Button :variant="exportFormat === 'jpeg' ? 'default' : 'outline'" size="sm" class="flex-1" @click="exportFormat = 'jpeg'">JPEG (Smaller)</Button>
        </div>
      </div>

      <div v-if="exportError" class="flex items-center gap-2.5 p-3 bg-destructive/15 rounded-lg text-destructive text-sm">
        <AlertCircle class="w-4 h-4 flex-shrink-0" />{{ exportError }}
      </div>
    </div>

    <!-- Footer -->
    <div class="px-5 py-4 border-t border-border bg-background">
      <div v-if="isExporting" class="space-y-2">
        <div class="h-2 bg-muted rounded-full overflow-hidden"><div class="h-full bg-primary rounded-full transition-all duration-300" :style="{ width: exportProgress + '%' }"></div></div>
        <span class="text-sm text-secondary-foreground text-center block">{{ exportProgress < 100 ? 'Exporting...' : 'Complete!' }}</span>
      </div>
      <div v-else class="flex gap-2.5">
        <Button variant="outline" class="flex-1" @click="emit('close')">Cancel</Button>
        <Button class="flex-[2]" @click="exportMap"><Download class="w-4 h-4 mr-2" />Export Image</Button>
      </div>
    </div>
  </div>
</template>
