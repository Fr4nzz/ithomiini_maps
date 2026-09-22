# Phase 3 reference audit: 22 September 2026

## Result and method

All 28 Phase 2 bibliography entries were checked, replaced or corrected. The final manuscript has 38 entries in one alphabetical sequence. Author names, dates, titles, source, volume, issue and pagination or article identifiers were compared with primary publication records, publisher-deposited Crossref metadata, DataCite records, official software citations or the original resource's citation instructions. Undated documentation uses access dates rather than inferred launch years. Narrative and parenthetical citations were matched against the final bibliography in both directions. The accompanying JSON records the final entry and its verification source for every citation.

**One source identifier remains unresolved:** project records specify butterfly GBIF download `10.15468/dl.6zagkz`, but the DOI resolver, DataCite API and Handle API returned HTTP 404 on 22 September 2026. Neither its registered title/date nor its taxonomic predicate and scope could be verified. The manuscript retains it as a project-recorded identifier, not as a verified registry citation. No bibliographic title, download year or replacement DOI has been invented. Obtain the original download receipt before submission. This does not change the frozen 104,297-record population.

## Substantive changes

| Entry or issue | Final treatment |
|---|---|
| elapid | Replaced Christensen (2022) with **Anderson (2023)**, *JOSS* 8(84), 4930. The DOI itself was correct. |
| Chazot et al. | Corrected **2019 to 2016**, volume 25(22), pages 5765–5784, DOI 10.1111/mec.13773. Restored Freitas's full initials A.V.L. |
| Rosser & Mallet | Corrected volume/pages to **34(2), 104–107** and added DOI 10.5281/zenodo.13920055. |
| Valavi et al. | Used **2022**, the issue year, rather than 2021 online-first. Corrected article number to **e01486**. |
| Warren et al. | Followed the site's suggested **2024** citation, version 9 March 2024. Removed Pelham from this entry, which is not his separate catalogue. |
| Doré et al. | Verified the seven-author list, accented surname, 2023 date, title and DOI. The citation was already substantively correct. |
| Challis et al. | Verified the original five authors, 2023, volume 8, article 24 and DOI 10.12688/wellcomeopenres.18658.1. No speculative replacement DOI. |
| BioCLIP 2 publication | Replaced the preprint entry with the **NeurIPS 2025** publication, volume 38 and DOI 10.52202/085713-3436. Electronic pagination 102778–102811 follows the authors' NeurIPS citation. The commercial proceedings/DOI record uses 113880–113913. Both identify the same title and authors. |
| BioCLIP 2.5-H model | Replaced Imageomics (n.d.) with **Gu et al. (2026)** and the dedicated model DOI 10.57967/hf/10131. Version 1.0.0 follows the model card. The registry's version field is an upload revision, `c333dc2`, not proof of the currently running checkpoint. The manuscript separately identifies the inspected resource revision. |
| Ultralytics | Used the general software citation, **Jocher, Qiu & Chaurasia (2023)**, from `CITATION.cff`. Did not adopt the citation file's newer model-specific recommendation as evidence of the deployed segmenter lineage. |
| Software documentation | Replaced inferred launch-year entries for Vue, MapLibre, GitHub Pages/Actions and the Python book with official documentation entries. GitHub entries use n.d.-a and n.d.-b consistently. |
| Elias et al. and Willmott & Freitas | Added verified DOIs. Restored the published **hostplant** spelling in the Willmott & Freitas title. |
| Phillips & Dudík and Kass et al. | Checked published titles. Preserved “Modeling of …” and the title's original “customizable” spelling rather than imposing British spelling inside titles. |
| Missing method/data sources | Added Ba et al. (LayerNorm), Breiman (random forest), Chen & Guestrin (XGBoost), Karger et al. (CHELSA v2.1), Fick & Hijmans (WorldClim) and Wilson & Jetz (EarthEnv cloud frequency). |
| Qualitative host compilation | Added Beccaloni et al. (2008), Costa (1999) and McClure & Elias (2016), all represented in the compilation's source materials. No extraction count was converted into verified ecological evidence. |
| Taxonomic website | Added Wahlberg's Nymphalidae.net resource separately from Butterflies of America. |

## Previously flagged names

The Phase 2 manuscript no longer cited **McClure et al., Gauthier et al., van der Heijden et al. or Ben Chehida et al.** Their absence from the Phase 2 bibliography was therefore not an unmatched-citation defect. No orphan entry was restored. The newly cited **McClure & Elias (2016)** is a distinct, two-author host-plant source represented in the current compilation.

## Complete final citation register

Every row below is cited in the final manuscript. Publication titles retain their published spelling, with sentence-case capitalisation and ordinary typographic hyphen normalisation. A missing DOI for a book, documentation page or the DBSCAN conference paper was not filled with a guessed identifier.

| In-text citation | Verification source | Outcome |
|---|---|---|
| Anderson, 2023 | [Primary record](https://joss.theoj.org/papers/10.21105/joss.04930) | verified |
| Ba et al., 2016 | [Primary record](https://arxiv.org/abs/1607.06450) | verified |
| Barve et al., 2011 | [Primary record](https://api.crossref.org/works/10.1016/j.ecolmodel.2011.02.011) | verified |
| Beccaloni et al., 2008 | [Primary record](https://ci.nii.ac.jp/ncid/BB00704591) | verified |
| Breiman, 2001 | [Primary record](https://api.crossref.org/works/10.1023/A:1010933404324) | verified |
| Challis et al., 2023 | [Primary record](https://api.crossref.org/works/10.12688/wellcomeopenres.18658.1) | verified |
| Chazot et al., 2016 | [Primary record](https://api.crossref.org/works/10.1111/mec.13773) | verified |
| Chen & Guestrin, 2016 | [Primary record](https://api.crossref.org/works/10.1145/2939672.2939785) | verified |
| Costa, 1999 | [Primary record](https://api.crossref.org/works/10.1590/S0034-71081999000300010) | verified |
| Doré et al., 2023 | [Primary record](https://api.crossref.org/works/10.1111/ele.14198) | verified |
| Elias et al., 2008 | [Primary record](https://api.crossref.org/works/10.1371/journal.pbio.0060300) | verified |
| Ester et al., 1996 | [Primary record](https://aaai.org/papers/kdd96-037-a-density-based-algorithm-for-discovering-clusters-in-large-spatial-databases-with-noise/) | verified |
| Fick & Hijmans, 2017 | [Primary record](https://www.worldclim.org/data/worldclim21.html) | verified |
| GitHub, n.d.-a | [Primary record](https://docs.github.com/en/actions) | verified |
| GitHub, n.d.-b | [Primary record](https://docs.github.com/en/pages) | verified |
| Gu et al., 2025 | [Primary record](https://imageomics.github.io/bioclip-2/) | verified; electronic pagination follows author-provided NeurIPS citation; commercial proceedings pagination differs |
| Gu et al., 2026 | [Primary record](https://huggingface.co/imageomics/bioclip-2.5-vith14) | verified |
| Hirzel et al., 2006 | [Primary record](https://api.crossref.org/works/10.1016/j.ecolmodel.2006.05.017) | verified |
| Jocher et al., 2023 | [Primary record](https://raw.githubusercontent.com/ultralytics/ultralytics/main/CITATION.cff) | verified |
| Karger et al., 2021 | [Primary record](https://api.datacite.org/dois/10.16904/envidat.228) | verified |
| Kass et al., 2021 | [Primary record](https://api.crossref.org/works/10.1111/2041-210X.13628) | verified |
| MapLibre Contributors, n.d. | [Primary record](https://maplibre.org/maplibre-gl-js/docs/) | verified |
| McClure & Elias, 2016 | [Primary record](https://api.crossref.org/works/10.1186/s12862-016-0701-5) | verified |
| McKinney, 2010 | [Primary record](https://proceedings.scipy.org/articles/Majora-92bf1922-00a) | verified |
| Pearson et al., 2007 | [Primary record](https://api.crossref.org/works/10.1111/j.1365-2699.2006.01594.x) | verified |
| Phillips & Dudík, 2008 | [Primary record](https://api.crossref.org/works/10.1111/j.0906-7590.2008.5203.x) | verified |
| Phillips et al., 2009 | [Primary record](https://api.crossref.org/works/10.1890/07-2153.1) | verified |
| Python Software Foundation, n.d. | [Primary record](https://docs.python.org/3/reference/index.html) | verified |
| Roberts et al., 2017 | [Primary record](https://api.crossref.org/works/10.1111/ecog.02881) | verified |
| Rosser & Mallet, 2024 | [Primary record](https://api.datacite.org/dois/10.5281/zenodo.13920055) | verified |
| Valavi et al., 2022 | [Primary record](https://api.crossref.org/works/10.1002/ecm.1486) | verified |
| Vue.js Contributors, n.d. | [Primary record](https://vuejs.org/guide/introduction.html) | verified |
| Wahlberg, n.d. | [Primary record](https://www.nymphalidae.net/Nymphalidae/home.htm) | verified |
| Warren et al., 2024 | [Primary record](https://www.butterfliesofamerica.com/L/citation.htm) | verified |
| Wessel & Smith, 1996 | [Primary record](https://api.crossref.org/works/10.1029/96JB00104) | verified |
| Willmott & Freitas, 2006 | [Primary record](https://api.crossref.org/works/10.1111/j.1096-0031.2006.00108.x) | verified |
| Wilson & Jetz, 2016 | [Primary record](https://www.earthenv.org/cloud) | verified |
| Wisz et al., 2008 | [Primary record](https://api.crossref.org/works/10.1111/j.1472-4642.2008.00482.x) | verified |

## Check receipts

Publisher/registry records were fetched through read-only GitHub Actions jobs on the manuscript branch, then inspected locally. Successful workflow execution is not itself verification of every HTTP request. The saved status and content were examined, including failed GBIF requests. The first metadata job received some rate limits. A sequential second job resolved all 24 queried Crossref records.

- Source packaging: run [35736549155](https://github.com/Fr4nzz/ithomiini_maps/actions/runs/35736549155), pinned to the exact Phase 2 commit.
- Initial public-resource records: run [35737460883](https://github.com/Fr4nzz/ithomiini_maps/actions/runs/35737460883).
- Sequential primary records: run [35737775276](https://github.com/Fr4nzz/ithomiini_maps/actions/runs/35737775276).

The durable record is this audit and `phase3_reference_records_20260922.json`, not the temporary Actions artifact retention. No model weights, restricted collection spreadsheets or third-party photograph collections were copied into the manuscript package.
