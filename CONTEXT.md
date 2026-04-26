# Project Context

Cross-cutting context for the Ithomiini Distribution Maps project, written
to hand off work between chat sessions. Covers SDM pipeline state,
manuscript-edit state, infrastructure, and pending decisions.

The companion `paper/CONTEXT.md` documents the manuscript itself and the
co-author comments; this file documents everything else and links the two
together.

---

## TL;DR for the next chat session

**There is a tuning run currently active on Manuel's WSL2 that started
2026-04-25 23:06 ECT and is scheduled to stop at 07:00 ECT.** First thing
to do in the next chat is check whether it finished. After it finishes
(or pauses at 07:00), the next steps are to regenerate the web-app
prediction rasters and metadata, push them, and decide whether the
manuscript text needs adjustments based on the new tuned numbers.

The session that produced this file made four substantive contributions:

1. Built a per-species MaxEnt tuning pipeline (`sdm/06_tune_weak_species.py`),
   ran it overnight on the 37 weak-performing species, committed the
   resulting `sdm/species_overrides.json` to main.
2. Refactored the SDM accessible-area calculation to support DBSCAN
   multi-cluster hulls (for species with disjunct distributions) and
   range-scaled buffers (for species with extreme range-size differences),
   plus a density-scaled background-point count. Defaults were flipped to
   the new strategies on 2026-04-25.
3. Wrote `paper/proposed_edits_v3.md` describing all SDM work for the
   manuscript, with citations to the relevant SDM literature.
4. Started a uniform whole-dataset tuning run with the new strategies and
   a reduced 4 RM × 3 feature-class grid, prioritised worst-first. This
   is the run currently active on Manuel's WSL2.

---

## Check first when continuing

Run these commands in the next chat to assess state:

```bash
# 1. Working tree clean?
cd /home/ubuntu/franz/repos/ithomiini_maps
git status
git branch --show-current   # should be 'main'
git log --oneline -8

# 2. Is the overnight tuning still running on Manuel?
ssh -o ControlPath=none -o ControlMaster=no manuel-wsl-tunnel \
  'pgrep -af 06_tune; grep -c "★ Best:" ~/gh-repos/ithomiini_maps/sdm/tune-runs.log; tail -20 ~/gh-repos/ithomiini_maps/sdm/tune-runs.log'

# 3. Did it finish? Look for the "Tuned N species total" line.
ssh ... 'grep "Tuned [0-9]" ~/gh-repos/ithomiini_maps/sdm/tune-runs.log'

# 4. What's the current systemd timer schedule?
ssh ... 'systemctl --user list-timers sdm-tuning.timer'
```

Expected outcomes:

- If the run finished cleanly: there will be a "Tuned N species total"
  line near the end of `tune-runs.log` and `species_overrides.json` will
  contain entries for all 151 species. Next step is steps 5+ below.
- If the run is still going: leave it alone, it will pause itself at
  07:00 (PID 490093 has `--time-limit 28388` set). The systemd timer
  will fire at 20:00 next night to resume with `--resume`.
- If the run died: check `tune-runs.log` for the error, restart with
  `systemctl --user start sdm-tuning.service`.

---

## After tuning finishes (or whenever the next chat is)

Once `species_overrides.json` has all 151 species, the production rasters
that the web app serves still reflect the old single-hull accessible area
and the prior 37-species selective tuning. To regenerate:

```bash
# On Manuel's WSL2, in the cloned repo
cd ~/gh-repos/ithomiini_maps

# Regenerate all 151 species predictions with new accessible area + tuned params
nohup .venv/bin/python sdm/04_run_sdm.py --tuned-only \
  > sdm/rerun-tuned.log 2>&1 &
# This takes ~2-3 hours

# Then export web-app metadata + per-species rasters
.venv/bin/python sdm/05_export_predictions.py
```

Then rsync the outputs back to ARM and commit:

```bash
# On ARM (this machine)
rsync -a -e "ssh -o ControlPath=none -o ControlMaster=no" \
  manuel-wsl-tunnel:/home/manuel/gh-repos/ithomiini_maps/public/data/sdm/ \
  public/data/sdm/

# species/*_ensemble.tif and sdm_metadata.json are tracked
git add public/data/sdm/sdm_metadata.json public/data/sdm/species/
git commit -m "data(sdm): regenerated rasters with DBSCAN accessible area + uniform-grid tuning"
git push origin main
```

After push, GitHub Actions deploys to GitHub Pages automatically (~1 min).
Verify on https://fr4nzz.github.io/ithomiini_maps/.

---

## Working environment

- **Project root on this machine (ARM server)**: `/home/ubuntu/franz/repos/ithomiini_maps`
- **Default branch**: `main` (ahead of nothing, in sync with `origin/main` = `Fr4nzz/main`)
- **Git remotes**:
  - `origin` = `https://github.com/Fr4nzz/ithomiini_maps.git` (Franz's fork, deploy target)
  - `rapidspeciation` = `https://github.com/rapidspeciation/ithomiini_maps.git` (upstream)
- **Live web app**: https://fr4nzz.github.io/ithomiini_maps/
- **Vite dev server**: `http://127.0.0.1:5174/ithomiini_maps/` (running in tmux session `vite`)
- **Python environment for SDM**: `sdm/.venv/` (Python 3.12 + elapid, geopandas, rasterio, xgboost, sklearn, shapely)

---

## Branch state on Fr4nzz/origin

| Branch | HEAD | Purpose |
|---|---|---|
| `main` | `c5a4cbb` | Production. Has all SDM tuning + sidebar work. |
| `feature/sdm-accessible-area` | `c5a4cbb` | Same as main now (was where I built the DBSCAN multi-cluster work). |
| `feature/sdm-tuning` | (older) | Where the original tuning script was developed. |
| `feature/sidebar-debloat` | (older) | Where the sidebar OTHERS-tile refactor was developed. |
| `claude/review-manuscript-citations-nkMok` | `c8db0ad` | Manuscript edits (`paper/proposed_edits_v3.md`). |

Recent commits on main worth knowing about:

```
c5a4cbb feat(sdm): --reduced grid for uniform whole-dataset tuning + flip new strategies to production defaults
c3e3575 feat(sdm): DBSCAN multi-cluster accessible area + density-based background
77f3724 data(sdm): commit per-species ensemble rasters so GitHub Pages serves them
4aadd60 data(sdm): regenerated metadata with tuned params for 37 species
8c184a4 feat(sdm): --tuned-only flag + merge-summary behavior for partial reruns
d76c790 data(sdm): overnight grid-search results for 37 weak species
7feff0a feat(sdm): per-species MaxEnt tuning for weak-performance models
b1ea4c9 refactor(sidebar): fold Time Range, GoaT, and SDM into OTHERS tile group
```

Also pushed to `rapidspeciation/main`: a single merge commit `d800ec1` that
brings all the above into the upstream repo.

---

## SDM pipeline architecture

### Pipeline stages

| Step | Script | What it does |
|---|---|---|
| 1 | `sdm/01_prepare_occurrences.py` | Pool occurrences, 5 km spatial thinning, write per-species parquets |
| 2 | `sdm/02_download_env_data.py` | Download CHELSA, elevation, cloud cover rasters |
| 3 | `sdm/03_host_plants.py` | Optional Solanaceae layer (currently not in env stack) |
| 4 | `sdm/04_run_sdm.py` | Fit MaxEnt + RF + GBM ensemble per species, write rasters |
| 5 | `sdm/05_export_predictions.py` | Generate `public/data/sdm/sdm_metadata.json` + species rasters |
| 6 | `sdm/06_tune_weak_species.py` | ENMeval-style grid search; writes `species_overrides.json` |

### Tier system (in `sdm/04_run_sdm.py`)

| Tier | Sample size | Algorithms | CV | RM default | Features default |
|---|---|---|---|---|---|
| small | 20–49 | MaxEnt only | jackknife | 2.0 | linear, quadratic |
| medium | 50–99 | MaxEnt + RF + GBM | spatial block | 1.5 | linear, quadratic, hinge |
| large | 100+ | MaxEnt + RF + GBM | spatial block | 1.5 | linear, quadratic, hinge |

Tier defaults are overridden per species when an entry exists in
`sdm/species_overrides.json` (loaded by `load_species_overrides()` and
applied by `apply_override()` in `04_run_sdm.py`).

### Accessible-area strategies (new in this session)

Configured via `sdm/config.yaml` keys; opt-in flags but **defaults flipped
to the new behaviour as of `c5a4cbb`** (2026-04-25):

```yaml
accessible_area_strategy: "dbscan_clusters"   # was "single_hull"
buffer_strategy: "range_scaled"               # was "fixed"
n_background_strategy: "density_based"        # was "fixed"
```

The new functions are:

- `compute_accessible_area_v2(pres_coords, opts)` returns
  `(extent_dict, polygon_or_None)`. Strategy "single_hull" preserves the
  legacy single buffered convex hull. Strategy "dbscan_clusters" runs
  DBSCAN at `dbscan_eps_km` (default 500), buffers each cluster's hull
  per `buffer_strategy`, treats DBSCAN noise points as buffered points,
  and unions everything.
- Buffer is "fixed" (constant `buffer_fixed_km`) or "range_scaled"
  (`buffer_fraction_of_diameter` × cluster diameter, clipped to
  `[buffer_min_km, buffer_max_km]` = `[50, 500]`).
- `compute_n_background(polygon, extent, opts)` returns either a fixed N
  or `density_per_km2` × accessible-area-km², clipped to
  `[background_floor, background_ceiling]` = `[2000, 15000]`. Default
  density 0.0005 reproduces the legacy 10000 across a Neotropics-scale
  extent (Phillips & Dudík 2008 plateau is around 8000).
- `generate_background_points()` in `sdm/utils/spatial.py` gained an
  `accessible_polygon=` kwarg. When provided, candidate points outside
  the polygon are dropped after the bbox filter.

The legacy `compute_accessible_area()` is preserved as-is for any
external callers.

### Tuning script options (`sdm/06_tune_weak_species.py`)

```
--species ...     # specific species (skip threshold)
--threshold X     # tune species with baseline boyce < X (default 0.3)
--threshold 999   # effectively all species (uniform sweep)
--quick           # 2x2 grid (smoke test)
--reduced         # 4x3 grid (uniform whole-dataset sweep)
                  # - matches Moreno-Arzate & Martinez-Meyer 2024 (4x5)
                  # - and Yang et al. 2024 (8x5)
                  # default: 8x4 full ENMeval grid
--resume          # skip species in .tune_checkpoint.json
--time-limit N    # stop after N seconds (graceful SIGTERM-aware)
--max-species N   # process at most N
--dry-run         # list targets and exit
```

Selection criterion: highest CV Boyce, with feature-class simplicity
tiebreak within `BOYCE_TIE_EPSILON = 0.01`. Persists overrides
incrementally (after every species), so SIGTERM never loses more than
one in-flight species. The script uses `importlib.util` to load
`04_run_sdm.py` because the leading digit is not a valid Python
identifier.

Target species ordering: `load_weak_species()` sorts ascending by
baseline Boyce (worst first). This is what the user requested for the
current production run.

---

## Production statistics (current commits)

These come from the **previous** production run (`77f3724`), which used
legacy strategies + 37-species selective tuning. They will be replaced
once the current uniform-grid run with new accessible-area finishes:

- 151 species modelled (69 small / 36 medium / 46 large tier)
- Mean Boyce 0.58, median 0.60, mean AUC 0.73
- 95% positive Boyce (143/151)
- 85% reach the 0.3 "useful" threshold (128/151)
- 61% reach 0.5 (92/151)
- 37 species had baseline Boyce < 0.3 and were tuned (the selective tuning)
- 27 of those improved by Δ > 0.3 in the tuning estimates
- 15 flipped from negative to positive Boyce
- Mechanitis messenoides specifically: 0.16 → 0.47 in metadata after tuning

Selected examples (baseline → tuned in tuning estimates):

| Species | Baseline | Tuned | Δ |
|---|---|---|---|
| Oleria aquata | −0.640 | +0.898 | +1.538 |
| Episcada salvinia | −0.326 | +0.903 | +1.229 |
| Episcada carcinia | +0.030 | +0.988 | +0.957 |
| Mechanitis messenoides | +0.160 | +0.468 | +0.308 |
| Hyposcada illinissa | −0.506 | +0.199 | +0.706 |
| Ithomia heraldica (untunable) | −0.548 | −0.577 | −0.030 |

After the current overnight run finishes, refresh these numbers by
inspecting `sdm/species_overrides.json` and the regenerated
`public/data/sdm/sdm_metadata.json`.

---

## Manuscript work

### Files

- `paper/manuscript.md` — the manuscript (Google-Docs-flavoured Markdown
  with comment markers).
- `paper/CONTEXT.md` — manuscript-specific context (Joana's comments,
  authors, target journal, Patricio's feedback).
- `paper/proposed_edits.md` — first round of edits.
- `paper/proposed_edits_v2.md` — GoaT integration, sequencing fix, data updates.
- `paper/proposed_edits_v3.md` — **all the SDM-related edits** that this
  session produced. Includes Methods (new SDM subsection inside 2.5),
  Results (new 3.6), Discussion (4.1 + 4.4 updates), Conclusions, Abstract,
  and 14 new references.

### Important caveat at the top of `proposed_edits_v3.md`

The Methods text now describes uniform tuning across all species
(methodologically defensible per Kass et al. 2021 and the multi-species
SDM literature). The actual production run on disk only tuned 37 weak
performers. **The current overnight run on Manuel's WSL2 is fixing this
mismatch by tuning all 151 species uniformly with the reduced grid.**

The new accessible-area construction (DBSCAN + range-scaled + density)
is implemented in code but the production rasters were built with the
legacy single-hull strategy. After the overnight tuning finishes, run
`04_run_sdm.py --tuned-only` and `05_export_predictions.py` to bring the
rasters in sync with the manuscript text.

### Joana's unresolved comments (from `paper/CONTEXT.md`)

These are still open and should be checked against the latest manuscript
text:

- id="0": citations for R-Shiny / EC2 hosting claim
- id="2": "Chandi et al., in prep" — protocols.io paper or part of this paper?
- id="3": Citations needed for Vue.js, Python, Pandas, GitHub Pages, GitHub Actions
- id="4/5": Windows download link broken (Franz says fixed)
- id="6": Wings Gallery wording about R-Shiny version
- id="7": Brown's thesis data via André Freitas (suggested addition)
- id="8": Sequencing numbers verified, classification logic updated in v2
- id="11": Section 4.2 (AI repetitive)
- id="12": Ecological distribution modelling + GoaT — addressed by v3 (SDM) and v2 (GoaT)
- id="13": Section 4.4 last paragraph redundant — addressed by v3 Edit 3c
- id="14": Section 6 Data Availability scope — still open

---

## Infrastructure

### SSH access

```
# Manuel's WSL2 (preferred via reverse tunnel)
ssh -o ControlPath=none -o ControlMaster=no manuel-wsl-tunnel
# Tailscale fallback (often needs re-auth):
sshpass -p 'adsf' ssh -o StrictHostKeyChecking=no manuel@100.104.176.4
```

**Always use** `-o ControlPath=none -o ControlMaster=no` when invoking
SSH to Manuel. The default ControlMaster reuse causes hangs when long-
running services are starting/stopping on the remote.

### Manuel's WSL2 setup

- Hostname: `DESKTOP-90HV2GU`
- User: `manuel`
- Timezone: `America/Bogota` (UTC−5, same as Ecuador)
- Repo: `/home/manuel/gh-repos/ithomiini_maps` (git-tracked clone of `Fr4nzz/main`)
- Data symlinks: `sdm/data/{env_variables,occurrences,predictions}` → `~/sdm_bench/sdm/data/...`
- Python env: `~/sdm_bench/.venv/` symlinked to `~/gh-repos/ithomiini_maps/.venv/`
- The 540 MB env rasters are NOT duplicated. Only one copy lives in `~/sdm_bench/sdm/data/env_variables/`.
- Older copy of pipeline code at `~/sdm_bench/` (NOT a git repo). Do not modify; future work goes through `~/gh-repos/ithomiini_maps`.

### Systemd user timer

`~/.config/systemd/user/sdm-tuning.{service,timer}`:

```ini
# .timer
OnCalendar=*-*-* 20:00:00     # nightly 8 PM ECT
Persistent=false              # don't fire on missed schedule
Unit=sdm-tuning.service

# .service
Type=simple
WorkingDirectory=/home/manuel/gh-repos/ithomiini_maps
ExecStart=.venv/bin/python sdm/06_tune_weak_species.py \
  --resume --reduced --threshold 999 --time-limit 39600
StandardOutput=append:/home/manuel/gh-repos/ithomiini_maps/sdm/tune-runs.log
StandardError=append:/home/manuel/gh-repos/ithomiini_maps/sdm/tune-runs.log
```

Why these flags:
- `--reduced`: 4 RM × 3 FC = 12 cells (uniform sweep)
- `--threshold 999`: tune all species, not weak-only
- `--time-limit 39600`: 11 h (8 PM to 7 AM)
- `--resume`: skip species already in `.tune_checkpoint.json`
- The 8 PM start gives Manuel the full day to use the PC unencumbered.

### Tonight's manual run (started 2026-04-25 23:06)

```bash
nohup .venv/bin/python sdm/06_tune_weak_species.py \
  --resume --reduced --threshold 999 --time-limit 28388 \
  > sdm/tune-runs.log 2>&1 &
```

PID 490093. `28388` = seconds until 07:00 the morning of 2026-04-26.
First 90 seconds showed 16 species completed cleanly with the new
strategies, projecting ~50 min total runtime. Will finish well before
07:00.

### Note about Tailscale

Tailscale SSH login expires periodically and requires a browser auth
flow that is not scriptable from this server. The reverse-tunnel
(port 2223 alias `manuel-wsl-tunnel`) does not depend on Tailscale auth,
so prefer it.

---

## Open decisions / pending choices

1. **After the uniform tuning finishes**: whether to refresh the
   numbers in `paper/proposed_edits_v3.md` Section 3.6 to match the new
   results. Likely yes; the current numbers came from the selective
   tuning run.

2. **Whether to also re-run on rapidspeciation/main**: the merge to
   rapidspeciation in `d800ec1` happened before this session's accessible-
   area + uniform-tuning work. After all the rasters are regenerated and
   pushed to Fr4nzz, propagate to rapidspeciation as another merge commit
   (use a descriptive message that summarises what changed since
   `d800ec1`, see prior commit message style).

3. **Manuscript honesty caveat**: once the new tuning completes, the
   honesty caveats in the preamble of `proposed_edits_v3.md` can be
   removed (because the manuscript's claim of uniform tuning will then
   match what was actually run).

4. **What to do about Ithomia heraldica**: this species stayed below
   −0.5 Boyce even after tuning. The new accessible-area strategy with
   DBSCAN clustering may help if its records are spatially disjunct. If
   it still fails after the new run, document it in the manuscript's
   limitations section (already partially done in proposed_edits_v3.md
   Edit 3b).

5. **Section 6 Data Availability scope** (Joana's comment id="14"):
   still open. Joana wants this section to describe only data we
   produced, not Doré or GBIF (already cited in Methods).

6. **Compute schedule**: the systemd timer assumes Manuel wants the PC
   free during the day. If that changes (e.g., Manuel takes a vacation
   day), the service can be triggered manually with
   `systemctl --user start sdm-tuning.service`.

---

## Key files (quick reference)

```
ithomiini_maps/
├── CONTEXT.md                          ← this file
├── paper/
│   ├── manuscript.md                   ← the paper
│   ├── CONTEXT.md                      ← manuscript-specific context
│   ├── proposed_edits.md               ← edits round 1
│   ├── proposed_edits_v2.md            ← GoaT etc
│   ├── proposed_edits_v3.md            ← all SDM edits (this session)
│   └── generate_statistics.py          ← stats refresher
├── sdm/
│   ├── 04_run_sdm.py                   ← main SDM pipeline
│   │   ├── compute_accessible_area     ← legacy (preserved)
│   │   ├── compute_accessible_area_v2  ← new strategy-aware
│   │   ├── compute_n_background        ← new density-based
│   │   ├── load_species_overrides      ← reads species_overrides.json
│   │   └── apply_override              ← applies per-species params
│   ├── 06_tune_weak_species.py         ← ENMeval-style grid search
│   ├── species_overrides.json          ← per-species tuned params
│   ├── SDM_METHODS.md                  ← full methodology + 25+ refs
│   ├── config.yaml                     ← strategy flags + numeric defaults
│   └── utils/spatial.py
│       └── generate_background_points  ← now accepts accessible_polygon
├── public/data/sdm/
│   ├── sdm_metadata.json               ← consumed by web app
│   └── species/*_ensemble.tif          ← 151 prediction rasters (committed)
└── src/                                ← Vue.js web app
```

---

## Common pitfalls / gotchas

1. **SSH ControlMaster causes hangs**: always use
   `-o ControlPath=none -o ControlMaster=no` for Manuel's WSL2.

2. **`importlib.util` for 06**: `04_run_sdm.py` is loaded as a module
   inside `06_tune_weak_species.py` via `importlib.util` because the
   leading digit prevents a normal `import` statement. The module name
   is `sdm_v4` inside 06.

3. **Backwards-compatible config defaults**: every new config key in
   `sdm/config.yaml` reads through `_accessible_opts()` /
   `_background_opts()` helpers in `04_run_sdm.py` that fall back to
   legacy values when the key is missing. **However**, on 2026-04-25 the
   defaults in `config.yaml` itself were flipped to the new strategies
   (commit `c5a4cbb`). To revert globally, edit those three keys in the
   YAML.

4. **The `species_overrides.json` overrides the 04 tier defaults but
   NOT the accessible-area strategy**. The accessible-area strategy is
   a global config setting; tuning is per-species (`maxent_rm`,
   `maxent_features`).

5. **Boyce CV variance**: at sample sizes below 200, repeated CV runs
   on identical parameters give Boyce values that differ by 0.05–0.15
   (Santini et al. 2021). The "tuned Boyce" reported by 06 is one
   point estimate; the Boyce that ends up in `sdm_metadata.json` after
   running 04 is another point estimate of the same quantity. Don't
   over-interpret small differences.

6. **GitHub Pages doesn't serve gitignored files**: previously the
   per-species `*_ensemble.tif` rasters were gitignored, so the live
   site rendered nothing for SDM. They are now committed. If a future
   `.gitignore` change reverts that, the live site breaks silently.

7. **Don't run 04 on Manuel's WSL2 without `--tuned-only`**: a full
   uniform 04 run on all 151 species takes ~3 hours. The `--tuned-only`
   flag restricts to species in `species_overrides.json` and merges
   into the existing summary instead of overwriting.

8. **DBSCAN noise points**: when `dbscan_clusters` strategy is active,
   points that DBSCAN labels as noise (label -1) become buffered points
   in the accessible area. They are not silently dropped. This matters
   for species with one or two outlier records far from the main range.

---

## Slack / chat continuity tips

When pasting this file into a new chat, also paste the most recent
output of:

```bash
git log --oneline -10
ssh -o ControlPath=none -o ControlMaster=no manuel-wsl-tunnel \
  'tail -30 ~/gh-repos/ithomiini_maps/sdm/tune-runs.log; \
   echo "---"; pgrep -af 06_tune | head -1; \
   echo "---"; systemctl --user list-timers sdm-tuning.timer'
```

That gives the new chat enough state to know where we are without
re-running everything.
