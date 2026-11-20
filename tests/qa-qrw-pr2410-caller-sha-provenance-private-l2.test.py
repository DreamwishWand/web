#!/usr/bin/env python3
"""04 QR-W independent 01D PR2410 fake caller-SHA provenance L2.
All 305 rows and "Save" bytes are constructed by this test. NO Owner originals.
"""
from __future__ import annotations
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[1]/"scripts"/"asset-research"/"01d-collection1261-private-structure-read.py"
spec=importlib.util.spec_from_file_location("qrw2410_non_attesting_collection",SCRIPT)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
PRIVATE_MARKER="QRW_SPOOFED_ORIGINAL_SECRET_NEVER_SHIP_"
def synthetic_definitions():
    pieces=[]
    for i in range(1,306):
        wire=b"\x08"+mod.encode_varint(2120000000+i)+b"\x12\x01x"
        pieces.append(mod.encode_varint(i)+mod.encode_varint(len(wire))+wire)
    return b"".join(pieces)
def synthetic_save():
    return json.dumps({"GameInfo":{"Version":643},"Player":{
        "PrivateOnly":PRIVATE_MARKER,"CollectionSets":[
          {"CollectionDefinitionID":2120000000+i,
            "GroupData":[{"GroupIndex":0,"GroupsCollectionItems":{
              "40000001":(i%2)==0,"40000002":False
            },"SecretExtra":PRIVATE_MARKER+str(i)}]}
          for i in range(1,306)
        ]}}).encode()
class CallerDigestCannotAttest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.definitions=synthetic_definitions()
        cls.rawsave=synthetic_save()
    def setUp(self):
        self.pins=patch.multiple(mod,COLLECTION_SHA=hashlib.sha256(self.definitions).hexdigest(),
                           COLLECTION_BYTES=len(self.definitions))
        self.pins.start();self.addCleanup(self.pins.stop)
    def test_fake_caller_supplied_matching_digest_must_not_claim_owner_provenance(self):
        h=hashlib.sha256(self.rawsave).hexdigest()
        receipt=mod.make_report(self.definitions,self.definitions,self.rawsave,h)
        self.assertTrue(receipt["profileExamined"])
        self.assertEqual(receipt["observedSavedDefinitions"],305)
        self.assertEqual(receipt["observedGroupRecords"],305)
        self.assertEqual(receipt["observedSavedBooleanFlags"],610)
        self.assertTrue(receipt["privateSaveShaVerified"])
        self.assertEqual(receipt["privateSaveDigestSource"],"CALLER_SUPPLIED")
        for flag in ["privateSaveOriginalProvenanceAttested","savedVsStaticItemMembershipVerified",
                     "nativeDynamicGroupVerified","ownedEntitlementVerified","writerAuthorized",
                     "saveEdited","publishAllowed","operationOn"]:
            self.assertIs(receipt[flag],False,flag)
        for absent in ["privateSaveSha256","privateBytes","personalItemNames","itemIds","rightsHolderLicense"]:
            self.assertNotIn(absent,receipt)
        report=json.dumps(receipt)
        self.assertNotIn(PRIVATE_MARKER,report)
        self.assertNotIn(h,report)
        self.assertEqual(receipt["displayedCollectedMeaning"],"UNKNOWN")
        self.assertEqual(receipt["buildNativeABICompatible"],"UNKNOWN")
    def test_forged_expectation_fails_before_profile_mints_any_output(self):
        with self.assertRaisesRegex(mod.SourceDenied,"PRIVATE_SAVE_SHA_MISMATCH"):
            mod.make_report(self.definitions,self.definitions,self.rawsave,"a"*64)
        with self.assertRaisesRegex(mod.SourceDenied,"PRIVATE_SAVE_SHA_INVALID"):
            mod.make_report(self.definitions,self.definitions,self.rawsave,"abc")
        with self.assertRaisesRegex(mod.SourceDenied,"PROFILE_REQUIRED_FOR_PRIVATE_SHA"):
            mod.make_report(self.definitions,self.definitions,None,"a"*64)
    def test_full_fake_private_cli_is_no_leak_mode0600_exclusive_and_no_game_authority(self):
        with tempfile.TemporaryDirectory(prefix="qrw2410-fake-only-") as d:
            root=Path(d).resolve()
            ss=root/"synthetic-steam";ss.mkdir()
            ns=root/"synthetic-switch";ns.mkdir()
            ps=root/"synthetic-private";ps.mkdir()
            outdir=root/"private-reports";outdir.mkdir()
            steam=ss/"CollectionSet.bin";switch=ns/"CollectionSet.bin"
            prof=ps/"fake-save.json";report=outdir/"private.json"
            steam.write_bytes(self.definitions);switch.write_bytes(self.definitions)
            prof.write_bytes(self.rawsave)
            saved=(hashlib.sha256(steam.read_bytes()).hexdigest(),
                   hashlib.sha256(switch.read_bytes()).hexdigest(),
                   hashlib.sha256(prof.read_bytes()).hexdigest())
            args=["fixture","--steam-collection",str(steam),
                  "--switch-collection",str(switch),
                  "--private-profile",str(prof),
                  "--expected-private-profile-sha256",saved[2],
                  "--private-report",str(report)]
            stdout=io.StringIO()
            with patch.object(sys,"argv",args),redirect_stdout(stdout):
                mod.main()
            public=json.loads(stdout.getvalue())
            private=json.loads(report.read_text())
            self.assertEqual(stat.S_IMODE(report.stat().st_mode),0o600)
            self.assertEqual(public["observedSavedBooleanFlags"],610)
            self.assertFalse(public["writerAuthorized"])
            self.assertFalse(public["publishAllowed"])
            self.assertNotIn(PRIVATE_MARKER,stdout.getvalue())
            self.assertNotIn(saved[2],stdout.getvalue())
            self.assertFalse(private["privateSaveOriginalProvenanceAttested"])
            self.assertFalse(private["operationOn"])
            self.assertNotIn(PRIVATE_MARKER,report.read_text())
            self.assertNotIn(saved[2],report.read_text())
            before=report.read_bytes()
            with patch.object(sys,"argv",args),self.assertRaisesRegex(mod.SourceDenied,"OUTPUT_EXISTS_NO_CLOBBER"):
                mod.main()
            self.assertEqual(report.read_bytes(),before)
            self.assertEqual(saved,(hashlib.sha256(steam.read_bytes()).hexdigest(),
                                    hashlib.sha256(switch.read_bytes()).hexdigest(),
                                    hashlib.sha256(prof.read_bytes()).hexdigest()))
    def test_private_origin_or_report_cannot_be_symlink_or_public_git_tree(self):
        with tempfile.TemporaryDirectory(prefix="qrw2410-fake-only-") as d:
            root=Path(d).resolve();origin=root/"source";origin.mkdir()
            raw=origin/"CollectionSet.bin";raw.write_bytes(self.definitions)
            public=root/"public";public.mkdir();(public/".git").mkdir()
            bad=public/"original.bin";bad.write_bytes(self.definitions)
            with self.assertRaisesRegex(mod.SourceDenied,"PRIVATE_ORIGINAL_GIT_DIRECTORY"):
                mod.read_regular_original(bad,mod.MAX_COLLECTION)
            with self.assertRaisesRegex(mod.SourceDenied,"PRIVATE_OUTPUT_GIT_DIRECTORY"):
                mod._output_path(public/"not-created.json",[raw])
            link=root/"alias";link.symlink_to(origin,target_is_directory=True)
            with self.assertRaisesRegex(mod.SourceDenied,"SOURCE_SYMLINK"):
                mod.read_regular_original(link/"CollectionSet.bin",mod.MAX_COLLECTION)
            self.assertFalse((public/"not-created.json").exists())
            self.assertEqual(raw.read_bytes(),self.definitions)
if __name__=="__main__":
    unittest.main(verbosity=2)
