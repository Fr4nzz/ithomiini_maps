**From Photos to Maps: An open-source toolkit for specimen digitization, image sharing, and interactive distribution mapping of Ithomiini butterflies**

**Franz Chandi**^1, **Patricio A. Salazar Carrion**^2,3, **Joana I. Meier**^3

^1 Universidad San Francisco de Quito, Quito, Ecuador

^2 Department of Zoology, University of Cambridge, Cambridge, United Kingdom

^3 Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom

# Abstract

Ithomiini butterflies are among the most species-rich butterfly tribes in the Neotropics, yet researchers who study them face a fragmented workflow: thousands of specimen photographs need manual renaming, image collections sit in disconnected cloud folders, and occurrence records from published datasets, institutional databases, and GBIF must be combined and cleaned before they can be mapped. Here we present three connected open-source web applications that together cover this entire pipeline. The AI Photo Processor uses Google's Gemini AI to read handwritten specimen identifiers from photographs and rename image files in batch. The Wings Gallery serves as a centralized, filterable browser for high-resolution wing photographs stored on Google Drive. Ithomiini Maps integrates 104,382 occurrence records across 751 species from five data sources into a single interactive map with taxonomic filters, mimicry ring selectors, sequencing status indicators, and export tools for both images and R scripts. All three applications run in the user's browser and are hosted on GitHub Pages at no cost. We describe the architecture, data pipelines, and taxonomic curation procedures, illustrate how researchers can use these tools to explore questions in mimicry, biogeography, and genomic sampling, and discuss how this approach can be adapted to other taxa.

**Keywords:** biodiversity informatics, Nymphalidae, interactive maps, specimen digitization, Lepidoptera, open-source, mimicry rings, GBIF, distribution mapping

# 1. Introduction

Ithomiini butterflies (Nymphalidae: Danainae) form one of the largest and most ecologically influential butterfly tribes in the Neotropics. Over 390 described species inhabit the forests of Central and South America, where they participate in elaborate Mullerian mimicry complexes that shape the composition of entire butterfly communities (Willmott & Freitas, 2006; Chazot et al., 2019). Because multiple unrelated species converge on the same wing color patterns within a given locality, Ithomiini have become a model system for studying how natural selection drives speciation and maintains biodiversity (Elias et al., 2008; Jiggins, 2017). Dore et al. (2023) recently published nearly 29,000 georeferenced occurrence records with mimicry ring classifications, and ongoing genomic sequencing at the Wellcome Sanger Institute continues to generate new specimen data. Together, these resources create an opportunity to study Ithomiini biogeography at a scale that was not previously possible.

Turning that opportunity into practice, however, requires solving several practical problems. Researchers working with Ithomiini specimens typically photograph thousands of preserved wings, then must read a handwritten identifier label from each photograph and rename the file accordingly. Renamed images are uploaded to cloud storage but remain scattered across folders with no browsing interface. Geographic data from published records, institutional databases, GBIF, and iNaturalist must be manually combined, cleaned for taxonomic inconsistencies, and mapped using GIS software. Each of these steps relies on different tools, introduces delays, and creates opportunities for errors.

Early attempts to address the image-sharing problem using R-Shiny applications hosted on free cloud instances ran into practical limitations: IP-based URLs were not user-friendly, and free DNS services providing custom domains were blocked by internet service providers in some countries, making the applications unreachable for collaborators. These experiences motivated a migration to GitHub Pages, which provides free, reliable static hosting without such dependencies.

Interactive web-based mapping tools have shown promise for biodiversity visualization. Rosser & Mallet (2024) developed open-source interactive maps for *Heliconius* butterflies using R and the Leaflet library, hosted as a static website on GitHub. Their platform allows researchers to visualize phenotypic and geographic data in a single interface, and their explicit goal of making their methods "straightforward for researchers to adapt to their own taxa" inspired this work. However, the R/Leaflet approach has limitations in interactivity: filter changes can be slow with large datasets, customization options are constrained by R-Shiny or static HTML capabilities, and the platform addresses only the visualization step. The earlier steps of specimen digitization, image management, and multi-source data integration remain outside its scope.

Here we present a toolkit of three connected open-source applications that together cover the complete specimen-to-map pipeline:

1. **AI Photo Processor** -- A desktop application that uses Google's Gemini AI to read handwritten specimen identifiers from wing photographs in batch, enabling automated file renaming at scale. While built for entomological collections, users can customize the AI prompt to extract other types of information from images, making it adaptable to different research contexts.

2. **Wings Gallery** -- A serverless web gallery for browsing, filtering, and sharing high-resolution wing photographs stored on Google Drive, with one-click database updates.

3. **Ithomiini Maps** -- An interactive mapping platform that brings together occurrence records from published literature, institutional sequencing databases, and GBIF into a single interface with taxonomic, phenotypic, and sequencing status filters, along with map and data export features.

All components use Vue.js for the web interface and Python for data processing, hosted as static sites on GitHub Pages. The applications run entirely in the user's browser with no dedicated servers. Website hosting is free through GitHub; the only expense is cloud storage for specimen photographs on Google Drive. Data processing pipelines run through GitHub Actions so that updates happen automatically in the cloud. A detailed protocol for the complete photography-to-gallery workflow is available separately (Chandi et al., in prep.).

# 2. Methods and Implementation

## 2.1 System Architecture Overview

The toolkit separates data processing from data display (Figure 1). Processing happens in the cloud through GitHub Actions automated pipelines, and the resulting files are served as a static website via GitHub Pages. This separation keeps the website lightweight (no computation happens on a server), allows data to be refreshed by re-running processing scripts, and eliminates hosting costs beyond Google Drive storage for specimen photographs.

All three applications share a common technology stack: Vue.js 3 for the user interface, Vite as the build tool, Python with Pandas for data processing, GitHub Pages for hosting, and GitHub Actions for automated pipelines.

## 2.2 AI Photo Processor

Large-scale specimen photography generates thousands of image files with generic camera-assigned filenames. Each specimen is typically photographed from two angles (dorsal and ventral), with a handwritten identifier label placed alongside the wings. Manually reading these identifiers and renaming each file is slow and error-prone, especially when processing hundreds or thousands of images.

The AI Photo Processor (https://github.com/Fr4nzz/rename_photos_AI) is a desktop application built with Python and PyQt5 that automates this task. It uses Google's Gemini AI, a generative model with image understanding capabilities, to read handwritten specimen labels within photographs. The application is distributed both as Python source code and as a standalone Windows executable requiring no installation.

The processing pipeline works in six steps. First, the application handles **image rotation**: since cameras mounted pointing downward produce varying EXIF orientation tags, the application applies EXIF-safe rotation across multiple formats including JPEG, HEIC/HEIF, and RAW files, modifying only orientation metadata rather than pixel data. Second, **cropping** isolates the label region of each photograph through a graphical interface with live preview. This removes the butterfly wings, ruler, and color palette from the field of view so that the identifier fills more of the image, improving AI reading accuracy. Third, **grid assembly** combines multiple cropped images into composite grids to maximize the efficiency of each API request. By default, the application creates 3x3 grids and sends 5 grids per message, processing 45 images per API call. Under the free API tier, this allows roughly 900 images to be processed per day at no cost. Fourth, **AI prompting** sends each composite image to the Gemini API with a text prompt that instructs the model to read the specimen identifier from each cell. The application uses Gemini 3 Flash, recommended for its strong vision capabilities and free-tier compatibility. Because the prompt is fully customizable, researchers working with other specimen types, such as herbarium sheets, geological samples, or archaeological artifacts, can adapt the tool by changing the prompt text. Fifth, a **review interface** displays thumbnail images alongside their AI-read identifiers, flagging potential problems: unpaired identifiers (each specimen should produce exactly two images), duplicate IDs, and empty results. Users can edit identifiers, skip damaged images, and sort results by various criteria. Sixth, **file renaming** assigns "d" and "v" suffixes for dorsal and ventral views (e.g., CAM012345d.JPG, CAM012345v.JPG). All renames are logged and can be undone through a restore function.

## 2.3 Wings Gallery

Once specimen photographs are renamed and organized, researchers need a way to browse, filter, and share images without downloading entire folder structures. The Wings Gallery (https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery) replaces an earlier R-Shiny version that faced the accessibility and performance limitations described in the Introduction. The Vue.js architecture provides faster load times and full control over the user interface.

The Wings Gallery is a single-page application deployed on GitHub Pages. Image files are uploaded to shared folders on Google Drive, where a custom Google Apps Script automatically indexes all files across multiple folders into a Google Sheets spreadsheet, recording metadata such as filename, URL, capture date, size, and folder path. This script uses the LongRun library to work around the 6-minute execution limit of Google Apps Script, enabling it to process thousands of files across nested folder structures without manual intervention. A Python processing script then downloads the spreadsheet data, resolves image URLs through a multi-tier image delivery system for optimized loading, and generates data files for the website.

The application provides five views. The **Collection** tab filters individuals by taxonomic level (Family, Subfamily, Tribe, Species, Subspecies) and sex. The **Insectary** tab displays specimens from the insectary collection, filtered by Insectary ID and biological metadata. The **CRISPR** tab shows CRISPR-injected specimens, allowing filtering by mutant phenotype. The **Search** tab enables fast lookup by specimen identifier (CAMID). The **Update DB** tab allows any team member to refresh the database with a single click: this sends a request through a Cloudflare Worker (a serverless edge function) that triggers a GitHub Actions workflow, which runs the Python processing script, saves updated data files to the repository, and automatically redeploys the website. This removes the need for technical expertise to keep the gallery current.

The gallery supports Shift+scroll to zoom all images simultaneously and Ctrl+scroll to zoom individual images. The image grid automatically adjusts the number of columns based on screen width and zoom level.

## 2.4 Ithomiini Maps

### 2.4.1 Motivation

A central question in Ithomiini research is how mimicry ring distributions relate to geography, climate, and species ranges. Answering this question requires mapping thousands of occurrence records from sources that use different taxonomic names, different data formats, and different quality standards. Researchers also need to identify which species have been sequenced, where tissue samples are available, and how these genomic resources overlap with known distributions. Existing tools either require GIS expertise (QGIS, ArcGIS) or lack the specimen-level filtering needed for genomic research planning.

### 2.4.2 Data Sources and Processing Pipeline

The Ithomiini Maps platform (https://rapidspeciation.github.io/ithomiini_maps/) consolidates five data sources into a single interface:

**Dore et al. (2023) published records.** An Excel file containing 28,927 georeferenced occurrence records with full taxonomic classification, mimicry ring assignments for males and females, and observation metadata. This dataset provides the lookup table used to assign mimicry ring data to records from other sources.

**Sanger Institute collection data.** Real-time data from a Google Sheets database maintained by the sequencing team. Each record includes specimen identifier (CAMID), taxonomic classification, collection locality, GPS coordinates, sequencing status, and links to wing photographs. Sequencing status is assigned based on specimen metadata: specimens with valid tube rack entries are classified as "Sequenced," those with tissue samples as "Tissue Available," and the rest as "Preserved Specimen."

**GBIF occurrence data.** An automated download script queries the GBIF API (DOI: 10.15468/dl.pbs3eu) for all Ithomiini occurrences. Records are pre-filtered before download to ensure data quality: only records with valid geographic coordinates are included, records flagged for geospatial issues are excluded, only confirmed presence records are kept, and fossils and living specimens are removed. The downloaded records are automatically split into three sub-sources based on their origin: **iNaturalist** (research-grade citizen science observations), **GBIF (UNAM)** (records from the Universidad Nacional Autonoma de Mexico museum collections, a major Neotropical entomological collection), and **GBIF (Other Institutions)** (records from all remaining collections and datasets). This separation allows users to toggle each sub-source independently, making it possible to assess data origin and quality at a glance.

**Data merging.** The processing pipeline loads all five sources, standardizes field names, and applies consistent taxonomic formatting. A mimicry ring lookup table built from the Dore et al. (2023) dataset links each species-subspecies pair to its male and female mimicry ring values. This lookup is then applied to Sanger Institute and GBIF records, first trying an exact match on species and subspecies, then falling back to a species-only match. This ensures mimicry ring data are available even for records that lack subspecies identification.

### 2.4.3 Taxonomic Curation Pipeline

Combining records from different sources requires resolving taxonomic inconsistencies: synonyms, misspellings, and outdated names. The curation pipeline processes each unique scientific name through multiple steps. First, known misspellings and reclassifications are corrected using a manually maintained corrections file. Second, names are checked against the GBIF backbone taxonomy; exact matches are accepted and synonyms are resolved to their currently accepted name. Results are cached locally to avoid repeated API calls. Third, names that GBIF cannot resolve are checked against a reference taxonomy compiled from Butterflies of America (Warren et al., 2023) and nymphalidae.net. Fourth, a similar process handles subspecies names, including edit-distance comparison to detect likely typographical errors.

Each curated record includes a curation_basis field that documents how the name was resolved (e.g., "GBIF exact match," "GBIF synonym," "Reference taxonomy"), ensuring full traceability. Original names are preserved alongside corrected versions, and researchers can review all corrections in the data table.

### 2.4.4 Frontend Interface

The web interface uses Vue.js with MapLibre GL JS, a WebGL-accelerated mapping library that maintains smooth interaction with tens of thousands of points.

**Map display.** Five base map styles are available: Dark, Light, Satellite (Esri), Terrain, and Streets. At low zoom levels, nearby points are grouped into clusters showing the number of records. Clicking a cluster expands it to reveal individual points, which are colored according to the active legend.

**Filter system.** The sidebar organizes filters by category: cascading taxonomic filters from Family to Subspecies with multi-select and fuzzy search; sequencing status toggles; a mimicry ring selector displaying wing pattern icons alongside ring names; a date range slider; CAMID search; sex filter; and data source toggles for each of the five sources. Each data source loads on demand to keep initial page loads fast.

**URL sharing.** All active filters are encoded in the URL, so researchers can share exact search configurations with colleagues by copying a link. Opening a shared URL restores the complete filter state, map position, and zoom level.

**Specimen details and image gallery.** Clicking a map point opens a popup showing specimen metadata, taxonomic classification, sequencing status, and a wing photograph when available. If no photograph exists for a specific individual, the system displays one from another individual of the same species or subspecies as a reference. A full-screen image gallery allows detailed examination with zoom, pan, and keyboard navigation.

**Data table.** A sortable, paginated table shows all records matching the current filters, with photo thumbnails and adjustable column visibility.

**Export tools.** The application exports the current map view as a high-resolution image (PNG or JPG, up to 300 DPI) suitable for publications, with customizable legend position, aspect ratio, and scale bar. For researchers who prefer to work in R, the application generates a complete R/ggplot2 package as a ZIP file containing the filtered data as GeoJSON, map settings, legend configuration, a basemap image, and a ready-to-run R script that recreates the map as a vector graphic (PDF or SVG). The export panel also provides CSV and GeoJSON downloads of the filtered dataset, along with a formatted scientific citation that includes the Git commit hash for precise reproducibility.

### 2.4.5 Deployment

The application deploys through GitHub Actions. Code changes trigger an automated build-and-publish workflow. A separate workflow can be triggered manually to refresh occurrence data from live sources. Since everything runs on GitHub's servers, no physical computer or paid hosting is needed. The application is accessible at https://rapidspeciation.github.io/ithomiini_maps/.

# 3. Results

## 3.1 Data Summary

The platform integrates 104,382 occurrence records from five data sources (Table 1). The largest contributors are the Dore et al. (2023) dataset (28,927 records), GBIF records from non-UNAM institutions (27,819), and the UNAM museum collections (21,586). iNaturalist contributes 19,328 research-grade observations, and the Sanger Institute collection adds 6,722 specimens with sequencing status data. The merged dataset spans 751 species, 1,365 subspecies, and 178 genera across 33 countries.

**Table 1.** Data sources integrated in Ithomiini Maps. GBIF data (DOI: https://doi.org/10.15468/dl.pbs3eu) were pre-filtered for valid coordinates, no geospatial issues, confirmed presence, and excluding fossils and living specimens.

| Data Source | Records | Species | Subspecies | Genera | Countries |
| :---- | ----: | ----: | ----: | ----: | ----: |
| Dore et al. (2023) | 28,927 | 374 | 999 | 48 | 23 |
| Sanger Institute | 6,722 | 459 | 579 | 169 | 6 |
| iNaturalist | 19,328 | 253 | 175 | 41 | 25 |
| GBIF (UNAM) | 21,586 | 34 | 25 | 19 | 1 |
| GBIF (Other Institutions) | 27,819 | 415 | 461 | 43 | 32 |
| **Total (merged)** | **104,382** | **751** | **1,365** | **178** | **33** |

The five most represented countries are Mexico (29,052 records), Ecuador (18,280), Brazil (15,422), Colombia (9,587), and Peru (8,936), followed by Costa Rica (8,291), Panama (3,456), Bolivia (2,515), and Venezuela (1,894). The high number of Mexican records reflects the extensive UNAM museum collections.

## 3.2 Sequencing Status

Of the 6,722 Sanger Institute specimens, 4,183 (62.2%) have been sequenced, 1,119 (16.6%) have tissue available for future sequencing, and 1,420 (21.1%) are preserved specimens waiting for tissue extraction. These categories are visible on the map through dedicated toggles, allowing researchers to spot geographic and taxonomic gaps in the sequencing effort.

## 3.3 Taxonomic Curation

The automated curation pipeline resolved the taxonomy for all 104,382 records (Table 2). The majority (94.5%) were resolved through the GBIF backbone taxonomy cache, 3.6% through the reference taxonomy (Butterflies of America, nymphalidae.net), 0.8% required live GBIF API queries, 0.3% were synonyms resolved to their accepted names, and 0.2% were corrected through typographical error detection. Of all curated records, 71.1% matched exactly, 11.9% were classified as nominotypical subspecies, and 2.1% had synonyms resolved. Only 0.6% could only be matched at a higher taxonomic rank, and just 2 records remained unresolved.

**Table 2.** Taxonomic curation results. Curation basis indicates the method used to resolve each record's taxonomy.

| Curation Basis | Records | Percentage |
| :---- | ----: | ----: |
| GBIF backbone cache | 98,589 | 94.5% |
| Reference taxonomy (BoA / nymphalidae.net) | 3,739 | 3.6% |
| GBIF API (live query) | 853 | 0.8% |
| GBIF synonym resolution | 263 | 0.3% |
| Typographical error detection | 202 | 0.2% |
| Literature corrections | 4 | <0.1% |

## 3.4 Mimicry Ring Coverage

The mimicry ring lookup from Dore et al. (2023) contains 44 distinct mimicry ring categories (Table S1). The most record-rich rings are Agnosia (14,930 records across 83 species), Hermias (12,393 records, 50 species), Lerida (12,262 records, 65 species), and Mamercus (11,452 records, 58 species). These mimicry ring values were propagated to Sanger Institute and GBIF records through species and subspecies matching, allowing researchers to filter and visualize mimicry ring distributions across all data sources.

## 3.5 Research Applications

The integrated platform enables several lines of biological inquiry that would be difficult to pursue with fragmented data:

**Mimicry ring biogeography.** By filtering the map to display a single mimicry ring, researchers can visualize its geographic extent and identify regions where ring membership changes. For example, filtering for the Lerida ring and toggling between data sources reveals where published records, citizen science observations, and sequenced specimens overlap or leave gaps. Comparing two mimicry rings side by side shows where their ranges meet or overlap, a pattern relevant to understanding how mimicry communities assemble across environmental gradients.

**Sequencing gap analysis.** The sequencing status filter allows researchers to identify species or geographic regions that are underrepresented in genomic datasets. A researcher planning a collecting expedition to Peru, for instance, can filter by "Preserved Specimen" and "Tissue Available" to see which localities already have material, then identify nearby areas with published occurrence records but no sequenced specimens. This kind of targeted planning can reduce redundant collecting and prioritize sampling in underrepresented regions.

**Taxonomic verification.** The data table preserves both original and corrected taxonomic names, so researchers can review automated curation decisions. If a name was resolved as a synonym, the original name appears alongside the accepted name, with the curation method documented. Geographic outliers, which often signal misidentifications, become immediately visible on the map and can be investigated by clicking individual points to inspect specimen metadata and photographs.

**Cross-source comparison.** Toggling data sources on and off reveals how institutional collections, citizen science, and published datasets complement each other. iNaturalist observations, for example, tend to concentrate along roads and trails in accessible areas, while museum collections may include records from remote localities visited during historical expeditions. Visualizing these biases helps researchers assess where geographic coverage is genuine and where it reflects sampling effort.

# 4. Discussion

## 4.1 Comparison with Existing Tools

The *Heliconius* interactive maps (Rosser & Mallet, 2024) demonstrated the value of open-source, GitHub-hosted mapping tools for Lepidoptera research. Their platform, built with R and the Leaflet library, works well for displaying a single curated dataset but has limitations when handling large multi-source datasets: filter changes can be slow, and the user interface is constrained by what R-Shiny or static HTML allows. Our toolkit extends this approach in several directions. We address the earlier specimen digitization workflow (photography, AI-assisted cataloguing, image hosting), which the *Heliconius* platform does not cover. We consolidate multiple data sources with automated taxonomic curation, rather than relying on a single pre-curated dataset. We add sequencing status filters designed for ongoing genomic projects, enabling strategic planning of which taxa to sequence next. And we provide high-resolution map image export, R script export for further customization, and automatic citation generation.

General-purpose platforms like GBIF and iNaturalist provide occurrence visualization but lack project-specific metadata such as sequencing status or mimicry ring classifications. Additionally, GBIF by default includes records with coordinate issues, absent records, and other quality problems that require manual filtering. Specialized tools like Map of Life (Jetz et al., 2012) offer range maps but not the specimen-level detail needed for genomic research planning. Our toolkit fills the gap between these general platforms and the project-specific needs of evolutionary biology research groups.

## 4.2 AI-Assisted Specimen Photograph Renaming

The AI Photo Processor applies generative AI to a practical bottleneck in biodiversity research: reading handwritten specimen labels from photographs. Traditional text recognition systems struggle with handwritten text on complex photographic backgrounds containing specimen wings, rulers, and color palettes. By using a model with image understanding capabilities, the system interprets handwritten identifiers within their visual context without needing to isolate the text first.

The grid-based approach, combining multiple images into a single composite before sending to the AI, makes practical use of each API request. Processing 45 images per request under the free tier means that a single day's quota handles roughly 900 images at no cost. Because the application accepts a customizable text prompt, this approach extends beyond entomological collections to any specimen-based research that uses handwritten labels, as long as the user adjusts the prompt to describe what information the AI should extract.

## 4.3 Sustainability and Reproducibility

Server-based research software commonly fails when cloud credits expire, servers go unmaintained, or frameworks become outdated. By running entirely in the browser and hosting files on GitHub Pages, this toolkit avoids these failure modes. As long as GitHub Pages remains available, which its widespread use in both industry and academia makes likely for the foreseeable future, the applications will stay online without maintenance costs.

Reproducibility is supported through several features. The Git commit hash included in auto-generated citations allows exact identification of the data version used in any analysis. Filter states encoded in URLs serve as shareable records of search configurations. Exported datasets include all metadata needed to reproduce the filtering criteria. The R export package lets researchers reproduce and customize maps entirely within their local R environment.

## 4.4 Limitations and Future Directions

**Taxonomic curation scope.** While the automated pipeline resolves many naming inconsistencies, it may still miss recently described taxa or contested synonymies. The data table shows both original and corrected names for researcher review, and a manually maintained corrections file allows case-by-case overrides. As taxonomic databases continue to be updated, the pipeline's accuracy will improve.

**Species distribution modeling.** Predictive habitat suitability models (e.g., MaxEnt) are not yet integrated. A future direction would be to compute these models through GitHub Actions or a free-tier cloud computing service and display predicted distributions as map overlays, allowing comparison between observed occurrences and modeled suitable habitat.

**Host plant distributions.** An important ecological layer would be the geographic distribution of known Ithomiini host plants (primarily Solanaceae). Overlaying butterfly and host plant ranges on the same map would let researchers explore whether butterfly distributions track host plant availability, and identify regions where host plants are present but butterfly records are absent, potentially guiding future survey efforts.

**Historical climate data.** Integrating historical climate variables (e.g., ERA5-Land reanalysis data) would enable researchers to examine how climatic conditions relate to species ranges and mimicry ring boundaries over time. This integration could provide direct ecological context for observed distribution patterns.

**Broader taxonomic scope.** The current platform focuses on Ithomiini, but the modular architecture could be extended to include other Lepidoptera or adapted to entirely different taxa, following the open-source spirit encouraged by Rosser & Mallet (2024).

# 5. Conclusions

We have presented an integrated open-source toolkit that covers the complete specimen-to-map pipeline for Ithomiini butterfly research. The AI Photo Processor automates the reading of handwritten specimen identifiers using generative AI, with a customizable prompt system that makes it adaptable to other collections. The Wings Gallery provides a centralized, filterable image browser with no server costs and one-click updates. Ithomiini Maps brings together diverse occurrence data into an interactive mapping platform where researchers can explore mimicry ring biogeography, identify gaps in genomic sampling, verify taxonomic assignments, and compare data sources, all through a browser interface that requires no software installation or GIS expertise.

By making these tools freely available and hosting them without server costs, we hope to lower the barrier for researchers studying Ithomiini and related groups to access, visualize, and share biodiversity data. The open-source codebase and modular architecture mean that other research groups can adapt the toolkit to their own taxa, building on the foundation that Rosser & Mallet (2024) established for *Heliconius* and extending it to the broader challenge of integrating specimen digitization, image management, and multi-source occurrence mapping.

All source code is freely available under the MIT License at:

- AI Photo Processor: https://github.com/Fr4nzz/rename_photos_AI

- Wings Gallery: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery

- Ithomiini Maps: https://github.com/rapidspeciation/ithomiini_maps

# 6. Data Availability Statement

The occurrence data shown in Ithomiini Maps comes from:

- Dore et al. (2023) -- Published dataset available at [repository DOI to be added]

- GBIF occurrence data -- Downloaded via the GBIF API (DOI: 10.15468/dl.pbs3eu), filtered for tribe Ithomiini (45 genera), with quality filters applied (coordinates present, no geospatial issues, confirmed presence, excluding fossils and living specimens). Records split into: iNaturalist research-grade observations, UNAM museum collections, and other institutional datasets.

- Sanger Institute collection data -- Available upon request from the corresponding research group

The processed data files and all source code are available in the GitHub repositories listed above. Version-specific data can be retrieved using the Git commit hashes included in the application's citation system.

# 7. Acknowledgments

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Ithomiini Maps. We acknowledge the Global Biodiversity Information Facility (GBIF) and its data publishers for providing open occurrence data. We acknowledge the use of AI coding assistants during software development, including OpenAI ChatGPT Codex, Google Gemini, and Anthropic Claude Code. [Additional acknowledgments to be added.]

# References

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. Molecular Ecology, 28(10), 2423-2438.

Dore, M., Willmott, K., Lavergne, S., Chazot, N., Freitas, A.V.L., Fontaine, C. & Elias, M. (2023). Mutualistic interactions shape global spatial congruence and climatic niche evolution in Neotropical mimetic butterflies. Ecology Letters, 26(6), 843-857. https://doi.org/10.1111/ele.14198

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. PLoS Biology, 6(12), e300.

Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating biodiversity distribution knowledge: toward a global map of life. Trends in Ecology & Evolution, 27(3), 151-159.

Jiggins, C.D. (2017). The Ecology and Evolution of Heliconius Butterflies. Oxford University Press.

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. Tropical Lepidoptera Research, 34(1), 26-30.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). Illustrated Lists of American Butterflies. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. Cladistics, 22(4), 297-368.
