#!/usr/bin/env python3
"""
SDM Pipeline Runner
===================
Runs all steps of the Species Distribution Modelling pipeline.

Usage:
    python run_pipeline.py              # Run full pipeline (all viable species)
    python run_pipeline.py --poc        # Run proof-of-concept (5 species)
    python run_pipeline.py --step 1     # Run specific step only
    python run_pipeline.py --step 1-3   # Run steps 1 through 3
    python run_pipeline.py --species "Mechanitis polymnia" "Tithorea harmonia"
"""

import argparse
import subprocess
import sys
from pathlib import Path
import time

STEPS = {
    1: ('01_prepare_occurrences.py', 'Prepare occurrence data'),
    2: ('02_download_env_data.py', 'Download environmental data'),
    3: ('03_host_plants.py', 'Build host plant layers'),
    4: ('04_run_sdm.py', 'Run species distribution models'),
    5: ('05_export_predictions.py', 'Export predictions for web'),
}

SDM_DIR = Path(__file__).parent
VENV_PYTHON = SDM_DIR / ".venv" / "bin" / "python3"


def run_step(step_num, extra_args=None):
    """Run a pipeline step."""
    script, description = STEPS[step_num]
    script_path = SDM_DIR / script

    print(f"\n{'='*70}")
    print(f"RUNNING STEP {step_num}: {description}")
    print(f"{'='*70}")

    cmd = [str(VENV_PYTHON), str(script_path)]
    if extra_args:
        cmd.extend(extra_args)

    start = time.time()
    result = subprocess.run(cmd, cwd=str(SDM_DIR))
    elapsed = time.time() - start

    if result.returncode != 0:
        print(f"\n❌ Step {step_num} failed (exit code {result.returncode})")
        print(f"   Time: {elapsed:.1f}s")
        return False

    print(f"\n✓ Step {step_num} completed in {elapsed:.1f}s")
    return True


def main():
    parser = argparse.ArgumentParser(description='Run SDM pipeline')
    parser.add_argument('--step', type=str, help='Step number(s): "1", "1-3", "2,4"')
    parser.add_argument('--poc', action='store_true', help='Proof-of-concept mode (5 species)')
    parser.add_argument('--species', nargs='*', help='Specific species to model')
    args = parser.parse_args()

    # Determine which steps to run
    if args.step:
        if '-' in args.step:
            start, end = map(int, args.step.split('-'))
            steps = list(range(start, end + 1))
        elif ',' in args.step:
            steps = [int(s) for s in args.step.split(',')]
        else:
            steps = [int(args.step)]
    else:
        steps = [1, 2, 3, 4, 5]

    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║        ITHOMIINI SPECIES DISTRIBUTION MODELLING PIPELINE           ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")
    print(f"\nSteps to run: {steps}")
    if args.poc:
        print("Mode: Proof-of-concept (5 species)")
    elif args.species:
        print(f"Mode: Custom species ({len(args.species)} species)")
    else:
        print("Mode: All viable species")

    total_start = time.time()

    for step in steps:
        if step not in STEPS:
            print(f"Unknown step: {step}. Valid steps: {list(STEPS.keys())}")
            continue

        # Pass extra args to step 4 (modelling)
        extra_args = None
        if step == 4:
            extra_args = []
            if args.poc:
                extra_args.append('--poc')
            if args.species:
                extra_args.extend(['--species'] + args.species)

        success = run_step(step, extra_args)
        if not success:
            print(f"\nPipeline stopped at step {step}.")
            sys.exit(1)

    total_elapsed = time.time() - total_start
    print(f"\n{'='*70}")
    print(f"PIPELINE COMPLETE! Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
