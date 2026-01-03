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

## Planned Features (Not Yet Implemented)

### 4. Country Boundaries on Satellite Map

**Options:**

#### Option A: Bundle GeoJSON (Recommended)
Download Natural Earth boundaries and add as overlay:
- Source: https://github.com/martynafford/natural-earth-geojson
- Layers available: countries, states, coastlines, etc.
- Size: ~500KB-2MB depending on detail level

#### Option B: Use MapTiler/Stadia with built-in boundaries
Some providers include boundary layers.

**Proposed UI:**
- Add a dropdown in sidebar to choose which layers to render
- Options: Countries, States/Provinces, Coastlines, etc.
- Checkbox to toggle boundary visibility

---

### 5. Map Layer Providers (Dropdown with Day/Night Themes)

#### Provider Research Summary

**Stadia Maps:**
- Website: https://stadiamaps.com/
- Free tier: 2,500 credits/month (no credit card required)
- **Rate limiting:** Per session, not per tile request
- API key: Sign up at https://client.stadiamaps.com/signup/
- **Day themes:** Alidade Smooth, Stamen Terrain
- **Night themes:** Alidade Smooth Dark

**MapTiler:**
- Website: https://www.maptiler.com/
- Free tier: 100,000 map loads/month
- **Rate limiting:** Per session (one page load = one session)
- API key: Sign up at https://cloud.maptiler.com/
- Supports day/night themes

**No API Key Required:**
- CartoDB (Positron/Dark Matter) - Unlimited
- OpenStreetMap - Fair use
- Esri World Imagery - Fair use
- OpenTopoMap - Fair use

**Google Maps:** NOT RECOMMENDED
- Only 10,000 free loads/month after March 2025
- Complex terms of service
- Attribution requirements conflict with export

#### Proposed UI Design

```
┌─────────────────────────────────┐
│ 🗺️ Base Map  ▼                  │
├─────────────────────────────────┤
│ ☀️ DAY THEMES                   │
│   ○ Light (CartoDB)             │
│   ○ Streets (MapTiler)          │
│   ○ Terrain (Stadia)            │
│   ○ Satellite (Esri)            │
├─────────────────────────────────┤
│ 🌙 NIGHT THEMES                 │
│   ● Dark (CartoDB) ✓            │
│   ○ Smooth Dark (Stadia)        │
└─────────────────────────────────┘
```

**Optional:** Auto day/night toggle button (uses local time)

---

### 6. Vector Export (SVG/PDF)

#### Research Findings

**MapLibre SVG Export Status:**
- MapLibre renders to WebGL canvas (raster)
- Existing plugin `@watergis/maplibre-gl-export` creates PDF/SVG but with **raster images embedded**, NOT true vectors
- True vector export is NOT natively supported

#### Recommended Approach

**Option A: Enhanced GeoJSON Export + R Documentation**

Create a downloadable ZIP containing:
1. `data.geojson` - Filtered point data
2. `basemap_bounds.json` - Map view bounds
3. `legend.json` - Legend configuration
4. `load_map.R` - R script to recreate the exact view

**R Script Example:**
```r
library(sf)
library(ggplot2)
library(rnaturalearth)

# Load exported data
points <- st_read("data.geojson")
config <- jsonlite::fromJSON("basemap_bounds.json")

# Get base map
world <- ne_countries(scale = "medium", returnclass = "sf")

# Recreate map view
ggplot() +
  geom_sf(data = world, fill = "#1a1a2e", color = "#3d3d5c") +
  geom_sf(data = points, aes(color = subspecies), size = 2) +
  coord_sf(xlim = config$bounds[c(1,3)], ylim = config$bounds[c(2,4)]) +
  theme_void() +
  theme(
    panel.background = element_rect(fill = "#1a1a2e"),
    legend.position = "bottom"
  )

# Save as vector
ggsave("map.svg", width = 10, height = 8)
ggsave("map.pdf", width = 10, height = 8)
```

**Option B: Add maplibre-gl-export Plugin**

Improves current PNG export accuracy:
```bash
npm install @watergis/maplibre-gl-export
```

---

### 7. Clustering Numbers Bug

**Issue Clarified by User:**
The cluster count shows the number of **rendered points** (one per subspecies), not the number of **individuals**. This is expected behavior but can be confusing.

**Proposed Solution:**
Add an option in Map Settings to choose what clusters count:
- Number of species
- Number of subspecies (current default)
- Number of individuals

The cluster radius circle shows the minimum area covering all clustered points.

**Implementation:**
Modify cluster generation in `useMapEngine.js` to aggregate based on selected mode.

---

## API Key Instructions

### Stadia Maps
1. Go to https://client.stadiamaps.com/signup/
2. Create account (no credit card required)
3. Create a "Property" for your website
4. Generate API key
5. Add to `.env`: `VITE_STADIA_KEY=your_key`

**Rate Limits:**
- 2,500 free credits/month
- One map session = one credit (includes all zoom/pan)
- Local development (localhost) doesn't need API key

### MapTiler
1. Go to https://cloud.maptiler.com/
2. Create account
3. Copy API key from dashboard
4. Add to `.env`: `VITE_MAPTILER_KEY=your_key`

**Rate Limits:**
- 100,000 map loads/month
- One page load = one session (all interactions free)
- Third-party SDK usage counted per tile request

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

### Phase 2: Next Steps
- [ ] Country boundaries layer with dropdown
- [ ] Map layer dropdown with grouped day/night themes
- [ ] Clustering count options (species/subspecies/individuals)

### Phase 3: Future
- [ ] Enhanced GeoJSON export with R scripts
- [ ] maplibre-gl-export plugin for improved PNG export
- [ ] API key integration for Stadia/MapTiler

---

## Sources & References

- [Stadia Maps Docs](https://docs.stadiamaps.com/)
- [MapTiler Docs](https://docs.maptiler.com/)
- [Natural Earth Data](https://www.naturalearthdata.com/)
- [maplibre-gl-export](https://maplibre-gl-export.water-gis.com/)
- [GitHub Actions Billing](https://docs.github.com/billing/managing-billing-for-github-actions)
- [Darwin Core Sex Term](https://dwc.tdwg.org/terms/#dwc:sex)
