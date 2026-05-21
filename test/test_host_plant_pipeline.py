import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.host_plants.host_plant_pipeline import (
    apply_confidence_audit,
    build_association_outputs,
    canonical_host_taxon,
    confidence_allows_default_download,
    confidence_is_excluded,
    attach_multimedia_to_occurrences,
    process_download_api_occurrences,
    select_taxa_for_occurrence_download,
    taxon_key_map,
)


class HostPlantPipelineTests(unittest.TestCase):
    def test_excludes_records_marked_exclude_or_erroneous(self):
        records = [
            {
                "butterfly_taxon": "Aeria elara",
                "host_plant_species": "Prestonia coalita",
                "host_plant_genus": "Prestonia",
                "host_plant_family": "Apocynaceae",
                "host_taxon_rank": "species",
                "confidence": "medium",
                "source_citation": "Source",
            },
            {
                "butterfly_taxon": "Aeria elara",
                "host_plant_species": "Solanum badrecord",
                "host_plant_genus": "Solanum",
                "host_plant_family": "Solanaceae",
                "host_taxon_rank": "species",
                "confidence": "exclude",
                "caveats": "Erroneous host record.",
            },
        ]

        associations, taxa = build_association_outputs(records)

        self.assertEqual(len(associations), 1)
        self.assertEqual(associations[0]["host_taxon_name"], "Prestonia coalita")
        self.assertEqual([taxon["canonical_name"] for taxon in taxa], ["Prestonia coalita"])

    def test_low_confidence_association_is_kept_but_not_default_download_target(self):
        records = [
            {
                "butterfly_taxon": "Callithomia alexirrhoe",
                "host_plant_genus": "Solanum",
                "host_plant_family": "Solanaceae",
                "host_taxon_rank": "genus_spp",
                "confidence": "low",
                "evidence_type": "dubious catalogue row",
                "source_citation": "Source",
            }
        ]

        associations, taxa = build_association_outputs(records)

        self.assertEqual(len(associations), 1)
        self.assertEqual(associations[0]["confidence"], "low")
        self.assertFalse(associations[0]["use_for_default_download"])
        self.assertFalse(taxa[0]["use_for_default_download"])

    def test_deduplicates_taxa_by_name_rank_and_family(self):
        records = [
            {
                "butterfly_taxon": "Aeria elara",
                "host_plant_species": "Prestonia coalita",
                "host_plant_genus": "Prestonia",
                "host_plant_family": "Apocynaceae",
                "host_taxon_rank": "species",
                "confidence": "medium",
            },
            {
                "butterfly_taxon": "Aeria olena",
                "host_plant_species": "Prestonia coalita",
                "host_plant_genus": "Prestonia",
                "host_plant_family": "Apocynaceae",
                "host_taxon_rank": "species",
                "confidence": "high",
            },
        ]

        associations, taxa = build_association_outputs(records)

        self.assertEqual(len(associations), 2)
        self.assertEqual(len(taxa), 1)
        self.assertEqual(taxa[0]["association_count"], 2)
        self.assertEqual(taxa[0]["confidence_counts"], {"medium": 1, "high": 1})

    def test_family_level_records_do_not_become_species_targets(self):
        taxon = canonical_host_taxon({
            "host_plant_name_verbatim": "Unidentified species",
            "host_plant_family": "Apocynaceae",
            "host_taxon_rank": "unidentified_species",
        })

        self.assertEqual(taxon["canonical_name"], "Apocynaceae")
        self.assertEqual(taxon["rank"], "family")
        self.assertFalse(taxon["resolvable_to_gbif"])

    def test_confidence_helpers_are_case_insensitive(self):
        self.assertTrue(confidence_is_excluded("Exclude"))
        self.assertTrue(confidence_allows_default_download("HIGH"))
        self.assertFalse(confidence_allows_default_download("low"))

    def test_confidence_audit_overrides_records_before_association_build(self):
        records = [
            {
                "butterfly_taxon": "Aeria elara",
                "host_plant_species": "Prestonia coalita",
                "host_plant_genus": "Prestonia",
                "host_plant_family": "Apocynaceae",
                "host_taxon_rank": "species",
                "confidence": "medium",
            }
        ]
        apply_confidence_audit(records, {
            1: {
                "curated_confidence": "high",
                "curation_action": "upgrade",
                "evidence_basis": "Direct juvenile-stage evidence.",
                "citation_for_ui": "Brown & Freitas 1994",
            }
        })

        associations, taxa = build_association_outputs(records)

        self.assertEqual(associations[0]["confidence"], "high")
        self.assertEqual(associations[0]["confidence_bucket"], "high")
        self.assertEqual(associations[0]["curation_action"], "upgrade")
        self.assertEqual(associations[0]["citation_for_ui"], "Brown & Freitas 1994")
        self.assertEqual(taxa[0]["confidence_counts"], {"high": 1})

    def test_select_taxa_can_limit_to_species_rank(self):
        taxa = [
            {
                "canonical_name": "Prestonia coalita",
                "slug": "species_prestonia_coalita",
                "rank": "species",
                "resolvable_to_gbif": True,
                "use_for_default_download": True,
            },
            {
                "canonical_name": "Solanum",
                "slug": "genus_solanum",
                "rank": "genus",
                "resolvable_to_gbif": True,
                "use_for_default_download": True,
            },
        ]

        selected = select_taxa_for_occurrence_download(
            taxa,
            taxon_filters=[],
            rank_filters=["species"],
            max_taxa=None,
            include_low_confidence=False,
        )

        self.assertEqual([taxon["slug"] for taxon in selected], ["species_prestonia_coalita"])

    def test_taxon_key_map_uses_slugs_for_download_cache_matching(self):
        taxa = [
            {"slug": "species_prestonia_coalita", "gbif_taxon_key": 5536637},
            {"slug": "unresolved", "gbif_taxon_key": None},
        ]

        self.assertEqual(taxon_key_map(taxa), {"species_prestonia_coalita": 5536637})

    def test_zero_download_limit_keeps_all_unique_coordinates(self):
        taxa = [{"slug": "species_prestonia_coalita", "gbif_taxon_key": 5536637}]
        with TemporaryDirectory() as temp_dir:
            occurrence_path = Path(temp_dir) / "occurrence.txt"
            occurrence_path.write_text(
                "\t".join([
                    "taxonKey",
                    "decimalLongitude",
                    "decimalLatitude",
                    "occurrenceStatus",
                    "gbifID",
                ])
                + "\n"
                + "5536637\t-78.1\t-0.1\tPRESENT\t1\n"
                + "5536637\t-78.2\t-0.2\tPRESENT\t2\n"
                + "5536637\t-78.3\t-0.3\tPRESENT\t3\n",
                encoding="utf-8",
            )

            results = process_download_api_occurrences(
                Path(temp_dir),
                taxa,
                limit=0,
                download_info={"key": "test-download", "doi": "10.15468/test"},
            )

        records, meta = results["species_prestonia_coalita"]
        self.assertEqual(len(records), 3)
        self.assertIsNone(meta["limit"])

    def test_download_processing_excludes_high_coordinate_uncertainty(self):
        taxa = [{"slug": "species_prestonia_coalita", "gbif_taxon_key": 5536637}]
        with TemporaryDirectory() as temp_dir:
            occurrence_path = Path(temp_dir) / "occurrence.txt"
            occurrence_path.write_text(
                "\t".join([
                    "taxonKey",
                    "decimalLongitude",
                    "decimalLatitude",
                    "coordinateUncertaintyInMeters",
                    "occurrenceStatus",
                    "gbifID",
                ])
                + "\n"
                + "5536637\t-78.1\t-0.1\t100000\tPRESENT\t1\n"
                + "5536637\t-78.2\t-0.2\t100001\tPRESENT\t2\n",
                encoding="utf-8",
            )

            results = process_download_api_occurrences(
                Path(temp_dir),
                taxa,
                limit=0,
                download_info={"key": "test-download", "doi": "10.15468/test"},
            )

        records, _meta = results["species_prestonia_coalita"]
        self.assertEqual([record["gbifID"] for record in records], ["1"])

    def test_multimedia_fallback_uses_same_species_image(self):
        results = {
            "species_solanum": ([
                {"gbifID": "1", "species": "Solanum testum"},
                {"gbifID": "2", "species": "Solanum testum"},
            ], {})
        }
        with TemporaryDirectory() as temp_dir:
            multimedia_path = Path(temp_dir) / "multimedia.txt"
            multimedia_path.write_text(
                "gbifID\ttype\tformat\tidentifier\treferences\tlicense\n"
                "2\tStillImage\timage/jpeg\thttps://example.test/plant.jpg\thttps://gbif.test/2\tCC_BY_4_0\n",
                encoding="utf-8",
            )

            attach_multimedia_to_occurrences(Path(temp_dir), results)

        records, _meta = results["species_solanum"]
        self.assertEqual(records[1]["media"][0]["url"], "https://example.test/plant.jpg")
        self.assertEqual(records[0]["fallback_media"]["url"], "https://example.test/plant.jpg")


if __name__ == "__main__":
    unittest.main()
