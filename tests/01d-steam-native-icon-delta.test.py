#!/usr/bin/env python3
"""07 synthetic-only safety/negative tests; no proprietary game binaries."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1]/"scripts"/"asset-research"/"01d-steam-native-icon-delta.py"
spec=importlib.util.spec_from_file_location("steam_icon_delta",SOURCE)
delta=importlib.util.module_from_spec(spec)
spec.loader.exec_module(delta)
GUID_A="guid:"+"a"*32
GUID_B="guid:"+"b"*32

def field(n,data):
    return delta.varint(n*8+2)+delta.varint(len(data))+data

def record(cat,item,guid=GUID_A,name="SyntheticOne",duplicate_guid=False):
    raw=delta.varint(8)+delta.varint(item)+field(2,name.encode())+field(4,guid.encode())
    if duplicate_guid:raw+=field(4,guid.encode())
    return delta.varint(item-delta.CATEGORIES[cat])+delta.varint(len(raw))+raw

def fixtures(root):
    for version in delta.GAME_VERSIONS:
        d=root/version
        d.mkdir(parents=True)
        for category,base in delta.CATEGORIES.items():
            content=record(category,base+1)
            if category=="ActivityItem":
                content+=record(category,base+2,GUID_A if version=="v12413" else GUID_B)
                if version!="v12413":content+=record(category,base+3)
            (d/(category+".json")).write_bytes(content)

class IconGuidDeltaSafety(unittest.TestCase):
    def test_source_only_synthetic_never_public(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            fixtures(root)
            result=delta.analyze(root,synthetic=True)
            self.assertEqual(result["evidence"],"SYNTHETIC_FIXTURE_ONLY")
            for attr in ("publishAllowed","nativeSaveWriterAllowed","itemVisibilityVerified","originalImageBytesCompared"):
                self.assertFalse(result[attr])
            self.assertEqual(result["targetSwitchOriginalPngShaVerified"],0)
            self.assertEqual(result["v12413_to_v1250"]["iconGuidChangedCount"],1)
            self.assertEqual(result["v12413_to_v1250"]["addedCount"],1)
            self.assertEqual(result["v1250_to_v1253"]["iconGuidChangedCount"],0)
            self.assertEqual(result["v1250_to_v1253"]["addedCount"],0)

    def test_original_mode_rejects_fake_raw_protobuf(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            fixtures(root)
            with self.assertRaisesRegex(ValueError,"PINNED_NATIVE_SOURCE_SHA_OR_BYTES_MISMATCH"):
                delta.analyze(root,synthetic=False)

    def test_duplicate_frame_prefix_truncated_payload_and_wrong_item_id(self):
        cat="ActivityItem"
        base=delta.CATEGORIES[cat]
        raw=record(cat,base+1)
        self.assertEqual(len(delta.read_category(raw,cat)),1)
        with self.assertRaisesRegex(ValueError,"DUPLICATE_FRAME_KEY"):
            delta.read_category(raw+raw,cat)
        with self.assertRaisesRegex(ValueError,"INVALID_RECORD_LENGTH"):
            delta.read_category(raw[:-1],cat)
        misplaced=delta.varint(12)+raw[len(delta.varint(1)):]
        with self.assertRaisesRegex(ValueError,"ITEM_ID_FRAME_MISMATCH"):
            delta.read_category(misplaced,cat)

    def test_wrong_guid_empty_name_duplicate_field(self):
        cat="ActivityItem";base=delta.CATEGORIES[cat]
        for raw,expected in (
            (record(cat,base+1,guid="guid:FORGED"),"INVALID_NAME_OR_ICON_GUID"),
            (record(cat,base+1,name=""),"INVALID_NAME_OR_ICON_GUID"),
            (record(cat,base+1,duplicate_guid=True),"DUPLICATE_REQUIRED_FIELD")
        ):
            with self.subTest(expected=expected),self.assertRaisesRegex(ValueError,expected):
                delta.read_category(raw,cat)

    def test_truncated_overflow_noncanonical_varint(self):
        for data,expected in (
            (b"\x80","TRUNCATED_VARINT"),
            (b"\x80\x00","NON_CANONICAL_VARINT"),
            (b"\xff"*10,"OVERFLOW_VARINT")
        ):
            with self.subTest(expected=expected),self.assertRaisesRegex(ValueError,expected):
                delta.read_varint(data,0)

    def test_native_original_symlink_or_missing_file_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            fixtures(root)
            original=root/"v1250"/"ActivityItem.json"
            original.unlink()
            with self.assertRaisesRegex(ValueError,"MISSING_OR_SYMLINK_NATIVE_SOURCE"):
                delta.analyze(root,synthetic=True)
            original.symlink_to(root/"v12413"/"ActivityItem.json")
            with self.assertRaisesRegex(ValueError,"MISSING_OR_SYMLINK_NATIVE_SOURCE"):
                delta.analyze(root,synthetic=True)

    def test_exclusive_report_preserves_every_original_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=pathlib.Path(tmp)
            root=home/"inputs"
            fixtures(root)
            original=root/"v12413"/"ActivityItem.json"
            before=hashlib.sha256(original.read_bytes()).hexdigest()
            def run(output):
                return subprocess.run([sys.executable,str(SOURCE),"--synthetic-fixture","--source-root",str(root),"--report",str(output)],capture_output=True,text=True)
            for output in [original,root/"forbidden-report.json"]:
                result=run(output)
                self.assertNotEqual(result.returncode,0)
                self.assertIn("REPORT_MUST_BE_NEW_OUTSIDE_SOURCE_ROOT",result.stderr)
                self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(),before)
            allowed=home/"report.json"
            result=run(allowed)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(allowed.read_text())["releaseEligibility"],"NO_VERSION_VERIFIED_IMAGE_ROWS")
            self.assertNotEqual(run(allowed).returncode,0)
            unrelated=home/"unrelated.json"
            unrelated.write_bytes(b"keep unrelated bytes")
            link=home/"link.json"
            link.symlink_to(unrelated)
            self.assertNotEqual(run(link).returncode,0)
            self.assertEqual(unrelated.read_bytes(),b"keep unrelated bytes")
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(),before)

if __name__=="__main__":
    unittest.main(verbosity=2)
