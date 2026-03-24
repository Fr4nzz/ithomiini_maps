"""
GoaT (Genomes on a Tree) Data Fetcher
======================================
Fetches genomic data for all Lepidoptera species from GoaT API.
Outputs a species-keyed JSON for use by the Ithomiini Maps frontend.

API: https://goat.genomehubs.org/api/v2/search
Citation: Challis et al. 2023, Wellcome Open Research, 8:24
         DOI: 10.12688/wellcomeopenres.18658.1

Usage:
    python scripts/fetch_goat_data.py
    python scripts/fetch_goat_data.py --test    # Fetch only 10 results for testing
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. Install with: pip install requests")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

GOAT_API_BASE = "https://goat.genomehubs.org/api/v2/search"

# Fields to request from GoaT
GOAT_FIELDS = [
    "genome_size",
    "chromosome_number",
    "haploid_number",
    "c_value",
    "assembly_span",
    "assembly_level",
    "bioproject",
    "busco_completeness",
    "gc_percent",
]

# Queries: fetch Nymphalidae (family containing Ithomiini) for focused coverage
# Lepidoptera has 152K+ species which is too large; Nymphalidae gives us all
# Ithomiini plus related butterflies for broader genomic context
GOAT_QUERIES = [
    ("Nymphalidae", "tax_tree(Nymphalidae) AND tax_rank(species)"),
]

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "goat_lepidoptera.json"

MAX_RETRIES = 3
RETRY_BACKOFF = 2.0
REQUEST_TIMEOUT = 60

# ══════════════════════════════════════════════════════════════════════════════
# API INTERACTION
# ══════════════════════════════════════════════════════════════════════════════


def fetch_goat_data(query, size=5000):
    """
    Fetch species from GoaT API for a given taxonomic query.

    IMPORTANT: GoaT API returns 400 if spaces are encoded as + instead of %20.
    Uses urllib.parse.quote() instead of urlencode() for the query parameter.
    """
    encoded_query = quote(query)
    encoded_fields = quote(",".join(GOAT_FIELDS))

    url = (
        f"{GOAT_API_BASE}"
        f"?query={encoded_query}"
        f"&result=taxon"
        f"&fields={encoded_fields}"
        f"&includeEstimates=true"
        f"&taxonomy=ncbi"
        f"&size={size}"
    )

    print(f">> Fetching GoaT data (size={size})...")
    print(f"   URL: {url[:120]}...")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)

            if response.status_code == 200:
                data = response.json()
                hits = data.get("status", {}).get("hits", 0)
                results = data.get("results", [])
                print(f"   Success: {hits} species found, {len(results)} returned")

                if hits > size:
                    print(
                        f"   WARNING: {hits} total hits but only {size} returned. "
                        f"Increase size parameter to fetch all."
                    )

                return results

            elif response.status_code == 400:
                print(f"   ERROR: HTTP 400 Bad Request")
                print(f"   Response: {response.text[:500]}")
                # Don't retry 400 - it's a client error (likely URL encoding issue)
                return None

            else:
                wait = RETRY_BACKOFF * attempt
                print(
                    f"   HTTP {response.status_code} (attempt {attempt}/{MAX_RETRIES}), "
                    f"retrying in {wait:.0f}s..."
                )
                time.sleep(wait)

        except requests.Timeout:
            wait = RETRY_BACKOFF * attempt
            print(
                f"   Timeout (attempt {attempt}/{MAX_RETRIES}), "
                f"retrying in {wait:.0f}s..."
            )
            time.sleep(wait)

        except requests.RequestException as e:
            wait = RETRY_BACKOFF * attempt
            print(
                f"   Request error: {e} (attempt {attempt}/{MAX_RETRIES}), "
                f"retrying in {wait:.0f}s..."
            )
            time.sleep(wait)

    print(f"   ERROR: All {MAX_RETRIES} retries exhausted")
    return None


# ══════════════════════════════════════════════════════════════════════════════
# DATA TRANSFORMATION
# ══════════════════════════════════════════════════════════════════════════════


def extract_field(fields_dict, field_name):
    """
    Extract a field from GoaT's nested response structure.

    GoaT fields have this structure:
    {
        "value": 283620000,
        "aggregation_source": ["ancestor"],  # ARRAY, not string!
        "aggregation_method": "median",
        "aggregation_rank": "genus",
        "min": 283620000,
        "max": 283620000,
        "count": 1
    }

    Returns a simplified dict or None if field doesn't exist.
    """
    if not fields_dict or field_name not in fields_dict:
        return None

    field = fields_dict[field_name]
    if not isinstance(field, dict):
        return None

    value = field.get("value")
    if value is None:
        return None

    # aggregation_source is an ARRAY - check first element
    agg_source = field.get("aggregation_source", [])
    source = agg_source[0] if isinstance(agg_source, list) and agg_source else "unknown"

    result = {
        "value": value,
        "source": source,
    }

    # Add count if available
    count = field.get("count")
    if count is not None:
        result["count"] = count

    # For estimated values, include the rank it was estimated from
    if source == "ancestor":
        agg_rank = field.get("aggregation_rank")
        if agg_rank:
            result["aggregation_rank"] = agg_rank

    return result


def transform_results(results):
    """
    Transform GoaT API results into a species-keyed dictionary.

    Output format:
    {
        "species": {
            "Mechanitis polymnia": {
                "taxon_id": "12345",
                "genome_size": { "value": 385000000, "source": "direct", "count": 1 },
                "chromosome_number": { "value": 30, "source": "ancestor", "aggregation_rank": "genus" },
                ...
            }
        }
    }
    """
    species_data = {}
    direct_count = 0

    for entry in results:
        result = entry.get("result", {})
        scientific_name = result.get("scientific_name")
        taxon_id = result.get("taxon_id")

        if not scientific_name:
            continue

        fields = result.get("fields", {})

        # Extract all genomic fields
        species_entry = {"taxon_id": str(taxon_id) if taxon_id else None}

        has_any_data = False
        has_direct = False

        for field_name in GOAT_FIELDS:
            extracted = extract_field(fields, field_name)
            if extracted:
                species_entry[field_name] = extracted
                has_any_data = True
                if extracted.get("source") == "direct":
                    has_direct = True

        # Only include species that have at least some data
        if has_any_data:
            species_data[scientific_name] = species_entry
            if has_direct:
                direct_count += 1

    return species_data, direct_count


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Lepidoptera genomic data from GoaT (Genomes on a Tree)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Fetch only 10 results for testing",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=10000,
        help="Number of results to request per query (default: 10000)",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("GoaT (Genomes on a Tree) — Lepidoptera Genomic Data Fetcher")
    print("=" * 70)

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    size = 10 if args.test else args.size
    all_results = []

    for group_name, query in GOAT_QUERIES:
        print(f"\n>> Fetching {group_name}...")
        results = fetch_goat_data(query, size=size)
        if results is None:
            print(f"   WARNING: Failed to fetch {group_name}, skipping")
            continue
        all_results.extend(results)
        print(f"   Got {len(results)} results for {group_name}")

    if not all_results:
        print("\nERROR: No data fetched from GoaT API")
        sys.exit(1)

    print(f"\n>> Transforming {len(all_results)} total results...")
    species_data, direct_count = transform_results(all_results)

    # Build output
    output = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": "GoaT (Genomes on a Tree) - goat.genomehubs.org",
        "citation": "Challis et al. 2023, Wellcome Open Research, 8:24. DOI: 10.12688/wellcomeopenres.18658.1",
        "totalSpecies": len(species_data),
        "speciesWithDirectData": direct_count,
        "species": species_data,
    }

    # Save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    file_size = os.path.getsize(OUTPUT_FILE)

    # Statistics
    print("\n" + "=" * 70)
    print("OUTPUT STATISTICS")
    print("=" * 70)
    print(f"Total species with data:     {len(species_data):,}")
    print(f"Species with direct data:    {direct_count:,}")
    print(f"Species with estimates only:  {len(species_data) - direct_count:,}")

    # Field coverage
    print("\nField coverage:")
    for field_name in GOAT_FIELDS:
        count = sum(1 for sp in species_data.values() if field_name in sp)
        direct = sum(
            1
            for sp in species_data.values()
            if field_name in sp and sp[field_name].get("source") == "direct"
        )
        print(f"  {field_name:25s}: {count:5,} species ({direct:,} direct)")

    print(f"\n>> Saved to: {OUTPUT_FILE}")
    if file_size > 1024 * 1024:
        print(f">> File size: {file_size / (1024 * 1024):.1f} MB")
    else:
        print(f">> File size: {file_size / 1024:.1f} KB")

    print("\nDone!")


if __name__ == "__main__":
    main()
