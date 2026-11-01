# Wings Atlas UI audit (before)

1 November 2026. Wings Atlas (`rapidspeciation/ithomiini_maps` main at `c8feb9f`), run from the worktree `ithomiini_maps-uioverhaul` with `vite` dev on 127.0.0.1:5191. Scored against `ithomiini_database-uioverhaul/.work/ui-overhaul-20261031/PRINCIPLES.md`, using its general parts (P1–P12). The grid-specific parts (cell states, fill handle, Tabulator) do not apply here.

- **Coverage.** 36 views (every panel, mode, menu and dialog; there is no router), each at 1440, 390 and 360 px, in dark and in light: 202 shots, all succeeded. See `INVENTORY.md`.
- **Language.** The site is English only. There is no language switch and no i18n library.
- **How it was measured.** Contrast comes from the script: every visible text node's computed colour against its composited background. Text sitting directly on the WebGL map or on a photo is left out, because it has no single background. The script also measured input boundaries, tap sizes, names, overflow, clipped text, sizes under 12 px, and a 30-stop Tab pass per view at 1440.
- **What was judged by eye.** Map markers, tiles and icons drawn as background images can't be measured from the DOM. They were judged visually from the dark|light review sheets: 1440 by me, 390 by a separate reviewer.
- **Where the data is.**
  - Raw metrics: `audit-before/{dark,light}/metrics.json`.
  - Grouped measured issues: `audit-before/{dark,light}/issues.json`, plus `audit-before/auto-findings.json` (707 groups) and `auto-tables.md`.
  - Phone review: `audit-before/review-390.jsonl`.
  - All of these are under `/home/franz/.local/share/ui-overhaul-20261031/atlas/`.

## Rerun (before/after for the fix waves)

```
node /home/franz/.local/share/ui-overhaul-20261031/atlas/scripts/shoot.mjs --theme dark|light --out <fresh dir> --base http://127.0.0.1:5191/ithomiini_maps/ [--only view,view] [--widths 1440,390,360] [--focus 0|1]
node /home/franz/.local/share/ui-overhaul-20261031/atlas/scripts/make-report.mjs <out dir> <dark dir> <light dir>      # grouped issues + per-view table
python3 -I /home/franz/.local/share/ui-overhaul-20261031/atlas/scripts/pairs.py <dark dir> <light dir> <sheets dir> 1440 1000   # review sheets
node /home/franz/.local/share/ui-overhaul-20261031/atlas/scripts/inventory.mjs <INVENTORY.md> <dark dir> <light dir>
```

- **What the shoot script needs.** The site must be running first: `node_modules/.bin/vite <worktree> --port 5191 --strictPort --host 127.0.0.1`, or `vite preview`, or the live site via `--base`.
- **Light mode.** `--theme light` presses the sun button after load, as a visitor would. That also swaps the basemap to its light pair.
- **Waits and browsers.** It waits while MemAvailable is under 2.5 GB, starts one headless Chromium (SwiftShader WebGL) per width, and lets only GET requests through.

## Scores per screen (0–3, light and dark, desktop and phone together)

0 fails on most elements; 1 fails on several, or once on a frequent element; 2 meets the bar with small slips; 3 meets it everywhere. P13 (proof before shipping) is a process rule and is not scored.

Screen (views) | P1 text | P2 non-text | P3 focus | P4 hierarchy | P5 redundancy | P6 key info | P7 density | P8 states | P9 colour | P10 motion | P11 mobile | P12 dark/light
---|---|---|---|---|---|---|---|---|---|---|---|---
Map, desktop (`map`, `map-empty`, `loading`, `location-search`, menus) | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | – | 1
Map, phone (`map` 390/360, quick bar, `mobile-menu`) | 1 | 1 | – | 1 | 2 | 1 | 1 | 2 | 2 | 2 | 0 | 0
Point popup (`point-popup`) | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2
Field sites (`field-sites`) | 2 | 1 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 2
Map modes and SDM (`clusters`, `heatmap`, `ranges`, `sdm`, `bbox-draw`) | 1 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 1 | 1
Legend (`legend-sort`, `legend-expanded`) | 0 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 0 | 2
Preview export (`preview-export`) | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 1
Sidebar filters (`sidebar-*`, `filter-dropdown`, `share-toast`) | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 2 | 1 | 1
Smart search (`smart-search`, `smart-search-empty`) | 1 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2
Table (`table`, `table-column-filters`, `table-columns`) | 1 | 1 | 2 | 2 | 1 | 2 | 1 | 2 | 1 | 2 | 1 | 1
Gallery (`gallery`, `gallery-hostplants`, `gallery-mobile-sidebar`) | 1 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | 1 | 2 | 0 | 0
Mimicry (`mimicry`) | 1 | 2 | 1 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 0 | 2
Export & citation (`export-data`, `export-citation`) | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 1 | 2 | 2 | 2

Per-view measured numbers (text below the bar and its minimum ratio, boundaries, taps, small text, unnamed controls, focus stops without an indicator) are in `audit-before/auto-tables.md`.

## Issues by severity

Each finding is one problem, consolidated from the measured groups and the two visual reviews. The machine-readable list is `audit-findings.json` in this folder. Screenshot paths point at the dark shot unless the problem is light-only.

### P0 (0)

None found. Nothing blocks a task or can lose data (the site is read-only for visitors).

### P1 (16)

- **A01 Muted text token fails 4.5:1 in every palette (labels, placeholders, subtitle, OFF, hints).** dark #666666 on #1a1a2e / #252540 / #2d2d4a = 2.97 / 2.58 / 2.31 (≈2,500 text nodes, 34 views); light #868e96 on #ffffff / #f8f9fa / #f1f3f5 = 3.32 / 3.15 / 2.99 (≈2,500 nodes). Token ratios for all 10 palette×mode sets: 2.31–4.59, none ≥ 4.5 on all three surfaces.. Views: all 36; widths 1440, 390, 360; theme dark/light. Source: `src/index.css (--color-text-muted in all 10 blocks), used 148× via var(--color-text-muted)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/sidebar-taxonomy__1440-en.jpg`
- **A02 Legend counts, «Other · N species», «+ N more» and SORT are near-invisible.** dark #484850 on #1a1a2e 1.87, #4f4f55 2.10; light #b6bbc0 on #ffffff 1.93, #aab0b5 2.19. Views: map and every map mode (29–30 views); widths 1440, 390, 360; theme dark/light. Source: `src/components/Legend/legend-styles.css (.legend-count, .more-count, .sort-label)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/map__1440-en.jpg`
- **A03 Light theme: accent green #16a34a fails as text and under white text (active Map/Table, Export, Apply Filter, badges, active chips, links).** white #f8f9fa on #16a34a 3.13 (306 nodes); #16a34a on #e9fbf0 3.07, on #c9f5d9 2.76, on #ffffff 3.29 (links, Reset filters). Other light palettes: accent 3.3–4.99.. Views: 31–33 views; widths 1440, 390, 360; theme light. Source: `src/index.css (--color-accent light blocks; --primary 142 71% 35%)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/map__1440-en.jpg`
- **A04 Light table: sex symbols and blue active states fail.** ♂ #60a5fa on #e2ecfe 2.14 (78), ♀ #f472b6 on #fce4f0 2.20 (69), «Records»/«Filters» active #60a5fa on #dce7f9 2.04, «All» 2.02. Views: table, table-column-filters, table-columns, field-sites (All); widths 1440, 390, 360; theme light. Source: `src/components/DataTable.vue (.sex-badge, toolbar .active), SiteComparison.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/table__1440-en.jpg`
- **A05 The legend covers what the user opened: the point popup (desktop) and a third of the map, its labels and clusters (phones).** visual: legend (z-order above the popup) hides the popup's site and species list at 1440; on 390 it fills the lower-left ≈⅓ and cuts labels («…Vicente +15»). Views: point-popup, map, clusters, heatmap, ranges, bbox-draw, legend-expanded; widths 1440, 390, 360; theme dark/light. Source: `src/components/Legend/Legend.vue, useLegendPosition.js, PointPopup.vue, map-container-styles.css (z-index)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/point-popup__1440-en.jpg`
- **A06 Light theme is incomplete: phone Menu button and quick pills, the whole gallery, the loading screen, the Update Database header and the phone close button stay dark navy.** measured in light: gallery surfaces #1c2432 / #1e1e1e (stat-label #888888 on #1c2432 4.40); pills rgba(26,26,46,.7); menu button rgba(26,26,46,.88); loading linear-gradient(#1a1a2e,#252540); active «Columns» navy with dim label. Views: map (phones), gallery, gallery-hostplants, gallery-mobile-sidebar, loading, sidebar-bottom, mobile-menu, table-columns; widths 1440, 390, 360; theme light. Source: `src/App.vue:434, :576, :610; src/components/image-gallery-styles.css, GallerySidebar.vue, GalleryThumbnailStrip.vue; DatabaseUpdateSection.vue; DataTable.vue (.btn-columns.active)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/gallery__1440-en.jpg`
- **A07 Light theme: zoom, compass and fullscreen icons are pale grey on white and look disabled.** visual (icons are background images): style.css forces filter: invert(0.8) on every MapLibre control icon, tuned for the dark theme. Views: all map views; widths 1440, 390, 360; theme light. Source: `src/style.css:202, src/components/map-container-styles.css:124–163`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/map__390-en.jpg`
- **A08 No focus indicator on search inputs, and focus rings that vanish on active buttons.** Tab pass at 1440 (30 stops per view, 36 views): 80 of 843 stops show no change (61 are vue-multiselect search inputs, 14 plain inputs, the range thumbs); 82 rings < 3:1 (ring is 3 px currentColor: on the active Map button #1a1a2e on #1a1a2e = 1.0, light #f8f9fa on #f8f9fa = 1.0; setting inputs 2.89; GoaT inputs 1.93). Views: all views with filters, table, smart search; widths 1440; theme dark/light. Source: `src/components/FilterSelect.vue (vue-multiselect), sidebar-styles.css (:focus outline: none ×29 in src), index.css`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/sidebar-taxonomy__1440-en.jpg`
- **A09 Text-field and select boundaries are too faint to find.** light #dee2e6 on #ffffff 1.30, on #f8f9fa 1.24; location search has no border on white (1.0); dark #3d3d5c on #1a1a2e 1.64. Views: 29 views (CAMID, location search, field-sites search, setting inputs, gallery search); widths 1440, 390, 360; theme dark/light. Source: `src/index.css (--color-border), sidebar-styles.css, MapEngine.vue (.location-search), FilterSelect.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/sidebar-other-filters__1440-en.jpg`
- **A10 Controls without an accessible name.** phone map toolbar: layers and palette buttons are icon-only with no aria-label; CAMID textarea and «Search location…» have only a placeholder; table column-filter selects unlabeled (30 at 1440 with filters open); gallery: 9–17 unnamed controls. Views: 29 views; widths 390, 360, 1440; theme dark/light. Source: `src/components/MapEngine.vue (.dropdown-trigger), Sidebar.vue (.camid-textarea), DataTable.vue, ImageGallery.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/map__390-en.jpg`
- **A11 Tap targets far below 44 px on phones.** 1,258 targets < 44 px at 390 (258 < 24 px). Worst: mimicry pager arrows (122 < 24 in one view, ≈16 px), legend SPECIES/SUBSP. 55×22, «+ All GBIF» 63×21, checkboxes 18×18, field-sites row icons ≈24, legend toolbar ≈30. Views: all 34 phone views; widths 390, 360; theme dark/light. Source: `src/components/Legend/Legend.vue, MimicryRingCard.vue, Sidebar.vue, SiteComparison.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/mimicry__390-en.jpg`
- **A12 Phone: the floating Menu + pill rows cover the top of panels and menus.** visual: Field sites title, the first basemap items and the export size bar sit under the pills. Views: field-sites, map-layers-menu, map-theme-menu, preview-export; widths 390, 360; theme dark/light. Source: `src/App.vue (.mobile-quick-bar), SiteComparison.vue, MapEngine.vue (dropdown top offset)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/field-sites__390-en.jpg`
- **A13 Phone map shows no record count or active filters.** visual: «7,850 of 7,850 records» and filter state live only inside the Menu sheet. Views: map, clusters, heatmap, ranges; widths 390, 360; theme dark/light. Source: `src/App.vue (mobile layout), Sidebar.vue (.record-count)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/map__390-en.jpg`
- **A14 Phone gallery: photo runs off the right edge and has no species name; counter overlaps the zoom bar.** visual. Views: gallery, gallery-hostplants; widths 390, 360; theme dark/light. Source: `src/components/ImageGallery.vue, image-gallery-styles.css`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/gallery__390-en.jpg`
- **A15 Phone mimicry dialog cuts off its right card column; pager arrows ≈16 px and faint.** visual + 122 targets < 24 px. Views: mimicry; widths 390, 360; theme dark/light. Source: `src/components/MimicrySelector.vue, MimicryRingCard.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/mimicry__390-en.jpg`
- **A16 Legend editing needs hover: Sort, # counts and the colour/group toolbar appear only while the pointer is over the legend.** the audit had to hover .legend-title before Sort existed; the sidebar hint says «Hover over legend on map…», which a phone cannot do. Views: map, legend-sort, preview-export; widths 1440, 390, 360; theme dark/light. Source: `src/components/Legend/Legend.vue (showEditUI), LegendGroupHeader.vue, SidebarMapSettings.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/legend-sort__1440-en.jpg`

### P2 (12)

- **A17 Theme plumbing: dark is forced as default, light is forgotten on reload, and the boot colour and native controls ignore the mode.** DEFAULT_MODE dark, no prefers-color-scheme; mode and palette persist only when «Remember Settings» is ON (off by default); meta theme-color fixed #1a1a2e; <html> background unset (#ffffff behind the dark app); color-scheme «normal», so native selects, scrollbars and date pickers stay light; the basemap always starts «Dark» (useStyleSwitcher ref('dark')) even when the mode is light. Views: all; widths 1440, 390, 360; theme dark/light. Source: `src/stores/theme.js, src/themes/presets.js, index.html, src/composables/useStyleSwitcher.js`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/loading__1440-en.jpg`
- **A18 Text below 12 px across the sidebar, legend, badges and mimicry cards.** 124 element groups < 12 px: filter-tile counts 9.92 px (#aaaaaa on #3e3e58 4.45; #4ade80 on #305c53 4.35), host-plant descriptions 9.92 px (light #c2e4d0 on #16a34a 2.41), source badges 9.6 px (white on #3a7ae5 4.15), SORT 10 px, attribution 10 px, mimicry meta ≈9.6 px. Views: 34 views; widths 1440, 390, 360; theme dark/light. Source: `src/components/sidebar-styles.css, Legend/legend-styles.css, MimicryRingCard.vue, PointPopup.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/sidebar-hostplants__1440-en.jpg`
- **A19 Extra hues with no stated meaning.** violet border on «Export for R»; blue «View on Map», blue SDM opacity slider, blue «Records»/«Filters» active state; neon per-species frame colours on gallery thumbnails; yellow MEDIUM badge (faint on light). Views: export-data, preview-export, gallery, sdm, table, smart-search; widths 1440, 390, 360; theme dark/light. Source: `ExportPanel.vue, Sidebar.vue (.btn-export-r), GallerySidebar.vue, GalleryThumbnailStrip.vue, DataTable.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/export-data__1440-en.jpg`
- **A20 Selected chips and tiles differ from unselected only by a green tint (no check, no edge ≥ 3:1).** light active chip #16a34a on #e9fbf0 (fill vs #ffffff ≈1.1); dark active tile #4ade80 text on #305c53. Views: sidebar (taxonomy, other filters, data source, visualization); widths 1440, 390, 360; theme dark/light. Source: `src/components/sidebar-styles.css (.filter-tile.active, .source-tile)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/sidebar-taxonomy__1440-en.jpg`
- **A21 Host-plant confidence cards carry meaning in a green/amber/red bar only, with 9.9 px descriptions.** light descriptions #c2e4d0 on #16a34a 2.41, #71777d on #f1f3f5 4.06. Views: sidebar-hostplants, clusters, heatmap, ranges, sdm (scrolled); widths 1440, 390, 360; theme dark/light. Source: `src/components/Sidebar.vue (host plant filters), sidebar-styles.css (.confidence-*)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/sidebar-hostplants__390-en.jpg`
- **A22 Admin «Update Database» form (password + green «Start Update») is shown to every visitor, a second primary button beside Export.** visual. Views: sidebar-bottom; widths 1440, 390, 360; theme dark/light. Source: `src/components/DatabaseUpdateSection.vue, config.js (features.databaseUpdate)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/sidebar-bottom__1440-en.jpg`
- **A23 Facts and controls shown twice.** palette menu + mode toggle in both the map toolbar and the table toolbar; Field sites has a «Busiest / By records» toggle and a Sort select; gallery «Search summary» repeats the species/individual counts already in the badges; «Tena, Napo, Ecuador» listed twice; the species legend stays on in heatmap and hex-range modes where its colours do not apply. Views: table, field-sites, gallery, location-search, heatmap, ranges; widths 1440, 390, 360; theme dark/light. Source: `DataTable.vue, MapEngine.vue, SiteComparison.vue, GallerySidebar.vue, useLocationSearch.js, Legend.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/heatmap__1440-en.jpg`
- **A24 Modes and loads without a caption.** bbox mode only tints its button (no «drag on the map»); host-plant gallery spinner has no caption and photo-less thumbnails are empty dark boxes; the empty-map notice does not say which filter emptied it. Views: bbox-draw, gallery-hostplants, map-empty; widths 1440, 390, 360; theme dark/light. Source: `useBoundingBoxSelection.js, ImageGallery.vue, GalleryThumbnailStrip.vue, MapEngine.vue (.map-empty-notice)`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/bbox-draw__1440-en.jpg`
- **A25 Light map: grey markers on the pale Positron basemap; navy cluster discs; heatmap yellow on white; hex density has no colour key.** visual (WebGL layers are not in the DOM; marker vs tile ratio not measured). Views: map, clusters, heatmap, ranges; widths 1440, 390; theme light. Source: `src/composables/useDataLayer.js, useClusterComposition.js, utils/heatmap.js, utils/rangePolygons.js`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/light/map__1440-en.jpg`
- **A26 Phone pill row overflows (Mimicry, Export cut) with no scroll hint; legend «#» overlaps «SUBSP.»; legend names truncated.** visual. Views: map, legend-expanded; widths 390, 360; theme dark/light. Source: `src/App.vue (.mobile-quick-bar), Legend.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/map__360-en.jpg`
- **A27 Phone table: header and four toolbar rows use ≈370 of 844 px; the table is wider than the screen with no scroll hint.** visual. Views: table, table-column-filters, table-columns; widths 390, 360; theme dark/light. Source: `src/components/DataTable.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/table__390-en.jpg`
- **A28 Focus rings on setting inputs are translucent glows below 3:1.** rgba(74,222,128,.15) 2 px glow 2.89; GoaT inputs rgba(59,130,246,.15) 1.93; aspect select transparent ring 1.0. Views: clusters, sidebar-other-filters, preview-export; widths 1440; theme dark/light. Source: `src/components/sidebar-styles.css, SidebarMapSettings.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/clusters__1440-en.jpg`

### P3 (5)

- **A29 Disabled labels below the app's 3:1 bar, with no reason given.** «Clear Selection» #a1a5a9 on #f8f9fa 2.37 (light), 2.83 (dark); disabled Gallery 2.55; gallery Reset 2.71; order arrows 2.01. Views: mimicry, loading, gallery; widths 1440, 390, 360; theme dark/light. Source: `MimicrySelector.vue, sidebar-styles.css, GallerySidebar.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/mimicry__1440-en.jpg`
- **A30 Phone hints that assume a mouse or keyboard.** «Hover over legend on map…», «Use ↑↓ to navigate, Enter to apply». Views: sidebar-bottom, smart-search-empty; widths 390, 360; theme dark/light. Source: `SidebarMapSettings.vue, CommandPaletteDialog.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/smart-search-empty__390-en.jpg`
- **A31 Clipped placeholders and labels.** 28 clipped-text groups, e.g. «Filter specie», smart-search placeholder cut at 390. Views: smart-search, table-column-filters, mobile-menu; widths 1440, 390, 360; theme dark/light. Source: `DataTable.vue, CommandPaletteDialog.vue`. Shot: `/home/franz/.local/share/ui-overhaul-20261031/atlas/audit-before/dark/table-column-filters__1440-en.jpg`
- **A32 Reduced motion barely respected.** prefers-reduced-motion in 2 rules only; 6 spin animations (loading only, acceptable); slide/fade transitions on panels everywhere. Views: all; widths 1440; theme dark/light. Source: `src/**/*.css, *.vue`.
- **A33 Theming debt that will slow the dark/light work.** 245 distinct hard-coded hex values and 432 rgba() in component CSS; 971 var(--x, #hex) fallbacks with dark defaults; undefined variables used (--accent-color, --color-bg-hover, --error-color, --text-muted); unused ThemeSelector.vue (277 lines). Views: all; widths –; theme dark/light. Source: `src/components/*.css, *.vue`.

### Checked, not an issue

- No photo or map canvas carries a CSS filter in either theme (measured on every view). Satellite imagery stays untouched.
- The citation URL showed `127.0.0.1` only because the audit ran locally. On the live site it is the public address.
- The six infinite animations are all loading spinners.

## Current theming: how dark mode is built today

**Dark mode exists and is the default.** `DEFAULT_MODE = 'dark'` in `src/themes/presets.js`.

**Theme state.** `src/stores/theme.js` (Pinia) sets three things on `<html>`:
- `data-theme`, one of 5 palettes: emerald (default), ocean, forest, sunset, lavender;
- `data-mode` (`light` or `dark`);
- the classes `theme-<name>` and `dark`/`light`.

**Where you switch it.**
- A palette menu and a sun/moon button in the map toolbar (`MapEngine.vue`).
- The same pair again in the table toolbar (`DataTable.vue`).
- A toggle command in Smart Search (`CommandPaletteDialog.vue`).
- `ThemeSelector.vue` is a fourth copy, and no file imports it.

**Two variable sets per palette × mode, all in `src/index.css` (10 blocks).**
1. **shadcn tokens in HSL** (`--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, `--ring` …). They are mapped into Tailwind v4 with `@theme inline { --color-background: hsl(var(--background)) … }`. Only the shadcn/reka-ui primitives in `src/components/ui/*` use them (16 files with Tailwind colour classes).
2. **"Legacy" hex tokens** (`--color-bg-primary/secondary/tertiary`, `--color-text-primary/secondary/muted`, `--color-accent`, `--color-border` …). These carry the real app:
   - component CSS reads them about 1,100 times;
   - the most used are accent 223, border 172, text-muted 148, text-primary 134, text-secondary 125 and bg-tertiary 104.

**Tailwind.** v4 through `@tailwindcss/vite`. No `dark:` variant is used anywhere; the dark look comes entirely from swapping variables.

**Hard-coded colour.**
- 245 distinct hex values and 432 `rgba()` in component CSS. The largest share is in `sidebar-styles.css` (223 hex), then `DataTable.vue` 136, `map-container-styles.css` 86 and `PointPopup.vue` 69.
- 971 `var(--x, #hex)` fallbacks whose defaults are the dark emerald values.
- These are why parts stay dark in light mode (finding A06): `App.vue` loading gradient, menu button and pills; `image-gallery-styles.css`; `GallerySidebar.vue`; `DatabaseUpdateSection.vue`.
- Some variables are used but never defined: `--accent-color`, `--color-bg-hover`, `--error-color`, `--text-muted`.
- `--color-border` is defined twice: once as a Tailwind theme colour (HSL) and once as the legacy hex. The legacy value wins in `var()`.

**Contrast of the tokens themselves** (computed from `index.css`, on bg-primary / bg-secondary / bg-tertiary):

Palette and mode | text-primary | text-secondary | text-muted | accent as text | border on bg-secondary
---|---|---|---|---|---
Emerald light | 14.6 / 15.4 / 13.9 | 7.8 / 8.2 / 7.4 | **3.15 / 3.32 / 2.99** | **3.13 / 3.30 / 2.96** | 1.30
Emerald dark (default) | 12.9 / 11.2 / 10.0 | 7.3 / 6.4 / 5.7 | **2.97 / 2.58 / 2.31** | 9.8 / 8.5 / 7.6 | 1.43
Ocean light / dark | ok | ok | **3.50 / 3.79 / 3.38**; **4.59 / 3.93 / 3.31** | **3.4–3.7** / ok | 1.55 / 1.59
Forest light / dark | ok | dark tertiary 4.82 | **3.4–3.9**; **2.8–3.7** | 4.4–5.0 / ok | 1.50 / 1.74
Sunset light / dark | ok | ok | **3.6–4.0**; **3.0–4.1** | **3.2–3.6** / ok | 1.50 / 1.47
Lavender light / dark | ok | ok | **3.4–3.9**; **2.6–3.4** | **3.7–4.2** / ok | 1.53 / 1.47

The muted text token fails 4.5:1 in all 10 sets. Every light accent except forest's fails as text. Borders never reach 3:1.

**Boot and the browser.**
- `index.html` has a fixed `<meta name="theme-color" content="#1a1a2e">`.
- Nothing sets the `<html>` background (it measured `#ffffff` behind the dark app), and `color-scheme` is `normal`. Native selects, scrollbars and date pickers therefore don't follow the mode. `DateFilter.vue` works around this with `filter: invert(1)` on the date icon.
- `prefers-color-scheme` is never read.
- Mode and palette survive a reload only if the visitor turns on «Remember Settings» (off by default, `stores/persistence.js`). Every visit starts dark.

**Map.**
- MapLibre GL 5 with vector basemaps from `src/utils/mapStyles.js`:
  - Day: Carto Positron (`light`), Stadia Alidade Smooth, Stamen Toner Lite and Stamen Terrain, OpenTopoMap raster (Terrain), OSM raster (Streets), Esri World Imagery (Satellite);
  - Night: Carto Dark Matter (`dark`), Alidade Smooth Dark, Stamen Toner.
- The sun/moon button switches the basemap to its `pair` (`getBasemapPair`). Choosing the palette or reloading doesn't, and `useStyleSwitcher` always starts on `dark`.
- Tiles are never inverted or filtered.
- MapLibre's own controls are restyled in `src/style.css` (`invert(0.8)` icons, a `rgba(26,26,46,.85)` scale bar) and in `map-container-styles.css` (a chain of filters on the compass icon). That is why they look washed out on the light basemap.
- Markers, clusters, heatmap and hex ranges are WebGL layers coloured in `useDataLayer.js`, `useClusterComposition.js`, `utils/heatmap.js`, `utils/rangePolygons.js` and `stores/dataColorPalette.js`. They are the same in both modes.
- SDM rasters use a fixed warm ramp (`useSDMLayer.js`).

**Photos and charts.**
- Photos get no filter.
- The gallery always uses a dark mat, whatever the mode.
- The time-range histogram (`TimeSlider.vue`) and the SDM response plots use fixed greens. There is no charting library and no theme hook for them.

**What this means for the dark-theme work.** The structure the principles ask for is already half there: variables per mode, and an attribute on `<html>`. The work is:
1. Collapse the two variable sets into one set of role tokens, with values that pass (the lab app's token table is a starting point; the Atlas canvas is navy, not green-black).
2. Replace the hard-coded colours and `#hex` fallbacks in roughly a dozen CSS files.
3. Theme the boot screen, `theme-color`, `color-scheme` and the map controls.
4. Decide whether the 5 palettes stay. Each palette multiplies every pair that has to be measured, and only emerald is the default.
