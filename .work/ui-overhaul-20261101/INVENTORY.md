# Wings Atlas: inventory of views

One app page (no router): the map view and the table view share the sidebar; everything else is a panel, menu, mode or modal on top. English only (no language switch). Shot at 1440 × 900 (desktop), 390 × 844 and 360 × 780 (phones, DPR 2), in dark (the site default) and light (sun button pressed after load). Shots: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/{dark,light}/<view>__<width>-en.jpg`; dark|light review sheets in `pairs-1440/` and `pairs-390/`.

## Map

view | opened by | source | widths | shots ok (dark/light)
---|---|---|---|---
`map` | page load | App.vue, components/MapEngine.vue, components/Sidebar.vue, components/Legend/Legend.vue | 1440, 390, 360 | 3/3 · 3/3
`loading` | data request held 9 s | App.vue (.loading-overlay) | 1440, 390, 360 | 3/3 · 3/3
`map-empty` | URL ?cam=ZZZ_NO_SUCH_CAMID | components/MapEngine.vue (.map-empty-notice) | 1440, 390, 360 | 3/3 · 3/3
`map-layers-menu` | '.dropdown-trigger:not(.theme-trigger)' | components/MapEngine.vue (map layer dropdown), utils/mapStyles.js | 1440, 390, 360 | 3/3 · 3/3
`map-theme-menu` | '.theme-trigger' | components/MapEngine.vue (theme dropdown), themes/presets.js | 1440, 390, 360 | 3/3 · 3/3
`location-search` | 'input[placeholder^="Search location"]', 'Tena' | components/MapEngine.vue, composables/useLocationSearch.js | 1440 | 1/1 · 1/1
`point-popup` | page load | components/PointPopup.vue | 1440, 390, 360 | 3/3 · 3/3
`field-sites` | '.field-sites-tab' | components/SiteComparison.vue | 1440, 390, 360 | 3/3 · 3/3
`bbox-draw` | '.bbox-draw-btn' | composables/useBoundingBoxSelection.js, map-container-styles.css | 1440, 390, 360 | 3/3 · 3/3
`legend-sort` | '.legend-title', '.title-control-button', 'Sort' | components/Legend/Legend.vue (sort dropdown) | 1440 | 1/1 · 1/1
`legend-expanded` | '.legend-more' | components/Legend/Legend.vue (+ N more) | 390, 360 | 2/2 · 2/2
`clusters` | 'button' | components/SidebarMapSettings.vue, composables/useClusterComposition.js | 1440, 390, 360 | 3/3 · 3/3
`heatmap` | 'button' | components/SidebarMapSettings.vue, MapEngine.vue (.density-legend) | 1440, 390, 360 | 3/3 · 3/3
`ranges` | 'button' | components/SidebarMapSettings.vue, utils/rangePolygons.js | 1440, 390, 360 | 3/3 · 3/3
`sdm` | 'Species Distribution Models', 'Species Distribution Models', '.multiselect', 'Mechanitis' | components/Sidebar.vue (Species Distribution Models), stores/sdm.js, composables/useSDMLayer.js | 1440, 390, 360 | 3/3 · 3/3
`preview-export` | '.mobile-pill', 'Export', '.action-btn', 'Preview Export' | components/Sidebar.vue (Export Settings), composables/useExportPreview.js, Legend/LegendToolbar.vue | 1440, 390, 360 | 3/3 · 3/3

## Sidebar

view | opened by | source | widths | shots ok (dark/light)
---|---|---|---|---
`mobile-menu` | page load | App.vue (.mobile-sidebar-panel), components/Sidebar.vue | 390, 360 | 2/2 · 2/2
`sidebar-taxonomy` | 'Family', 'Tribe', 'Genus', 'Sex' | components/Sidebar.vue, components/FilterSelect.vue | 1440, 390, 360 | 3/3 · 3/3
`filter-dropdown` | page load | components/FilterSelect.vue (vue-multiselect) | 1440, 390, 360 | 3/3 · 3/3
`sidebar-other-filters` | 'Sequencing Status', 'Country', 'Collection location', 'Time Range' | components/Sidebar.vue, DateFilter.vue, TimeSlider.vue | 1440, 390, 360 | 3/3 · 3/3
`sidebar-other-filters-2` | 'Sequencing Status', 'Country', 'Collection location', 'Time Range' | components/Sidebar.vue (GoaT, Time Range), TimeSlider.vue | 1440, 390, 360 | 3/3 · 3/3
`sidebar-hostplants` | 'Host ID level' | components/Sidebar.vue (host plants), stores/hostPlants.js | 1440, 390, 360 | 3/3 · 3/3
`sidebar-sources` | '+ All GBIF' | components/Sidebar.vue (data sources), SidebarMapSettings.vue | 1440, 390, 360 | 3/3 · 3/3
`sidebar-bottom` | '.update-toggle', '*' | SidebarMapSettings.vue, Sidebar.vue (remember settings), DatabaseUpdateSection.vue | 1440, 390, 360 | 3/3 · 3/3
`share-toast` | '.btn-share' | components/Sidebar.vue (copyShareUrl toast) | 1440, 390, 360 | 3/3 · 3/3

## Dialogs

view | opened by | source | widths | shots ok (dark/light)
---|---|---|---|---
`smart-search` | '.mobile-pill', 'Search', '.smart-search-tile', 'Melinaea' | components/sidebar/CommandPaletteDialog.vue | 1440, 390, 360 | 3/3 · 3/3
`smart-search-empty` | '.mobile-pill', 'Search', '.smart-search-tile' | components/sidebar/CommandPaletteDialog.vue (no query) | 1440, 390, 360 | 3/3 · 3/3
`mimicry` | '.mobile-pill', 'Mimicry', '.action-btn', 'Mimicry' | components/MimicrySelector.vue, MimicryRingCard.vue | 1440, 390, 360 | 3/3 · 3/3
`export-data` | '.btn-export' | components/ExportPanel.vue (Export tab) | 1440, 390, 360 | 3/3 · 3/3
`export-citation` | '.export-panel button, .modal-overlay button', 'Citation' | components/ExportPanel.vue (Citation tab) | 1440, 390, 360 | 3/3 · 3/3

## Table

view | opened by | source | widths | shots ok (dark/light)
---|---|---|---|---
`table` | '.mobile-pill', 'Table', '.view-toggle button', 'Table' | components/DataTable.vue | 1440, 390, 360 | 3/3 · 3/3
`table-column-filters` | '.column-filter-toggle' | components/DataTable.vue (column filters) | 1440, 390, 360 | 3/3 · 3/3
`table-columns` | '.btn-columns' | components/DataTable.vue (column settings) | 1440, 390, 360 | 3/3 · 3/3

## Gallery

view | opened by | source | widths | shots ok (dark/light)
---|---|---|---|---
`gallery` | '.mobile-pill', 'Gallery', '.action-btn', 'Gallery' | components/ImageGallery.vue, GallerySidebar.vue, GalleryThumbnailStrip.vue, image-gallery-styles.css | 1440, 390, 360 | 3/3 · 3/3
`gallery-hostplants` | 'button', 'Host Plants' | components/ImageGallery.vue (Host Plants mode) | 1440, 390, 360 | 3/3 · 3/3
`gallery-mobile-sidebar` | '.btn-gallery-filters' | components/ImageGallery.vue (showMobileGallerySidebar), GallerySidebar.vue | 390, 360 | 2/2 · 2/2

**36 views, 202 shots.** No view failed.

Not shot separately (seen inside other views, or need data the audit must not change): the Update Database password form is shown expanded in `sidebar-bottom` (Start Update not pressed); GoaT and Time Range panels are in `sidebar-other-filters-2`; the SDM section did not appear (`data/sdm/sdm_metadata.json` returns 404 on this checkout, so `sdmStore.hasData` is false); legend colour picker, group style popup and abbreviation dropdowns (Legend/*.vue) open on hover-only controls in the export preview and were not opened; the image zoom/pan state and the R export, CSV and image downloads were not triggered. The light `loading` shots show the dark boot screen, because the mode can only be switched after load (see AUDIT.md, theming).
