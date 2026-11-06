#!/usr/bin/env python3
"""05 QR-C synthetic ZIP/CRC/path/identity guards; never include a real Steam save."""
import importlib.util
import stat
import tempfile
from pathlib import Path
import unittest
import zipfile

SRC = Path(__file__).resolve().parents[1] / "scripts" / "qa" / "offline_steam_v0.py"
spec = importlib.util.spec_from_file_location("offline_steam_v0", SRC)
auditlib = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditlib)


class SteamV0SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "local-only.zip"

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, names):
        with zipfile.ZipFile(self.path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for name, data in names:
                z.writestr(name, data)
        return auditlib.audit(self.path)

    def test_valid_container_is_not_v1(self):
        result = self.archive([("profile.dat", b"synthetic-profile"), ("settings.json", b"{}")])
        self.assertEqual(result["v0"], "ZIP_CONTAINER_VERIFIED_ONLY")
        self.assertEqual(result["entry_count"], 2)
        self.assertEqual(result["largest_member_size_bytes"], len(b"synthetic-profile"))
        self.assertEqual(result["v1_save_structure"], "NOT_RUN")
        self.assertEqual(result["v2_edited_copy_reopen"], "NOT_RUN")
        self.assertEqual(result["game_version"], "UNKNOWN")
        self.assertEqual(result["product_writer"], "OFF")
        self.assertNotIn("profile.dat", str(result))

    def test_traversal_rejected(self):
        result = self.archive([("../escape", b"x")])
        self.assertIn("UNSAFE_ENTRY_PATH", result["errors"])
        self.assertEqual(result["v0"], "REJECTED")

    def test_windows_absolute_rejected(self):
        result = self.archive([("C:\\Users\\test", b"x")])
        self.assertIn("UNSAFE_ENTRY_PATH", result["errors"])

    def test_duplicate_casefolded_rejected(self):
        result = self.archive([("a", b"x"), ("A", b"y")])
        self.assertIn("DUPLICATE_MEMBER_NAME", result["errors"])

    def test_symlink_member_rejected(self):
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(self.path, "w") as z:
            z.writestr(link, "secret")
        result = auditlib.audit(self.path)
        self.assertIn("SYMLINK_MEMBER_UNSUPPORTED", result["errors"])

    def test_compression_ratio_rejected(self):
        result = self.archive([("compressed", b"0" * 100_000)])
        self.assertIn("COMPRESSION_RATIO_LIMIT", result["errors"])

    def test_invalid_zip_rejected_without_leak(self):
        self.path.write_bytes(b"private-secrets-are-not-an-archive")
        result = auditlib.audit(self.path)
        self.assertEqual(result["errors"], ["INVALID_ARCHIVE_OR_CRC"])
        self.assertNotIn("secrets", str(result))

    def test_missing_source_rejected(self):
        result = auditlib.audit(self.path)
        self.assertIn("SOURCE_NOT_REGULAR_FILE", result["errors"])


if __name__ == "__main__":
    unittest.main()
