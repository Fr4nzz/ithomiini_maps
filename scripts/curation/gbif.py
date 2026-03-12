"""
GBIF API interaction, rate limiting, and taxonomy cache management.
"""

import json
import time
import logging
import requests

from .config import (
    GBIF_API, GBIF_MATCH_URL, GBIF_SEARCH_URL, GBIF_USAGE_URL,
    HIGHER_TAXONOMY, REQUEST_DELAY, MAX_RETRIES, RETRY_BACKOFF,
    TAXONOMY_CACHE_FILE, TAXON_KEYS_FILE, PLACEHOLDER_GENERA,
)

log = logging.getLogger(__name__)


# ── API helpers ──────────────────────────────────────────────────────────────

def gbif_request(url, params, retries=MAX_RETRIES):
    """Make a GBIF API request with retry logic and rate limiting."""
    for attempt in range(retries):
        try:
            time.sleep(REQUEST_DELAY)
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429 or resp.status_code >= 500:
                wait = RETRY_BACKOFF * (attempt + 1) * 2
                log.warning(
                    f"HTTP {resp.status_code} (attempt {attempt+1}/{retries}), "
                    f"retrying in {wait:.1f}s"
                )
                time.sleep(wait)
            else:
                log.warning(f"HTTP {resp.status_code} for {params}")
                return None
        except requests.RequestException as e:
            wait = RETRY_BACKOFF * (attempt + 1)
            log.warning(f"Request error (attempt {attempt+1}): {e}, retrying in {wait:.1f}s")
            time.sleep(wait)
    log.error(f"All {retries} retries exhausted for {url}")
    return None


def match_species(name, rank="SPECIES", strict=False):
    """Match a scientific name against the GBIF Backbone Taxonomy."""
    params = {
        "name": name,
        "rank": rank,
        "strict": str(strict).lower(),
        "verbose": "true",
        **HIGHER_TAXONOMY,
    }
    return gbif_request(GBIF_MATCH_URL, params)


def fetch_taxon(taxon_key):
    """Fetch metadata for a single taxon by key via /v1/species/{key}."""
    return gbif_request(f"{GBIF_USAGE_URL}/{taxon_key}", {})


# ── Genus key resolution ────────────────────────────────────────────────────

def resolve_genus_keys(records):
    """Build genus -> GBIF taxon key mapping from cache + API discovery."""
    cached_keys = {}
    if TAXON_KEYS_FILE.exists():
        with open(TAXON_KEYS_FILE) as f:
            data = json.load(f)
        cached_keys = data.get("genera", {})
        log.info(f"Loaded {len(cached_keys)} pre-cached genus keys")

    all_genera = {
        rec.get("genus", "")
        for rec in records
        if rec.get("genus", "") and rec["genus"] not in PLACEHOLDER_GENERA
    }
    log.info(f"Dataset contains {len(all_genera)} unique genera")

    missing = all_genera - set(cached_keys.keys())
    if missing:
        log.info(f"Looking up {len(missing)} genera not in cache...")
        for i, genus in enumerate(sorted(missing), 1):
            if i % 20 == 0 or i == 1:
                log.info(f"  [{i}/{len(missing)}] Looking up {genus}...")
            result = gbif_request(GBIF_MATCH_URL, {
                "name": genus, "rank": "GENUS",
                "kingdom": "Animalia", "class": "Insecta", "order": "Lepidoptera",
            })
            if result and result.get("matchType") != "NONE":
                if result.get("rank") == "GENUS":
                    cached_keys[genus] = result.get("usageKey")
                else:
                    log.warning(
                        f"  Genus '{genus}' matched at {result.get('rank')} level, skipping"
                    )
            else:
                log.warning(f"  Genus '{genus}' not found in GBIF backbone")

        with open(TAXON_KEYS_FILE, "w") as f:
            json.dump({"created": time.strftime("%Y-%m-%dT%H:%M:%S"), "genera": cached_keys}, f, indent=2)
        log.info(f"Updated genus keys file: {len(cached_keys)} total genera")

    return {g: k for g, k in cached_keys.items() if g in all_genera}


# ── Taxonomy cache ───────────────────────────────────────────────────────────

def _fetch_genus_taxa(genus_name, genus_key):
    """Fetch ALL taxa under a genus from GBIF (paginated)."""
    all_results = []
    offset = 0
    limit = 1000
    while True:
        data = gbif_request(GBIF_SEARCH_URL, {
            "higherTaxonKey": genus_key, "limit": limit, "offset": offset,
        })
        if not data:
            break
        all_results.extend(data.get("results", []))
        offset += limit
        if offset >= data.get("count", 0):
            break
    return all_results


def build_taxonomy_cache(genus_keys):
    """Build a taxonomy cache by bulk-fetching all taxa from GBIF."""
    cache = {
        "metadata": {
            "api_built_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "source": "GBIF Backbone Taxonomy via species/search API",
            "genera_fetched": len(genus_keys),
        },
        "species": {},
        "subspecies": {},
        "synonyms": {},
        "species_by_key": {},
        "children": {},
    }

    total_taxa = 0
    for i, (genus, key) in enumerate(genus_keys.items(), 1):
        log.info(f"[{i}/{len(genus_keys)}] Fetching {genus} (key={key})...")
        taxa = _fetch_genus_taxa(genus, key)
        genus_sp = genus_ssp = genus_syn = 0

        for taxon in taxa:
            rank = taxon.get("rank", "")
            canonical = taxon.get("canonicalName", "")
            status = taxon.get("taxonomicStatus", "")
            if not canonical or rank == "UNRANKED":
                continue

            entry = {
                "key": taxon.get("key"),
                "canonicalName": canonical,
                "scientificName": taxon.get("scientificName", ""),
                "status": status,
                "acceptedKey": taxon.get("acceptedKey"),
                "acceptedName": taxon.get("accepted", ""),
                "rank": rank,
                "genus": genus,
            }
            key_lower = canonical.lower()
            is_synonym = status == "SYNONYM"

            if rank == "SPECIES":
                if is_synonym:
                    cache["synonyms"][key_lower] = entry
                    genus_syn += 1
                else:
                    cache["species"][key_lower] = entry
                    cache["species_by_key"][str(entry["key"])] = entry
                    genus_sp += 1
            elif rank == "SUBSPECIES":
                if is_synonym:
                    cache["synonyms"][key_lower] = entry
                    genus_syn += 1
                else:
                    cache["subspecies"][key_lower] = entry
                    genus_ssp += 1
                    # Track children for parent species
                    parts = canonical.split()
                    if len(parts) >= 3:
                        parent_lower = f"{parts[0]} {parts[1]}".lower()
                        parent = cache["species"].get(parent_lower)
                        if parent:
                            pkey = str(parent["key"])
                            cache["children"].setdefault(pkey, []).append(canonical)

        total_taxa += len(taxa)
        log.info(f"  -> {genus_sp} species, {genus_ssp} subspecies, {genus_syn} synonyms")

    meta = cache["metadata"]
    meta["total_taxa"] = total_taxa
    meta["total_species"] = len(cache["species"])
    meta["total_subspecies"] = len(cache["subspecies"])
    meta["total_synonyms"] = len(cache["synonyms"])

    log.info(
        f"Cache built: {len(cache['species'])} species, "
        f"{len(cache['subspecies'])} subspecies, "
        f"{len(cache['synonyms'])} synonyms"
    )
    return cache


def load_or_build_cache(records, force_rebuild=False):
    """Load taxonomy cache from disk, or build it from GBIF."""
    if not force_rebuild and TAXONOMY_CACHE_FILE.exists():
        log.info(f"Loading taxonomy cache from {TAXONOMY_CACHE_FILE}")
        with open(TAXONOMY_CACHE_FILE) as f:
            cache = json.load(f)
        meta = cache.get("metadata", {})
        bulk_date = meta.get("bulk_enriched_at", "never")
        api_date = meta.get("api_built_at", meta.get("built_at", "never"))
        log.info(
            f"Cache loaded: {len(cache.get('species', {}))} species, "
            f"{len(cache.get('subspecies', {}))} subspecies, "
            f"{len(cache.get('synonyms', {}))} synonyms"
        )
        log.info(f"  GBIF download enrichment: {bulk_date}")
        log.info(f"  API fallback last updated: {api_date}")
        return cache

    log.info("Building taxonomy cache from GBIF (bulk fetch)...")
    genus_keys = resolve_genus_keys(records)
    cache = build_taxonomy_cache(genus_keys)

    with open(TAXONOMY_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2, default=str)
    log.info(f"Cache saved to {TAXONOMY_CACHE_FILE}")

    meta = cache.get("metadata", {})
    log.info(f"  API fallback built at: {meta.get('api_built_at', '?')}")
    return cache
