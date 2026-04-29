#!/usr/bin/env python3
"""
Step 1: Prepare occurrence data for SDM.
Extracts Ithomiini records from the map_points JSON files,
cleans coordinates, and spatially thins them.
"""

import json
import yaml
import numpy as np
import pandas as pd
import geopandas as gpd
from pathlib import Path
from collections import Counter
from utils.spatial import spatial_thin

# Load config
CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)


def load_occurrence_records():
    """Load all Ithomiini occurrence records from map_points JSON files."""
    data_dir = Path(__file__).parent / config["paths"]["occurrence_data"]

    all_records = []
    sdm_sources = [
        "map_points_sanger.json",
        "map_points_inaturalist.json",
        "map_points_gbif_other.json",
        "map_points_gbif_unam.json",
    ]
    for json_file in sdm_sources:
        fpath = data_dir / json_file
        if fpath.exists():
            with open(fpath) as f:
                records = json.load(f)
            print(f"  Loaded {len(records)} records from {json_file}")
            all_records.extend(records)
        else:
            print(f"  WARNING: {json_file} not found at {fpath}")

    df = pd.DataFrame(all_records)
    print(f"  Total records loaded: {len(df)}")
    return df


def filter_ithomiini(df):
    """Filter to Ithomiini tribe only."""
    ithomiini = df[df["tribe"] == "Ithomiini"].copy()
    print(f"  Ithomiini records: {len(ithomiini)}")
    return ithomiini


def clean_coordinates(df):
    """Remove records with invalid or missing coordinates."""
    initial = len(df)

    # Remove missing
    df = df.dropna(subset=["lat", "lng"])

    # Remove zeros and obviously wrong coordinates
    df = df[(df["lat"] != 0) & (df["lng"] != 0)]

    # Remove out-of-range
    df = df[(df["lat"] >= -90) & (df["lat"] <= 90)]
    df = df[(df["lng"] >= -180) & (df["lng"] <= 180)]

    # Remove points outside Neotropical extent (rough filter)
    extent = config["study_area"]
    df = df[
        (df["lng"] >= extent["west"])
        & (df["lng"] <= extent["east"])
        & (df["lat"] >= extent["south"])
        & (df["lat"] <= extent["north"])
    ]

    # Remove ocean points using GSHHS full-resolution coastline (Wessel &
    # Smith 1996), clipped to the Neotropics, with a 5 km buffer that
    # absorbs GPS-precision rounding around tight coastlines and small
    # islands. Falls back to the coarse Natural Earth 110m mask if the
    # GSHHS subset is missing.
    OCEAN_BUFFER_KM = 5.0
    env_root = Path(__file__).parent / config["paths"]["env_variables"]
    gshhs_path = env_root / "gshhs_f_neotropics" / "gshhs_f_neotropics.shp"
    ne_path = env_root / "ne_110m_land"
    before_ocean = len(df)

    if gshhs_path.exists():
        import geopandas as gpd

        land_m = gpd.read_file(gshhs_path).to_crs(4087)
        pts = gpd.GeoDataFrame(
            df[["lng", "lat"]].copy(),
            geometry=gpd.points_from_xy(df["lng"], df["lat"]),
            crs="EPSG:4326",
        ).to_crs(4087)
        near = gpd.sjoin_nearest(
            pts[["geometry"]], land_m[["geometry"]], distance_col="_d", how="left"
        )
        near = near[~near.index.duplicated(keep="first")]
        on_land = (near["_d"] <= OCEAN_BUFFER_KM * 1000.0).values
        df = df[on_land]
        print(
            f"  Ocean points removed: {before_ocean - len(df)} "
            f"(GSHHS-full +{OCEAN_BUFFER_KM:g}km buffer)"
        )
    elif ne_path.exists():
        import geopandas as gpd
        from shapely.geometry import Point
        from shapely.ops import unary_union
        from shapely.prepared import prep

        print("  Notice: GSHHS subset not found, falling back to coarse NE 110m mask")
        land = gpd.read_file(ne_path)
        land_prep = prep(unary_union(land.geometry))
        on_land = df.apply(
            lambda r: land_prep.contains(Point(r["lng"], r["lat"])), axis=1
        )
        df = df[on_land]
        print(f"  Ocean points removed: {before_ocean - len(df)} (NE 110m fallback)")
    else:
        print(f"  Warning: ocean filter skipped (no land mask under {env_root})")

    print(f"  Cleaned coordinates: {initial} → {len(df)} ({initial - len(df)} removed)")
    return df


def filter_coordinate_quality(df):
    """Remove records with unreliable coordinates (museum geocoding, centroids)."""
    import re
    initial = len(df)

    # 1. High coordinate uncertainty (>100 km) — country/region centroids
    if "coordinate_uncertainty" in df.columns:
        high_uncert = df["coordinate_uncertainty"].fillna(0) > 100_000
        n_uncert = high_uncert.sum()
    else:
        high_uncert = pd.Series(False, index=df.index)
        n_uncert = 0

    # 2. Latitude > 35°N — well outside Ithomiini range (max ~25°N)
    too_far_north = df["lat"] > 35
    n_north = too_far_north.sum()

    # 3. Records with explicit "no specific locality" placeholders.
    # Earlier versions also matched zoo / aquariu / museum / botanical
    # garden, but those substrings cause false positives — e.g. "OTS Adv.
    # Zoo Course" (a real Costa Rica field locality) and "Departamento
    # de Zootecnia" (a Brazilian university dept) — and only flag ~70
    # records out of 70k. The trade-off favours the simpler rule.
    no_locality_pattern = re.compile(r"no specific locality", re.IGNORECASE)
    if "collection_location" in df.columns:
        bad_locality = df["collection_location"].fillna("").apply(
            lambda x: bool(no_locality_pattern.search(str(x)))
        )
        n_locality = bad_locality.sum()
    else:
        bad_locality = pd.Series(False, index=df.index)
        n_locality = 0

    flagged = high_uncert | too_far_north | bad_locality
    df = df[~flagged]

    print(f"  Coordinate quality filter: {initial} → {len(df)} ({flagged.sum()} removed)")
    print(f"    High uncertainty (>100km): {n_uncert}")
    print(f"    Too far north (>35°N): {n_north}")
    print(f"    No-specific-locality placeholders: {n_locality}")
    return df


def build_species_name(df):
    """Ensure consistent scientific names (Genus species)."""
    df["scientific_name"] = df["genus"] + " " + df["species"]
    # Remove sp., cf., aff., etc.
    df = df[~df["species"].str.contains(r"^(?:sp\.|cf\.|aff\.|nr\.)", na=False)]
    # Remove Unknown genus
    df = df[df["genus"] != "Unknown"]
    df = df[df["genus"] != "NOT_FOUND"]
    return df


def generate_species_summary(df, thinning_distance_km):
    """Generate summary of species records and SDM viability."""
    species_counts = df.groupby("scientific_name").size().sort_values(ascending=False)
    min_records = config["modelling"]["min_records"]

    viable = (species_counts >= min_records).sum()
    marginal = ((species_counts >= 10) & (species_counts < min_records)).sum()
    insufficient = (species_counts < 10).sum()

    print(f"\n  Species summary (before thinning):")
    print(f"    Total species: {len(species_counts)}")
    print(f"    SDM viable (≥{min_records} records): {viable}")
    print(f"    Marginal (10-{min_records - 1} records): {marginal}")
    print(f"    Insufficient (<10 records): {insufficient}")

    return species_counts


def main():
    print("=" * 70)
    print("STEP 1: PREPARE OCCURRENCE DATA")
    print("=" * 70)

    # Load and filter
    print("\n1. Loading occurrence records...")
    df = load_occurrence_records()

    print("\n2. Filtering Ithomiini...")
    df = filter_ithomiini(df)

    print("\n3. Cleaning coordinates...")
    df = clean_coordinates(df)

    print("\n4. Filtering coordinate quality...")
    df = filter_coordinate_quality(df)

    print("\n5. Building species names...")
    df = build_species_name(df)

    print("\n6. Species summary...")
    thinning_km = config["modelling"]["thinning_distance_km"]
    species_counts = generate_species_summary(df, thinning_km)

    # Convert to GeoDataFrame
    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df.lng, df.lat), crs="EPSG:4326"
    )

    # Spatial thinning per species
    print(f"\n6. Spatial thinning ({thinning_km} km)...")
    min_records = config["modelling"]["min_records"]
    thinned_records = []
    species_stats = []

    for species_name, group in gdf.groupby("scientific_name"):
        if len(group) < 10:  # Skip very rare species entirely
            continue

        thinned = spatial_thin(group, thinning_km)
        thinned_records.append(thinned)

        viable = len(thinned) >= min_records
        species_stats.append(
            {
                "species": species_name,
                "raw_records": len(group),
                "thinned_records": len(thinned),
                "viable": viable,
            }
        )

    thinned_gdf = gpd.GeoDataFrame(pd.concat(thinned_records, ignore_index=True))
    stats_df = pd.DataFrame(species_stats).sort_values(
        "thinned_records", ascending=False
    )

    viable_species = stats_df[stats_df["viable"]]["species"].tolist()
    print(f"  After thinning: {len(thinned_gdf)} records")
    print(f"  Viable species: {len(viable_species)}")

    # Save outputs
    output_dir = Path(__file__).parent / config["paths"]["occurrences"]
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save all occurrences (for target-group background)
    all_occ_path = output_dir / "all_ithomiini_occurrences.parquet"
    thinned_gdf.to_parquet(all_occ_path)
    print(f"\n  Saved all occurrences: {all_occ_path}")

    # Save per-species occurrence files
    species_dir = output_dir / "species"
    species_dir.mkdir(exist_ok=True)

    for species_name in viable_species:
        sp_data = thinned_gdf[thinned_gdf["scientific_name"] == species_name]
        safe_name = species_name.replace(" ", "_").lower()
        sp_data.to_parquet(species_dir / f"{safe_name}.parquet")

    # Save species stats
    stats_path = output_dir / "species_stats.csv"
    stats_df.to_csv(stats_path, index=False)
    print(f"  Saved species stats: {stats_path}")

    # Save viable species list
    viable_path = output_dir / "viable_species.json"
    with open(viable_path, "w") as f:
        json.dump(viable_species, f, indent=2)
    print(f"  Saved viable species list: {viable_path} ({len(viable_species)} species)")

    print(f"\n  Top 20 species by thinned record count:")
    for _, row in stats_df.head(20).iterrows():
        print(f"    {row['species']}: {row['raw_records']} → {row['thinned_records']}")

    print("\nStep 1 complete!")


if __name__ == "__main__":
    main()
