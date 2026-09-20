"""Shared occurrence quality checks for map data and SDM inputs."""

from pathlib import Path
import re

import pandas as pd


GBIF_SOURCES = {"iNaturalist", "GBIF (UNAM)", "GBIF (Other Institutions)", "GBIF"}
SANGER_SOURCE = "Sanger Institute"
DORE_SOURCE = "Dore et al. (2022)"

STUDY_AREA = {
    "west": -120.0,
    "east": -30.0,
    "south": -40.0,
    "north": 25.0,
}

OCEAN_BUFFER_KM = 5.0
NO_LOCALITY_PATTERN = re.compile(r"no specific locality", re.IGNORECASE)


def source_is_gbif(source):
    return source in GBIF_SOURCES


def compute_gbif_quality_flags(df):
    """Return GBIF-only non-spatial quality flags indexed like df."""
    if "coordinate_uncertainty" in df.columns:
        uncertainty = pd.to_numeric(df["coordinate_uncertainty"], errors="coerce")
        high_uncertainty = uncertainty.fillna(0) > 100_000
    else:
        high_uncertainty = pd.Series(False, index=df.index)

    if "collection_location" in df.columns:
        no_specific_locality = df["collection_location"].fillna("").apply(
            lambda x: bool(NO_LOCALITY_PATTERN.search(str(x)))
        )
    else:
        no_specific_locality = pd.Series(False, index=df.index)

    return {
        "high_uncertainty": high_uncertainty.astype(bool),
        "no_specific_locality": no_specific_locality.astype(bool),
    }


def compute_spatial_qc(df, env_root=None, study_area=None):
    """Return spatial flags and a concise display label for each record.

    The ocean check uses the GSHHS Neotropics subset with a 5 km land
    tolerance when available, matching the existing pipeline behavior.
    """
    study_area = study_area or STUDY_AREA
    lng = pd.to_numeric(df["lng"], errors="coerce")
    lat = pd.to_numeric(df["lat"], errors="coerce")

    outside_bbox = (
        (lng < study_area["west"])
        | (lng > study_area["east"])
        | (lat < study_area["south"])
        | (lat > study_area["north"])
    ).fillna(False)

    in_ocean = pd.Series(False, index=df.index)
    ocean_mask_label = "no mask"

    if env_root is not None:
        env_root = Path(env_root)
        gshhs_path = env_root / "gshhs_f_neotropics" / "gshhs_f_neotropics.shp"
        ne_path = env_root / "ne_110m_land"

        valid_idx = df.index[lng.notna() & lat.notna()]

        try:
            import geopandas as gpd

            if gshhs_path.exists() and len(valid_idx) > 0:
                land_m = gpd.read_file(gshhs_path).to_crs(4087)
                pts = gpd.GeoDataFrame(
                    df.loc[valid_idx, ["lng", "lat"]].copy(),
                    geometry=gpd.points_from_xy(lng.loc[valid_idx], lat.loc[valid_idx]),
                    crs="EPSG:4326",
                ).to_crs(4087)
                near = gpd.sjoin_nearest(
                    pts[["geometry"]],
                    land_m[["geometry"]],
                    distance_col="_d",
                    how="left",
                )
                near = near[~near.index.duplicated(keep="first")]
                in_ocean.loc[valid_idx] = (near["_d"] > OCEAN_BUFFER_KM * 1000.0).values
                ocean_mask_label = f"GSHHS +{OCEAN_BUFFER_KM:g}km buffer"
            elif ne_path.exists() and len(valid_idx) > 0:
                from shapely.geometry import Point
                from shapely.ops import unary_union
                from shapely.prepared import prep

                land = gpd.read_file(ne_path)
                land_prep = prep(unary_union(land.geometry))
                on_land = df.loc[valid_idx].apply(
                    lambda r: land_prep.contains(Point(r["lng"], r["lat"])), axis=1
                )
                in_ocean.loc[valid_idx] = ~on_land
                ocean_mask_label = "Natural Earth 110m fallback"
        except Exception as exc:
            print(f"   Warning: ocean filter skipped ({exc})")

    labels = []
    for idx in df.index:
        issues = []
        if bool(outside_bbox.loc[idx]):
            issues.append("Outside study area")
        if bool(in_ocean.loc[idx]):
            issues.append("Ocean")
        labels.append("; ".join(issues) if issues else "OK")

    return {
        "outside_bbox": outside_bbox.astype(bool),
        "in_ocean": in_ocean.astype(bool),
        "spatial_check": pd.Series(labels, index=df.index),
        "ocean_mask_label": ocean_mask_label,
        "study_area": study_area,
    }
