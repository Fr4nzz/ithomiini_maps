# Paper Context

This file preserves project context for the manuscript about the Ithomiini toolkit (AI Photo Processor, Wings Gallery, Ithomiini Maps). It survives context compaction across chat sessions.

## Project Overview

Three connected open-source apps covering the specimen-to-map pipeline for Ithomiini butterflies:
1. **AI Photo Processor** — Desktop app (Python/PyQt5) using Google Gemini AI to batch-read handwritten specimen IDs from wing photos and auto-rename files. Repo: https://github.com/Fr4nzz/rename_photos_AI
2. **Wings Gallery** — Serverless Vue.js gallery for browsing/filtering/sharing wing photos stored on Google Drive. Repo: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery
3. **Ithomiini Maps** — Interactive Vue.js/MapLibre mapping platform aggregating occurrence records from Dore et al., Sanger Institute, GBIF, iNaturalist, UNAM. Repo: https://github.com/rapidspeciation/ithomiini_maps (main repo, this one)

All hosted on GitHub Pages (free, serverless). Data pipelines run via GitHub Actions.

## Authors

- Franz Chandi (Universidad San Francisco de Quito) — lead developer
- Patricio A. Salazar Carrion (Dept. Zoology, Cambridge & Sanger Institute) — collaborator
- Joana I. Meier (Tree of Life Programme, Sanger Institute) — PI

## Target Journal

Tropical Lepidoptera Research (TLR), where Rosser & Mallet (2024) published "Interactive maps for visualizing geographic distributions and phenotypes" about Heliconius maps. Keith Willmott is Editor-in-Chief. The reference paper is saved as `Interactive maps for visualizing geographic distributions and phenotypes.md`.

## Patricio's Feedback (Key Points)

1. **Too technical / software-focused.** The manuscript leans too much toward software architecture and tools. TLR focuses on biology of tropical butterflies, so the paper needs more content on potential research uses of the platform.
2. **Dore dataset year.** Patricio unsure whether Dore dataset is actually from a 2025 paper (check: it's Dore et al. 2023, Ecology Letters).
3. **User perspective needed.** Suggested sharing prototype with Keith Willmott, Marianne Elias, and Andrei Freitas for usability feedback before publication.
4. **Potential data contributors.** Andrei Freitas and others may have unpublished curated data to add. If they contribute data, co-authorship would be appropriate.
5. **Reviewer suggestions.** Neil Rosser would be a great reviewer. Avoid Jim Mallet (known for heavy revisions).
6. **Group internal testing.** Also invite Karin, Fernando, Eva from the group to test.

## Joana's Feedback (WhatsApp Dec 31, 2025)

Feature requests (most now implemented):
- Legend customization to show only selected species (done)
- Country boundaries on satellite map (done)
- Export as vector format SVG/PDF (partially done via R script export)
- Fix confusing cluster numbers (in progress)
- Sex filter (done)
- Clarify whether data is live or snapshot (snapshot with manual update trigger)

## Features Status

### Implemented
- App themes (dark/light, multiple colors)
- Legend customization
- Country boundaries
- Map image export (PNG/JPG up to 300 DPI)
- R script export for vector output (partial)
- Sex filter
- Taxonomic cascading filters
- Sequencing status filters
- Mimicry ring selector
- Date range filter
- URL sharing (filter state in URL)
- Data table with photo thumbnails
- Image gallery
- Data export (CSV, GeoJSON)
- Citation generation with Git commit hash
- Point clustering
- Multiple base map styles

### Planned / In Progress
- Improved temporal filters (more user-friendly)
- Species distribution modeling (e.g., MaxEnt via GitHub Actions)
- Host plant distributions (known Ithomiini host plants, primarily Solanaceae)
- Historical climate data integration (ERA5-Land models)
- Fix cluster number confusion

## Manuscript

- `manuscript_draft.md` — current working version (single file, old versions deleted, history in git)

## Project Development Phases (Original Proposal)

Three incremental phases over 2-3 months (Dec 2024 - Feb 2025):
- **Month 1 (Core):** Map engine (Vue.js/Leaflet), taxonomy + CAMID + sequencing status filters, data pipeline (Python/Pandas), GitHub Pages deployment.
- **Month 2 (Scientific Utilities):** GBIF integration, mimicry ring filters, URL sharing, specimen image viewing, data tables, citation generation, export.
- **Month 3 (Advanced/Paper):** Taxonomic consistency handling, temporal analysis, species distribution modeling (SDMs), historical satellite layers, publication-ready maps.

Franz proposed budget: $900 USD/month, half-time (concurrent with Master's thesis on Insect AI taxonomic ID at USFQ).

## Project Importance (from proposal)

- Centralizes validated data from multiple sources (iNaturalist, GBIF, unpublished)
- Facilitates strategic species selection for research (sympatric/allopatric, endemism)
- Aids fieldwork planning based on historical abundance and accessibility
- Visualizes evolutionary patterns (gene flow, divergence, speciation)
- Generates publication-ready maps without GIS software
- Enables temporal analysis for climate change / urbanization studies

## Background Note

Franz's nephew originally planned this as undergraduate thesis but changed topic due to rigid tutor requirements (complex login protocols, no R/Shiny). Franz took over using Vue.js + GitHub Pages approach already proven with the Wings Gallery migration.

## Related Files in paper/

- `Photos Processing Protocol.md` — Step-by-step protocol for wing photography to gallery pipeline. Joana suggested publishing separately on protocols.io. Could cite as "in prep" and reference key info here.
- `Interactive maps for visualizing geographic distributions and phenotypes.md` — AI-readable version of Rosser & Mallet (2024) reference paper from TLR.
- `generate_statistics.py`, `statistics.json`, `statistics_report.txt` — Data stats generation tools.

## External Repos to Clone (for fact-checking manuscript)

Clone into `paper/external_repos/` (gitignored):
- `https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery` — Wings Gallery
- `https://github.com/Fr4nzz/rename_photos_AI` — AI Photo Processor

## Writing Style Guidelines

### Voice and Register
- Prefer active voice, but use passive when it is shorter or sounds more natural. Replace vague/fuzzy verbs with specific, informative ones, but only when the result sounds human (not mechanical).
- Common English words (authors are non-native speakers, text should sound natural and human-made).
- Technical terms allowed but explain niche concepts so text is didactic.
- Avoid jargon, em dashes, overuse of lists/tables. Prefer flowing paragraphs.
- Remove information not relevant to a biology audience (per Patricio's feedback: TLR readers care about research applications, not software architecture).

### Structure
- **Funnel shape:** Broad introduction, narrow to specifics, widen again in conclusion so the discussion supports the conclusion's broad impact.
- Each paragraph starts with a topic sentence that introduces what the paragraph is about and ends with a conclusion.
- Each section (and the manuscript as a whole) poses a problem that creates curiosity, then satisfies it with a solution/answer. Open-ended problems are fine.
- Manuscript follows a problem-solution arc at every level: whole paper, each section, each paragraph.

### Conciseness Techniques (Human, Not AI)
1. **Replace vague magnifiers with precise data** (or remove redundant data). Pick the right detail, don't strip all detail.
2. **Replace metaphors with technical terms** -- saves words AND increases precision. Trading a metaphor for the correct term gains register consistency even when it doesn't save words.
3. **Swap wordy time/method phrases** for compact natural equivalents (e.g., "in early 2026" not "between January and February 2026").
4. **Remove redundant framing** -- cut "what this means is" / "it is important to note that" scaffolding.
5. **Cut STRUCTURE words, not CONTENT words.** Keep adjectives, examples, explanatory asides. Remove scaffolding ("In other words," "This is significant because"). Don't collapse "X did Y, which showed Z" into "X demonstrated Z" -- the middle clause often contains important reasoning.
6. **Never remove hedging, qualifiers, or attribution** -- these make academic writing sound human.
7. **Combine sentences** when one already implies the other.
8. **Sentence length variation is a key human-writing signal.** Mix short punchy sentences among longer ones.

### What NOT to Do (Avoid AI Conciseness Patterns)
- Don't strip adjectives/adverbs globally
- Don't collapse reasoning chains into dense noun phrases
- Don't remove transition sentences between paragraphs
- Don't replace specific citations with "studies show"
- Don't convert natural phrasing into nominalized jargon (e.g., "planting trees along riverbanks" not "riparian reforestation implementation")
- Don't eliminate sentence length variation

## Key Improvements Applied (v5 to current)

Patricio's main concern was addressed: paper was too software-focused for TLR (biology journal). Changes made:
1. **Expanded research use cases** — Added Section 3.5 with mimicry ring biogeography, sequencing gap analysis, taxonomic verification, cross-source comparison
2. **Added biological context** — More Ithomiini ecology, why tools matter for evolutionary biology
3. **Reduced software architecture detail** — Trimmed implementation specifics, kept reproducibility info
4. **Referenced Photos Processing Protocol** — Cited as separate publication (Chandi et al., in prep)
5. **Energized writing** — Active voice, specific verbs, flowing paragraphs, funnel structure
6. **Fixed factual errors** — Google Drive (not Cloud), 5 tabs (not 4), Gemini 3 Flash model name
7. **Removed multi-API key rotation mention** — Potentially against Google TOS

## Additional Reference Papers

- Rosser & Mallet (2024) "Interactive maps for visualizing geographic distributions and phenotypes" -- TLR, 34(2), 104-107. DOI: 10.5281/zenodo.13920055 (saved as md in paper/)
- Rosser et al. (2012) "Testing historical explanations for gradients in species richness in heliconiine butterflies of tropical America" — Biol J Linn Soc, 105(3), 479-497
