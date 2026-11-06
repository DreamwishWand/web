import hashlib
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / 'scripts/asset-research/01d-steam-furniture-stream-delta.py'
spec = importlib.util.spec_from_file_location('furniture_delta', SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture(root, v1250=b'first', v1253=b'second'):
    sizes = {}
    for version, content in [('v1250', v1250), ('v1253', v1253)]:
        (root / version).mkdir()
        (root / version / mod.BUNDLE).write_bytes(content)
        sizes[version] = len(content)
    return sizes


class FurnitureStreamDelta(unittest.TestCase):
    def test_synthetic_unequal_sizes_byte_delta_is_not_texture_count(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root, b'12345678', b'123456789')
            out = mod.analyze(root, sizes, synthetic=True)
            self.assertFalse(out['byteIdentical'])
            self.assertEqual(out['tier'], 'SYNTHETIC_ONLY')
            self.assertTrue(out['differingChunkCountIsNotChangedTextureCount'])
            self.assertFalse(out['texture2dDiffVerified'])
            self.assertFalse(out['publishAllowed'])
            self.assertFalse(out['nativeSaveWriterAllowed'])
            self.assertEqual(out['switchSameBuildOriginalPngShaVerified'], 0)

    def test_synthetic_equal_input_byte_identity_still_no_release(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root, b'12345678', b'12345678')
            out = mod.analyze(root, sizes, synthetic=True)
            self.assertTrue(out['byteIdentical'])
            self.assertEqual(out['differingAlignedChunks'], 0)
            self.assertFalse(out['itemIdToTextureAddressVerified'])
            self.assertFalse(out['steamGlobalMigrationAllowed'])

    def test_same_size_changed_content_must_be_different(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root, b'abc', b'abd')
            out = mod.analyze(root, sizes, synthetic=True)
            self.assertFalse(out['byteIdentical'])
            self.assertEqual(out['differingAlignedChunks'], 1)

    def test_self_signed_original_source_override_is_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root)
            with self.assertRaisesRegex(ValueError, 'ORIGINAL_SIZE_OVERRIDE_FORBIDDEN'):
                mod.analyze(root, sizes)
            self.assertEqual(mod.analyze(root, sizes, synthetic=True)['tier'], 'SYNTHETIC_ONLY')
            with self.assertRaises(TypeError):
                mod.SOURCE_SIZES['v1250'] = 1

    def test_wrong_size_and_missing_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root)
            with self.assertRaisesRegex(ValueError, 'ORIGINAL_SIZE_MISMATCH'):
                mod.analyze(root, {**sizes, 'v1250': 100}, synthetic=True)
            (root / 'v1253' / mod.BUNDLE).unlink()
            with self.assertRaisesRegex(ValueError, 'MISSING_OR_SYMLINK_ORIGINAL'):
                mod.analyze(root, sizes, synthetic=True)

    def test_symlink_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            sizes = fixture(root)
            f = root / 'v1253' / mod.BUNDLE
            f.unlink()
            f.symlink_to(root / 'v1250' / mod.BUNDLE)
            with self.assertRaisesRegex(ValueError, 'ORIGINAL_SOURCE_PATH_INVALID'):
                mod.analyze(root, sizes, synthetic=True)

    def test_report_no_clobber_existing_source_or_unrelated_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            fixture(root)
            original = root / 'v1250' / mod.BUNDLE
            before = hashlib.sha256(original.read_bytes()).hexdigest()
            for report in [original, root / 'new.json']:
                done = subprocess.run([sys.executable, str(SOURCE), '--root', str(root), '--report', str(report)], capture_output=True, text=True)
                self.assertNotEqual(done.returncode, 0)
                self.assertIn('OUTPUT_MUST_BE_NEW_OUTSIDE_ORIGINALS', done.stderr)
            self.assertEqual(before, hashlib.sha256(original.read_bytes()).hexdigest())
            with tempfile.TemporaryDirectory() as other:
                preexisting = pathlib.Path(other) / 'existing.json'
                preexisting.write_text('keep')
                done = subprocess.run([sys.executable, str(SOURCE), '--root', str(root), '--report', str(preexisting)], capture_output=True, text=True)
                self.assertNotEqual(done.returncode, 0)
                self.assertEqual(preexisting.read_text(), 'keep')

    def test_unknown_version_set_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            fixture(root)
            with self.assertRaisesRegex(ValueError, 'INVALID_VERSION_SET'):
                mod.analyze(root, {'v1250': 5}, synthetic=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
