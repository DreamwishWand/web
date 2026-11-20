#!/usr/bin/env python3
"""04 QR-W independent 07 DBK PR2393 offline PRIVATE queue-to-file L2.
All generated input ItemDB records are synthetic. Never Owner originals.
"""
from __future__ import annotations
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch
import importlib.util

SCRIPT=Path(__file__).resolve().parents[1]/"scripts"/"asset-research"/"07dbk-steam1261-image-batch-queue.py"
spec=importlib.util.spec_from_file_location("qrw_07dbk_private_queue",SCRIPT)
queue=importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)
OLD="guid:"+"a"*32
PRIVATE="QRW_ONLY_PRIVATE_SYNTHETIC_NEVER_STDOUT_"
ITEMS_OLD=12206
ITEMS_ADDED=993

def synth_record(native,cat,i,version):
    value=native.CATEGORIES[cat]+i
    name=(PRIVATE+cat+"_"+str(i)).encode()
    if cat!="ActivityItem" or i<=ITEMS_OLD:
        guid=OLD
    elif i<=ITEMS_OLD+681:
        guid="guid:"+format(min(i-ITEMS_OLD,647),"032x")
    else:
        guid=OLD
    gb=guid.encode("ascii")
    raw=(b"\x08"+native.varint(value)+b"\x12"+native.varint(len(name))+name+
         b"\x22"+native.varint(len(gb))+gb)
    return native.varint(i)+native.varint(len(raw))+raw

def build_fixture(native,root):
    pins={}
    protected={}
    for version in ("v1253","v1261"):
        dir=root/version
        dir.mkdir(parents=True)
        pins[version]={}
        for cat in native.CATEGORIES:
            count=(ITEMS_OLD+(ITEMS_ADDED if version=="v1261" else 0)) if cat=="ActivityItem" else 1
            b=b"".join(synth_record(native,cat,i,version) for i in range(1,count+1))
            file=dir/(cat+".json")
            file.write_bytes(b)
            pins[version][cat]=(hashlib.sha256(b).hexdigest(),len(b))
            protected[str(file)]=hashlib.sha256(b).hexdigest()
    return pins,protected

class QrwPrivateOutputL2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix="qrw2393-private-")
        home=Path(cls.tmp.name).resolve()
        cls.source=home/"private-originals"
        cls.outputdir=home/"private-evidence"
        cls.outputdir.mkdir()
        cls.module=queue.load_01d()
        pins,cls.original_sha=build_fixture(cls.module,cls.source)
        cls.module.SOURCE_PINS=pins

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_cli(self,dst=None,source=None):
        dest=dst or self.outputdir/"queue.json"
        source=source or self.source
        transcript=io.StringIO()
        with patch.object(queue,"load_01d",return_value=self.module), \
             patch.object(sys,"argv",["queue.py","--source-root",str(source),
                                      "--private-output",str(dest)]), \
             contextlib.redirect_stdout(transcript):
            queue.main()
        return transcript.getvalue(),dest

    def test_actual_eight_pinned_synthetic_originals_write_exact_mode0600_and_no_stdout_private_names(self):
        transcript,path=self.run_cli()
        summary=json.loads(transcript)
        self.assertEqual(summary["newItemIds"],993)
        self.assertEqual(summary["newUniqueIconGuids"],647)
        self.assertEqual(summary["newGuidReferencedItemIds"],681)
        self.assertEqual(summary["existingGuidReusedItemIds"],312)
        self.assertIs(summary["privateOutputWritten"],True)
        self.assertIs(summary["publishAllowed"],False)
        self.assertIs(summary["consumerOn"],False)
        self.assertIs(summary["realMediaBytesCompared"],False)
        self.assertNotIn(PRIVATE,transcript,"private Item name must not go to stdout")
        self.assertEqual(stat.S_IMODE(path.stat().st_mode),0o600)
        data=json.loads(path.read_text())
        self.assertEqual(data["privateSource"],"01D_PINNED_ORIGINAL_ITEMLIST_8_FILES")
        self.assertEqual(data["publicMedia"],"OFF")
        self.assertEqual(data["signedBatch"],"NOT_RUN")
        self.assertEqual(len(data["extractNewGuidGroups"]),647)
        self.assertEqual(data["summary"]["reusedUniqueIconGuids"],1)
        self.assertTrue(PRIVATE in data["extractNewGuidGroups"][0]["items"][0]["name"],
                        "private names available only in the private output file")
        self.assertTrue(all(g["publishAllowed"] is False and
            g["actualTexturePixelsVerified"] is False and
            g["visibilityVerified"] is False for g in
            data["extractNewGuidGroups"]+data["recheckOldGuidGroups"]))
        self.assertTrue(data["consumerOn"] is False and
                        data["sourceOnlyNotAnImageReview"] is True)
        self.assertEqual(self.original_sha,
            {p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in self.original_sha},
            "no owner original changed")

    def test_second_run_cannot_clobber_even_with_pinned_valid_originals(self):
        dst=self.outputdir/"queue.json"
        before=dst.read_bytes()
        with self.assertRaisesRegex(ValueError,"NO_CLOBBER_EXISTING_OUTPUT"):
            self.run_cli()
        self.assertEqual(dst.read_bytes(),before)

    def test_private_report_symlink_and_source_root_alias_rejected_before_read(self):
        outside=self.outputdir/"harmless.txt"
        outside.write_bytes(b"KEEP_PRIVATE_REPORT_TARGET")
        link=self.outputdir/"symlink.json"
        link.symlink_to(outside)
        try:
            with self.assertRaisesRegex(ValueError,"NO_CLOBBER_EXISTING_OUTPUT"):
                self.run_cli(dst=link)
            self.assertEqual(outside.read_bytes(),b"KEEP_PRIVATE_REPORT_TARGET")
        finally:
            link.unlink()
        alias=self.source.parent/"source-alias"
        alias.symlink_to(self.source,target_is_directory=True)
        try:
            with self.assertRaisesRegex(ValueError,"PRIVATE_DIRECTORY_SYMLINK_OR_ALIAS"):
                self.run_cli(dst=self.outputdir/"unused1.json",source=alias)
            self.assertFalse((self.outputdir/"unused1.json").exists())
        finally:
            alias.unlink()

    def test_same_tree_output_and_invalid_relative_path_cannot_write_partial_private_data(self):
        bad=self.source/"report.json"
        with self.assertRaisesRegex(ValueError,"OUTPUT_MUST_BE_SEPARATE_FROM_SOURCE"):
            self.run_cli(dst=bad)
        self.assertFalse(bad.exists())
        relative=Path("bad-relative.json")
        with self.assertRaisesRegex(ValueError,"ABSOLUTE_CANONICAL_PRIVATE_PATH_REQUIRED"):
            self.run_cli(dst=relative)
        self.assertFalse(relative.exists())

    def test_missing_or_altered_one_original_blocks_output_and_retains_all_original_bytes(self):
        target=self.source/"v1261"/"Trimming.json"
        before=target.read_bytes()
        output=self.outputdir/"partial.json"
        try:
            target.write_bytes(before+b"\x01")
            with self.assertRaisesRegex(ValueError,"SOURCE_FILE_SHA_OR_BYTES_MISMATCH"):
                self.run_cli(dst=output)
            self.assertFalse(output.exists())
            target.unlink()
            with self.assertRaisesRegex(ValueError,"SOURCE_FILE_MISSING_OR_ALIAS"):
                self.run_cli(dst=output)
            self.assertFalse(output.exists())
        finally:
            target.write_bytes(before)
        self.assertEqual(self.original_sha,
            {p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in self.original_sha})

    def test_forged_summary_or_rights_risk_never_becomes_partially_published_queue(self):
        tiny={"sourceVersion":"v1253","targetVersion":"v1261",
          "sourceCount":1,"targetCount":2,"retained":1,
          "iconGuidEqualCandidateCount":1,"iconGuidChangedCount":0,
          "removedCount":0,"changedGuidCandidates":[],"removedCandidates":[],
          "sourceIconPixelShaCompared":False,"targetSwitchOriginalPngShaVerified":0,
          "imagePublicEligibleRows":0,"deployAllowed":False,"addedCount":1,
          "addedCandidates":[{"itemId":"40000001","category":"Furniture",
            "name":PRIVATE+"forged","iconGuid":"guid:"+"b"*32}]}
        for key,val in [
            ("deployAllowed",True),("sourceIconPixelShaCompared",True),
            ("imagePublicEligibleRows",1),("targetSwitchOriginalPngShaVerified",1)]:
            modified=dict(tiny);modified[key]=val
            with self.assertRaisesRegex(ValueError,"SOURCE_REPORT_CLAIMS_MEDIA_AUTHORITY"):
                queue.build_image_queue(modified,{OLD})
        with self.assertRaisesRegex(ValueError,"TRUE_SOURCE_IMAGE_GUID_DELTA_COUNT_CHANGED"):
            queue.build_image_queue(tiny,{OLD},expected={"newItemIds":993})
        result=queue.build_image_queue(tiny,{OLD})
        self.assertEqual(result["publicMedia"],"OFF")
        self.assertIs(result["consumerOn"],False)
        self.assertEqual(result["summary"]["nativeOriginalMediaDecoded"],0)

if __name__=="__main__":
    unittest.main(verbosity=2)
