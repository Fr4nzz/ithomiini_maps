# Ithomiini Maps - Comprehensive Coding Plan

## Overview

This document outlines the implementation plan for all requested features based on extensive research. Each section provides multiple options where applicable, allowing you to choose the best approach.

---

## 1. Legend Filtering (Show Only Selected Species)

### Problem
Currently, the legend shows ALL unique values from the dataset, not just the filtered/selected items. When you select 5 species, the legend should only show those 5 species.

### Root Cause
In `src/stores/data.js`, the `activeColorMap` computed property generates colors based on `uniqueSubspecies.value` (or similar), which derives from the cascading filter subset, but still includes ALL matching values - not just what's visible on the map.

### Solution
Modify `activeColorMap` to derive colors from the actual **displayed data** (`displayGeoJSON`), not from the filter options.

### Implementation

**File:** `src/stores/data.js`

```javascript
// NEW computed property for legend color map
const legendColorMap = computed(() => {
  const geo = displayGeoJSON.value
  if (!geo || !geo.features) return {}

  const mode = colorBy.value
  const attr = colorByAttribute.value

  // Get unique values from DISPLAYED data only
  const uniqueValues = [...new Set(
    geo.features
      .map(f => f.properties[attr])
      .filter(v => v && v !== 'Unknown' && v !== 'NA')
  )].sort()

  // Use predefined palettes for status and source
  if (mode === 'status') {
    const filtered = {}
    for (const val of uniqueValues) {
      if (STATUS_COLORS[val]) filtered[val] = STATUS_COLORS[val]
    }
    return filtered
  }

  if (mode === 'source') {
    const filtered = {}
    for (const val of uniqueValues) {
      if (SOURCE_COLORS[val]) filtered[val] = SOURCE_COLORS[val]
    }
    return filtered
  }

  // Generate dynamic palette for displayed values only
  return generateColorPalette(uniqueValues)
})
```

**Effort:** Low (2-4 hours)
**Risk:** Low

---

## 2. Country Boundaries on Satellite Map

### Problem
The satellite map view only shows raster imagery without country boundaries.

### Options

#### Option A: Add Vector Boundary Overlay Layer (Recommended)
Add a GeoJSON or vector tile layer with country boundaries that displays on top of any base map.

**Data Sources:**
1. **Natural Earth** (1:10m scale) - Free, public domain
   - GitHub: [martynafford/natural-earth-geojson](https://github.com/martynafford/natural-earth-geojson)
   - Direct download: ~2MB GeoJSON

2. **geoBoundaries** - CC-BY 4.0 license
   - Download from: [mapscaping.com/country-boundary-viewer](https://mapscaping.com/country-boundary-viewer/)

3. **OpenMapTiles** - Bundled with vector styles

**Implementation:**
```javascript
// In useMapEngine.js - add after satellite layer
const addBoundariesLayer = (map) => {
  map.addSource('country-boundaries', {
    type: 'geojson',
    data: '/data/countries.geojson'  // ~500KB simplified
  })

  map.addLayer({
    id: 'country-boundaries-line',
    type: 'line',
    source: 'country-boundaries',
    paint: {
      'line-color': 'rgba(255, 255, 255, 0.5)',
      'line-width': 1
    }
  })
}
```

**Effort:** Low-Medium (4-6 hours)
**Pros:** Simple, no API keys, works offline
**Cons:** Need to bundle GeoJSON file (~500KB-2MB)

#### Option B: Use MapTiler Satellite with Boundaries
Switch satellite provider to one that includes boundaries.

**Effort:** Low (2 hours)
**Cons:** Requires API key, usage limits

### Recommendation
**Option A** - Bundle simplified Natural Earth GeoJSON. One-time 500KB addition, no API dependencies.

---

## 3. Map Layer Providers (Dropdown with Day/Night Themes)

### Current State
5 button-style providers: Dark, Light, Satellite, Terrain, Streets

### Proposed Architecture

#### Provider List (Sorted by Recommendation)

| Provider | Style | Day/Night | Free Tier | API Key Required |
|----------|-------|-----------|-----------|------------------|
| **Stadia Maps** | Alidade Smooth | Both | 2,500 credits/mo | Yes (free) |
| **Stadia Maps** | Alidade Smooth Dark | Night only | Included | Yes |
| **Stadia Maps** | Stamen Terrain | Day | Included | Yes |
| **MapTiler** | Streets | Both | 100k loads/mo | Yes (free) |
| **MapTiler** | Satellite | Day | Included | Yes |
| **CartoDB** | Positron | Day | Unlimited | No |
| **CartoDB** | Dark Matter | Night | Unlimited | No |
| **OpenStreetMap** | Standard | Day | Unlimited* | No |
| **OpenTopoMap** | Topo | Day | Unlimited* | No |
| **Esri** | World Imagery | Satellite | Unlimited* | No |

*Subject to fair use policies

### Google Maps Analysis

**Terms of Use Issues:**
- After March 1, 2025: Only 10,000 free loads/month for Maps JavaScript API
- **Attribution requirement:** Must display Google logo/attribution
- **Restriction:** Cannot use for static exports or screenshots without permission
- **Restriction:** Cannot overlay on non-Google base maps

**Recommendation:** **DO NOT use Google Maps** due to:
1. Limited free tier (10,000 loads vs unlimited CartoDB)
2. Complex terms of service
3. Attribution requirements conflict with export feature
4. Better free alternatives available

### UI Design: Dropdown with Grouped Categories

```
┌─────────────────────────────────┐
│ 🗺️ Base Map  ▼                  │
├─────────────────────────────────┤
│ ☀️ DAY THEMES                   │
│   ○ Light (CartoDB)             │
│   ○ Streets (MapTiler)          │
│   ○ Terrain (OpenTopoMap)       │
│   ○ Satellite (Esri)            │
├─────────────────────────────────┤
│ 🌙 NIGHT THEMES                 │
│   ● Dark (CartoDB) ✓            │
│   ○ Smooth Dark (Stadia)        │
├─────────────────────────────────┤
│ [ Toggle: Auto Day/Night 🌓 ]   │
└─────────────────────────────────┘
```

### Implementation

**File:** `src/composables/useMapEngine.js`

```javascript
export const MAP_STYLES = {
  // Day themes
  light: {
    name: 'Light',
    category: 'day',
    provider: 'CartoDB',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    thumbnail: '/thumbnails/light.png'
  },
  streets: {
    name: 'Streets',
    category: 'day',
    provider: 'MapTiler',
    style: 'https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}',
    requiresKey: true
  },
  terrain: {
    name: 'Terrain',
    category: 'day',
    provider: 'OpenTopoMap',
    style: { /* raster config */ }
  },
  satellite: {
    name: 'Satellite',
    category: 'day',
    provider: 'Esri',
    style: { /* raster config */ },
    needsBoundaries: true  // Flag to add boundary overlay
  },

  // Night themes
  dark: {
    name: 'Dark',
    category: 'night',
    provider: 'CartoDB',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  'smooth-dark': {
    name: 'Smooth Dark',
    category: 'night',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
  }
}
```

**New component:** `src/components/MapStyleDropdown.vue`

**Effort:** Medium (8-12 hours)
**Risk:** Low

---

## 4. Vector Export (SVG/PDF)

### Research Findings

**Current Limitation:** MapLibre GL JS renders using WebGL to a canvas element. True vector export is NOT natively supported.

**Existing Plugin:** [@watergis/maplibre-gl-export](https://www.npmjs.com/package/@watergis/maplibre-gl-export)
- Exports to PNG, JPEG, PDF, SVG
- **BUT:** SVG/PDF outputs are **raster images embedded in vector containers** - NOT true vectors!
- Open issue requesting true vector export: [#332](https://github.com/watergis/maplibre-gl-export/issues/332)

### Options

#### Option A: Enhanced GeoJSON Export (Recommended for R Users)
The current GeoJSON export can be easily used in R for creating publication-quality vector maps.

**R Workflow:**
```r
library(sf)
library(ggplot2)

# Load exported GeoJSON
data <- st_read("ithomiini_data.geojson")

# Create map
ggplot(data) +
  geom_sf(aes(color = subspecies)) +
  theme_minimal() +
  coord_sf()

# Save as vector
ggsave("map.svg", width = 10, height = 8)
ggsave("map.pdf", width = 10, height = 8)
```

**Enhancement:** Add export options for:
- Include base map bounds (for adding background in R)
- Include legend data as separate JSON
- Simplified coordinates option

**Effort:** Low (2-4 hours)
**Pros:** Works today, true vectors, full R customization
**Cons:** Requires R knowledge

#### Option B: Implement maplibre-gl-export Plugin
Add PNG/JPEG/PDF export with embedded raster.

```bash
npm install @watergis/maplibre-gl-export
```

**Effort:** Medium (4-6 hours)
**Pros:** One-click export from UI
**Cons:** NOT true vectors - raster image in PDF/SVG container

#### Option C: Server-Side Vector Rendering (Complex)
Use a headless browser or custom renderer to generate true vectors.

**Technologies:**
- Puppeteer with SVG renderer
- MapLibre Native (C++)
- Custom GeoJSON-to-SVG conversion

**Effort:** High (40+ hours)
**Pros:** True vector output
**Cons:** Complex, may require backend infrastructure

### Recommendation

**Implement both A and B:**
1. **Option A:** Enhance GeoJSON export with R-friendly options (immediate value for Joana)
2. **Option B:** Add maplibre-gl-export for quick raster exports

Provide documentation showing R workflow for publication-quality figures.

---

## 5. Database Update Feature

### Research: Wings Gallery Implementation

The Shiny Wings Gallery uses:
1. **Google Sheets** as data source
2. **Cloudflare Worker** as secure proxy (hides GitHub token)
3. **GitHub Actions** workflow triggered via API
4. Password-protected update button in UI

### GitHub Actions Limits

| Tier | Minutes/Month | Notes |
|------|---------------|-------|
| Free (Public repos) | Unlimited | ✅ Ithomiini Maps is public |
| Free (Private repos) | 2,000 | Not applicable |

**Your GBIF script takes ~15 minutes** - well within limits for public repos.

### Proposed Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Update UI    │───▶│ Cloudflare Worker │───▶│ GitHub Actions  │
│ (Password)   │    │ (Token secured)   │    │ (Process Data)  │
└──────────────┘    └──────────────────┘    └─────────────────┘
                                                     │
                           ┌─────────────────────────┘
                           ▼
                    ┌─────────────────┐
                    │ GitHub Pages    │
                    │ (Auto Deploy)   │
                    └─────────────────┘
```

### Implementation Options

#### Option A: Full Update (Sanger + GBIF)
- Runs `gbif_download_api.py` (10-15 min) + `process_data.py` (1 min)
- Total: ~15-20 minutes
- Frequency: Monthly recommended (GBIF data doesn't change often)

#### Option B: Sanger-Only Update (Fast)
- Runs `process_data.py` with existing GBIF cache
- Total: ~1-2 minutes
- Frequency: Daily/weekly as needed

### UI Design

```
┌────────────────────────────────────────────────┐
│ ⚙️ DATABASE UPDATE                              │
├────────────────────────────────────────────────┤
│                                                │
│ Last updated: 2025-01-02 14:30                │
│ Records: 32,456 | GBIF DOI: 10.15468/dl.abc123│
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ 🔑 Password: [________________]         │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ Update Options:                               │
│ ○ Sanger Institute only (~2 min)             │
│ ● Full update: Sanger + GBIF (~15 min)       │
│                                                │
│ [ 🚀 Start Update ]                           │
│                                                │
│ ℹ️ GBIF updates fetch fresh iNaturalist and   │
│   museum records. Run monthly for best data.  │
└────────────────────────────────────────────────┘
```

### Files to Create

1. **`.github/workflows/update_data.yml`** - GitHub Action
2. **`src/components/UpdateTab.vue`** - UI component
3. **Cloudflare Worker** - Secure proxy (optional, can use GitHub API directly with public workflow)

**Effort:** Medium-High (12-20 hours)
**Risk:** Low (follows proven Wings Gallery pattern)

---

## 6. Sex/Gender Filter

### Research Findings

#### Current Data Schema
The output `map_points.json` does **NOT** include a sex field.

#### Source Data Analysis

| Source | Sex Data Available? | Notes |
|--------|---------------------|-------|
| **Dore et al.** | ❌ No | Has M.mimicry/F.mimicry (species-level, not individual) |
| **Sanger Google Sheets** | ⚠️ Unknown | Need to check if column exists |
| **GBIF** | ✅ Yes | Darwin Core `sex` field: "male", "female", "hermaphrodite" |

#### GBIF Sex Field
The Darwin Core standard includes `sex` in occurrence records. The GBIF download script (`gbif_download_api.py`) currently does NOT extract this field, but it CAN be added.

### Implementation Plan

#### Step 1: Check Sanger Data
First verify if the Sanger Google Sheet has a "Sex" column.

#### Step 2: Modify GBIF Download Script

**File:** `scripts/gbif_download_api.py`

```python
# In process_occurrence_file(), add to record dict:
record = {
    # ... existing fields ...
    'sex': row.get('sex'),  # Darwin Core sex field
}
```

#### Step 3: Modify Data Processing

**File:** `scripts/process_data.py`

```python
# Add sex field to output schema
result = df[[
    'id', 'scientific_name', ...,
    'sex',  # New field
]].copy()
```

#### Step 4: Add Frontend Filter

**File:** `src/stores/data.js`

```javascript
// Add to filters
const filters = ref({
  // ... existing filters ...
  sex: [],  // ['male', 'female', 'unknown']
})

// Add unique values
const uniqueSexes = computed(() => {
  const set = new Set(
    allFeatures.value
      .map(i => i.sex)
      .filter(v => v && v.toLowerCase() !== 'unknown')
  )
  return Array.from(set).sort()
})
```

#### Step 5: Update Location Summary

**File:** `src/components/PointPopup.vue`

```vue
<div class="location-stats">
  <span>{{ totalIndividuals }} individuals</span>
  <span v-if="maleCount > 0">♂ {{ maleCount }}</span>
  <span v-if="femaleCount > 0">♀ {{ femaleCount }}</span>
</div>
```

### Important Note
Sex data availability varies by source:
- **GBIF/iNaturalist:** Many records have sex data
- **Sanger:** Depends on collection practices
- **Dore:** Likely no individual sex data

The filter should handle records with unknown/missing sex gracefully.

**Effort:** Medium (8-12 hours)
**Risk:** Medium (data availability varies)

---

## 7. Clustering Numbers Bug

### Problem
The number on a cluster (e.g., "15") doesn't match the popup content (e.g., "26 individuals").

### Root Cause
Found in `src/composables/useMapEngine.js` lines 577-615:

1. **Cluster number** = `point_count` (actual clustered features)
2. **Popup query** = searches ALL points within a calculated radius

The radius calculation is too generous:
```javascript
const radiusKm = Math.max(20, clusterRadiusPx * kmPerPixel * 2)  // ← Too large
```

### Fix

```javascript
// Replace the cluster click handler with this:
map.value.on('click', 'clusters', async (e) => {
  const cluster = e.features[0]
  const clusterId = cluster.properties.cluster_id
  const source = map.value.getSource('points-source')

  // Use MapLibre's built-in cluster expansion
  const leaves = await source.getClusterLeaves(clusterId, 1000, 0)

  const points = leaves.map(f => f.properties)

  if (points.length > 0 && onShowPopup) {
    onShowPopup({
      type: 'cluster',
      coordinates: { lat: cluster.geometry.coordinates[1], lng: cluster.geometry.coordinates[0] },
      lngLat: cluster.geometry.coordinates,
      points: points
    })
  }
})
```

**Effort:** Low (2-3 hours)
**Risk:** Low

---

## Implementation Priority & Timeline

### Phase 1: Quick Wins (Week 1)
| Task | Effort | Impact |
|------|--------|--------|
| 1. Legend filtering | 4h | High |
| 7. Clustering bug fix | 3h | High |
| 4A. Enhanced GeoJSON export | 4h | Medium |

### Phase 2: Map Improvements (Week 2)
| Task | Effort | Impact |
|------|--------|--------|
| 2. Country boundaries | 6h | Medium |
| 3. Map layer dropdown | 12h | Medium |

### Phase 3: Data Features (Week 3-4)
| Task | Effort | Impact |
|------|--------|--------|
| 5. Database update feature | 20h | High |
| 6. Sex filter | 12h | Medium |
| 4B. maplibre-gl-export | 6h | Medium |

---

## Questions for Your Decision

### 1. Map Layers
- **Include Stadia Maps?** (requires free API key signup)
- **Include MapTiler?** (requires free API key signup)
- Or **stick with no-API-key providers only?** (CartoDB, OSM, Esri, OpenTopoMap)

### 2. Vector Export
- **Option A only** (Enhanced GeoJSON + R documentation)?
- **Option A + B** (Also add raster PDF/PNG export plugin)?
- **Option C** (Full vector rendering - significant effort)?

### 3. Database Update
- **Both options** (Sanger-only + Full update)?
- **Full update only** (simpler UI)?

### 4. Sex Filter
- **Proceed with adding sex field to GBIF data?**
- **First check if Sanger sheet has sex column?**

### 5. Country Boundaries
- **Bundle GeoJSON file** (~500KB)?
- **Or use MapTiler/Stadia satellite with built-in boundaries?**

---

## Sources & References

### Map Providers
- [Stadia Maps Pricing](https://stadiamaps.com/pricing) - 2,500 free credits/month
- [MapTiler Pricing](https://www.maptiler.com/cloud/pricing/) - 100k loads/month
- [CartoDB Basemaps](https://carto.com/basemaps/) - Unlimited free

### Country Boundaries
- [Natural Earth Data](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/)
- [geoBoundaries Viewer](https://mapscaping.com/country-boundary-viewer/)

### Vector Export
- [maplibre-gl-export](https://maplibre-gl-export.water-gis.com/)
- [Feature request for true vectors](https://github.com/watergis/maplibre-gl-export/issues/332)

### GitHub Actions
- [GitHub Actions Billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)

### Darwin Core
- [Darwin Core Terms](https://dwc.tdwg.org/terms/) - Sex field specification

### Google Maps (Not Recommended)
- [Maps JavaScript API Billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
- After March 2025: 10,000 free loads/month only
