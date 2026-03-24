# Proposed Manuscript Edits

Instructions: Use Ctrl+F in Google Docs to find the **FIND** text, then replace with the **REPLACE** text. Review each one before accepting.

---

## Edit 1 — Add software citations (Joana comment id="3", Section 2.1)

**Comment:** "all of these require citations" (Vue.js, Python, Pandas, GitHub Pages, GitHub Actions)

**FIND:**
```
Vue.js 3 for the web interface, Python with Pandas for data processing, GitHub Pages for hosting, and GitHub Actions for one-click data updates.
```

**REPLACE:**
```
Vue.js 3 (You, 2014) for the web interface, Python (Van Rossum & Drake, 2009) with Pandas (McKinney, 2010) for data processing, GitHub Pages (https://pages.github.com) for hosting, and GitHub Actions (https://github.com/features/actions) for one-click data updates.
```

**Add to References:**
```
McKinney, W. (2010). Data Structures for Statistical Computing in Python. Proceedings of the 9th Python in Science Conference, 56–61. https://doi.org/10.25080/Majora-92bf1922-00a

Van Rossum, G. & Drake, F.L. (2009). Python 3 Reference Manual. CreateSpace.

You, E. (2014). Vue.js: The Progressive JavaScript Framework. https://vuejs.org
```

**Note:** GitHub Pages and GitHub Actions don't have traditional academic citations — URLs are appropriate here. If the journal requires formal citations for all software, we could cite GitHub's documentation instead.

---

## Edit 2 — Remove repetitive Section 4.2 (Joana comment id="11")

**Comment:** "this is all nice but feels a bit repetitive. It has all already been written above."

The entire Section 4.2 repeats what's already covered in Sections 2.2 (methods) and 4.1 (comparison). I propose replacing it with a short paragraph that adds only what's new — the broader implications.

**FIND:**
```
## 4.2 AI-Assisted Specimen Photograph Renaming

The AI Photo Processor applies generative AI to a practical bottleneck in biodiversity research: reading handwritten specimen labels from photographs. Traditional text recognition struggles with handwriting, but generative AI models can interpret identifiers within their visual context without needing to isolate the text first. These models can even read labels where researchers have crossed out mistakes and corrected them, a common occurrence in handwritten specimen records. Since errors still occur, the application includes a human validation step where researchers review and correct the AI's readings before files are renamed. This step is still substantially faster than reading and typing each identifier manually.

The grid-based approach combines multiple images into a single composite before sending to the AI, making practical use of each API request. Processing 45 images per request under the free tier means a single day's quota handles roughly 900 images at no cost. Because the prompt is customizable, this approach extends beyond entomological collections to any specimen-based research that uses handwritten labels.
```

**REPLACE:**
```
## 4.2 AI-Assisted Specimen Photograph Renaming

The success of generative AI for reading handwritten specimen labels suggests broader applications in natural history collections. As these models improve, accuracy on degraded or faded labels should increase, potentially reducing the need for human validation. The customizable prompt system means the same tool could be adapted to read other types of specimen information — locality data, collector names, or dates — without changes to the underlying software.
```

---

## Edit 3 — Remove redundant paragraph in Section 4.4 (Joana comment id="13")

**Comment:** "This is already written above and can thus be removed here."

**FIND:**
```
As described in Section 4.3, the modular architecture means the platform could be adapted to other Lepidoptera, other organism groups, or even non-biological specimen collections, following the open-source spirit encouraged by Rosser & Mallet (2024).
```

**REPLACE:**
(Delete entirely — this paragraph should be removed. The same point is made in Section 4.3.)

---

## Edit 4 — Fix Data Availability Statement (Joana comment id="14")

**Comment:** "here you should only describe data that was produced by us. Doré et al was already cited above and GBIF as well. That should be part of methods not the data availability statement."

**FIND:**
```
## 6. Data Availability Statement

The Sanger Institute collection data shown in Specimen Maps is available upon request from the corresponding research group. All source code, processed data files, and the data processing pipeline are available in the GitHub repositories listed above. Version-specific data can be retrieved using the Git commit hashes included in the application's citation system.
```

**REPLACE:**
```
## 6. Data Availability Statement

The Sanger Institute collection data shown in Specimen Maps is available upon request from the corresponding research group. All source code and data processing pipelines are available in the GitHub repositories listed in Section 5. The web applications and their current datasets are accessible at the URLs provided throughout the text. Version-specific states of the applications can be retrieved using the Git commit hashes included in each application's citation system.
```

---

## Edit 5 — Sequencing numbers need verification (Joana comment id="8")

**Comment:** "this cannot be true. I am not sure where this information comes from. We have sequenced way less."

This is in Section 3.2. I can't fix the numbers — you need to verify with Joana what the correct sequencing counts are. The current text says:

> Of the 6,273 Sanger Institute specimens, 2,074 (33.1%) have been sequenced, 2,659 (42.4%) have tissue submitted to the Tree of Life sequencing pipeline, 1,105 (17.6%) have tissue available for future sequencing, and 435 (6.9%) are preserved specimens waiting for tissue extraction.

**Action needed:** Check how sequencing status is assigned in the data pipeline. The numbers come from the Sanger Google Sheet — the classification logic (tube rack = "Sequenced", tissue sample = "Tissue Available", etc.) may be too aggressive. Discuss with Joana what the real breakdown should be.

---

## Edit 6 — "Chandi et al., in prep" and protocols.io (Joana comment id="2")

**Comment:** "will this be a protocols.io paper? Why not make it part of this paper?"

No text change proposed — this needs a decision from you and Joana:
- **Option A:** Include the photography protocol as supplementary material in this paper (remove the "Chandi et al., in prep" citation, add as Supplementary Material S1 — which the text already references in Section 2.4)
- **Option B:** Keep it as a separate protocols.io publication

The text in Section 2.4 already says "We provide a detailed protocol as supplementary material" — so if you go with Option A, you just need to remove the "Chandi et al., in prep" reference from the end of the Introduction and make sure the protocol is actually included as S1.

---

## Edit 7 — Wings Gallery mention (Joana comment id="6")

**Comment:** "so this is your own tool? If so, you should not mention it here or in the Introduction."

I think Joana may be confused — the Wings Gallery IS your tool and IS part of this paper. The comment might be about the R-Shiny predecessor. The current text says:

> replaces an earlier R-Shiny version that faced the accessibility and performance limitations described in the Introduction

**Suggested clarification:** No text change needed, but you should reply to Joana's comment in Google Docs clarifying that the Wings Gallery is indeed one of the three tools presented in this paper, and the sentence is explaining that it replaces your own earlier R-Shiny version.

---

## Edit 8 — Brown's thesis data (Joana comment id="7")

**Comment:** "It would be great to include the data from Brown's thesis in collaboration with André Freitas."

No text change — this is a data integration request. If/when the data is obtained and integrated, the text in Section 2.5 would need to add it as a sixth data source with its own description paragraph, and Table 1 would need updating.

---

## Not addressed (positive comments, no changes needed)
- Comment id="9": "very nice!" (Section 3.5, sequencing gap analysis) ✅
- Comment id="10": "also great points!" (Section 3.5, temporal analysis) ✅
- Comment id="12": Feature suggestions for ecological distribution modeling and GoaT — future work, not text edits
