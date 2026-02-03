# An integrated open-source toolkit for specimen digitization, image management, and interactive distribution mapping of Ithomiini butterflies

**Franz Chandi**^1^, **Patricio A. Salazar Carrión**^2,3^, **Joana I. Meier**^3^

^1^ Universidad San Francisco de Quito, Quito, Ecuador
^2^ Department of Zoology, University of Cambridge, Cambridge, United Kingdom
^3^ Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom

---

## Abstract

Studying butterfly diversity requires bringing together data from fieldwork, museum collections, genomic sequencing programs, and global biodiversity databases. However, the tools available for managing specimen photographs, organizing taxonomic records, and visualizing geographic distributions are often separate, require different software packages, and demand specialized technical knowledge. Here we present an integrated open-source toolkit of three web-based applications that together cover the full workflow from specimen photography to interactive distribution mapping for Ithomiini butterflies (Nymphalidae: Danainae). (1) **AI Photo Processor**, a desktop application that uses Google's Gemini AI to read handwritten specimen identifiers from photographs and automatically rename image files in batch; (2) **Wings Gallery**, a serverless web application for browsing, filtering, and sharing high-resolution wing photographs linked to Google Cloud image services; and (3) **Ithomiini Maps**, an interactive mapping platform that brings together occurrence records from published datasets, institutional sequencing databases, and the Global Biodiversity Information Facility (GBIF) into a single filterable map interface. All three applications run entirely in the user's browser and are hosted on GitHub Pages at zero cost, with Python-based data processing pipelines running on GitHub Actions for automated updates. GBIF records are pre-filtered to include only trustworthy data: records with valid coordinates, no geospatial issues, confirmed presence status, and excluding fossils and living specimens. The mapping platform currently integrates 104,382 occurrence records across 751 species and 1,365 subspecies from five data sources spanning 33 countries, with taxonomic filters, sequencing status indicators, mimicry ring phenotype selectors, date range controls, and data source toggles. Users can export filtered datasets, generate publication-ready map images, and share exact search configurations through URLs. We describe the architecture, data pipelines, and taxonomic curation procedures, and discuss how this serverless approach offers a sustainable, reproducible, and free alternative to server-based platforms for biodiversity research.

**Keywords:** biodiversity informatics, Nymphalidae, interactive maps, specimen digitization, Lepidoptera, open-source, mimicry rings, GBIF, distribution mapping

---

## 1. Introduction

Ithomiini butterflies (Nymphalidae: Danainae) are one of the most species-rich and ecologically important butterfly tribes in the Neotropics, with over 390 described species found mainly across Central and South America (Willmott & Freitas, 2006; Chazot et al., 2019). Their remarkable diversity of wing color patterns, shaped by Müllerian mimicry complexes involving dozens of co-occurring species, has made them a key system for studying speciation, adaptation, and ecological interactions (Elias et al., 2008; Jiggins, 2017; Dore et al., 2025). The recent publication of a large dataset of nearly 29,000 georeferenced occurrence records with mimicry ring classifications (Dore et al., 2025), together with ongoing genomic sequencing efforts at the Wellcome Sanger Institute, has created a unique opportunity to study Ithomiini biogeography at a broad scale.

However, managing, visualizing, and sharing these data remains a practical challenge. Researchers working with Ithomiini specimens typically face a fragmented workflow: thousands of preserved wings may be physically stored waiting to be photographed, and the steps required to rename each photograph with its specimen identifier, upload images to the cloud, and make them available for colleagues are time-consuming and lack a straightforward pipeline. Meanwhile, geographic data from multiple sources (published records, institutional databases, GBIF, iNaturalist) must be manually combined, cleaned, and mapped using specialized GIS software. These disconnected steps introduce delays and potential errors that slow down collaborative research. This paper presents a simplified pipeline that covers the full process from specimen photography to serving images and occurrence data for researchers through unified web applications.

Interactive web-based mapping tools have emerged as a solution for biodiversity visualization. Rosser & Mallet (2024) developed open-source interactive maps for *Heliconius* butterflies using R and the Leaflet library to create a static website hosted on GitHub. Their platform enabled researchers to visualize phenotypic and geographic data within a single interface, and their explicit goal of making their methods "straightforward for researchers to adapt to their own taxa" inspired this work. However, the R/Leaflet approach has limitations: it lacks live client-side filtering (filter changes require page reloads or server round-trips), offers limited options for customizing the user interface, and renders maps more slowly when handling large datasets. Additionally, the *Heliconius* maps address only the visualization step; the earlier steps of specimen digitization, image management, and multi-source data integration are not covered.

Here we present a toolkit of three connected open-source applications that together address the complete specimen-to-map pipeline for Ithomiini butterflies:

1. **AI Photo Processor** — A desktop application for batch reading of handwritten specimen identifiers from wing photographs using Google's Gemini AI, enabling automated file renaming at scale. While developed for this specific purpose, the application was intentionally designed so that users can customize the AI prompt to extract other types of information from images, making it adaptable to different research contexts.

2. **Wings Gallery** — A serverless web gallery for browsing, filtering, and sharing high-resolution wing photographs stored on Google Cloud services, with one-click database updates.

3. **Ithomiini Maps** — An interactive mapping platform that brings together occurrence records from published literature, institutional sequencing databases, and GBIF into a single interface with taxonomic, phenotypic, and sequencing status filters, as well as map and data export features.

All components are built with Vue.js for the web interface and Python for data processing. They are hosted as static sites on GitHub Pages, which means the applications run entirely in the user's browser with no need for dedicated servers. Website hosting is provided by GitHub at no cost; the only expense is cloud storage for the specimen photographs on Google Cloud services. Data processing pipelines run through GitHub Actions (an automated task runner provided by GitHub) so that data updates happen in the cloud without needing a physical computer. This paper describes the architecture, implementation, and intended uses for each component, and discusses the advantages of this approach for biodiversity research.

---

## 2. Methods and Implementation

### 2.1 System Architecture Overview

The toolkit uses a separated architecture in which data processing happens in the cloud (through GitHub Actions automated pipelines) and the resulting files are served as a static website via GitHub Pages (Figure 1). This separation has several benefits: (i) the website remains lightweight and loads quickly since no computation happens on a server; (ii) data can be updated by re-running processing scripts, which is automated; and (iii) website hosting is free through GitHub, with the only cost being cloud storage for specimen photographs on Google Cloud services.

All three applications share a common set of technologies:
- **Web framework**: Vue.js 3 for the user interface
- **Build tool**: Vite (for fast development and optimized production builds)
- **Data processing**: Python with Pandas for data cleaning, and the GBIF API for downloading occurrence records
- **Hosting**: GitHub Pages (free static site hosting)
- **Automated pipelines**: GitHub Actions (runs data processing scripts in the cloud, triggered manually or on code updates)

### 2.2 AI Photo Processor

#### 2.2.1 Motivation

Large-scale specimen photography generates thousands of image files with generic camera-assigned filenames (e.g., `IMG_01234.JPG`). Each specimen is typically photographed from two angles (dorsal and ventral), and a handwritten identifier label (e.g., "CAM012345") is placed alongside the wings during photography. Manually reading these identifiers and renaming each file is slow and error-prone, especially when processing batches of hundreds or thousands of images.

#### 2.2.2 Architecture

The AI Photo Processor is a desktop application built with Python and PyQt5. It uses Google's Gemini AI (a generative AI model with image understanding abilities) to read handwritten specimen labels within photographs. The application is available as a standalone Windows program and as Python source code.

The processing pipeline works as follows:

**Image rotation.** Since the camera is mounted on an arm pointing downwards, small physical adjustments to the camera can cause changes in the EXIF orientation tag (set by the camera's built-in gyroscope), which results in photographs appearing rotated differently when opened in different software. To solve this, the application ignores the EXIF orientation data entirely and applies a consistent user-defined rotation (typically 180°) to all images, ensuring every photograph has the same orientation regardless of how the camera was positioned.

**Grid assembly.** To get the most out of each AI request, multiple images are assembled into grids. By default, the application creates 3×3 grids (9 images each) and sends 5 grids per message, processing 45 images in a single AI request. The free tier of Google's Gemini API allows 20 messages per day, which means approximately 900 images can be processed per day at no cost. The grid dimensions and images per message can be adjusted: fewer images per message gives better accuracy, while more images per message allows faster processing.

**Cropping.** Before images are placed into the grid, each photograph is cropped to isolate the region containing the handwritten identifier. The crop area is adjustable through a graphical interface with a live preview. Because multiple images are combined into a single grid, each individual image takes up only a small part of the final composite. Cropping removes unnecessary areas (the butterfly wings, ruler, color palette) so that the identifier fills as much of its grid cell as possible, giving the AI a higher-resolution view of the handwritten text and improving reading accuracy.

**AI prompting.** Each message is sent to the Gemini AI with a text prompt that instructs the model to read the specimen identifier from each cell in the grid. The default prompt is designed for reading handwritten "CAM" identifiers, but users can customize the prompt to extract other types of information from images. This makes the application useful beyond specimen renaming—for example, it could be adapted to read herbarium labels, geological sample codes, or any other handwritten text visible in batch photographs.

**Review and correction.** A review interface displays thumbnail images alongside their AI-read identifiers. The system flags potential problems: unpaired identifiers (each specimen should produce exactly two images—one dorsal and one ventral), duplicate IDs, and empty results. Users can edit identifiers directly, skip damaged or blurred images, and sort results by filename, capture date, or identifier.

**File renaming.** Once the user confirms the results, the application renames each file. Photographs are taken in pairs: the first photograph of each specimen captures the dorsal side (the side visible when wings are closed), and the second captures the ventral side. The application uses this order to assign suffixes: the first image with a given identifier receives a "d" suffix (for dorsal) and the second receives a "v" suffix (for ventral). For example, if the AI reads "CAM012345" from two consecutive images, they are renamed to `CAM012345d.JPG` and `CAM012345v.JPG`. The suffix order can be customized if the photography protocol differs. The application keeps a full rename log, so all renames can be undone if needed.

### 2.3 Wings Gallery

#### 2.3.1 Motivation

Once specimen photographs are renamed and organized, researchers need a centralized system to browse, filter, and share images. The original implementation was an R-Shiny application hosted on the free tier of AWS EC2 (a basic cloud server). While the server itself was free, the IP-based URL provided by AWS was not user-friendly, so a free DNS service was used to assign a custom domain name. However, this free domain was blocked by internet providers in the UK, making the application unreachable for many collaborators. The R-Shiny framework also offered limited control over the user interface and was slower to load. A migration to a serverless architecture was needed for better accessibility and performance.

#### 2.3.2 Architecture

The Wings Gallery is a Vue.js single-page application deployed on GitHub Pages. It loads pre-processed data files when the page opens and displays a responsive grid of specimen photographs with filtering options.

**Data flow.** Image files are uploaded to shared folders on Google Cloud services. A custom Google Apps Script automatically indexes all files across multiple folders into a Google Sheets spreadsheet, recording metadata such as file name, URL, capture date, size, and folder path. This script uses the LongRun library to work around the 6-minute execution limit of Google Apps Script, making it possible to index thousands of files across nested folder structures. A Python processing script then downloads the spreadsheet data, resolves image URLs through a cloud image caching service (which prevents rate limiting when many users access images at the same time), and generates optimized data files for the website.

**Gallery views.** The application provides four specialized views:
- **Collection Tab**: Filters individuals by taxonomic level (Family, Subfamily, Tribe, Species, Subspecies) and sex.
- **Insectary Tab**: Displays specimens from the insectary collection, filtered by Insectary ID and biological metadata.
- **CRISPR Tab**: A view for CRISPR-injected specimens, allowing filtering by mutant phenotype.
- **Search Tab**: Fast lookup by specimen identifier (CAMID) with instant results.

**Image interaction.** The gallery supports shift+scroll to zoom all images at once, ctrl+scroll to zoom individual images, and pinch-to-zoom on mobile devices. The image grid automatically adjusts the number of columns based on screen width and zoom level.

**Database updates.** Updating the gallery with new photographs is done with a single click from the browser. The request is handled securely through a cloud function that triggers a GitHub Actions workflow. This workflow runs the Python data processing script, saves updated data files to the repository, and automatically redeploys the website. This removes the need for manual database management and makes updates simple for non-technical users.

### 2.4 Ithomiini Maps

#### 2.4.1 Motivation

Visualizing Ithomiini distributions requires bringing together data from multiple sources with different formats, taxonomic naming conventions, and quality levels. Researchers need to quickly identify which species have been sequenced, where tissue samples are available, and how mimicry ring distributions overlap geographically. Existing tools either require GIS expertise (QGIS, ArcGIS) or lack the specimen-level filtering needed for genomic research planning.

#### 2.4.2 Data Sources and Processing Pipeline

The mapping platform brings together five data sources, organized into two primary datasets and three GBIF sub-sources:

**Dore et al. (2025) published records.** An Excel file containing 28,927 georeferenced occurrence records with full taxonomic classification, mimicry ring assignments for males and females, and observation metadata. This dataset serves as the main source of mimicry ring information and provides the lookup table used to assign mimicry ring data to records from other sources.

**Sanger Institute collection data.** Live data from a Google Sheets database maintained by the sequencing team. Each record includes specimen identifier (CAMID), taxonomic classification, collection locality, GPS coordinates, sequencing status (based on tube rack and tissue fields), and links to wing photographs. The sequencing status is assigned as follows: specimens with valid tube rack entries are classified as "Sequenced"; those with tissue samples are classified as "Tissue Available"; and the rest are classified as "Preserved Specimen".

**GBIF occurrence data.** An automated download script queries the GBIF API (DOI: 10.15468/dl.pbs3eu) for all Ithomiini occurrences. Before downloading, records are pre-filtered to ensure data quality: only records with valid geographic coordinates are included, records with geospatial issues are excluded, only confirmed presence records are kept, and fossils and living specimens are removed. The script correctly parses species names by removing author citations, extracts subspecific epithets, and filters out invalid entries such as BOLD sequence IDs or placeholder names. The downloaded GBIF records are automatically split into three sub-sources based on their origin:
- **iNaturalist**: Research-grade citizen science observations, identified by their dataset key.
- **GBIF (UNAM)**: Records from the Universidad Nacional Autónoma de México museum collections (MZFC-FC-UNAM, IBUNAM, FC-UNAM, FESZ-UNAM), which represent a major Neotropical entomological collection.
- **GBIF (Other Institutions)**: Records from all remaining institutional collections and datasets.

This separation allows users to toggle each sub-source independently on the map, making it possible to assess data origin and quality at a glance.

**Data merging.** The main processing pipeline loads all five sources, standardizes field names, applies consistent taxonomic formatting, and produces individual data files for each source, which are loaded on demand in the browser. A key feature is the mimicry ring assignment system: a lookup table is built from the Dore dataset linking each (species, subspecies) pair to its male and female mimicry ring values. This lookup is then applied to Sanger and GBIF records, first trying an exact match (species + subspecies), then falling back to a species-only match. This ensures mimicry ring data are available even for records that lack subspecies identification.

#### 2.4.3 Taxonomic Curation Pipeline

Bringing together records from different sources requires solving taxonomic inconsistencies: synonyms, misspellings, outdated names, and varying levels of identification. The curation pipeline processes each unique scientific name through multiple steps:

1. **Spelling corrections**: Known misspellings and reclassifications are corrected using a manually maintained corrections file.

2. **GBIF Species Match**: Names are checked against the GBIF backbone taxonomy. Exact matches are accepted; synonyms are resolved to their currently accepted name. Results are stored in a local cache to avoid repeated API calls.

3. **Reference taxonomy verification**: Names that GBIF cannot resolve are checked against a compiled reference taxonomy from Butterflies of America (Warren et al., 2023) and nymphalidae.net. Names found in this reference are accepted as valid.

4. **Subspecies validation**: A similar process is applied at the subspecies level, including edit-distance comparison to detect likely typographical errors.

Each curated record includes a `curation_basis` field that documents how the name was resolved (e.g., "GBIF exact match", "GBIF synonym", "Reference taxonomy"), ensuring full traceability. When a name is changed, the original name is preserved alongside the corrected version, and researchers can review all corrections in the data table. For special cases that the automated pipeline cannot handle, a human-readable corrections file allows manual overrides on a case-by-case basis.

#### 2.4.4 Frontend Interface

The web interface is a Vue.js single-page application using MapLibre GL JS for map rendering (a WebGL-accelerated library that allows smooth interaction with tens of thousands of points).

**Map display.** Five base map styles are available: Dark, Light, Satellite (Esri), Terrain, and Streets. At low zoom levels, nearby points are grouped into clusters that show the number of records in each area. Clicking a cluster expands it to show individual points. Points are colored according to the active legend, which can be set to show different taxonomic levels (subspecies by default).

**Filter system.** Filters are organized in a collapsible sidebar:
- *Taxonomic filters*: A cascading set of filters from Family down to Subspecies, where selecting a value at one level automatically updates the options available at lower levels based on the data.
- *Multi-select with search*: Species and subspecies filters allow selecting multiple values at once with a text search to quickly find specific names.
- *Sequencing status*: Toggle buttons for Sequenced, Tissue Available, Preserved Specimen, Published, Observation, and Museum Specimen categories.
- *Mimicry ring selector*: A visual panel displaying wing pattern icons alongside ring names, with record counts. The 44 mimicry ring categories from Dore et al. (2025) were used to assign mimicry ring values to matching Sanger Institute and GBIF records based on species and subspecies.
- *Date range filter*: A slider for filtering records by collection or observation year.
- *CAMID search*: Instant specimen lookup by identifier.
- *Data source toggle*: Show or hide records from each of the five sources (Dore, Sanger Institute, iNaturalist, GBIF UNAM, GBIF Other Institutions). Each source is loaded on demand to keep initial page loads fast.

**URL sharing.** All active filters are saved in the URL, so researchers can share exact search results with colleagues by simply copying and sending the link. Opening a shared URL restores the complete filter state, map position, and zoom level.

**Specimen details.** Clicking a map point opens a popup showing specimen metadata, taxonomic classification, sequencing status, and a wing photograph when available. If no photograph exists for a specific individual, the system shows a photograph from another individual of the same species or subspecies as a reference.

**Data table.** A sortable, paginated table shows all records that match the current filters, with photo thumbnails, adjustable column visibility, and indicators that distinguish individual photographs from species-level reference images.

**Map image export.** The application can export the current map view as a high-resolution image (PNG or JPG, up to 300 DPI) suitable for publications. The export panel allows customizing the legend position (four corners), the number of legend items shown, aspect ratio (16:9, 4:3, 1:1, or custom dimensions), and whether to include a scale bar and attribution. Users can also customize the legend text and assign custom colors to each legend item, and choose to color points by different taxonomic levels (default is subspecies).

**R script export.** For researchers who prefer to work in R, the application can generate a complete R/ggplot2 package as a ZIP file. This package includes the filtered data as GeoJSON, the map view settings, legend configuration, a basemap image, and a ready-to-run R script that recreates the map as a true vector graphic (PDF or SVG) or high-resolution raster (PNG). The R script auto-installs any missing packages and preserves all styling from the web application, allowing researchers to further customize their maps within the familiar R/ggplot2 framework.

**Data export and citation.** The export panel also provides CSV and GeoJSON downloads of the filtered dataset, and generates a formatted scientific citation that includes the Git commit hash (a unique code identifying the exact version of the data and software used), enabling precise reproducibility. A BibTeX-formatted citation is also available for use in LaTeX documents.

#### 2.4.5 Deployment

The application is deployed through GitHub Actions. When code changes are pushed to the repository, an automated workflow builds the Vue.js application and publishes the compiled files to GitHub Pages. A separate workflow can be triggered manually to run the Python data processing pipeline and refresh the occurrence data from live sources. Since all of this runs on GitHub's servers, no physical computer or paid hosting is needed.

The application is accessible at https://fr4nzz.github.io/ithomiini_maps/.

---

## 3. Results

### 3.1 Data Summary

The Ithomiini Maps platform integrates 104,382 occurrence records from five data sources (Table 1). The largest contributors are the Dore et al. (2025) published dataset (28,927 records), GBIF records from non-UNAM institutions (27,819 records), and the UNAM museum collections (21,586 records). iNaturalist research-grade observations contribute 19,328 records, and the Sanger Institute collection adds 6,722 specimens with sequencing status data. Across all sources, the merged dataset includes 751 unique species, 1,365 subspecies, and 178 genera, spanning 33 countries.

**Table 1.** Data sources integrated in Ithomiini Maps. GBIF data (DOI: 10.15468/dl.pbs3eu) were pre-filtered for valid coordinates, no geospatial issues, confirmed presence, and excluding fossils and living specimens.

| Data Source | Records | Species | Subspecies | Genera | Countries |
|---|---:|---:|---:|---:|---:|
| Dore et al. (2025) | 28,927 | 374 | 999 | 48 | 23 |
| Sanger Institute | 6,722 | 459 | 579 | 169 | 6 |
| iNaturalist | 19,328 | 253 | 175 | 41 | 25 |
| GBIF (UNAM) | 21,586 | 34 | 25 | 19 | 1 |
| GBIF (Other Institutions) | 27,819 | 415 | 461 | 43 | 32 |
| **Total (merged)** | **104,382** | **751** | **1,365** | **178** | **33** |

The five most represented countries are Mexico (29,052 records), Ecuador (18,280), Brazil (15,422), Colombia (9,587), and Peru (8,936), followed by Costa Rica (8,291), Panama (3,456), Bolivia (2,515), and Venezuela (1,894). The high number of Mexican records is driven primarily by the UNAM museum collections.

### 3.2 Sequencing Status

Of the 6,722 Sanger Institute specimens, 4,183 (62.2%) have been sequenced, 1,119 (16.6%) have tissue available for future sequencing, and 1,420 (21.1%) are preserved specimens waiting for tissue extraction. This breakdown is visible on the map through dedicated toggle filters, allowing researchers to identify geographic and taxonomic gaps in the sequencing effort.

### 3.3 Taxonomic Curation

The automated curation pipeline resolved the taxonomy for 104,382 records (Table 2). The majority of records (94.5%) were resolved through the GBIF backbone taxonomy cache, 3.6% were verified against the reference taxonomy (Butterflies of America, nymphalidae.net), 0.8% required live GBIF API queries, 0.3% were synonyms resolved to their accepted names, and 0.2% were corrected through typographical error detection. Of all curated records, 71.1% were verified as exact matches, 11.9% were classified as nominotypical subspecies, and 2.1% had synonyms resolved. Only 0.6% of records could only be matched to a higher taxonomic rank, and 0.0% (2 records) remained unresolved.

**Table 2.** Taxonomic curation results. Curation basis indicates the method used to resolve each record's taxonomy.

| Curation Basis | Records | Percentage |
|---|---:|---:|
| GBIF backbone cache | 98,589 | 94.5% |
| Reference taxonomy (BoA / nymphalidae.net) | 3,739 | 3.6% |
| GBIF API (live query) | 853 | 0.8% |
| GBIF synonym resolution | 263 | 0.3% |
| Typographical error detection | 202 | 0.2% |
| Literature corrections | 4 | <0.1% |

### 3.4 Mimicry Ring Coverage

The mimicry ring lookup from Dore et al. (2025) contains 44 distinct mimicry ring categories (Table S1). The most record-rich rings are Agnosia (14,930 records across 83 species), Hermias (12,393 records, 50 species), Lerida (12,262 records, 65 species), and Mamercus (11,452 records, 58 species). These mimicry ring values were propagated to Sanger Institute and GBIF records based on species and subspecies matching, allowing researchers to filter and visualize mimicry ring distributions across data sources.

### 3.5 Performance and Data Efficiency

The serverless architecture results in fast load times and minimal data transfer. The compiled web application (JavaScript and CSS) totals approximately 475 KB when compressed (gzipped). Data files are loaded on demand: by default, only the Sanger Institute dataset and image supplement are loaded on first visit (~4.0 MB), with additional data sources loaded when the user activates them. The full dataset across all five sources totals approximately 61 MB. MapLibre GL JS uses WebGL rendering to maintain smooth interactions even when all sources are loaded simultaneously. Taxonomic filter updates are computed in the user's browser in under 100 milliseconds.

GitHub Pages provides high availability (99.9% uptime) and serves files through a global content delivery network. Unlike the previous R-Shiny deployment of the Wings Gallery (which required an AWS EC2 instance), the current deployment has zero website hosting costs—the only expense is cloud storage for specimen photographs—and needs no system administration.

---

## 4. Discussion

### 4.1 Comparison with Existing Tools

The *Heliconius* interactive maps (Rosser & Mallet, 2024) showed the value of open-source, GitHub-hosted mapping tools for Lepidoptera research. Their platform was built using R and the Leaflet library to generate a static website—an approach that works well for displaying curated datasets but has limitations in interactivity: filter changes can be slow with large datasets, the user interface is limited by R-Shiny or static HTML capabilities, and customization options are limited compared to modern JavaScript frameworks. Our toolkit builds on this approach in several ways: (i) we address the earlier specimen digitization workflow (photography, AI-assisted cataloguing, image hosting), which is absent from the *Heliconius* platform; (ii) we bring together multiple data sources with automated taxonomic curation, whereas the *Heliconius* maps use a single curated dataset; (iii) we add sequencing status filters designed for ongoing genomic projects, enabling strategic planning of which taxa to sequence next; and (iv) we provide high-resolution map image export, R script export for further customization, and automatic citation generation for publications. The use of Vue.js and MapLibre GL JS enables live client-side filtering, smooth WebGL map rendering, and a fully customizable interface that can be extended as research needs evolve.

Several general-purpose biodiversity platforms offer mapping features. GBIF's portal (https://gbif.org) provides global occurrence visualization, but lacks specimen-level filtering by sequencing status, mimicry phenotype, or project-specific metadata. iNaturalist provides citizen science observations with photographs, but does not include institutional sequencing data. Specialized tools such as Map of Life (Jetz et al., 2012) provide expert range maps but do not support the specimen-level filtering needed for genomic research planning.

Our toolkit fills a specific gap: a researcher-oriented platform that combines project-specific data (institutional collections, sequencing status) with public biodiversity data (GBIF) in an interface designed for evolutionary biology workflows. The modular architecture and open-source licensing mean that other research groups can adapt these tools for their own taxa, as encouraged by Rosser & Mallet (2024).

### 4.2 AI-Assisted Specimen Photograph Renaming

The AI Photo Processor applies Google's Gemini AI to a practical bottleneck in biodiversity research: reading handwritten specimen labels from photographs. Traditional text recognition systems struggle with handwritten text on complex photographic backgrounds containing specimen wings, rulers, and color palettes. By using a modern AI model with image understanding abilities, the system can interpret handwritten identifiers within the visual context of specimen photographs without needing to isolate the text or remove the background first.

The grid-based approach (combining multiple images into a single combined image before sending to the AI) is a practical solution to make the most of each API request. Processing 45 images per request under the free tier means that a single day's quota can handle 900 images at no cost. Because the application allows users to customize the AI prompt, this approach can be used beyond entomological collections: any specimen-based research that uses handwritten labels—herbarium sheets, geological samples, archaeological artifacts—could adapt the tool by changing the text prompt to ask for whatever information is visible in the images.

### 4.3 Sustainability and Reproducibility

A central design goal was ensuring long-term availability without ongoing costs or maintenance. The serverless model avoids the most common problems of research software: expired cloud credits, unmaintained servers, and outdated server-side frameworks. As long as GitHub Pages remains available (and given its widespread use in both industry and academia, this is likely for the long term), the applications will stay online.

Reproducibility is addressed through several features. The Git commit hash is included in auto-generated citations, allowing exact identification of the data version used in any analysis. Filter states saved in URLs serve as shareable records of search settings. Exported datasets include all metadata needed to reproduce the filtering criteria. The R export package allows researchers to reproduce and customize maps entirely within their local R environment.

### 4.4 Limitations and Future Directions

The current implementation has several limitations that point to future development:

**Taxonomic curation scope.** While the automated pipeline resolves many naming inconsistencies by checking names against the GBIF backbone taxonomy and a reference taxonomy compiled from Butterflies of America and nymphalidae.net, it may still miss recently described taxa or contested synonymies. The data table shows both the original and corrected taxonomic names, allowing researchers to spot errors, and a human-readable corrections file allows manual fixes on a case-by-case basis. As taxonomic databases continue to be updated, the pipeline's accuracy will improve over time.

**Species distribution modeling.** Predictive habitat suitability models (e.g., MaxEnt) are not yet integrated. A future direction would be to compute these models through GitHub Actions or a free-tier cloud computing service and display the predicted distributions as map overlays, allowing users to compare observed occurrences with modeled suitable habitat.

**Host plant distributions.** An important ecological layer would be to include the geographic distribution of known Ithomiini host plant species (primarily Solanaceae), enabling researchers to explore the relationship between butterfly and host plant ranges directly on the map.

**Broader taxonomic scope.** The current platform focuses on Ithomiini, but the architecture could be extended to include all Lepidoptera occurrences, providing a broader context for understanding butterfly distributions.

**AI accuracy.** The AI Photo Processor's reading accuracy depends on handwriting legibility and image quality. As AI models continue to improve, the accuracy of handwritten text recognition will increase over time, reducing the need for manual corrections.

**User interface improvements.** The applications will continue to evolve based on user feedback, with planned improvements to make the interface more user-friendly and the addition of new features beyond those described at the time of writing.

---

## 5. Conclusions

We have presented an integrated open-source toolkit that covers the complete specimen-to-map pipeline for Ithomiini butterfly research. The AI Photo Processor automates the time-consuming task of reading handwritten specimen identifiers using AI, with a customizable prompt system that makes it adaptable to other research contexts. The Wings Gallery provides a centralized, filterable image browser with zero server costs and one-click updates. Ithomiini Maps brings together different occurrence data sources into an interactive mapping platform with taxonomic filters, mimicry ring selectors, sequencing status indicators, and both image and R script export for publications. Together, these tools show that modern web technologies and AI services can greatly improve the efficiency and accessibility of biodiversity research tools, while maintaining long-term sustainability through a fully serverless approach.

All source code is freely available under the MIT License at:
- AI Photo Processor: https://github.com/Fr4nzz/rename_photos_AI
- Wings Gallery: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery
- Ithomiini Maps: https://github.com/Fr4nzz/ithomiini_maps

---

## 6. Data Availability Statement

The occurrence data shown in Ithomiini Maps comes from:
- Dore et al. (2025) — Published dataset available at [repository DOI to be added]
- GBIF occurrence data — Downloaded via the GBIF API (DOI: 10.15468/dl.pbs3eu), filtered for tribe Ithomiini (45 genera), with quality filters applied (coordinates present, no geospatial issues, confirmed presence, excluding fossils and living specimens). Records split into: iNaturalist research-grade observations, UNAM museum collections, and other institutional datasets.
- Sanger Institute collection data — Available upon request from the corresponding research group

The processed data files and all source code are available in the GitHub repositories listed above. Version-specific data can be retrieved using the Git commit hashes included in the application's citation system.

---

## 7. Acknowledgments

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Ithomiini Maps. We acknowledge the Global Biodiversity Information Facility (GBIF) and its data publishers for providing open occurrence data. [Additional acknowledgments to be added.]

---

## References

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. *Molecular Ecology*, 28(10), 2423–2438.

Dore, M. et al. (2025). [Full citation for the published Ithomiini occurrence dataset. To be completed.]

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. *PLoS Biology*, 6(12), e300.

Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating biodiversity distribution knowledge: toward a global map of life. *Trends in Ecology & Evolution*, 27(3), 151–159.

Jiggins, C.D. (2017). *The Ecology and Evolution of Heliconius Butterflies*. Oxford University Press.

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. *Tropical Lepidoptera Research*, 34(1), 26–30.

Rosser, N., Phillimore, A.B., Huertas, B., Willmott, K.R. & Mallet, J. (2012). Testing historical explanations for gradients in species richness in heliconiine butterflies of tropical America. *Biological Journal of the Linnean Society*, 105(3), 479–497.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). *Illustrated Lists of American Butterflies*. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. *Cladistics*, 22(4), 297–368.

---

## Figures

**Figure 1.** System architecture overview showing the three applications and their connections. The AI Photo Processor (left) reads handwritten specimen identifiers and renames image files. Renamed photographs are uploaded to Google Cloud services and indexed via Google Apps Script. The Wings Gallery (center) provides a web interface for browsing specimen photographs, with one-click database updates via GitHub Actions. The Ithomiini Maps platform (right) brings together occurrence data from five sources (Dore et al., Sanger Institute, iNaturalist, GBIF UNAM, GBIF Other Institutions) through a Python data processing pipeline with automated taxonomic curation, producing an interactive map with multi-dimensional filtering. All web applications run in the user's browser and are hosted on GitHub Pages.

**Figure 2.** The AI Photo Processor interface. (A) The Process Images tab showing the grid assembly preview, where multiple specimen photographs are combined into a single image for efficient AI processing. (B) The Review Results tab displaying AI-read identifiers alongside thumbnail images, with editing and pair-verification indicators.

**Figure 3.** The Wings Gallery interface. (A) The Collection tab showing a filtered grid of wing photographs with taxonomic filters active. (B) A zoomed view of a single specimen photograph showing wing pattern detail.

**Figure 4.** The Ithomiini Maps interface. (A) Full application view with the filter sidebar, mimicry ring selector, and map showing clustered occurrence points across South America. (B) Detail view with individual points visible at higher zoom, showing a specimen popup with wing photograph and metadata. (C) The data table view with photo thumbnails, sortable columns, and pagination. (D) The export panel showing CSV download, map image export with customizable legend, and auto-generated citation with Git commit hash. (E) R script export package showing the generated ggplot2 map.

**Figure 5.** Taxonomic curation pipeline flowchart. Each unique scientific name passes through spelling correction, GBIF backbone matching, reference taxonomy verification (Butterflies of America, nymphalidae.net), and subspecies validation. The `curation_basis` field records how each name was resolved, and a human-readable corrections file allows manual overrides.

---

## Supplementary Material

### Table S1. Mimicry ring categories from Dore et al. (2025)

Complete list of the 44 mimicry rings with the number of occurrence records and species in the integrated dataset. Representative species (up to 3) are shown for each ring.

| Mimicry Ring | Records | Species | Subspecies | Representative Species |
|---|---:|---:|---:|---|
| Acrisione | 46 | 1 | 1 | *Athesis acrisione* |
| Agnosia | 14,930 | 83 | 132 | *Brevioleria arzalia*, *Dircenna adina*, *Episcada hymenaea* |
| Amalda | 2,514 | 9 | 15 | *Hypoleria lavinia*, *Hyposcada schausi*, *Ithomia diasia* |
| Aureliana | 739 | 12 | 25 | *Brevioleria aelia*, *Brevioleria arzalia*, *Brevioleria seba* |
| Banjana-M | 2,007 | 43 | 65 | *Episcada salvinia*, *Godyris lauta*, *Hyalenna sulmona* |
| Confusa | 6,022 | 20 | 51 | *Athesis acrisione*, *Callithomia lenea*, *Ceratinia neso* |
| Dercyllidas | 188 | 1 | 2 | *Patricia dercyllidas* |
| Dilucida | 6,606 | 40 | 81 | *Athesis clearista*, *Callithomia lenea*, *Ceratinia neso* |
| Doto | 756 | 15 | 35 | *Callithomia lenea*, *Ceratinia neso*, *Dircenna dero* |
| Duessa | 142 | 4 | 12 | *Hyalyris oulita*, *Hypothyris leprieuri*, *Hypothyris thea* |
| Duillia | 238 | 3 | 2 | *Godyris duillia*, *Hypomenitis alphesiboea*, *Pachacutia baroni* |
| Egra | 114 | 11 | 13 | *Hypoleria alema*, *Hypoleria mulviana*, *Hypoleria sarepta* |
| Eurimedia | 6,652 | 35 | 113 | *Aeria elara*, *Aeria eurimedia*, *Aeria olena* |
| Excelsa | 3,014 | 17 | 49 | *Callithomia hezia*, *Callithomia hydra*, *Dircenna olyras* |
| Hemixanthe | 390 | 7 | 7 | *Episcada hemixanthe*, *Episcada zajciwi*, *Hyalyris leptalina* |
| Hermias | 12,393 | 50 | 204 | *Athyrtis mechanitis*, *Callithomia alexirrhoe*, *Callithomia lenea* |
| Hewitsoni | 937 | 27 | 40 | *Athesis vitrala*, *Episcada apuleia*, *Godyris hewitsoni* |
| Humboldt | 34 | 1 | 3 | *Elzunia humboldt* |
| Illinissa | 162 | 6 | 8 | *Brevioleria aelia*, *Hyposcada anchiala*, *Hyposcada illinissa* |
| Lerida | 12,262 | 65 | 158 | *Brevioleria aelia*, *Brevioleria plisthenes*, *Callithomia lenea* |
| Libethris | 534 | 21 | 26 | *Dircenna adina*, *Episcada clausina*, *Episcada hymenaea* |
| Lysimnia | 2,352 | 5 | 13 | *Hyalyris fiammetta*, *Hypothyris ninonia*, *Mechanitis lysimnia* |
| Maelus | 4,516 | 16 | 56 | *Callithomia alexirrhoe*, *Ceratinia neso*, *Ceratinia poecila* |
| Mamercus | 11,452 | 58 | 178 | *Callithomia alexirrhoe*, *Callithomia hezia*, *Callithomia hydra* |
| Mantineus | 359 | 5 | 5 | *Ceratinia tutia*, *Ithomia cleora*, *Mechanitis menapis* |
| Mestra | 416 | 13 | 27 | *Dircenna adina*, *Hyalyris antea*, *Hyalyris mestra* |
| Mothone | 1,546 | 14 | 26 | *Ceratinia poecila*, *Hyposcada anchiala*, *Hypothyris anastasia* |
| Ocna | 511 | 13 | 33 | *Callithomia hezia*, *Dircenna adina*, *Hyalyris antea* |
| Orestes | 1,316 | 15 | 29 | *Athyrtis mechanitis*, *Ceratinia poecila*, *Forbestra olivencia* |
| Ozia | 731 | 19 | 16 | *Brevioleria coenina*, *Dircenna adina*, *Episcada hymenaea* |
| Panthyale | 610 | 39 | 71 | *Episcada apuleia*, *Episcada ticidella*, *Godyris zavaleta* |
| Parallelis | 596 | 7 | 14 | *Hyposcada anchiala*, *Hyposcada illinissa*, *Hyposcada virginiana* |
| Pavonii | 223 | 2 | 6 | *Elzunia humboldt*, *Elzunia pavonii* |
| Polita | 1,042 | 10 | 12 | *Dircenna jemina*, *Episcada hymenaea*, *Episcada polita* |
| Praestans | 11 | 1 | 1 | *Olyras insignis* |
| Praxilla | 207 | 9 | 17 | *Hyalyris antea*, *Hyalyris lactea*, *Hyalyris mestra* |
| Quintina | 186 | 6 | 6 | *Hyposcada illinissa*, *Hyposcada kena*, *Oleria estella* |
| Sinilia | 101 | 9 | 14 | *Brevioleria aelia*, *Hyposcada illinissa*, *Hyposcada kena* |
| Susiana | 330 | 12 | 18 | *Hyposcada attilodes*, *Hyposcada taliata*, *Megoleria orestilla* |
| Thabena-F | 89 | 6 | 7 | *Oleria deronda*, *Oleria derondina*, *Ollantaya aegineta* |
| Theudelinda | 181 | 8 | 14 | *Hypomenitis hermana*, *Hypomenitis oneidodes*, *Hypomenitis theudelinda* |
| Ticidam | 251 | 8 | 7 | *Episcada ticidella*, *Hyalenna sulmona*, *Ithomia avella* |
| Umbrosa | 42 | 3 | 5 | *Godyris lauta*, *Hypomenitis depauperata*, *Hypomenitis ochretis* |
| Vestilla | 20 | 1 | 1 | *Pteronymia vestilla* |

### Table S2. Taxonomic curation pipeline: detailed status breakdown

Of 104,382 total records curated:

| Curation Status | Records | Percentage |
|---|---:|---:|
| Verified (exact match) | 74,170 | 71.1% |
| Verified nominotypical subspecies | 12,433 | 11.9% |
| Subspecies unresolved | 9,907 | 9.5% |
| Undescribed subspecies | 2,224 | 2.1% |
| Synonym resolved | 2,142 | 2.1% |
| Verified via reference taxonomy | 1,861 | 1.8% |
| Not curated | 730 | 0.7% |
| Higher rank match only | 615 | 0.6% |
| Non-standard subspecies | 244 | 0.2% |
| Subspecies synonym | 48 | <0.1% |
| Corrected via literature | 6 | <0.1% |
| Not found | 2 | <0.1% |

### Table S3. GBIF quality filters

The following filters were applied during the GBIF download (DOI: 10.15468/dl.pbs3eu, downloaded 2026-01-05):

| Filter | Setting | Purpose |
|---|---|---|
| Taxon scope | All 45 Ithomiini genera | Covers full tribal diversity |
| HAS_COORDINATE | true | Only georeferenced records |
| HAS_GEOSPATIAL_ISSUE | false | Excludes records with coordinate problems |
| OCCURRENCE_STATUS | PRESENT | Excludes absence records |
| BASIS_OF_RECORD exclusions | FOSSIL_SPECIMEN, LIVING_SPECIMEN | Removes non-wild occurrences |

Total records downloaded: 68,733. After processing (name parsing, coordinate validation, source splitting), these were distributed as: iNaturalist (19,328), GBIF UNAM (21,586), and GBIF Other Institutions (27,819).
