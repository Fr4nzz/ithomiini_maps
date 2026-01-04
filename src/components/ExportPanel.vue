<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import JSZip from 'jszip'

const store = useDataStore()
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

    // Get current map view
    const bounds = map.getBounds()
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

    // View configuration
    const viewConfig = {
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth()
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
    // Capture basemap as raster (without data points)
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

      // Capture basemap
      const mapCanvas = map.getCanvas()
      basemapDataUrl = mapCanvas.toDataURL('image/png')

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

    // Create ZIP file
    const zip = new JSZip()
    zip.file('data.geojson', JSON.stringify(exportGeoJSON, null, 2))
    zip.file('view_config.json', JSON.stringify(viewConfig, null, 2))
    zip.file('legend.json', JSON.stringify(legendConfig, null, 2))
    zip.file('generate_map.R', rScript)
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
  return `# ═══════════════════════════════════════════════════════════════════════════
# Ithomiini Distribution Map - R Script for Vector Export
# Generated by Ithomiini Maps (https://fr4nzz.github.io/ithomiini_maps/)
# ═══════════════════════════════════════════════════════════════════════════

# Install required packages if needed
required_packages <- c("sf", "ggplot2", "jsonlite", "png", "grid", "terra")
new_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if(length(new_packages)) install.packages(new_packages)

library(sf)
library(ggplot2)
library(jsonlite)
library(png)
library(grid)
library(terra)

# ═══════════════════════════════════════════════════════════════════════════
# Load exported data
# ═══════════════════════════════════════════════════════════════════════════

# Read the exported files
points <- st_read("data.geojson", quiet = TRUE)
config <- fromJSON("view_config.json")
legend_data <- fromJSON("legend.json")

# Extract bounds
xlim <- c(config$bounds$west, config$bounds$east)
ylim <- c(config$bounds$south, config$bounds$north)

# ═══════════════════════════════════════════════════════════════════════════
# Load basemap - try maptiles (CartoDB Dark Matter), then fallback to PNG
# ═══════════════════════════════════════════════════════════════════════════

basemap_rast <- NULL
use_maptiles <- FALSE

# Option 1: Try maptiles package (can fetch fresh CartoDB Dark Matter tiles)
# This allows you to pan/zoom to different areas
if (require("maptiles", quietly = TRUE)) {
  cat("Using maptiles package for CartoDB Dark Matter basemap...\\n")
  tryCatch({
    # Create bounding box for tile download
    bbox <- st_bbox(c(xmin = xlim[1], ymin = ylim[1], xmax = xlim[2], ymax = ylim[2]), crs = 4326)
    bbox_sf <- st_as_sfc(bbox)

    # Download CartoDB Dark Matter tiles (same as web app!)
    basemap_rast <- get_tiles(bbox_sf, provider = "CartoDB.DarkMatter", crop = TRUE, zoom = NULL)
    use_maptiles <- TRUE
    cat("Successfully loaded CartoDB Dark Matter tiles\\n")
  }, error = function(e) {
    cat(paste("Could not fetch tiles:", e$message, "\\n"))
  })
}

# Option 2: Fall back to exported PNG (exact screenshot from web app)
basemap_png <- NULL
if (!use_maptiles && file.exists("basemap.png")) {
  basemap_png <- readPNG("basemap.png")
  cat("Loaded basemap.png (exact export from web app)\\n")
}

# Option 3: Will use Natural Earth vector basemap if neither works
if (!use_maptiles && is.null(basemap_png)) {
  cat("No basemap available - will use Natural Earth vector countries\\n")
}

# ═══════════════════════════════════════════════════════════════════════════
# Prepare legend data
# ═══════════════════════════════════════════════════════════════════════════

# Get legend items from exported config
legend_items <- data.frame(
  label = names(unlist(legend_data$colors)),
  color = unlist(legend_data$colors),
  stringsAsFactors = FALSE
)

cat(paste("Legend has", nrow(legend_items), "items\\n"))

# ═══════════════════════════════════════════════════════════════════════════
# Create the map with basemap background
# ═══════════════════════════════════════════════════════════════════════════

# Load tidyterra for plotting SpatRaster with ggplot2 (if using maptiles)
if (use_maptiles) {
  if (!require("tidyterra", quietly = TRUE)) install.packages("tidyterra")
  library(tidyterra)
}

# Start with base plot
p <- ggplot() +
  theme_void() +
  theme(
    panel.background = element_rect(fill = "#1a1a2e", color = NA),
    plot.background = element_rect(fill = "#1a1a2e", color = NA)
  )

# Add basemap based on what's available
if (use_maptiles && !is.null(basemap_rast)) {
  # Use maptiles raster (CartoDB Dark Matter - same as web app!)
  p <- p + geom_spatraster_rgb(data = basemap_rast)
} else if (!is.null(basemap_png)) {
  # Use exported PNG from web app
  p <- p + annotation_raster(basemap_png, xmin = xlim[1], xmax = xlim[2], ymin = ylim[1], ymax = ylim[2])
}

# Add data points using display_color (pre-computed exact colors from web app)
# This ensures colors match exactly regardless of colorBy field
p <- p +
  geom_sf(data = points, aes(color = display_color), size = 2, alpha = 0.8) +
  scale_color_identity() +  # Use colors as-is (they're already correct hex values)
  coord_sf(xlim = xlim, ylim = ylim, expand = FALSE)

# ═══════════════════════════════════════════════════════════════════════════
# Create custom legend (since scale_color_identity doesn't make one)
# ═══════════════════════════════════════════════════════════════════════════

# Function to create legend as a grob
create_legend_grob <- function(items, title, is_italic = FALSE) {
  n <- nrow(items)
  row_height <- 0.035
  title_height <- 0.05
  padding <- 0.02

  # Calculate legend dimensions
  max_items <- min(n, 25)  # Limit displayed items
  legend_height <- title_height + max_items * row_height + padding * 2
  legend_width <- 0.20

  # Start y position (top of legend content area)
  start_y <- 0.98

  # Background rectangle
  grobs <- list(
    rectGrob(
      x = 0.01, y = start_y - legend_height/2,
      width = legend_width, height = legend_height,
      just = c("left", "center"),
      gp = gpar(fill = alpha("#252540", 0.95), col = "#3d3d5c", lwd = 1)
    )
  )

  # Title
  grobs <- c(grobs, list(
    textGrob(
      title,
      x = 0.01 + padding,
      y = start_y - padding - 0.01,
      just = c("left", "top"),
      gp = gpar(col = "#888888", fontsize = 9, fontface = "bold")
    )
  ))

  # Legend items
  for (i in 1:max_items) {
    item_y <- start_y - title_height - padding - (i - 0.5) * row_height

    # Color circle
    grobs <- c(grobs, list(
      circleGrob(
        x = 0.01 + padding + 0.01,
        y = item_y,
        r = 0.006,
        gp = gpar(fill = items\$color[i], col = NA)
      )
    ))

    # Label text
    grobs <- c(grobs, list(
      textGrob(
        items\$label[i],
        x = 0.01 + padding + 0.03,
        y = item_y,
        just = c("left", "center"),
        gp = gpar(
          col = "#e0e0e0",
          fontsize = 7,
          fontface = if(is_italic) "italic" else "plain"
        )
      )
    ))
  }

  # Show count if truncated
  if (n > max_items) {
    grobs <- c(grobs, list(
      textGrob(
        paste0("+ ", n - max_items, " more..."),
        x = 0.01 + padding,
        y = start_y - legend_height + padding,
        just = c("left", "bottom"),
        gp = gpar(col = "#888888", fontsize = 6, fontface = "italic")
      )
    ))
  }

  do.call(grobTree, grobs)
}

# Add legend to plot
p_with_legend <- p +
  annotation_custom(
    create_legend_grob(legend_items, legend_data\$title, ${isItalic ? 'TRUE' : 'FALSE'}),
    xmin = -Inf, xmax = Inf, ymin = -Inf, ymax = Inf
  )

# Print preview
print(p_with_legend)

# ═══════════════════════════════════════════════════════════════════════════
# Save outputs
# ═══════════════════════════════════════════════════════════════════════════

# Save as PDF (raster basemap + vector points)
ggsave("ithomiini_map.pdf", plot = p_with_legend, width = 16, height = 9, dpi = 300)
cat("Saved: ithomiini_map.pdf\\n")

# Save as high-resolution PNG
ggsave("ithomiini_map.png", plot = p_with_legend, width = 16, height = 9, dpi = 300)
cat("Saved: ithomiini_map.png\\n")

# ═══════════════════════════════════════════════════════════════════════════
# Alternative: Pure vector version with Natural Earth basemap
# ═══════════════════════════════════════════════════════════════════════════

cat("\\nCreating pure vector version...\\n")

# Install rnaturalearth if needed
if (!require("rnaturalearth", quietly = TRUE)) {
  install.packages(c("rnaturalearth", "rnaturalearthdata"))
}
library(rnaturalearth)
library(rnaturalearthdata)

world <- ne_countries(scale = "medium", returnclass = "sf")

p_vector <- ggplot() +
  geom_sf(data = world, fill = "#1a1a2e", color = "#3d3d5c", linewidth = 0.3) +
  geom_sf(data = points, aes(color = display_color), size = 2, alpha = 0.8) +
  scale_color_identity() +
  coord_sf(xlim = xlim, ylim = ylim, expand = FALSE) +
  theme_void() +
  theme(
    panel.background = element_rect(fill = "#1a1a2e", color = NA),
    plot.background = element_rect(fill = "#1a1a2e", color = NA)
  ) +
  annotation_custom(
    create_legend_grob(legend_items, legend_data\$title, ${isItalic ? 'TRUE' : 'FALSE'}),
    xmin = -Inf, xmax = Inf, ymin = -Inf, ymax = Inf
  )

# Save pure vector versions
ggsave("ithomiini_map_vector.svg", plot = p_vector, width = 16, height = 9, dpi = 300)
ggsave("ithomiini_map_vector.pdf", plot = p_vector, width = 16, height = 9, dpi = 300)
cat("Saved: ithomiini_map_vector.svg/pdf (pure vector)\\n")

# ═══════════════════════════════════════════════════════════════════════════
# Light theme version
# ═══════════════════════════════════════════════════════════════════════════

create_legend_grob_light <- function(items, title, is_italic = FALSE) {
  n <- nrow(items)
  row_height <- 0.035
  title_height <- 0.05
  padding <- 0.02
  max_items <- min(n, 25)
  legend_height <- title_height + max_items * row_height + padding * 2
  legend_width <- 0.20
  start_y <- 0.98

  grobs <- list(
    rectGrob(x = 0.01, y = start_y - legend_height/2, width = legend_width, height = legend_height,
             just = c("left", "center"), gp = gpar(fill = alpha("#ffffff", 0.95), col = "#cccccc", lwd = 1))
  )
  grobs <- c(grobs, list(
    textGrob(title, x = 0.01 + padding, y = start_y - padding - 0.01, just = c("left", "top"),
             gp = gpar(col = "#666666", fontsize = 9, fontface = "bold"))
  ))
  for (i in 1:max_items) {
    item_y <- start_y - title_height - padding - (i - 0.5) * row_height
    grobs <- c(grobs, list(
      circleGrob(x = 0.01 + padding + 0.01, y = item_y, r = 0.006, gp = gpar(fill = items\$color[i], col = NA)),
      textGrob(items\$label[i], x = 0.01 + padding + 0.03, y = item_y, just = c("left", "center"),
               gp = gpar(col = "#333333", fontsize = 7, fontface = if(is_italic) "italic" else "plain"))
    ))
  }
  if (n > max_items) {
    grobs <- c(grobs, list(textGrob(paste0("+ ", n - max_items, " more..."), x = 0.01 + padding,
                                     y = start_y - legend_height + padding, just = c("left", "bottom"),
                                     gp = gpar(col = "#888888", fontsize = 6, fontface = "italic"))))
  }
  do.call(grobTree, grobs)
}

p_light <- ggplot() +
  geom_sf(data = world, fill = "#f8f8f8", color = "#cccccc", linewidth = 0.3) +
  geom_sf(data = points, aes(color = display_color), size = 2, alpha = 0.8) +
  scale_color_identity() +
  coord_sf(xlim = xlim, ylim = ylim, expand = FALSE) +
  theme_void() +
  theme(
    panel.background = element_rect(fill = "#ffffff", color = NA),
    plot.background = element_rect(fill = "#ffffff", color = NA)
  ) +
  annotation_custom(
    create_legend_grob_light(legend_items, legend_data\$title, ${isItalic ? 'TRUE' : 'FALSE'}),
    xmin = -Inf, xmax = Inf, ymin = -Inf, ymax = Inf
  )

ggsave("ithomiini_map_light.svg", plot = p_light, width = 16, height = 9, dpi = 300)
ggsave("ithomiini_map_light.pdf", plot = p_light, width = 16, height = 9, dpi = 300)
cat("Saved: ithomiini_map_light.svg/pdf\\n")

cat("\\n✅ All exports complete!\\n")
cat("\\nOutput files:\\n")
cat("  - ithomiini_map.pdf/png       : Web basemap (raster) + vector points\\n")
cat("  - ithomiini_map_vector.svg/pdf: Pure vector (Natural Earth basemap)\\n")
cat("  - ithomiini_map_light.svg/pdf : Light theme version\\n")
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
- ithomiini_map.pdf/png        : Raster basemap + vector points (matches web)
- ithomiini_map_vector.svg/pdf : Pure vector (Natural Earth basemap)
- ithomiini_map_light.svg/pdf  : Light theme version

REQUIREMENTS:
-------------
R packages (will auto-install if missing):
- sf               : Spatial data handling
- ggplot2          : Plotting
- png              : Read basemap image
- grid             : Custom legend rendering
- jsonlite         : Reading config files
- terra            : Raster handling
- rnaturalearth    : Country boundaries (for pure vector version)

OPTIONAL (recommended):
- maptiles         : Fetches CartoDB Dark Matter tiles directly (same as web app!)
- tidyterra        : Plots maptiles rasters with ggplot2

To install maptiles: install.packages("maptiles")
This allows you to pan/zoom the map in R and still get the exact same basemap!

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
Edit generate_map.R to:
- Change point sizes, colors, or transparency
- Modify legend position or styling
- Add titles, scale bars, or annotations
- Change output dimensions or DPI

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
