#!/usr/bin/env python3
"""
Step 6: ENMeval-style per-species MaxEnt tuning for weak-performance models.

Finds the best (regularization multiplier, feature classes) combination per
species by grid search with spatial-block cross-validation. Writes the
winning parameters to `species_overrides.json`; `04_run_sdm.py` consults
that file on its next run and uses the tuned parameters in place of the
tier defaults.

Target species: any species whose `best_boyce` in
`data/predictions/sdm_results_summary.json` (or the published
`public/data/sdm/sdm_metadata.json` as fallback) is below `--threshold`
(default 0.3 — "weak" by Hirzel et al. 2006 convention).

References
----------
  Kass, J. M. et al. (2021). ENMeval 2.0: redesigned for customizable and
    reproducible modelling of species' niches and distributions.
    Methods in Ecology and Evolution, 12(9), 1602-1608.
  Warren, D. L., & Seifert, S. N. (2011). Ecological niche modeling in
    Maxent: the importance of model complexity and the performance of model
    selection criteria. Ecological Applications, 21(2), 335-342.
  Hirzel, A. H. et al. (2006). Evaluating the ability of habitat suitability
    models to predict species presences. Ecological Modelling, 199(2), 142-152.

Design note
-----------
We use the continuous Boyce index from spatial-block cross-validation as the
primary selection criterion, with feature-class simplicity as tiebreaker.
This deviates from the strict Warren & Seifert (2011) AICc because:

  1. AICc on MaxEnt requires study-area-wide normalisation of raw outputs,
     which would add non-trivial compute.
  2. The ENMeval 2.0 vignette explicitly supports CV metrics as an
     alternative selection criterion (Kass et al. 2021, §2.4).
  3. CV Boyce directly optimises the metric we report to end users.

Where two configurations tie on CV Boyce (within 0.01), we prefer the one
with fewer and simpler feature classes (linear < quadratic < hinge < product).

Usage
-----
    python 06_tune_weak_species.py                         # all Boyce<0.3 species
    python 06_tune_weak_species.py --species "Mechanitis messenoides"
    python 06_tune_weak_species.py --threshold 0.5         # widen the net
    python 06_tune_weak_species.py --resume                # skip already-tuned
    python 06_tune_weak_species.py --time-limit 25200      # stop after 7h
    python 06_tune_weak_species.py --max-species 3         # tune only first 3
    python 06_tune_weak_species.py --dry-run               # preview targets

Graceful shutdown
-----------------
SIGTERM / SIGINT (Ctrl-C) completes the current species, writes its result,
then exits cleanly. Overrides are persisted after every species so a hard
kill never loses more than one partially-completed run.
"""

import argparse
import importlib.util
import json
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# ── Load 04_run_sdm.py as a module ──────────────────────────────────────────
# The 04-prefix isn't a valid Python identifier, so we load it via importlib.
_HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("sdm_v4", _HERE / "04_run_sdm.py")
_sdm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sdm)

config = _sdm.config
TIERS = _sdm.TIERS
OCC_DIR = _sdm.OCC_DIR
PRED_DIR = _sdm.PRED_DIR


# ── Tuning grid (ENMeval 2.0 defaults — Kass et al. 2021) ───────────────────
DEFAULT_RM_GRID = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
DEFAULT_FC_GRID = [
    ["linear"],
    ["linear", "quadratic"],
    ["linear", "quadratic", "hinge"],
    ["linear", "quadratic", "hinge", "product"],
]

FC_COMPLEXITY = {
    "linear": 1,
    "quadratic": 2,
    "hinge": 4,
    "product": 8,
}

BOYCE_TIE_EPSILON = 0.01

OVERRIDES_PATH = _HERE / "species_overrides.json"
CHECKPOINT_PATH = _HERE / ".tune_checkpoint.json"


# ── Grid search for one species ─────────────────────────────────────────────
def tune_one_species(
    species_name,
    env_rasters,
    all_coords,
    bias_weights,
    bias_grid_coords,
    rm_grid=DEFAULT_RM_GRID,
    fc_grid=DEFAULT_FC_GRID,
    verbose=True,
):
    """Run full (RM x feature-class) grid search for a single species.

    Returns a dict with status plus (on success) the winning parameters
    and the full grid of results for auditing.
    """
    species_gdf = _sdm.load_species_data(species_name)
    if species_gdf is None:
        return {"status": "no_data", "species": species_name}

    n_records = len(species_gdf)
    tier_name, tier_config = _sdm.get_tier(n_records)
    if tier_config is None:
        return {"status": "below_min", "species": species_name, "n": n_records}

    # Prepare training data ONCE — every grid cell sees the same presences
    # and backgrounds, so tuning isolates the effect of MaxEnt parameters.
    data, env_cols, _accessible = _sdm.prepare_training_data(
        species_gdf,
        env_rasters,
        all_coords,
        tier_config,
        bias_weights=bias_weights,
        bias_grid_coords=bias_grid_coords,
    )
    n_pres = int(data["presence"].sum())
    if n_pres < 10:
        return {
            "status": "insufficient_env",
            "species": species_name,
            "n_presences": n_pres,
        }

    grid_cells = [(rm, fc) for rm in rm_grid for fc in fc_grid]
    results = []

    for i, (rm, fc) in enumerate(grid_cells, 1):
        cell_cfg = dict(tier_config)
        cell_cfg["maxent_rm"] = rm
        cell_cfg["maxent_features"] = fc

        t0 = time.time()
        try:
            cv_metrics = _sdm.cross_validate(data, env_cols, "maxent", cell_cfg)
        except Exception as exc:
            cv_metrics = {
                "auc": np.nan,
                "boyce": np.nan,
                "tss": np.nan,
                "cv_method": "failed",
                "error": str(exc)[:120],
            }
        dt = time.time() - t0

        complexity = sum(FC_COMPLEXITY.get(f, 0) for f in fc)
        entry = {
            "rm": rm,
            "features": fc,
            "boyce": float(cv_metrics.get("boyce", np.nan)),
            "auc": float(cv_metrics.get("auc", np.nan)),
            "tss": float(cv_metrics.get("tss", np.nan)),
            "cv_method": cv_metrics.get("cv_method", "?"),
            "complexity": complexity,
            "fit_seconds": round(dt, 1),
        }
        if "error" in cv_metrics:
            entry["error"] = cv_metrics["error"]
        results.append(entry)

        if verbose:
            boyce_s = (
                f"{entry['boyce']:+.3f}" if not np.isnan(entry["boyce"]) else "  N/A "
            )
            auc_s = f"{entry['auc']:.3f}" if not np.isnan(entry["auc"]) else " N/A "
            fc_s = "+".join(fc)
            print(
                f"    [{i:2d}/{len(grid_cells)}] RM={rm:.1f} FC={fc_s:<25} "
                f"Boyce={boyce_s} AUC={auc_s}  ({dt:.0f}s)"
            )

    # Pick best: highest Boyce, tiebreak on lowest complexity (within eps)
    valid = [r for r in results if not np.isnan(r["boyce"])]
    if not valid:
        return {
            "status": "no_valid_boyce",
            "species": species_name,
            "grid_results": results,
        }

    max_boyce = max(r["boyce"] for r in valid)
    # Tie-band candidates (all within BOYCE_TIE_EPSILON of the max)
    tied = [r for r in valid if r["boyce"] >= max_boyce - BOYCE_TIE_EPSILON]
    best = min(tied, key=lambda r: (r["complexity"], r["rm"]))

    return {
        "status": "ok",
        "species": species_name,
        "n_presences": n_pres,
        "tier": tier_name,
        "baseline_rm": tier_config["maxent_rm"],
        "baseline_features": tier_config["maxent_features"],
        "best_rm": best["rm"],
        "best_features": best["features"],
        "best_boyce": best["boyce"],
        "best_auc": best["auc"],
        "grid_results": results,
    }


# ── I/O helpers ─────────────────────────────────────────────────────────────
def load_weak_species(threshold):
    """Return [(species_name, baseline_boyce), ...] sorted weakest first."""
    summary = PRED_DIR / "sdm_results_summary.json"
    if summary.exists():
        data = json.loads(summary.read_text())
        weak = [
            (r["species"], float(r.get("best_boyce", 0.0)))
            for r in data
            if r.get("best_boyce") is not None and float(r["best_boyce"]) < threshold
        ]
        weak.sort(key=lambda t: t[1])
        return weak

    public = _HERE.parent / "public/data/sdm/sdm_metadata.json"
    if public.exists():
        data = json.loads(public.read_text())
        weak = []
        for s in data.get("species", []):
            boyce_raw = s.get("boyce")
            if boyce_raw is None:
                continue
            try:
                boyce = float(boyce_raw)
            except (ValueError, TypeError):
                continue
            if boyce < threshold:
                weak.append((s["species"], boyce))
        weak.sort(key=lambda t: t[1])
        return weak

    return []


def load_overrides():
    if OVERRIDES_PATH.exists():
        return json.loads(OVERRIDES_PATH.read_text())
    return {"_meta": {}, "species": {}}


def save_overrides(data):
    OVERRIDES_PATH.write_text(json.dumps(data, indent=2, default=str))


def load_checkpoint():
    if CHECKPOINT_PATH.exists():
        return set(json.loads(CHECKPOINT_PATH.read_text()).get("done", []))
    return set()


def save_checkpoint(done_set):
    CHECKPOINT_PATH.write_text(
        json.dumps(
            {
                "done": sorted(done_set),
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        )
    )


# ── Signal handling for graceful shutdown ───────────────────────────────────
_stop_requested = False


def _handle_signal(signum, frame):
    global _stop_requested
    if not _stop_requested:
        _stop_requested = True
        name = {signal.SIGINT: "SIGINT", signal.SIGTERM: "SIGTERM"}.get(
            signum, str(signum)
        )
        print(
            f"\n⚠ {name} received — finishing current species then stopping cleanly.",
            flush=True,
        )


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="ENMeval-style per-species MaxEnt tuning for weak SDMs"
    )
    parser.add_argument(
        "--species",
        nargs="*",
        help="Specific species to tune (bypasses the Boyce threshold filter)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.3,
        help="Tune species whose best_boyce is below this (default: 0.3)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip species listed in .tune_checkpoint.json",
    )
    parser.add_argument(
        "--time-limit",
        type=int,
        default=None,
        help="Stop after N seconds of wall time (useful for overnight windows)",
    )
    parser.add_argument(
        "--max-species",
        type=int,
        default=None,
        help="Process at most N species (default: all matching threshold)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List target species and exit without fitting",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Use a tiny 2x2 grid (4 cells) for smoke testing only",
    )
    args = parser.parse_args()

    rm_grid = [1.5, 2.5] if args.quick else DEFAULT_RM_GRID
    fc_grid = (
        [["linear", "quadratic"], ["linear", "quadratic", "hinge"]]
        if args.quick
        else DEFAULT_FC_GRID
    )

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    print("=" * 70)
    print("STEP 6: PER-SPECIES MAXENT TUNING (ENMeval-style grid search)")
    print("=" * 70)
    print("Selection: CV Boyce (primary)  |  feature-class simplicity (tiebreak)")
    grid_label = "QUICK (smoke test)" if args.quick else "full ENMeval"
    print(
        f"Grid: {len(rm_grid)} RM × {len(fc_grid)} feature-class "
        f"= {len(rm_grid) * len(fc_grid)} cells per species  [{grid_label}]"
    )

    if args.species:
        targets = [(s, None) for s in args.species]
    else:
        targets = load_weak_species(args.threshold)
        if not targets:
            print(
                f"\nNo species found with best_boyce < {args.threshold}. "
                "Check sdm_results_summary.json or sdm_metadata.json."
            )
            return 1

    done = load_checkpoint() if args.resume else set()
    if args.resume and done:
        print(f"\nCheckpoint: {len(done)} species already done — skipping those")
        targets = [(s, b) for s, b in targets if s not in done]

    if args.max_species:
        targets = targets[: args.max_species]

    print(f"\nTargets ({len(targets)}):")
    for s, b in targets[:25]:
        if b is not None:
            print(f"    • {s:<35}  baseline_boyce = {b:+.3f}")
        else:
            print(f"    • {s}")
    if len(targets) > 25:
        print(f"    … +{len(targets) - 25} more")

    if args.dry_run:
        print("\n(dry run — not fitting)")
        return 0

    print("\n1. Loading environmental layers...")
    env_rasters = _sdm.get_env_rasters()

    print("\n2. Loading target-group background...")
    all_coords = _sdm.load_all_occurrences()

    bias_weights = bias_grid_coords = None
    if config["modelling"].get("use_bias_raster", False) and all_coords is not None:
        print("\n3. Creating bias raster...")
        bandwidth = config["modelling"].get("bias_bandwidth", 1.0)
        bias_weights, bias_grid_coords, _ = _sdm.create_bias_raster(
            all_coords, config["study_area"], resolution=0.1, bandwidth=bandwidth
        )
        print(f"   Bias raster: {len(bias_weights)} cells (bandwidth={bandwidth}°)")

    overrides = load_overrides()

    run_start = time.time()
    for i, (species_name, baseline_boyce) in enumerate(targets, 1):
        if _stop_requested:
            break
        elapsed = time.time() - run_start
        if args.time_limit and elapsed > args.time_limit:
            print(f"\n⚠ Time limit ({args.time_limit}s) reached — stopping.")
            break

        header = f"\n── [{i}/{len(targets)}] {species_name}"
        if baseline_boyce is not None:
            header += f"   baseline Boyce={baseline_boyce:+.3f}"
        print(header + " ──")

        t0 = time.time()
        result = tune_one_species(
            species_name,
            env_rasters,
            all_coords,
            bias_weights,
            bias_grid_coords,
            rm_grid=rm_grid,
            fc_grid=fc_grid,
        )
        dt = time.time() - t0

        if result["status"] != "ok":
            print(f"  ⚠ Skipped: {result['status']}")
            continue

        baseline_str = (
            f"{baseline_boyce:+.3f}" if baseline_boyce is not None else "  N/A"
        )
        delta = result["best_boyce"] - (baseline_boyce or 0)
        delta_str = f"{delta:+.3f}" if baseline_boyce is not None else "  N/A"
        print(
            f"\n  ★ Best: RM={result['best_rm']:.1f}, "
            f"FC={'+'.join(result['best_features'])}, "
            f"Boyce={result['best_boyce']:+.3f}  "
            f"(baseline {baseline_str}, Δ={delta_str})  [{dt:.0f}s total]"
        )

        # Persist overrides incrementally so SIGTERM loses at most one species
        safe_name = species_name.replace(" ", "_").lower()
        overrides.setdefault("species", {})[safe_name] = {
            "maxent_rm": result["best_rm"],
            "maxent_features": result["best_features"],
            "baseline_boyce": baseline_boyce,
            "tuned_boyce": result["best_boyce"],
            "tuned_auc": result["best_auc"],
            "tier": result["tier"],
            "n_presences": result["n_presences"],
            "grid_size": len(result["grid_results"]),
            "tuned_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        overrides["_meta"] = {
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "grid_rm": rm_grid,
            "grid_features": fc_grid,
            "quick_grid": args.quick,
            "selection_criterion": "cv_boyce_with_simplicity_tiebreak",
            "boyce_tie_epsilon": BOYCE_TIE_EPSILON,
            "references": [
                "Kass et al. 2021, Methods Ecol Evol 12:1602 (ENMeval 2.0)",
                "Hirzel et al. 2006, Ecol Modell 199:142 (continuous Boyce)",
                "Warren & Seifert 2011, Ecol Appl 21:335 (AICc model selection)",
            ],
        }
        save_overrides(overrides)

        done.add(species_name)
        save_checkpoint(done)

    print("\n" + "=" * 70)
    print(f"Tuned {len(done)} species total (across all sessions).")
    print(f"Overrides: {OVERRIDES_PATH.relative_to(_HERE.parent)}")
    print("Next: rerun `python 04_run_sdm.py` to apply tuned parameters.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
