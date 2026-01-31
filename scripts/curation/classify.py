"""
Name classification (subspecies categorization) and unique name extraction.
"""

import re
from .config import (
    PLACEHOLDER_GENERA, PLACEHOLDER_SPECIES, UNDESCRIBED_PATTERNS,
)


def classify_subspecies(subspecies):
    """
    Classify a subspecies string into categories.
    Returns: (category, cleaned_name)

    Categories: standard, undescribed, question_mark, form_name,
    slash_alt, free_text, geographic, absent
    """
    if not subspecies:
        return ("absent", None)

    ssp = subspecies.strip()
    if UNDESCRIBED_PATTERNS.match(ssp):
        return ("undescribed", ssp)
    if "?" in ssp:
        return ("question_mark", ssp.replace("?", "").strip())
    if ssp.startswith("f.") or ssp.startswith("f "):
        return ("form_name", ssp)
    if "/" in ssp:
        return ("slash_alt", ssp)
    if re.search(r'(WESTERN|EASTERN|NORTHERN|SOUTHERN)$', ssp):
        return ("geographic", re.sub(r'(WESTERN|EASTERN|NORTHERN|SOUTHERN)$', '', ssp).strip())
    if re.search(r'[()]', ssp) or re.match(r'^\d+$', ssp):
        return ("free_text", ssp)
    return ("standard", ssp.lower())


def extract_unique_names(records, limit=None):
    """
    Extract unique taxonomic name combinations to curate.
    Returns a list of dicts with genus, species_epithet, subspecies,
    scientific_name, ssp_category, ssp_cleaned, is_nominotypical.
    """
    seen = set()
    names = []

    for rec in records:
        genus = rec.get("genus", "")
        species_epithet = rec.get("species", "")
        subspecies = rec.get("subspecies")
        sci_name = rec.get("scientific_name", "")

        if genus in PLACEHOLDER_GENERA or species_epithet in PLACEHOLDER_SPECIES:
            continue

        key = (sci_name, subspecies or "")
        if key in seen:
            continue
        seen.add(key)

        ssp_category, ssp_cleaned = classify_subspecies(subspecies)
        is_nominotypical = (
            ssp_category == "standard" and ssp_cleaned
            and ssp_cleaned == species_epithet.lower()
        )

        names.append({
            "genus": genus,
            "species_epithet": species_epithet,
            "subspecies": subspecies or None,
            "scientific_name": sci_name,
            "ssp_category": ssp_category,
            "ssp_cleaned": ssp_cleaned,
            "is_nominotypical": is_nominotypical,
        })

        if limit and len(names) >= limit:
            break

    return names
