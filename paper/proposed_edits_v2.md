# Proposed Edits v2 — Manuscript Updates (March 2026)

These edits update the Google Docs manuscript (`manuscript_addressed comments.md`) with recently implemented features and corrected data. The sequencing numbers were verified against the current pipeline output (2,074 Sequenced, 2,659 Tissue at Sanger, 1,105 Tissue Available, 435 Preserved Specimen — matching the manuscript).

---

## 1. GoAT Genomic Data Integration (NEW FEATURE)

This is the most significant new feature since the last manuscript version. It integrates chromosome numbers, genome size, and assembly availability from the Genomes on a Tree (GoaT) database.

### Edit 1a: Add to Section 2.5 "Data Sources and Processing Pipeline"

**After** the paragraph about "GBIF occurrence data" and before "Data merging," **add a new data source paragraph:**

> **Genomic metadata from GoaT.** The platform retrieves species-level genomic metadata from the Genomes on a Tree (GoaT) database (https://goat.genomehubs.org), which aggregates information on chromosome numbers, genome sizes, and genome assembly availability across the tree of life. A Python script queries the GoaT API for all Lepidoptera species and caches the results locally. For each species, the platform displays the haploid chromosome number (n) or diploid number (2n) when available, the estimated or measured genome size in megabases, and whether a reference genome assembly exists. In the map popup, the species' chromosome number is shown alongside the median and range for its genus (computed from species present in the dataset), providing immediate context for whether a value is typical or unusual. The data table includes sortable and filterable columns for these genomic fields, with links to the corresponding GoaT species page for full details.

### Edit 1b: Add to Section 2.5 "Web Interface"

**In the paragraph starting "A sortable, paginated data table shows all records..."**, replace with:

> A sortable, paginated data table shows all records matching the current filters, with photo thumbnails, adjustable column visibility, and column-level filters (dropdown selection for text columns, range sliders for numeric columns). The table can switch between a specimen-level view showing individual records and a species-level view summarizing occurrence counts, genomic information from GoaT (chromosome number, genome size, assembly availability), and representative photographs. Columns for chromosome number and genome size are sortable, enabling researchers to quickly identify species with unusual karyotypes or those lacking genomic data.

### Edit 1c: Add to Section 3.5 "Research Applications"

**Add a new paragraph after the sequencing status paragraph:**

> The integration of GoaT genomic metadata adds another dimension to research planning. By sorting the data table by chromosome number, researchers can identify species with unusual karyotypes that may be of interest for studies of chromosomal evolution or speciation. The genus-level range displayed alongside each species' chromosome number (e.g., "2n = 30, genus range: 14-60") helps flag potential outliers or misidentifications. Filtering for species that lack a reference genome assembly highlights candidates for future sequencing efforts, while the genome size column helps estimate sequencing costs. These genomic filters can be combined with geographic and taxonomic filters to answer questions such as "which unsequenced species in Ecuador have tissue available at Sanger?"

### Edit 1d: Add to Section 4.3 "Limitations and Future Directions"

**In the paragraph about future ecological layers, add after the first sentence:**

> We have already taken a first step in this direction by integrating genomic metadata from GoaT (chromosome numbers, genome sizes, assembly availability), allowing researchers to assess the genomic landscape of Ithomiini directly from the map interface.

### Edit 1e: Update Section 5 "Conclusions"

**Replace the sentence about Ithomiini Maps with:**

> Ithomiini Maps integrates diverse occurrence data sources into an interactive mapping platform with taxonomic filters, mimicry ring selectors, sequencing status indicators, genomic metadata from GoaT (chromosome numbers, genome sizes, assembly availability), and both image and R script export for publications.

---

## 2. Sequencing Status Categories (CORRECTION — already applied in manuscript)

The manuscript already has the corrected numbers (2,074 Sequenced, 2,659 Tissue at Sanger, etc.). However, Section 2.5 "Sanger Institute collection data" still describes the old classification logic. This needs updating.

### Edit 2a: Update Section 2.5 "Sanger Institute collection data"

**Replace:**
> Sequencing status is assigned based on specimen metadata: specimens with valid tube rack entries are classified as "Sequenced," those with tissue samples as "Tissue Available," and the rest as "Preserved Specimen."

**With:**
> Sequencing status is assigned based on specimen metadata in four categories: specimens with a Tree of Life ID (ToLID) are classified as "Sequenced," those with a tube rack entry but no ToLID as "Tissue at Sanger" (submitted to the sequencing pipeline but not yet completed), those with tissue samples but no rack entry as "Tissue Available," and the rest as "Preserved Specimen."

---

## 3. Colorblind-Safe Palettes (NEW FEATURE)

Colorblind-safe palettes were added per Joana's request.

### Edit 3a: Add to Section 2.5 "Web Interface"

**In the paragraph about the sidebar filters, after "data source toggles for each of the five sources," add:**

> The default color palette uses colorblind-safe colors to ensure accessibility; researchers can also customize individual colors through the legend editor.

### Edit 3b: Mention in Section 5 "Conclusions" or Discussion

No specific edit needed — covered implicitly by the general description. But if Joana asks, it is implemented.

---

## 4. Heatmap Visualization and Time Slider (FEATURES added ~Feb 2026)

These were added in February but may not be fully described in the manuscript.

### Edit 4a: Add to Section 2.5 "Web Interface"

**After the sentence about base map styles, add:**

> In addition to individual points and clusters, researchers can switch to a heatmap visualization that displays occurrence density as a continuous color gradient, useful for identifying concentration hotspots across large datasets. A time slider allows filtering records by date range, animating how recorded distributions change over collection periods.

---

## 5. Performance Optimizations (IMPROVEMENT — worth a brief mention)

The app now handles 105k+ points smoothly with batched source loading, debounced map updates, and cached hover highlighting.

### Edit 5a: Add to Section 2.5 "Web Interface" or "Deployment"

**Brief addition (one sentence):**

> To maintain responsive performance with over 100,000 points, the application batches data source loading, debounces map layer updates, and caches hover interactions, ensuring smooth interaction even on modest hardware.

---

## 6. Country Name Standardization (DATA FIX — pipeline improvement)

Country codes from GBIF (MX, BR, CO...) are now automatically converted to full names using the pycountry library. This fixed an issue where the same country appeared multiple times under different formats.

### Edit 6a: Add to Section 2.5 "Data merging"

**Add a sentence at the end of the data merging paragraph:**

> Country names are standardized automatically using the pycountry library, converting ISO two-letter codes from GBIF records to full country names and normalizing variant spellings (e.g., "French-Guiana" to "French Guiana"), ensuring consistent geographic filtering across all data sources.

---

## 7. Updated Table 1 Numbers (DATA UPDATE)

The table in the Google Doc may need minor updates if data has changed since the last edit. Current verified numbers:

| Data Source | Records | Species | Subspecies | Genera | Countries |
|---|---|---|---|---|---|
| Dore et al. (2023) | 28,927 | 387 | 999 | 48 | 23 |
| Sanger Institute | 7,265 | 513 | 597 | 175 | 8 |
| iNaturalist | 19,901 | 252 | 175 | 41 | 25 |
| GBIF (UNAM) | 21,586 | 35 | 25 | 19 | 1 |
| GBIF (Other Institutions) | 28,182 | 428 | 469 | 43 | 32 |
| **Total (merged)** | **105,861** | **849** | **1,380** | **184** | **33** |

The text before Table 1 should say **105,861** total records (currently says 104,382). Other inline numbers in 3.1 should be checked against this table.

### Edit 7a: Update Section 3.1 paragraph

**Replace:**
> The Ithomiini Maps platform integrates 104,382 occurrence records from five data sources (Table 1).

**With:**
> The Ithomiini Maps platform integrates 105,861 occurrence records from five data sources (Table 1).

Also update "The merged dataset spans 849 species, 1,380 subspecies, and 184 genera across 33 countries" — these match current data, so only the total records number needs updating.

### Edit 7b: Update Section 3.3 Taxonomic Curation

**Replace:**
> the automated curation pipeline resolved the taxonomy for all 104,382 records

**With:**
> the automated curation pipeline resolved the taxonomy for all 105,861 records

Check if curation numbers in Table 2 also need refreshing — they may have changed slightly with the updated dataset.

---

## 8. GoaT Reference (NEW CITATION)

### Edit 8a: Add to References

> Challis, R., Richards, E., Rajan, J., Sherlock, G., & Blaxter, M. (2023). Genomes on a Tree (GoaT): A centralized resource for eukaryotic genome sequencing initiatives. Wellcome Open Research, 8, 24. https://doi.org/10.12688/wellcomeopenres.18658.1

---

## Summary of Priority

1. **GoAT integration** (Edits 1a-1e) — Most important, major new feature addressing Joana's comment id="12"
2. **Sequencing status logic** (Edit 2a) — Important correction to methods accuracy
3. **Total records update** (Edits 7a-7b) — Quick number fix
4. **Heatmap/time slider** (Edit 4a) — Features already implemented, worth mentioning
5. **Country standardization** (Edit 6a) — Pipeline improvement, brief mention
6. **Colorblind palettes** (Edit 3a) — Brief mention, addresses Joana's request
7. **Performance** (Edit 5a) — Optional, one sentence
