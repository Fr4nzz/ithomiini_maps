# Phase 3A reference and source audit

Date: 22 September 2026. Baseline: `3b2fee94d15c891952494f4a9074576febc12a00`. This is a bibliography and submission-text audit, not a new scientific evaluation.

## Outcome and limits

The manuscript now has 39 references in one alphabetical sequence. Every entry has an in-text use and every detected author-year citation has an entry. The 28 baseline entries were reviewed. Eleven sources were added, while the incorrect elapid attribution and the generic Python book citation were replaced. No unrelated orphan reference was retained or added.

Published metadata were checked against publisher pages, primary papers, author-hosted records or official product documentation. Author lists longer than six names are abbreviated after the first six, consistently throughout. Published title spellings, including `modeling`, `customizable`, `visualizing` and `coloration`, have not been converted to British English. Author accents and surname particles are retained where supplied by the primary record. Journal volume, issue and pages or article identifiers are included where applicable. Undated living documentation uses `n.d.` and an access date, rather than a software project's founding year.

**One bibliographic verification remains open:** the external GBIF receipt for `10.15468/dl.6zagkz` could not be retrieved. DOI resolution and metadata requests failed. The DOI and its role as the butterfly GBIF component are preserved from the Phase 1 evidence ledger, not independently reverified from a new receipt. Its date is not invented. The bibliography therefore uses `GBIF.org (n.d.)`, and the author-action file requests the original citation and query scope. This limitation does not justify replacing the frozen occurrence snapshot.

## Reference-by-reference record

The primary source linked in each row is the authority used for the publication or software metadata. A DOI may be retained even when its resolver failed if the primary publication itself supplies it. Successful retrieval of a page does not test the software or reproduce an experiment.

| Reference | Manuscript use | Primary metadata authority and result |
| :--- | :--- | :--- |
| Anderson (2023) | Section 2.5, elapid | [JOSS publication](https://joss.theoj.org/papers/10.21105/joss.04930). Corrected Christensen (2022) to Christopher B. Anderson (2023), volume 8, issue 84, article 4930. The 2022 submission date is not the publication year. |
| Barve et al. (2011) | Section 2.5, accessible area | [Publisher](https://www.sciencedirect.com/science/article/abs/pii/S0304380011000780). Author-year, title, volume 222(11), pages 1810–1819 and DOI retained. |
| Beccaloni et al. (2008) | Section 2.5, host sources | [Authors' book record and text](https://www.researchgate.net/publication/262099000_Catalogue_of_the_Hostplants_of_the_Neotropical_Butterflies_Catalogo_de_las_Plantas_Huesped_de_las_Mariposas_Neotropicales). Added the actual catalogue named in the seed. Four authors, bilingual title, publisher, series 8, 536 pages and ISBN checked. Used an authoritative author copy rather than treating the CABI indexing identifier as a verified book DOI. |
| Ben Chehida et al. (2026) | Introduction, genetic basis of mimicry | [PLOS publication](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3003742). Added published article, 24(4), e3003742, dated 30 April 2026. Used the publisher's citation forms `Salazar C, P.A.` and `Córdova, K.G.G.`. No funding or permits were imported from this separate paper. |
| Challis et al. (2023) | Section 2.5, GoaT | [Primary article](https://pmc.ncbi.nlm.nih.gov/articles/PMC9971660/). Author list, title, Wellcome Open Research 8, 24 and versioned DOI checked. |
| Chazot et al. (2016) | Introduction, geographic diversification | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/mec.13773). Corrected the cited title's year from 2019 to 2016, volume/issue from 28(10) to 25(22), pages to 5765–5784, and Freitas initials to A.V.L. Added its DOI. This is not a substitution of a different Chazot paper. |
| Costa (1999) | Section 2.5, host sources | [Primary article text](https://www.researchgate.net/publication/26343233_New_records_of_larval_host_plants_for_Ithomiinae_butterflies_Nymphalidae). Added the seed's source with full initials F.A.P.L., title including Nymphalidae, 59(3), 455–459 and DOI. The seed's abbreviated `F.` is not used as the complete bibliographic author name. |
| Doré et al. (2023) | Introduction, Section 2.5, Table 1 | [Publisher](https://onlinelibrary.wiley.com/doi/full/10.1111/ele.14198). All seven author names checked, including Doré. Retained the published Willmott initial K., 26(6), 843–857 and DOI. The interface's older `Dore et al. (2022)` source label is not the publication date. |
| Elias et al. (2008) | Introduction, mimicry | [PLOS publication](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.0060300). Author-year, title and 6(12), e300 checked. Added the missing DOI. |
| Ester et al. (1996) | Section 2.5, DBSCAN | [AAAI primary PDF](https://cdn.aaai.org/KDD/1996/KDD96-037.pdf). First and final pages inspected. Confirmed four authors, title, 1996 proceedings and pages 226–231. Standardised H.-P. and supplied the primary URL. No DOI invented. |
| Fick & Hijmans (2017) | Section 2.5, elevation source | [WorldClim product and recommended citation](https://www.worldclim.org/data/worldclim21.html). Added publication, 37(12), 4302–4315 and DOI. The product page identifies the distributed elevation as SRTM-derived. The Methods specify WorldClim v2.1, not an unverified standalone CGIAR SRTM release. |
| Gauthier et al. (2023) | Introduction, genomic resources | [Publisher](https://onlinelibrary.wiley.com/doi/abs/10.1111%2F1755-0998.13749). Added article, 23(4), 872–885 and DOI. Preserved the published title `First chromosome scale genomes`, without inserting a new hyphen. First six authors checked against the publisher's citation. |
| GBIF.org (n.d.) | Section 2.5, occurrence download | [Selected DOI](https://doi.org/10.15468/dl.6zagkz). Bibliography entry added. External metadata verification remains open as described above. This is not a DOI for the complete merged snapshot or plant data. |
| GitHub (n.d.-a) | Section 2.1, Actions | [Official documentation](https://docs.github.com/en/actions). Replaced an unsupported 2019 bibliographic date with undated documentation and access date. |
| GitHub (n.d.-b) | Section 2.1, Pages | [Official documentation](https://docs.github.com/en/pages). Replaced an unsupported 2008 bibliographic date with undated documentation and access date. The two entries are ordered by title. |
| Gu et al. (2025) | Section 2.3, biological image representation | [Primary preprint v2](https://arxiv.org/abs/2505.23883v2). Author list, title, version and DOI checked. Retained as the BioCLIP 2 methodological resource, paired with the exact 2.5-H model resource below. |
| Hirzel et al. (2006) | Section 2.5, continuous Boyce index | [Publisher](https://www.sciencedirect.com/science/article/pii/S0304380006002468). Author-year, title, 199(2), 142–152 and DOI retained. |
| Imageomics (n.d.) | Section 2.3, BioCLIP 2.5-H | [Exact model resource](https://huggingface.co/imageomics/bioclip-2.5-vith14). Confirmed the intended Huge/ViT-H resource. No claim that the project's supervised classifier is zero-shot was added. |
| Karger et al. (2021) | Section 2.5, CHELSA | [EnviDat record](https://www.envidat.ch/metadata/chelsa-climatologies). Added the official nine-author dataset citation and DOI, with CHELSA v2.1 specified. The Methods' 1981–2010 baseline and variable list come from the repository, not an older CHELSA product. |
| Kass et al. (2021) | Section 2.5, tuning | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/2041-210X.13628). Metadata retained, including published surname Pinilla-Buitrago. Corrected the article title to `customizable`. The manuscript describes an ENMeval-style approach, not execution of the R package. |
| MapLibre Contributors (n.d.) | Section 2.1, map renderer | [Official documentation](https://maplibre.org/maplibre-gl-js/docs/). Updated to a specific documentation destination and undated reference. No current documentation version is asserted to be the project's installed version. |
| McClure et al. (2019) | Introduction, transparency | [Primary article](https://pmc.ncbi.nlm.nih.gov/articles/PMC6501930/). Added 286(1901), 20182769 and DOI. First six authors checked, including Meichanetzoglou and Bastin-Héline. Added only a short biological-context sentence. |
| McKinney (2010) | Section 2.1, pandas | [SciPy proceedings](https://doi.org/10.25080/Majora-92bf1922-00a). Author, title, proceedings and DOI checked. Retained the established page range 56–61. A fresh full-PDF retrieval was unavailable during this pass. |
| Pearson et al. (2007) | Section 2.5, small-sample evaluation | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/j.1365-2699.2006.01594.x). Retained publication year 2007 despite the DOI's 2006 component, 34(1), 102–117. |
| Phillips & Dudík (2008) | Section 2.5, MaxEnt | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/j.0906-7590.2008.5203.x). Author accent, title, 31(2), 161–175 and DOI checked. |
| Phillips et al. (2009) | Section 2.5, target-group background | [Publisher](https://esajournals.onlinelibrary.wiley.com/doi/10.1890/07-2153.1). Seven authors, title, 19(1), 181–197 and DOI checked. |
| Python Software Foundation (n.d.) | Section 2.1, Python | [Official language reference](https://docs.python.org/3/reference/). Replaced the generic 2009 CreateSpace book entry with the directly inspected language documentation. This does not assert a new runtime version. |
| Roberts et al. (2017) | Section 2.5, spatial validation | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/ecog.02881). Author list and 40(8), 913–929 checked. Retained issue year 2017 rather than the 2016 first-online date. |
| Rosser & Mallet (2024) | Introduction and Discussion | [Author's publication record](https://mallet.oeb.harvard.edu/publications/interactive-maps-visualizing-geographic-distributions-and-phenotypes). Corrected volume/issue/pages to 34(2), 104–107. Supplied an authoritative URL without inventing a DOI. |
| Ultralytics (n.d.) | Section 2.3, localisation framework | [Official documentation](https://docs.ultralytics.com/). Confirmed object detection and segmentation framework. Did not infer an exact YOLO release or training procedure from a changing website. |
| Valavi et al. (2022) | Section 2.5, algorithm comparison | [Publisher](https://esajournals.onlinelibrary.wiley.com/doi/10.1002/ecm.1486). Corrected issue year to 2022 and article identifier to e01486. The 2021 first-online date is not used as the issue year. |
| van der Heijden et al. (2025) | Introduction, genomic diversification | [Primary publication](https://doi.org/10.1073/pnas.2410939122). Added PNAS 122(31), e2410939122. Checked surname particle, Näsvall, Beserra Nobre and Salazar-Carrión against publication metadata. |
| Wahlberg (n.d.) | Section 2.5, reference taxonomy | [Author's website](https://www.nymphalidae.net/). Added separate attribution to Niklas Wahlberg. Warren et al. is no longer made to cite this different resource. |
| Warren et al. (2024) | Section 2.5, reference taxonomy | [Site's requested citation](https://www.butterfliesofamerica.com/L/citation.htm). Corrected year to 2024 and version to 9 March 2024. Used its five-author list, which does not include Pelham. |
| Wessel & Smith (1996) | Section 2.5, shoreline screening | [Publisher](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/96JB00104). Author-year, title, 101(B4), 8741–8743 and DOI retained. |
| Willmott & Freitas (2006) | Introduction and host sources | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/j.1096-0031.2006.00108.x). Added missing DOI and restored the published title's `hostplant`. Retained 22(4), 297–368. |
| Wilson & Jetz (2016) | Section 2.5, cloud frequency | [EarthEnv product and primary citation](https://www.earthenv.org/cloud). Added PLoS Biology 14(3), e1002415 and DOI. Product metadata identify Global 1-km Cloud Frequency version 1 and its mean annual layer. |
| Wisz et al. (2008) | Section 2.5, sample size | [Publisher](https://onlinelibrary.wiley.com/doi/10.1111/j.1472-4642.2008.00482.x). Authors, including the NCEAS working group, title, 14(5), 763–773 and DOI checked. The long author list is abbreviated consistently. |
| You (n.d.) | Section 2.1, Vue.js | [Official project](https://vuejs.org/). Kept Evan You attribution and replaced the founding-year date with an undated documentation reference. |

## Targeted repository provenance checks

Both `sdm/config.yaml` and `sdm/02_download_env_data.py` were read at the Phase 2 baseline. The actual download paths identify the sources below. No raster fitting or release-wide metrics were rerun.

| Predictor | Identified product | Evidence and limitation |
| :--- | :--- | :--- |
| CHELSA | v2.1, 1981–2010, 30 arc seconds | The downloader uses the `chelsav2/GLOBAL/climatologies/1981-2010/bio/` path and `CHELSA_bio##_1981-2010_V.2.1.tif`. Configuration selects BIO1, 2, 4, 5, 6, 12, 13, 14 and 15. |
| Elevation | WorldClim v2.1, 30 arc seconds, SRTM-derived | `download_elevation()` fetches `wc2.1_30s_elev.zip`. The configuration label says SRTM/CGIAR, but the executable download path is WorldClim. The manuscript follows the executable path. No application code was changed. |
| Cloud frequency | EarthEnv Global 1-km Cloud Frequency v1, mean annual | The requested remote file is `MODCF_meanannual.tif`. A local filename suffix `_01` is not evidence for January or a separate version. |

These checks establish the downloader's intended inputs. They do not establish checksummed identity of every historical raster input. An input manifest would be an optional reproducibility improvement. The 145-species release count and other Phase 2 SDM decisions are unchanged.

The host-plant seed's `principal_sources` names Beccaloni, Costa and Willmott & Freitas. These sources were checked without reconstructing the pipeline or reporting seed totals. Reported names, accepted names, identification precision, association support and independent plant occurrences remain distinct. No plant DOI was assigned.

## Destination verification

GitHub metadata and source files were read through the connected GitHub tool. The three source repositories were reported as public at the time of the check. No permissions were changed. The AI Photo Processor README identifies its browser interface and distinguishes browser rotation from the optional RAW backend. The Gallery's `src/App.vue` confirms the path-based `/ai_identifier` route. Hugging Face serves the model repository, Space and inference landing page.

The public Gallery landing page was retrieved. The web fetcher could not retrieve the Processor interface, Atlas application or Gallery deep link, so these destinations were verified from repository/deployment instructions rather than presented as successful end-to-end browser tests. The current Hugging Face landing text was not substituted for the pinned Phase 2 classifier evidence. No uploads, paid inference, source-database updates or permission changes were performed.

Existing commit pins identify source versions. They do not archive all remote images or establish the weights loaded by a running service. No new DOI deposit, runtime model audit or host-build reconciliation was performed.
