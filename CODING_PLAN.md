# Ithomiini Maps - Comprehensive Coding Plan

## Completed Features

### 1. Legend Filtering (Show Only Selected Species) ✅ IMPLEMENTED

**Status:** Completed

The legend now shows ONLY the values present in the currently displayed data on the map, not all possible values from the dataset.

**Changes made:**
- `src/stores/data.js`: Modified `activeColorMap` computed property to derive colors from `displayGeoJSON` (visible data) instead of all filter options.

---

### 2. Sex/Gender Filter ✅ IMPLEMENTED

**Status:** Completed

Added sex filtering capability with male/female counts displayed in the Location Summary popup.

**Changes made:**
- `scripts/process_data.py`:
  - Added `normalize_sex()` function to standardize sex values
  - Extract sex from Sanger data (if Sex column exists)
  - Extract sex from GBIF data (Darwin Core `sex` field)
  - Added sex field to output JSON
  - Added sex statistics to output

- `scripts/gbif_download_api.py`:
  - Extract `sex` field from Darwin Core occurrence records

- `src/stores/data.js`:
  - Added `sex` filter (values: 'all', 'male', 'female')
  - Added sex filtering logic
  - Added URL sync for sex filter
  - Updated `resetAllFilters` to include sex

- `src/components/Sidebar.vue`:
  - Added Sex filter dropdown with options: All, Male only, Female only
  - Styled to match existing filters

- `src/components/PointPopup.vue`:
  - Added sex counts (male/female/unknown) to Location Summary
  - Shows ♂ and ♀ symbols with counts

---

### 3. Database Update Feature ✅ IMPLEMENTED

**Status:** Completed - Requires user setup of Cloudflare Worker

Added a database update section in the sidebar with options to update Sanger data, GBIF data, or both.

**Changes made:**
- `.github/workflows/update_data.yml`:
  - Added workflow inputs for `update_sanger` and `update_gbif`
  - GBIF update step only runs when requested
  - 30-minute timeout for GBIF downloads

- `src/components/Sidebar.vue`:
  - Added "Update Database" collapsible section
  - Checkboxes for Sanger (default) and GBIF sources
  - Password input field (password: "Hyalyris")
  - Status messages (loading, success, error)

- `scripts/cloudflare-worker.js`:
  - Cloudflare Worker script for secure API triggering

#### User Setup Required

To enable the database update feature, you need to set up a Cloudflare Worker:

**Step 1: Create a GitHub Personal Access Token**
1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token" (Fine-grained tokens)
3. Settings:
   - Name: "Ithomiini DB Updater"
   - Expiration: 1 year (or your preference)
   - Repository access: Only select repositories → "ithomiini_maps"
   - Permissions: Actions (Read and write)
4. Generate and copy the token

**Step 2: Create Cloudflare Worker**
1. Go to https://dash.cloudflare.com/
2. Sign up or log in (free tier is fine)
3. Go to "Workers & Pages" → "Create Application" → "Create Worker"
4. Name it: `ithomiini-db-updater`
5. Deploy (empty worker first)
6. Click "Edit Code" and paste contents from `scripts/cloudflare-worker.js`
7. Save and deploy

**Step 3: Set Worker Environment Variables**
1. In the Worker, go to "Settings" → "Variables"
2. Add these variables:
   - `UPDATE_PASSWORD`: `Hyalyris`
   - `GITHUB_TOKEN`: (your token from Step 1)
   - `GITHUB_OWNER`: `Fr4nzz`
   - `GITHUB_REPO`: `ithomiini_maps`
3. Click "Save"

**Step 4: Update Frontend URL**
1. Copy your Worker URL (e.g., `https://ithomiini-db-updater.your-account.workers.dev/`)
2. Update `src/components/Sidebar.vue` line ~98 with your Worker URL

---

### 4. Country Boundaries Layer ✅ IMPLEMENTED

**Status:** Completed

Added country boundaries overlay using Natural Earth GeoJSON data.

**Changes made:**
- `src/composables/useMapEngine.js`:
  - Added `useCountryBoundaries` composable
  - Fetches Natural Earth 50m country boundaries from GitHub
  - Boundaries rendered as white lines with zoom-dependent width
  - Boundaries added below data points layer
  - Lazy-loads GeoJSON only when first enabled

- `src/components/MapEngine.vue`:
  - Integrated boundaries toggle in map layer dropdown
  - Checkbox to show/hide country borders
  - Re-adds boundaries after style changes

---

### 5. Map Layer Dropdown with Day/Night Themes ✅ IMPLEMENTED

**Status:** Completed

Replaced the button-based style switcher with a grouped dropdown menu organized by day/night themes.

**Changes made:**
- `src/composables/useMapEngine.js`:
  - Added `theme` property to each MAP_STYLES entry ('day' or 'night')
  - Added `getStylesByTheme()` helper to group styles
  - Uses Stadia Maps JSON style URLs (recommended by Stadia for MapLibre GL JS)
  - Domain authentication on localhost works without API key

- `src/components/MapEngine.vue`:
  - New dropdown menu with sun/moon icons for day/night sections
  - Shows current style name with layer icon
  - Checkmark indicator for active style
  - Country borders toggle included in dropdown
  - Smooth transitions and responsive design

**Available Styles:**

| Style Name | Provider | Theme | Notes |
|------------|----------|-------|-------|
| Light | CartoDB | Day | Vector tiles, no API key |
| Smooth | Stadia | Day | Alidade Smooth, clean design |
| Terrain | OpenTopoMap | Day | Raster, topographic |
| Stamen Terrain | Stadia | Day | Hill shading, natural colors |
| Streets | OSM | Day | Raster tiles |
| Satellite | Esri | Day | Raster imagery |
| Dark | CartoDB | Night | Vector tiles, no API key |
| Smooth Dark | Stadia | Night | Alidade Smooth Dark |
| Toner | Stadia | Night | Stamen Toner, high contrast B&W |

**Technical Notes:**
- Stadia styles use JSON style URLs (e.g., `https://tiles.stadiamaps.com/styles/alidade_smooth.json`)
- This is the recommended approach per [Stadia MapLibre docs](https://docs.stadiamaps.com/tutorials/vector-maps-with-maplibre-gl-js/)
- Raster tile URLs with `{r}` placeholder don't work in MapLibre - use JSON or `@2x` suffix instead

---

### 6. Clustering Count Options ✅ IMPLEMENTED

**Status:** Completed

Added option in Map Settings to choose what cluster numbers represent.

**Changes made:**
- `src/stores/data.js`:
  - Added `countMode` to `clusterSettings` ('species', 'subspecies', 'individuals')
  - Added `speciesGroups` computed property to group points by species per location
  - Modified `displayGeoJSON` to aggregate points based on count mode when clustering is enabled

- `src/components/SidebarMapSettings.vue`:
  - Added "Cluster Count Shows" dropdown with three options:
    - Individuals (records) - total specimen records
    - Subspecies (unique) - unique subspecies count
    - Species (unique) - unique species count
  - Dynamic hint text explaining the current mode

**How it works:**
- **Individuals mode:** Uses all filtered records (default MapLibre point_count)
- **Subspecies mode:** Aggregates to one point per subspecies per location
- **Species mode:** Aggregates to one point per species per location

---

## Planned Features (Not Yet Implemented)

### 7. Vector Export (SVG/PDF)

#### Current Implementation Analysis

**What We Have:**
- `ExportPanel.vue` - Image export using canvas-based approach
- `canvasHelpers.js` - Helper functions for drawing legend, scale bar, attribution
- Uses `map.getCanvas().toDataURL()` to capture map as PNG
- Manual canvas drawing for legend, scale bar, attribution overlays
- Requires `preserveDrawingBuffer: true` in MapLibre config

**Limitations of Current Approach:**
- PNG only (raster) - not suitable for print publications
- Resolution limited by canvas size
- Legend/scale bar drawn via canvas operations (font rendering issues possible)
- Preview-to-export discrepancies due to manual calculations

#### Research Findings: maplibre-gl-export Plugin

**Package:** `@watergis/maplibre-gl-export` ([npm](https://www.npmjs.com/package/@watergis/maplibre-gl-export))

**Capabilities:**
- Export formats: PNG, JPEG, SVG, PDF
- DPI options: 72, 96, 200, 300, 400
- Page sizes: A2-A6, B2-B6
- Page orientation: Landscape/Portrait
- PrintableArea preview (like our export preview)
- Crosshair alignment aid

**Installation:**
```bash
npm install @watergis/maplibre-gl-export
```

**Usage Example:**
```javascript
import {
  MaplibreExportControl,
  Size,
  PageOrientation,
  Format,
  DPI
} from "@watergis/maplibre-gl-export";
import '@watergis/maplibre-gl-export/css/styles.css';

// Add as control
map.addControl(new MaplibreExportControl({
  PageSize: Size.A4,
  PageOrientation: PageOrientation.Landscape,
  Format: Format.PNG,
  DPI: DPI[300],
  Crosshair: true,
  PrintableArea: true
}), 'top-right');
```

**⚠️ CRITICAL LIMITATION:**
According to [Issue #332](https://github.com/watergis/maplibre-gl-export/issues/332):
> "Currently SVG and PDF exports are just SVG/PDF files with a **raster image on them**."

The SVG/PDF export does NOT produce true vector graphics - it embeds the WebGL canvas as a raster image inside the SVG/PDF container. This is because MapLibre renders to WebGL, not SVG.

**True vector export is requested but not implemented.** The maintainer has invited PRs but no implementation exists yet (as of December 2024).

#### Recommended Approach

**Option A: Replace Current Export with maplibre-gl-export (RECOMMENDED)**

Benefits:
1. Higher DPI options (up to 400 vs our current screen resolution)
2. Built-in print area preview (similar to ours but battle-tested)
3. PDF output for easy sharing/printing
4. Maintains project simplicity (one dependency vs custom code)
5. Active maintenance

Implementation:
```javascript
// In ExportPanel.vue or new component
import { MaplibreExportControl } from "@watergis/maplibre-gl-export";

// Option 1: Add as map control
map.addControl(new MaplibreExportControl({...}));

// Option 2: Programmatic export (if supported)
// Check if plugin exposes export API for custom UI integration
```

**Option B: Keep Current Implementation + Add maplibre-gl-export**

Use our existing ExportPanel for custom UI/workflow, but leverage maplibre-gl-export's rendering engine for better quality output.

**Option C: Enhanced GeoJSON Export for R Users**

For users who need TRUE vector output for publications:

Create a downloadable ZIP containing:
1. `data.geojson` - Filtered point data with colors
2. `view_config.json` - Map bounds, zoom, projection
3. `legend.json` - Legend items and colors
4. `generate_map.R` - Ready-to-run R script

```r
library(sf)
library(ggplot2)
library(rnaturalearth)

# Load exported data
points <- st_read("data.geojson")
config <- jsonlite::fromJSON("view_config.json")
legend <- jsonlite::fromJSON("legend.json")

# Get base map
world <- ne_countries(scale = "medium", returnclass = "sf")

# Recreate map view
ggplot() +
  geom_sf(data = world, fill = "#1a1a2e", color = "#3d3d5c") +
  geom_sf(data = points, aes(color = subspecies), size = 2) +
  scale_color_manual(values = legend$colors) +
  coord_sf(xlim = config$bounds[c(1,3)], ylim = config$bounds[c(2,4)]) +
  theme_void() +
  theme(panel.background = element_rect(fill = "#1a1a2e"))

# Save as true vector
ggsave("map.svg", width = 10, height = 8)
ggsave("map.pdf", width = 10, height = 8)
```

#### Implementation Priority

| Option | Effort | Quality | Vector? | Recommended |
|--------|--------|---------|---------|-------------|
| A (Replace with plugin) | Low | High DPI raster | ❌ | ✅ Best UX |
| B (Keep both) | Medium | High DPI raster | ❌ | For custom needs |
| C (R export) | Medium | True vector | ✅ | For publications |

**Suggested Path:**
1. First: Implement Option A - Quick win, better export quality
2. Later: Add Option C - For users needing true vector output

#### Plugin Comparison

| Feature | Current | maplibre-gl-export |
|---------|---------|-------------------|
| PNG | ✅ | ✅ |
| JPEG | ❌ | ✅ |
| SVG | ❌ | ✅ (raster embedded) |
| PDF | ❌ | ✅ (raster embedded) |
| Max DPI | ~96 | 400 |
| Print sizes | Custom only | A2-A6, B2-B6 |
| Preview area | ✅ | ✅ |
| Custom legend | ✅ | ❌ (need manual add) |
| Scale bar | ✅ | Built-in |
| Attribution | ✅ | Built-in |

#### Sources
- [maplibre-gl-export Demo](https://maplibre-gl-export.water-gis.com/)
- [Issue #332: True Vector Export Request](https://github.com/watergis/maplibre-gl-export/issues/332)
- [geOps PDF Export Blog](https://geops.com/en/blog/export-and-print-web-maps-as-pdf)
- [MapLibre Plugins List](https://maplibre.org/maplibre-gl-js/docs/plugins/)

---

## API Key Instructions

### Stadia Maps (Used in this project)

**Current Implementation:**
- Uses JSON style URLs: `https://tiles.stadiamaps.com/styles/{style_name}.json`
- Localhost development works WITHOUT API key
- Production deployment uses domain authentication

**For Production Deployment:**
1. Go to https://client.stadiamaps.com/signup/
2. Create account (no credit card required)
3. Create a "Property" for your website
4. In Authentication Configuration, add your domain:
   - Subdomain: `fr4nzz` (part before `.github.io`)
   - Domain: `github.io`
5. No API key in code needed - Stadia authenticates via Referer header

**Rate Limits:**
- 2,500 free credits/month
- One map session = one credit (includes all zoom/pan within session)
- Session timeout: 2 hours of inactivity
- Local development (localhost): FREE, doesn't count against quota

**Available Stadia Styles:**
| Style | JSON URL |
|-------|----------|
| Alidade Smooth | `https://tiles.stadiamaps.com/styles/alidade_smooth.json` |
| Alidade Smooth Dark | `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json` |
| Stamen Terrain | `https://tiles.stadiamaps.com/styles/stamen_terrain.json` |
| Stamen Toner | `https://tiles.stadiamaps.com/styles/stamen_toner.json` |
| Stamen Watercolor | `https://tiles.stadiamaps.com/styles/stamen_watercolor.json` |
| OSM Bright | `https://tiles.stadiamaps.com/styles/osm_bright.json` |
| Outdoors | `https://tiles.stadiamaps.com/styles/outdoors.json` |

### MapTiler (Not currently used)
1. Go to https://cloud.maptiler.com/
2. Create account
3. Copy API key from dashboard
4. Add to `.env`: `VITE_MAPTILER_KEY=your_key`

**Rate Limits:**
- 100,000 map loads/month
- One page load = one session (all interactions free)
- Third-party SDK usage counted per tile request

### Why NOT Google Maps
- After March 2025: Only 10,000 free loads/month
- Complex terms of service
- Attribution requirements conflict with export feature
- Better free alternatives exist (Stadia, CartoDB)

---

## GitHub Actions Information

**Free Tier Limits:**
- Public repositories: **Unlimited minutes**
- Private repositories: 2,000 minutes/month

Your GBIF update script (~15 minutes) works fine for public repos.

**Workflow Timeout:**
Set to 30 minutes to accommodate GBIF downloads.

---

## Implementation Priority

### Phase 1: Completed ✅
- [x] Legend filtering
- [x] Sex filter
- [x] Database update feature

### Phase 2: Completed ✅
- [x] Country boundaries layer with toggle
- [x] Map layer dropdown with grouped day/night themes
- [x] Stadia Maps integration (Smooth Dark theme)

### Phase 3: Completed ✅
- [x] Clustering count options (species/subspecies/individuals)

### Phase 4: Export Improvements (Planned)
- [ ] Install `@watergis/maplibre-gl-export` for higher DPI export (300-400 DPI)
- [ ] Add PDF export option (raster-in-PDF, good for printing)
- [ ] Add "Export for R" option with GeoJSON + R script bundle (true vector)
- [ ] Consider keeping custom legend overlay (plugin doesn't include)

---

## Sources & References

- [Stadia Maps Docs](https://docs.stadiamaps.com/)
- [MapTiler Docs](https://docs.maptiler.com/)
- [Natural Earth Data](https://www.naturalearthdata.com/)
- [maplibre-gl-export](https://maplibre-gl-export.water-gis.com/)
- [GitHub Actions Billing](https://docs.github.com/billing/managing-billing-for-github-actions)
- [Darwin Core Sex Term](https://dwc.tdwg.org/terms/#dwc:sex)
