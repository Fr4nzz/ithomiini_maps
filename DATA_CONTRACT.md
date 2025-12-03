# Ithomiini Maps - Data Contract & Schema Documentation

> **Generated:** 2025  
> **Purpose:** Document the exact structure of all data sources to eliminate guesswork in ETL and frontend code.

---

## 1. Data Sources Overview

| Source | Records | Primary Use | Update Frequency |
|--------|---------|-------------|------------------|
| Local Excel (Dore et al.) | 28,927 | Published occurrence data | Static |
| Google Sheets (Sanger) | ~377 with photos | Live collection/sequencing status | Dynamic |
| GBIF API | Variable | External occurrence enrichment | On-demand |

---

## 2. Local Excel File: `Dore_Ithomiini_records.xlsx`

### 2.1 Schema

| Column Name | Data Type | Description | Missing Values |
|-------------|-----------|-------------|----------------|
| `ID_obs` | int64 | Unique observation identifier | 0 |
| `Genus` | string | Taxonomic genus | 0 |
| `Species` | string | Species epithet (not full binomial) | 0 |
| `Sub.species` | string | Subspecies/form name | Some |
| `Latitude` | float64 | Decimal latitude | 0 |
| `Longitude` | float64 | Decimal longitude | 0 |
| `M.mimicry` | string | Male mimicry ring | Some |
| `F.mimicry` | string | Female mimicry ring | Some |
| `Country` | string | Country name | 0 |

### 2.2 Taxonomic Diversity

| Field | Unique Values | Sample Values |
|-------|---------------|---------------|
| Genus | 48 | Aeria, Aremfoxia, Athesis, Athyrtis, Brevioleria |
| Species | 375 | elara, eurimedia, olena, ferra, acrisione |
| Sub.species | 1,004 | elara, elarina, n. ssp. [1], n. ssp. [3], agna |
| M.mimicry | 44 | EURIMEDIA, MESTRA, CONFUSA, ACRISIONE, DILUCIDA |
| Country | 23 | Venezuela, Brazil, Guyana, Bolivia, Peru |

### 2.3 Data Quality Notes

- ✅ **No missing coordinates** - All 28,927 records have valid lat/lng
- ⚠️ **Mimicry rings are UPPERCASE** - Need normalization to Title Case
- ⚠️ **Species is epithet only** - Must concatenate `Genus + Species` for scientific name
- ⚠️ **No Family/Tribe columns** - Must be added (all are Nymphalidae/Ithomiini)

---

## 3. Google Sheets: Sanger Collection Data

### 3.1 Critical Columns for App

| Column Name | Purpose | Sample Values |
|-------------|---------|---------------|
| `CAM_ID` | Primary identifier | CAM12345 |
| `CAM_ID_insectary` | Fallback ID | CAM12345 |
| `Family` | Taxonomic family | Nymphalidae |
| `Subfamily` | Taxonomic subfamily | Ithomiinae |
| `Tribe` | Taxonomic tribe | Ithomiini |
| `Genus` | Taxonomic genus | Mechanitis |
| `SPECIES` | Full species name | Mechanitis menophilus |
| `Subspecies_Form` | Subspecies/form | nevadensis |
| `DECIMAL_LATITUDE` | Coordinate | -0.9234 |
| `DECIMAL_LONGITUDE` | Coordinate | -77.8123 |
| `Country` | Country name | Ecuador |

### 3.2 Sequencing Status Logic

The sequencing status is determined by checking tube/rack columns:

```python
def determine_sequencing_status(row):
    # Priority 1: Check if in Sanger rack system
    rack_1 = str(row.get('Tube_1_rack', ''))
    if 'Not in TOL' not in rack_1 and len(rack_1) > 5:
        return "Sequenced"
    
    # Priority 2: Check if tissue was collected
    tissue_1 = str(row.get('Tube_1_tissue', ''))
    if 'NOT_COLLECTED' not in tissue_1 and tissue_1 not in ['nan', '']:
        return "Tissue Available"
    
    # Default: Just preserved
    return "Preserved Specimen"
```

### 3.3 Sequencing Column Reference

| Column | Purpose | Key Values |
|--------|---------|------------|
| `Tube_1_rack` | Sanger rack location | `FK00224058`, `Not in TOL704` |
| `Tube_1_tissue` | Tissue type collected | `HEAD`, `WHOLE_ORGANISM`, `NOT_COLLECTED` |
| `Tube_1_manifest` | Manifest ID | `MEIER_000002`, `Not in STS` |
| `ID_status` | Identification confidence | `COMPLETE`, `Complete_but_verify`, `To_identify` |

### 3.4 Photo Linkage Statistics

- **Unique Photo IDs:** 4,727 photos in database
- **Unique Collection IDs:** 377 specimens with CAM_IDs
- **Successful Matches:** 134 specimens have linked photos

---

## 4. GBIF API Response Structure

### 4.1 Species Match Endpoint

**URL:** `https://api.gbif.org/v1/species/match?name={species}&kingdom=Animalia`

**Key Response Fields:**
```json
{
  "matchType": "EXACT",           // EXACT, FUZZY, HIGHERRANK, NONE
  "confidence": 99,               // 0-100 confidence score
  "usageKey": 5133580,            // Key for occurrence search
  "acceptedUsageKey": 5133580,    // Key if name is synonym
  "scientificName": "Aeria elara Hewitson, 1855",
  "canonicalName": "Aeria elara",
  "genus": "Aeria",
  "species": "Aeria elara",
  "family": "Nymphalidae",
  "order": "Lepidoptera"
}
```

### 4.2 Occurrence Search Endpoint

**URL:** `https://api.gbif.org/v1/occurrence/search?taxonKey={usageKey}&hasCoordinate=true&limit=300`

**Key Fields Per Record:**
```json
{
  "key": 123456789,
  "decimalLatitude": -15.741297,
  "decimalLongitude": -47.885995,
  "scientificName": "Aeria elara Hewitson, 1855",
  "acceptedScientificName": "Aeria elara Hewitson, 1855",
  "genus": "Aeria",
  "species": "Aeria elara",
  "family": "Nymphalidae",
  "country": "Brazil",
  "eventDate": "2025-01-04T10:45:18",
  "basisOfRecord": "HUMAN_OBSERVATION",
  "isSequenced": false,
  "media": [...]
}
```

### 4.3 Media/Image Structure

```json
{
  "media": [
    {
      "type": "StillImage",
      "format": "image/jpeg",
      "identifier": "https://inaturalist-open-data.s3.amazonaws.com/photos/461669416/original.jpg",
      "references": "https://www.inaturalist.org/photos/461669416",
      "creator": "Maria Clara Gil",
      "license": "http://creativecommons.org/licenses/by-nc/4.0/"
    }
  ]
}
```

**Image URL Extraction:**
```python
image_url = None
if 'media' in record and record['media']:
    for m in record['media']:
        if m.get('type') == 'StillImage' and m.get('identifier'):
            image_url = m['identifier']
            break
```

---

## 5. Canonical Output Schema

The Python ETL pipeline must produce JSON conforming to this schema:

### 5.1 `map_points.json` (Lightweight for Map)

```json
[
  {
    "id": "CAM12345",
    "scientific_name": "Mechanitis menophilus",
    "genus": "Mechanitis",
    "species": "menophilus",
    "subspecies": "nevadensis",
    "family": "Nymphalidae",
    "tribe": "Ithomiini",
    "lat": -0.9234,
    "lng": -77.8123,
    "mimicry_ring": "Tiger",
    "sequencing_status": "Sequenced",
    "source": "Sanger Institute",
    "country": "Ecuador",
    "image_url": "https://wsrv.nl/?url=...",
    "collection_location": "Mindo, Pichincha",
    "observation_date": "2024-03-15"
  }
]
```

### 5.2 Field Normalization Rules

| Field | Normalization |
|-------|---------------|
| `mimicry_ring` | Title Case (e.g., "EURIMEDIA" → "Eurimedia") |
| `scientific_name` | `{Genus} {species}` (binomial) |
| `subspecies` | Null if empty/missing, otherwise as-is |
| `family` | Default "Nymphalidae" if missing |
| `tribe` | Default "Ithomiini" if missing |
| `source` | One of: "Dore et al. (2025)", "Sanger Institute", "GBIF" |
| `collection_location` | Null if empty/missing, locality string from source |
| `observation_date` | Null if empty/missing, date string from source |

### 5.3 Sequencing Status Enum

```
"Sequenced"           - Sample in Sanger rack system
"Tissue Available"    - Tissue collected but not yet sequenced
"Preserved Specimen"  - Physical specimen only
"Published"           - From Dore et al. dataset (no live tracking)
```

---

## 6. Filter Hierarchy Design

### 6.1 Taxonomic Cascade

```
Family (hidden by default, all Nymphalidae)
  └── Tribe (hidden by default, all Ithomiini)
       └── Genus (expandable)
            └── Species (always visible) ← PRIMARY FILTER
                 └── Subspecies (always visible)
```

### 6.2 Parallel Filters (Non-cascading)

- **Mimicry Ring:** Shows all 44 options always (collapsible)
- **Sequencing Status:** Toggle buttons (multi-select)
- **Country:** Optional future addition

### 6.3 Reset Behavior

When a filter is **collapsed/hidden**, it automatically resets to "All":
- Expand advanced filters → make selections → collapse → selections reset
- This prevents hidden filters from silently restricting data

---

## 7. API Rate Limits & Caching

| API | Rate Limit | Recommendation |
|-----|------------|----------------|
| GBIF Species Match | Generous | Cache results in `taxonomy_cache.json` |
| GBIF Occurrence | ~3 req/sec | Batch by species, sleep between calls |
| Google Sheets | None (public) | Fetch fresh on each pipeline run |
| wsrv.nl (Image Proxy) | Generous | Use for all external images |

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2025-12-03 | Added `collection_location` and `observation_date` fields to schema |
| 2025-XX-XX | Initial schema documentation |

