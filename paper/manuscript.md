**From butterfly photos to interactive maps: open-source tools for AI-assisted photo processing, image identification and distribution mapping**

**Franz Chandi**<sup>1</sup>, **Patricio A. Salazar Carrión**<sup>2</sup>, **Joana I. Meier**<sup>2,3</sup>

1 Universidad San Francisco de Quito, Quito, Ecuador

2 Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge, United Kingdom

3 Department of Zoology, University of Cambridge, Cambridge, United Kingdom

# Abstract

Large specimen collections are central to biodiversity research, but photographs, taxonomic identifications, occurrence records and genomic-sampling information are often maintained separately. We present three connected open-source tools developed for butterfly collections, with Ithomiini as the focal research system. The AI Photo Processor reads handwritten specimen identifiers from photographs and supports human review before batch file renaming. Wings Gallery links photographs to specimen records and provides AI-assisted candidate identifications for taxonomic review. Wings Atlas combines occurrence data with mimicry-ring assignments, collection and genomic metadata, relative habitat suitability and host-plant information. The frozen 9 May 2026 Atlas snapshot contains 104,297 occurrence records from five data sources. In the separately reported September 2026 evaluation of paired dorsal and ventral Sanger collection photographs, species Top-1 accuracy with geographic re-ranking was 91.33% among 3,355 eligible specimens. This collection result does not estimate accuracy for unrestricted uploaded photographs. By connecting specimen images with their taxonomic and geographic context, the toolkit supports comparisons of mimicry patterns, review of uncertain identifications and planning of genomic sampling. Source records, inferred classifications and environmental predictions remain distinct, allowing researchers to examine biological patterns without treating model outputs or contextual plant records as direct observations.

**Keywords:** biodiversity informatics, Ithomiini, specimen digitisation, biological collections, mimicry, biogeography, AI-assisted identification, species distribution modelling

# 1. Introduction

Field collections of thousands of specimens are valuable resources for systematics, ecology, evolution and conservation, but managing the data they generate remains a practical challenge. A specimen may be photographed, linked to its identifier, shared online with collaborators, connected to taxonomic and sequencing metadata, and mapped alongside records from external databases. These steps often rely on separate tools and manual checks. As collections grow, disconnected workflows increase the risk that images, identifiers, taxonomic names and localities become misaligned.

Ithomiini butterflies (Nymphalidae: Danainae) are a useful study system because they combine large specimen collections with questions that depend on geography, phenotype and genomic sampling. Distributed across Central and South America, they show extensive variation in larval host associations and geographic distributions (Willmott & Freitas, 2006, Chazot et al., 2019). Their wing colour patterns are shaped by Müllerian mimicry among co-occurring species, linking phenotypic variation to ecological interactions and biogeography (Elias et al., 2008, Doré et al., 2023). Published occurrence records with mimicry-ring assignments, together with ongoing collections, provide a basis for comparing these patterns across regions. Connecting specimens and their photographs to genomic resources also helps researchers select material for studies of diversification and the genetic basis of phenotypic variation.

Using these data effectively requires more than a general map. Researchers need to compare published records, citizen-science observations, museum records and project collection data while keeping data sources clear. They also need to distinguish material available for genomic work from documented sequencing outcomes. General-purpose platforms such as GBIF and iNaturalist provide essential occurrence data, but do not by themselves maintain the project's combined records of mimicry, specimen photographs, taxonomic decisions and genomic-sampling status. Desktop geographic information system (GIS) software can combine these layers, although preparing and sharing the same working dataset requires additional processing.

Rosser & Mallet (2024) developed open-source maps for *Heliconius* butterflies that connect geographic records with phenotype information and provide downloadable data. We extend this taxon-focused approach to the collection workflow that produces specimen images and links them to biological information. The tools were developed for butterfly collections and sequencing work involving the Wellcome Sanger Institute, UK, and Ikiam University, Ecuador. The AI Photo Processor supports identifier reading and reviewed file renaming, Wings Gallery supports image comparison and candidate identification, and Wings Atlas connects specimen and occurrence records with ecological and genomic context. Together, they support taxonomic review and the investigation of mimicry, distributions and sampling gaps.

# 2. Methods and implementation

## 2.1 System architecture overview

The toolkit separates data processing from data display (Figure 1). Processing scripts prepare static data files, and the map and gallery web applications serve those files through GitHub Pages. This design avoids a dedicated application server for routine map and gallery use. Uploaded-image classification in the Wings Gallery AI Identifier uses a separate Hugging Face inference service. Collection predictions are supplied through release-specific data files. Database update workflows can be triggered through password-protected update controls.

The web interfaces use Vue.js 3 (You, 2014), and Wings Atlas uses MapLibre GL JS for map rendering (MapLibre Contributors, 2021). Data processing is written primarily in Python (Van Rossum & Drake, 2009) with pandas (McKinney, 2010). GitHub Pages hosts the built web applications, and GitHub Actions runs build, deployment and database update workflows (GitHub, 2008, 2019). The AI Photo Processor uses the Gemini API for image interpretation, with an optional local backend for RAW-image rotations.

The components are versioned separately. Occurrence summaries refer to the frozen 9 May 2026 Wings Atlas snapshot. Released distribution-model products refer to 28 April 2026, and the taxonomic classifier description and collection evaluation refer to the September 2026 Gallery release. These dates do not imply that the occurrence snapshot was used to train the classifiers or that all modules were generated together. Source revisions and available model identifiers are recorded in Section 6.

[PHASE 3: FIG1. Supply the final workflow figure, using the caption below and distinguishing uploaded-image inference from precomputed paired-collection predictions.]

**Figure 1.** Connections between specimen digitisation and biological data. Photographs with visible specimen identifiers are reviewed and renamed with the AI Photo Processor, indexed in shared storage and displayed in Wings Gallery. Uploaded photographs are processed by a separate inference service that returns taxonomic candidates. Paired dorsal and ventral collection photographs use a distinct fitted classifier and release. Wings Atlas combines occurrence sources with taxonomic curation, mimicry assignments, recorded genomic-sampling status, host-plant information and relative habitat-suitability layers. Occurrence records, independent plant occurrences and model predictions are shown as distinct data types. The occurrence snapshot, SDM products and classifier releases have separate version identifiers.

## 2.2 AI Photo Processor

Large-scale specimen photography produces many camera-assigned filenames that must be linked to specimen identifiers before images can be used reliably. For the Ithomiini collections, wings are usually photographed on dorsal and ventral sides with the specimen identifier visible in the image. Reading these identifiers manually and renaming each file is slow, especially when hundreds of individuals are processed in a batch.

The AI Photo Processor uses Google's Gemini API to interpret images and read handwritten identifiers. It rotates photographs to a consistent orientation, crops the label region, arranges cropped labels into composite grids and sends each grid to the API with an editable prompt. Grid size, model choice and the number of parallel requests are configurable with a Google AI Studio API key.

The review interface displays each photograph beside the interpreted identifier and flags missing dorsal/ventral pairs, duplicate identifiers and photographs without a reading. Crossed-out or ambiguous labels require particular attention. Accepted identifiers are used to rename files with side labels, which default to `d` and `v` for dorsal and ventral images. Rename logs make the operation reversible. Human validation precedes final renaming, so an AI reading is not treated as an independently verified specimen identity. The editable prompt allows adaptation to other label formats.

## 2.3 Wings Gallery

Once specimen photographs are renamed and organised, researchers need a way to browse, filter, inspect and share images without downloading entire folder structures. Wings Gallery provides a filterable browser for photographs stored in shared Google Drive folders. A Google Apps Script indexes the folders into a Google Sheets spreadsheet, recording filename, URL, capture date, size and folder path. A Python script reads this spreadsheet, prepares the image URLs and writes the data files used by the website.

The gallery includes collection, insectary and CRISPR specimen views, identifier searches, AI-assisted identification and database updating. Users can filter by taxonomy, sex, experimental metadata or specimen identifier, referred to here as CAMID. Images can be enlarged together to compare wing-pattern variation or individually to inspect a specimen. These views support taxonomic review alongside the mapping interface (Figure 2).

### Uploaded-photo identification

The AI Identifier returns candidate taxonomic identifications from an uploaded butterfly photograph. A wing-localisation model implemented with Ultralytics defines padded rectangular regions around the detected biological material (Ultralytics, n.d.). The documented preprocessing uses a 6% crop margin and can combine selected regions into one crop. Classification uses the RGB crop, including any background within the rectangle, rather than necessarily using a pixel-masked wing image. When no usable detection is available, the workflow can fall back to the full image. Localisation is intended to limit unrelated image content, but does not guarantee its removal.

BioCLIP 2.5-H supplies a 1,024-dimensional representation of each input image. This representation describes visual features learned by a biological image model, rather than assigning the project's taxonomic labels by itself (Gu et al., 2025, Imageomics, n.d.). The BioCLIP image encoder remains frozen. A project-specific supervised taxonomic classifier is fitted to labelled butterfly and reference images to assign these representations to the represented taxonomic classes. The complete system is therefore supervised, not zero-shot. The Gallery identifies Butterflies of America, Sangay, Noreste and Cotacachi among its reference sources for taxonomic labels. The label space extends beyond the focal Sanger Ithomiini collection. Training representation is uneven, and rare taxa may be represented by very few images.

The uploaded-photo classification head applies layer normalisation (LayerNorm) to the image features, followed by L2 normalisation of both features and classifier weights. Cosine similarity compares the directions of the normalised feature and class vectors. The classifier applies a scale of 30 and converts the resulting scores to a distribution over the finest-rank classes using softmax. There is no residual adapter or additional fitted calibration temperature in this inference path. The finest-rank classes, also called leaves, are the labels predicted directly. Coarser taxonomic candidates are obtained downstream by summing scores of returned leaves that share a taxonomic parent, rather than by a sequence of independently trained classifiers for each rank.

The upload API returns only the top 64 leaf probabilities. Downstream rank aggregation and geographic reweighting therefore operate on a truncated candidate distribution, not necessarily on the full distribution across all represented taxa. The interface displays ranked candidates and associated model scores. These scores express classification support within the represented label space and returned candidate set. They are not calibrated probabilities that an identification is correct, and a high score does not establish that the photographed taxon is represented in the model.

### Paired dorsal/ventral collection classification

Specimens with verified dorsal and ventral photographs use a separate fitted collection classifier. The two 1,024-dimensional BioCLIP representations are concatenated into a 2,048-dimensional paired representation, identified as `CONCAT_DV` in the release records. This workflow combines information from both wing surfaces before taxonomic classification. Its fitted classifier and prediction release are distinct from the single-image upload classifier.

Specimens without verified pairs can receive documented single-image fallback predictions. Some fallback handling duplicates the available view within the paired representation. Such records are not treated as genuine observed dorsal/ventral pairs, and prediction coverage beyond the verified paired cohort is not counted as held-out evaluation coverage.

### Geographic re-ranking

Optional geographic information modifies candidate scores after classification. It does not change BioCLIP feature extraction. The implementation uses country and side-of-Andes information to reweight returned candidates. Candidates with positive geographic support retain weight 1. Candidates lacking positive support for a supplied country or side can receive a soft weight of 0.02, rather than being eliminated. Candidates absent from the geographic checklist remain neutral. With neither country nor side supplied, predictions remain unchanged.

Scores are renormalised after weighting. Lack of checklist support is not proof of absence, and geographic re-ranking cannot recover a candidate omitted from the API response. Context inferred from the image predictions is also not independent locality evidence. The geographic comparison reported below is specific to the published collection configuration.

### Evaluation

We report the Gallery's published held-out evaluation of 3,829 verified paired dorsal/ventral Sanger collection specimens, with results averaged across three seeds and five folds. This is a specimen-based evaluation of the collection workflow, not an evaluation of individual images sampled independently. Held-out predictions are distinguished from predictions obtained after fitting to the complete collection. The release's reported configuration includes geographic re-ranking and its exact Top-1 species-context setting for subspecies predictions.

Top-1 accuracy measures whether the highest-ranked candidate matches the reference identification. Top-5 accuracy measures whether the reference identification is among the first five candidates. Eligibility is defined separately at each rank because not every specimen has a usable reference identification at every rank, particularly for named subspecies. Eligible reference identifications outside the model vocabulary count as misses under the published rules. Results are reported as published in the Gallery, rather than as a new reanalysis of the underlying out-of-fold predictions.

The intended separation between training and testing is at specimen level. The available evidence does not independently establish the completeness of specimen grouping, removal of duplicates across image sources or absence of exposure during BioCLIP pretraining. These limits are distinct from the reported held-out fitting of the supervised collection classifier. No release-matched single-photo benchmark is reported here, so collection accuracy is not used to estimate performance on unrestricted uploaded photographs.

### Collection sex prediction

A separate workflow predicts sex for supported Sanger collection taxa using frozen BioCLIP representations of ventral forewings and dorsal hindwings. It reports taxon-specific Supported or Uncertain outputs. The published evaluation uses specimen-grouped folds, with three seeds and five folds, on a selected collection cohort. This workflow is separate from taxonomic identification and is not validated as the ordinary AI Identifier upload workflow.

## 2.4 Photography-to-gallery workflow

The three applications are connected by a reproducible photography-to-gallery workflow. For the Ithomiini workflow, wings are photographed with a stable camera setup using a Canon EOS 550D and a Canon EF-S 18-55 mm f/4-5.6 IS STM lens. The lens is positioned approximately 28 cm above the table, and the zoom position is taped to reduce accidental changes between imaging sessions. One example image from this setup was taken at 33 mm focal length, 1/100 s exposure, f/8, ISO 100, manual exposure mode, and flash off. These values describe the setup used here and should be adjusted for other cameras, lenses, lighting conditions, or specimen sizes.

Each photograph includes the dorsal or ventral wing surface, a colour reference, and the envelope or label containing the specimen identifier, here called the CAMID. Photographs are organised into dated batch folders, processed with the AI Photo Processor, reviewed by a researcher, and renamed with the CAMID and side suffix. The review step is essential because AI-read identifiers can be wrong, ambiguous, or affected by crossed-out labels.

Renamed files are uploaded to shared Google Drive folders, indexed through Google Apps Script and Google Sheets, processed with Python scripts, and served through the Wings Gallery. The camera setup, image review and indexing steps are the basis of Supplementary Protocol S1.

[PHASE 3: S1. Assemble and validate the final supplementary protocol from the existing photography protocol and authorised camera/setup assets. Confirm that screenshots and update instructions match the documented releases.]

## 2.5 Wings Atlas

Mapping butterfly distributions requires combining records with different taxonomic names, formats, geographic precision and metadata. Wings Atlas keeps data sources distinct while standardising the fields needed for filtering, display and export.

### Data sources and processing pipeline

The Atlas distinguishes five occurrence sources: the published dataset of Doré et al. (2023), Sanger Institute collection records, and three GBIF-derived groups comprising iNaturalist research-grade observations, Universidad Nacional Autónoma de México (UNAM) records and other institutional records (Table 1). The Doré et al. dataset provides occurrence information and sex-specific mimicry-ring assignments. The GBIF groups retain their source identities so that museum and citizen-science records can be compared separately. The butterfly GBIF download identified in the manifest for the selected occurrence snapshot is DOI `10.15468/dl.6zagkz`.

Sanger Institute records are maintained in a project Google Sheets database. They link CAMIDs to taxonomy, locality, coordinates, wing photographs and recorded genomic-sampling information. The processing code assigns status from available project fields, checking for a qualifying Tree of Life identifier (ToLID), then rack information, then recorded tissue information. Records not meeting those checks enter a residual category. The application can label ToLID-assigned records as Sequenced, although this function does not check sequencing completion. We therefore describe these fields as recorded pipeline status. ToLID assignment is not treated as independent confirmation that sequencing has been completed, and rack or tissue entries are not independently verified physical inventories.

Species-level genomic metadata come from Genomes on a Tree (GoaT), including chromosome number, genome size and assembly availability (Challis et al., 2023). A Python script queries the GoaT API and caches the results. The species table shows chromosome number alongside genus-level summaries and links to the corresponding GoaT page. These species-level records are distinct from specimen-level ToLID or tissue fields.

The frozen occurrence snapshot is used as a defined record population, not as a count of unique organisms or independent sampling events. Raw source sizes and contributions after processing need not coincide. Occurrence counts and geographic or taxonomic summaries from other builds are not substituted into this snapshot.

### Data merging and taxonomic curation

The processing pipeline standardises field names, country names and taxonomic formatting across sources. Taxonomic curation uses a manually maintained corrections file, the GBIF backbone taxonomy, and reference names from Butterflies of America and nymphalidae.net (Warren et al., 2023). The workflow addresses synonyms, misspellings and outdated names, with edit-distance checks to flag possible typographical errors. Original names are retained alongside curated names and the recorded basis for the change. A resolved name does not by itself validate the identification of the underlying specimen.

The lookup from Doré et al. (2023) links species and subspecies to male and female mimicry-ring assignments. Exact species-subspecies matches are used where available. For species-only records, a ring is assigned only when the lookup supports a consistent sex-specific assignment across the represented subspecies. Otherwise, the record remains unassigned at that level. Transferred assignments are taxon-based annotations, not independent observations of the wing pattern of every mapped individual.

### Occurrence filtering

Occurrence records are filtered or flagged according to the evidence represented by each source. GBIF-derived records are screened for four coordinate-quality problems before use in the web-map dataset and species distribution models: reported coordinate uncertainty above 100 km, the GBIF placeholder locality string "no specific locality", coordinates outside the Neotropical study extent (120°W to 30°W, 40°S to 25°N), and coordinates falling in the ocean. Ocean checks use the Global Self-consistent, Hierarchical, High-resolution Shoreline database (GSHHS, Wessel & Smith, 1996) with a 5 km tolerance so that minor coastline or GPS rounding errors near bays and islands are not over-filtered.

Doré et al. (2023) records are grid-count data, so some offshore cell centroids can be artefacts of the grid. These records are retained for occurrence visualisation and are not used as inputs to the species distribution models. Sanger Institute records are not removed by these spatial checks. Instead, the web interface flags any record outside the study area or in the ocean so the team can inspect it and correct coordinate-entry errors in the source database when needed.

### Host plants

Larval host records are scattered across the literature and can differ in both taxonomic precision and evidential support. The host-plant module links butterfly taxa to reported larval hosts, retaining the reported plant name, accepted name, family, source citation and accompanying notes. The reported name preserves what the source identified. The accepted name facilitates comparison across synonyms, without adding identification precision absent from the source.

Host identification at species, genus or family level is recorded separately from the evidence supporting the butterfly-host association. Evidence-support annotations and broader confidence annotations describe different aspects of a record and are not interchangeable. Source-backed reports, tentative associations and records requiring further checking must be interpreted from their underlying documentation, rather than from the accepted plant name alone.

Where mapped data are available, the module links host taxa to independent plant-occurrence overlays, including GBIF records. A genus-level association cannot establish use of every species in that genus, and a family-level record is too coarse to identify a particular host species. Plant occurrence points document plants at localities. They do not demonstrate that butterflies fed, oviposited or developed on those plants at those localities. The overlays provide ecological context and are not predictors in the SDMs described here.

### Species distribution modelling

Beyond mapping known records, Wings Atlas includes species distribution models that estimate relative habitat suitability from environmental conditions at known occurrence locations. The models are intended as exploratory layers for comparing observed records with predicted suitable areas. They should not be interpreted as true probabilities of occurrence.

The modelling pipeline uses occurrence records from GBIF-derived sources after source-specific spatial filtering and 5 km spatial thinning. Environmental predictors include CHELSA bioclimatic variables, elevation, and cloud cover. Host-plant information is not included in this SDM predictor stack. The plant layers are intended for ecological context and hypothesis generation, not as predictors in the cross-species modelling workflow, because host records and GBIF plant occurrence availability are uneven across taxa.

Because the data are presence-only, models compare environments at presence locations with environments available in the area the species could plausibly reach, known as the accessible area (Barve et al., 2011). The pipeline builds accessible areas from buffered convex hulls around records. When records form spatially disjunct clusters, Density-Based Spatial Clustering of Applications with Noise (DBSCAN, Ester et al., 1996) is used to identify clusters, build a hull for each, and combine them. Buffer size scales with cluster diameter, with a 50 km floor and 500 km ceiling. Background points are sampled within these accessible areas and weighted by the density of all Ithomiini records combined, following the target-group approach for reducing sampling-bias effects in presence-only models (Phillips et al., 2009). Background points describe environmental availability within the sampled and accessible region, not observed absences.

The modelling algorithm depends on sample size. Species with 20 to 49 thinned records are fitted with MaxEnt alone (Phillips & Dudík, 2008) through the elapid Python package (Christensen, 2022). Species with 50 or more records use an ensemble of MaxEnt, random forest, and gradient-boosted trees, following evidence that different presence-only algorithms can perform differently across species and sample sizes (Wisz et al., 2008, Valavi et al., 2021). Models are evaluated with spatial-block cross-validation where sample size permits, and leave-one-out cross-validation is used for species with fewer than 30 records (Pearson et al., 2007, Roberts et al., 2017). Evaluation reports the area under the receiver operating characteristic curve (AUC) and the continuous Boyce index, which measures whether higher predicted suitability contains a higher density of observed presences (Hirzel et al., 2006).

MaxEnt feature classes and regularisation are compared using cross-validated continuous Boyce performance, following the model-selection approach described by Kass et al. (2021). The documented workflow retains a default configuration when tuning does not improve validation performance. Diagnostic values must be interpreted with the occurrence sample size, validation design and geographic extent used for each species.

Predictions are generated on a common Neotropical grid at 0.1° resolution. Each species has a core layer inside its accessible area and an extension layer outside that area. The extension layer is useful for visual comparison across species but represents extrapolation beyond the accessible-area background used during fitting. Released prediction rasters and associated metadata are stored separately from the occurrence display data. The April release comprises full-projection, accessible-area core and extrapolated-extension products. Its model population is not inferred from a later occurrence snapshot.

### Interface and export

Researchers can display occurrence points, clusters or density heatmaps and filter records by taxonomy, data source, date, mimicry assignment, CAMID and recorded pipeline status. SDM and host-plant layers provide separate spatial context. Active filters are encoded in the URL for sharing, although the underlying live data may change between visits.

Selecting a map point opens specimen metadata and an associated photograph where available. When no photograph of that individual is available, a reference image may be shown from another individual of the same species or subspecies. Such images illustrate a taxon and are not evidence for the mapped individual's identity. A data table provides specimen-level and species-level views, including GoaT information, and a Host Plants view exposes association sources and caveats. Plant images illustrate the plants, not observed butterfly-host interactions.

The map can be exported as PNG or JPG. The R export supplies filtered butterfly-occurrence data, range data where applicable, plotting settings and an R/ggplot2 script. Points and polygons can remain vector in suitable SVG or PDF output, whereas basemaps and image-based overlays remain raster. Not all interactive layers are exported as independent editable data. In particular, the inspected export does not establish independent editable SDM, host-plant or vector heatmap layers. SVG or PDF output should therefore not be interpreted as a fully vector reproduction of the interactive map. Running the script depends on the required R packages and, where used, external basemap services.

### Deployment

GitHub Actions builds and publishes the web application. A separate manually triggered workflow updates selected occurrence sources. Static hosting removes the need for a continuously running application server for the Atlas and Gallery interfaces, but access to source databases, image storage, update credentials and inference services remains dependent on those external resources.

[PHASE 3: FIG2. Supply dated interface panels from the documented Gallery and Atlas releases. Use authorised specimen images, identify reference-image substitution and omit unreconciled quantitative charts.]

**Figure 2.** Specimen review and geographic context in Wings Gallery and Wings Atlas. (a) Dorsal and ventral photographs linked by specimen identifier in the collection view. (b) Candidate predictions for an uploaded photograph, displayed separately from the paired-collection evaluation in Table 2. (c) Atlas occurrence records with source identity and a linked specimen or explicitly identified reference image. (d) An accessible-area suitability layer and its extrapolated extension, distinguished from butterfly records and optional independent plant occurrences. Each panel identifies its application revision and capture date. The panels illustrate data access and interpretation, not additional model evaluations.

# 3. Results

## 3.1 Occurrence data

The Wings Atlas snapshot generated on 9 May 2026 contains 104,297 occurrence records from five data sources (Table 1). The records connect published distribution information and GBIF-derived observations with project collection metadata. This total describes the frozen occurrence dataset, not the September classifier's training or evaluation population. Source-specific, country and taxonomic totals are not reported because those breakdowns have not been reconciled to the same snapshot.

**Table 1.** Data sources represented in the frozen 9 May 2026 Wings Atlas occurrence snapshot, comprising 104,297 records in total. The GBIF component is identified by download DOI `10.15468/dl.6zagkz`.

| Data source | Contribution to the integrated records | Interpretation |
| :--- | :--- | :--- |
| Doré et al. (2023) | Published occurrences and sex-specific mimicry-ring assignments | Grid-based records are retained for visualisation, not used in the SDMs |
| Sanger Institute collection | Specimen identifiers, locality, photographs and recorded genomic-sampling fields | ToLID assignment does not independently confirm completed sequencing |
| iNaturalist through GBIF | Research-grade citizen-science observations | Retained as a distinct GBIF-derived source |
| UNAM through GBIF | Museum collection records | Retained as a distinct institutional source |
| Other institutions through GBIF | Occurrence records from additional publishers | Original source information remains relevant to interpretation |

## 3.2 Taxonomic classifier coverage and collection evaluation

The September Gallery release reports 7,933 finest-rank classes spanning 4,478 species, with 4,958 named subspecies. These are reported model-vocabulary counts, not an independent audit of accepted taxonomic names. Species and subspecies are not additive categories because named subspecies share species parents. The label space extends beyond the focal Ithomiini collection, but its size does not imply comparable training representation or accuracy for every taxon.

The published paired-collection benchmark covers 3,829 verified dorsal/ventral Sanger specimens. Species Top-1 accuracy is 91.33% among 3,355 eligible specimens, with Top-5 accuracy of 97.91% (Table 2). The named-subspecies, genus and family denominators differ because reference-identification eligibility is rank-specific. These results describe the published held-out collection workflow under its geographic re-ranking and species-context configuration. They are not estimates of performance on unrestricted uploaded photographs.

**Table 2.** Published September 2026 Gallery evaluation of paired dorsal/ventral Sanger collection photographs. The benchmark comprises 3,829 verified paired specimens, with results averaged across three seeds and five held-out folds. Percentages are retained as published, without reanalysis of raw predictions. The configuration includes geographic re-ranking and the release's exact Top-1 species-context setting for subspecies predictions. Eligibility depends on the reference identification available at each rank. Eligible out-of-vocabulary identifications count as misses under the published rules. This table does not evaluate the single-photo AI Identifier.

| Taxonomic rank | Eligible specimens | Top-1 accuracy | Top-5 accuracy |
| :--- | ---: | ---: | ---: |
| Named subspecies | 2,613 | 87.93% | 97.33% |
| Species | 3,355 | 91.33% | 97.91% |
| Genus | 3,806 | 95.55% | 99.26% |
| Family | 3,824 | 99.32% | 99.90% |

The Gallery's reported geographic comparison gives Top-1 changes of +0.21 percentage points at species rank, +0.74 at named-subspecies rank and −0.16 at genus rank. The effects are modest and rank-dependent, rather than a consistent improvement at every rank.

The separate collection sex workflow reports predictions for 1,586 specimens. Its formal benchmark comprises 1,220 specimens across 57 species and reports approximately 89.7% accuracy. The larger prediction population is not an additional held-out evaluation set. This result applies to a selected Sanger cohort, not to general butterfly sex classification or ordinary uploaded photographs.

## 3.3 Taxonomic review, mimicry and genomic-sampling context

The integrated records retain original and curated names alongside the basis for taxonomic changes. This allows researchers to inspect how synonym resolution, spelling corrections and reference-taxonomy matching affect mapped records, without equating a resolved name with a validated specimen identification. Mimicry annotations from the Doré et al. lookup can be compared across sources and sexes. Taxon-derived assignments remain distinguishable from direct inspection of an individual's wing pattern.

Specimen records can also be compared with ToLID assignment, rack and tissue fields and species-level GoaT information. Together, these fields support review of recorded progress through the genomic-sampling workflow. No count of completed sequencing is inferred from ToLID assignment, and no quantitative sequencing-status breakdown is reported without confirmed definitions and a consistent record population.

## 3.4 Host-plant context

The host-plant module brings reported associations, accepted plant names, identification precision and evidence annotations into the same research interface. Where plant layers are available, butterfly records can be compared with independent occurrences of reported hosts. The mapped plant records and reference images document plants, not local butterfly-host interactions. Quantitative totals for associations, support categories, mapped taxa and plant occurrences are not reported because the available build metadata have not been reconciled into one identifiable quantitative release.

## 3.5 Species distribution models

The 28 April 2026 release provides complete raster product sets for 145 species. Each set contains a full-projection suitability raster, an accessible-area core and an extrapolated extension. The count refers to species with all three released products.

The interface allows comparison of occurrence records with predicted suitable environments, adjustment of layer opacity and inspection of available model diagnostics. The accessible-area core identifies predictions within the region used to define background environments during fitting. The extension shows projection beyond that region and requires greater caution. Aggregate AUC, continuous Boyce and model-confidence summaries are not reported because they have not been established for exactly these 145 released species.

# 4. Discussion

## 4.1 Connecting collections to biological questions

The toolkit connects specimen digitisation with the taxonomic and geographic information needed to interpret collection material. Its contribution is the continuity between reviewed identifiers, photographs, occurrence records and project metadata. Taxon-focused maps such as those developed for *Heliconius* provide a useful basis for these comparisons (Rosser & Mallet, 2024). Linking them to collection workflows allows the same specimen to be examined as an image, a taxonomic record and potential material for genomic research. The tools complement biodiversity aggregators and institutional databases rather than replacing their data stewardship.

The integrated platform supports biological questions that depend on connecting phenotype, geography, taxonomy, host-plant records and genomic sampling. Filtering the map by mimicry ring, for example, lets researchers inspect the geographic extent of a ring and identify regions where membership changes. Toggling data sources shows whether an apparent pattern is represented in published records, citizen-science observations, museum records or Sanger collection specimens. A taxon-derived mimicry assignment still requires specimen-level inspection when the question concerns individual variation or uncertain ring membership.

Collection and GoaT information can help identify gaps in genomic sampling. Researchers can compare recorded tissue and rack information with mapped distributions, taxonomic coverage and documented assembly availability before deciding what material to collect or examine. ToLID assignment indicates a recorded identifier, not completion of the sequencing workflow. Decisions about available material require confirmation from the source collection or sequencing team. Unusual chromosome-number entries can likewise identify records for review, rather than establishing biological differences without checking their sources.

Host-plant records add ecological context to these comparisons. Users can inspect reported larval hosts for a focal butterfly and compare butterfly records with independent plant occurrences. Spatial overlap can suggest localities for field verification, but cannot establish host use or explain a distributional boundary by itself. Date and source filters also help identify uneven coverage across periods and datasets. Such patterns are not abundance estimates or evidence of range shifts without accounting for sampling effort and detection.

## 4.2 AI-assisted identification and taxonomic curation

Candidate identifications can help researchers triage unknown specimens, compare alternative names and identify collection records that merit expert review. The paired Sanger benchmark supports this use within its evaluated collection setting. Its results do not establish transfer to arbitrary uploaded photographs, which may differ in preparation, image quality, background and taxonomic composition. A single uploaded photograph also lacks the two verified wing surfaces used by the paired classifier.

The classifier is closed-set: it ranks represented labels even when the photographed taxon is absent from the vocabulary. Uneven training coverage, rare classes and errors in source labels can affect those rankings. Worn or damaged specimens, unusual viewing angles and poorly localised biological material may also yield misleading predictions. The displayed scores should not be used as calibrated identification confidence. Expert assessment of the specimen, reference images and locality remains necessary, especially where species share similar wing patterns.

Geographic re-ranking changes how visual candidates are prioritised. The small published gains at species and named-subspecies ranks, alongside a decline at genus rank, show why its effects should be assessed by rank and cohort. Incomplete checklists can penalise a correct but poorly documented candidate. Geography inferred from the model's own predictions is not independent corroboration, and agreement with a checklist cannot validate the image identification on its own.

The held-out collection results also leave questions about transfer and training exposure. Specimen grouping, duplicate images across sources and possible inclusion in BioCLIP pretraining require separate checks before stronger claims of independence. An evaluation of the release-matched upload pipeline is needed to quantify performance on user photographs. Sex prediction has a narrower supported cohort and should not be generalised to all taxa in the taxonomic model.

Name curation presents a related distinction. Resolving a synonym or typographical error makes names more comparable, but does not establish that a specimen was correctly identified. Recently described taxa, contested synonyms and uncertain subspecies require expert decisions. Retaining original names and the basis for changes allows those decisions to be reviewed rather than hidden by automated standardisation.

## 4.3 Occurrence, host-plant and distribution-model limits

The Atlas combines observations collected for different purposes, with uneven spatial precision and sampling effort. Its occurrence total should not be interpreted as the number of independent specimens or sampling events without examining source structure and duplicate records. Source-specific filtering and spatial thinning reduce some problems but do not remove all sampling bias or taxonomic error.

Host-plant records require two separate judgements: how precisely the plant was identified and how directly the source supports the butterfly-host association. A source reporting only a genus does not establish use of every congeneric species. Plant occurrences add another independent source of uncertainty because botanical recording effort differs across taxa and regions. Neither mapped overlap nor an accepted plant name converts a tentative association into a confirmed interaction.

SDMs estimate relative habitat suitability from occurrence records and environmental predictors. Their values are not true occurrence probabilities. Background selection, sparse records, uneven geographic coverage and uncertain identifications can affect model fitting and validation. Accessible-area cores and extrapolated extensions should remain distinguishable because predictions outside the fitted background region have a different evidential basis. Available species-level diagnostics inform interpretation, but aggregate claims about the released set require evaluation summaries matched to that same set of products.

## 4.4 Reproducibility and maintenance

Static hosting for the map and gallery limits routine server maintenance, but does not remove dependence on external services. Image storage, APIs, update credentials and inference resources require continued management. The editable data-processing scripts and separation of data preparation from visualisation allow other collections to adapt the workflow, provided that comparable identifiers, reference taxonomy and source permissions are available.

Reproducibility depends on more than a live application link. A Git commit identifies versioned code and included data, but does not by itself identify unpinned external model weights, changing source databases or remotely stored photographs. Occurrence downloads, classifier artifacts and SDM releases therefore need separate identifiers. The manuscript reports those identifiers where supported and does not treat the May occurrence snapshot and September classifier as one simultaneous dataset.

Filter URLs record a search configuration, not an immutable dataset. Data exports can preserve records for subsequent analyses, while the R script provides a route to editable occurrence and range plotting. Basemaps and image-based overlays remain raster, and not every interactive layer is available as independent data in the export. Complete reproduction still depends on the exported inputs, required software and any external resources used by the plotting script.

# 5. Conclusions

The toolkit connects reviewed specimen photographs with taxonomic, geographic and genomic-sampling information for butterfly research. It supports image-based comparison and candidate identification while keeping original records, inferred labels and ecological context distinct. For Ithomiini collections, these connections provide a practical basis for investigating mimicry, reviewing taxonomy and planning biological and genomic sampling. The scientific value of the workflow depends on maintaining identifiable data versions and expert validation of the specimens and associations being studied.

# 6. Data availability

The AI Photo Processor source repository is `https://github.com/Fr4nzz/rename_photos_AI`. Wings Gallery source code is maintained at `https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery`, with its public interface at `https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/` and uploaded-photo identification at the `ai_identifier` route. The Wings Atlas web application is available at `https://rapidspeciation.github.io/ithomiini_maps/`. The working repository used for this manuscript is `https://github.com/Fr4nzz/ithomiini_maps`. Access to a working repository and access to a deployed public application are separate.

The archived Atlas and manuscript source state is identified by commit `935cc42740aefbe70640eb15d79bf4f6c21e1089`, with the supporting evidence ledger at `67eb756639aa99b7ce8307a7f435c1635e0787a7`. The frozen occurrence manifest is dated `2026-05-09T17:38:04.759685+00:00` and identifies butterfly GBIF download DOI `10.15468/dl.6zagkz`. The complete SDM raster release is identified by commit `1cdde9bc8d5f4375def888b5796e71493ee60d68` of 28 April 2026. Public generated data include the occurrence display files and released SDM and host-plant files served with the Atlas. These are distinct from restricted source spreadsheets and are not asserted to comprise a newly reconciled host-plant release.

The Gallery methods and published evaluation are tied to source commit `f5cb03f17f3ba639090b32fbedde6d6645ff847b`. The paired prediction coverage receipt is dated 14 September 2026 and records the paired classifier SHA-256 as `34ecd53f64b3f9dc600710af5ca8df7cd94845653a9ce9f916dcd08adc520167`. Uploaded-photo inference source is provided through `https://huggingface.co/spaces/fr4nzzch/butterfly-id`, inspected at source commit `3aa72a36c37ce8b383f8f5a5f9ec5763f52e5e42`, with the endpoint at `https://fr4nzzch-butterfly-id.hf.space`. Published model resources are at `https://huggingface.co/fr4nzzch/butterfly-id-classifier`. The published uploaded-photo classifier object has SHA-256 `e461eb4eda24c919711d7497833916305259a712753323ff9431aad9b9e07d6f6`. The BioCLIP 2.5-H resource is `https://huggingface.co/imageomics/bioclip-2.5-vith14`. Published object identifiers and source revisions do not independently attest which weights a running inference container has loaded.

Restricted Sanger collection information is available upon reasonable request to the corresponding research group, subject to project permissions and specimen-data sensitivity. Third-party occurrence records and images retain their source licences and attribution requirements. This includes images used for model training, evaluation or reference displays. Availability of source code or classifier weights does not imply redistribution of all training images. No plant GBIF download DOI is assigned here to the unreconciled aggregate of exported host layers.

[PHASE 3: DATA1. Confirm the public code-release destinations and archive the submission version with its access terms. Add a runtime model receipt and release-matched training and evaluation manifests where available. Reconcile the host-layer build and its source-download citations before publishing quantitative host summaries.]

# 7. Acknowledgements

We thank Neil Rosser and James Mallet for developing the *Heliconius* maps platform, which inspired the design of Wings Atlas. We acknowledge GBIF and its data publishers for providing occurrence data. We acknowledge the use of AI coding assistants during software development, including OpenAI GPT models, Google Gemini and Anthropic Claude.

[PHASE 3: ACK1. Authors to confirm funding statements, collection and photography contributions, permits, contributors requiring acknowledgement and any disclosure required by the target journal. No additional contributor names have been inferred.]

# References

Barve, N., Barve, V., Jiménez-Valverde, A., Lira-Noriega, A., Maher, S.P., Peterson, A.T., Soberón, J. & Villalobos, F. (2011). The crucial role of the accessible area in ecological niche modeling and species distribution modeling. Ecological Modelling, 222(11), 1810–1819. https://doi.org/10.1016/j.ecolmodel.2011.02.011

Challis, R., Kumar, S., Sotero-Caio, C., Brown, M. & Blaxter, M. (2023). Genomes on a Tree (GoaT): A versatile, scalable search engine for genomic and sequencing project metadata across the eukaryotic tree of life. Wellcome Open Research, 8, 24. [https://doi.org/10.12688/wellcomeopenres.18658.1](https://doi.org/10.12688/wellcomeopenres.18658.1)

Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas, A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M., Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple independent colonizations drive montane diversity in the Neotropical clearwing butterflies Godyridina. Molecular Ecology, 28(10), 2423–2438.

Christensen, A. (2022). elapid: Species distribution modeling tools for Python. Journal of Open Source Software, 7(80), 4930. https://doi.org/10.21105/joss.04930

Doré, M., Willmott, K., Lavergne, S., Chazot, N., Freitas, A.V.L., Fontaine, C. & Elias, M. (2023). Mutualistic interactions shape global spatial congruence and climatic niche evolution in Neotropical mimetic butterflies. Ecology Letters, 26(6), 843–857. [https://doi.org/10.1111/ele.14198](https://doi.org/10.1111/ele.14198)

Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic interactions drive ecological niche convergence in a diverse butterfly community. PLoS Biology, 6(12), e300.

Ester, M., Kriegel, H.P., Sander, J. & Xu, X. (1996). A density-based algorithm for discovering clusters in large spatial databases with noise. Proceedings of the Second International Conference on Knowledge Discovery and Data Mining, 226–231.

GitHub (2008). GitHub Pages. GitHub, Inc. [https://pages.github.com](https://pages.github.com)

GitHub (2019). GitHub Actions. GitHub, Inc. [https://github.com/features/actions](https://github.com/features/actions)

Gu, J., Stevens, S., Campolongo, E.G., Thompson, M.J., Zhang, N., Wu, J., Kopanev, A., Mai, Z., White, A.E., Balhoff, J., Dahdul, W., Rubenstein, D., Lapp, H., Berger-Wolf, T., Chao, W.-L. & Su, Y. (2025). BioCLIP 2: Emergent Properties from Scaling Hierarchical Contrastive Learning. arXiv:2505.23883v2. https://doi.org/10.48550/arXiv.2505.23883

Hirzel, A.H., Le Lay, G., Helfer, V., Randin, C. & Guisan, A. (2006). Evaluating the ability of habitat suitability models to predict species presences. Ecological Modelling, 199(2), 142–152. https://doi.org/10.1016/j.ecolmodel.2006.05.017

Imageomics (n.d.). BioCLIP 2.5 Huge: model card and model resources. https://huggingface.co/imageomics/bioclip-2.5-vith14. Accessed 21 September 2026.

Kass, J.M., Muscarella, R., Galante, P.J., Bohl, C.L., Pinilla-Buitrago, G.E., Boria, R.A., Soley-Guardia, M. & Anderson, R.P. (2021). ENMeval 2.0: Redesigned for customisable and reproducible modeling of species' niches and distributions. Methods in Ecology and Evolution, 12(9), 1602–1608. https://doi.org/10.1111/2041-210X.13628

MapLibre Contributors (2021). MapLibre GL JS. [https://maplibre.org](https://maplibre.org)

McKinney, W. (2010). Data Structures for Statistical Computing in Python. Proceedings of the 9th Python in Science Conference, 56–61. [https://doi.org/10.25080/Majora-92bf1922-00a](https://doi.org/10.25080/Majora-92bf1922-00a)

Pearson, R.G., Raxworthy, C.J., Nakamura, M. & Peterson, A.T. (2007). Predicting species distributions from small numbers of occurrence records: a test case using cryptic geckos in Madagascar. Journal of Biogeography, 34(1), 102–117. https://doi.org/10.1111/j.1365-2699.2006.01594.x

Phillips, S.J. & Dudík, M. (2008). Modeling of species distributions with Maxent: new extensions and a comprehensive evaluation. Ecography, 31(2), 161–175. https://doi.org/10.1111/j.0906-7590.2008.5203.x

Phillips, S.J., Dudík, M., Elith, J., Graham, C.H., Lehmann, A., Leathwick, J. & Ferrier, S. (2009). Sample selection bias and presence-only distribution models: implications for background and pseudo-absence data. Ecological Applications, 19(1), 181–197. https://doi.org/10.1890/07-2153.1

Roberts, D.R., Bahn, V., Ciuti, S., Boyce, M.S., Elith, J., Guillera-Arroita, G., Hauenstein, S., Lahoz-Monfort, J.J., Schröder, B., Thuiller, W., Warton, D.I., Wintle, B.A., Hartig, F. & Dormann, C.F. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. Ecography, 40(8), 913–929. https://doi.org/10.1111/ecog.02881

Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing geographic distributions and phenotypes. Tropical Lepidoptera Research, 34(1), 26–30.

Ultralytics (n.d.). Ultralytics: software for object detection and instance segmentation. https://github.com/ultralytics/ultralytics. Accessed 21 September 2026.

Valavi, R., Guillera-Arroita, G., Lahoz-Monfort, J.J. & Elith, J. (2021). Predictive performance of presence-only species distribution models: a benchmark study with reproducible code. Ecological Monographs, 92(1), e1486. https://doi.org/10.1002/ecm.1486

Van Rossum, G. & Drake, F.L. (2009). Python 3 Reference Manual. CreateSpace.

Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott, K.R. & Grishin, N.V. (2023). Illustrated Lists of American Butterflies. Butterflies of America Foundation. https://www.butterfliesofamerica.com

Wessel, P. & Smith, W.H.F. (1996). A global, self-consistent, hierarchical, high-resolution shoreline database. Journal of Geophysical Research: Solid Earth, 101(B4), 8741–8743. https://doi.org/10.1029/96JB00104

Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of larval host plant colonization and diversification. Cladistics, 22(4), 297–368.

Wisz, M.S., Hijmans, R.J., Li, J., Peterson, A.T., Graham, C.H., Guisan, A. & NCEAS Predicting Species Distributions Working Group (2008). Effects of sample size on the performance of species distribution models. Diversity and Distributions, 14(5), 763–773. https://doi.org/10.1111/j.1472-4642.2008.00482.x

You, E. (2014). Vue.js: The Progressive JavaScript Framework. [https://vuejs.org](https://vuejs.org)
