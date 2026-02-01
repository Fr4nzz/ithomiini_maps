"""
Shared configuration: paths, constants, regex patterns, thresholds.
"""

import re
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent.parent
SCRIPTS_DIR = Path(__file__).parent.parent
DATA_FILE = PROJECT_ROOT / "public" / "data" / "map_points.json"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"
CURATION_REPORT = OUTPUT_DIR / "taxonomic_curation_report.json"
TAXONOMY_CACHE_FILE = OUTPUT_DIR / "gbif_taxonomy_cache.json"
TAXON_KEYS_FILE = OUTPUT_DIR / "gbif_taxon_keys.json"
CORRECTIONS_FILE = SCRIPTS_DIR / "taxonomic_corrections.json"
SANGER_TAXONOMY_FILE = OUTPUT_DIR / "sanger_taxonomy.csv"
CORRECTIONS_LOG_FILE = OUTPUT_DIR / "taxonomic_corrections_applied.json"
MANIFEST_FILE = OUTPUT_DIR / "data_manifest.json"

# ── GBIF API ─────────────────────────────────────────────────────────────────

GBIF_API = "https://api.gbif.org/v1"
GBIF_MATCH_URL = f"{GBIF_API}/species/match"
GBIF_SEARCH_URL = f"{GBIF_API}/species/search"
GBIF_USAGE_URL = f"{GBIF_API}/species"

# Higher taxonomy constraints for disambiguation (Grenié et al. 2023)
HIGHER_TAXONOMY = {
    "kingdom": "Animalia",
    "phylum": "Arthropoda",
    "class": "Insecta",
    "order": "Lepidoptera",
    "family": "Nymphalidae",
}

# Rate limiting
REQUEST_DELAY = 0.1  # 100ms between requests (~10/sec)
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0  # seconds, multiplied by attempt number

# ── Name patterns ────────────────────────────────────────────────────────────

PLACEHOLDER_GENERA = {"Unknown", "MISSING", "Genus1", "Genus2"}
PLACEHOLDER_SPECIES = {"species", "sp.", "(family)", "(tribe)"}

UNDESCRIBED_PATTERNS = re.compile(
    r"^(n\.\s*ssp|ssp\.?\s*n|ssp\.?\s*nov|ssp\.?\??|cf\.|or\s)",
    re.IGNORECASE,
)

# ── Subspecies typo detection thresholds ─────────────────────────────────────

SSP_MAX_RARE_COUNT = 5       # subspecies with count <= this are candidates
SSP_MIN_RATIO = 3            # abundant must be >= 3x the rare count
SSP_MIN_SIMILARITY = 0.85    # SequenceMatcher ratio threshold
SSP_MAX_EDIT_DISTANCE = 1    # Levenshtein distance threshold (OR with similarity)

# ── Output files (split by source for lazy loading) ──────────────────────────

SOURCE_DATA_FILES = {
    "Sanger Institute": "map_points_sanger.json",
    "GBIF": "map_points_gbif.json",
    "Dore et al. (2025)": "map_points_dore.json",
    "iNaturalist": "map_points_inaturalist.json",
}
IMAGE_SUPPLEMENT_FILE = OUTPUT_DIR / "map_points_images.json"

# ── Column presets for different input formats ───────────────────────────────

COLUMN_PRESETS = {
    "map_points": {
        "scientific_name": "scientific_name",
        "genus": "genus",
        "species": "species",
        "subspecies": "subspecies",
    },
    "dore_excel": {
        "Genus": "genus",
        "Species": "species",
        "Sub.species": "subspecies",
    },
    "csv_standard": {
        "scientific_name": "scientific_name",
        "genus": "genus",
        "species": "species",
        "subspecies": "subspecies",
    },
}
