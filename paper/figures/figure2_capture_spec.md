# Figure 2: required authentic interface captures

Status: not produced in Phase 3B. Retain the scientifically final manuscript caption. No mock interface, specimen photograph, candidate score or map layer has been substituted.

## Capture requirements shared by all panels

Use the current public applications in a normal browser. Capture at 1440 × 1000 CSS pixels or larger, with a device-pixel ratio of 2 where available. Save unmodified lossless PNG originals before assembling the panels. Use one consistent font scale. Keep controls needed to interpret the panel, source labels, legends and required map attribution. Close developer tools, About/benchmark sections, update controls and unrelated browser panels. Hide credentials, API keys, tokens, internal Drive identifiers and unrelated or sensitive specimen information. Select a specimen whose displayed locality may be published.

For each panel, record the application, exact URL including filter parameters, capture timestamp with timezone, displayed taxon and CAMID where applicable, active filters/layers, and source revision. Identify the deployed revision from its release/deployment record where possible. Do not equate a current repository head with the deployed revision without evidence. Record the inference-service/model receipt separately if exposed, otherwise mark it unavailable. Keep the manuscript's May occurrence, April SDM and September classifier releases unchanged. A later interface capture illustrates access, not a new result population.

For every photograph, record its original filename or asset URL, actual specimen identity, photographer/rights holder, publication permission or applicable licence, required credit and whether it is a reference image. Public display alone does not establish permission to reproduce a specimen photograph in a journal. Use an authorised project specimen or an explicit reusable demonstration image. Do not select a third-party reference photograph solely because it is visible in the Gallery.

## Panel a: specimen-linked dorsal and ventral views

Page: <https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/>.

Select **Collection**, clear unrelated filters, and search one author-authorised CAMID with verified dorsal and ventral photographs. Set the taxonomic filter to that specimen's species if needed. Display both surfaces at comparable scale, their side labels and the common CAMID, with enough Gallery controls to establish the collection view. Do not turn a duplicated single-view fallback into a pair. Record the selected CAMID and species in the panel metadata. A particular specimen is deliberately not prescribed without access and image-rights confirmation.

## Panel b: actual single-photo candidate output

Page: <https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/ai_identifier>.

Upload one authorised photograph, preferably one view of the specimen in panel a. Use the normal single-photo workflow, not a paired prediction file. Set country and side-of-Andes context to **Any** or their unset equivalents and leave inferred geographic context off, so the demonstration has no added locality prior. Run inference and wait for its actual response. Show the uploaded photograph, candidate taxonomic names and their displayed model scores, with the input/output interface context. Use the species-level candidate display where available. Preserve the returned ordering and score labels. Record the chosen image, filters and response time.

Do not expose the paired-collection About table, 91.33% benchmark, or collection sex-prediction results next to this upload. Do not fill an empty or failed response with examples. If inference is unavailable, retain this panel as pending rather than displaying invented output.

## Panel c: occurrence source and specimen identity

Page: <https://rapidspeciation.github.io/ithomiini_maps/>.

Use occurrence-point mode. Set source to **Sanger Institute collection** and search the panel-a CAMID when that specimen is mapped and its locality is cleared for publication. Otherwise choose another documented, authorised specimen and identify it explicitly in the metadata. Turn heatmaps, SDMs and host-plant occurrences off. Open the selected point's information panel. Retain the source identity, CAMID, taxon and specimen information, plus the linked photograph when it actually depicts that individual.

If the app substitutes another individual's reference image, retain the app's reference label and add an explicit panel/caption statement: 'Reference image of another individual'. Do not present it as a photograph of the mapped specimen. Do not alter the point's identity or source to fit an available photograph.

## Panel d: accessible-area core and extrapolated extension

Page: <https://rapidspeciation.github.io/ithomiini_maps/>.

Clear the CAMID filter. Select one butterfly species with both accessible-area core and extension products in the complete 28 April 2026 release. Prefer the panel-a species only when both products are available. Record the actual species selected. Leave all relevant butterfly occurrence sources enabled and use occurrence-point mode, with heatmaps and host-plant layers off.

Activate the SDM accessible-area/core product and its extrapolated extension, with distinguishable styling and visible layer legends. Use a map extent that shows observed points inside the core and part of the extension. If the interface permits only one product at a time, make two authentic captures at identical extent, zoom and opacity and assemble them as subviews within panel d, explicitly labelled 'Accessible-area core' and 'Extrapolated extension'. Preserve the suitability legend and observed-point symbols. Label the raster as relative habitat suitability, not occurrence probability. Hide unrelated diagnostics and unreconciled aggregate counts.

Host-plant occurrences are optional and are best omitted for this figure. If included, retain a separate plant-occurrence symbol and legend and identify them as independent botanical records, not local butterfly-host observations or SDM predictions.

## Assembly and acceptance

Use panel labels a–d and the existing Figure 2 caption. Store originals under `paper/figures/figure2_sources/`, a provenance JSON/CSV beside them, and the assembled figure at `paper/figures/figure2_interfaces.png` with an editable layout source where practical. Add its Markdown image reference immediately before the existing caption. Match panel contents to that caption and document capture dates/revisions in the caption or accompanying provenance. Do not place commit hashes over specimen details. Check all panel text at the intended journal width, image rights, colour/shape distinctions, map attribution and the absence of an upload-accuracy claim before treating Figure 2 as complete.

Phase 3B access evidence: the web fetcher returned DisabledError for all three public routes, and Chromium navigation returned net::ERR_BLOCKED_BY_ADMINISTRATOR for each. These are restrictions in the validation environment, not evidence that the public applications are down. A targeted repository screenshot search and the Gallery README did not establish a publication-ready, authorised four-panel set. No live inference response or specimen-image licence was fabricated.
