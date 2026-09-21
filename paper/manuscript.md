**From butterfly photos to interactive maps: Open-source tools for AI-assisted photo processing, image identification, and distribution mapping**

**Franz Chandi**1, **Patricio A. Salazar Carrión**2, **Joana I. Meier**2,3

1 Universidad San Francisco de Quito, Quito, Ecuador

2 Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom

3 Department of Zoology, University of Cambridge, Cambridge, United Kingdom

# **Abstract**

Large specimen collections are central to biodiversity research, but the steps connecting field specimens to usable research datasets often remain fragmented. Specimen photographs must be linked to identifiers, images must be shared with collaborators, taxonomic names must be reconciled across sources, and occurrence records must be interpreted alongside project-specific metadata such as sequencing status, mimicry ring classification, genomic resources, and host-plant records. We present an open-source specimen workflow developed for butterfly wing photos and adaptable to other photo-based specimen datasets. The AI Photo Processor uses Google's Gemini API to read handwritten specimen identifiers from photographs and supports reviewed batch file renaming. The Wings Gallery provides a filterable browser for high-resolution wing photographs stored on Google Drive and includes an AI Identifier that returns candidate taxonomic identifications from uploaded wing photographs for expert review. Wings Atlas integrates published records, institutional collection records, GBIF-derived occurrences, genomic metadata, relative habitat-suitability layers, and a host-plant compilation with plant occurrence layers into a single browser-based interface. The current Wings Atlas dataset spans 104,297 occurrence records from five sources across 786 species. We describe the photography-to-gallery protocol, database update workflow, AI-assisted identification pipeline, taxonomic curation, occurrence filtering, host-plant compilation, plant-occurrence layers, and species distribution model display logic, then illustrate how the toolset supports studies of mimicry, biogeography, sampling gaps, host-plant context, and genomic resource coverage. The workflow reduces manual data handling while preserving source identity, version control, and human validation.

**Keywords: biodiversity informatics, Nymphalidae, interactive maps, specimen digitization, Lepidoptera, open source, mimicry rings, GBIF, distribution mapping, species distribution modelling, AI-assisted identification, image classification**

# **1\. Introduction**

Field collections of thousands of specimens are valuable resources for systematics, ecology, evolution, and conservation, but managing the data they generate remains a practical challenge. A specimen may be photographed, linked to its specimen ID, shared online with collaborators, connected to taxonomic and sequencing metadata, and mapped alongside records from external databases. These steps often rely on separate tools and manual checks. As collections grow, the disconnected workflow slows collaborative research and increases the risk that images, IDs, taxonomic names, and localities become misaligned.

Ithomiini butterflies (Nymphalidae: Danainae) are a useful study system because they combine large specimen collections with questions that depend on geography, phenotype, and genomic sampling. The tribe contains more than 390 described species distributed across Central and South America (Willmott & Freitas, 2006; Chazot et al., 2019). Ithomiini are also a model system for studying speciation, adaptation, and ecological interactions because their wing colour patterns are shaped by Müllerian mimicry complexes involving many co-occurring species (Elias et al., 2008; Jiggins, 2017; McClure et al., 2019; Doré et al., 2023), and recent genomic studies are resolving the chromosomal and genetic basis of their diversification and mimicry (Gauthier et al., 2023; van der Heijden et al., 2025; Ben Chehida et al., 2026). The publication of nearly 29,000 georeferenced occurrence records with mimicry ring classifications (Doré et al., 2023), together with ongoing collections across South and Central America, creates an opportunity to study Ithomiini biogeography at a broad scale.

Using these data effectively requires more than a general map. Researchers need to compare published records, citizen-science observations, museum records, and institutional collection data while keeping data sources clear. They also need to see which species and regions have been sequenced, where tissue samples are available, and how these genomic resources overlap with known distributions. General-purpose platforms such as GBIF and iNaturalist are essential data sources, but they do not include project-specific fields such as mimicry ring assignment, sequencing status, specimen photograph links, or manually curated taxonomic decisions. Desktop geographic information system (GIS) software can combine these layers, but it requires repeated manual processing and is difficult to share as an interactive research tool.

Recent taxon-focused web maps show that curated distribution data can be made accessible to specialists without requiring each user to download datasets, inspect records manually, or rebuild maps for every question. Rosser & Mallet (2024), for example, developed open-source maps for *Heliconius* butterflies that connect geographic records with phenotype information and provide downloadable data. Our goal was to extend this approach upstream and downstream for butterfly collections: upstream to include specimen photography, identifier reading, image organisation, AI-assisted candidate identification, and taxonomic review; and downstream to include sequencing-status fields, genomic metadata, relative habitat-suitability layers, and host-plant context in the same research interface. The tools are currently targeted towards collections and sequencing work involving the Wellcome Sanger Institute, UK, and Ikiam University, Ecuador, but the workflow can be adapted for other photo-based specimen datasets when comparable taxonomic and occurrence data are available.

Here we present a toolkit of three connected open-source applications that together support a workflow from specimen photographs to interactive maps for Ithomiini butterflies:

1\. **AI Photo Processor:** An application for batch reading of handwritten specimen identifiers from wing photographs using Google's Gemini AI, enabling reviewed file renaming at scale. While built for entomological collections, researchers can customise the AI prompt to extract other types of information from images, making it adaptable to different research contexts.

2\. **Wings Gallery:** A serverless web gallery for browsing, filtering, and sharing high-resolution wing photographs stored on Google Drive, with one-click database updates after new images are indexed in Google Sheets and an AI Identifier for candidate identification from uploaded wing photographs.

3\. **Wings Atlas:** An interactive mapping platform that aggregates occurrence records from published literature, institutional collection and sequencing databases, and GBIF-derived sources into a single interface with taxonomic, mimicry-ring, sequencing-status, genomic, species distribution model, and host-plant layers, along with map and data export features.

The web components use Vue.js, and Python is used for data processing and local image-processing workflows where needed. The map and gallery are hosted as static sites on GitHub Pages and run in the browser without a dedicated application server. Uploaded-image classification for the AI Identifier is served through a Hugging Face Space/API. Website hosting is free through GitHub, with cloud storage needed for specimen photographs on Google Drive. Data processing pipelines run through GitHub Actions, so team members can update the databases with a single click. The photography-to-gallery workflow is summarised in Methods and provided as Supplementary Protocol S1, including camera setup photographs, workflow screenshots, AI Photo Processor review steps, Google Drive and Apps Script indexing, and database update instructions.

# **2\. Methods and Implementation**

## **2.1 System Architecture Overview**

The toolkit separates data processing from data display (Figure 1). Processing scripts prepare static data files, and the map and gallery web applications serve those files through GitHub Pages. This design avoids a dedicated web server for routine map and gallery use. Uploaded-image classification in the Wings Gallery AI Identifier is handled by a separate Hugging Face Space/API, because model inference requires a backend service. Database update workflows can be triggered through password-protected update controls.

[Insert updated Figure 1 overview here.]

**Figure 1.** Overview of the toolkit. The specimen-photo workflow feeds the Wings Gallery, where users can browse reviewed images or submit uploaded wing photographs to the AI Identifier. The occurrence-data workflow feeds Wings Atlas through static JSON and GeoTIFF files. The gallery and atlas front ends are served through GitHub Pages. AI Identifier inference is served by a Hugging Face Space/API.

The web interfaces use Vue.js 3 (You, 2014), and Wings Atlas uses MapLibre GL JS for map rendering (MapLibre Contributors, 2021). Data processing is written primarily in Python (Van Rossum & Drake, 2009\) with Pandas (McKinney, 2010). GitHub Pages hosts the built web applications, and GitHub Actions runs build, deployment, and database update workflows (GitHub, 2008, 2019). The AI Photo Processor uses the Gemini API for image interpretation and supports common image formats through the web app, with an optional local backend for RAW image rotations.

## **2.2 AI Photo Processor**

Large-scale specimen photography produces many camera-assigned filenames that must be linked to specimen IDs before images can be used reliably. For the Ithomiini collections, wings are usually photographed on dorsal and ventral sides with the specimen identifier visible in the image. Reading these IDs manually and renaming each file is slow, especially when hundreds of individuals are processed in a batch.

The AI Photo Processor (https://github.com/Fr4nzz/rename\_photos\_AI) uses Google's Gemini AI, a generative model that can interpret images and read text within them. The application is available as open-source code and as a web app for reviewing AI-read labels before renaming files.

The workflow keeps human validation in the file-renaming process. The application rotates photographs to a consistent orientation, crops the label region, arranges cropped labels into composite grids, and sends each grid to the Gemini API with an editable prompt. With a Google AI Studio API key, grid size, model choice, and the number of parallel requests are configurable; the default should favour a small enough grid for reliable handwriting recognition. The review interface displays each photograph beside the AI-interpreted ID and flags likely problems, including missing dorsal/ventral pairs, duplicate IDs, and photographs without AI-read IDs. Current AI models can recognise when the main CAMID has been crossed out and return the corrected CAMID, not the crossed-out value. Errors still occur, so human validation remains necessary before final renaming. Accepted IDs are then used to rename files with predefined side labels, which default to `d` and `v` for dorsal and ventral images. Rename logs make the operation reversible. The prompt is editable, so the tool can be adapted when another project needs to extract different information from photographs.

## **2.3 Wings Gallery**

Once specimen photographs are renamed and organised, researchers need a way to browse, filter, inspect, and share images without downloading entire folder structures. The Wings Gallery provides this through a filterable browser for specimen photographs stored in shared Google Drive folders. A Google Apps Script indexes the Drive folders into a Google Sheets spreadsheet, recording filename, URL, capture date, size, and folder path. A Python script reads this spreadsheet, prepares the image URLs, and writes the data files used by the website.

The gallery includes views for the main collection, insectary specimens, CRISPR specimens, ID search, AI-assisted identification, and database updating. Users can filter by taxonomic level, sex, insectary metadata, mutant phenotype, or specimen identifier, here called CAMID. The Update DB tab triggers the database update workflow so that new images can be indexed and deployed without editing the website code.

The gallery also supports image inspection during taxonomic review. Researchers can zoom all displayed images at once to check wing-pattern variation across many individuals, or zoom individual images when inspecting a single specimen. The grid adjusts as images are enlarged or reduced so that the screen remains usable during review.

**AI Identifier.** The Wings Gallery includes an AI Identifier that returns candidate taxonomic identifications from an uploaded butterfly image. A user uploads a photograph through the gallery interface. The backend first applies a YOLO26s-seg wing cropper, trained from SAM3-style wing masks, to detect visible wings and crop the image around them before classification. This step reduces the influence of labels, rulers, colour charts, and background. The cropped image is embedded with a frozen BioCLIP 2.5-H vision backbone (`imageomics/bioclip-2.5-vith14`). A hierarchical cosine classification head then predicts a finest-level taxon and sums probabilities upward to coarser ranks, returning candidate identifications at available ranks including subspecies, species, genus, tribe, subfamily, and family. The interface reports top predictions as aids for identification, specimen triage, and cross-checking gallery records. These predictions are not treated as research-grade identifications without expert validation.

## 2.4 Photography-to-gallery workflow

The three applications are connected by a reproducible photography-to-gallery workflow. For the Ithomiini workflow, wings are photographed with a stable camera setup using a Canon EOS 550D and a Canon EF-S 18-55 mm f/4-5.6 IS STM lens. The lens is positioned approximately 28 cm above the table, and the zoom position is taped to reduce accidental changes between imaging sessions. One example image from this setup was taken at 33 mm focal length, 1/100 s exposure, f/8, ISO 100, manual exposure mode, and flash off. These values describe the setup used here and should be adjusted for other cameras, lenses, lighting conditions, or specimen sizes.

Each photograph includes the dorsal or ventral wing surface, a colour reference, and the envelope or label containing the specimen identifier, here called the CAMID. Photos are organized into dated batch folders, processed with the AI Photo Processor, reviewed by a researcher, and renamed with the CAMID and side suffix. The review step is essential because AI-read identifiers can be wrong, ambiguous, or affected by crossed-out labels.

Renamed files are uploaded to shared Google Drive folders, indexed through Google Apps Script and Google Sheets, processed with Python scripts, and served through the Wings Gallery. The full protocol, including camera setup photographs, workflow screenshots, AI Photo Processor review steps, Google Drive indexing, and database update instructions, is provided as Supplementary Protocol S1 so that other groups can adapt the procedure to their own collections.

## 2.5 Wings Atlas

Mapping butterfly distributions requires combining occurrence records from sources that use different taxonomic names, data formats, geographic precision, and metadata standards. Researchers also need project-specific information, such as sequencing status, tissue availability, mimicry ring classification, wing photographs, and genomic metadata, that general-purpose biodiversity platforms do not usually provide. Wings Atlas addresses these challenges by keeping data sources distinct in the interface while standardizing the fields needed for filtering, display, and export. The platform is available at https://rapidspeciation.github.io/ithomiini\_maps/.

### Data sources and processing pipeline

The platform consolidates five occurrence sources into a single interface.

**Doré et al. (2023) published records.** This Excel dataset contains 28,927 georeferenced occurrence records with taxonomic classification, mimicry ring assignments for males and females, and observation metadata. It provides the lookup table used to assign mimicry ring values to records from other sources when taxonomic names match.

**Sanger Institute collection data.** These records are maintained in a Google Sheets database by the sequencing team and can be updated through a password-protected update button. Each record includes specimen identifier (CAMID), taxonomic classification, collection locality, coordinates, sequencing status, and links to wing photographs. Sequencing status is assigned from specimen metadata in four categories: records with a Tree of Life ID (ToLID) are classified as registered for sequencing; records with a tube rack entry but no ToLID are classified as tissue at Sanger; records with tissue but no rack entry are classified as tissue available; and the remaining records are classified as preserved specimens. Because this dataset includes ongoing project material, it gives collaborators access to information that may not yet be available through public aggregators.

**GBIF occurrence data.** Occurrence records are downloaded through an automated workflow using the Global Biodiversity Information Facility (GBIF) API. Each GBIF download receives a DOI, which should be cited for the version used in any analysis; the current draft cites [https://doi.org/10.15468/dl.bjrqhj](https://doi.org/10.15468/dl.bjrqhj). The downloaded records are split into three sub-sources: iNaturalist research-grade observations, GBIF records from the Universidad Nacional Autónoma de México (UNAM), and GBIF records from other institutions. This split lets users compare citizen-science observations, a major museum dataset, and other institutional records without visually merging all GBIF-derived points.

**Genomic metadata from GoaT.** The platform retrieves species-level genomic information from Genomes on a Tree (GoaT; Challis et al., 2023), including chromosome number, genome size, and genome assembly availability. A Python script queries the GoaT API for Lepidoptera species and caches the results locally. In the species-level table, chromosome number is shown together with the genus-level median and range, helping users identify values that may be unusual or need review. The table also links to the corresponding GoaT species page.

### Data merging and taxonomic curation

The processing pipeline standardizes field names, country names, and taxonomic formatting across sources. A mimicry ring lookup table from Doré et al. (2023) links species-subspecies pairs to male and female mimicry ring categories. The lookup is applied first by exact species and subspecies match, then by species-only match when subspecies information is missing, so that records identified only to species can still be assigned a mimicry ring when appropriate.

Taxonomic curation resolves synonyms, misspellings, and outdated names. The pipeline first applies a manually maintained corrections file, then checks names against the GBIF backbone taxonomy. Names unresolved by GBIF are checked against a reference taxonomy compiled from Butterflies of America (Warren et al., 2023\) and nymphalidae.net. Subspecies names are handled with a similar workflow, including edit-distance checks for likely typographical errors. Original names are preserved next to curated names in the data table, and each record includes a field describing how the name was resolved.

**Occurrence filtering**

Occurrence records are filtered or flagged according to the evidence represented by each source. GBIF-derived records are screened for four coordinate-quality problems before use in the web-map dataset and species distribution models: reported coordinate uncertainty above 100 km, the GBIF placeholder locality string "no specific locality", coordinates outside the Neotropical study extent (120°W to 30°W, 40°S to 25°N), and coordinates falling in the ocean. Ocean checks use the Global Self-consistent, Hierarchical, High-resolution Shoreline database (GSHHS; Wessel & Smith, 1996\) with a 5 km tolerance so that minor coastline or GPS rounding errors near bays and islands are not over-filtered.

Doré et al. (2023) records are grid-count data, so some offshore cell centroids can be artefacts of the grid. These records are retained for occurrence visualisation and are not used as inputs to the species distribution models. Sanger Institute records are not removed by the spatial checks; instead, the web interface flags any record outside the study area or in the ocean so the team can inspect it and correct coordinate-entry errors in the source database when needed.

**Host-plant records**

Larval host plants are an important ecological dimension for these butterflies, but host-plant records are scattered across the literature and hard to compare with distribution data. Wings Atlas includes a curated host-plant compilation that links each butterfly taxon to its reported larval host plants and lets users compare butterfly records with GBIF occurrences of those plants. Each record stores the reported and accepted host name, the host family, the source citation, the host identification level (species, genus, or family), and notes on how well the association is supported. Species-level hosts form the default map layer; genus-level records are kept as broader ecological context and can still be matched to GBIF plant occurrences; family-level records remain in the table but are too coarse to map. The interface keeps the precision of host identification separate from the strength of the association, which users filter as Observed, Reported, or Needs check; a coarser Confirmed, Provisional, or Tentative grouping is kept for summary reporting.

**Species distribution modelling**

Beyond mapping known records, Wings Atlas includes species distribution models that estimate relative habitat suitability from environmental conditions at known occurrence locations. The models are intended as exploratory layers for comparing observed records with predicted suitable areas. They should not be interpreted as true probabilities of occurrence.

The modelling pipeline uses occurrence records from GBIF-derived sources after source-specific spatial filtering and 5 km spatial thinning. Environmental predictors include CHELSA bioclimatic variables, elevation, and cloud cover. Host-plant information is not yet included in the current SDM predictor stack. The plant layers are intended for ecological context and hypothesis generation, not as predictors in the cross-species modelling workflow, because host records and GBIF plant occurrence availability are uneven across taxa.

Because the data are presence-only, models compare environments at presence locations with environments available in the area the species could plausibly reach, known as the accessible area (Barve et al., 2011). The pipeline builds accessible areas from buffered convex hulls around records. When records form spatially disjunct clusters, Density-Based Spatial Clustering of Applications with Noise (DBSCAN; Ester et al., 1996\) is used to identify clusters, build a hull for each, and combine them. Buffer size scales with cluster diameter, with a 50 km floor and 500 km ceiling. Background points are sampled within these accessible areas and weighted by the density of all Ithomiini records combined, following the target-group approach for reducing sampling-bias effects in presence-only models (Phillips et al., 2009). Background points are not absences; they describe environmental availability within the sampled and accessible region.

The modelling algorithm depends on sample size. Species with 20 to 49 thinned records are fitted with MaxEnt alone (Phillips & Dudík, 2008\) through the elapid Python package (Christensen, 2022). Species with 50 or more records use an ensemble of MaxEnt, random forest, and gradient-boosted trees, following evidence that different presence-only algorithms can perform differently across species and sample sizes (Wisz et al., 2008; Valavi et al., 2021). Models are evaluated with spatial-block cross-validation where sample size permits, and leave-one-out cross-validation is used for species with fewer than 30 records (Pearson et al., 2007; Roberts et al., 2017). Evaluation reports the area under the receiver operating characteristic curve (AUC) and the continuous Boyce index, which measures whether higher predicted suitability contains a higher density of observed presences (Hirzel et al., 2006).

MaxEnt settings are tuned uniformly following the ENMeval framework (Kass et al., 2021). For each species, the pipeline searches five regularization multipliers (1.0, 1.5, 2.0, 3.0, and 4.0) and three feature-class combinations: linear plus quadratic; linear plus quadratic plus hinge; and linear plus quadratic plus hinge plus product. The selected configuration maximizes the cross-validated Boyce index, with ties broken in favour of fewer feature classes. A regression guard keeps the tier-default configuration when no tuned configuration improves performance. Tuning and prediction run in a single pass, so the workflow does not use a separate post-hoc tuning step.

Predictions are generated on a common Neotropical grid at 0.1° resolution. Each species has a core layer inside its accessible area and an extension layer outside that area. The extension layer is useful for visual comparison across species but represents extrapolation beyond the accessible-area background used during fitting. The fitted models, prediction rasters, and metadata are committed to the repository so changes to map display, masking, or prediction extent can be evaluated without retraining.

**Web Interface**

The web interface uses Vue.js with MapLibre GL JS, a mapping library optimised for rendering tens of thousands of points smoothly. Researchers can choose from five base-map styles and can display individual points, clusters, or a heatmap of occurrence density. A time slider filters records by date range, allowing users to inspect how the records available in the database vary across collection periods. At low zoom levels, nearby points are grouped into clusters; clicking a cluster expands it to reveal individual records coloured according to the active legend.

The sidebar combines taxonomic filters from family to subspecies, sequencing-status toggles, mimicry-ring filters, date range, CAMID search, sex filter, species distribution model layers, host-plant layer controls, and source toggles for the five butterfly occurrence sources. The default colour palette is colourblind-safe, and users can customise individual colours through the legend editor. Active filters are encoded in the URL, so researchers can share exact search configurations with colleagues by copying a link.

Clicking a map point opens a popup showing specimen metadata, taxonomic classification, sequencing status, and a wing photograph when available. If no photograph exists for a specific individual, the system displays one from another individual of the same species or subspecies as a reference. A full-screen image gallery allows detailed examination with zoom, pan, and keyboard navigation. A sortable, paginated data table shows all records matching the current filters, with photo thumbnails, adjustable column visibility, and column-level filters. The table can switch between a specimen-level view showing individual butterfly records, a species-level view summarizing occurrence counts, genomic information from GoaT, and representative photographs, and a Host Plants view. The Host Plants tab includes a butterfly-level summary table and a record-level table with host taxon, host ID level, family, record-support category, source links, and caveats. The image gallery also includes a Host Plants mode that displays GBIF plant images for occurrence-backed host taxa as a field-oriented identification aid.

The application exports the current map view as a high-resolution image (PNG or JPG, up to 300 DPI) suitable for publications, with customisable legend position, aspect ratio, and scale bar. For researchers who prefer to work in R, it generates an R/ggplot2 ZIP package containing the filtered data as GeoJSON, map settings, legend configuration, a basemap image, and a ready-to-run R script. Point, range, and legend layers can be edited as vector elements in PDF or SVG outputs, while the basemap image remains raster. The export panel also provides CSV and GeoJSON downloads of the filtered dataset, along with a formatted scientific citation that includes the Git commit hash for precise reproducibility.

**Deployment**

The application deploys through GitHub Actions. Code changes trigger an automated build-and-publish workflow. A separate workflow can be triggered manually to update occurrence data, and team members can choose which sources to update (GBIF, Sanger Institute, or both). Since everything runs on GitHub's servers, no physical computer or paid hosting is needed. The application is accessible at [https://rapidspeciation.github.io/ithomiini\_maps/](https://rapidspeciation.github.io/ithomiini_maps/).

# **3\. Results**

## **3.1 Data Summary**

Using the app data snapshot generated on 9 May 2026, Wings Atlas integrates 104,297 occurrence records from five data sources (Table 1). The largest contributors are the Doré et al. (2023) published dataset (28,927 records), GBIF records from other institutions (26,956), and the UNAM museum collections (21,562 records). iNaturalist research-grade observations contribute 20,424 records, and the Sanger Institute collection adds 6,428 coordinate-bearing specimens with sequencing status data. The merged dataset spans 786 species, 1,383 subspecies labels, and 188 genera across 26 countries.

**Table 1\. Data sources integrated in Wings Atlas, calculated from the app data snapshot generated on 9 May 2026\. GBIF data (DOI: [https://doi.org/10.15468/dl.bjrqhj](https://doi.org/10.15468/dl.bjrqhj)) were pre-filtered for valid coordinates, no geospatial issues, confirmed presence, and excluding fossils and living specimens.**

| Data Source | Records | Species | Subspecies | Genera | Countries |
| :---- | :---: | :---: | :---: | :---: | :---: |
| Doré et al. (2023) | 28,927 | 374 | 999 | 48 | 23 |
| Sanger Institute | 6,428 | 505 | 612 | 181 | 8 |
| iNaturalist | 20,424 | 255 | 177 | 41 | 25 |
| GBIF (UNAM) | 21,562 | 34 | 25 | 19 | 1 |
| GBIF (Other Institutions) | 26,956 | 416 | 454 | 43 | 24 |
| **Total (merged)** | **104,297** | **786** | **1,383** | **188** | **26** |

The five most represented countries are Mexico (29,022 records), Ecuador (17,382), Brazil (15,732), Colombia (10,053), and Peru (8,873), followed by Costa Rica (8,403), Panama (3,503), Bolivia (2,407), and Venezuela (1,896). The high number of Mexican records is driven primarily by the UNAM museum collections.

## **3.2 AI Identifier Coverage and Sanger Evaluation**

The deployed AI Identifier reports a label space of 7,292 finest-level taxa, 4,946 species, and 883 genera, with wing segmentation enabled. In the Sanger out-of-fold evaluation used for the gallery prediction data, the top prediction matched the curated label at 84.0% for subspecies, 89.7% for species, 95.4% for genus, 96.8% for tribe, 98.9% for subfamily, and 99.4% for family. These values describe the deployed model state and this Sanger evaluation set; they should not be read as performance estimates for all taxa, regions, image types, or poorly represented groups in the broader label space.

## **3.3 Sequencing Status**

In the same 9 May 2026 data snapshot, the 6,428 coordinate-bearing Sanger Institute records include 2,074 specimens registered for sequencing with a ToLID assigned (32.3%), 2,659 with tissue racked at Sanger (41.4%), 1,225 with tissue available for future submission (19.1%), and 470 preserved specimens without collected tissue (7.3%). This breakdown is visible on the map through dedicated toggle filters, allowing researchers to identify geographic and taxonomic gaps in the genomic-sampling pipeline.

## **3.4 Taxonomic Curation**

In the 9 May 2026 data snapshot, the automated curation pipeline assigned curated taxonomy to most of the 104,297 records while retaining unresolved or ambiguous cases for review. Most records were resolved as verified or verified nominotypical names (86,889 records, 83.3%). Unresolved or ambiguous curation statuses accounted for 10,793 records (10.3%), mainly subspecies-level unresolved names (9,927 records, 9.5%). The correction summary in Table 2 records 2,398 affected records, including synonym resolution, literature-based corrections, typographical corrections, and correction of non-standard subspecies names.

**Table 2\.** Taxonomic curation results. Curation basis indicates the method used to resolve each record's taxonomy.

| Curation Basis | Species | Subspecies | Records Affected |
| :---- | :---: | :---: | :---: |
| Synonym resolution | 52 | 59 | 2,142 |
| Typographical error detection | 16 | 18 | 202 |
| Subspecies synonym resolution | 4 | 4 | 48 |
| Literature-based correction | 3 | 2 | 6 |
| **Total unique corrected** | **69** | **82** | **2,398** |

## **3.5 Mimicry Ring Coverage**

The mimicry ring lookup from Doré et al. (2023) contains 44 distinct mimicry ring categories (Table S1). The most record-rich rings are Mamercus (9,918 records across 62 species), Agnosia (9,331 records, 83 species), Lerida (7,645 records, 65 species), and Hermias (7,621 records, 51 species). These mimicry ring values are assigned to Sanger Institute and GBIF records first by exact species-subspecies matches. For records identified only to species level, a species-level mimicry ring is assigned only when the Doré et al. lookup shows that all known subspecies of that species share the same sex-specific mimicry ring; otherwise the record remains unassigned for mimicry filtering.

## 3.6 Host-Plant Records and Plant Occurrence Layers

The compilation contains 863 butterfly-host plant records for 112 butterfly taxa and 334 host-plant taxa, with most resolved to the host species (675 species-level, 151 genus-level, and 37 family-level records). The records fall in four plant families: Solanaceae (640), Passifloraceae (188), Apocynaceae (29), and Gesneriaceae (6). These proportions reflect how the compilation was assembled, which centred on the Ithomiini in the dataset, so they should not be read as unbiased host-use frequencies; reported host plants for other butterfly groups are probably under-represented.

Each association carries a record-support level (321 Observed, 477 Reported, and 65 Needs check) and a coarser confidence grouping (378 Confirmed, 421 Provisional, and 64 Tentative), reported separately because they summarise different things. Most associations rest on published or catalogue records, and only a small fraction still need source verification.

For 293 of the host taxa (276 to species and 17 to genus), the platform serves 465,757 unique GBIF plant occurrence records as optional map layers (download DOI 10.15468/dl.3464gs); family-level hosts are too broad to map. These layers show where reported host plants have been recorded, letting researchers ask whether a butterfly's range tracks host availability or whether apparent gaps reflect undersampled plant records. They do not show that a butterfly used a plant at a given locality, because the plant points are independent occurrence records.

The Host Plants tab provides a butterfly-level summary and a record-level table with sources and caveats, and the gallery can display GBIF plant images for occurrence-backed hosts as a field identification aid. As with these layers, these images document the plants, not confirmed butterfly host use at a locality.

## 3.7 Species Distribution Models

The current web application serves SDM rasters for 155 Ithomiini species. For each modelled species, the web distribution includes a full-projection suitability raster and matched accessible-area core and extrapolated-extension rasters. The served model set includes 44 high-confidence large-sample species, 38 medium-confidence species, and 73 low-confidence small-sample species. Across the 155 served models, mean AUC is 0.758 (median 0.761) and mean continuous Boyce index is 0.646 (median 0.705). These diagnostics are displayed with each model so users can judge whether a suitability layer is useful for interpretation or should be viewed with caution.

The SDM layers extend the platform beyond occurrence visualisation by letting users compare known records with areas predicted to have suitable environmental conditions. In the web map, users can display up to two suitability rasters at once, adjust opacity, inspect model diagnostics, and switch between the full Neotropical projection and the accessible-area-only view. The full projection helps compare broad patterns across species, while the accessible-area view shows the area used to define background environments during model fitting.

# 4\. Discussion

## **4.1 Comparison with Existing Tools**

Several tools exist for automated specimen label reading. The biodiversity-aq/rename-photos-ocr package uses PaddleOCR to extract printed text labels from specimen photographs, but does not handle handwritten text, which is common in field collections. Ahrens et al. (2025) demonstrated a smartphone-based workflow using built-in OCR features that avoids storing label images entirely. Our AI Photo Processor differs from these approaches by using generative AI (Gemini) instead of traditional OCR, which allows it to interpret handwritten text and read identifiers within their visual context. It also groups multiple labels per API request and includes a graphical review interface for validating readings before renaming. Because the prompt is customisable, the tool can be adapted to read other types of specimen information from photographs, such as locality data, collector names, or dates, without modifying the software itself.

For specimen image management, existing solutions range from institutional database systems like Earthcape to general-purpose cloud storage. The Wings Gallery takes a lighter approach: it uses Google Drive as the storage backend and a static website as the viewer, so research groups can set it up with minimal technical effort and low hosting cost.

The AI Identifier adds a different function to the gallery: rapid candidate identification from wing images. Its role is closer to triage and expert review support than to automated curation. This distinction is important because the model was evaluated on a defined Sanger out-of-fold set, while public uploads may differ in image quality, taxonomic scope, and background content.

The *Heliconius* interactive maps (Rosser & Mallet, 2024\) demonstrated the value of open-source, GitHub-hosted mapping tools for Lepidoptera research. Wings Atlas follows this taxon-focused logic but extends the workflow in several directions. It consolidates five occurrence sources totaling over 100,000 records, keeps source identity visible, adds automated taxonomic curation, links Sanger collection records to wing photographs and sequencing status, displays genomic metadata, serves relative habitat-suitability layers, and includes host-plant records with optional plant occurrence layers. The broader toolkit also covers the upstream steps of specimen photography, AI-assisted file renaming, and image-gallery updating, which are often practical bottlenecks before occurrence data can be mapped.

General-purpose platforms like GBIF and iNaturalist provide occurrence visualisation but lack project-specific metadata such as sequencing status or mimicry ring classifications. GBIF records also require filtering for coordinate uncertainty, geospatial issues, record basis, and occurrence status before they can be used in project-specific analyses. Specialized tools like Map of Life (Jetz et al., 2012\) offer range maps but not the specimen-level detail needed for genomic research planning. Our toolkit fills the gap between these general platforms and the project-specific needs of evolutionary biology research groups.

## **4.2 Research Applications**

The integrated platform supports biological questions that depend on connecting phenotype, geography, taxonomy, host-plant records, and genomic sampling. Filtering the map by mimicry ring, for example, lets researchers inspect the geographic extent of a ring and identify regions where ring membership changes. Toggling data sources shows whether patterns are supported by published records, citizen-science observations, museum records, or Sanger collection specimens.

The sequencing-status filters help identify species or regions that are underrepresented in the genomic-sampling pipeline. A researcher planning a collecting trip can filter for preserved specimens, available tissue, or material racked at Sanger, then compare those records with occurrence-rich areas that lack registered specimens. This can reduce redundant collecting and help prioritise under-sampled regions.

GoaT metadata add another planning dimension. Sorting by chromosome number can flag species with unusual karyotypes for review, and filtering for species without a reference genome can highlight candidates for future sequencing. Combining these filters with geography and taxonomy can answer questions such as which unregistered species in Ecuador have tissue available.

The AI Identifier supports the image side of the workflow by returning candidate identifications for uploaded wing photographs. It can help triage unknown specimens, suggest plausible names for expert review, and cross-check gallery records against the current model. Its predictions should be treated as hypotheses, not as replacements for taxonomic validation, especially for worn specimens, unusual image angles, taxa outside the evaluated Sanger set, or groups with limited training representation.

Host-plant records and plant occurrence layers add ecological context. Users can inspect reported larval host taxa for a focal butterfly and compare butterfly records with independent GBIF plant occurrences. These comparisons are useful for generating hypotheses about local host availability and planning field checks, but they do not demonstrate host use at the same locality. Similarly, date filters and source toggles help reveal sampling biases across periods and data sources; they should not be interpreted as abundance or range-shift analyses without modelling sampling effort and detection probability.

## **4.3 Sustainability and Reproducibility**

Server-based research software commonly breaks when cloud credits expire, servers go unmaintained, or frameworks become outdated. By using browser-based deployment for the map and gallery and serving files through GitHub Pages, this toolkit avoids several common server-maintenance failure modes. Under the current deployment model, the map and gallery avoid a dedicated web server and routine server maintenance. Long-term availability still depends on maintaining the repositories, external services, and database update credentials.

The Git commit hash included in auto-generated citations allows exact identification of the data version used in any analysis. While the live website always serves the latest version, the complete source code and data are versioned in Git, so a researcher could clone the repository and check out the exact commit cited in a previous study to reproduce the application state at that point in time. Filter states encoded in URLs serve as shareable records of search configurations. Exported datasets include all metadata needed to reproduce the filtering criteria. The R export package lets researchers reproduce and customise maps entirely within their local R environment.

Beyond reproducibility, the open-source codebase is designed to be replicable. Research groups working on other taxonomic groups or even non-biological datasets (e.g., geological or archaeological specimen collections) could adapt the data processing pipelines and web interface to their own data by replacing the taxonomic reference files and data sources. The modular separation between data processing and visualisation means that adapting the platform to a new taxon primarily requires configuring the data pipeline, without rewriting the web application.

## **4.4 Limitations and Future Directions**

While the automated taxonomic pipeline resolves many naming inconsistencies, it may still miss recently described taxa or contested synonyms. The data table shows both original and corrected names for researcher review, and a manually maintained corrections file allows case-by-case overrides. As taxonomic databases continue to be updated, the pipeline's accuracy will improve.

Host-plant records provide ecological context, but they require careful interpretation. The plant occurrence layers show where reported host taxa have been recorded in GBIF, not where a butterfly has been observed feeding, ovipositing, or developing on that plant. Low-support and Needs check records are useful for source audit and broad exploratory work, but they should not be treated as verified interactions without returning to the underlying sources. Host-plant records are also not used as SDM predictors because host records and plant occurrence availability are uneven across Ithomiini taxa.

The SDM layers have similar limits. They are relative habitat-suitability layers based on occurrence records and environmental predictors, not estimates of true occurrence probability. Sampling bias, uneven geographic coverage, taxonomic uncertainty, and small sample size can all affect model quality. Displaying model diagnostics with each layer helps users decide whether a model is useful for exploratory interpretation or should be treated cautiously.
AI Identifier predictions also require careful interpretation. Model performance depends on the taxonomic and geographic coverage of the training data, the quality and angle of the uploaded image, the reliability of source labels, and whether the taxon is represented in the model label space. The deployed model includes a broader Lepidoptera label space in addition to butterfly material, and some higher-rank mappings are more complete for butterflies than for moth-rich parts of the model. For research records, AI Identifier output should be used as a candidate identification that is checked against specimens, reference images, locality information, and expert taxonomic knowledge.


Additional contextual layers, such as historical land cover, forest change, water, and climate summaries, could help users interpret sampling gaps and generate hypotheses about environmental change. These additions would be most useful if the interface continues to distinguish observed butterfly records, relative habitat-suitability layers, plant occurrence context, and independent environmental layers.

# **5\. Conclusions**

We have presented an integrated open-source toolkit that covers the workflow from specimen photographs to interactive maps for butterfly research. The AI Photo Processor supports the time-consuming task of reading handwritten specimen identifiers with human review before file renaming. The Wings Gallery provides a central, filterable image browser and an AI Identifier that returns candidate taxonomic predictions from uploaded wing photographs. Wings Atlas integrates occurrence data sources into an interactive mapping platform with taxonomic filters, mimicry-ring selectors, sequencing-status indicators, genomic metadata from GoaT, relative habitat-suitability layers, host-plant records, plant occurrence layers, and map and data export tools. Together, these tools show how open-source web technologies, serverless deployment for static interfaces, reproducible data workflows, and reviewed AI-assisted image processing can reduce manual data handling while keeping source identity, version control, and expert validation visible.

# **6\. Data Availability Statement**

The public web applications and source code are available through the project repositories. The AI Photo Processor code is available at `https://github.com/Fr4nzz/rename_photos_AI`; the Wings Gallery is available at `https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery`; and Wings Atlas is available at `https://github.com/Fr4nzz/ithomiini_maps`. The public Wings Gallery AI Identifier is available at `https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/ai_identifier`, with model inference served through `https://fr4nzzch-butterfly-id.hf.space` and the model repository at `https://huggingface.co/fr4nzzch/butterfly-id-classifier`.

The Sanger Institute collection records shown in Wings Atlas are available upon reasonable request from the corresponding research group, subject to project permissions and specimen-data sensitivity. Host-plant compilation files and generated public host-plant support files are provided as supplementary data. GBIF download DOIs for butterfly and plant occurrence layers are reported with the relevant methods, tables, or supplementary files for the version used. Third-party image and occurrence sources used for training, evaluation, or context retain their original licences and permissions; the manuscript does not imply that all source images are redistributed by the gallery or model repository. Version-specific states of the applications can be retrieved using the Git commit hashes included in each application's citation system, provided the required public and project-restricted data sources remain available.

# **7\. Acknowledgments**

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Wings Atlas. We acknowledge the Global Biodiversity Information Facility (GBIF) and its data publishers for providing open occurrence data. We acknowledge the use of AI coding assistants during software development, including OpenAI GPT models, Google Gemini, and Anthropic Claude. \[Additional acknowledgments to be added.\]

# **References**

Ahrens, D., Haas, A., Pacheco, T.L. & Grobe, P. (2025). Extracting specimen label data rapidly with a smartphone — a great help for simple digitization in taxonomy and collection management. ZooKeys, 1233, 15–30. https://doi.org/10.3897/zookeys.1233.140726

Barve, N., Barve, V., Jiménez-Valverde, A., Lira-Noriega, A., Maher, S.P., Peterson, A.T., Soberón, J. & Villalobos, F. (2011). The crucial role of the accessible area in ecological niche modeling and species distribution modeling. Ecological Modelling, 222(11), 1810–1819. https://doi.org/10.1016/j.ecolmodel.2011.02.011

Christensen, A. (2022). elapid: Species distribution modeling tools for Python. Journal of Open Source Software, 7(80), 4930\. https://doi.org/10.21105/joss.04930

Ester, M., Kriegel, H.P., Sander, J. & Xu, X. (1996). A density-based algorithm for discovering clusters in large spatial databases with noise. Proceedings of the Second International Conference on Knowledge Discovery and Data Mining, 226–231.

Hirzel, A.H., Le Lay, G., Helfer, V., Randin, C. & Guisan, A. (2006). Evaluating the ability of habitat suitability models to predict species presences. Ecological Modelling, 199(2), 142–152. https://doi.org/10.1016/j.ecolmodel.2006.05.017

Kass, J.M., Muscarella, R., Galante, P.J., Bohl, C.L., Pinilla-Buitrago, G.E., Boria, R.A., Soley-Guardia, M. & Anderson, R.P. (2021). ENMeval 2.0: Redesigned for customisable and reproducible modeling of species' niches and distributions. Methods in Ecology and Evolution, 12(9), 1602–1608. https://doi.org/10.1111/2041-210X.13628

Pearson, R.G., Raxworthy, C.J., Nakamura, M. & Peterson, A.T. (2007). Predicting species distributions from small numbers of occurrence records: a test case using cryptic geckos in Madagascar. Journal of Biogeography, 34(1), 102–117. https://doi.org/10.1111/j.1365-2699.2006.01594.x

Phillips, S.J. & Dudík, M. (2008). Modeling of species distributions with Maxent: new extensions and a comprehensive evaluation. Ecography, 31(2), 161–175. https://doi.org/10.1111/j.0906-7590.2008.5203.x

Phillips, S.J., Dudík, M., Elith, J., Graham, C.H., Lehmann, A., Leathwick, J. & Ferrier, S. (2009). Sample selection bias and presence-only distribution models: implications for background and pseudo-absence data. Ecological Applications, 19(1), 181–197. https://doi.org/10.1890/07-2153.1

Roberts, D.R., Bahn, V., Ciuti, S., Boyce, M.S., Elith, J., Guillera-Arroita, G., Hauenstein, S., Lahoz-Monfort, J.J., Schröder, B., Thuiller, W., Warton, D.I., Wintle, B.A., Hartig, F. & Dormann, C.F. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. Ecography, 40(8), 913–929. https://doi.org/10.1111/ecog.02881

Valavi, R., Guillera-Arroita, G., Lahoz-Monfort, J.J. & Elith, J. (2021). Predictive performance of presence-only species distribution models: a benchmark study with reproducible code. Ecological Monographs, 92(1), e1486. https://doi.org/10.1002/ecm.1486

Wessel, P. & Smith, W.H.F. (1996). A global, self-consistent, hierarchical, high-resolution shoreline database. Journal of Geophysical Research: Solid Earth, 101(B4), 8741–8743. https://doi.org/10.1029/96JB00104

Wisz, M.S., Hijmans, R.J., Li, J., Peterson, A.T., Graham, C.H., Guisan, A. & NCEAS Predicting Species Distributions Working Group (2008). Effects of sample size on the performance of species distribution models. Diversity and Distributions, 14(5), 763–773. https://doi.org/10.1111/j.1472-4642.2008.00482.x

Challis, R., Kumar, S., Sotero-Caio, C., Brown, M. & Blaxter, M. (2023). Genomes on a Tree (GoaT): A versatile, scalable search engine for genomic and sequencing project metadata across the eukaryotic tree of life. Wellcome Open Research, 8, 24\. [https://doi.org/10.12688/wellcomeopenres.18658.1](https://doi.org/10.12688/wellcomeopenres.18658.1)

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. Molecular Ecology, 28(10), 2423–2438.

Dore, M., Willmott, K., Lavergne, S., Chazot, N., Freitas, A.V.L., Fontaine, C. & Elias, M. (2023). Mutualistic interactions shape global spatial congruence and climatic niche evolution in Neotropical mimetic butterflies. Ecology Letters, 26(6), 843–857. [https://doi.org/10.1111/ele.14198](https://doi.org/10.1111/ele.14198)

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. PLoS Biology, 6(12), e300.

GitHub (2008). GitHub Pages. GitHub, Inc. [https://pages.github.com](https://pages.github.com)

GitHub (2019). GitHub Actions. GitHub, Inc. [https://github.com/features/actions](https://github.com/features/actions)

Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating biodiversity distribution knowledge: toward a global map of life. Trends in Ecology & Evolution, 27(3), 151–159.

Jiggins, C.D. (2017). The Ecology and Evolution of Heliconius Butterflies. Oxford University Press.

MapLibre Contributors (2021). MapLibre GL JS. [https://maplibre.org](https://maplibre.org)

McKinney, W. (2010). Data Structures for Statistical Computing in Python. Proceedings of the 9th Python in Science Conference, 56–61. [https://doi.org/10.25080/Majora-92bf1922-00a](https://doi.org/10.25080/Majora-92bf1922-00a)

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. Tropical Lepidoptera Research, 34(1), 26–30.

Van Rossum, G. & Drake, F.L. (2009). Python 3 Reference Manual. CreateSpace.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). Illustrated Lists of American Butterflies. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. Cladistics, 22(4), 297–368.

You, E. (2014). Vue.js: The Progressive JavaScript Framework. [https://vuejs.org](https://vuejs.org)
