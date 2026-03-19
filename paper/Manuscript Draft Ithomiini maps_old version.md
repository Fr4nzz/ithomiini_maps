**From Photos to Maps: Open-source tools for AI photo renaming, image gallery, and interactive maps of Ithomiini butterflies**

**Franz Chandi**¹, **Patricio A. Salazar Carrión**²,³, **Joana I. Meier**³

¹ Universidad San Francisco de Quito, Quito, Ecuador

² Department of Zoology, University of Cambridge, Cambridge, United Kingdom

³ Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom

# **Abstract**

Studying butterfly diversity requires integrating data from fieldwork, museum collections, genomic sequencing programs, and global biodiversity databases. However, the tools available for managing specimen photographs, organizing taxonomic records, and visualizing geographic distributions are often separate, require different software packages, and require specialized technical expertise. Here we present an integrated open-source toolkit of three web-based applications that together cover the full workflow from specimen photography to interactive distribution mapping for Ithomiini butterflies (Nymphalidae: Danainae). (1) AI Photo Processor, a desktop application that uses Google's Gemini AI to read handwritten specimen identifiers from photographs and automatically rename image files in batch; (2) Wings Gallery, a serverless web application for browsing, filtering, and sharing high-resolution wing photographs linked to Google Cloud image services; and (3) Ithomiini Maps, an interactive mapping platform that integrates occurrence records from published datasets, institutional sequencing databases, and the Global Biodiversity Information Facility (GBIF) into a single filterable map interface. All three applications run entirely in the user's browser and are hosted on GitHub Pages at zero cost, with Python-based data processing pipelines running on GitHub Actions for automated updates. GBIF records are pre-filtered to include only trustworthy data: records with valid coordinates, no geospatial issues, confirmed presence status, and excluding fossils and living specimens. The mapping platform currently integrates 104,382 occurrence records across 751 species and 1,365 subspecies from five data sources spanning 33 countries, with taxonomic filters, sequencing status indicators, mimicry ring phenotype selectors, date range controls, and data source toggles. Users can export filtered datasets, generate publication-ready map images, and share exact search configurations through URLs. We describe the architecture, data pipelines, and taxonomic curation procedures, and discuss how this serverless approach offers a sustainable, reproducible, and free alternative to server-based platforms for biodiversity research.

**Keywords:** biodiversity informatics, Nymphalidae, interactive maps, specimen digitization, Lepidoptera, open-source, mimicry rings, GBIF, distribution mapping

# **1\. Introduction**

Ithomiini butterflies (Nymphalidae: Danainae) are one of the most species-rich and ecologically important butterfly tribes in the Neotropics, with over 390 described species found mainly across Central and South America (Willmott & Freitas, 2006; Chazot et al., 2019). Their remarkable diversity of wing color patterns, shaped by Müllerian mimicry complexes involving dozens of co-occurring species, has established them as a model system for studying speciation, adaptation, and ecological interactions (Elias et al., 2008; Jiggins, 2017; Dore et al., 2025). The recent publication of a large dataset of nearly 29,000 georeferenced occurrence records with mimicry ring classifications (Dore et al., 2025), together with ongoing genomic sequencing efforts at the Wellcome Sanger Institute, has created a unique opportunity to study Ithomiini biogeography at a broad scale.

However, managing, visualizing, and sharing these data remains a practical challenge. Researchers working with Ithomiini specimens typically face a fragmented workflow: thousands of preserved wings may be physically stored waiting to be photographed, and the steps required to rename each photograph with its specimen identifier, upload images to the cloud, and make them available for colleagues are time-consuming and lack a straightforward pipeline. Meanwhile, geographic data from multiple sources (published records, institutional databases, GBIF, iNaturalist) must be manually combined, cleaned, and mapped using specialized GIS software. These disconnected steps introduce delays and potential errors that slow down collaborative research.

Early attempts to address the image sharing problem using R-Shiny applications hosted on free cloud instances encountered practical limitations: IP-based URLs were not user-friendly, and free DNS services used to provide custom domains were blocked by internet service providers in some countries, rendering applications unreachable for collaborators. These experiences motivated a migration to GitHub Pages, which provides free, reliable static hosting without such dependencies. This paper presents a simplified pipeline that covers the full process from specimen photography to serving images and occurrence data for researchers through unified web applications.

Interactive web-based mapping tools have emerged as a solution for biodiversity visualization. Rosser & Mallet (2024) developed open-source interactive maps for *Heliconius* butterflies using R and the Leaflet library to create a static website hosted on GitHub. Their platform enabled researchers to visualize phenotypic and geographic data within a single interface, and their explicit goal of making their methods "straightforward for researchers to adapt to their own taxa" inspired this work. However, the R/Leaflet approach has limitations: it lacks live client-side filtering (filter changes require page reloads or server round-trips), offers limited options for customizing the user interface, and renders maps more slowly when handling large datasets. Additionally, the *Heliconius* maps address only the visualization step; the earlier steps of specimen digitization, image management, and multi-source data integration are not covered.

Here we present a toolkit of three connected open-source applications that together address the complete specimen-to-map pipeline for Ithomiini butterflies:

1\. **AI Photo Processor** — A desktop application for batch reading of handwritten specimen identifiers from wing photographs using Google's Gemini AI, enabling automated file renaming at scale. While developed for this specific purpose, the application was intentionally designed so that users can customize the AI prompt to extract other types of information from images, making it adaptable to different research contexts.

2\. **Wings Gallery** — A serverless web gallery for browsing, filtering, and sharing high-resolution wing photographs stored on Google Cloud services, with one-click database updates.

3\. **Ithomiini Maps** — An interactive mapping platform that aggregates occurrence records from published literature, institutional sequencing databases, and GBIF into a single interface with taxonomic, phenotypic, and sequencing status filters, as well as map and data export features.

All components are built with Vue.js for the web interface and Python for data processing. They are hosted as static sites on GitHub Pages, which means the applications run entirely in the user's browser with no need for dedicated servers. Website hosting is provided by GitHub at no cost; the only expense is cloud storage for the specimen photographs on Google Cloud services. Data processing pipelines run through GitHub Actions (an automated task runner provided by GitHub) so that data updates happen in the cloud without needing a physical computer. This paper describes the architecture, implementation, and intended uses for each component, and discusses the advantages of this approach for biodiversity research.

# **2\. Methods and Implementation**

## **2.1 System Architecture Overview**

The toolkit uses a separated architecture in which data processing happens in the cloud (through GitHub Actions automated pipelines) and the resulting files are served as a static website via GitHub Pages (Figure 1). This separation has several benefits: (i) the website remains lightweight and loads quickly since no computation happens on a server; (ii) data can be updated by re-running processing scripts, which is automated; and (iii) website hosting is free through GitHub, with the only cost being cloud storage for specimen photographs on Google Cloud services.

All three applications share a common set of technologies:

• **Web framework:** Vue.js 3 for the user interface

• **Build tool:** Vite (for fast development and optimized production builds)

• **Data processing:** Python with Pandas for data cleaning, and the GBIF API for downloading occurrence records

• **Hosting:** GitHub Pages (free static site hosting)

• **Automated pipelines:** GitHub Actions (runs data processing scripts in the cloud, triggered manually or on code updates)

 

## **2.2 AI Photo Processor**

### **2.2.1 Motivation**

Large-scale specimen photography generates thousands of image files with generic camera-assigned filenames (e.g., IMG\_01234.JPG). Each specimen is typically photographed from two angles (dorsal and ventral), and a handwritten identifier label (e.g., "CAM012345") is placed alongside the wings during photography. Manually reading these identifiers and renaming each file is slow and error-prone, especially when processing batches of hundreds or thousands of images.

### **2.2.2 Architecture**

The AI Photo Processor ([https://github.com/Fr4nzz/rename\_photos\_AI](https://github.com/Fr4nzz/rename_photos_AI)) is a desktop application built with Python and PyQt5. It uses Google's Gemini AI (a generative AI model with image understanding abilities) to read handwritten specimen labels within photographs. To maximize accessibility, the application is distributed both as Python source code and as a standalone Windows executable requiring no installation.

The processing pipeline works as follows:

**Image rotation.** Since cameras are often mounted pointing downwards, small physical adjustments can cause varying EXIF orientation tags, resulting in photographs appearing rotated differently across software. The application handles EXIF-safe rotation across multiple formats including JPEG, HEIC/HEIF, and RAW files, modifying only orientation tags rather than pixels. Users can apply a consistent rotation (typically 180°) ensuring every photograph has the same orientation regardless of camera positioning.

**Grid assembly.** To maximize efficiency of each AI request, multiple images are assembled into grids. By default, the application creates 3×3 grids and sends 5 grids per message, processing 45 images per API request. Grid dimensions are adjustable to balance accuracy against throughput. Under the free API tier, approximately 900 images can be processed daily at no cost.

**Cropping.** Before grid assembly, each photograph can be cropped to isolate the label region, adjustable through a graphical interface with live preview. This removes irrelevant areas (the butterfly wings, ruler, color palette) so the ID fills more of its grid cell, improving AI reading accuracy.

**AI prompting.** Each message is sent to the Gemini AI with a text prompt that instructs the model to read the specimen identifier from each cell in the grid. The system uses Google's Gemini models, with Gemini 3 Flash recommended as the default due to its strong vision capabilities and compatibility with free-tier API keys. The default prompt is designed for reading handwritten "CAM" identifiers, but users can customize the prompt to extract other types of information from images. This makes the application useful beyond specimen renaming—for example, it could be adapted to read herbarium labels, geological sample codes, or any other handwritten text visible in batch photographs.

**Review and correction.** A review interface displays thumbnail images alongside their AI-read identifiers. The system flags potential problems: unpaired identifiers (each specimen should produce exactly two images—one dorsal and one ventral), duplicate IDs, and empty results. Users can edit identifiers directly, skip damaged or blurred images, and sort results by filename, capture date, or identifier.

**File renaming.** Once the user confirms the results, the application renames each file. Photographs are typically taken in dorsal-ventral pairs. The application assigns "d" and "v" suffixes accordingly (e.g., CAM012345d.JPG, CAM012345v.JPG). Suffix order is customizable, and all renames can be undone via a logged restore function.

## **2.3 Wings Gallery**

### **2.3.1 Motivation**

Once specimen photographs are renamed and organized, researchers need a centralized system to browse, filter, and share images. The current Wings Gallery ([https://github.com/rapidspeciation/Shiny\_Ikiam\_Wings\_Gallery](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery)) implementation replaced an earlier R-Shiny version that faced accessibility and performance limitations. The Vue.js architecture provides faster load times and full control over the user interface.

### **2.3.2 Architecture**

The Wings Gallery is a Vue.js single-page application deployed on GitHub Pages. It loads pre-processed data files when the page opens and displays a responsive grid of specimen photographs with filtering options.

**Data flow.** Image files are uploaded to shared folders on Google Cloud services. A custom Google Apps Script automatically indexes all files across multiple folders into a Google Sheets spreadsheet, recording metadata such as file name, URL, capture date, size, and folder path. This script uses the LongRun library to work around the 6-minute execution limit of Google Apps Script, enabling the indexing of thousands of files across nested folder structures without manual intervention—a key component of the automated pipeline. A Python processing script then downloads the spreadsheet data, resolves image URLs through a cloud image caching service for optimized delivery, and generates optimized data files for the website.

**Gallery views.** The application provides four specialized views:

• **Collection Tab:** Filters individuals by taxonomic level (Family, Subfamily, Tribe, Species, Subspecies) and sex.

• **Insectary Tab:** Displays specimens from the insectary collection, filtered by Insectary ID and biological metadata.

• **CRISPR Tab:** A view for CRISPR-injected specimens, allowing filtering by mutant phenotype.

• **Search Tab:** Fast lookup by specimen identifier (CAMID) with instant results.

 

**Image interaction.** The gallery supports shift+scroll to zoom all images at once, ctrl+scroll to zoom individual images. The image grid automatically adjusts the number of columns based on screen width and zoom level.

**Database updates.** Updating the gallery with new photographs is done with a single click from the browser. The request is handled securely through a cloud function that triggers a GitHub Actions workflow. This workflow runs the Python data processing script, saves updated data files to the repository, and automatically redeploys the website. This removes the need for manual database management and makes updates simple for non-technical users.

## **2.4 Ithomiini Maps**

### **2.4.1 Motivation**

Visualizing Ithomiini distributions requires bringing together data from multiple sources with different formats, taxonomic naming conventions, and quality levels. Researchers need to quickly identify which species have been sequenced, where tissue samples are available, and how mimicry ring distributions overlap geographically. Existing tools either require GIS expertise (QGIS, ArcGIS) or lack the specimen-level filtering needed for genomic research planning.

### **2.4.2 Data Sources and Processing Pipeline**

The Ithomiini Maps ([https://rapidspeciation.github.io/ithomiini\_maps/](https://rapidspeciation.github.io/ithomiini_maps/)) platform consolidates five data sources, organized into two primary datasets and three GBIF sub-sources:

**~~Dore et al. (2025)~~Doré et al. (2023) published records.** An Excel file containing 28,927 georeferenced occurrence records with full taxonomic classification, mimicry ring assignments for males and females, and observation metadata. This dataset serves as the main source of mimicry ring information and provides the lookup table used to assign mimicry ring data to records from other sources.

**Sanger Institute collection data.** Real-time data from a Google Sheets database maintained by the sequencing team. Each record includes specimen identifier (CAMID), taxonomic classification, collection locality, GPS coordinates, sequencing status (based on tube rack and tissue fields), and links to wing photographs. The sequencing status is assigned as follows: specimens with valid tube rack entries are classified as "Sequenced"; those with tissue samples are classified as "Tissue Available"; and the rest are classified as "Preserved Specimen".

**GBIF occurrence data.** An automated download script queries the GBIF API (DOI: 10.15468/dl.pbs3eu) for all Ithomiini occurrences. Before downloading, records are pre-filtered to ensure data quality: only records with valid geographic coordinates are included, records with geospatial issues are excluded, only confirmed presence records are kept, and fossils and living specimens are removed. The script correctly parses species names by removing author citations, extracts subspecific epithets, and filters out invalid entries such as BOLD sequence IDs or placeholder names. The downloaded GBIF records are automatically split into three sub-sources based on their origin:

• **iNaturalist:** Research-grade citizen science observations, identified by their dataset key.

• **GBIF (UNAM):** Records from the Universidad Nacional Autónoma de México museum collections (MZFC-FC-UNAM, IBUNAM, FC-UNAM, FESZ-UNAM), which represent a major Neotropical entomological collection.

• **GBIF (Other Institutions):** Records from all remaining institutional collections and datasets.

 

This separation allows users to toggle each sub-source independently on the map, making it possible to assess data origin and quality at a glance.

**Data merging.** The main processing pipeline loads all five sources, standardizes field names, applies consistent taxonomic formatting, and produces individual data files for each source, which are loaded on demand in the browser. A key feature is the mimicry ring assignment system: a lookup table is built from the Dore dataset linking each (species, subspecies) pair to its male and female mimicry ring values. This lookup is then applied to Sanger and GBIF records, first trying an exact match (species \+ subspecies), then falling back to a species-only match. This ensures mimicry ring data are available even for records that lack subspecies identification.

### **2.4.3 Taxonomic Curation Pipeline**

Combining records from different sources requires resolving taxonomic inconsistencies: synonyms, misspellings, and outdated names. The curation pipeline processes each unique scientific name through multiple steps:

1\. **Spelling corrections:** Known misspellings and reclassifications are corrected using a manually maintained corrections file.

2\. **GBIF Species Match:** Names are checked against the GBIF backbone taxonomy. Exact matches are accepted; synonyms are resolved to their currently accepted name. Results are stored in a local cache to avoid repeated API calls.

3\. **Reference taxonomy verification:** Names that GBIF cannot resolve are checked against a compiled reference taxonomy from Butterflies of America (Warren et al., 2023\) and nymphalidae.net. Names found in this reference are accepted as valid.

4\. **Subspecies validation:** A similar process is applied at the subspecies level, including edit-distance comparison to detect likely typographical errors.

 

Each curated record includes a curation\_basis field that documents how the name was resolved (e.g., "GBIF exact match", "GBIF synonym", "Reference taxonomy"), ensuring full traceability. When a name is changed, the original name is preserved alongside the corrected version, and researchers can review all corrections in the data table. For special cases that the automated pipeline cannot handle, a human-readable corrections file allows manual overrides on a case-by-case basis.

### **2.4.4 Frontend Interface**

The web interface is a Vue.js single-page application using MapLibre GL JS for map rendering (a WebGL-accelerated library that allows smooth interaction with tens of thousands of points).

**Map display.** Five base map styles are available: Dark, Light, Satellite (Esri), Terrain, and Streets. At low zoom levels, nearby points are grouped into clusters that show the number of records in each area. Clicking a cluster expands it to show individual points. Points are colored according to the active legend, which can be set to show different taxonomic levels (subspecies by default).

**Filter system.** Filters are organized in a collapsible sidebar:

• *Taxonomic filters:* Cascading filters from Family to Subspecies, with multi-select and fuzzy search at species/subspecies levels.

• *Sequencing status:* Toggle buttons for Sequenced, Tissue Available, Preserved Specimen, Published, Observation, and Museum Specimen categories.

• *Mimicry ring selector:* A visual panel displaying wing pattern icons alongside ring names, with record counts. The 44 mimicry ring categories from ~~Dore et al. (2025)~~Doré et al. (2023) were used to assign mimicry ring values to matching Sanger Institute and GBIF records based on species and subspecies.

• *Date range filter:* A slider for filtering records by collection or observation year.

• *CAMID search:* Instant specimen lookup by identifier.

• *Data source toggle:* Show or hide records from each of the five sources (Dore, Sanger Institute, iNaturalist, GBIF UNAM, GBIF Other Institutions). Each source is loaded on demand to keep initial page loads fast.

 

**URL sharing.** All active filters are saved in the URL, so researchers can share exact search results with colleagues by simply copying and sending the link. Opening a shared URL restores the complete filter state, map position, and zoom level.

**Specimen details.** Clicking a map point opens a popup showing specimen metadata, taxonomic classification, sequencing status, and a wing photograph when available. If no photograph exists for a specific individual, the system shows a photograph from another individual of the same species or subspecies as a reference.

**Image gallery.** A full-screen image gallery allows detailed examination of specimen photographs with zoom, pan, and keyboard navigation.

**Data table.** A sortable, paginated table shows all records that match the current filters, with photo thumbnails, adjustable column visibility, and indicators that distinguish individual photographs from species-level reference images.

**Map image export.** The application can export the current map view as a high-resolution image (PNG or JPG, up to 300 DPI) suitable for publications. The export panel allows customizing legend position, aspect ratio, scale bar, and point coloring by taxonomic level.

**R script export.** For researchers who prefer to work in R, the application can generate a complete R/ggplot2 package as a ZIP file. This package includes the filtered data as GeoJSON, the map view settings, legend configuration, a basemap image, and a ready-to-run R script that recreates the map as a vector graphic (PDF or SVG) or high-resolution raster (PNG), preserving most styling from the web application.

**Data export and citation.** The export panel also provides CSV and GeoJSON downloads of the filtered dataset, and generates a formatted scientific citation that includes the Git commit hash (a unique code identifying the exact version of the data and software used), enabling precise reproducibility. A BibTeX-formatted citation is also available for use in LaTeX documents.

### **2.4.5 Deployment**

The application is deployed through GitHub Actions. When code changes are pushed to the repository, an automated workflow builds the Vue.js application and publishes the compiled files to GitHub Pages. A separate workflow can be triggered manually to run the Python data processing pipeline and refresh the occurrence data from live sources. Since all of this runs on GitHub's servers, no physical computer or paid hosting is needed.

The application is accessible at [https://rapidspeciation.github.io/ithomiini\_maps/](https://rapidspeciation.github.io/ithomiini_maps/).

# **3\. Results**

## **3.1 Data Summary**

The Ithomiini Maps platform integrates 104,382 occurrence records from five data sources (Table 1). The largest contributors are the ~~Dore et al. (2025)~~Doré et al. (2023) published dataset (28,927 records), GBIF records from non-UNAM institutions (27,819 records), and the UNAM museum collections (21,586 records). iNaturalist research-grade observations contribute 19,328 records, and the Sanger Institute collection adds 6,722 specimens with sequencing status data. Across all sources, the merged dataset includes 751 unique species, 1,365 subspecies, and 178 genera, spanning 33 countries.

**Table 1\.** Data sources integrated in Ithomiini Maps. GBIF data (DOI: [https://doi.org/10.15468/dl.pbs3eu](https://doi.org/10.15468/dl.pbs3eu)) were pre-filtered for valid coordinates, no geospatial issues, confirmed presence, and excluding fossils and living specimens.

| Data Source | Records | Species | Subspecies | Genera | Countries |
| :---- | ----: | ----: | ----: | ----: | ----: |
| ~~Dore et al. (2025)~~Doré et al. (2023) | 28,927 | 374 | 999 | 48 | 23 |
| Sanger Institute | 6,722 | 459 | 579 | 169 | 6 |
| iNaturalist | 19,328 | 253 | 175 | 41 | 25 |
| GBIF (UNAM) | 21,586 | 34 | 25 | 19 | 1 |
| GBIF (Other Institutions) | 27,819 | 415 | 461 | 43 | 32 |
| **Total (merged)** | **104,382** | **751** | **1,365** | **178** | **33** |

 

The five most represented countries are Mexico (29,052 records), Ecuador (18,280), Brazil (15,422), Colombia (9,587), and Peru (8,936), followed by Costa Rica (8,291), Panama (3,456), Bolivia (2,515), and Venezuela (1,894). The high number of Mexican records is driven primarily by the UNAM museum collections.

## **3.2 Sequencing Status**

Of the 6,722 Sanger Institute specimens, 4,183 (62.2%) have been sequenced, 1,119 (16.6%) have tissue available for future sequencing, and 1,420 (21.1%) are preserved specimens waiting for tissue extraction. This breakdown is visible on the map through dedicated toggle filters, allowing researchers to identify geographic and taxonomic gaps in the sequencing effort.

## **3.3 Taxonomic Curation**

The automated curation pipeline resolved the taxonomy for 104,382 records (Table 2). The majority of records (94.5%) were resolved through the GBIF backbone taxonomy cache, 3.6% were verified against the reference taxonomy (Butterflies of America, nymphalidae.net), 0.8% required live GBIF API queries, 0.3% were synonyms resolved to their accepted names, and 0.2% were corrected through typographical error detection. Of all curated records, 71.1% were verified as exact matches, 11.9% were classified as nominotypical subspecies, and 2.1% had synonyms resolved. Only 0.6% of records could only be matched to a higher taxonomic rank, and 0.0% (2 records) remained unresolved.

**Table 2\.** Taxonomic curation results. Curation basis indicates the method used to resolve each record's taxonomy.

| Curation Basis | Records | Percentage |
| :---- | ----: | ----: |
| GBIF backbone cache | 98,589 | 94.5% |
| Reference taxonomy (BoA / nymphalidae.net) | 3,739 | 3.6% |
| GBIF API (live query) | 853 | 0.8% |
| GBIF synonym resolution | 263 | 0.3% |
| Typographical error detection | 202 | 0.2% |
| Literature corrections | 4 | \<0.1% |

 

## **3.4 Mimicry Ring Coverage**

The mimicry ring lookup from ~~Dore et al. (2025)~~Doré et al. (2023) contains 44 distinct mimicry ring categories (Table S1). The most record-rich rings are Agnosia (14,930 records across 83 species), Hermias (12,393 records, 50 species), Lerida (12,262 records, 65 species), and Mamercus (11,452 records, 58 species). These mimicry ring values were propagated to Sanger Institute and GBIF records based on species and subspecies matching, allowing researchers to filter and visualize mimicry ring distributions across data sources.

## **3.5 Performance and Data Efficiency**

The serverless architecture results in fast load times and minimal data transfer. The compiled web application (JavaScript and CSS) totals approximately 475 KB when compressed (gzipped). Data files are loaded on demand: by default, only the Sanger Institute dataset and image supplement are loaded on first visit (\~4.0 MB), with additional data sources loaded when the user activates them. The full dataset across all five sources totals approximately 61 MB. MapLibre GL JS uses WebGL rendering to maintain smooth interactions even when all sources are loaded simultaneously. Taxonomic filter updates are computed in the user's browser in under 100 milliseconds.

GitHub Pages provides high availability and serves files through a global content delivery network, with zero hosting costs and no system administration needed. The only expense is cloud storage for specimen photographs.

# **4\. Discussion**

## **4.1 Comparison with Existing Tools**

The *Heliconius* interactive maps (Rosser & Mallet, 2024\) showed the value of open-source, GitHub-hosted mapping tools for Lepidoptera research. Their platform was built using R and the Leaflet library to generate a static website—an approach that works well for displaying curated datasets but has limitations in interactivity: filter changes can be slow with large datasets, the user interface is limited by R-Shiny or static HTML capabilities, and customization options are limited compared to modern JavaScript frameworks. Our toolkit builds on this approach in several ways: (i) we address the earlier specimen digitization workflow (photography, AI-assisted cataloguing, image hosting), which is absent from the *Heliconius* platform; (ii) we consolidate multiple data sources with automated taxonomic curation, whereas the *Heliconius* maps use a single curated dataset; (iii) we add sequencing status filters designed for ongoing genomic projects, enabling strategic planning of which taxa to sequence next; and (iv) we provide high-resolution map image export, R script export for further customization, and automatic citation generation for publications. The use of Vue.js and MapLibre GL JS enables live client-side filtering, smooth WebGL map rendering, and a fully customizable interface that can be extended as research needs evolve.

General-purpose platforms like GBIF and iNaturalist provide occurrence visualization but lack project-specific metadata such as specimen-level filtering by sequencing status, or mimicry rings obtained from Dore et al.; additionally, GBIF by default includes records with coordinate issues, absent records, and other data quality problems that require manual filtering. Specialized tools like Map of Life (Jetz et al., 2012\) offer range maps but not the specimen-level detail needed for genomic research planning.

Our toolkit fills a specific gap: a researcher-oriented platform that combines project-specific data (institutional collections, sequencing status) with public biodiversity data (GBIF) in an interface designed for evolutionary biology workflows. The modular architecture and open-source licensing mean that other research groups can adapt these tools for their own taxa, as encouraged by Rosser & Mallet (2024).

## **4.2 AI-Assisted Specimen Photograph Renaming**

The AI Photo Processor applies Google's Gemini AI to a practical bottleneck in biodiversity research: reading handwritten specimen labels from photographs. Traditional text recognition systems struggle with handwritten text on complex photographic backgrounds containing specimen wings, rulers, and color palettes. By using a modern AI model with image understanding abilities, the system can interpret handwritten identifiers within the visual context of specimen photographs without needing to isolate the text or remove the background first.

The grid-based approach (combining multiple images into a single combined image before sending to the AI) is a practical solution to make the most of each API request. Processing 45 images per request under the free tier means that a single day's quota can handle 900 images at no cost. Because the application allows users to customize the AI prompt, this approach can be used beyond entomological collections: any specimen-based research that uses handwritten labels—herbarium sheets, geological samples, archaeological artifacts—could adapt the tool by changing the text prompt to ask for whatever information is visible in the images.

## **4.3 Sustainability and Reproducibility**

The serverless model avoids the most common problems of research software: expired cloud credits, unmaintained servers, and outdated server-side frameworks. As long as GitHub Pages remains available (and given its widespread use in both industry and academia, this is likely for the long term), the applications will stay online.

Reproducibility is addressed through several features. The Git commit hash is included in auto-generated citations, allowing exact identification of the data version used in any analysis. Filter states saved in URLs serve as shareable records of search settings. Exported datasets include all metadata needed to reproduce the filtering criteria. The R export package allows researchers to reproduce and customize maps entirely within their local R environment.

## **4.4 Limitations and Future Directions**

The current implementation has several limitations that point to future development:

**Taxonomic curation scope.** While the automated pipeline resolves many naming inconsistencies by checking names against the GBIF backbone taxonomy and a reference taxonomy compiled from Butterflies of America and nymphalidae.net, it may still miss recently described taxa or contested synonymies. The data table shows both the original and corrected taxonomic names, allowing researchers to spot errors, and a human-readable corrections file allows manual fixes on a case-by-case basis. As taxonomic databases continue to be updated, the pipeline's accuracy will improve over time.

**Species distribution modeling.** Predictive habitat suitability models (e.g., MaxEnt) are not yet integrated. A future direction would be to compute these models through GitHub Actions or a free-tier cloud computing service and display the predicted distributions as map overlays, allowing users to compare observed occurrences with modeled suitable habitat.

**Host plant distributions.** An important ecological layer would be to include the geographic distribution of known Ithomiini host plant species (primarily Solanaceae), enabling researchers to explore the relationship between butterfly and host plant ranges directly on the map.

**Broader taxonomic scope.** The current platform focuses on Ithomiini, but the architecture could be extended to include all Lepidoptera occurrences, providing a broader context for understanding butterfly distributions.

**AI accuracy.** The AI Photo Processor's reading accuracy depends on handwriting legibility and image quality. As AI models continue to improve, the accuracy of handwritten text recognition will increase over time, reducing the need for manual corrections.

# **5\. Conclusions**

We have presented an integrated open-source toolkit that covers the complete specimen-to-map pipeline for Ithomiini butterfly research. The AI Photo Processor automates the time-consuming task of reading handwritten specimen identifiers using AI, with a customizable prompt system that makes it adaptable to other research contexts. The Wings Gallery provides a centralized, filterable image browser with zero server costs and one-click updates. Ithomiini Maps integrates diverse occurrence data sources into an interactive mapping platform with taxonomic filters, mimicry ring selectors, sequencing status indicators, and both image and R script export for publications. Together, these tools show that modern web technologies and AI services can greatly improve the efficiency and accessibility of biodiversity research tools, while maintaining long-term sustainability through a fully serverless approach.

All source code is freely available under the MIT License at:

• AI Photo Processor: [https://github.com/Fr4nzz/rename\_photos\_AI](https://github.com/Fr4nzz/rename_photos_AI) 

• Wings Gallery: [https://github.com/rapidspeciation/Shiny\_Ikiam\_Wings\_Gallery](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery) 

• Ithomiini Maps: [https://github.com/rapidspeciation/ithomiini\_maps](https://github.com/rapidspeciation/ithomiini_maps) 

 

# **6\. Data Availability Statement**

The occurrence data shown in Ithomiini Maps comes from:

• ~~Dore et al. (2025)~~Doré et al. (2023) — Published dataset available at \[repository DOI to be added\]

• GBIF occurrence data — Downloaded via the GBIF API (DOI: 10.15468/dl.pbs3eu), filtered for tribe Ithomiini (45 genera), with quality filters applied (coordinates present, no geospatial issues, confirmed presence, excluding fossils and living specimens). Records split into: iNaturalist research-grade observations, UNAM museum collections, and other institutional datasets.

• Sanger Institute collection data — Available upon request from the corresponding research group

The processed data files and all source code are available in the GitHub repositories listed above. Version-specific data can be retrieved using the Git commit hashes included in the application's citation system.

# **7\. Acknowledgments**

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Ithomiini Maps. We acknowledge the Global Biodiversity Information Facility (GBIF) and its data publishers for providing open occurrence data. We acknowledge the use of AI coding assistants during software development, including OpenAI ChatGPT Codex, Google Gemini 3 Pro, and Anthropic Claude Code. \[Additional acknowledgments to be added.\]

# **References**

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. Molecular Ecology, 28(10), 2423–2438.

Dore, M. ~~et al. (2025). \[Full citation for the published Ithomiini occurrence dataset. To be completed.~~, Willmott, K., Lavergne, S., Chazot, N., Freitas, A.V.L., Fontaine, C. & Elias, M. (2023). Mutualistic interactions shape global spatial congruence and climatic niche evolution in Neotropical mimetic butterflies. Ecology Letters, 26(6), 843–857. [https://doi.org/10.1111/ele.14198~~\]~~](https://doi.org/10.1111/ele.14198)

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. PLoS Biology, 6(12), e300.

Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating biodiversity distribution knowledge: toward a global map of life. Trends in Ecology & Evolution, 27(3), 151–159.

Jiggins, C.D. (2017). The Ecology and Evolution of Heliconius Butterflies. Oxford University Press.

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. Tropical Lepidoptera Research, 34(1), 26–30.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). Illustrated Lists of American Butterflies. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. Cladistics, 22(4), 297–368.

