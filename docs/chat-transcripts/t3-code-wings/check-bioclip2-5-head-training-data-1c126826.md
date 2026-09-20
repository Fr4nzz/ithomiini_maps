# Check BioCLIP2.5 head training data

- Harness: `t3-code-wings`
- Session ID: `1c126826-5851-45c8-856b-692c67ecea99`
- Source: `/home/franz/.t3/userdata/state.sqlite`

## Turn 1

### User, 2026-07-11T13:21:09.435000Z (2026-07-11T08:21:09.435000-05:00)

Hi, I want you to continue the Wings Classifier project, check these: Primary WingsClassificator session
Session:

c41a1b4d-fbe2-4b34-9fd9-d0bebed514d5


Raw JSONL:

/home/franz/.claude/projects/-home-franz-Documents-CodeProjs-WingsClassificator/c41a1b4d-fbe2-4b34-9fd9-d0bebed514d5.jsonl


Current raw line count:

7,345


Summary coverage:

1–7,344


Line 7,345 is only last-prompt metadata, not a new conversation message. Therefore, the summaries are substantively current with the entire session.

Later cross-session continuation
Some WingsClassifier work continued in the general Claude session:

ae954746-5a15-42c7-9d36-fab9aa279500


Raw JSONL:

/home/franz/.claude/projects/-home-franz/ae954746-5a15-42c7-9d36-fab9aa279500.jsonl


Current raw EOF:

11,854


Its WingsClassifier-relevant section is summarized through:

10,824–11,854


So that continuation is also current.

Latest summary entry point
/home/franz/Documents/CodeProjs/WingsClassificator/context/claude_code_compactions_20260626/MASTER_WINGSCLASSIFICATOR_HANDOFF_INDEX.md


The newest cross-session handoff is:

/home/franz/Documents/CodeProjs/WingsClassificator/context/claude_code_compactions_20260626/ae954746_wingsclassificator_followup_20260630/HANDOFF_ae954746_WINGSCLASSIFICATOR_FOLLOWUP_20260630.md


The Hermes follow-up covering PDF cleanup and the corrected HF deployment is:

/home/franz/Documents/CodeProjs/WingsClassificator/context/claude_code_compactions_20260626/c41a1b4d_wingsclassificator/hermes_addendum_after_7344_20260630/HANDOFF_HERMES_AFTER_C41_7344_PDF_HEAD_FIXES.md


One nuance
Later Insect AI thesis sessions reference the WingsClassifier as a design pattern, especially for:

OOF label correction;
mask review;
SAM3/YOLO wing-mask provenance;
explaining how bad PDF diagrams were excluded.(1/2)
Those later sessions did not make new WingsClassifier model/app changes. They belong in the Insect AI thesis summaries rather than the WingsClassifier session summary.

Therefore: yes, the WingsClassifier summaries are up to date with both its primary session and its substantive cross-session continuation. (2/2)
---
I want you to check if the latest bioclip2.5-h classification head was trained excluding maps and diagrams, the latest yolo segmentation model I think excluded those but I am not sure if the classification head was trained excluding those bad images

### Final response, 2026-07-11T13:23:37.471000Z (2026-07-11T08:23:37.471000-05:00)

Confirmed. Here's the answer with evidence.

## Yes — the latest BioCLIP‑2.5‑H head was trained excluding maps and diagrams

The deployed head is the **7,292‑leaf, moth‑inclusive** `head_hier.pt` (a BioCLIP‑2.5‑H frozen backbone + hierarchical CosineHead — `hf-space/inference.py:203` loads `imageomics/bioclip-2.5-vith14`). It was trained on the cleaned combined manifest, and the map/diagram exclusion is baked into three separate filters in `ithomiini_maps/scripts/training/prepare_training_dataset.py`:

1. **`EXCLUDE_PDF_SOURCES`** — drops all crude pdfimages PDF‑plate extractions (`miller-dioptinae-pt1/pt2`, `mimallonidae-stlaurent`, `dynastinae-synopsis`, `seitz-vol6`, `cock-trinidad-sphingidae`, `apatelodidae-becker`, `nystaleinae-notodontidae`, `zk25323`). Those are the cladogram/diagram/plate PDFs.
2. **`MAP_RE` + `LINEART_DROP`** — `moth_rows()` drops distribution maps and content‑detected line‑art/morphology figures. This came from the validated cv2 `filter_line_art.py` run that dropped **461 diagram images** (seitz 379, cock‑trinidad 41, dynastinae 31, miller 10). The moth loader prints `"N maps, N line-art dropped"`.
3. **MinerU replacement** — the only PDF‑derived rows retained are **40 clean MinerU Cock‑Trinidad singles** (individual specimen crops, plates excluded).

### Direct verification of the live manifest
`ithomiini_maps/.../training/training_manifest.csv` (144,898 rows, the moth‑inclusive one behind the 7,292‑leaf head):

```
cock-trinidad-sphingidae : 0     seitz-vol6 : 0
miller-dioptinae-pt1/pt2 : 0     apatelodidae-becker : 0
mimallonidae-stlaurent   : 0     nystaleinae-notodontidae : 0
dynastinae-synopsis      : 0     zk25323 : 0
mineru (clean singles)   : 40
```

`by_source` in `training_summary.json` shows only real photo sources (sti‑sphingidae, sphingidae.us, brazilhawkmoths, mothphotographersgroup, etc.) plus the 40 mineru singles — **zero** diagram/plate PDF rows.

So your recollection is right on both counts: the **YOLO wing‑seg** drops maps/diagrams at inference, **and** the **classification head's training manifest** independently excludes them at data‑prep time. No retrain is needed for this.

### Two caveats worth flagging
- **Provenance is indirect, not from a local file.** The head was trained on the Sanger cluster and the resulting `.pt` was uploaded straight to HF (`fr4nzzch/butterfly-id-classifier`, 31.4 MB, 7,292 leaves). The `head_hier.pt` still sitting in your local training dir and in `hf-space/assets/` is the **older 23.8 MB / ~5,525–5,881‑leaf** version — don't mistake it for the deployed one. I confirmed the clean manifest + the diagram‑exclusion code, and matched it to the live `/metadata` (n_leaves=7292, moth‑inclusive); I could not open the exact deployed `.pt`'s label list locally because it isn't stored here.
- **Diagram removal was content‑based (cv2), so not provably 100%.** The source‑level exclusions are exact, but the line‑art detector is heuristic. Franz's earlier PIL detector over‑flagged (false positives on bezark/cerambycoidea); the cv2 `filter_line_art.py` was the validated one and butterfly sources came out clean.

Want me to pull the deployed head's actual leaf/label list off HF and diff it against the clean manifest to make the provenance airtight?

## Turn 2

### User, 2026-07-11T14:41:57.326000Z (2026-07-11T09:41:57.326000-05:00)

what about the model used to generate the taxonomic predictions for the sanger images, I mean the model predictions served in the https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/ is it using the latest model or is it still using the old model?

### Final response, 2026-07-11T14:52:52.999000Z (2026-07-11T09:52:52.999000-05:00)

That was the earlier background `grep` finishing — I already used its output. No action needed.

To recap where we landed: both the interactive AI Identifier and the static Sanger OOF predictions on the Shiny Ikiam gallery are confirmed running on the **latest curated + moth-inclusive (7,292-leaf) BioCLIP-2.5-H model**, and that model was trained on a manifest that excludes maps/diagrams. Let me know if you'd like me to diff the deployed HF head's label list against the clean manifest to close the last provenance gap.

## Turn 3

### User, 2026-07-11T15:01:20.501000Z (2026-07-11T10:01:20.501000-05:00)

I went to https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/ai_identifier and it is stuck at Warming up the server
The free server sleeps when idle; getting it ready so identifying is quick.
Can you debug why it is stuck there? what happened?

### Final response, 2026-07-11T15:05:12.107000Z (2026-07-11T10:05:12.107000-05:00)

Understood — I won't touch the live Space. Holding here.

Summary you can act on whenever you're ready:

- **State:** `RUNTIME_ERROR`, terminal. It will not wake on its own; every request returns 503. The gallery's "Warming up the server" is a frontend misread of that 503.
- **Cause:** cold-wake crash-loop — the background warm thread's native model load aborts (`terminate called without an active exception`), bypassing the Python `try/except` fallback, so HF never sees a healthy container and times out after 30 min.
- **To recover (whenever you want):** factory restart the Space (HF UI: Settings → **Factory reboot**, or I can POST `restart` via the API). If it crash-loops again on reboot, that confirms the warm-up is the fault rather than a one-off, and the fix is to harden/lazy-load the warm step or bump off free `cpu-basic`.
- **Frontend gap to fix later:** `shiny-wings-gallery/src/utils/aiPredict.js` should treat repeated 503s as an error state instead of polling "Warming up" forever.

Say the word and I'll restart it and/or patch the frontend.

## Turn 4

### User, 2026-07-11T15:09:15.475000Z (2026-07-11T10:09:15.475000-05:00)

I am not satisfied with just a reboot to fix, we need to make the system reliable and robust so that this doesnt happen again

### Final response, 2026-07-11T15:23:26.843000Z (2026-07-11T10:23:26.843000-05:00)

Tests 1 & 2 passed but 3 didn't print — likely hanging. Let me isolate it with a hard timeout to see if `poll()` detects the mid-call crash promptly.

## Turn 5

### User, 2026-07-11T15:23:42.558000Z (2026-07-11T10:23:42.558000-05:00)

in the last question I answered only the first but I want the full solution including the frontend

### Final response, 2026-07-11T15:30:26.579000Z (2026-07-11T10:30:26.579000-05:00)

Done — the full robustness solution is implemented and verified locally across both repos. Here's what changed and why it closes each failure mode.

## Backend — the model can no longer kill the API (`WingsClassificator/hf-space/`)

**New `model_worker.py` + rewired `app.py`:** the model now runs in an **isolated subprocess**, never in the uvicorn process. The API parent imports *no* torch, so it physically cannot OOM from the model. A native OOM/abort — the exact `terminate called without an active exception` that took the Space down — now kills only the child; the parent stays up, serves mock, and restarts the worker with backoff (5s→15s→…→5min, retrying forever so it self-heals when RAM frees).

Because the API process never dies, HF's health probe always passes → **the terminal `RUNTIME_ERROR` state is now structurally impossible.**

Supporting changes: honest `/status` (`stage: starting|loading_model|ready|degraded`, `serving`, `error`), `/metadata` reflects real state, and `Dockerfile` + worker cap CPU threads (`OMP/MKL/OPENBLAS=2`) to lower peak RAM on the free box.

**Verified** (fake workers, no torch needed) — all passed:
- Native crash *during load* → parent alive, `degraded`, calls fall back to mock ✅
- Native crash *mid-inference* → `WorkerUnavailable` → mock, parent alive ✅
- Happy path → `ready`, real results over the pipe ✅
- Live uvicorn: `/health` 200, `/status` honest `degraded`+error, `/predict_raw` serves mock, **uvicorn stayed ALIVE** through repeated worker load failures ✅

## Frontend — no more infinite "Warming up" (`shiny-wings-gallery/src/`)

`AIIdTab.vue` had the reported bug: any unreachable/errored Space mapped to "Warming up the server" forever. Now there's a **bounded wake window** (90s unreachable / 210s never-ready) after which it shows a red, retryable **"Identifier is unavailable / The model failed to load"** state with a **Try again** button, and it's `degraded`-aware. If the backend auto-heals, the next poll flips it back to ready on its own. `InferenceProgress.vue` gained the `down` kind + retry affordance. **Gallery builds clean.**

## Ops backstop — keep-alive + auto-heal (`shiny-wings-gallery/.github/workflows/space_health.yml`)

Cron (~10 min): pings `/status` to keep the free Space from idling into the cold-wake that triggered all this, and if it's ever errored, queries the HF runtime API and POSTs a restart. **One manual step:** add an `HF_TOKEN` repo secret (write access to the Space) to enable auto-restart; without it, only keep-alive runs.

## What's left — deployment (needs your go-ahead)

None of this is live yet. Deploying is an action on your public deployments:
- **Backend** → push `hf-space/` to the HF Space repo `fr4nzzch/butterfly-id` (this rebuild also clears the current `RUNTIME_ERROR`).
- **Frontend + workflow** → commit/push to `rapidspeciation/Shiny_Ikiam_Wings_Gallery` (triggers the Pages deploy).

Want me to deploy both now (this will bring the Space back with the hardened build), or hold while you review the diffs? And should I add the `HF_TOKEN` secret step to your list, or do you want to set it yourself?

## Turn 6

### User, 2026-07-11T15:44:35.792000Z (2026-07-11T10:44:35.792000-05:00)

yes deploy both, also check cold boot up times and warming up and whether it can be improved

### Final response, 2026-07-11T15:52:04.303000Z (2026-07-11T10:52:04.303000-05:00)

All shipped and verified live. Here's the complete picture.

## Deployed
- **Backend** → HF Space `fr4nzzch/butterfly-id` (`d59c335..0d745ff`). Space is **healthy**: `stage: ready, mode: real, serving: real, error: null`, 7,292-leaf moth-inclusive head, real inference confirmed (~2.2 s/image).
- **Frontend + keep-alive/auto-heal** → gallery `main` (`a7a16f6..7f7e4b7`); Pages redeploys automatically.

## Cold-boot measurements

| Phase | Time | Note |
|---|---|---|
| Full rebuild (this deploy) | ~202 s | **One-time** — my `Dockerfile ENV` edit re-baked the 4 GB backbone. Normal code pushes won't. |
| Container start → **API up** (`/health` 200) | seconds | Parent imports no torch, so it answers immediately |
| API up → **model ready** | **~21 s** | Worker loads ViT-H/14 + head + YOLO from the *baked* cache (no download) |
| Real inference | **~2.2 s/image** | yolo off, full image |

**So a real cold wake** (Space slept, no rebuild) is roughly **container-start (a few s) + ~21 s load ≈ 25–30 s to ready**, and — crucially — the API is responsive the entire time, so the UI shows honest "Warming up the model → ready" instead of the old infinite spin, and `RUNTIME_ERROR` can't recur.

## Can it be improved? Yes, but you're already in good shape

- **Keep-alive (shipped)** is the biggest lever: with the cron pinging `/status`, the Space stays warm and most users **never hit a cold boot at all**. ⚠️ To also get auto-restart, add an `HF_TOKEN` repo secret to the gallery (write access to the Space); without it only keep-alive runs.
- **21 s load is already fast** thanks to the baked backbone, so further speedups are marginal. The one worth doing is **dropping BioCLIP's unused text tower after load** — we only call `encode_image`, so freeing the text transformer saves ~1 GB RAM. That's a *reliability* win (more OOM headroom on the free tier) more than speed, and it's low-risk now that the worker isolates any load failure. I'd need to test it against the real model structure before shipping.

## Two housekeeping notes
- The `hf-space/` source in the WingsClassificator repo (which has no git remote) is still uncommitted locally — it mirrors what I pushed to the Space. Want me to commit it there so the local source-of-truth matches?
- Set the `HF_TOKEN` gallery secret when you get a chance to arm auto-heal.

Want me to implement + test the text-tower RAM trim as a follow-up?

## Turn 7

### User, 2026-07-11T16:06:55.827000Z (2026-07-11T11:06:55.827000-05:00)

dropping text tower doesnt affect performance, sure lets try to see if it improves loading time and let me test if model predictions remains the same

### Final response, 2026-07-11T16:10:41.468000Z (2026-07-11T11:10:41.468000-05:00)

Verification is running (waits for the new build, times its load, then diffs all 6 images' full leaf vectors against baseline). I'll report the load-time delta and the prediction diff when it completes.

Expected outcome: predictions **identical** (vision tower untouched) and load time equal-or-better with ~1 GB less RAM. If anything differs or the load breaks, the worker isolation means the Space just serves mock (no outage) and I'll revert. Standing by for the results.

## Turn 8

### User, 2026-07-11T16:15:46.989000Z (2026-07-11T11:15:46.989000-05:00)

I noticed that for CAM070697 the segmentation model doesnt mask all wings and since we use the bbox that contains all wing masks then for the image on the right it means that the hindwings were not included, and that likely affects the classification head performance. I want to see if this model is able to mask the wings better: The verified YOLO v5.2 segmentation weights are at:

```text
/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/models/yolo_v5_2_curated_32161_final_20260709/artifacts/weights/best.pt
```

SHA-256:

```text
3ee1da0bfd7bec02a0d2dea671a042b063575d6e948f4c7bb37924cbf03b29e4
```

This is a single-class insect segmentation model. It can mask butterflies, but it was not trained to distinguish individual wings as separate classes.
---
So can you use this v5.2 model and run on a diverse sample set of sanger images, also on the scrapped images like sangay noreste cotacachi, etc. from all data sources used take a sample so I can review them, I think we cloned https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery in this pc and it was customized to serve the training set so I can review so find it and use it so I can review how this model performs

### Final response, 2026-07-11T16:40:32.508000Z (2026-07-11T11:40:32.508000-05:00)

The rebuild is running (the waiter `b0cdeg2ms` will notify me when it finishes). Meanwhile, here's the interim summary so you know where this stands.

## What v5.2 showed on CAM070697 (your exact case)

Reading the burned overlay directly: v5.2 detects **all four wings — both forewings (96%, 91%) and both hindwings (91%, 86%)** on the ventral, which is precisely where the current model missed the hindwings. So **yes, v5.2 masks the wings better** on this specimen.

But I found a related gotcha worth your attention: v5.2 also fires a spurious **21% detection on the color-checker card**, and the classifier's "union of *all* wing masks" crop would let that false positive balloon the crop to engulf the color checker and half the background. I fixed that in the review by computing the crop-box from **confident detections only** (≥0.5 conf floor) — Sanger wings sit at 0.86–0.96 so they're always kept, while sub-0.3 junk is drawn for inspection but excluded from the crop. The result is a tight cyan box hugging exactly the four wings.

**Implication for the pipeline:** if you adopt v5.2, the wing-crop should use a confidence floor (or a robust union), not a naive union of every detection — otherwise low-conf false positives on labels/color-checkers would *worsen* crops.

## Coverage across the sample (first build, 384 imgs)
- **Sanger: 50/50 detected, 47 with ≥4 masks** — excellent separated-wing coverage.
- Scraped whole-specimen sources: mostly 1 mask (the whole butterfly — correct) or ≥4.
- Misses concentrated in a few hard moth sources (silkmoths, entomofausac-guatemala, sti-sphingidae, sphingidae.us — 4–5 each of 12); these get a red fallback border so you can filter to them.

The gallery is already live at **http://100.83.134.33:5175/** (Tailscale) / http://localhost:5175/ — toggle **segments** to see overlays, and use the **segments filter → fallbacks** to jump to misses. I'm regenerating all 384 with the floored-union crop now and will re-add CAM070697; I'll confirm when it's refreshed with final per-source stats.

## Turn 9

### User, 2026-07-11T16:40:56.633000Z (2026-07-11T11:40:56.633000-05:00)

the website loaded but immediately got Error loading data.

### Final response, 2026-07-11T16:41:07.214000Z (2026-07-11T11:41:07.214000-05:00)

That's because the rebuild deletes `gallery_v52.json` and only rewrites it at the very end — so while it's regenerating, the file 404s. Let me check whether the rebuild has finished and the data is back.

## Turn 10

### User, 2026-07-11T16:41:09.565000Z (2026-07-11T11:41:09.565000-05:00)

chunk-BZD72IEI.js?v=3f62ad2a:2149 [Vue warn]: Unhandled error during execution of mounted hook
  at <CollectionTab>
  at <App>
warn$1 @ chunk-BZD72IEI.js?v=3f62ad2a:2149
useDataset.js:37 Uncaught (in promise) Error: Failed to load dataset
    at useDataset.js:37:15
    at async CollectionTab.vue:76:3

### Final response, 2026-07-11T16:49:20.779000Z (2026-07-11T11:49:20.779000-05:00)

Everything's live and verified. Here's the final state.

## Ready to review — http://100.83.134.33:5175/ (Tailscale) or http://localhost:5175/

**384 images across all 29 data sources**, each with a v5.2 overlay. In the gallery:
- Toggle **segments** to swap any image to its overlay: per-instance wing masks (colored), each detection's confidence %, and the **cyan crop-box** = the confidence-floored union the classifier would actually crop.
- **Filter → segments → fallbacks** jumps to the no-detection cases; **filter by source** to compare sources.
- CAM070697 (dorsal + ventral) is included so you can see your exact case.

## What the sample shows

| Metric | Result |
|---|---|
| Sanger (your deployment target) | **52 imgs, 49 with ≥4 masks, 0 misses** — all wings incl. hindwings |
| Overall no-detection | 42 / 384 (10%) |
| Whole-specimen scraped | mostly 1 mask (whole butterfly = correct) |
| Highest-miss sources | entomofausac-guatemala & silkmoths (5/12), sphingidae.us & sti-sphingidae (4/12) |

## The two findings that matter

1. **v5.2 fixes the hindwing problem.** On CAM070697 ventral it masks all four wings (0.86–0.96), including the two hindwings the current model missed. Across Sanger it never missed a specimen.

2. **The crop strategy must change with it.** v5.2 emits occasional low-confidence false positives (e.g., a 21% hit on the color-checker card). The current "union of *all* wing masks" would let that balloon the crop into the background — *worse* than today. I worked around it in the review with a **≥0.5 confidence floor** for the crop-box (wings are 0.86–0.96, junk is <0.3). So the recommendation if you adopt v5.2: **crop from a confidence-floored/robust union, not a naive union.**

## Housekeeping
- Non-destructive: the existing `gallery.json` and gallery are untouched; all v5.2 data is under `_v52`/`gallery_v52.json` behind `VITE_DATASET=v52`.
- Patched the builder to write atomically (temp + rename) so regenerating never blanks the live gallery again.
- The dev server (port 5175) and the `.venv_seg`/`.work_ttower` scratch dirs are still running/on disk — say the word and I'll tear them down, or adjust the sample (more per source, different conf) and regenerate.

What's your read on the overlays — good enough to move toward swapping the wing-cropper to v5.2, or want me to tune anything first?

## Turn 11

### User, 2026-07-11T17:11:21.972000Z (2026-07-11T12:11:21.972000-05:00)

how do I select to see masks of v5.2 or old yolo v3

### Final response, 2026-07-11T17:17:15.367000Z (2026-07-11T12:17:15.367000-05:00)

The old-overlay build finished. Let me read the results and verify both overlay sets serve so the switch works end-to-end.

## Turn 12

### User, 2026-07-11T17:20:04.382000Z (2026-07-11T12:20:04.382000-05:00)

continue

### Final response, 2026-07-11T17:20:16.966000Z (2026-07-11T12:20:16.966000-05:00)

You've hit your session limit · resets 1:20pm (America/Guayaquil)

## Turn 13

### User, 2026-07-11T18:33:54.291000Z (2026-07-11T13:33:54.291000-05:00)

continue

### Final response, 2026-07-11T18:34:37.020000Z (2026-07-11T13:34:37.020000-05:00)

The comparison is fully live. And the old-model overlay reveals something important and honest.

## The v5.2-vs-old switch is now in the gallery — http://100.83.134.33:5175/

**How to use it:** turn on **"Show wing masks"** → a **"Mask model"** dropdown appears → pick **YOLO v5.2 (new)** or **wing_seg.pt (deployed)**. Every card swaps to that model's overlay on the same photo, with a `v5.2 mask` / `old mask` (or `…miss`) badge per card. Both overlay sets are served and verified (200s).

## What the comparison actually shows (a correction worth your attention)

On CAM070697v at matched settings (conf 0.15, imgsz 1280), the **old `wing_seg.pt` also masks all four wings** — 96%, 95%, 84%, 59%, tight union box, no color-checker false positive. So **the hindwing miss you originally saw was a settings/precompute artifact of the production `wing_boxes.json`, not an inherent old-model failure.** At sensible settings, both models cover this specimen's wings.

Sample-wide (384 images, same photos, same crop logic):

| masks/img | v5.2 | old wing_seg.pt |
|---|---|---|
| 0 (miss) | 42 | **1** |
| 1 (whole blob) | 84 | 266 |
| ≥4 (per-wing) | **85** | 48 |
| **Sanger ≥4 masks** | 49/52 | 47/52 |

**Reading it:** the old model almost never misses and usually returns one solid blob; v5.2 segments into per-wing instances more often but misses more on hard scraped moths (42) and occasionally fires low-conf false positives (color-checkers/labels) that would wreck a naive union crop. On Sanger — the actual deployment target — the two are close (49 vs 47 of 52 with ≥4 wings).

## My honest take
v5.2 is **not a clear win** for the wing-crop over the deployed model at matched settings; it trades fewer misses for finer per-wing segmentation plus a false-positive risk. The bigger lever is the **crop logic** (the confidence-floored/robust union I added), which helps *either* model. Flip through the gallery — especially Sanger and the moth sources — and see if v5.2's per-wing behavior actually improves crops for your cases before committing to a swap.

Everything's non-destructive (all under `_v52`, existing gallery untouched). Want me to leave the server running, tune settings, or tear down the scratch venv/dirs when you're done reviewing?
