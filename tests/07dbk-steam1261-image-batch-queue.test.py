#!/usr/bin/env python3
"""Synthetic-only negative tests; NO owner game bytes or names in CI."""
from __future__ import annotations
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parents[1]
FILE = HERE / "scripts/asset-research/07dbk-steam1261-image-batch-queue.py"
spec = importlib.util.spec_from_file_location("wand_07dbk_steam1261_private_queue", FILE)
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)
A = "guid:" + "a"*32
B = "guid:" + "b"*32
C = "guid:" + "c"*32
D = "guid:" + "d"*32

def fixture():
    return {
        "sourceVersion": "v1253", "targetVersion": "v1261",
        "sourceCount": 3, "targetCount": 7, "retained": 3,
        "iconGuidEqualCandidateCount": 3, "iconGuidChangedCount": 0,
        "removedCount": 0, "changedGuidCandidates": [], "removedCandidates": [],
        "sourceIconPixelShaCompared": False,
        "targetSwitchOriginalPngShaVerified": 0,
        "imagePublicEligibleRows": 0, "deployAllowed": False,
        "addedCount": 4,
        "addedCandidates": [
            {"itemId": "40000010", "category": "Furniture", "name": "Test Object A", "iconGuid": B},
            {"itemId": "40000011", "category": "Furniture", "name": "Test Object B", "iconGuid": B},
            {"itemId": "40000012", "category": "Furniture", "name": "Test Old Icon", "iconGuid": A},
            {"itemId": "40000013", "category": "Furniture", "name": "Test Object C", "iconGuid": C}
        ]
    }

class QueueSafety(unittest.TestCase):
    def test_exact_private_guid_dedup_and_name_pair(self):
        r = queue.build_image_queue(fixture(), {A, D})
        self.assertEqual(r["summary"]["newItemIds"], 4)
        self.assertEqual(r["summary"]["newUniqueIconGuids"], 2)
        self.assertEqual(r["summary"]["newGuidReferencedItemIds"], 3)
        self.assertEqual(r["summary"]["existingGuidReusedItemIds"], 1)
        self.assertEqual(r["summary"]["reusedUniqueIconGuids"], 1)
        self.assertEqual([g["iconGuid"] for g in r["extractNewGuidGroups"]], [B, C])
        self.assertEqual([x["itemId"] for x in r["extractNewGuidGroups"][0]["items"]],
                         ["40000010", "40000011"])
        self.assertEqual(r["recheckOldGuidGroups"][0]["items"][0]["name"], "Test Old Icon")
        self.assertFalse(r["consumerOn"])
        self.assertEqual(r["publicMedia"], "OFF")
        self.assertFalse(r["extractNewGuidGroups"][0]["publishAllowed"])
        self.assertEqual(r["summary"]["nativeOriginalMediaDecoded"], 0)

    def test_changed_guid_or_removed_item_needs_review(self):
        for key,value in (
            ("iconGuidChangedCount", 1), ("changedGuidCandidates", [{"x": 1}]),
            ("removedCount", 1), ("removedCandidates", [{"x": 1}])):
            d = fixture(); d[key] = value
            with self.assertRaisesRegex(ValueError, "CHANGED_OR_REMOVED"):
                queue.build_image_queue(d, {A})

    def test_forged_media_authority_rejected(self):
        for key,value in (
            ("deployAllowed", True), ("sourceIconPixelShaCompared", True),
            ("targetSwitchOriginalPngShaVerified", 1),
            ("imagePublicEligibleRows", 4)):
            d = fixture(); d[key] = value
            with self.assertRaisesRegex(ValueError, "SOURCE_REPORT_CLAIMS_MEDIA_AUTHORITY"):
                queue.build_image_queue(d, {A})

    def test_duplicate_unsafe_id_and_foreign_guid(self):
        for key,value in (
            ("itemId", "40000010"), ("itemId", "__proto__"),
            ("itemId", "040000010"), ("iconGuid", "not-a-guid"),
            ("category", "Entitlement"), ("name", "")):
            d = fixture(); d["addedCandidates"][1][key] = value
            with self.assertRaisesRegex(ValueError, "ITEM_ID_UNSAFE_OR_DUPLICATE|ITEM_NAME_OR_GUID_INVALID"):
                queue.build_image_queue(d, {A})

    def test_counts_and_version_false_rejected(self):
        for key,value in (
            ("sourceVersion", "v12413"), ("targetVersion", "v1253"),
            ("sourceCount", 4), ("targetCount", 100), ("retained", 2),
            ("iconGuidEqualCandidateCount", 1), ("addedCount", 2)):
            d = fixture(); d[key] = value
            with self.assertRaises(ValueError):
                queue.build_image_queue(d, {A})

    def test_unverified_old_guid_source_rejected(self):
        for old in (set(), {"fake"}, {A, "guid:"+"f"*30}):
            with self.assertRaisesRegex(ValueError, "OLD_GUID_SOURCE_UNVERIFIED"):
                queue.build_image_queue(fixture(), old)

    def test_expected_real_aggregates_fail_closed_on_unverified_claim(self):
        with self.assertRaisesRegex(ValueError, "TRUE_SOURCE_IMAGE_GUID_DELTA_COUNT_CHANGED"):
            queue.build_image_queue(fixture(), {A},
              expected={"newItemIds": 993, "newUniqueIconGuids": 647})

    def test_private_output_alias_and_existing_data_denied(self):
        with tempfile.TemporaryDirectory() as p:
            root = pathlib.Path(p).resolve()
            input_dir = root / "input"
            input_dir.mkdir()
            existing = root / "existing.json"
            existing.write_text("preserve me")
            with self.assertRaisesRegex(ValueError, "NO_CLOBBER_EXISTING_OUTPUT"):
                queue.secure_private_path(existing)
            self.assertEqual(existing.read_text(), "preserve me")
            symlink = root / "linked"
            symlink.symlink_to(input_dir, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "PRIVATE_DIRECTORY_SYMLINK_OR_ALIAS"):
                queue.secure_private_path(symlink / "new.json")
            with self.assertRaisesRegex(ValueError, "ABSOLUTE_CANONICAL_PRIVATE_PATH_REQUIRED"):
                queue.secure_private_path(pathlib.Path("relative.json"))

if __name__ == "__main__":
    unittest.main()
