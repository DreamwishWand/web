"""04 QR-W source-only independent PR668: original-file provenance & root-link negatives.
QA-only: never read or copy actual proprietary game bundles, Steam Save or credentials.
"""
from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = pathlib.Path(__file__).resolve().parents[1]
MODULE_FILE = REPO / "scripts/asset-research/01d-steam-furniture-stream-delta.py"
spec = importlib.util.spec_from_file_location("furniture_delta_independent", MODULE_FILE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

MAIN = "d953f2e064b41ade8fa630bb5b50c37d8417a79c"
SOURCE = "46447ad05f86eecd83d449ab66aefcbda200c13c"
SOURCE_BLOBS = {
  "docs/core/01d-steam-v1253-furniture-byte-delta-20261106.md": "2e76708cd9b8b2c5fdd10549ab64b0b28cf28310",
  "scripts/asset-research/01d-steam-furniture-stream-delta.py": "2c7af735cfd1d7cb9bf48024825c6e22edf8f2a1",
  "tests/01d-steam-furniture-stream-delta.test.mjs": "b2907819057aafdd0a8929d0156f2935b5bc6d3e",
  "tests/01d-steam-furniture-stream-delta.test.py": "51819fb81898c866e6245e63d7642ef57f5bf20d",
}
QA_FILES = [
  ".github/workflows/04qr-w-pr668-furniture-path-negative.yml",
  "tests/04qr-w-pr668-furniture-path-negative.test.py",
]

def git(*args):
    return subprocess.check_output(["git", "-C", str(REPO), *args], text=True).strip()

def fixture(root, a=b"unchanged-a", b=b"unchanged-b"):
    sizes = {}
    for version, data in (("v1250", a), ("v1253", b)):
        folder = root / version
        folder.mkdir()
        (folder / m.BUNDLE).write_bytes(data)
        sizes[version] = len(data)
    return sizes

class Pr668Independent(unittest.TestCase):
    def test_01_exact_source4_git_blobs_qa_only2(self):
        self.assertEqual(git("rev-parse", SOURCE), SOURCE)
        self.assertEqual(
          sorted(git("diff", "--name-only", MAIN, SOURCE).splitlines()),
          sorted(SOURCE_BLOBS),
        )
        for path, blob in SOURCE_BLOBS.items():
            self.assertEqual(git("hash-object", path), blob, path)
        self.assertEqual(
          sorted(git("diff", "--name-only", SOURCE, "HEAD").splitlines()),
          sorted(QA_FILES),
        )

    def test_02_same_size_changed_bytes_are_not_equal_and_not_media_proof(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            sizes = fixture(root, b"abcd", b"abce")
            result = m.analyze(root, sizes, synthetic=True)
            self.assertFalse(result["byteIdentical"])
            self.assertEqual(result["differingAlignedChunks"], 1)
            self.assertEqual(result["tier"], "SYNTHETIC_ONLY")
            self.assertEqual(result["sha256"]["v1250"], hashlib.sha256(b"abcd").hexdigest())
            self.assertEqual(result["sha256"]["v1253"], hashlib.sha256(b"abce").hexdigest())
            self.assertFalse(result["texture2dDiffVerified"])
            self.assertFalse(result["itemIdToTextureAddressVerified"])
            self.assertFalse(result["publishAllowed"])
            self.assertFalse(result["steamGlobalMigrationAllowed"])
            self.assertFalse(result["nativeSaveWriterAllowed"])

    def test_03_even_identical_synthetic_bundle_not_source_authenticity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            sizes = fixture(root, b"same-bytes", b"same-bytes")
            result = m.analyze(root, sizes, synthetic=True)
            self.assertTrue(result["byteIdentical"])
            self.assertEqual(result["tier"], "SYNTHETIC_ONLY")
            self.assertTrue(result["hashesAreNewLocalObservationsNotIndependentProvenance"])
            self.assertTrue(result["sizePinnedNotShaPinned"])
            self.assertEqual(result["switchSameBuildOriginalPngShaVerified"], 0)
            self.assertFalse(result["publishAllowed"])

    def test_04_callers_cannot_override_sizes_to_forge_original_tier(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            sizes = fixture(root, b"fake", b"fake")
            with self.assertRaisesRegex(ValueError, "ORIGINAL_SIZE_OVERRIDE_FORBIDDEN"):
                m.analyze(root, sizes)
            self.assertEqual(m.analyze(root, sizes, synthetic=True)["tier"], "SYNTHETIC_ONLY")

    def test_05_direct_api_rejects_root_symlink_and_file_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            base = pathlib.Path(temp)
            root = base / "originals"
            root.mkdir()
            sizes = fixture(root, b"AAAA", b"BBBB")
            alias = base / "root-alias"
            alias.symlink_to(root, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "ORIGINAL_ROOT_INVALID"):
                m.analyze(alias, sizes, synthetic=True)
            f = root / "v1253" / m.BUNDLE
            f.unlink()
            f.symlink_to(root / "v1250" / m.BUNDLE)
            with self.assertRaisesRegex(ValueError, "ORIGINAL_SOURCE_PATH_INVALID"):
                m.analyze(root, sizes, synthetic=True)

    def test_06_cli_rejects_symlink_root_before_resolve_or_read(self):
        """This is the new changed-risk negative: argparse root.resolve must not erase the symlink."""
        with tempfile.TemporaryDirectory() as temp:
            base = pathlib.Path(temp)
            root = base / "synthetic-originals"
            root.mkdir()
            fixture(root, b"one", b"two")
            alias = base / "symlink-root"
            alias.symlink_to(root, target_is_directory=True)
            report = base / "new-report.json"
            fake = {
              "tier": "LOCAL_SOURCE_BYTES_UNATTESTED",
              "byteIdentical": False,
              "differingAlignedChunks": 1,
              "publishAllowed": False,
            }
            # Avoid full 249 MiB real-file reads: the CLI boundary must reject before analyze().
            with patch.object(sys, "argv", ["qa", "--root", str(alias), "--report", str(report)]):
                with patch.object(m, "analyze", return_value=fake) as spy:
                    with contextlib.redirect_stdout(io.StringIO()):
                        with self.assertRaisesRegex(ValueError, "ORIGINAL_ROOT_INVALID"):
                            m.main()
                    spy.assert_not_called()
            self.assertFalse(report.exists())

    def test_07_cli_refuses_report_inside_originals_without_clobber(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp) / "synthetic"
            root.mkdir()
            fixture(root, b"first", b"second")
            existing = root / "v1250" / m.BUNDLE
            before = existing.read_bytes()
            with patch.object(sys, "argv", ["qa", "--root", str(root), "--report", str(existing)]):
                with patch.object(m, "analyze", side_effect=AssertionError("must not read source")):
                    with self.assertRaisesRegex(ValueError, "OUTPUT_MUST_BE_NEW_OUTSIDE_ORIGINALS"):
                        m.main()
            self.assertEqual(existing.read_bytes(), before)

if __name__ == "__main__":
    unittest.main(verbosity=2)
