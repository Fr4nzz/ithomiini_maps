**From butterfly photos to maps: Open-source tools for AI photo
renaming, an image gallery, and interactive maps of Ithomiini
butterflies**

**Franz Chandi**^1^, **Patricio A. Salazar Carrión**^2^, **Joana I.
Meier^2,3^**

1 Universidad San Francisco de Quito, Quito, Ecuador

2 Tree of Life Programme, Wellcome Sanger Institute, Hinxton, Cambridge,
United Kingdom

3 Department of Zoology, University of Cambridge, Cambridge, United
Kingdom

# **Abstract**

Studying butterfly diversity requires integrating data from fieldwork,
museum collections, genomic sequencing programs, and global biodiversity
databases. However, the tools available for managing specimen
photographs, organizing taxonomic records, and visualizing geographic
distributions are often separate, require different software packages,
and demand specialized technical expertise. Here we present three
connected open-source web applications that together cover the full
workflow from specimen photography to interactive distribution mapping
for Ithomiini butterflies. The AI Photo Processor uses Google\'s Gemini
AI to read handwritten specimen identifiers from photographs and rename
image files in batches. The Wings Gallery provides a centralized,
filterable browser for high-resolution wing photographs stored on Google
Drive. Ithomiini Maps integrates occurrence records from published
datasets, institutional sequencing databases, and the Global
Biodiversity Information Facility (GBIF) into a single filterable map
interface. All three applications run entirely in any internet browser
and are hosted on GitHub Pages at no cost. We describe the architecture,
data pipelines, and taxonomic curation procedures, illustrate how
researchers can use these tools to explore questions in mimicry,
biogeography, and genomic sampling, and discuss how this approach can be
adapted to other taxa.

**Keywords:** biodiversity informatics, Nymphalidae, interactive maps,
specimen digitization, Lepidoptera, open-source, mimicry rings, GBIF,
distribution mapping

# **1. Introduction**

Fieldwork collections of thousands of specimens are highly valuable
resources for diverse research projects, but managing the data they
generate remains a practical challenge. Photographing preserved
specimens, linking each image to its unique identifier, sharing photos
with collaborators, and mapping where specimens were collected all
involve separate tools that rarely connect to each other. As collections
grow, these disconnected steps become bottlenecks that slow down
collaborative research.

Here, we have developed tools to rename photos, visualise them in ways
to facilitate species identification and phenotype comparison across
sexes and species, and visualise them on maps. We have applied them to a
large-scale collection of Ithomiini butterflies (Nymphalidae: Danainae),
but the tools are designed to work with any taxonomic group that
maintains photo-based specimen records. These butterflies are one of the
most species-rich and ecologically important butterfly tribes in the
Neotropics, with over 390 described species found across Central and
South America (Willmott & Freitas, 2006; Chazot et al., 2019). Their
remarkable diversity of wing color patterns, shaped by Müllerian mimicry
complexes involving dozens of co-occurring species, has established them
as a model system for studying speciation, adaptation, and ecological
interactions (Elias et al., 2008; Jiggins, 2017; Dore et al., 2023). The
recent publication of a large dataset of nearly 29,000 georeferenced
occurrence records with mimicry ring classifications (Dore et al.,
2023), together with ongoing collection efforts and genomic sequencing
at the Wellcome Sanger Institute, has created a unique opportunity to
study Ithomiini biogeography at a broad scale.

However, managing, visualizing, and sharing these large-scale datasets
remains a practical challenge. Researchers working with thousands of
specimens typically face a fragmented workflow: thousands of preserved
wings may be physically stored waiting to be photographed, and the steps
required to rename each photograph with its specimen identifier, upload
images to the cloud, and make them available for colleagues are
time-consuming and lack a straightforward pipeline. Meanwhile,
geographic data from multiple sources (published records, institutional
databases, GBIF, iNaturalist) must be manually combined, cleaned, and
mapped using specialized GIS software. These disconnected steps
introduce delays and potential errors that slow down collaborative
research.

Our early attempts to address the image sharing problem used R-Shiny
applications hosted first on Google Cloud Run and later on Amazon EC2
free-tier instance[citations?]{.comment-start id="0"
author="Joana Meier" date="2026-03-01T17:31:20Z"}[I was referring to the
old versions of the Wings Gallery that was running on R and needed to be
hosted on a server, but I added citation to the Heliconius
maps]{.comment-start id="1" author="Franz Chandi"
date="2026-03-18T23:49:50Z"}s.[[]{.comment-end id="1"}]{.comment-end
id="0"} We initially chose a server-based approach because static
websites appeared unable to support dynamic filtering: existing static
alternatives, such as the Heliconius maps (Rosser & Mallet, 2024),
pre-rendered individual HTML pages for each species using R, while their
interactive filtering required a separate Shiny server component. Free
hosting services for Shiny apps exist (e.g., shinyapps.io, which the
Heliconius maps platform uses for its data download component), but
their free tier limits the number of hours the application can run each
month, which may be acceptable for occasional data downloads but not for
a tool intended to be always available for interactive exploration.
Self-hosting on cloud platforms avoids this limit, but requires setting
up and maintaining several layers of server software (the application
itself, a web server to handle incoming traffic, and network security
rules), creating infrastructure that is difficult for researchers
without system administration experience to maintain or replicate.
Additionally, the free DNS service we used for a custom domain was
blocked on certain networks, making the application unreachable for some
collaborators. These difficulties led us to explore modern JavaScript
frameworks such as Vue.js, which can provide the same interactive
filtering capabilities as a server-based tool with faster performance
and no server maintenance, and to rebuild the toolkit as static sites
hosted on GitHub Pages.

Interactive web-based mapping tools have emerged as a solution for
biodiversity visualization. Rosser & Mallet (2024) developed open-source
interactive maps for *Heliconius* butterflies using R and the Leaflet
library to create a static website hosted on GitHub. Their platform lets
researchers visualize phenotypic and geographic data in a single
interface, and their explicit goal of making their methods
\"straightforward for researchers to adapt to their own taxa\" inspired
this work. However, the R/Leaflet approach has limitations: filter
changes can be slow with large datasets, the interface is constrained by
what R-Shiny or static HTML allows, and the platform covers only the
visualization step. Additionally, the *Heliconius* maps address only the
visualization step; the earlier steps of specimen digitization, image
management, and multi-source data integration are not covered.

Here we present a toolkit of three connected open-source applications
that together address the complete specimen-to-map pipeline for
Ithomiini butterflies:

> 1\. **AI Photo Processor** --- A desktop application for batch reading
> of handwritten specimen identifiers from wing photographs using
> Google\'s Gemini AI, enabling automated file renaming at scale. While
> built for entomological collections, researchers can customize the AI
> prompt to extract other types of information from images, making it
> adaptable to different research contexts.
>
> 2\. **Wings Gallery** --- A serverless web gallery for browsing,
> filtering, and sharing high-resolution wing photographs stored on
> Google Cloud services, with one-click database updates.
>
> 3\. **Specimen Maps** --- An interactive mapping platform that
> aggregates occurrence records from published literature, institutional
> sequencing databases, and GBIF into a single interface with taxonomic,
> phenotypic, and sequencing status filters, along with map and data
> export features.

All components use Vue.js for the web interface and Python for data
processing, hosted as static sites on GitHub Pages. The applications run
entirely in the browser with no dedicated servers. Website hosting is
free through GitHub; the only expense is cloud storage for specimen
photographs on Google Drive. Data processing pipelines run through
GitHub Actions, so team members can refresh the databases with a single
click. A detailed protocol for the complete photography-to-gallery
workflow is available separately ([will this be a protocols.io paper?
Why not make it part of this paper?]{.comment-start id="2"
author="Joana Meier" date="2026-03-01T17:33:11Z"}Chandi[]{.comment-end
id="2"} et al., in prep.).

# **2. Methods and Implementation**

## **2.1 System Architecture Overview**

The toolkit separates data processing from data display (Figure 1).
Processing runs in the cloud through GitHub Actions, and the resulting
files are served as a static website via GitHub Pages. This separation
keeps the website lightweight, lets team members refresh data with a
single click by re-running processing scripts, and eliminates hosting
costs beyond Google Drive storage for specimen photographs.

All three applications share a common technology stack: Vue.js 3 for the
web interface, Python with Pandas for data processing, GitHub Pages for
hosting, and GitHub Actions for one-click data update[all of these
require citations]{.comment-start id="3" author="Joana Meier"
date="2026-03-01T17:34:17Z"}s.[]{.comment-end id="3"}

## **2.2 AI Photo Processor**

Large-scale specimen photography generates thousands of image files with
generic camera-assigned filenames. For butterflies, specimen\'s wings
are typically photographed on both sides (dorsal and ventral), with a
handwritten identifier label placed alongside them. Manually reading
these identifiers and renaming each file is slow and error-prone,
especially when processing hundreds or thousands of images.

The AI Photo Processor ([I tried to download the Windows version and it
said \"not found\". There seems to be something wrong with the
link.]{.comment-start id="4" author="Joana Meier"
date="2026-03-01T17:39:02Z"}[You are right, I fixed, but I will release
a web version soon]{.comment-start id="5" author="Franz Chandi"
date="2026-03-18T23:51:25Z"}https://github.com/Fr4nzz/rename_photos_AI[[]{.comment-end
id="5"}]{.comment-end id="4"}) is a desktop application that automates
this task using Google\'s Gemini AI, a generative model that can
interpret images and read text within them. The application is available
both as Python source code and as a standalone Windows executable
requiring no installation.

The application guides the researcher through a straightforward
workflow. First, photographs are corrected for orientation and cropped
to isolate the label region, improving reading accuracy. The cropped
labels are then assembled into composite grids so that multiple images
can be read in a single AI request, processing up to 45 images per call.
Under the free API tier, this allows roughly 900 images per day at no
cost. The application sends each composite to the Gemini API with a
customizable text prompt that instructs the model to read the specimen
identifier from each cell. Because the prompt is editable, researchers
can adapt the tool to other use cases by describing what information the
AI should extract. A review interface then displays each photograph
alongside its AI-read identifier, flagging potential problems such as
unpaired images, duplicates, and empty results. Current AI models can
even interpret handwritten corrections where researchers have crossed
out mistakes, though errors still occur, and human validation ensures
accuracy before the final renaming. Accepted identifiers are used to
rename files with dorsal and ventral suffixes (e.g., CAM012345d.JPG,
CAM012345v.JPG), and all renames are logged and reversible.

## **2.3 Wings Gallery**

Once specimen photographs are renamed and organized, researchers need a
way to browse, filter, and share images without downloading entire
folder structures. The Wings Gallery
([[https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery]{.underline}](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery))
[so this is your own tool? If so, you should not mention it here or in
the Introduction.]{.comment-start id="6" author="Joana Meier"
date="2026-03-01T17:37:28Z"}replaces an earlier R-Shiny version that
faced the accessibility and performance limitations described in the
Introduction[]{.comment-end id="6"}. The Vue.js architecture provides
faster load times and full control over the user interface.

The Wings Gallery is deployed on GitHub Pages. Image files are uploaded
to shared folders on Google Drive, where a custom Google Apps Script
automatically indexes all files into a Google Sheets spreadsheet,
recording metadata such as filename, URL, capture date, size, and folder
path. The script handles thousands of files across nested folder
structures without manual intervention. A Python processing script then
downloads the spreadsheet data, prepares image URLs, and generates data
files for the website.

The application provides five views. The Collection tab filters
individuals by taxonomic level (Family, Subfamily, Tribe, Species,
Subspecies) and sex. The Insectary tab displays specimens from the
insectary collection, filtered by Insectary ID and biological metadata.
The CRISPR tab shows CRISPR-injected specimens, allowing filtering by
mutant phenotype. The Search tab enables fast lookup by specimen
identifier (here called CAMID). The Update DB tab allows any team member
to refresh the database with a single click, which triggers a GitHub
Actions workflow that re-indexes all images and redeploys the website.
No technical expertise is needed to keep the gallery up-to-date.

The gallery supports simultaneous zooming of all displayed images (via
Shift+scroll), which is particularly useful when researchers need to
inspect wing details across many individuals at once, for example, when
verifying that specimens of a small species were taxonomically correctly
identified. Individual images can also be zoomed independently with
Ctrl+scroll. As the researcher zooms in or out, the image grid adapts
the number of columns to make the best use of the available screen
space.

## **2.4 Photography to Gallery Workflow**

The three applications described above are connected by a step-by-step
workflow that takes specimens from the photography stage through to
online availability. We provide a detailed protocol as supplementary
material, but summarize the main steps here.

Wings are photographed with the camera mounted on an articulated arm,
using manual focus and a remote shutter to avoid vibration. Each
photograph includes the dorsal or ventral side of the wings, a color
reference palette, and an envelope with the specimen\'s handwritten
identifier (CAMID). Photos are organized into batch folders by date,
then processed through the AI Photo Processor: files are rotated to a
consistent orientation, the label region is cropped for the AI to read,
and Gemini processes up to 900 images per day under the free API tier.
After the researcher reviews and corrects the AI readings, files are
renamed with their CAMID and a dorsal/ventral suffix.

Renamed files are uploaded to a shared Google Drive account. A custom
Google Apps Script indexes all files, recording metadata such as
filename, direct URL, and capture date into a Google Sheets spreadsheet.
The Wings Gallery website reads this spreadsheet to display the
collection. Any team member can refresh the gallery by clicking an
\"Update database\" button, which triggers a GitHub Actions workflow
that re-indexes all images and redeploys the site. The complete
protocol, including camera setup details and step-by-step screenshots,
is available as Supplementary Material S1.

## **2.5 Specimen Maps**

Mapping specimen distributions from multiple data sources is a common
need in biodiversity research, but it comes with practical challenges:
different databases use different taxonomic names, data formats, and
quality standards, and researchers often need project-specific metadata
(such as sequencing status or phenotypic classifications) that
general-purpose platforms do not provide. Existing tools either require
GIS expertise (QGIS, ArcGIS) or substantial programming effort in R to
merge different datasets, curate taxonomic inconsistencies, and produce
publication-ready maps. Specimen Maps addresses this by providing a
web-based interface that integrates and cleans data from multiple
sources automatically.

For Ithomiini butterflies, a central question in Ithomiini research is
how mimicry ring distributions relate to geography, climate, and species
ranges. Answering this question requires mapping thousands of occurrence
records from sources that use different taxonomic names, different data
formats, and different quality standards. Researchers also need to
identify which species have been sequenced, where tissue samples are
available, and how these genomic resources overlap with known
distributions. Existing tools either require GIS expertise (QGIS,
ArcGIS) or substantial programming effort in R to merge different
datasets, curate taxonomic inconsistencies, and produce
publication-ready maps, a process that can take considerable time even
for experienced analysts. None of these general-purpose tools include
mimicry ring classifications such as those published by Dore et al.
(2023). Moreover, the platform provides access to specimen data that are
still being prepared for publication and may take years before they
become available through aggregators like GBIF, allowing researchers to
work with the most current information from ongoing projects.

**Data Sources and Processing Pipeline**

The Ithomiini Maps platform
([[https://rapidspeciation.github.io/ithomiini_maps/]{.underline}](https://rapidspeciation.github.io/ithomiini_maps/))
consolidates five data sources into a single interface:

**Dore et al. (2023) published records.** An Excel file containing
28,927 georeferenced occurrence records with full taxonomic
classification, mimicry ring assignments for males and females, and
observation metadata. This dataset provides the lookup table used to
assign mimicry ring data to records from other sources.

**Sanger Institute collection data.** A Google Sheets database
maintained by the sequencing team, updated periodically through a
password-protected trigger to prevent unauthorized refresh requests.
Each record includes specimen identifier (CAMID), taxonomic
classification, collection locality, GPS coordinates, sequencing status,
and links to wing photographs. Sequencing status is assigned based on
specimen metadata: specimens with valid tube rack entries are classified
as \"Sequenced,\" those with tissue samples as \"Tissue Available,\" and
the rest as \"Preserved Specimen.\" Because this dataset includes
specimens still being prepared for publication, the platform provides
early access to data that may take years to appear in public aggregators
like GBIF.

**GBIF occurrence data.** An automated download script queries the GBIF
API for all Ithomiini occurrences. Each download receives a unique DOI
from GBIF (current version: 10.15468/dl.pbs3eu); this DOI will change
when the database is refreshed with newer GBIF data. The script
pre-filters records before download to ensure data quality: it keeps
only records with valid geographic coordinates and confirmed presence,
excludes records flagged for geospatial issues, and removes fossils and
living specimens. It then automatically splits the downloaded records
into three sub-sources based on their origin: **iNaturalist**
(research-grade citizen science observations, 19,328 records), **GBIF
(UNAM)** (records from the Universidad Nacional Autonoma de Mexico
museum collections, a major Neotropical entomological collection, 21,586
records), and **GBIF (Other Institutions)** (records from all remaining
collections and datasets, 27,819 records)[It would be great to include
the data from Brown\'s thesis in collaboration with André
Freitas.]{.comment-start id="7" author="Joana Meier"
date="2026-03-01T17:44:37Z"}.[]{.comment-end id="7"} This roughly
balanced split allows researchers to toggle each sub-source
independently, enabling them to assess data origin and quality at a
glance. Each data source loads on demand when the researcher enables it,
reducing initial page load times and conserving bandwidth since the
combined dataset exceeds 88 MB.

**Data merging.** The processing pipeline loads all five sources,
standardizes field names, and applies consistent taxonomic formatting. A
mimicry ring lookup table built from the Dore et al. (2023) dataset
links each species-subspecies pair to its male and female mimicry ring
values. This lookup is then applied to Sanger Institute and GBIF
records, first trying an exact match on species and subspecies, then
falling back to a species-only match. This ensures mimicry ring data are
available even for records that lack subspecies identification.

**Taxonomic Curation**

Combining records from different sources requires resolving taxonomic
inconsistencies: synonyms, misspellings, and outdated names. The
curation pipeline processes each unique scientific name through multiple
steps. First, known misspellings and reclassifications are corrected
using a manually maintained corrections file. Second, names are checked
against the GBIF backbone taxonomy; exact matches are accepted and
synonyms are resolved to their currently accepted name. Third, names
that GBIF cannot resolve are checked against a reference taxonomy
compiled from Butterflies of America (Warren et al., 2023) and
nymphalidae.net. Fourth, a similar process handles subspecies names,
including edit-distance comparison to detect likely typographical
errors.

Each curated record includes a curation_basis field that documents how
the name was resolved (e.g., \"GBIF exact match,\" \"GBIF synonym,\"
\"Reference taxonomy\"), ensuring full traceability. Original names are
preserved alongside corrected versions, and researchers can review all
corrections in the data table. If corrections are confirmed as accurate,
researchers can update the original databases accordingly. The number of
corrections reported here may therefore decrease in future versions as
upstream sources incorporate these fixes.

**Web Interface**

The web interface uses Vue.js with MapLibre GL JS, a mapping library
optimized for rendering tens of thousands of points smoothly.
Researchers can choose from five base map styles (Dark, Light,
Satellite, Terrain, and Streets). At low zoom levels, nearby points are
grouped into clusters showing the number of records; clicking a cluster
expands it to reveal individual points colored according to the active
legend.

The sidebar organizes filters by category: cascading taxonomic filters
from Family to Subspecies with multi-select and fuzzy search, sequencing
status toggles, a mimicry ring selector displaying wing pattern icons
alongside ring names, a date range slider, CAMID search, sex filter, and
data source toggles for each of the five sources. All active filters are
encoded in the URL, so researchers can share exact search configurations
with colleagues by copying a link. Opening a shared URL restores the
complete filter state, map position, and zoom level.

Clicking a map point opens a popup showing specimen metadata, taxonomic
classification, sequencing status, and a wing photograph when available.
If no photograph exists for a specific individual, the system displays
one from another individual of the same species or subspecies as a
reference. A full-screen image gallery allows detailed examination with
zoom, pan, and keyboard navigation. A sortable, paginated data table
shows all records matching the current filters, with photo thumbnails
and adjustable column visibility.

The application exports the current map view as a high-resolution image
(PNG or JPG, up to 300 DPI) suitable for publications, with customizable
legend position, aspect ratio, and scale bar. For researchers who prefer
to work in R, it generates a complete R/ggplot2 package as a ZIP file
containing the filtered data as GeoJSON, map settings, legend
configuration, a basemap image, and a ready-to-run R script that
recreates the map as a vector graphic (PDF or SVG). The export panel
also provides CSV and GeoJSON downloads of the filtered dataset, along
with a formatted scientific citation that includes the Git commit hash
for precise reproducibility.

**Deployment**

The application deploys through GitHub Actions. Code changes trigger an
automated build-and-publish workflow. A separate workflow can be
triggered manually to refresh occurrence data, and team members can
choose which sources to update (GBIF, Sanger Institute, or both). Since
everything runs on GitHub\'s servers, no physical computer or paid
hosting is needed. The application is accessible at
[[https://rapidspeciation.github.io/ithomiini_maps/]{.underline}](https://rapidspeciation.github.io/ithomiini_maps/).

# **3. Results**

## **3.1 Data Summary**

The Ithomiini Maps platform integrates 104,382 occurrence records from
five data sources (Table 1). The largest contributors are the Doré et
al. (2023) published dataset (28,927 records), GBIF records from other
institutions (27,819), and the UNAM museum collections (21,586 records).
iNaturalist research-grade observations contribute 19,901 records, and
the Sanger Institute collection adds 7,265 specimens with sequencing
status data. The merged dataset spans 849 species, 1,380 subspecies, and
184 genera across 33 countries.

**Table 1.** Data sources integrated in Ithomiini Maps. GBIF data (DOI:
[[https://doi.org/10.15468/dl.pbs3eu]{.underline}](https://doi.org/10.15468/dl.pbs3eu))
were pre-filtered for valid coordinates, no geospatial issues, confirmed
presence, and excluding fossils and living specimens.

+--------------------+--------+--------+----------+--------+---------+
| > **Data Source**  | >      | >      | > **Subs | > **Ge | >       |
|                    |  **Rec |  **Spe | pecies** | nera** |  **Coun |
|                    | ords** | cies** |          |        | tries** |
+====================+========+========+==========+========+=========+
| > Doré et al.      | >      | > 387  | > 999    | > 48   | > 23    |
| > (2023)           | 28,927 |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+
| > Sanger Institute | >      | > 513  | > 597    | > 175  | > 8     |
|                    |  7,265 |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+
| > iNaturalist      | >      | > 252  | > 175    | > 41   | > 25    |
|                    | 19,901 |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+
| > GBIF (UNAM)      | >      | > 35   | > 25     | > 19   | > 1     |
|                    | 21,586 |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+
| > GBIF (Other      | >      | > 428  | > 469    | > 43   | > 32    |
| > Institutions)    | 28,182 |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+
| > **Total          | >      | > *    | > *      | > *    | >       |
| > (merged)**       |  **105 | *849** | *1,380** | *184** |  **33** |
|                    | ,861** |        |          |        |         |
+--------------------+--------+--------+----------+--------+---------+

The five most represented countries are Mexico (29,092 records), Ecuador
(18,361), Brazil (15,746), Colombia (10,099), and Peru (8,964), followed
by Costa Rica (8,383), Panama (3,538), Bolivia (2,522), and Venezuela
(1,937). The high number of Mexican records is driven primarily by the
UNAM museum collections.

## **3.2 Sequencing Status**

Of the 6,273 Sanger Institute specimens,[this cannot be true. I am not
sure where this information comes from. We have sequenced way
less.]{.comment-start id="8" author="Joana Meier"
date="2026-03-01T17:46:18Z"} 2,074 (33.1%) have been
sequenced[]{.comment-end id="8"}, 2,659 (42.4%) have tissue submitted to
the Tree of Life sequencing pipeline, 1,105 (17.6%) have tissue
available for future sequencing, and 435 (6.9%) are preserved specimens
waiting for tissue extraction. This breakdown is visible on the map
through dedicated toggle filters, allowing researchers to identify
geographic and taxonomic gaps in the sequencing effort.

## **3.3 Taxonomic Curation**

As of February 2026, the automated curation pipeline resolved the
taxonomy for all 104,382 records. Of the 797 species in the dataset,
most were resolved through the GBIF backbone taxonomy (621 species),
with the remainder resolved through the reference taxonomy compiled from
Butterflies of America and nymphalidae.net (121 species), live GBIF API
queries (51 species), or manual corrections. In total, the pipeline
actively corrected 69 species and 82 subspecies, affecting 2,398 records
(Table 2). The largest category was synonym resolution, where outdated
species names were mapped to their currently accepted names.
Typographical error detection identified misspelled subspecies names
through edit-distance comparison. Only 2 records remained unresolved.

**Table 2.** Taxonomic curation results. Curation basis indicates the
method used to resolve each record\'s taxonomy.

+--------------------------------+-----------+-----------+-------------+
| > **Curation Basis**           | > **      | > **Sub   | > **Records |
|                                | Species** | species** | >           |
|                                |           |           |  Affected** |
+================================+===========+===========+=============+
| > Synonym resolution           | > 52      | > 59      | > 2,142     |
+--------------------------------+-----------+-----------+-------------+
| > Typographical error          | > 16      | > 18      | > 202       |
| > detection                    |           |           |             |
+--------------------------------+-----------+-----------+-------------+
| > Subspecies synonym           | > 4       | > 4       | > 48        |
| > resolution                   |           |           |             |
+--------------------------------+-----------+-----------+-------------+
| > Literature-based correction  | > 3       | > 2       | > 6         |
+--------------------------------+-----------+-----------+-------------+
| > **Total unique corrected**   | > **69**  | > **82**  | > **2,398** |
+--------------------------------+-----------+-----------+-------------+

## **3.4 Mimicry Ring Coverage**

The mimicry ring lookup from Doré et al. (2023) contains 44 distinct
mimicry ring categories (Table S1). The most record-rich rings are
Agnosia (14,930 records across 83 species), Hermias (12,393 records, 50
species), Lerida (12,262 records, 65 species), and Mamercus (11,452
records, 58 species). These mimicry ring values were propagated to
Sanger Institute and GBIF records based on species and subspecies
matching, allowing researchers to filter and visualize mimicry ring
distributions across data sources.

## **3.5 Research Applications**

The integrated platform enables several lines of biological inquiry that
would be difficult to pursue with fragmented data.

By filtering the map to display a single mimicry ring, researchers can
visualize its geographic extent and identify regions where ring
membership changes. Filtering for the Lerida ring and toggling between
data sources, for example, reveals where published records, citizen
science observations, and sequenced specimens overlap or leave gaps.
Comparing two rings side by side shows where their ranges meet, a
pattern relevant to understanding how mimicry communities assemble
across environmental gradients.

The sequencing status filter helps researchers identify species or
geographic regions underrepresented in genomic datasets. A researcher
planning a collecting expedition to Peru, for instance, can filter by
\"Preserved Specimen\" and \"Tissue Available\" to see which localities
already have material, then identify nearby areas with occurrence
records but no sequenced specimens. This kind of targeted planning can
reduce redundant collecting and prioritize underrepresented regions[very
nice!]{.comment-start id="9" author="Joana Meier"
date="2026-03-01T17:48:00Z"}.[]{.comment-end id="9"}

The data table preserves both original and corrected taxonomic names, so
researchers can review automated curation decisions. If a name was
resolved as a synonym, the original name appears alongside the accepted
name, with the curation method documented. Geographic outliers, which
often signal misidentifications, become immediately visible on the map
and can be investigated by clicking individual points to inspect
specimen metadata and photographs.

Toggling data sources on and off reveals how institutional collections,
citizen science, and published datasets complement each other.
iNaturalist observations, for example, tend to concentrate along roads
and trails in accessible areas, while museum collections may include
records from remote localities visited during historical expeditions.
Visualizing these biases helps researchers assess where geographic
coverage is genuine and where it reflects sampling effort.

The date range filter lets researchers explore how recorded species
richness and abundance vary over time within a region. Comparing
pre-2000 and post-2010 records for a given area could reveal apparent
changes in species composition or range shifts. These patterns must be
interpreted with caution, since temporal variation in records often
reflects changes in sampling effort rather than true ecological change,
but they can generate hypotheses about range expansions, local
extinctions, or the effects of land-use change that merit further
investigation[also great points!]{.comment-start id="10"
author="Joana Meier" date="2026-03-01T17:48:51Z"}.[]{.comment-end
id="10"}

# **4. Discussion**

## **4.1 Comparison with Existing Tools**

Several tools exist for automated specimen label reading. The
biodiversity-aq/rename-photos-ocr package uses PaddleOCR to extract
printed text labels from specimen photographs, but does not handle
handwritten text, which is common in field collections. Giessen et al.
(2025) demonstrated a smartphone-based workflow using built-in OCR
features that avoids storing label images entirely. Our AI Photo
Processor differs from these approaches by using generative AI (Gemini)
rather than traditional OCR, which allows it to interpret handwritten
text and even read corrections where researchers have crossed out
mistakes. It also processes images in batch (up to 900 per day on the
free API tier) and includes a graphical review interface for validating
readings before renaming.

For specimen image management, existing solutions range from
institutional database systems like Earthcape
([[https://earthcape.com]{.underline}](https://earthcape.com)) to
general-purpose cloud storage. The Wings Gallery takes a lighter
approach: it uses Google Drive as the storage backend and a static
website as the viewer, so any research group can set it up with minimal
technical effort and little hosting costs

The Heliconius interactive maps (Rosser & Mallet, 2024) demonstrated the
value of open-source, GitHub-hosted mapping tools for Lepidoptera
research. Their platform, built with R and the Leaflet library,
generates static HTML maps for individual species and provides a
Shiny-based interactive viewer with taxonomic filtering and data table
export. The approach works well for displaying a curated dataset, but
faces constraints when scaling to larger, multi-source datasets: the
Shiny app requires a running R server (unlike a fully static site),
filter changes can be slow with larger datasets, and the interface is
limited to what R-Shiny allows. Our toolkit extends this approach in
several directions. We address the earlier specimen digitization
workflow (photography, AI-assisted cataloguing, image hosting), which
the Heliconius platform does not cover. We consolidate five data sources
totaling over 100,000 records with automated taxonomic curation, rather
than relying on a single pre-curated dataset. We add sequencing status
filters and mimicry ring selectors designed for ongoing genomic
projects, enabling strategic planning of which taxa to sequence next.
And we provide high-resolution map image export (up to 300 DPI), R
script export for vector graphics, and automatic citation generation
with version tracking, features not available in the Heliconius
platform.

General-purpose platforms like GBIF and iNaturalist provide occurrence
visualization but lack project-specific metadata such as sequencing
status or mimicry ring classifications. Additionally, GBIF by default
includes records with coordinate issues, absent records, and other
quality problems that require manual filtering. Specialized tools like
Map of Life (Jetz et al., 2012) offer range maps but not the
specimen-level detail needed for genomic research planning. Our toolkit
fills the gap between these general platforms and the project-specific
needs of evolutionary biology research groups.

## **4.2 AI-Assisted Specimen Photograph Renaming**

[this is all nice but feels a bit repetitive. It has all already been
written above.]{.comment-start id="11" author="Joana Meier"
date="2026-03-01T17:51:12Z"}The AI Photo Processor applies generative AI
to a practical bottleneck in biodiversity research: reading handwritten
specimen labels from photographs. Traditional text recognition struggles
with handwriting, but generative AI models can interpret identifiers
within their visual context without needing to isolate the text first.
These models can even read labels where researchers have crossed out
mistakes and corrected them, a common occurrence in handwritten specimen
records. Since errors still occur, the application includes a human
validation step where researchers review and correct the AI\'s readings
before files are renamed. This step is still substantially faster than
reading and typing each identifier manually.

The grid-based approach combines multiple images into a single composite
before sending to the AI, making practical use of each API request.
Processing 45 images per request under the free tier means a single
day\'s quota handles roughly 900 images at no cost. Because the prompt
is customizable, this approach extends beyond entomological collections
to any specimen-based research that uses handwritten
labels.[]{.comment-end id="11"}

## **4.3 Sustainability and Reproducibility**

Server-based research software commonly breaks when cloud credits
expire, servers go unmaintained, or frameworks become outdated. By
running entirely in the browser and hosting files on GitHub Pages, this
toolkit avoids these failure modes. As long as GitHub Pages remains
available, which its widespread adoption in both industry and academia
makes likely, the applications will stay online without maintenance
costs.

The Git commit hash included in auto-generated citations allows exact
identification of the data version used in any analysis. While the live
website always serves the latest version, the complete source code and
data are versioned in Git, so a researcher could clone the repository
and check out the exact commit cited in a previous study to reproduce
the application state at that point in time. Filter states encoded in
URLs serve as shareable records of search configurations. Exported
datasets include all metadata needed to reproduce the filtering
criteria. The R export package lets researchers reproduce and customize
maps entirely within their local R environment.

Beyond reproducibility, the open-source codebase is designed to be
replicable. Research groups working on other taxonomic groups or even
non-biological datasets (e.g., geological or archaeological specimen
collections) could adapt the data processing pipelines and web interface
to their own data by replacing the taxonomic reference files and data
sources. The modular separation between data processing and
visualization means that adapting the platform to a new taxon primarily
requires configuring the data pipeline, without rewriting the web
application.

## **4.4 Limitations and Future Directions**

While the automated taxonomic pipeline resolves many naming
inconsistencies, it may still miss recently described taxa or contested
synonymes. The data table shows both original and corrected names for
researcher review, and a manually maintained corrections file allows
case-by-case overrides. As taxonomic databases continue to be updated,
the pipeline\'s accuracy will improve.

Several ecological layers could enrich the platform in the future.
Predictive habitat suitability models (e.g., MaxEnt) could be computed
through GitHub Actions and displayed as map overlays, allowing
comparison between observed occurrences and modeled suitable habitat.
Overlaying the geographic distribution of known Ithomiini host plants
(primarily Solanaceae) would let researchers explore whether butterfly
distributions track host plant availability, and identify regions where
host plants are present but butterfly records are absent. Integrating
historical climate variables (e.g., ERA5-Land reanalysis data) would
help researchers examine how climatic conditions relate to species
ranges and mimicry ring boundaries over time[another approach would be
ecological distribution modeling to not just visualise where specimens
have been found but also where they are likely to occur due to
conditions that are suitable to them.\
It would also be good to include other genomic information of species
from GoaT (Genomes on a Tree), e.g. containing information on the number
of chromosomes, genome size, if a reference genome is available,
etc.]{.comment-start id="12" author="Joana Meier"
date="2026-03-01T17:58:45Z"}.[]{.comment-end id="12"}

[This is already written above and can thus be removed
here.]{.comment-start id="13" author="Joana Meier"
date="2026-03-01T17:59:20Z"}As described in Section 4.3, the modular
architecture means the platform could be adapted to other Lepidoptera,
other organism groups, or even non-biological specimen collections,
following the open-source spirit encouraged by Rosser & Mallet
(2024).[]{.comment-end id="13"}

# **5. Conclusions**

We have presented an integrated open-source toolkit that covers the
complete specimen-to-map pipeline for Ithomiini butterfly research. The
AI Photo Processor automates the time-consuming task of reading
handwritten specimen identifiers using AI, with a customizable prompt
system that makes it adaptable to other research contexts. The Wings
Gallery provides a centralized, filterable image browser with zero
server costs and one-click updates. Ithomiini Maps integrates diverse
occurrence data sources into an interactive mapping platform with
taxonomic filters, mimicry ring selectors, sequencing status indicators,
and both image and R script export for publications. Together, these
tools show that modern web technologies and AI services can greatly
improve the efficiency and accessibility of biodiversity research tools,
while maintaining long-term sustainability through a fully serverless
approach.

All source code is freely available. The AI Photo Processor can be found
at
[[https://github.com/Fr4nzz/rename_photos_AI]{.underline}](https://github.com/Fr4nzz/rename_photos_AI),
the Wings Gallery at
[[https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery]{.underline}](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery),
and Specimen Maps at
[[https://github.com/rapidspeciation/ithomiini_maps]{.underline}](https://github.com/rapidspeciation/ithomiini_maps).

# **6. Data Availability Statement**

[here you should only describe data that was produced by us. Doré et al
was already cited above and GBIF as well. That should be part of methods
not the data availability statement.]{.comment-start id="14"
author="Joana Meier" date="2026-03-01T18:00:46Z"}The[]{.comment-end
id="14"} Sanger Institute collection data shown in Specimen Maps is
available upon request from the corresponding research group. All source
code, processed data files, and the data processing pipeline are
available in the GitHub repositories listed above. Version-specific data
can be retrieved using the Git commit hashes included in the
application\'s citation system.

# **7. Acknowledgments**

We thank Neil Rosser and James Mallet for developing the *Heliconius*
maps platform, which inspired the design of Ithomiini Maps. We
acknowledge the Global Biodiversity Information Facility (GBIF) and its
data publishers for providing open occurrence data. We acknowledge the
use of AI coding assistants during software development, including
OpenAI GPT models, Google Gemini, and Anthropic Claude. \[Additional
acknowledgments to be added.\]

# **References**

> Chazot, N., Willmott, K.R., Condamine, F.L., De-Silva, D.L., Freitas,
> A.V., Lamas, G., Morlon, H., Giraldo, C.E., Jiggins, C.D., Joron, M.,
> Mallet, J., Uribe, S. & Elias, M. (2019). Into the Andes: multiple
> independent colonizations drive montane diversity in the Neotropical
> clearwing butterflies Godyridina. Molecular Ecology, 28(10),
> 2423--2438.
>
> Dore, M., Willmott, K., Lavergne, S., Chazot, N., Freitas, A.V.L.,
> Fontaine, C. & Elias, M. (2023). Mutualistic interactions shape global
> spatial congruence and climatic niche evolution in Neotropical mimetic
> butterflies. Ecology Letters, 26(6), 843--857.
> [[https://doi.org/10.1111/ele.14198]{.underline}](https://doi.org/10.1111/ele.14198)
>
> Elias, M., Gompert, Z., Jiggins, C. & Willmott, K. (2008). Mutualistic
> interactions drive ecological niche convergence in a diverse butterfly
> community. PLoS Biology, 6(12), e300.
>
> Jetz, W., McPherson, J.M. & Guralnick, R.P. (2012). Integrating
> biodiversity distribution knowledge: toward a global map of life.
> Trends in Ecology & Evolution, 27(3), 151--159.
>
> Jiggins, C.D. (2017). The Ecology and Evolution of Heliconius
> Butterflies. Oxford University Press.
>
> Rosser, N. & Mallet, J. (2024). Interactive maps for visualizing
> geographic distributions and phenotypes. Tropical Lepidoptera
> Research, 34(1), 26--30.
>
> Warren, A.D., Davis, K.J., Stangeland, E.M., Pelham, J.P., Willmott,
> K.R. & Grishin, N.V. (2023). Illustrated Lists of American
> Butterflies. Butterflies of America Foundation.
> https://www.butterfliesofamerica.com
>
> Willmott, K.R. & Freitas, A.V.L. (2006). Higher-level phylogeny of the
> Ithomiinae (Lepidoptera: Nymphalidae): classification, patterns of
> larval host plant colonization and diversification. Cladistics, 22(4),
> 297--368.
