# Paper Context

This file preserves project context for the manuscript about the Ithomiini toolkit (AI Photo Processor, Wings Gallery, Ithomiini Maps). It survives context compaction across chat sessions.

## Project Overview

Three connected open-source apps covering the specimen-to-map pipeline for Ithomiini butterflies:
1. **AI Photo Processor** — Desktop app (Python/PyQt5) using Google Gemini AI to batch-read handwritten specimen IDs from wing photos and auto-rename files. Repo: https://github.com/Fr4nzz/rename_photos_AI
2. **Wings Gallery** — Serverless Vue.js gallery for browsing/filtering/sharing wing photos stored on Google Cloud. Repo: https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery
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

## Manuscript Versions

- `manuscript_draft.md` through `manuscript_draft_v4.md` — old versions, ignore
- `manuscript_draft_v5.md` — current working version, base for v6
- Target: produce `manuscript_draft_v6.md` with improvements

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
- Active voice, not passive. Replace vague verbs with specific, energizing ones.
- Common English words (authors are non-native speakers, text should sound natural).
- Technical terms allowed but explain niche concepts so text is didactic.
- Avoid jargon, em dashes, overuse of lists/tables. Prefer flowing paragraphs.

### Structure
- **Funnel shape:** Broad introduction, narrow to specifics, widen again in conclusion.
- Each paragraph starts with a topic sentence and ends with a conclusion.
- Each section poses a problem that creates curiosity, then satisfies it with a solution.
- Manuscript as a whole follows the same problem-solution arc.

### Conciseness Techniques (Human, Not AI)
1. **Replace vague magnifiers with precise data** (or remove redundant data). Pick the right detail, don't strip all detail.
2. **Replace metaphors with technical terms** — saves words AND increases precision.
3. **Swap wordy time/method phrases** for compact natural equivalents (e.g., "in early 2026" not "between January and February 2026").
4. **Remove redundant framing** — cut "what this means is" / "it is important to note that" scaffolding.
5. **Cut STRUCTURE words, not CONTENT words.** Keep adjectives, examples, explanatory asides. Remove scaffolding ("In other words," "This is significant because").
6. **Never remove hedging, qualifiers, or attribution** — these make academic writing sound human.
7. **Combine sentences** when one already implies the other.

### What NOT to Do (Avoid AI Conciseness Patterns)
- Don't strip adjectives/adverbs globally
- Don't collapse reasoning chains into dense noun phrases
- Don't remove transition sentences between paragraphs
- Don't replace specific citations with "studies show"
- Don't convert natural phrasing into nominalized jargon
- Don't eliminate sentence length variation

## Key Improvement for v6

Patricio's main concern: the paper reads like a software paper, but TLR publishes biology. The v6 must:
1. **Expand research use cases** — Show how the platform enables specific biological questions (mimicry ring biogeography, sequencing gap analysis, species range overlap, etc.)
2. **Add biological context** — More about Ithomiini ecology, why these tools matter for evolutionary biology
3. **Reduce software architecture detail** — Keep enough for reproducibility but trim implementation specifics
4. **Reference the Photos Processing Protocol** — Cite as separate publication (protocols.io, in prep) rather than duplicating content
5. **Energize the writing** — Active voice, specific verbs, flowing paragraphs, funnel structure
