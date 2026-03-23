# Paper Context

Context file for the Ithomiini toolkit manuscript (AI Photo Processor, Wings Gallery, Ithomiini Maps). Preserves project state across chat sessions.

## Three Apps

1. **AI Photo Processor** — Desktop (Python/PyQt5), uses Google Gemini AI to batch-read handwritten specimen IDs from wing photos, auto-rename files. 900 images/day free. Repo: https://github.com/Fr4nzz/rename_photos_AI
2. **Wings Gallery** — Serverless Vue.js gallery for browsing/filtering wing photos stored on Google Drive. Repo: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery
3. **Ithomiini Maps** — Vue.js/MapLibre mapping platform, 104,382 occurrence records from 5 sources (Dore et al. 2023, Sanger Institute, iNaturalist, GBIF-UNAM, GBIF-Other). 849 species, 33 countries. Live: https://rapidspeciation.github.io/ithomiini_maps/ Repo: https://github.com/rapidspeciation/ithomiini_maps

All on GitHub Pages (free, serverless). Data pipelines via GitHub Actions. Only cost: Google Drive storage.

## Authors

- Franz Chandi (USFQ, Quito) — lead developer, Master's student
- Patricio A. Salazar Carrión (Cambridge/Sanger) — collaborator
- Joana I. Meier (Sanger/Cambridge) — PI, funder ($950/month)

## Target Journal

Tropical Lepidoptera Research (TLR). Reference: Rosser & Mallet (2024) "Interactive maps for visualizing geographic distributions and phenotypes," TLR 34(1), 26-30. Keith Willmott is TLR Editor-in-Chief. Neil Rosser suggested as reviewer.

## Joana's Unresolved Comments on Manuscript (Mar 1, 2026)

These are inline comments in manuscript.md that still need addressing:

- **id="0"**: Intro paragraph about R-Shiny on EC2 — Joana asks "citations?" for the server hosting claim. Franz replied he was referring to old Wings Gallery versions and added Heliconius maps citation.
- **id="2"**: Section 1 end, "Chandi et al., in prep" — Joana asks "will this be a protocols.io paper? Why not make it part of this paper?"
- **id="3"**: Section 2.1 — "all of these require citations" (Vue.js, Python, Pandas, GitHub Pages, GitHub Actions).
- **id="4/5"**: Section 2.2 — Joana says Windows download link is broken. Franz says fixed, plans web version soon.
- **id="6"**: Section 2.3 — Joana asks about Wings Gallery replacing R-Shiny version: "so this is your own tool? If so, you should not mention it here or in the Introduction." (Unclear what she means — may need clarification.)
- **id="7"**: Section 2.5 GBIF data — Joana: "It would be great to include the data from Brown's thesis in collaboration with André Freitas."
- **id="8"**: Section 3.2 — Joana flags sequencing numbers as wrong: "this cannot be true. I am not sure where this information comes from. We have sequenced way less." Must verify/fix.
- **id="11"**: Section 4.2 (AI discussion) — Joana: "this is all nice but feels a bit repetitive. It has all already been written above." Consider cutting or heavily condensing.
- **id="12"**: Section 4.4 — Joana suggests adding: ecological distribution modeling (not just visualize occurrences but where species likely occur), and genomic info from GoaT (Genomes on a Tree) — chromosome count, genome size, reference genome availability.
- **id="13"**: Section 4.4 last paragraph — Joana: "This is already written above and can thus be removed here." (About replicability/adapting to other taxa.)
- **id="14"**: Section 6 (Data Availability) — Joana: "here you should only describe data that was produced by us. Doré et al was already cited above and GBIF as well. That should be part of methods not the data availability statement."

## Patricio's Feedback (Key Points, Feb 3 2026)

1. Paper too software-focused for TLR (biology journal) — needs more research use cases. *Partially addressed: Section 3.5 added.*
2. Dore dataset is 2023, Ecology Letters (not 2025). *Fixed.*
3. Suggested sharing prototype with Keith Willmott, Marianne Elias, Andrei Freitas for feedback. Also group members Karin, Fernando, Eva.
4. Andrei/others may have unpublished data → co-authorship if contributed.
5. Neil Rosser good reviewer. Avoid Jim Mallet (heavy revisions).
6. Joana also suggested Kanchon and Chris Jiggins/Nicola Nadeau (collections on Earthcape: https://heliconius.ecdb.io/).

## Meeting Status (as of Mar 2026)

Joana proposed Thu Mar 19 and Fri Mar 20, 7-8am Ecuador/Florida, 9-10am Campinas, 12-1pm UK, 1-2pm France for collaborator demo meeting. Franz's schedule: classes 8:30am-1pm Ecuador, available 7-8am or 2-3pm.

## Latest Updates (Mar 2026)

- Eva added specimens from Surinam and Guyana; Franz updated database (Mar 15).
- "Update database" button now works (password: Hyalyris).
- Joana paid Feb+Mar invoices ($950/month).
- Joana requested colorblind-safe default palettes.
- Joana flagged sequencing status numbers in manuscript as too high — must verify.

## Implemented Features

App themes, legend customization, country boundaries, map export (PNG/JPG 300 DPI), R script export (partial), sex filter, cascading taxonomy filters, sequencing status filters, mimicry ring selector, date range slider, URL sharing, data table with thumbnails, image gallery, CSV/GeoJSON export, citation with Git hash, point clustering, heatmap visualization, 5 base map styles, time slider, legend grouping by sequencing status or mimicry rings.

## Planned Features

Improved temporal filters, improve R code export (currently partial), species distribution modeling (MaxEnt via GitHub Actions), host plant overlays (Solanaceae), historical climate data (ERA5-Land), ecological distribution modeling (predict where species likely occur, not just observed), GoaT genomic data integration (chromosomes, genome size, reference genome availability), historical satellite layers (compare habitat/forest cover across years), polygon-based distribution maps for publications, fix cluster number confusion, colorblind-safe default palettes, web version of AI Photo Processor.

**Potential new data sources:** Brown's thesis data via André Freitas (Joana's request), Chris Jiggins/Nicola Nadeau collections (currently on Earthcape: https://heliconius.ecdb.io/), Kanchon's and Chris's large collections (Joana's suggestion).

## Key Improvements Already Applied (earlier versions → current)

- Expanded research use cases (Section 3.5: mimicry ring biogeography, sequencing gaps, taxonomic verification, cross-source comparison)
- More biological context, less software architecture
- Photos Processing Protocol cited as separate publication (Chandi et al., in prep)
- Active voice, specific verbs, funnel structure
- Fixed: Google Drive (not Cloud), 5 tabs (not 4), removed multi-API key rotation mention (TOS concern)

## Manuscript Structure

1. Introduction — fragmented workflows → why we built this → toolkit overview
2. Methods: 2.1 Architecture, 2.2 AI Photo Processor, 2.3 Wings Gallery, 2.4 Photography workflow, 2.5 Specimen Maps (data sources, taxonomic curation, web interface, deployment)
3. Results: 3.1 Data Summary (Table 1), 3.2 Sequencing Status, 3.3 Taxonomic Curation (Table 2), 3.5 Research Applications
4. Discussion: 4.1 Comparison with existing tools, 4.2 AI-assisted renaming (Joana says repetitive), 4.3 Sustainability/reproducibility, 4.4 Limitations/future directions
5. Conclusions, 6. Data Availability, 7. Acknowledgments, References

## Data Stats (Table 1)

Dore et al. 2023: 28,927 records, 387 spp. Sanger: 7,265, 513 spp. iNaturalist: 19,901, 252 spp. GBIF-UNAM: 21,586, 35 spp. GBIF-Other: 28,182, 428 spp. Total merged: 105,861 records, 849 spp, 1,380 subspp, 184 genera, 33 countries.

## Related Files

- `Photos Processing Protocol.md` — photography-to-gallery protocol. Joana suggested protocols.io or include in paper.
- `Interactive maps for visualizing geographic distributions and phenotypes.md` — Rosser & Mallet 2024 reference.
- `generate_statistics.py`, `statistics.json` — data stats generation.

## Writing Style

**Voice:** Prefer active voice, but use passive when it is shorter or sounds more natural. Common English (non-native authors — text should sound like we wrote it). Technical terms OK but explain niche concepts. Avoid jargon, em dashes, excessive lists. Flowing paragraphs over bullet points.

**Structure:** Funnel shape (broad intro → narrow specifics → broad conclusion). Each paragraph: topic sentence → body → conclusion. Problem-solution arc at every level (paper, section, paragraph).

**Conciseness (human, not AI):**
- Replace vague magnifiers with precise data (or vice versa when data is redundant)
- Replace metaphors with technical terms for precision
- Swap wordy phrases for compact natural equivalents
- Remove scaffolding ("It is important to note that," "What this means is") but keep content words, hedging, qualifiers, attributions
- Combine sentences when one implies the other
- Vary sentence length (short punchy + longer explanatory)

**Key examples from past edits (illustrate preferred style):**
- "spilling across a floodplain the size of England" → "flooding millions of hectares of surrounding lowlands" (replace literary metaphor with precise data)
- "turning what should function as living corridors into dead ends" → "converting what should function as migration corridors into population sinks" (replace metaphor with actual ecological term, even if same word count)
- "between January and February 2026" → "in early 2026" (nobody talks like the first version)
- BAD AI conciseness: "Dams fragment rivers. Fish decline." (stripped too much, sounds robotic)
- GOOD human conciseness: "Dams sever the longitudinal corridors migratory fish depend on." (kept specificity, removed nothing meaningful)
- "Sediment carried thousands of kilometers from the Andes" → "Sediment carried from the Andes" (the Andes already implies distance, "thousands of kilometers" was filler)
- "planting trees along riverbanks" stays as-is, never convert to "riparian reforestation implementation"
- Don't collapse "X did Y, which showed Z" into "X demonstrated Z" — the middle clause often has important reasoning

**Do NOT:**
- Strip adjectives/adverbs globally or collapse reasoning chains
- Remove transition sentences between paragraphs
- Replace specific citations with "studies show"
- Convert natural phrasing to nominalized jargon
- Use AI-typical phrases ("To maximize accessibility," "ensuring full traceability")
- Over-explain obvious things or add marketing-speak
- Remove hedging, qualifiers, or attribution phrases — these make academic writing sound human

**Word preferences:** "ID" over "identifier," "irrelevant" over "extraneous," simple verbs. Keep some details vague when specificity could cause policy/TOS issues.