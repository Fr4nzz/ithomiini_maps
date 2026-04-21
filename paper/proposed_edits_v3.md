# Proposed Edits v3: Species Distribution Modelling (April 2026)

These edits describe the Species Distribution Modelling (SDM) pipeline
that has been added since v2. The SDM work directly addresses Joana's
comment id="12" on Section 4.4, which suggested moving beyond showing
where specimens have been found to predicting where species are likely
to occur. An associated feature was the per-species parameter tuning
that noticeably improved model quality for species that were previously
modelled poorly.

Statistics reported below come from the current production run of 151
species (`public/data/sdm/sdm_metadata.json` at commit `77f3724`) and
the tuning outputs (`sdm/species_overrides.json` at commit `d76c790`).

---

## 1. Methods: add a new subsection inside 2.5 "Specimen Maps"

Place this new bolded subsection **after "Taxonomic Curation" and
before "Web Interface"** in Section 2.5, so it reads as part of the
Specimen Maps pipeline.

### Edit 1a: New subsection "Species Distribution Modelling"

> **Species Distribution Modelling**
>
> Beyond mapping recorded occurrences, the platform includes habitat
> suitability predictions that estimate where each species is likely to
> occur based on environmental conditions at its known locations. The
> modelling pipeline processes every species with at least 20 records
> after spatial thinning, and outputs a raster of predicted suitability
> that researchers can overlay on the occurrence map.
>
> Environmental predictors combine nine bioclimatic variables from
> CHELSA v2.1 (Karger et al., 2017) with elevation (WorldClim) and
> monthly cloud cover (Wilson & Jetz, 2016), all at approximately 1 km
> resolution across the Neotropics. For each species, occurrence records
> from all five data sources are pooled, deduplicated, and spatially
> thinned to a minimum distance of 5 km (Aiello-Lammens et al., 2015)
> to reduce sampling bias.
>
> Because our data are presence-only, the model cannot contrast
> presences against confirmed absences. Instead, it contrasts the
> environments at presence locations against the environments in a
> reference sample of points drawn from the region the species could
> plausibly reach, known as its accessible area (Barve et al., 2011).
> We approximate this area as a buffered convex hull around each
> species' records. These reference points, commonly called background
> points, should not be interpreted as absences: the species may in
> fact occur at a background location that has simply never been
> sampled. Rather, they describe the range of environmental conditions
> available within reach of the species, and the model asks whether
> the environments at presence locations occupy a narrower or
> distinctive subset of that broader range.
>
> An uneven sampling effort complicates this comparison. If researchers
> have concentrated their collecting near field stations and roads,
> the presence points will cluster in those areas. A uniformly drawn
> background would then include many remote unsampled pixels that look
> environmentally different from the presences not because the species
> avoids them but because no one has been there to check. To correct
> for this, we weight background sampling by the density of all
> Ithomiini records combined, not only those of the focal species,
> following the target-group approach of Phillips et al. (2009). Areas
> where many Ithomiini species have been recorded are therefore more
> represented in the background, and areas never visited by collectors
> are underrepresented in the background in the same way they are
> underrepresented among the presences. Presence and background now
> share the same spatial footprint of sampling effort, and the
> remaining contrast the model learns reflects environmental preference
> rather than where researchers have tended to work.
>
> The algorithm used depends on sample size, following
> recommendations from Wisz et al. (2008). Species with 20–49 records
> are modelled with MaxEnt alone (Phillips et al., 2017) via the
> `elapid` Python package (Christensen, 2022), which is more stable
> on small samples than tree-based methods. Species with 50 or more
> records use an AUC-weighted ensemble of MaxEnt, Random Forest, and
> gradient-boosted trees (XGBoost), following the benchmark of Valavi
> et al. (2021). All models are evaluated with spatial-block
> cross-validation (Roberts et al., 2017) so that training and test
> points are geographically separated, with leave-one-out cross-validation
> used for species below 30 records (Pearson et al., 2007). Each model
> reports the area under the ROC curve (AUC) and the continuous Boyce
> index (Hirzel et al., 2006), a calibration measure that asks whether
> areas predicted as highly suitable actually contain a higher density
> of observations.
>
> For species that still performed poorly after the default run (Boyce
> below 0.3), the pipeline runs an automated grid search over MaxEnt
> regularization multipliers (0.5 to 4.0) and feature classes (linear,
> quadratic, hinge, product), following the ENMeval framework (Kass et
> al., 2021). For each species, the configuration with the highest
> cross-validated Boyce is saved to a per-species overrides file, which
> the main pipeline consults on re-run and applies in place of the tier
> defaults. Fitting all models across the 151 species takes
> approximately three hours of compute, which exceeds the time limit
> per job on GitHub Actions, so the modelling and tuning steps are run
> locally on a workstation and only the resulting raster and metadata
> outputs are committed to the repository for the web application to
> serve. Full methodology is documented separately in
> `sdm/SDM_METHODS.md`.

### Edit 1b: extend the Web Interface paragraph

**In Section 2.5, "Web Interface" subsection**, the sentence that begins
"The sidebar organizes filters by category" lists the filter categories.
Add a Species Distribution Modelling entry to reflect the new tile:

**Replace:**

> sequencing status toggles, a mimicry ring selector displaying wing
> pattern icons alongside ring names, a date range slider, CAMID search,
> sex filter, and data source toggles for each of the five sources.

**With:**

> sequencing status toggles, a mimicry ring selector displaying wing
> pattern icons alongside ring names, a date range slider, CAMID search,
> sex filter, data source toggles for each of the five sources, and a
> Species Distribution Modelling selector that overlays the predicted
> suitability raster for up to two species at once with adjustable
> opacity, alongside model diagnostics (AUC, Boyce index, sample size,
> confidence tier) and partial-response curves for the most influential
> environmental variables.

---

## 2. Results: add a new subsection 3.6

Add this subsection **after Section 3.5 "Research Applications"** and
before Section 4. Numbering can be adjusted if Section 3.5 stays as the
closing one; alternatively this could become Section 3.6 and the
existing 3.5 can retain its closing-section feel.

### Edit 2a: New Section 3.6 "Species Distribution Models"

> ## **3.6 Species Distribution Models**
>
> The modelling pipeline produced suitability rasters for 151 species
> with at least 20 thinned records, covering all tiers of the
> sample-size hierarchy: 69 species in the small tier (20–49 records,
> MaxEnt only), 36 in the medium tier (50–99 records), and 46 in the
> large tier (100 or more records). Median sample size across modelled
> species was 57 records, ranging from 20 to 1,295.
>
> Across all 151 species the mean Boyce index was 0.58 (median 0.60)
> and mean AUC 0.73. Of the 151 models, 143 (95%) had positive Boyce,
> 128 (85%) reached the 0.3 threshold conventionally used to flag models
> as predictively useful (Hirzel et al., 2006), and 92 (61%) reached
> 0.5. Before the tuning step, 37 species fell below the 0.3 threshold
> and were flagged for per-species grid search.
>
> The grid search improved 35 of these 37 species and regressed two by
> less than 0.06 Boyce, which is within the run-to-run variability of
> spatial-block cross-validation at sample sizes below 200 reported by
> Santini et al. (2021). Twenty-seven species improved by more than 0.3
> Boyce, and fifteen species moved from a negative baseline (predictions
> anti-correlated with occurrences) to a positive tuned Boyce. The
> largest improvements came from species whose tier defaults happened
> to be a poor fit: *Oleria aquata* moved from −0.64 to +0.90, *Episcada
> salvinia* from −0.33 to +0.90, and *Hyposcada illinissa* from −0.51 to
> +0.20. For *Mechanitis messenoides*, a widespread Neotropical species
> that was previously at Boyce 0.16, the best configuration (RM = 3.0,
> linear features only) raised the cross-validated Boyce to 0.47,
> moving the model from "poor" into the range conventionally considered
> useful. Only one species (*Ithomia heraldica*) remained at Boyce
> below −0.5 after tuning and appears to be genuinely difficult to
> model with the current data, likely reflecting either a widespread,
> climatically diffuse niche (Adelino et al., 2020) or sampling issues
> that parameter tuning cannot fix.
>
> The tuning outputs are stored as a per-species overrides file
> (`sdm/species_overrides.json`) that the main pipeline reads on
> subsequent runs, so researchers benefit from the tuning without
> having to re-run the grid search each time the occurrence data are
> refreshed.

---

## 3. Discussion: update 4.1 and 4.4

### Edit 3a: Update Section 4.1 "Comparison with Existing Tools"

In the paragraph that lists features not available in the Heliconius
platform (ending "…features not available in the Heliconius platform."),
add a sentence to acknowledge the SDM addition:

**Replace:**

> And we provide high-resolution map image export (up to 300 DPI), R
> script export for vector graphics, and automatic citation generation
> with version tracking, features not available in the Heliconius
> platform.

**With:**

> We provide high-resolution map image export (up to 300 DPI), R script
> export for vector graphics, and automatic citation generation with
> version tracking. We also integrate species distribution models
> directly into the interface, letting researchers overlay predicted
> suitability rasters alongside observed occurrences rather than treating
> the two as separate analyses. None of these features are available in
> the Heliconius platform.

### Edit 3b: Rewrite the SDM paragraph in Section 4.4 "Limitations and Future Directions"

The existing paragraph describes SDM as a future direction. Since
it is now implemented, it should be reframed as a limitation paragraph
that sets expectations about model reliability, and the future-directions
paragraph that follows should drop the SDM sentence.

**Replace the paragraph that begins "Several ecological layers could
enrich the platform in the future. Predictive habitat suitability
models (e.g., MaxEnt) could be computed through GitHub Actions..."
with two paragraphs:**

> The distribution models inherit the limitations of presence-only
> modelling. Because records are pooled from multiple sources with
> uneven spatial coverage, the bias-corrected background and 5 km
> thinning reduce but do not remove sampling bias, and predictions
> should be interpreted as relative habitat suitability rather than
> true probability of occurrence. For widespread generalists, models
> commonly show weaker predictive skill regardless of tuning, reflecting
> genuinely diffuse environmental signal rather than a pipeline defect
> (Adelino et al., 2020; Santini et al., 2021). Model diagnostics (AUC,
> Boyce, confidence tier) are shown in the sidebar next to each overlay
> so researchers can weigh individual predictions accordingly. A small
> number of species remain poorly modelled even after parameter tuning,
> and these are flagged in the interface with a low-confidence badge.
>
> Several additional layers could enrich the platform. Overlaying the
> geographic distribution of known Ithomiini host plants (primarily
> Solanaceae) would let researchers explore whether butterfly
> distributions track host plant availability and identify regions
> where host plants are present but butterfly records are absent.
> Integrating historical climate variables (e.g., ERA5-Land reanalysis
> data) would help researchers examine how climatic conditions relate
> to species ranges and mimicry ring boundaries over time. Extending
> the modelling pipeline from current-day suitability to projected
> suitability under future climate scenarios would support questions
> about range shifts.

(This also naturally addresses Joana's comment id="12": the old
paragraph that she annotated with "another approach would be ecological
distribution modeling..." is the one being replaced. The GoaT portion
of her comment is already handled by Edit 1a–1e in v2.)

### Edit 3c: Remove redundant replicability paragraph

The last paragraph of 4.4 currently repeats Section 4.3 and is flagged
by Joana's comment id="13". It can be deleted entirely, or replaced with
a one-sentence pointer:

**Replace** the paragraph beginning "As described in Section 4.3, the
modular architecture means the platform could be adapted to other
Lepidoptera…"

**With:** (delete entirely, per Joana's comment id="13")

---

## 4. Conclusions: mention SDM in Section 5

### Edit 4a: Extend the Ithomiini Maps sentence in Section 5

**Replace:**

> Ithomiini Maps integrates diverse occurrence data sources into an
> interactive mapping platform with taxonomic filters, mimicry ring
> selectors, sequencing status indicators, genomic metadata from GoaT
> (chromosome numbers, genome sizes, assembly availability), and both
> image and R script export for publications.

**With:**

> Ithomiini Maps integrates diverse occurrence data sources into an
> interactive mapping platform with taxonomic filters, mimicry ring
> selectors, sequencing status indicators, genomic metadata from GoaT
> (chromosome numbers, genome sizes, assembly availability), species
> distribution models with automatically tuned parameters for
> weak-performing species, and both image and R script export for
> publications.

---

## 5. Abstract: one-line addition

### Edit 5a: Mention SDM in the Abstract

The Abstract currently ends the Ithomiini Maps description at "into a
single filterable map interface." Consider inserting a brief mention of
the SDM overlay so readers know the platform does more than visualise
records.

**Replace:**

> Ithomiini Maps integrates occurrence records from published datasets,
> institutional sequencing databases, and the Global Biodiversity
> Information Facility (GBIF) into a single filterable map interface.

**With:**

> Ithomiini Maps integrates occurrence records from published datasets,
> institutional sequencing databases, and the Global Biodiversity
> Information Facility (GBIF) into a single filterable map interface,
> and overlays predicted habitat suitability from automatically tuned
> species distribution models on top of the observed occurrences.

---

## 6. New citations to add to the References section

These references are needed by the Methods and Results edits. Entries
in GBIF, Wilson & Jetz, and Jetz are already present in the manuscript
and should not be duplicated.

### Edit 6a: New references (alphabetical order, formatted to match existing style)

> Adelino, J.R.P., Heming, N.M., Boria, R.A., Borges, R.C., Mariano,
> E.F. & Gonçalves-Souza, T. (2020). Deciphering ecology from
> statistical artefacts: Competing influence of sample size, prevalence
> and habitat specialization on species distribution models. *Diversity
> and Distributions*, 26(3), 336–349.
> https://doi.org/10.1111/ddi.13030
>
> Aiello-Lammens, M.E., Boria, R.A., Radosavljevic, A., Vilela, B. &
> Anderson, R.P. (2015). spThin: an R package for spatial thinning of
> species occurrence records for use in ecological niche models.
> *Ecography*, 38(5), 541–545. https://doi.org/10.1111/ecog.01132
>
> Barve, N., Barve, V., Jiménez-Valverde, A., Lira-Noriega, A., Maher,
> S.P., Peterson, A.T., Soberón, J. & Villalobos, F. (2011). The crucial
> role of the accessible area in ecological niche modeling and species
> distribution modeling. *Ecological Modelling*, 222(11), 1810–1819.
> https://doi.org/10.1016/j.ecolmodel.2011.02.011
>
> Christensen, A. (2022). elapid: Species distribution modeling tools
> for Python. *Journal of Open Source Software*, 7(80), 4930.
> https://doi.org/10.21105/joss.04930
>
> Hirzel, A.H., Le Lay, G., Helfer, V., Randin, C. & Guisan, A. (2006).
> Evaluating the ability of habitat suitability models to predict
> species presences. *Ecological Modelling*, 199(2), 142–152.
> https://doi.org/10.1016/j.ecolmodel.2006.05.017
>
> Karger, D.N., Conrad, O., Böhner, J., Kawohl, T., Kreft, H.,
> Soria-Auza, R.W., Zimmermann, N.E., Linder, H.P. & Kessler, M. (2017).
> Climatologies at high resolution for the earth's land surface areas.
> *Scientific Data*, 4, 170122. https://doi.org/10.1038/sdata.2017.122
>
> Kass, J.M., Muscarella, R., Galante, P.J., Bohl, C.L.,
> Pinilla-Buitrago, G.E., Boria, R.A., Soley-Guardia, M. & Anderson, R.P.
> (2021). ENMeval 2.0: redesigned for customizable and reproducible
> modeling of species' niches and distributions. *Methods in Ecology and
> Evolution*, 12(9), 1602–1608.
> https://doi.org/10.1111/2041-210X.13628
>
> Pearson, R.G., Raxworthy, C.J., Nakamura, M. & Peterson, A.T. (2007).
> Predicting species distributions from small numbers of occurrence
> records: a test case using cryptic geckos in Madagascar. *Journal of
> Biogeography*, 34(1), 102–117.
> https://doi.org/10.1111/j.1365-2699.2006.01594.x
>
> Phillips, S.J., Anderson, R.P., Dudík, M., Schapire, R.E. & Blair,
> M.E. (2017). Opening the black box: an open-source release of Maxent.
> *Ecography*, 40(7), 887–893. https://doi.org/10.1111/ecog.03049
>
> Phillips, S.J., Dudík, M., Elith, J., Graham, C.H., Lehmann, A.,
> Leathwick, J. & Ferrier, S. (2009). Sample selection bias and
> presence-only distribution models: implications for background and
> pseudo-absence data. *Ecological Applications*, 19(1), 181–197.
> https://doi.org/10.1890/07-2153.1
>
> Roberts, D.R., Bahn, V., Ciuti, S., Boyce, M.S., Elith, J.,
> Guillera-Arroita, G., Hauenstein, S., Lahoz-Monfort, J.J., Schröder,
> B., Thuiller, W., Warton, D.I., Wintle, B.A., Hartig, F. & Dormann,
> C.F. (2017). Cross-validation strategies for data with temporal,
> spatial, hierarchical, or phylogenetic structure. *Ecography*, 40(8),
> 913–929. https://doi.org/10.1111/ecog.02881
>
> Santini, L., Benítez-López, A., Maiorano, L., Čengić, M. & Huijbregts,
> M.A.J. (2021). Assessing the reliability of species distribution
> projections in climate change research. *Diversity and Distributions*,
> 27(2), 207–216. https://doi.org/10.1111/ddi.13211
>
> Valavi, R., Guillera-Arroita, G., Lahoz-Monfort, J.J. & Elith, J.
> (2021). Predictive performance of presence-only species distribution
> models: a benchmark study with reproducible code. *Ecological
> Monographs*, 92(1), e1486. https://doi.org/10.1002/ecm.1486
>
> Wisz, M.S., Hijmans, R.J., Li, J., Peterson, A.T., Graham, C.H.,
> Guisan, A. & NCEAS Predicting Species Distributions Working Group
> (2008). Effects of sample size on the performance of species
> distribution models. *Diversity and Distributions*, 14(5), 763–773.
> https://doi.org/10.1111/j.1472-4642.2008.00482.x

---

## Summary of Priority

1. **New "Species Distribution Modelling" subsection inside 2.5**
   (Edit 1a): biggest substantive addition; describes the full
   pipeline and answers reviewers who want to know the modelling
   choices. If we prefer a full top-level section rather than a
   bolded subsection, it can be promoted to 2.6 without changing the
   text.
2. **New Results subsection 3.6** (Edit 2a): reports outcomes with
   numbers, including the tuning improvements.
3. **Discussion updates** (Edits 3a to 3c): rewrite 4.4 SDM paragraph
   from future-tense to implemented, add limitations, remove the
   redundant replicability paragraph flagged by Joana (id="13").
4. **Web Interface + Conclusions + Abstract** (Edits 1b, 4a, 5a):
   short additions so the SDM feature is mentioned everywhere it
   logically belongs.
5. **Reference additions** (Edit 6a): needed by Methods and Results
   edits, ~14 new entries.

All SDM statistics quoted above come from the production run committed
at `77f3724` (Fr4nzz/main) and the tuning outputs committed at
`d76c790`. If the pipeline is re-run before submission, the numbers
will need to be refreshed from the new `sdm_metadata.json` and
`species_overrides.json`; the `paper/generate_statistics.py` script
can be extended to report these alongside the occurrence statistics
it currently produces.
