"""
Taxonomic Name Curation Pipeline
=================================
Validates and curates taxonomic names in the Ithomiini dataset against the
GBIF Backbone Taxonomy (built on the Catalogue of Life).

Modules:
  config       — Paths, constants, thresholds
  gbif         — GBIF API interaction and taxonomy cache
  corrections  — Literature-based corrections, subspecies typo detection
  classify     — Name classification and extraction
  curate       — Core curation pipeline (curate_name)
  apply        — Apply corrections to dataset records
  output       — File writing (split JSON, image supplement, manifest)
  report       — Quality assessment, summary printing, JSON reports
"""
