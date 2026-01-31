# An integrated open-source toolkit for specimen digitization, image management, and interactive distribution mapping of Ithomiini butterflies

**Franz Chandi**^1,2^, **Patricio Mena-Valenzuela**^3^, **Joana I. Meier**^2^

^1^ Universidad San Francisco de Quito, Quito, Ecuador
^2^ Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom
^3^ Instituto Nacional de Biodiversidad, Quito, Ecuador

**Corresponding author:** Franz Chandi (franz.chandi@usfq.edu.ec)

---

## Abstract

The study of butterfly diversity requires integrating heterogeneous data from fieldwork, museum collections, genomic sequencing programs, and global biodiversity databases. However, the tools available for managing specimen photographs, curating taxonomic records, and visualizing geographic distributions remain fragmented, typically requiring separate proprietary software packages and specialized expertise. Here we present an integrated open-source toolkit comprising three web-based applications that together address the full workflow from specimen photography to interactive distribution mapping for Ithomiini butterflies (Nymphalidae: Danainae). (1) **AI Photo Processor**, a desktop application that uses Google's Gemini large language model to read handwritten specimen identifiers from photographs and automatically rename image files in batch; (2) **Wings Gallery**, a static web application for browsing, filtering, and sharing high-resolution dorsal and ventral wing photographs linked to a cloud-hosted image database; and (3) **Ithomiini Maps**, an interactive cartographic platform that unifies occurrence records from published datasets, institutional sequencing databases, and the Global Biodiversity Information Facility (GBIF) into a single filterable map interface. All three applications are deployed as static sites on GitHub Pages at zero hosting cost, with Python-based data processing pipelines executed via GitHub Actions for continuous integration. The mapping platform currently renders over 30,000 occurrence records across approximately 400 species and subspecies, with filters for taxonomic hierarchy, sequencing status, mimicry ring phenotype, collection date, and data source. We describe the architecture, data pipelines, and taxonomic curation procedures, and discuss how this serverless approach offers a sustainable, reproducible, and freely accessible alternative to server-dependent platforms for biodiversity research.

**Keywords:** biodiversity informatics, Ithomiini, interactive maps, specimen digitization, OCR, Lepidoptera, open-source, Vue.js, GBIF, mimicry rings

---

## 1. Introduction

Ithomiini butterflies (Nymphalidae: Danainae) constitute one of the most species-rich and ecologically significant butterfly tribes in the Neotropics, comprising over 390 described species distributed primarily across Central and South America (Willmott & Freitas, 2006; Chazot et al., 2019). Their remarkable diversity of wing color patterns, driven by Müllerian mimicry complexes involving dozens of co-occurring species, has made them a model system for studying speciation, adaptation, and ecological interactions (Elias et al., 2008; Jiggins, 2017; Dore et al., 2025). The recent publication of a comprehensive dataset of nearly 29,000 georeferenced occurrence records with associated mimicry ring classifications (Dore et al., 2025), combined with ongoing genomic sequencing efforts at the Wellcome Sanger Institute, has created an unprecedented opportunity to study Ithomiini biogeography at scale.

However, the practical challenge of managing, visualizing, and sharing these data remains substantial. Researchers working with Ithomiini specimens typically face a fragmented workflow: photographs of preserved wings must be manually catalogued and renamed according to specimen identifiers; image collections are scattered across local drives without centralized access; and geographic data from multiple sources (published records, institutional databases, GBIF, iNaturalist) must be manually reconciled, cleaned, and mapped using specialized GIS software. Each of these steps introduces delays and potential errors that impede collaborative research.

Interactive web-based mapping tools have emerged as a solution for biodiversity visualization. Rosser & Mallet (2024) developed open-source interactive maps for *Heliconius* butterflies, enabling researchers to visualize phenotypic and geographic data within a single interface hosted on GitHub. Their approach demonstrated that lightweight, statically-hosted web applications could serve as effective tools for taxonomic research, and their explicit goal of replicability—making their methods "straightforward for researchers to adapt to their own taxa"—motivates the present work. However, the *Heliconius* maps represent only the visualization endpoint; the upstream processes of specimen digitization, image management, and multi-source data integration remain unaddressed.

Here we present a toolkit of three interconnected open-source applications that together address the complete specimen-to-map pipeline for Ithomiini butterflies:

1. **AI Photo Processor** — An AI-powered desktop application for batch extraction of handwritten specimen identifiers from wing photographs using Google's Gemini vision model, enabling automated file renaming at scale.

2. **Wings Gallery** — A static web gallery for browsing, filtering, and sharing high-resolution wing photographs stored on Google Drive, with real-time database synchronization.

3. **Ithomiini Maps** — An interactive mapping platform that unifies occurrence records from published literature, institutional sequencing databases, and GBIF into a filterable, shareable cartographic interface with data export and citation capabilities.

All components are built on modern web technologies (Vue.js, MapLibre GL JS) and hosted as static sites on GitHub Pages, eliminating the need for dedicated servers and ensuring long-term availability at zero cost. Data processing pipelines are implemented in Python and executed through GitHub Actions for reproducible continuous integration. This paper describes the architecture, implementation, and intended use cases for each component, and discusses the advantages of this serverless approach for biodiversity informatics.

---

## 2. Methods and Implementation

### 2.1 System Architecture Overview

The toolkit follows a decoupled architecture in which data processing occurs offline (or in CI/CD pipelines) and the resulting static assets are served via GitHub Pages (Figure 1). This separation offers several advantages: (i) the frontend remains lightweight and loads rapidly without server-side computation; (ii) data can be updated by re-running processing scripts and redeploying, which is automated via GitHub Actions; and (iii) hosting is provided indefinitely by GitHub at no cost, avoiding the maintenance burden and expense of cloud servers.

All three applications share a common technology stack:
- **Frontend framework**: Vue 3 with the Composition API
- **Build tool**: Vite (fast development server and optimized production builds)
- **Data processing**: Python 3.9+ with Pandas
- **Hosting**: GitHub Pages (static site hosting)
- **CI/CD**: GitHub Actions (automated data refresh and deployment)

### 2.2 AI Photo Processor

#### 2.2.1 Motivation and Problem Statement

Large-scale specimen photography generates thousands of image files with uninformative camera-assigned filenames (e.g., `IMG_4521.CR2`). Each specimen is typically photographed from two angles (dorsal and ventral), and a handwritten identifier label (e.g., "CAM012345") is placed alongside the wings during photography. Manually transcribing these identifiers to rename files is laborious and error-prone, particularly when processing batches of hundreds or thousands of images.

#### 2.2.2 Architecture

The AI Photo Processor is a desktop application built with Python and PyQt5. It uses Google's Gemini API (generative AI with vision capabilities) to perform optical character recognition (OCR) on handwritten specimen labels within photographs. The application is distributed as a standalone Windows executable (via PyInstaller) and is also available as Python source code.

The processing pipeline consists of the following stages:

**Image pre-processing.** Raw photographs (JPEG, HEIC, CR2, and other RAW formats) are optionally rotated using EXIF-safe orientation tag modification (via piexif for JPEG, pillow-heif for HEIC, and ExifTool for RAW formats), then cropped to isolate the label region. The crop percentages (top, bottom, left, right) are user-configurable through a graphical interface with live preview.

**Grid assembly.** To maximize API throughput and minimize costs, multiple images are assembled into grid mosaics. The default configuration creates 3×3 grids (9 images each) and sends 5 grids per API message, processing 45 images per API call. The grid dimensions and images-per-message are configurable parameters.

**AI transcription.** Each message is sent to the Gemini API with a customizable prompt instructing the model to extract the specimen identifier from each cell in the grid. The default prompt is optimized for reading handwritten "CAM" identifiers but can be modified for arbitrary OCR tasks. The application supports multiple API keys with automatic rotation to handle rate limits; with the free tier, each key supports approximately 900 images per day.

**Review and correction.** A paginated review interface displays thumbnail images alongside their AI-transcribed identifiers. The system flags potential errors: unpaired identifiers (each specimen should produce exactly two images—dorsal and ventral), duplicate IDs, and empty transcriptions. Users can edit identifiers inline, skip damaged or blurred images, and sort results by filename, capture date, or ID.

**File renaming.** The application generates final filenames by appending "d" (dorsal) or "v" (ventral) suffixes based on image position within pairs and renames files on disk. A complete rename log is maintained, enabling full undo capability. Paired RAW files (e.g., `.CR2`) are renamed alongside their JPEG counterparts.

#### 2.2.3 Technical Specifications

The application comprises approximately 835 lines of Python across 5 modules. Key dependencies include `PyQt5` for the graphical interface, `google-genai` for Gemini API access, `piexif` for JPEG EXIF manipulation, `pillow-heif` for HEIC support, and `Pillow` for image processing. The standalone Windows build includes a bundled ExifTool v13.32 for RAW file handling.

### 2.3 Wings Gallery

#### 2.3.1 Motivation and Problem Statement

Once specimen photographs are renamed and organized, researchers need a centralized system to browse, filter, and share images. The original implementation was an R-Shiny application hosted on an AWS EC2 instance using Docker, which incurred monthly server costs, required manual maintenance, and suffered from domain-blocking issues in certain institutional networks. A migration to a static architecture was required for sustainability and accessibility.

#### 2.3.2 Architecture

The Wings Gallery is a Vue 3 single-page application (SPA) deployed on GitHub Pages. It retrieves pre-processed JSON data at load time and renders a responsive grid of specimen photographs with filtering capabilities.

**Data flow.** Image files are uploaded to shared Google Drive folders. A custom Google Apps Script (`list_google_drive_files.gs`) recursively indexes all files across multiple Drive folders into a Google Sheet (the `Photo_links` sheet), extracting metadata including file name, URL, capture date, size, and folder path. This script utilizes the LongRun library (https://github.com/inclu-cat/LongRun) to overcome Google Apps Script's 6-minute execution limit, enabling indexing of thousands of files across nested subfolder structures. A Python processing script then downloads the Google Sheet data via CSV export, resolves image URLs through the wsrv.nl caching proxy (which prevents Google Drive's HTTP 429 rate limiting), and generates optimized JSON files for the frontend.

**Gallery views.** The application provides four specialized views:
- **Collection Tab**: Filters individuals by taxonomic hierarchy (Family, Subfamily, Tribe, Species, Subspecies) and sex.
- **Insectary Tab**: Displays specimens from the insectary collection, filtered by Insectary ID and biological metadata.
- **CRISPR Tab**: A specialized view for CRISPR-injected specimens, enabling filtering by mutant phenotype.
- **Search Tab**: Fast lookup by CAMID with instant results.

**Image interaction.** The gallery supports shift+scroll to zoom all images simultaneously, ctrl+scroll to zoom individual images, and native pinch-to-zoom gestures on mobile devices. The responsive grid automatically adjusts column count based on screen width and zoom level.

**Database updates.** Authorized users can trigger a database refresh directly from the browser. The request passes through a Cloudflare Worker (serverless function) that verifies a password and uses a secure token to trigger a GitHub Actions workflow. The workflow executes the Python data processing script, commits updated JSON files to the repository, and triggers automatic redeployment.

#### 2.3.3 Technical Specifications

The frontend comprises approximately 1,145 lines across 10 Vue components. The Google Apps Script for Drive indexing is approximately 300 lines. The Python data processing script is 129 lines. The application is accessible at https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/.

### 2.4 Ithomiini Maps

#### 2.4.1 Motivation and Problem Statement

Visualizing Ithomiini distributions requires integrating data from multiple sources with different schemas, taxonomic conventions, and quality levels. Researchers need to quickly identify which species have been sequenced, where tissue samples are available, and how mimicry ring distributions overlap geographically. Existing tools either require GIS expertise (QGIS, ArcGIS) or lack the specimen-level filtering needed for genomic research planning.

#### 2.4.2 Data Sources and Processing Pipeline

The mapping platform integrates three primary data sources:

**Dore et al. (2025) published records.** An Excel file containing 28,927 georeferenced occurrence records with full taxonomic classification, mimicry ring assignments (male and female), and observation metadata. This dataset serves as the authoritative source for mimicry ring classification and provides the lookup table used to propagate mimicry information to other data sources.

**Sanger Institute collection data.** Live data accessed from a Google Sheets database maintained by the sequencing team. Each record includes specimen identifier (CAMID), taxonomic classification, collection locality, GPS coordinates, sequencing status (determined from tube rack and tissue fields), and links to wing photographs stored on Google Drive. The sequencing status classification follows a hierarchical logic: specimens with valid `Tube_1_rack` entries (excluding "Not in TOL") are classified as "Sequenced"; those with tissue samples (`Tube_1_tissue` not empty or "NOT_COLLECTED") are classified as "Tissue Available"; and remaining specimens are classified as "Preserved Specimen".

**GBIF occurrence data.** An automated download pipeline (`gbif_download_api.py`, 768 lines) queries the GBIF API for all Ithomiini occurrences. The script properly parses species names by removing author citations, extracts subspecific epithets from the `infraspecificEpithet` field, filters out invalid entries (BOLD sequence IDs, placeholder names), and includes `basisOfRecord` metadata for quality assessment. Downloaded occurrences are classified as either "Observation" (for human observations and preserved specimens without sequencing data) or "Museum Specimen" (for preserved specimens in institutional collections).

**Data merging.** The `process_data.py` pipeline (892 lines) loads all three sources, normalizes field names, applies consistent taxonomic formatting, and constructs a unified JSON output (`map_points.json`). A key feature is the mimicry ring propagation system: a lookup table is built from the Dore dataset mapping (species, subspecies) pairs to (male_mimicry, female_mimicry) values. This lookup is then applied to Sanger and GBIF records, first attempting an exact match (species + subspecies), then falling back to a species-only match. This ensures mimicry ring data are available even for records without subspecific identification.

#### 2.4.3 Taxonomic Curation Pipeline

Integrating records from heterogeneous sources requires resolving taxonomic inconsistencies: synonyms, misspellings, outdated nomenclature, and varying levels of identification. The curation pipeline (`scripts/curation/`, 8 modules, ~1,850 lines) processes each unique scientific name through a multi-step resolution procedure:

1. **Cache lookup**: Names are first checked against a local cache of previously resolved GBIF backbone taxonomy records to minimize API calls.

2. **GBIF Species Match API**: Unresolved names are queried against the GBIF species match endpoint. Exact matches are accepted directly; synonyms are resolved to their accepted name. The resolution source is recorded (e.g., "GBIF", "GBIF Synonym", "GBIF API").

3. **Reference taxonomy verification**: Names that fail GBIF resolution are checked against a compiled reference taxonomy sourced from Butterflies of America (Warren et al., 2023) and nymphalidae.net. Names found in this reference are flagged as "Ref. Taxonomy".

4. **Typo detection**: Subspecific epithets are compared against known subspecies lists using edit-distance algorithms. Close matches (likely typographical errors) are flagged and auto-corrected.

5. **Synonym inference**: When a synonym is resolved by GBIF, the pipeline attempts to infer the correct subspecies by matching the original subspecific epithet against known subspecies of the accepted species name.

Each curated record includes a `curation_basis` field documenting the resolution source, a `curation_status` field indicating the outcome (e.g., "verified", "synonym_resolved", "not_found"), and preservation of the original name when modifications occur.

#### 2.4.4 Frontend Architecture

The frontend is a Vue 3 SPA using MapLibre GL JS for map rendering and Pinia for state management. The application comprises approximately 14,000 lines across 12 Vue components and 4 store modules.

**Map engine.** MapLibre GL JS provides WebGL-accelerated rendering capable of displaying 30,000+ points with smooth pan and zoom interactions. Five base layer styles are available: Dark, Light, Satellite (Esri), Terrain, and Streets. Points are color-coded by data source and clustered at low zoom levels for performance, with clusters expanding on click to reveal individual specimens.

**Filter system.** Filters are organized in a collapsible sidebar with the following capabilities:
- *Taxonomic cascade*: Family → Tribe → Genus → Species → Subspecies, with each level dynamically populating based on available data in the current filter context.
- *Multi-select with fuzzy search*: Species and subspecies filters support selecting multiple values simultaneously with real-time text matching.
- *Sequencing status*: Toggle buttons for Sequenced, Tissue Available, Preserved Specimen, Published, Observation, and Museum Specimen categories.
- *Mimicry ring selector*: A visual selector displaying butterfly wing pattern icons alongside ring names, color-coded by mimicry group, with record counts. The 44 mimicry rings from Dore et al. (2025) are available for selection.
- *Date range filter*: Slider-based temporal filtering by collection or observation date.
- *CAMID search*: Instant specimen lookup by identifier.
- *Data source toggle*: Filter by Dore, Sanger Institute, or GBIF origin.

**URL state persistence.** All active filters are encoded into the URL hash, enabling researchers to share exact search configurations via hyperlinks. Shared URLs restore the complete filter state, map position, and zoom level.

**Specimen visualization.** Clicking a map point opens a popup displaying specimen metadata, taxonomic classification, sequencing status, and wing photographs (dorsal and ventral) when available. If no photograph exists for a specific individual, the system falls back to displaying a photograph from another individual of the same species or subspecies.

**Data table.** A sortable, paginated table view shows all records matching the current filters, with photo thumbnails, toggleable column visibility, and indicators distinguishing individual photographs from species-level reference images.

**Export and citation.** The export panel provides:
- CSV and GeoJSON downloads of the filtered dataset
- High-resolution map image export (configurable DPI up to 300) for publication-ready figures
- Auto-generated scientific citations including the Git commit hash for version-specific reproducibility
- BibTeX-formatted citation output for LaTeX workflows

#### 2.4.5 Deployment and Continuous Integration

The application is deployed via GitHub Actions. Pushes to the `main` branch trigger an automated workflow that builds the Vue application with Vite and deploys the compiled static assets to GitHub Pages. A separate manually-triggered workflow (`update_data.yml`) executes the Python data processing pipeline to refresh occurrence data from live sources.

The application is accessible at https://fr4nzz.github.io/ithomiini_maps/.

---

## 3. Results

### 3.1 Integrated Workflow

The three applications form a continuous pipeline for specimen processing:

**Step 1: Photography.** Butterfly wings are photographed following a standardized protocol. The camera is mounted on an articulated arm with a horizontally leveled sensor (verified with a digital level). Wings are positioned one per quadrant with dorsal side up, alongside a handwritten specimen identifier and color reference palette. Each specimen is captured in both dorsal and ventral orientations.

**Step 2: AI-assisted file renaming.** Photographs are processed through the AI Photo Processor. The application reads the handwritten CAMID from each image using the Gemini vision model, pairs dorsal and ventral photographs, and renames files according to the convention `CAM012345d.JPG` (dorsal) and `CAM012345v.JPG` (ventral). In our testing, Gemini achieves high transcription accuracy for clearly written alphanumeric identifiers, with the review interface enabling rapid correction of misread characters.

**Step 3: Cloud upload and indexing.** Renamed JPEG files are uploaded to designated Google Drive folders. The Google Apps Script automatically indexes new files into the master spreadsheet, capturing file metadata and download URLs. RAW files are stored separately for archival purposes.

**Step 4: Gallery publication.** The Wings Gallery is updated either manually or via the browser-based trigger, making new photographs immediately accessible to all collaborators for browsing, filtering, and quality review.

**Step 5: Distribution mapping.** The Ithomiini Maps platform integrates the Sanger collection data (including links to specimen photographs from the same Google Drive) with published occurrence records and GBIF data. Researchers can visualize the geographic distribution of any species, filter by sequencing status to identify collection gaps, compare mimicry ring distributions, and export filtered datasets or publication-ready maps.

### 3.2 Data Coverage

As of the current deployment, the Ithomiini Maps platform integrates:

- **Dore et al. (2025)**: 28,927 published occurrence records spanning the described diversity of Ithomiini, with mimicry ring classifications for 44 distinct mimicry patterns.
- **Sanger Institute**: Active sequencing collection data with specimen photographs and sequencing status tracking.
- **GBIF**: Supplementary occurrence records from global biodiversity databases, including iNaturalist citizen science observations.

Together, these sources provide coverage across the full Neotropical range of Ithomiini, from southern Mexico to southern Brazil, with the highest density of records in the tropical Andes of Ecuador, Colombia, and Peru.

### 3.3 Performance

The static architecture yields rapid load times. The compiled Vue application (JavaScript bundles and CSS) totals less than 500 KB gzipped. The occurrence data (`map_points.json`) loads asynchronously and is rendered progressively as the map initializes. MapLibre GL JS's WebGL rendering pipeline maintains smooth 60 fps interactions even when displaying the full dataset. Taxonomic filter updates are computed client-side in under 100 ms for the complete dataset, ensuring responsive user interactions.

The serverless architecture eliminates downtime concerns associated with managed servers. GitHub Pages provides a 99.9% availability SLA, and the static assets are served via GitHub's global CDN. Unlike the previous R-Shiny deployment of the Wings Gallery (which required an AWS EC2 instance with Docker), the current deployment incurs zero hosting costs and requires no system administration.

---

## 4. Discussion

### 4.1 Comparison with Existing Tools

The *Heliconius* interactive maps (Rosser & Mallet, 2024) demonstrated the value of open-source, GitHub-hosted mapping tools for Lepidoptera research. Our toolkit extends this approach in several directions: (i) we address the upstream specimen digitization workflow (photography, AI-assisted cataloguing, image hosting), which is absent from the *Heliconius* platform; (ii) we integrate multiple data sources with automated taxonomic curation, whereas the *Heliconius* maps use a single curated dataset; (iii) we add sequencing status filters specific to ongoing genomic projects, enabling strategic planning of which taxa to sequence next; and (iv) we provide high-resolution map export and formal citation generation for publication workflows.

Several general-purpose biodiversity platforms provide mapping capabilities. GBIF's portal (https://gbif.org) offers global occurrence visualization, but lacks specimen-level filtering by sequencing status, mimicry phenotype, or project-specific metadata. iNaturalist provides citizen science observations with photographs, but does not integrate institutional sequencing data. Domain-specific tools such as Map of Life (Jetz et al., 2012) provide expert range maps but do not support the specimen-level filtering required for genomic research planning.

Our toolkit fills a specific niche: a researcher-oriented platform that combines project-specific data (institutional collections, sequencing status) with public biodiversity data (GBIF) in an interface tailored for evolutionary biology workflows. The modular architecture and open-source licensing ensure that other research groups can adapt these tools for their own taxa of interest, as advocated by Rosser & Mallet (2024).

### 4.2 The Role of AI in Specimen Digitization

The AI Photo Processor represents an application of large language models (LLMs) with vision capabilities to a practical bottleneck in biodiversity research. Traditional OCR systems (Tesseract, Amazon Textract) struggle with handwritten text on complex photographic backgrounds containing specimen wings, rulers, and color palettes. By leveraging Gemini's multimodal understanding, the system can interpret handwritten identifiers within the visual context of specimen photographs without requiring text isolation or background removal.

The grid-based approach (assembling multiple images into a single composite before sending to the API) offers a practical solution to API rate limits and cost constraints. Processing 45 images per API call under the free tier represents a substantial throughput improvement over individual-image processing. The multi-key rotation system further extends daily processing capacity by distributing requests across multiple free API keys.

This approach is generalizable beyond entomological collections. Any specimen-based research program that uses handwritten labels—herbarium sheets, geological samples, archaeological artifacts—could adapt the tool by modifying the prompt template.

### 4.3 Sustainability and Reproducibility

A central design goal was ensuring long-term sustainability without ongoing costs or maintenance burden. The static hosting model eliminates the most common failure modes of research software: expired cloud credits, unmaintained servers, and deprecated server-side frameworks. As long as GitHub Pages continues to exist (and given its widespread adoption in both industry and academia, this is likely for the foreseeable future), the applications will remain accessible.

Reproducibility is addressed through several mechanisms. The Git commit hash is included in auto-generated citations, enabling precise identification of the data version used in any analysis. Filter states encoded in URLs serve as lightweight, shareable analytical configurations. Exported datasets include all metadata needed to reproduce the filtering criteria.

### 4.4 Limitations and Future Directions

The current implementation has several limitations that suggest directions for future development:

**Taxonomic curation scope.** While the automated pipeline resolves many nomenclatural inconsistencies, it depends on the GBIF backbone taxonomy, which may lag behind recent taxonomic revisions. Manual curation remains necessary for newly described taxa and contested synonymies.

**Offline modeling.** Species distribution models (SDMs) are not yet integrated. We envision a workflow where SDM predictions are computed offline using established tools (MaxEnt, ENMeval) and visualized as raster overlays on the map platform.

**Temporal analysis.** The date range filter provides basic temporal filtering, but more sophisticated analyses—trend detection, seasonal patterns, change-point identification—would require dedicated analytical modules.

**Scalability.** The client-side filtering approach works well for the current dataset size (~30,000 records) but may require server-side pagination or tile-based data loading for substantially larger datasets.

**Image quality.** The AI Photo Processor's transcription accuracy depends on handwriting legibility and image quality. Developing a confidence scoring system and expanding training prompts for diverse handwriting styles could improve robustness.

---

## 5. Conclusions

We have presented an integrated open-source toolkit that addresses the complete specimen-to-map pipeline for Ithomiini butterfly research. The AI Photo Processor automates the labor-intensive task of reading handwritten specimen identifiers using modern vision AI. The Wings Gallery provides a centralized, filterable image repository with zero server costs. Ithomiini Maps unifies heterogeneous occurrence data into an interactive mapping platform with taxonomic, phenotypic, and sequencing status filters designed for evolutionary biology workflows. Together, these tools demonstrate that modern web technologies and AI services can substantially improve the efficiency and accessibility of biodiversity research infrastructure, while maintaining the sustainability advantage of a fully serverless deployment.

All source code is freely available under the MIT License at:
- AI Photo Processor: https://github.com/Fr4nzz/rename_photos_AI
- Wings Gallery: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery
- Ithomiini Maps: https://github.com/Fr4nzz/ithomiini_maps

---

## 6. Data Availability Statement

The occurrence data visualized in Ithomiini Maps is derived from:
- Dore et al. (2025) — Published dataset available at [repository DOI to be added]
- GBIF occurrence data — Downloaded via the GBIF API (https://www.gbif.org), filtered for tribe Ithomiini
- Sanger Institute collection data — Available upon request from the corresponding research group

The processed data files and all source code are available in the GitHub repositories listed above. Version-specific data snapshots can be retrieved using the Git commit hashes included in the application's citation system.

---

## 7. Acknowledgments

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Ithomiini Maps. We are grateful to the Wellcome Sanger Institute for supporting the genomic sequencing of Ithomiini specimens. We acknowledge the Global Biodiversity Information Facility (GBIF) and its data publishers for providing open occurrence data. [Additional acknowledgments to be added by authors.]

---

## References

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. *Molecular Ecology*, 28(10), 2423-2438.

Dore, M. et al. (2025). [Full citation for the published Ithomiini occurrence dataset. To be completed.]

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. *PLoS Biology*, 6(12), e300.

Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating biodiversity distribution knowledge: toward a global map of life. *Trends in Ecology & Evolution*, 27(3), 151-159.

Jiggins, C.D. (2017). *The Ecology and Evolution of Heliconius Butterflies*. Oxford University Press.

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. *Tropical Lepidoptera Research*, 34(1), 26-30.

Rosser, N., Phillimore, A.B., Huertas, B., Willmott, K.R. & Mallet, J. (2012). Testing historical explanations for gradients in species richness in heliconiine butterflies of tropical America. *Biological Journal of the Linnean Society*, 105(3), 479-497.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). *Illustrated Lists of American Butterflies*. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. *Cladistics*, 22(4), 297-368.

---

## Figures

**Figure 1.** System architecture overview showing the three applications and their interconnections. The AI Photo Processor (left) reads handwritten specimen identifiers and renames image files. Renamed photographs are uploaded to Google Drive and indexed via Google Apps Script. The Wings Gallery (center) provides a web interface for browsing specimen photographs. The Ithomiini Maps platform (right) integrates occurrence data from three sources (Dore et al., Sanger Institute, GBIF) through a Python data processing pipeline with automated taxonomic curation, producing an interactive map with multi-dimensional filtering. All web applications are deployed as static sites on GitHub Pages via GitHub Actions.

**Figure 2.** The AI Photo Processor interface. (A) The Process Images tab showing the grid assembly preview, where multiple specimen photographs are composited into a single image for efficient API processing. (B) The Review Results tab displaying AI-transcribed identifiers alongside thumbnail images, with inline editing and pair-verification indicators.

**Figure 3.** The Wings Gallery interface. (A) The Collection tab showing a filtered grid of dorsal wing photographs with taxonomic filters active. (B) A zoomed view of a single specimen photograph showing wing pattern detail.

**Figure 4.** The Ithomiini Maps interface. (A) Full application view with the filter sidebar, mimicry ring selector, and map showing clustered occurrence points across South America. (B) Detail view with individual points visible at higher zoom, showing a specimen popup with wing photographs and metadata. (C) The data table view with photo thumbnails, sortable columns, and pagination. (D) The export panel showing CSV download, map image export, and auto-generated citation with Git commit hash.

**Figure 5.** Taxonomic curation pipeline flowchart. Each unique scientific name passes through cache lookup, GBIF Species Match API resolution, reference taxonomy verification, and typo detection. The `curation_basis` field records the resolution source for each record, ensuring traceability.

---

## Supplementary Material

**Table S1.** Complete list of the 44 mimicry rings from Dore et al. (2025) with representative species and the number of occurrence records per ring in the integrated dataset.

**Table S2.** Summary statistics for the taxonomic curation pipeline: number of names processed, proportion resolved at each stage (GBIF exact match, GBIF synonym, reference taxonomy, typo correction), and proportion remaining unresolved.

**Table S3.** Comparison of technical specifications across the three applications: lines of code, dependencies, build sizes, and hosting requirements.
