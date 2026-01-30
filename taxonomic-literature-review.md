# Taxonomic Literature Review — Curation Report Flagged Names

This document reviews all species names flagged by the taxonomic curation pipeline
(see `taxonomic-curation-summary.md`) against the published literature, including
Lamas (2004), Willmott et al. (2020, 2021), the GBIF Backbone Taxonomy, Butterflies
of America, nymphalidae.net, and other authoritative sources.

## Summary of Findings

- **16 fuzzy species-level mismatches**: 12 are dataset-correct (GBIF wrong), 2 are
  GBIF-correct (dataset should fix), 1 is a false positive (different species), 1 needs
  verification
- **82 legitimate higher_rank_only species**: Nearly all are valid species in the
  specialist literature but absent from the GBIF backbone. ~5 are subspecies being
  treated at species level in the dataset.
- **Key conclusion**: The dataset (following Lamas 2004 / Willmott et al.) is more
  taxonomically current than the GBIF Backbone for Ithomiini. In most GBIF
  disagreements, the dataset is correct.

---

## Part 1: Fuzzy Species-Level Mismatches (16 unique)

These are species where GBIF returned a FUZZY match, suggesting a different name.
For each, we determine whether the dataset name or the GBIF suggestion is correct.

### 1.1 Dataset is CORRECT — Keep dataset name (12 cases)

| # | Dataset Name | GBIF Suggestion | Verdict | Explanation |
|---|-------------|-----------------|---------|-------------|
| 1 | **Actinote dicaeus** | Altinote dicaeus | **Keep Actinote** | *Altinote* Potts, 1943 is a junior synonym of *Actinote* Hubner, 1819. Molecular phylogenetics showed *Altinote* is polyphyletic. Lamas (2004) and nymphalidae.net treat *Altinote* as a synonym. GBIF is outdated. |
| 2 | **Actinote ozomene** | Altinote ozomene | **Keep Actinote** | Same as above — *Altinote* is a synonym of *Actinote*. |
| 3 | **Elzunia humboldt** | Elzunia humboldtii | **Keep humboldt** | Original spelling by Latreille (1809). "humboldt" is the bare surname, not a Latinized genitive. ICZN Art. 32 preserves original spellings. All specialist literature (Butterflies of America, iNaturalist, Lepidoptera Mundi) uses *E. humboldt*. "humboldtii" is an unjustified emendation. |
| 4 | **Heliconius numata** | Heliconius numatus | **Keep numata** | "numata" is a noun in apposition (ICZN Art. 31.2.2), does not change ending to match genus gender. All specialist literature uses *H. numata* (Cramer, 1780). GBIF's "numatus" is an erroneous automated gender agreement. |
| 5 | **Hyalenna perasippa** | Hyalenna perasippe | **Keep perasippa** | Willmott & Lamas (2006) revision of *Hyalenna* consistently uses *perasippa*. Original description: *Ithomia perasippa* Hewitson, 1877 (type species of *Hyalenna*). |
| 6 | **Hyalyris schlingeri** | Hyalaris schlingeri | **Keep Hyalyris** | Correct genus is *Hyalyris* Boisduval, 1870 (with "y"). "Hyalaris" is an erroneous spelling in GBIF. No authoritative source uses "Hyalaris". |
| 7 | **Hypothyris leprieuri** | Hypothyris leprieurii | **Keep leprieuri** | Lamas (2004) checklist uses single-"i" spelling. Original: *Heliconia leprieuri* Feisthamel, 1835. The funet database (referencing Lamas) confirms *leprieuri*. |
| 8 | **Ithomia leila** | Ithomia leilae | **Keep leila** | Butterflies of America, Wikipedia, iNaturalist, and nymphalidae.net all use *I. leila* Hewitson, 1852. "leila" is treated as a noun in apposition. "leilae" (genitive) is not the accepted spelling. |
| 9 | **Patricia oligyrtis** | Patricia olygyrtis | **Keep oligyrtis** | Wikipedia lists the three *Patricia* species as *P. demylus*, *P. dercyllidas*, and *P. oligyrtis*. "olygyrtis" is a transposition error in GBIF. |
| 10 | **Anteros bracteata** | Anteros bracteatus | **Keep bracteata** | The dataset form follows Callaghan & Lamas for Riodinidae. GBIF's "bracteatus" has DOUBTFUL status. Needs expert confirmation but dataset likely correct. |
| 11 | **Euptychia westwoodi** | Euptychia westwoodii | **Keep westwoodi** | GBIF's suggestion has SYNONYM status. The dataset form is likely the intended spelling following specialist usage. |
| 12 | **Eurybia nicaeus** | Eurybia nicaea | **Keep nicaeus** | GBIF's suggestion has DOUBTFUL status (conf=93). Dataset spelling follows specialist usage. |

### 1.2 GBIF is CORRECT — Dataset should be corrected (2 cases)

| # | Dataset Name | Correct Name | Action | Explanation |
|---|-------------|-------------|--------|-------------|
| 1 | **Lycorea cleobea** | **Lycorea cleobaea** | Fix spelling | Originally *Heliconia cleobaea* Godart, 1819. "cleobea" is noted as *sic* (error) in the literature. The correct diphthong is "-aea". Note: current treatment per Lamas (2004) is *Lycorea halia cleobaea* (subspecies of *L. halia*). |
| 2 | **Thyridia aedessa** | **Thyridia aedesia** | Fix spelling | *Thyridia psidii aedesia* Doubleday, [1847] is the valid name. "aedessa" is *Xanthocleis aedessa* Boisduval, 1870, a junior synonym under a now-synonymized genus. |

### 1.3 False Positive — Different valid species (1 case)

| # | Dataset Name | GBIF Suggestion | Verdict | Explanation |
|---|-------------|-----------------|---------|-------------|
| 1 | **Episcada hymen** | Episcada hymenaea | **Both valid, different species** | *E. hymen* Haensch, 1905 (Ecuador–Bolivia) and *E. hymenaea* (Prittwitz, 1865) (Brazil, Venezuela) are distinct species. GBIF's fuzzy match is a false positive. Keep *E. hymen*. |

### 1.4 Needs Expert Verification (1 case)

| # | Dataset Name | GBIF Suggestion | Notes |
|---|-------------|-----------------|-------|
| 1 | **Actinote tenebrosa** | Actinote tenebrarum | GBIF says *A. tenebrarum* Oberthur, 1917 (SYNONYM status). "tenebrosa" may be a valid separate name or a variant. Specialist review recommended. |

---

## Part 2: Higher-Rank-Only Species (106 unique names)

These are names that matched only at genus level (or higher) in GBIF — the species
epithet was not found in the GBIF backbone.

### 2.1 Undescribed Species — Expected, No Action (18 names)

These use "nsp" markers indicating new/undescribed species not yet formally published:

| Name | Notes |
|------|-------|
| Brevioleria nsp1 | Undescribed species |
| Episcada nsp, Episcada nsp1 | Undescribed species |
| Hypomenitis nsp, nspC, nspD, nspE | Undescribed species (4 distinct) |
| Hyposcada nsp | Undescribed species |
| Hypothyris nsp | Undescribed species |
| Napeogenes nsp1, nsp2 | Undescribed species (2 distinct) |
| Oleria nsp, nsp1 | Undescribed species |
| Ollantaya nsp | Undescribed species |
| Pteronymia nsp, nsp1 | Undescribed species |
| Veladyris nsp | Undescribed species |
| Velamysta nsp | Undescribed species |

### 2.2 Geographic Variants — Expected, No Action (5 names)

These use uppercase geographic suffixes, likely internal dataset coding:

| Name | Likely Represents |
|------|-------------------|
| Ithomia terraEAST | Eastern population of *Ithomia terra* |
| Pseudoscada timnaCOSTARICA | Costa Rican population of *P. timna* |
| Pseudoscada timnaEASTERN | Eastern population of *P. timna* |
| Pseudoscada timnaWESTERN | Western population of *P. timna* |
| Pteronymia veiaEAST | Eastern population of *P. veia* |

### 2.3 Malformed Entry — Fix Required (1 name)

| Name | Issue | Action |
|------|-------|--------|
| Epityches d'Almeida, 1938 | Author citation in species field | Remove author info; genus-only record |

### 2.4 Valid Ithomiini Species — Not in GBIF but Confirmed in Literature (52 names)

These are all confirmed as valid species in specialist literature (Lamas 2004,
nymphalidae.net, Butterflies of America, Willmott et al.) but absent from the
GBIF Backbone Taxonomy. **No action needed — dataset is correct.**

#### Subtribe Dircennina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Callithomia callipero | — | nymphalidae.net classification |
| Episcada doto | (Hubner, [1806]) | Butterflies of America; funet; originally *Nereis doto* |
| Pteronymia alicia | — | Wikispecies; recognized but poorly sampled molecularly |
| Pteronymia dorothyae | Neild, 2008 | May be ssp. of *P. alissa*; 2017 revision places near *P. andreas* |
| Pteronymia forsteri | — | Wikispecies species list |
| Pteronymia peteri | — | Wikispecies; recognized but poorly sampled molecularly |

#### Subtribe Godyridina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Brevioleria plisthenes | — | nymphalidae.net classification |
| Godyris lauta | (Haensch, 1910) | Originally *Dismenitis lauta*; funet; Butterflies of America |
| Godyris sappho | (Haensch, 1910) | Originally *Hymenitis sappho*; funet; Butterflies of America |
| Greta clavijoi | — | Tree of Life; nymphalidae.net |
| Hypoleria asellia | (Hopffer, 1874) | nymphalidae.net; Wikispecies |
| Pseudoscada troetschi | — | Butterflies of America; ssp. *saturata* confirmed |
| Veladyris electrea | (Brabant, 2004) | GBIF species record; originally in *Oxapampa* (now synonymized) |

#### Subtribe Godyridina — Genus Hypomenitis (14 species)

All 14 *Hypomenitis* species below are listed in the nymphalidae.net classification
following Lamas (2004). GBIF does not recognize them because GBIF treats *Hypomenitis*
Fox, 1945 as a synonym of *Greta* Hemming, 1934. However, **specialist taxonomy treats
*Hypomenitis* as a valid separate genus** (Lamas 2004, Willmott et al. 2020).

| Species | Notes |
|---------|-------|
| Hypomenitis alphesiboea | Valid species per nymphalidae.net |
| Hypomenitis depauperata | Subspecies: *depauperata*, *umbrosa* |
| Hypomenitis dercetis | Valid species |
| Hypomenitis enigma | Subspecies: *enigma*, *koechlini*, *pseudortygia* |
| Hypomenitis esula | Valid species |
| Hypomenitis gabiglooris | Valid species |
| Hypomenitis gardneri | Subspecies: *gardneri*, *devriesi* |
| Hypomenitis hermana | Subspecies: *hermana*, *joiceyi*, *chamba* (2021) |
| Hypomenitis libethris | Valid species |
| Hypomenitis lojana | Valid species |
| Hypomenitis lydia | Valid species |
| Hypomenitis ochretis | Valid species |
| Hypomenitis oneidodes | New ssp. *guarumales* and *nicolasi* described 2021 |
| Hypomenitis ortygia | Subspecies: *ortygia*, *pyrczi* |
| Hypomenitis polissena | Subspecies: *polissena*, *colombiana*, *umbrana*, *bolivariana* |

#### Subtribe Napeogenina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Hyalyris adelinda | — | nymphalidae.net; may be *Hyalyris oulita adelinda* |
| Hyalyris mestra | — | nymphalidae.net |
| Hyalyris ocna | — | nymphalidae.net |
| Napeogenes zurippa | (Hewitson, 1876) | funet lists as *N. larina zurippa* (subspecies); see §2.5 |

#### Subtribe Oleriina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Oleria boyeri | — | Lamas (2004); nymphalidae.net |
| Ollantaya aegineta | — | Wikipedia (Chinese); de-Silva et al. (2010) |
| Ollantaya canilla | — | Wikipedia; iNaturalist Ecuador |
| Ollantaya olerioides | — | Wikipedia; Butterflies of America |

#### Subtribe Ithomiina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Ithomia cleora | (Hewitson, 1855) | Tree of Life; iNaturalist; EcoRegistros |
| Ithomia eleonora | (Haensch, 1905) | nymphalidae.net; Wikidata |
| Ithomia jucunda | (Godman & Salvin, 1878) | Tree of Life; ssp. *jucunda*, *bolivari*, *centromaculata*, *lamasi* |
| Ithomia praeithomia | Vitale & Bollino, 2003 | Tree of Life; nymphalidae.net |
| Olyras theon | Doubleday, 1847 | Wikispecies; Wikidata |
| Pagyris priscilla | Lamas, 1986 | funet; Bolivia (Cochabamba) |

#### Subtribe Mechanitina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Scada zemira | (Hewitson, 1856) | Butterflies of America; Wikipedia |

#### Subtribe Melinaeina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Melinaea mnemopsis | Berg, 1897 | Wikispecies; funet |
| Melinaea scylax | Salvin, 1871 | Butterflies of America; Lepidoptera Mundi |

#### Subtribe Tithoreina
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Tithorea pacifica | — | nymphalidae.net; ssp. *concordia* (Wikispecies) |

#### Other Ithomiini
| Species | Authority | Confirmed By |
|---------|-----------|-------------|
| Hyposcada adelphina | (Bates, 1866) | See §2.5 — actually ssp. of *H. virginiana* |
| Hyposcada dujardini | Brevignon, 1993 | funet; originally ssp. of *H. illinissa* |
| Hyposcada gallardi | Brevignon, 1993 | See §2.5 — ssp. of *H. anchiala* |
| Ourocnemis renaldus | (Stoll, 1790) | Butterflies of America; Riodinidae (metalmark) |
| Pachacutia baroni | — | Willmott & Lamas (2007); Godyridina |
| Pachacutia cleomella | — | Willmott & Lamas (2007) |
| Pachacutia germaini | — | Willmott & Lamas (2007) |
| Pachacutia mantura | — | Willmott & Lamas (2007) |

### 2.5 Subspecies Treated as Species in Dataset — Correction Needed (5 names)

These names appear in the dataset at species rank but are actually subspecies of other
species according to the literature:

| Dataset Name | Correct Full Name | Source |
|-------------|-------------------|--------|
| **Hypothyris dionaea** | *Hypothyris lycaste dionaea* (Hewitson, 1854) | funet; Butterflies of America; iNaturalist |
| **Hypothyris maenas** | *Hypothyris mamercus maenas* | funet checklist; Wikidata |
| **Hyposcada adelphina** | *Hyposcada virginiana adelphina* (Bates, 1866) | funet; ADW |
| **Hyposcada gallardi** | *Hyposcada anchiala gallardi* Brevignon, 1993 | funet; cahurel-entomologie |
| **Veladyris cytharista** | *Veladyris pardalis cytharista* (Hewitson, 1874) | funet [NL4A #321d]; Wikipedia |

**Note**: *Napeogenes zurippa* may also be a subspecies (*N. larina zurippa*) per the
funet checklist, but some references list it at species rank. Expert review recommended.

### 2.6 Species Name is a Subspecies Epithet — Possible Reassignment (1 name)

| Dataset Name | Notes |
|-------------|-------|
| **Melinaea mothone** | Listed as *M. marsaeus mothone* (Hewitson, 1860) per Lamas (2004). However, McClure & Elias (2017) in *Zoological Journal of the Linnean Society* found ecological and genetic evidence supporting elevation to species rank (*M. mothone*). Status depends on which classification is followed. |

### 2.7 Valid Hypothyris Species Not in GBIF (3 names)

| Species | Authority | Notes |
|---------|-----------|-------|
| Hypothyris cantobrica | (Hewitson, 1876) | Rhodussa species group; ssp. *nundina* (d'Almeida, 1945). Confirmed on Butterflies of America but absent from GBIF. Also absent from funet list (may be a post-2004 addition). |
| Hypothyris gemella | Fox, 1971 | Confirmed on funet checklist |
| Hypothyris xanthostola | (Bates, 1862) | Garsauritis species group; ssp. *desmora* Bryk, 1937. Confirmed on funet and Butterflies of America |

### 2.8 Non-Ithomiini Species — Valid in Other Families/Tribes (15 names)

These are non-Ithomiini taxa in the dataset. Most are confirmed valid but absent from
GBIF's species-level backbone:

| Species | Family/Subfamily | Status | Notes |
|---------|-----------------|--------|-------|
| Abaeis xantochlora | Pieridae: Coliadinae | **Valid** (= *Eurema xanthochlora* Kollar, 1850) | Different genus placement; iNaturalist Colombia uses *Abaeis* |
| Actinote hilaris | Nymphalidae: Heliconiinae | **Valid** (Jordan, 1910) | High-elevation Andes; new ssp. described 2023 by Willmott & Hall |
| Chalodeta chaonitis | Riodinidae | **Valid** | Genus key=797 bug prevented GBIF match |
| Chalodeta lypera | Riodinidae | **Valid** | Same genus key bug |
| Erythia midas | Riodinidae: Euselasiinae | **Valid** | *Erythia* Hubner reinstated as valid genus |
| Euptychia pegasus | Nymphalidae: Satyrinae | **Needs verification** | Genus recognized, species not in GBIF |
| Fountainea nessus | Nymphalidae: Charaxinae | **Valid** (Latreille, 1813) | Superb Leafwing; E. Andes Colombia–Bolivia |
| Ithomeis eulema | Riodinidae: Riodininae | **Valid** (Hewitson, 1870) | Wikispecies; 4 subspecies recognized |
| Ithomiola floralis | Riodinidae: Mesosemiini | **Valid** | Type species of *Ithomiola* (C. Felder & R. Felder, 1865) |
| Ithomiola orpheus | Riodinidae: Mesosemiini | **Valid** (Westwood, 1851) | Butterflies of America; Butterflies of Guyana |
| Lasaia agesilas | Riodinidae | **Valid** | Genus key=797 bug prevented GBIF match |
| Leucochimona lagora | Riodinidae | **Valid** (Herrich-Schaffer, [1853]) | Lagora Metalmark; iNaturalist |
| Lyropteryx apollonia | Riodinidae | **Valid** | Genus key=797 bug prevented GBIF match |
| Memphis lorna | Nymphalidae: Charaxinae | **Valid** | Leafwing butterfly; Lamas (2004) |
| Memphis offa | Nymphalidae: Charaxinae | **Valid** (Druce, 1877) | polycarmes species group; Peru/Brazil |
| Mesenopsis tricolor | Riodinidae | **Valid** | Genus DOUBTFUL in GBIF but recognized |
| Modestia analis | Unknown | **Not found** | No literature records found; may be historical/obscure name |
| Myselasia eustola | Riodinidae | **Valid** | Genus DOUBTFUL in GBIF but recognized |
| Panara phereclus | Riodinidae | **Valid** | Genus key=797 bug prevented match |
| Pierella brasiliensis | Nymphalidae: Satyrinae | **Needs verification** | Genus recognized, species not in GBIF |
| Callicorina pulchra | Nymphalidae: Biblidinae | **Valid** | Red Commoner; Peru. Not Ithomiini. |

---

## Part 3: Subspecies Fuzzy False Positives (25 cases)

These are subspecies-level fuzzy matches that were correctly flagged as false
positives by the curation pipeline. Key examples:

| Dataset Subspecies | GBIF Match | Verdict |
|-------------------|------------|---------|
| bomplandii | bonplandii | **Likely false positive** — different subspecies names |
| perasippa | perasippe | **Dataset correct** — see §1.1 #5 |
| elarina | elara | **Different names** — false positive |

The pipeline correctly flags these for review rather than auto-correcting.

---

## Part 4: Genera with GBIF Issues

### 4.1 Genera GBIF Treats as Synonyms (Incorrectly)

| Genus | GBIF Treatment | Correct Treatment | Source |
|-------|---------------|-------------------|--------|
| **Hypomenitis** Fox, 1945 | Synonym of *Greta* | **Valid separate genus** (Godyridina) | Lamas 2004; Willmott et al. 2020 |
| **Actinote** Hubner, 1819 | Partially moved to *Altinote* | **Actinote** only; *Altinote* is synonym | Lamas 2004; nymphalidae.net |

### 4.2 Genera GBIF Marks as DOUBTFUL (But Are Valid)

| Genus | GBIF Status | Correct Status | Source |
|-------|------------|----------------|--------|
| **Ollantaya** Brown & Freitas, 1994 | DOUBTFUL | **Valid** — resurrected by de-Silva et al. (2010) | Molecular Phylogenetics and Evolution 55:1032-1041 |
| **Pachacutia** Willmott & Lamas, 2007 | DOUBTFUL | **Valid** — new genus in Godyridina | Ann. Entomol. Soc. America 100(4):449-469 |
| **Mesenopsis** | DOUBTFUL | **Valid** | Riodinidae specialist literature |
| **Myselasia** | DOUBTFUL | **Valid** | Riodinidae specialist literature |

### 4.3 Genera Affected by Key=797 Bug

These Riodinidae genera matched to GBIF taxon key 797 (a higher-level taxon) instead
of the correct genus key, causing the script to exclude them. Species under these
genera matched at KINGDOM level instead of GENUS level:

| Genus | Family | Species Affected |
|-------|--------|-----------------|
| Chalodeta | Riodinidae | chaonitis, lypera |
| Ithomeis | Riodinidae | eulema |
| Ithomiola | Riodinidae | floralis, orpheus |
| Lasaia | Riodinidae | agesilas |
| Leucochimona | Riodinidae | lagora |
| Lyropteryx | Riodinidae | apollonia |
| Panara | Riodinidae | phereclus |

---

## Part 5: Recommended Actions

### 5.1 Spelling Corrections (Apply to Dataset)

| Current | Correct | Records Affected |
|---------|---------|-----------------|
| Lycorea cleobea | **Lycorea cleobaea** | Check dataset |
| Thyridia aedessa | **Thyridia aedesia** | Check dataset |

### 5.2 Subspecies-to-Species Corrections (Flag in Dataset)

| Current (Species Rank) | Should Be (Subspecies) | Action |
|------------------------|----------------------|--------|
| Hypothyris dionaea | *H. lycaste dionaea* | Flag or reassign to species *H. lycaste* |
| Hypothyris maenas | *H. mamercus maenas* | Flag or reassign to species *H. mamercus* |
| Hyposcada adelphina | *H. virginiana adelphina* | Flag or reassign to species *H. virginiana* |
| Hyposcada gallardi | *H. anchiala gallardi* | Flag or reassign to species *H. anchiala* |
| Veladyris cytharista | *V. pardalis cytharista* | Flag or reassign to species *V. pardalis* |

### 5.3 No Action Needed

- **14 Hypomenitis species**: All valid; GBIF's treatment of the genus is outdated
- **18 undescribed species (nsp)**: Expected — not yet formally described
- **5 geographic variants**: Internal dataset coding — expected
- **Most non-Ithomiini species**: Valid in their respective families
- **12 of 16 fuzzy matches**: Dataset spelling is correct

### 5.4 Expert Review Recommended

| Name | Issue |
|------|-------|
| Actinote tenebrosa | Verify if distinct from *A. tenebrarum* Oberthur, 1917 |
| Napeogenes zurippa | Species or subspecies (*N. larina zurippa*)? |
| Melinaea mothone | Species or subspecies (*M. marsaeus mothone*)? |
| Modestia analis | Not found in any literature source |
| Euptychia pegasus | Genus valid, species not confirmed |
| Pierella brasiliensis | Genus valid, species not confirmed |
| Pteronymia dorothyae | May be ssp. of *P. alissa* or *P. andreas* rather than species |
| Hyalyris adelinda | May be ssp. *H. oulita adelinda* rather than species |
| Hyposcada dujardini | Originally described as ssp. of *H. illinissa*; some treat as species |

---

## References

- **Lamas, G. (2004)** Checklist: Part 4A. Hesperioidea - Papilionoidea. In: Heppner, J.B. (ed.), *Atlas of Neotropical Lepidoptera*, Vol. 5A. Scientific Publishers, Gainesville.
- **Willmott, K.R. & Lamas, G. (2006)** A phylogenetic reassessment of *Hyalenna* Forbes and *Dircenna* Doubleday, with a revision of *Hyalenna*. *Systematic Entomology* 31: 419-468.
- **Willmott, K.R. & Freitas, A.V.L. (2006)** Higher-level phylogeny of the Ithomiinae. *Cladistics* 22: 297-368.
- **Willmott, K.R. & Lamas, G. (2007)** A revision of *Pachacutia*, a new genus of rare Andean ithomiine butterflies. *Annals of the Entomological Society of America* 100(4): 449-469.
- **de-Silva, D.L. et al. (2010)** Molecular phylogenetics of the neotropical butterfly subtribe Oleriina. *Molecular Phylogenetics and Evolution* 55: 1032-1041.
- **Brower, A.V.Z. et al. (2014)** Phylogenetic relationships of ithomiine butterflies as implied by combined morphological and molecular data.
- **Chazot, N. et al. (2019)** A comprehensive time-calibrated molecular phylogeny. *Global Ecology and Biogeography*.
- **Willmott, K.R., Lamas, G. & Hall, J.P.W. (2020)** The common, the rare, and the lost: Descriptions of twelve new species and three new subspecies of equatorial Ithomiini. *Tropical Lepidoptera Research* 30 (Suppl. 1): 1-49.
- **Willmott, K.R., Lamas, G. & Hall, J.P.W. (2021)** A new species and thirty-eight new subspecies of equatorial Ithomiini. *Tropical Lepidoptera Research* 31 (Suppl. 3): 1-80.
- **McClure, M. & Elias, M. (2017)** Ecology, life history, and genetic differentiation in Neotropical *Melinaea*. *Zoological Journal of the Linnean Society* 179(1): 110-141.
- **Grenié, M. et al. (2023)** Harmonizing taxon names in biodiversity data: a review of tools, databases and best practices. *Methods in Ecology and Evolution* 14: 12-25.

---

## Key Online Resources

- [nymphalidae.net Ithomiini Classification](http://www.nymphalidae.net/Nymphalidae/Classification/Dan_Ithomiini.htm)
- [Butterflies of America](https://www.butterfliesofamerica.com/)
- [Tree of Life — Ithomiini](http://tolweb.org/Ithomiini)
- [Florida Museum — Systematics of Neotropical Butterflies](https://www.floridamuseum.ufl.edu/neotropica/research/ithomiini/)
- [funet Lepidoptera Database](http://www.nic.funet.fi/pub/sci/bio/life/insecta/lepidoptera/)
- [GBIF Backbone Taxonomy](https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c)
