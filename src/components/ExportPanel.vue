<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { ASPECT_RATIOS } from '../utils/constants'
import JSZip from 'jszip'

const store = useDataStore()

// Calculate preview rectangle bounds in geographic coordinates
// This matches the green preview rectangle shown in the export UI
const getPreviewBounds = (map) => {
  const container = map.getContainer()
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight

  // Calculate the preview hole position (same logic as MapEngine/App.vue)
  const ratio = store.exportSettings.aspectRatio
  let targetWidth, targetHeight
  if (ratio === 'custom') {
    targetWidth = store.exportSettings.customWidth
    targetHeight = store.exportSettings.customHeight
  } else {
    const dims = ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
    targetWidth = dims.width
    targetHeight = dims.height
  }

  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent
  if (targetAspectRatio > containerAspectRatio) {
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }

  const xPercent = Math.max(2, (100 - holeWidthPercent) / 2)
  const yPercent = Math.max(2, (100 - holeHeightPercent) / 2)

  // Calculate pixel coordinates of preview rectangle
  const holeX = (xPercent / 100) * containerWidth
  const holeY = (yPercent / 100) * containerHeight
  const holeWidth = (Math.min(96, holeWidthPercent) / 100) * containerWidth
  const holeHeight = (Math.min(96, holeHeightPercent) / 100) * containerHeight

  // Convert pixel corners to geographic coordinates using map.unproject()
  const topLeft = map.unproject([holeX, holeY])
  const bottomRight = map.unproject([holeX + holeWidth, holeY + holeHeight])

  return {
    west: topLeft.lng,
    north: topLeft.lat,
    east: bottomRight.lng,
    south: bottomRight.lat
  }
}

// Get preview rectangle pixel coordinates for canvas cropping
const getPreviewHolePixels = (map) => {
  const container = map.getContainer()
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  const pixelRatio = window.devicePixelRatio || 1

  const ratio = store.exportSettings.aspectRatio
  let targetWidth, targetHeight
  if (ratio === 'custom') {
    targetWidth = store.exportSettings.customWidth
    targetHeight = store.exportSettings.customHeight
  } else {
    const dims = ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
    targetWidth = dims.width
    targetHeight = dims.height
  }

  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent
  if (targetAspectRatio > containerAspectRatio) {
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }

  const xPercent = Math.max(2, (100 - holeWidthPercent) / 2)
  const yPercent = Math.max(2, (100 - holeHeightPercent) / 2)

  // Calculate pixel coordinates (accounting for devicePixelRatio)
  return {
    x: Math.round((xPercent / 100) * containerWidth * pixelRatio),
    y: Math.round((yPercent / 100) * containerHeight * pixelRatio),
    width: Math.round((Math.min(96, holeWidthPercent) / 100) * containerWidth * pixelRatio),
    height: Math.round((Math.min(96, holeHeightPercent) / 100) * containerHeight * pixelRatio)
  }
}
const emit = defineEmits(['close'])

const props = defineProps({
  map: {
    type: Object,
    default: null
  },
  initialTab: {
    type: String,
    default: 'export'
  }
})

// Export state
const isExporting = ref(false)
const exportSuccess = ref(false)
const citationCopied = ref(false)
const exportError = ref(null)

// Get filtered data
const filteredData = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features.map(f => f.properties)
})

// Build info (injected by Vite)
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const shortHash = commitHash.substring(0, 7)

// Generate citation text
const citationText = computed(() => {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const recordCount = filteredData.value.length
  const url = window.location.href

  return `Ithomiini Distribution Maps. Data accessed on ${date}. ` +
    `${recordCount.toLocaleString()} records retrieved. ` +
    `Version: ${shortHash}. ` +
    `URL: ${url}`
})

// BibTeX citation
const bibtexCitation = computed(() => {
  const year = new Date().getFullYear()
  const month = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const url = window.location.href.split('?')[0]

  return `@misc{ithomiini_maps_${year},
  title = {Ithomiini Distribution Maps},
  author = {Meier, Joana and Dore, M. and {Sanger Institute}},
  year = {${year}},
  month = {${month}},
  note = {Data version ${shortHash}},
  howpublished = {\\url{${url}}},
}`
})

// Export to CSV
const exportCSV = () => {
  isExporting.value = true

  try {
    const data = filteredData.value
    if (data.length === 0) {
      alert('No data to export')
      return
    }

    const columns = [
      'id', 'scientific_name', 'genus', 'species', 'subspecies',
      'family', 'tribe', 'mimicry_ring', 'sequencing_status',
      'source', 'country', 'lat', 'lng', 'sex', 'image_url'
    ]

    const header = columns.join(',')
    const rows = data.map(row => {
      return columns.map(col => {
        let val = row[col]
        if (val === null || val === undefined) val = ''
        val = String(val)
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"'
        }
        return val
      }).join(',')
    })

    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ithomiini_data_${shortHash}_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)

    exportSuccess.value = true
    setTimeout(() => { exportSuccess.value = false }, 3000)

  } catch (e) {
    console.error('CSV export failed:', e)
    alert('Export failed: ' + e.message)
  } finally {
    isExporting.value = false
  }
}

// Export to GeoJSON
const exportGeoJSON = () => {
  isExporting.value = true

  try {
    const geo = store.filteredGeoJSON
    if (!geo || !geo.features || geo.features.length === 0) {
      alert('No data to export')
      return
    }

    const exportData = {
      type: 'FeatureCollection',
      metadata: {
        title: 'Ithomiini Distribution Data',
        version: shortHash,
        exportDate: new Date().toISOString(),
        recordCount: geo.features.length,
        source: 'https://fr4nzz.github.io/ithomiini_maps/'
      },
      features: geo.features
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ithomiini_data_${shortHash}_${Date.now()}.geojson`
    link.click()
    URL.revokeObjectURL(url)

    exportSuccess.value = true
    setTimeout(() => { exportSuccess.value = false }, 3000)

  } catch (e) {
    console.error('GeoJSON export failed:', e)
    alert('Export failed: ' + e.message)
  } finally {
    isExporting.value = false
  }
}

// Copy citation
const copyCitation = (type = 'plain') => {
  const text = type === 'bibtex' ? bibtexCitation.value : citationText.value
  navigator.clipboard.writeText(text)
  citationCopied.value = true
  setTimeout(() => { citationCopied.value = false }, 2000)
}

// ═══════════════════════════════════════════════════════════════════════════
// R SCRIPT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

const exportForR = async () => {
  if (!props.map) {
    exportError.value = 'Map not available. Please ensure you are on the Map view.'
    return
  }

  isExporting.value = true
  exportError.value = null

  try {
    const map = props.map
    const geo = store.filteredGeoJSON

    if (!geo || !geo.features || geo.features.length === 0) {
      throw new Error('No data to export')
    }

    // Get preview rectangle bounds (matches the green preview rectangle)
    const previewBounds = getPreviewBounds(map)
    const center = map.getCenter()
    const zoom = map.getZoom()

    // Prepare GeoJSON with color information
    const colorMap = store.activeColorMap
    const colorBy = store.colorBy

    // Add color to each feature
    const featuresWithColors = geo.features.map(f => {
      const key = f.properties[colorBy] || 'Unknown'
      return {
        ...f,
        properties: {
          ...f.properties,
          display_color: colorMap[key] || '#888888'
        }
      }
    })

    const exportGeoJSON = {
      type: 'FeatureCollection',
      metadata: {
        title: 'Ithomiini Distribution Data',
        version: shortHash,
        exportDate: new Date().toISOString(),
        recordCount: geo.features.length,
        colorBy: colorBy,
        source: 'https://fr4nzz.github.io/ithomiini_maps/'
      },
      features: featuresWithColors
    }

    // View configuration (using preview rectangle bounds)
    const viewConfig = {
      bounds: {
        west: previewBounds.west,
        south: previewBounds.south,
        east: previewBounds.east,
        north: previewBounds.north
      },
      center: {
        lng: center.lng,
        lat: center.lat
      },
      zoom: zoom,
      colorBy: colorBy
    }

    // Legend configuration
    const legendConfig = {
      title: store.legendTitle,
      colorBy: colorBy,
      colors: colorMap,
      items: Object.entries(colorMap).map(([label, color]) => ({
        label,
        color
      }))
    }

    // Generate R script
    const rScript = generateRScript(colorBy)

    // ═══════════════════════════════════════════════════════════════════════
    // Capture basemap as raster (cropped to preview rectangle, without data points)
    // ═══════════════════════════════════════════════════════════════════════
    let basemapDataUrl = null
    try {
      // Temporarily hide data layers to capture just the basemap
      const dataLayers = ['points-layer', 'points-glow', 'clusters', 'cluster-count']
      const layerVisibility = {}

      dataLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          layerVisibility[layerId] = map.getLayoutProperty(layerId, 'visibility')
          map.setLayoutProperty(layerId, 'visibility', 'none')
        }
      })

      // Wait for render
      map.triggerRepaint()
      await new Promise(resolve => map.once('idle', resolve))

      // Get preview hole pixel coordinates for cropping
      const hole = getPreviewHolePixels(map)

      // Capture full basemap canvas
      const mapCanvas = map.getCanvas()

      // Create cropped canvas with preview rectangle only
      const croppedCanvas = document.createElement('canvas')
      croppedCanvas.width = hole.width
      croppedCanvas.height = hole.height
      const ctx = croppedCanvas.getContext('2d')

      // Draw only the preview rectangle region
      ctx.drawImage(
        mapCanvas,
        hole.x, hole.y, hole.width, hole.height,  // Source: preview rectangle
        0, 0, hole.width, hole.height              // Destination: full cropped canvas
      )

      basemapDataUrl = croppedCanvas.toDataURL('image/png')

      // Restore layer visibility
      dataLayers.forEach(layerId => {
        if (map.getLayer(layerId) && layerVisibility[layerId] !== undefined) {
          map.setLayoutProperty(layerId, 'visibility', layerVisibility[layerId] || 'visible')
        }
      })

      // Wait for render to restore
      map.triggerRepaint()
      await new Promise(resolve => map.once('idle', resolve))
    } catch (e) {
      console.warn('[Export] Could not capture basemap:', e)
    }

    // Generate HTML file for exact reproduction
    const mapHTML = generateMapHTML(exportGeoJSON, viewConfig, legendConfig, colorBy)

    // Create ZIP file
    const zip = new JSZip()
    zip.file('data.geojson', JSON.stringify(exportGeoJSON, null, 2))
    zip.file('view_config.json', JSON.stringify(viewConfig, null, 2))
    zip.file('legend.json', JSON.stringify(legendConfig, null, 2))
    zip.file('generate_map.R', rScript)
    zip.file('map.html', mapHTML)
    zip.file('README.txt', generateReadme())

    // Add basemap if captured
    if (basemapDataUrl) {
      const basemapBase64 = basemapDataUrl.split(',')[1]
      zip.file('basemap.png', basemapBase64, { base64: true })
    }

    // Generate and download ZIP
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = `ithomiini_r_export_${shortHash}_${Date.now()}.zip`
    link.click()
    URL.revokeObjectURL(url)

    exportSuccess.value = true
    setTimeout(() => {
      isExporting.value = false
      exportSuccess.value = false
    }, 2000)

  } catch (e) {
    console.error('[Export] R export failed:', e)
    exportError.value = e.message || 'Export failed'
    isExporting.value = false
  }
}

// Generate R script that recreates the map view
const generateRScript = (colorBy) => {
  const isItalic = colorBy === 'species' || colorBy === 'subspecies' || colorBy === 'genus' || colorBy === 'scientific_name'
  return `# ════════════════════════════════════════════════════════════════════════════════
# Ithomiini Distribution Map - R Script for Publication-Quality Export
# Generated by Ithomiini Maps (https://fr4nzz.github.io/ithomiini_maps/)
# ════════════════════════════════════════════════════════════════════════════════
#
# This script creates a map matching the web app preview with:
#   - CartoDB Dark Matter basemap (via maptiles package)
#   - Styled legend with rounded corners
#   - Scale bar
#   - Point styling with stroke
#
# Output: PDF, PNG, and SVG files suitable for publications
# ════════════════════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────────────────
# 1. INSTALL AND LOAD PACKAGES
# ──────────────────────────────────────────────────────────────────────────────

# All required packages
packages <- c(
  "sf",           # Spatial data handling
  "ggplot2",      # Plotting
  "dplyr",        # Data manipulation (pipes, joins)
  "tidyr",        # Data tidying (replace_na)
  "jsonlite",     # Read config files
  "maptiles",     # CartoDB basemap tiles
  "tidyterra",    # Plot raster tiles with ggplot2
  "ggspatial",    # Scale bar and north arrow
  "grid",         # Custom legend grobs
  "png"           # Read fallback basemap image
)

# Install missing packages
missing <- packages[!packages %in% installed.packages()[,"Package"]]
if (length(missing) > 0) {
  cat("Installing missing packages:", paste(missing, collapse = ", "), "\\n")
  install.packages(missing)
}

# Load all packages
invisible(lapply(packages, library, character.only = TRUE))

cat("All packages loaded\\n\\n")

# ──────────────────────────────────────────────────────────────────────────────
# 2. LOAD DATA
# ──────────────────────────────────────────────────────────────────────────────

cat("Loading exported data...\\n")

# Load spatial data and configs
points <- st_read("data.geojson", quiet = TRUE)
config <- fromJSON("view_config.json")
legend_data <- fromJSON("legend.json")

# Extract map bounds
bounds <- list(
  xmin = config$bounds$west,
  xmax = config$bounds$east,
  ymin = config$bounds$south,
  ymax = config$bounds$north
)

cat(sprintf("  %d points loaded\\n", nrow(points)))
cat(sprintf("  Bounds: [%.2f, %.2f] to [%.2f, %.2f]\\n",
            bounds$xmin, bounds$ymin, bounds$xmax, bounds$ymax))

# ──────────────────────────────────────────────────────────────────────────────
# 3. LOAD BASEMAP
# ──────────────────────────────────────────────────────────────────────────────

# Available basemap providers (change in STYLE section):
#   - "CartoDB.DarkMatter"   : Dark theme (default, matches web app)
#   - "CartoDB.Positron"     : Light theme
#   - "CartoDB.Voyager"      : Colored roads
#   - "OpenStreetMap"        : Standard OSM
#   - "Esri.WorldImagery"    : Satellite imagery
#   - "Esri.WorldTopoMap"    : Topographic

# Note: STYLE is defined below, but we need basemap_provider early
# You can change this here or in the STYLE section
basemap_provider <- "CartoDB.DarkMatter"

cat(sprintf("\\nLoading basemap (%s)...\\n", basemap_provider))

# Create bounding box with small buffer for tile fetching
buffer <- 0.5
bbox_expanded <- st_bbox(c(
  xmin = bounds$xmin - buffer,
  ymin = bounds$ymin - buffer,
  xmax = bounds$xmax + buffer,
  ymax = bounds$ymax + buffer
), crs = 4326)

# Try to fetch tiles
basemap <- NULL
tryCatch({
  basemap <- get_tiles(
    st_as_sfc(bbox_expanded),
    provider = basemap_provider,
    crop = TRUE
  )
  cat("  Basemap tiles loaded successfully\\n")
}, error = function(e) {
  cat(sprintf("  Could not fetch tiles: %s\\n", e$message))
  cat("  Falling back to exported basemap.png\\n")
})

# Fallback to PNG if tiles failed
basemap_png <- NULL
if (is.null(basemap) && file.exists("basemap.png")) {
  basemap_png <- readPNG("basemap.png")
  cat("  Loaded basemap.png fallback\\n")
}

# ──────────────────────────────────────────────────────────────────────────────
# 4. PREPARE LEGEND DATA
# ──────────────────────────────────────────────────────────────────────────────

# Create legend dataframe from exported items (already has label + color)
legend_df <- as.data.frame(legend_data$items) %>%
  left_join(
    points %>%
      st_drop_geometry() %>%
      count(display_color, name = "n"),
    by = c("color" = "display_color")
  ) %>%
  replace_na(list(n = 0)) %>%
  arrange(desc(n))

cat(sprintf("\\nLegend: %d categories\\n", nrow(legend_df)))

# ──────────────────────────────────────────────────────────────────────────────
# 5. STYLING CONFIGURATION (easy to customize!)
# ──────────────────────────────────────────────────────────────────────────────

STYLE <- list(
  # Background
  bg_color = "#1a1a2e",

  # Basemap - options: "CartoDB.DarkMatter", "CartoDB.Positron", "CartoDB.Voyager",
  #                    "OpenStreetMap", "Esri.WorldImagery", "Esri.WorldTopoMap"
  basemap_provider = "CartoDB.DarkMatter",

  # Points
  point_size = 2.5,
  point_alpha = 0.85,
  point_stroke_color = "white",
  point_stroke_alpha = 0.3,
  point_stroke_width = 0.5,

  # Legend
  legend_bg = "#252540",
  legend_bg_alpha = 0.95,    # Transparency (0 = transparent, 1 = opaque)
  legend_border = "#3d3d5c",
  legend_title_color = "#888888",
  legend_text_color = "#e0e0e0",
  legend_max_items = 15,
  legend_font_size = 8,
  legend_title_size = 10,
  legend_width = 0.22,
  legend_padding = 0.015,
  legend_item_height = 0.028,

  # Scale bar
  scale_bar_color = "#e0e0e0",

  # Output
  width = 16,
  height = 9,
  dpi = 300
)

# ──────────────────────────────────────────────────────────────────────────────
# 6. CREATE LEGEND GROB (with rounded corners)
# ──────────────────────────────────────────────────────────────────────────────

create_legend <- function(items, title, italic = FALSE, style = STYLE) {
  n_items <- min(nrow(items), style$legend_max_items)
  has_more <- nrow(items) > style$legend_max_items

  # Calculate dimensions
  title_h <- style$legend_item_height * 1.8
  content_h <- n_items * style$legend_item_height
  more_h <- if (has_more) style$legend_item_height * 1.2 else 0
  total_h <- title_h + content_h + more_h + style$legend_padding * 3

  # Find max label width (approximate)
  max_label_len <- max(nchar(items$label[1:n_items]))
  legend_w <- max(style$legend_width, 0.01 * max_label_len + 0.06)

  # Position (bottom-left with padding)
  x0 <- 0.02
  y0 <- 0.08

  grobs <- list()

  # Background with rounded corners
  grobs$bg <- roundrectGrob(
    x = x0, y = y0,
    width = legend_w, height = total_h,
    just = c("left", "bottom"),
    r = unit(8, "pt"),
    gp = gpar(
      fill = alpha(style$legend_bg, style$legend_bg_alpha),
      col = style$legend_border,
      lwd = 1
    )
  )

  # Title
  grobs$title <- textGrob(
    toupper(title),
    x = x0 + style$legend_padding,
    y = y0 + total_h - style$legend_padding - title_h/2,
    just = c("left", "center"),
    gp = gpar(
      col = style$legend_title_color,
      fontsize = style$legend_title_size,
      fontface = "bold"
    )
  )

  # Legend items
  for (i in seq_len(n_items)) {
    item_y <- y0 + total_h - title_h - style$legend_padding - (i - 0.5) * style$legend_item_height

    # Color dot with white stroke
    grobs[[paste0("dot_", i)]] <- circleGrob(
      x = x0 + style$legend_padding + 0.012,
      y = item_y,
      r = 0.006,
      gp = gpar(
        fill = items$color[i],
        col = alpha("white", 0.3),
        lwd = 0.5
      )
    )

    # Label
    grobs[[paste0("label_", i)]] <- textGrob(
      items$label[i],
      x = x0 + style$legend_padding + 0.028,
      y = item_y,
      just = c("left", "center"),
      gp = gpar(
        col = style$legend_text_color,
        fontsize = style$legend_font_size,
        fontface = if (italic) "italic" else "plain"
      )
    )
  }

  # "More" indicator if truncated
  if (has_more) {
    grobs$more <- textGrob(
      sprintf("+ %d more...", nrow(items) - style$legend_max_items),
      x = x0 + style$legend_padding,
      y = y0 + style$legend_padding + more_h/2,
      just = c("left", "center"),
      gp = gpar(
        col = style$legend_title_color,
        fontsize = style$legend_font_size - 1,
        fontface = "italic"
      )
    )
  }

  do.call(grobTree, grobs)
}

# ──────────────────────────────────────────────────────────────────────────────
# 7. BUILD THE MAP
# ──────────────────────────────────────────────────────────────────────────────

cat("\\nCreating map...\\n")

# Start building the plot
p <- ggplot()

# Add basemap layer
if (!is.null(basemap)) {
  p <- p + geom_spatraster_rgb(data = basemap)
} else if (!is.null(basemap_png)) {
  p <- p + annotation_raster(
    basemap_png,
    xmin = bounds$xmin, xmax = bounds$xmax,
    ymin = bounds$ymin, ymax = bounds$ymax
  )
}

# Add data points with stroke (matching web app style)
p <- p +
  geom_sf(
    data = points,
    aes(fill = display_color),
    color = alpha(STYLE$point_stroke_color, STYLE$point_stroke_alpha),
    size = STYLE$point_size,
    alpha = STYLE$point_alpha,
    stroke = STYLE$point_stroke_width,
    shape = 21
  ) +
  scale_fill_identity()

# Set coordinate system and bounds
p <- p +
  coord_sf(
    xlim = c(bounds$xmin, bounds$xmax),
    ylim = c(bounds$ymin, bounds$ymax),
    expand = FALSE
  )

# Add scale bar using ggspatial
p <- p +
  annotation_scale(
    location = "br",
    width_hint = 0.15,
    style = "ticks",
    text_col = STYLE$scale_bar_color,
    line_col = STYLE$scale_bar_color,
    pad_x = unit(0.5, "cm"),
    pad_y = unit(0.5, "cm")
  )

# Apply theme
p <- p +
  theme_void() +
  theme(
    plot.background = element_rect(fill = STYLE$bg_color, color = NA),
    panel.background = element_rect(fill = STYLE$bg_color, color = NA)
  )

# Add custom legend
p_final <- p +
  annotation_custom(
    create_legend(legend_df, legend_data$title, ${isItalic ? 'TRUE' : 'FALSE'}),
    xmin = -Inf, xmax = Inf, ymin = -Inf, ymax = Inf
  )

# ──────────────────────────────────────────────────────────────────────────────
# 8. SAVE OUTPUTS
# ──────────────────────────────────────────────────────────────────────────────

cat("\\nSaving outputs...\\n")

# Preview in RStudio
print(p_final)

# Save as PDF (vector graphics for publications)
ggsave("ithomiini_map.pdf", plot = p_final,
       width = STYLE$width, height = STYLE$height, dpi = STYLE$dpi)
cat("  ithomiini_map.pdf\\n")

# Save as high-resolution PNG
ggsave("ithomiini_map.png", plot = p_final,
       width = STYLE$width, height = STYLE$height, dpi = STYLE$dpi)
cat("  ithomiini_map.png\\n")

# Save as SVG (editable vector)
ggsave("ithomiini_map.svg", plot = p_final,
       width = STYLE$width, height = STYLE$height, dpi = STYLE$dpi)
cat("  ithomiini_map.svg\\n")

cat("\\n════════════════════════════════════════════════════════════════════════════════\\n")
cat("Export complete!\\n")
cat("\\nOutput files:\\n")
cat("  ithomiini_map.pdf - Vector PDF for publications\\n")
cat("  ithomiini_map.png - High-resolution raster (300 DPI)\\n")
cat("  ithomiini_map.svg - Editable vector (Adobe Illustrator/Inkscape)\\n")
cat("\\nTip: Edit the STYLE list above to customize colors, sizes, and layout.\\n")
cat("════════════════════════════════════════════════════════════════════════════════\\n")
`
}


// Generate README for the ZIP
const generateReadme = () => {
  return `═══════════════════════════════════════════════════════════════════════════
ITHOMIINI MAPS - R EXPORT PACKAGE
═══════════════════════════════════════════════════════════════════════════

This ZIP contains data and scripts to recreate your map view as true
vector graphics (SVG/PDF) for publications.

FILES INCLUDED:
---------------
- data.geojson      : Filtered specimen data with pre-computed colors
- view_config.json  : Map view bounds and settings
- legend.json       : Legend colors and labels
- basemap.png       : Exact basemap from web app (CartoDB Dark tiles)
- map.html          : Standalone HTML file (EXACT reproduction of web preview)
- generate_map.R    : R script to recreate the map
- README.txt        : This file

QUICK START:
------------
1. Extract all files to a folder
2. Open R or RStudio
3. Set working directory to the extracted folder
4. Run: source("generate_map.R")
5. Find your exports in the folder

OUTPUT FILES:
-------------
- ithomiini_map.pdf : Vector PDF for publications
- ithomiini_map.png : High-resolution raster (300 DPI)
- ithomiini_map.svg : Editable vector (Adobe Illustrator/Inkscape)

REQUIREMENTS:
-------------
All packages will auto-install if missing:
- sf               : Spatial data handling
- ggplot2          : Plotting
- dplyr            : Data manipulation
- tidyr            : Data tidying
- jsonlite         : Reading config files
- maptiles         : CartoDB Dark Matter basemap tiles
- tidyterra        : Plot raster tiles with ggplot2
- ggspatial        : Scale bar
- grid             : Custom legend rendering
- png              : Read fallback basemap image

VIEWING IN BROWSER (map.html):
------------------------------
The map.html file is a standalone HTML file that renders identically to the
web app preview. You can open it directly in any browser to view and interact
with the map.

WHY R?
------
The web map uses WebGL rendering which produces raster (pixel) output.
R with ggplot2 renders true vectors, giving you:
- Infinite scalability for any print size
- Small file sizes
- Editable in Adobe Illustrator/Inkscape
- Publication-quality output

CUSTOMIZATION:
--------------
Edit the STYLE list in generate_map.R to easily customize:
- Point size, color, and transparency
- Legend position, size, and max items shown
- Background and text colors
- Scale bar styling
- Output dimensions and DPI

The script is well-documented and uses tidyverse conventions for
easy modification.

CITATION:
---------
${citationText.value}

SOURCE:
-------
https://fr4nzz.github.io/ithomiini_maps/

Generated: ${new Date().toISOString()}
Version: ${shortHash}
═══════════════════════════════════════════════════════════════════════════
`
}

// Generate standalone HTML file that renders exact same map as web app
const generateMapHTML = (geoJSON, viewConfig, legendConfig, colorBy) => {
  const isItalic = colorBy === 'species' || colorBy === 'subspecies' || colorBy === 'genus' || colorBy === 'scientific_name'
  const legendItems = legendConfig.items || []

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ithomiini Distribution Map</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"><\/script>
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100vw; height: 100vh; }

    /* Legend - matches web app exactly */
    .legend {
      position: absolute;
      bottom: 40px;
      left: 20px;
      background: rgba(37, 37, 64, 0.95);
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      padding: 12px;
      max-height: 60vh;
      overflow-y: auto;
      min-width: 180px;
      z-index: 1000;
    }
    .legend-title {
      color: #888888;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
    }
    .legend-color {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-label {
      color: #e0e0e0;
      font-size: 12px;
      ${isItalic ? 'font-style: italic;' : ''}
    }

    /* Scale bar */
    .maplibregl-ctrl-scale {
      background: rgba(37, 37, 64, 0.9) !important;
      color: #e0e0e0 !important;
      border-color: #e0e0e0 !important;
      font-size: 11px !important;
    }

    /* Hide attribution for cleaner export */
    .maplibregl-ctrl-attrib { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="legend">
    <div class="legend-title">${legendConfig.title || colorBy}</div>
    ${legendItems.map(item => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${item.color}"></div>
      <span class="legend-label">${item.label}</span>
    </div>
    `).join('')}
  </div>

  <script>
    // GeoJSON data embedded
    const geoData = ${JSON.stringify(geoJSON)};

    // View config
    const config = ${JSON.stringify(viewConfig)};

    // Initialize map
    const map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256,
            attribution: '© CartoDB © OpenStreetMap'
          }
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 22
        }]
      },
      center: [config.center.lng, config.center.lat],
      zoom: config.zoom,
      preserveDrawingBuffer: true // Required for canvas export
    });

    // Add scale bar
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      // Add data source
      map.addSource('points', {
        type: 'geojson',
        data: geoData
      });

      // Add points layer with exact colors from web app
      map.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'display_color'],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.3)'
        }
      });

      // Fit to bounds
      map.fitBounds([
        [config.bounds.west, config.bounds.south],
        [config.bounds.east, config.bounds.north]
      ], { padding: 20, duration: 0 });
    });
  <\/script>
</body>
</html>`
}

// Active tab - use prop as initial value
const activeTab = ref(props.initialTab || 'export')
</script>

<template>
  <div class="export-panel">
    <!-- Header -->
    <div class="panel-header">
      <h3>Export & Citation</h3>
      <button class="btn-close" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="panel-tabs">
      <button
        :class="{ active: activeTab === 'export' }"
        @click="activeTab = 'export'"
      >
        Export Data
      </button>
      <button
        :class="{ active: activeTab === 'citation' }"
        @click="activeTab = 'citation'"
      >
        Citation
      </button>
    </div>

    <!-- Content -->
    <div class="panel-content">

      <!-- Export Data Tab -->
      <div v-if="activeTab === 'export'" class="tab-content">
        <div class="data-summary">
          <div class="summary-item">
            <span class="summary-value">{{ filteredData.length.toLocaleString() }}</span>
            <span class="summary-label">Records</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ shortHash }}</span>
            <span class="summary-label">Version</span>
          </div>
        </div>

        <div class="export-options">
          <button
            class="export-btn"
            @click="exportCSV"
            :disabled="isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Download CSV</span>
              <span class="btn-desc">Spreadsheet format</span>
            </div>
          </button>

          <button
            class="export-btn"
            @click="exportGeoJSON"
            :disabled="isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Download GeoJSON</span>
              <span class="btn-desc">GIS/mapping format</span>
            </div>
          </button>

          <!-- R Export Button for True Vector Output -->
          <button
            class="export-btn r-export"
            @click="exportForR"
            :disabled="!map || isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Export for R (Vector)</span>
              <span class="btn-desc">ZIP with GeoJSON + R script for SVG/PDF</span>
            </div>
          </button>
        </div>

        <Transition name="fade">
          <div v-if="exportSuccess && activeTab === 'export'" class="success-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Export complete!
          </div>
        </Transition>
      </div>

      <!-- Citation Tab -->
      <div v-if="activeTab === 'citation'" class="tab-content">
        <div class="citation-section">
          <label class="citation-label">Plain Text</label>
          <div class="citation-box">
            <p class="citation-text">{{ citationText }}</p>
            <button
              class="copy-btn"
              @click="copyCitation('plain')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div class="citation-section">
          <label class="citation-label">BibTeX</label>
          <div class="citation-box bibtex">
            <pre class="citation-code">{{ bibtexCitation }}</pre>
            <button
              class="copy-btn"
              @click="copyCitation('bibtex')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div class="citation-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <p>
            Citations include a version hash for reproducibility.
            The URL preserves your current filter settings.
          </p>
        </div>

        <Transition name="fade">
          <div v-if="citationCopied" class="success-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Citation copied!
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  background: var(--color-bg-secondary, #252540);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 420px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.panel-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  margin: 0;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-close svg {
  width: 18px;
  height: 18px;
}

/* Tabs */
.panel-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: var(--color-bg-primary, #1a1a2e);
}

.panel-tabs button {
  flex: 1;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-tabs button:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
}

.panel-tabs button.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
}

/* Data Summary */
.data-summary {
  display: flex;
  gap: 16px;
}

.summary-item {
  flex: 1;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.summary-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent, #4ade80);
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Option Groups */
.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-secondary, #aaa);
}

.option-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
}

/* Format Buttons */
.format-buttons,
.dpi-buttons {
  display: flex;
  gap: 8px;
}

.format-buttons button,
.dpi-buttons button {
  flex: 1;
  padding: 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.format-buttons button:hover,
.dpi-buttons button:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.format-buttons button.active,
.dpi-buttons button.active {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

/* Select Input */
.select-input {
  padding: 10px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
}

.select-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

/* Custom Size */
.custom-size .size-inputs {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.size-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.size-input label {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
}

.size-input input {
  padding: 8px 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
}

.size-input input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.size-separator {
  color: var(--color-text-muted, #666);
  font-size: 1.2rem;
  padding-bottom: 8px;
}

/* Export Options */
.export-options,
.export-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.export-btn:hover:not(:disabled) {
  background: #353558;
  border-color: var(--color-accent, #4ade80);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn svg {
  width: 24px;
  height: 24px;
  color: var(--color-accent, #4ade80);
  flex-shrink: 0;
}

.export-btn.r-export {
  border-color: #6366f1;
}

.export-btn.r-export svg {
  color: #6366f1;
}

.export-btn.r-export:hover:not(:disabled) {
  border-color: #818cf8;
}

.btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-title {
  font-size: 0.95rem;
  font-weight: 500;
}

.btn-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
}

/* Export Image Button */
.export-image-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 8px;
  color: var(--color-bg-primary, #1a1a2e);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.export-image-btn:hover:not(:disabled) {
  background: #5eeb94;
}

.export-image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-image-btn svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.export-image-btn .btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.export-image-btn .btn-title {
  font-size: 1rem;
  font-weight: 600;
}

.export-image-btn .btn-desc {
  font-size: 0.8rem;
  opacity: 0.8;
}

/* Citation Section */
.citation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.citation-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.citation-box {
  position: relative;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 14px;
  padding-right: 70px;
}

.citation-text {
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
  line-height: 1.6;
  margin: 0;
  word-break: break-word;
}

.citation-box.bibtex {
  padding-right: 14px;
  padding-bottom: 50px;
}

.citation-code {
  font-family: var(--font-family-mono, monospace);
  font-size: 0.75rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.citation-box.bibtex .copy-btn {
  top: auto;
  bottom: 10px;
}

.copy-btn:hover {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-accent, #4ade80);
}

.copy-btn svg {
  width: 12px;
  height: 12px;
}

/* Citation Info */
.citation-info {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
}

.citation-info svg {
  width: 18px;
  height: 18px;
  color: var(--color-accent, #4ade80);
  flex-shrink: 0;
  margin-top: 2px;
}

.citation-info p {
  margin: 0;
  line-height: 1.5;
}

/* Success Toast */
.success-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
}

.success-toast svg {
  width: 18px;
  height: 18px;
}

/* Error */
.export-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
}

.export-error svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 480px) {
  .export-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    max-height: 100vh;
  }

  .data-summary {
    flex-direction: column;
  }

  .format-buttons,
  .dpi-buttons {
    flex-wrap: wrap;
  }

  .format-buttons button,
  .dpi-buttons button {
    min-width: calc(33% - 8px);
  }
}
</style>
