# Review Ithomiini manuscript and figures

- Harness: `claude-code-ithomiini`
- Session ID: `1d1ffc5c-06df-4e05-8ee1-a5578d64de6e`
- Source: `franz-laptop:/home/franz/.claude/projects/-home-franz-Documents-ManuscriptFiguresIthomiini-maps/1d1ffc5c-06df-4e05-8ee1-a5578d64de6e.jsonl`

## Turn 1

### User, 2026-07-08T20:14:59.163000Z (2026-07-08T15:14:59.163000-05:00)

Review this manuscript and give suggestions to improve writing, also I attach code to generate potential figures to add to the manuscript but treat them just as ideas and come up with your own figures

### Final response, 2026-07-08T20:15:31.250000Z (2026-07-08T15:15:31.250000-05:00)

Let me look at the generated figures to understand the current visual proposal.

## Turn 2

### User, 2026-07-08T20:15:32.569000Z (2026-07-08T15:15:32.569000-05:00)

[Image: original 1560x3303, displayed at 945x2000. Multiply coordinates by 1.65 to map to original image.]

### Final response, 2026-07-08T20:17:29.490000Z (2026-07-08T15:17:29.490000-05:00)

I ran your figure script and reviewed the rendered output alongside the manuscript. Here's my assessment, split into writing and figures. This is advisory — I haven't changed any files.

## Writing suggestions

**Things to fix before submission (these will get flagged by reviewers/editors):**

1. **Four in-text citations are missing from the reference list.** The introduction cites `McClure et al. (2019)`, `Gauthier et al. (2023)`, `van der Heijden et al. (2025)`, and `Ben Chehida et al. (2026)`, but none appear in Section 8. Add them.

2. **The reference list isn't in a single alphabetical order.** It runs A–W once (Ahrens → Wisz), then restarts (Challis → You). Merge into one alphabetical sequence.

3. **Author-name inconsistency for a key citation.** In-text is "Doré et al. (2023)" but the reference entry reads "Dore, M." (missing accent). Make them match.

4. **Repository/URL inconsistency.** The deployed apps live under `rapidspeciation.github.io`, but the Data Availability statement points to `github.com/Fr4nzz/ithomiini_maps` and `github.com/Fr4nzz/rename_photos_AI`, while the gallery is `rapidspeciation/Shiny_Ikiam_Wings_Gallery`. Readers will be confused about which org owns what. Reconcile owner names, or state explicitly that the canonical repo is mirrored/deployed under a different org.

5. **Verify the model/version names.** `YOLO26s-seg`, `SAM3-style`, and `BioCLIP 2.5-H` (`bioclip-2.5-vith14`) don't match publicly released version numbers I'm aware of (YOLO releases, SAM 2, BioCLIP 2). If these are your internal names or fine-tunes, say so; otherwise a reviewer who knows the tooling will question them. Also give BioCLIP and YOLO proper citations.

6. **`biodiversity-aq/rename-photos-ocr` and `Earthcape` are named without citations** (Section 4.1). Add references or footnotes with URLs.

7. **Two unresolved placeholders remain:** `[Insert updated Figure 1 overview here.]` and `[Additional acknowledgments to be added.]`.

**Consistency / polish:**

8. **Heading formatting is inconsistent.** Sections 2.1–2.3 are bold (`## **2.3 Wings Gallery**`) but 2.4–2.5 are not. Within 2.5, some subsections use `###` (Data sources…) while others are just bold paragraphs (`**Occurrence filtering**`, `**Host-plant records**`). Pick one heading level scheme and apply it throughout.

9. **US/UK spelling is mixed** — "colour", "organised", "customise" (UK) alongside "standardize", "standardizing" (US). Choose one convention (most journals want consistency) and sweep.

10. **In Section 3.4 the percentages don't obviously close.** Verified (83.3%) + unresolved/ambiguous (10.3%) = 93.6%; consider stating what the remaining ~6.4% are so the reader isn't left doing the subtraction.

**Structural / style:**

11. **The abstract is one dense 250+ word paragraph** ending in a table-of-contents-style list ("…photography-to-gallery protocol, database update workflow, AI-assisted identification pipeline, taxonomic curation, occurrence filtering, host-plant compilation, plant-occurrence layers, and species distribution model display logic…"). Cut that closing enumeration — it repeats what the body covers and adds no information a reader can use.

12. **The full feature litany is repeated ~5 times** ("taxonomic filters, mimicry-ring selectors, sequencing-status indicators, genomic metadata from GoaT, relative habitat-suitability layers, host-plant records, plant occurrence layers…") — in the abstract, intro, Section 3.7/web-interface, discussion, and conclusion. State it fully once, then refer back briefly. This is the single biggest source of the manuscript feeling long.

13. The numbers I could cross-check all reconcile (host-plant records 675+151+37=863; support categories sum to 863; SDM 44+38+73=155; AI label space matches the data file; Table 1 matches Section 3.1). Nice internal consistency — worth protecting by keeping figures data-driven from `figure_data.json` as you already do.

## Figures

Your four figures are well-made — clean, colourblind-safe, honest scales (the "independent scales" warning on Fig 3 and the ToLID caveat on Fig 4 are exactly right). Keep them largely as-is. But treated as a **figure plan for a tools/resource paper, the set has one critical gap: there is not a single screenshot of any actual interface.** For this genre, that's the most important thing reviewers want to see. Everything you're describing is visual and interactive, yet the reader never sees the map, the gallery, or a popup.

Here's the figure set I'd propose instead (my own, using yours as building blocks):

- **Figure 1 — Architecture overview.** Keep yours nearly unchanged; it's the strongest of the four and does real work. Only tweak: the AI Identifier green tag hanging off Wings Gallery is slightly cramped — give it a touch more room.

- **Figure 2 — The actual Wings Atlas map (real screenshot), annotated.** This is the figure the paper is missing. One full-width map screenshot coloured by mimicry ring (or sequencing status), with callouts pointing to the sidebar filters, a expanded cluster, an open popup showing a wing photo + metadata, and the SDM opacity control. This single figure demonstrates the integration claim better than any diagram. I can't produce this — it needs a screenshot from you.

- **Figure 3 — A worked "one species, all layers" use case (screenshots).** Pick one well-sampled species and show a 3-panel strip: (a) occurrence points by source, (b) the SDM suitability raster + accessible-area view, (c) host-plant occurrence layer overlaid. This turns the abstract "integration" narrative into something concrete and is far more persuasive than listing features. Also a screenshot composite.

- **Figure 4 — AI Identifier pipeline + accuracy.** Keep your current Figure 2 — it's good. Consider adding one real example (an uploaded wing photo → cropped wing → ranked candidate list) as a small inset, which pairs the schematic with reality.

- **Figure 5 (supplementary or main) — Data summary.** Merge your current Fig 3 (records vs species by source) and Fig 4 (sequencing funnel) into a single multi-panel "dataset at a glance" figure. They're both bar charts of the same dataset and don't each need to be a full main-text figure. This frees a main-text slot for the screenshots above.

One idea worth adding if you want a genuinely new analytical figure: a **small-multiples or single Neotropical map of sampling density / gaps** built from the occurrence coordinates (or even just a country-level choropleth from your per-country counts) — it visually motivates the "identify under-sampled regions" use case that Section 4.2 sells in prose only.

I can implement any of these against your existing `make_figures.py` framework (it's clean and I'd extend the same SVG helpers and `figure_data.json` pattern) — the data-driven bar/pipeline figures I can build now; the screenshot-based ones I'd need images from you. Want me to start on the merged data-summary figure and a country-level sampling map?
