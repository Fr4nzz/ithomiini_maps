"""
Core curation pipeline — curate_name() and supporting helpers.
"""

import logging

from .config import UNDESCRIBED_PATTERNS
from .gbif import match_species, fetch_taxon
from .corrections import strip_author_from_name

log = logging.getLogger(__name__)


# ── Dict construction helpers (DRY) ─────────────────────────────────────────

def _make_accepted(entry, key_field="key"):
    """Build a standardised accepted_name dict from any GBIF-like entry."""
    return {
        "key": entry.get(key_field) or entry.get("key"),
        "canonicalName": entry.get("canonicalName", ""),
        "scientificName": entry.get("scientificName", ""),
        "status": entry.get("status") or entry.get("taxonomicStatus", "ACCEPTED"),
        "rank": entry.get("rank", "SPECIES"),
    }


def _make_species_match(entry, source="cache", synonym=False, **extra):
    """Build a standardised species_match dict."""
    out = {
        "matchType": entry.get("matchType", "EXACT"),
        "source": source,
        "status": entry.get("status", ""),
        "gbifKey": entry.get("key") or entry.get("usageKey"),
        "canonicalName": entry.get("canonicalName", ""),
        "scientificName": entry.get("scientificName", ""),
        "rank": entry.get("rank", ""),
        "synonym": synonym,
    }
    out.update(extra)
    return out


# ── Shared checks ────────────────────────────────────────────────────────────

def _check_sanger_verified(sci_name, sanger_species, result, context=""):
    """If sci_name is in the Sanger taxonomy, mark the result and return True."""
    if sci_name.lower() not in sanger_species:
        return False
    result["status"] = "verified_literature"
    result["flags"].append("SANGER_TAXONOMY_VERIFIED")
    result["notes"].append(
        f"'{sci_name}' verified in reference taxonomy (BoA / nymphalidae.net). {context}"
    )
    result["literature_action"] = f"sanger_taxonomy_verified:{sci_name}"
    result["curated_name"] = sci_name
    result["curation_basis"] = "Ref. Taxonomy"
    return True


# ── Main pipeline ────────────────────────────────────────────────────────────

def curate_name(name_entry, cache, correction_tables, sanger_species, ctx):
    """
    Curate a single taxonomic name against the GBIF backbone.

    Args:
        name_entry: dict from extract_unique_names()
        cache: GBIF taxonomy cache
        correction_tables: dict from load_corrections()
        sanger_species: set of lowered valid species names
        ctx: mutable context dict with 'api_call_count'

    Returns: curation result dict.
    """
    result = {
        "input": name_entry,
        "original_scientific_name": name_entry["scientific_name"],
        "species_match": None,
        "subspecies_match": None,
        "accepted_name": None,
        "recognized_subspecies": [],
        "curated_name": None,
        "curation_basis": None,
        "literature_action": None,
        "status": "pending",
        "flags": [],
        "notes": [],
    }

    # Phase 0: Literature pre-corrections
    name_entry, sci_name = _apply_literature_pre_corrections(
        name_entry, result, correction_tables
    )

    # Phase 1+2: Resolve species (cache -> synonym -> API fallback)
    _resolve_species(sci_name, cache, result, correction_tables,
                     sanger_species, ctx)

    # Phase 3: Validate subspecies
    _validate_subspecies_field(name_entry, sci_name, cache, result, ctx)

    # Phase 4: Determine overall status
    _determine_status(result)

    return result


# ── Phase 0: Literature pre-corrections ──────────────────────────────────────

def _apply_literature_pre_corrections(name_entry, result, tables):
    """Apply spelling corrections and subspecies-as-species reclassifications."""
    sci_name = name_entry["scientific_name"]

    # Spelling correction
    corrected = tables["spelling"].get(sci_name)
    if corrected:
        result["flags"].append("SPELLING_CORRECTED")
        result["notes"].append(f"Spelling correction (literature): '{sci_name}' -> '{corrected}'")
        result["literature_action"] = f"spelling_corrected:{corrected}"
        result["curation_basis"] = "Literature"
        name_entry = dict(name_entry)
        name_entry["scientific_name"] = corrected
        parts = corrected.split()
        if len(parts) >= 2:
            name_entry["genus"] = parts[0]
            name_entry["species_epithet"] = parts[1]
        sci_name = corrected

    # Subspecies-as-species reclassification
    ssp_remap = tables["subspecies_remap"].get(sci_name.lower())
    if ssp_remap:
        correct_species, ssp_epithet, source = ssp_remap
        result["flags"].append("SUBSPECIES_AS_SPECIES")
        result["notes"].append(
            f"Literature correction: '{sci_name}' is actually a subspecies. "
            f"Correct name: {correct_species} {ssp_epithet} ({source})"
        )
        result["literature_action"] = f"subspecies_reclassified:{correct_species} {ssp_epithet}"
        result["curated_name"] = f"{correct_species} {ssp_epithet}"
        result["curation_basis"] = "Literature"
        name_entry = dict(name_entry)
        name_entry["scientific_name"] = correct_species
        parts = correct_species.split()
        if len(parts) >= 2:
            name_entry["genus"] = parts[0]
            name_entry["species_epithet"] = parts[1]
        sci_name = correct_species

    return name_entry, sci_name


# ── Phase 1+2: Species resolution ───────────────────────────────────────────

def _resolve_species(sci_name, cache, result, tables, sanger_species, ctx):
    """Look up the species binomial: cache -> synonym -> API fallback."""
    binomial_lower = sci_name.lower()

    species_entry = cache["species"].get(binomial_lower)
    if species_entry:
        _resolve_accepted_species(species_entry, cache, result)
        return

    synonym_entry = cache["synonyms"].get(binomial_lower)
    if synonym_entry:
        _resolve_synonym(sci_name, synonym_entry, cache, result, ctx)
        return

    # Not in cache — API fallback
    _resolve_via_api(sci_name, cache, result, tables, sanger_species, ctx)


def _resolve_accepted_species(species_entry, cache, result):
    """Species found as accepted in cache."""
    result["species_match"] = _make_species_match(species_entry)
    result["accepted_name"] = _make_accepted(species_entry)
    result["curation_basis"] = "GBIF"
    sp_key = str(species_entry["key"])
    result["recognized_subspecies"] = [
        {"name": c, "status": "ACCEPTED"}
        for c in cache.get("children", {}).get(sp_key, [])
    ]


def _resolve_synonym(sci_name, synonym_entry, cache, result, ctx):
    """Species found as synonym in cache — resolve to accepted name."""
    result["species_match"] = _make_species_match(synonym_entry, synonym=True)
    result["flags"].append("SYNONYM")
    result["curation_basis"] = "GBIF Synonym"

    accepted_key = synonym_entry.get("acceptedKey")
    if not accepted_key:
        return

    # Try local cache first
    accepted = cache["species_by_key"].get(str(accepted_key))
    if accepted:
        result["accepted_name"] = _make_accepted(accepted)
        result["notes"].append(
            f"SYNONYM: '{sci_name}' -> accepted: '{accepted['canonicalName']}'"
        )
        acc_key_str = str(accepted["key"])
        result["recognized_subspecies"] = [
            {"name": c, "status": "ACCEPTED"}
            for c in cache.get("children", {}).get(acc_key_str, [])
        ]
        # Try to infer subspecies from the original epithet
        _try_synonym_epithet_as_subspecies(sci_name, accepted, cache, result, ctx)
        return

    # Accepted name outside cache — fetch via API
    ctx["api_call_count"] += 1
    acc_details = fetch_taxon(accepted_key)
    if acc_details and acc_details.get("canonicalName"):
        result["accepted_name"] = _make_accepted(acc_details)
    else:
        # API failed — fall back to string parsing
        accepted_name_str = synonym_entry.get("acceptedName", "")
        canonical = strip_author_from_name(accepted_name_str)
        canonical_parts = canonical.split()
        result["accepted_name"] = {
            "key": accepted_key,
            "canonicalName": canonical,
            "scientificName": accepted_name_str,
            "status": "ACCEPTED",
            "rank": "SUBSPECIES" if len(canonical_parts) >= 3 else "SPECIES",
        }

    result["notes"].append(
        f"SYNONYM: '{sci_name}' -> accepted: "
        f"'{result['accepted_name']['canonicalName']}' "
        f"(outside cache, key={accepted_key})"
    )


def _try_synonym_epithet_as_subspecies(sci_name, accepted, cache, result, ctx):
    """
    When a species synonym resolves to a different species, check if the
    original epithet exists as a subspecies of the accepted species.

    E.g. 'Hyposcada napirida' → 'Hyposcada illinissa' (species-level),
    but 'Hyposcada illinissa napirida' may exist as a valid subspecies.
    Only applies if confirmed by GBIF (cache children or API).
    """
    accepted_name = accepted.get("canonicalName", "")
    if accepted.get("rank", "SPECIES") != "SPECIES":
        return  # Already resolved to subspecies rank

    orig_parts = sci_name.split()
    acc_parts = accepted_name.split()
    if len(orig_parts) < 2 or len(acc_parts) < 2:
        return

    orig_epithet = orig_parts[1].lower()
    acc_epithet = acc_parts[1].lower()
    if orig_epithet == acc_epithet:
        return  # Same epithet — no inference needed

    # Check 1: Is the epithet in the recognized children list?
    trinomial = f"{accepted_name} {orig_parts[1]}"
    trinomial_lower = trinomial.lower()

    recognized_epithets = {
        child["name"].split()[-1].lower()
        for child in result.get("recognized_subspecies", [])
        if len(child["name"].split()) >= 3
    }
    if orig_epithet in recognized_epithets:
        result["accepted_name"]["canonicalName"] = trinomial
        result["accepted_name"]["rank"] = "SUBSPECIES"
        result["flags"].append("SYNONYM_EPITHET_AS_SUBSPECIES")
        result["notes"].append(
            f"Synonym epithet '{orig_parts[1]}' confirmed as subspecies "
            f"of {accepted_name} (in GBIF children list)."
        )
        return

    # Check 2: Is the trinomial in the cache as a subspecies?
    ssp_entry = cache["subspecies"].get(trinomial_lower)
    if ssp_entry:
        result["accepted_name"]["canonicalName"] = trinomial
        result["accepted_name"]["rank"] = "SUBSPECIES"
        result["flags"].append("SYNONYM_EPITHET_AS_SUBSPECIES")
        result["notes"].append(
            f"Synonym epithet '{orig_parts[1]}' confirmed as subspecies "
            f"of {accepted_name} (in GBIF subspecies cache)."
        )
        return

    # Check 3: API lookup for the trinomial
    ctx["api_call_count"] += 1
    ssp_result = match_species(trinomial, rank="SUBSPECIES")
    if not ssp_result:
        result["notes"].append(
            f"Synonym epithet '{orig_parts[1]}' could not be checked as subspecies "
            f"of {accepted_name} (API error). Manual review recommended."
        )
        return

    match_type = ssp_result.get("matchType", "NONE")
    if match_type == "EXACT":
        result["accepted_name"]["canonicalName"] = trinomial
        result["accepted_name"]["rank"] = "SUBSPECIES"
        result["flags"].append("SYNONYM_EPITHET_AS_SUBSPECIES")
        result["notes"].append(
            f"Synonym epithet '{orig_parts[1]}' confirmed as subspecies "
            f"of {accepted_name} (via GBIF API)."
        )
    else:
        # Not in backbone — log for manual review
        result["flags"].append("SYNONYM_EPITHET_UNCONFIRMED")
        result["notes"].append(
            f"Synonym '{sci_name}' resolved to species '{accepted_name}'. "
            f"Epithet '{orig_parts[1]}' not confirmed as subspecies in GBIF backbone "
            f"(match: {match_type}). Manual review recommended."
        )


def _resolve_via_api(sci_name, cache, result, tables, sanger_species, ctx):
    """Fallback: match via GBIF species/match API."""
    ctx["api_call_count"] += 1
    api_result = match_species(sci_name, rank="SPECIES")
    result["curation_basis"] = "GBIF API"

    if not api_result:
        result["status"] = "api_error"
        result["flags"].append("GBIF_API_ERROR")
        return

    match_type = api_result.get("matchType", "NONE")
    confidence = api_result.get("confidence", 0)

    result["species_match"] = _make_species_match(
        api_result, source="api_fallback",
        synonym=api_result.get("synonym", False),
        confidence=confidence,
        note=api_result.get("note", ""),
    )

    if match_type == "NONE":
        if _check_sanger_verified(sci_name, sanger_species, result):
            return
        result["status"] = "not_found"
        result["flags"].append("SPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"'{sci_name}' not found in GBIF Backbone (cache miss + API)."
        )
        return

    if match_type == "HIGHERRANK":
        if tables["valid_not_in_gbif"] and sci_name.lower() in tables["valid_not_in_gbif"]:
            result["status"] = "verified_literature"
            result["flags"].append("LITERATURE_VERIFIED")
            result["notes"].append(
                f"'{sci_name}' not in GBIF backbone but VERIFIED in specialist literature."
            )
            result["literature_action"] = f"verified_not_in_gbif:{sci_name}"
            result["curated_name"] = sci_name
            result["curation_basis"] = "Literature"
            return
        if _check_sanger_verified(sci_name, sanger_species, result,
                                   f"(matched {api_result.get('rank', '?')} only)"):
            return
        result["status"] = "higher_rank_only"
        result["flags"].append("MATCHED_HIGHER_RANK")
        result["notes"].append(
            f"'{sci_name}' matched only at {api_result.get('rank', '?')} level."
        )
        return

    if match_type == "FUZZY":
        matched_name = api_result.get("canonicalName", "")
        if _check_sanger_verified(sci_name, sanger_species, result):
            result["notes"][-1] = (
                f"GBIF suggested fuzzy match '{matched_name}' REJECTED. "
                f"Dataset name '{sci_name}' is correct per Sanger taxonomy."
            )
            result["species_match"]["matchType"] = "SANGER_VERIFIED"
            result["species_match"]["gbif_suggestion_rejected"] = matched_name
        elif tables["overrides"].get(sci_name.lower()):
            _, reason = tables["overrides"][sci_name.lower()]
            result["flags"].append("GBIF_FUZZY_OVERRIDDEN")
            result["notes"].append(
                f"GBIF suggested fuzzy match '{matched_name}' REJECTED. "
                f"Dataset name '{sci_name}' is correct per literature: {reason}"
            )
            result["literature_action"] = f"dataset_correct_over_gbif:{sci_name}"
            result["curated_name"] = sci_name
            result["curation_basis"] = "Literature"
            result["species_match"]["matchType"] = "LITERATURE_VERIFIED"
            result["species_match"]["literature_override"] = True
            result["species_match"]["gbif_suggestion_rejected"] = matched_name
        else:
            result["flags"].append("FUZZY_MATCH")
            result["curation_basis"] = "GBIF Fuzzy"
            result["notes"].append(
                f"Fuzzy match: '{sci_name}' -> '{matched_name}' (confidence: {confidence}%)."
            )

    # Handle synonym from API result
    if api_result.get("synonym"):
        result["flags"].append("SYNONYM")
        result["curation_basis"] = "GBIF Synonym"
        acc_key = api_result.get("acceptedUsageKey")
        if acc_key:
            accepted = cache["species_by_key"].get(str(acc_key))
            if accepted:
                result["accepted_name"] = _make_accepted(accepted)
            result["notes"].append(f"SYNONYM via API: '{sci_name}' -> acceptedKey={acc_key}")
    else:
        result["accepted_name"] = _make_accepted(api_result, key_field="usageKey")


# ── Phase 3: Subspecies validation ──────────────────────────────────────────

def _validate_subspecies_field(name_entry, sci_name, cache, result, ctx):
    """Validate the subspecies field based on its category."""
    ssp_category = name_entry["ssp_category"]
    subspecies = name_entry.get("subspecies")
    ssp_cleaned = name_entry.get("ssp_cleaned")

    if ssp_category == "absent":
        return

    if ssp_category == "undescribed":
        result["flags"].append("UNDESCRIBED_SUBSPECIES")
        result["notes"].append(f"Undescribed subspecies marker: '{subspecies}'")
        return

    if ssp_category == "question_mark":
        result["flags"].append("QUESTION_MARK_SUBSPECIES")
        result["notes"].append(f"Uncertainty marker in subspecies: '{subspecies}'")
        if ssp_cleaned:
            _validate_subspecies(sci_name, ssp_cleaned, subspecies, cache, result, ctx)
        return

    if ssp_category == "form_name":
        result["flags"].append("FORM_NAME")
        result["notes"].append(f"Form name in subspecies field: '{subspecies}'")
        return

    if ssp_category == "slash_alt":
        result["flags"].append("SLASH_ALTERNATIVE")
        alternatives = [s.strip() for s in subspecies.split("/")]
        result["notes"].append(f"Slash-delimited alternatives: {alternatives}")
        for alt in alternatives:
            if alt and not UNDESCRIBED_PATTERNS.match(alt):
                _validate_subspecies(
                    sci_name, alt.lower(), subspecies, cache, result, ctx,
                    note_prefix=f"Alternative '{alt}': "
                )
        return

    if ssp_category == "geographic":
        result["flags"].append("GEOGRAPHIC_SUFFIX")
        result["notes"].append(f"Geographic suffix in subspecies: '{subspecies}'")
        if ssp_cleaned:
            _validate_subspecies(sci_name, ssp_cleaned, subspecies, cache, result, ctx)
        return

    if ssp_category == "free_text":
        result["flags"].append("FREE_TEXT_SUBSPECIES")
        result["notes"].append(f"Non-standard text in subspecies field: '{subspecies}'")
        return

    # Standard subspecies
    if name_entry.get("is_nominotypical"):
        result["flags"].append("NOMINOTYPICAL")
        result["notes"].append(
            f"Nominotypical subspecies: '{subspecies}' "
            f"(matches species epithet '{name_entry['species_epithet']}')."
        )
    _validate_subspecies(sci_name, ssp_cleaned, subspecies, cache, result, ctx)


def _validate_subspecies(sci_name, ssp_cleaned, ssp_original, cache, result, ctx,
                          note_prefix=""):
    """Validate a subspecies name against cache, then API."""
    trinomial_lower = f"{sci_name.lower()} {ssp_cleaned}"

    # Check accepted subspecies
    ssp_entry = cache["subspecies"].get(trinomial_lower)
    if ssp_entry:
        result["subspecies_match"] = _make_species_match(ssp_entry)
        result["notes"].append(f"{note_prefix}Subspecies '{ssp_cleaned}' found in GBIF backbone (cache).")
        return

    # Check synonym subspecies
    ssp_synonym = cache["synonyms"].get(trinomial_lower)
    if ssp_synonym:
        result["subspecies_match"] = _make_species_match(ssp_synonym, synonym=True)
        result["flags"].append("SUBSPECIES_SYNONYM")
        result["notes"].append(
            f"{note_prefix}Subspecies synonym: '{ssp_original}' -> '{ssp_synonym.get('acceptedName', '?')}'"
        )
        return

    # Check children cross-reference
    recognized_epithets = {
        child["name"].split()[-1].lower()
        for child in result.get("recognized_subspecies", [])
        if len(child["name"].split()) >= 3
    }
    if ssp_cleaned in recognized_epithets:
        result["subspecies_match"] = _make_species_match(
            {"canonicalName": f"{sci_name} {ssp_cleaned}", "rank": "SUBSPECIES", "status": "ACCEPTED"},
            source="children_crossref",
        )
        result["notes"].append(f"{note_prefix}Subspecies '{ssp_cleaned}' confirmed via children list.")
        return

    # If parent is in cache, we have complete children — no need for API
    binomial_lower = sci_name.lower()
    if binomial_lower in cache.get("species", {}) or binomial_lower in cache.get("synonyms", {}):
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' not in GBIF backbone "
            f"(parent species cached, children list checked)."
        )
        return

    # Parent not in cache — API fallback
    trinomial_full = f"{sci_name} {ssp_cleaned}"
    ctx["api_call_count"] += 1
    ssp_result = match_species(trinomial_full, rank="SUBSPECIES")

    if not ssp_result:
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(f"{note_prefix}Subspecies '{ssp_cleaned}' not found (API error).")
        return

    ssp_match_type = ssp_result.get("matchType", "NONE")
    ssp_canonical = ssp_result.get("canonicalName", "")
    ssp_confidence = ssp_result.get("confidence", 0)

    result["subspecies_match"] = _make_species_match(
        ssp_result, source="api_fallback",
        synonym=ssp_result.get("synonym", False),
        confidence=ssp_confidence,
    )

    if ssp_match_type == "NONE":
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(f"{note_prefix}Subspecies '{ssp_cleaned}' not found in GBIF backbone.")
    elif ssp_match_type == "HIGHERRANK":
        result["flags"].append("SUBSPECIES_MATCHED_HIGHER")
        result["notes"].append(f"{note_prefix}Subspecies '{ssp_cleaned}' matched only at species level.")
    elif ssp_match_type == "FUZZY":
        matched_parts = ssp_canonical.split()
        matched_epithet = matched_parts[-1] if len(matched_parts) >= 3 else ""
        if ssp_cleaned != matched_epithet.lower():
            result["flags"].append("SUBSPECIES_FUZZY_FALSE_POSITIVE")
            result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
            result["notes"].append(
                f"{note_prefix}Fuzzy FALSE POSITIVE: '{ssp_cleaned}' matched to '{matched_epithet}'."
            )
        else:
            result["flags"].append("SUBSPECIES_FUZZY")
            result["notes"].append(
                f"{note_prefix}Subspecies fuzzy match: '{ssp_cleaned}' -> '{ssp_canonical}' "
                f"(confidence: {ssp_confidence}%)"
            )
    elif ssp_result.get("synonym"):
        result["flags"].append("SUBSPECIES_SYNONYM")
        result["notes"].append(f"{note_prefix}Subspecies synonym via API: '{trinomial_full}'")
    else:
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' found via API (not in local cache)."
        )


# ── Phase 4: Status determination ───────────────────────────────────────────

def _determine_status(result):
    """Determine overall curation status from flags."""
    flags = set(result["flags"])
    if not flags:
        result["status"] = "verified"
        _set_curated_name(result)
        return

    # Priority ordering
    if "SUBSPECIES_AS_SPECIES" in flags:
        result["status"] = "corrected_literature"
    elif "SPELLING_CORRECTED" in flags:
        result["status"] = "corrected_literature"
    elif "SANGER_TAXONOMY_VERIFIED" in flags:
        result["status"] = "verified_literature"
    elif "GBIF_FUZZY_OVERRIDDEN" in flags:
        result["status"] = "verified_literature"
    elif "LITERATURE_VERIFIED" in flags:
        result["status"] = "verified_literature"
    elif "GBIF_API_ERROR" in flags:
        result["status"] = "api_error"
    elif "SPECIES_NOT_IN_BACKBONE" in flags or "MATCHED_HIGHER_RANK" in flags:
        result["status"] = "higher_rank_only"
    elif "SYNONYM" in flags:
        result["status"] = "synonym_resolved"
    elif "FUZZY_MATCH" in flags:
        result["status"] = "review_spelling"
    elif "UNDESCRIBED_SUBSPECIES" in flags:
        result["status"] = "undescribed"
    elif flags & {"QUESTION_MARK_SUBSPECIES", "FORM_NAME", "SLASH_ALTERNATIVE",
                   "FREE_TEXT_SUBSPECIES", "GEOGRAPHIC_SUFFIX"}:
        result["status"] = "non_standard_subspecies"
    elif flags & {"SUBSPECIES_FUZZY_FALSE_POSITIVE", "SUBSPECIES_NOT_IN_BACKBONE",
                   "SUBSPECIES_MATCHED_HIGHER"}:
        result["status"] = "subspecies_unresolved"
    elif "SUBSPECIES_SYNONYM" in flags:
        result["status"] = "subspecies_synonym"
    elif "SUBSPECIES_FUZZY" in flags:
        result["status"] = "review_subspecies_spelling"
    elif "NOMINOTYPICAL" in flags:
        result["status"] = "verified_nominotypical"
    else:
        result["status"] = "verified"

    _set_curated_name(result)


def _set_curated_name(result):
    """Set curated_name — the final recommended name after all corrections."""
    if result.get("curated_name"):
        return

    # Don't assign a curated name for unresolvable statuses
    if result["status"] in ("api_error", "not_found", "higher_rank_only"):
        return

    inp = result["input"]
    ssp = inp.get("subspecies")
    ssp_suffix = f" {inp['ssp_cleaned']}" if ssp and inp.get("ssp_category") == "standard" else ""

    # Synonym resolution
    if result.get("accepted_name") and "SYNONYM" in result.get("flags", []):
        result["curated_name"] = result["accepted_name"]["canonicalName"] + ssp_suffix
        return

    # GBIF fuzzy spelling
    if "FUZZY_MATCH" in result.get("flags", []) and result.get("species_match"):
        result["curated_name"] = result["species_match"]["canonicalName"] + ssp_suffix
        return

    # Default: input name
    result["curated_name"] = inp.get("scientific_name", "") + ssp_suffix
