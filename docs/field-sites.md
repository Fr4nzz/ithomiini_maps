# Field sites and locality labels

**Taxon selection.** Selected subspecies narrow only the species they belong to. With M. polymnia, M. lysimnia and I. salapia selected, choosing *derasa* keeps every Mechanitis record and only I. salapia *derasa*. The Subsp. dropdown groups options by species. Without a species selection, subspecies apply to all records; the OR combinator keeps its global meaning. Links use the ordinary `sp` and `ssp` parameters.

**Locality labels.** Names of recorded collection localities appear on the map (Field sites panel → Show location names), with a minimum record threshold. Shortlisted sites bypass the threshold. Each label has a thin leader to its recorded coordinate; labels avoid each other and the markers, and are omitted when crowded. Cluster labels name the busiest named locality plus the number of other sites (`Suchipakari +3 sites`). Label colours follow the basemap: light text on dark and satellite maps, dark text on light maps.

**Field sites panel.** Opened from the right-edge tab. Lists sites across the filtered records (not only the visible map) with per-target record counts, a shortlist, CSV export and a Google Maps link per recorded coordinate. Site identity combines normalized locality, country and a ~5 km geohash cell, so a locality can split at a cell boundary and similar spellings are not merged. Counts are available records, not abundance or collecting success.

**Clusters and heatmap.** Cluster markers show record totals with optional composition rings in the current legend colours. Collapsing a species in the legend recolours its records with one species colour without changing the selection. Heatmap weights are log-compressed per location so single records stay visible and stacked records do not saturate the map.

Run `node scripts/benchmark-locality-labels.mjs` against a running preview to measure label placement cost.
