#!/usr/bin/env python3
"""04 QR-W independent 01D PR2383 v1.26.1 media-source trust boundary L2.
Synthetic tiny framed item sources only; never actual Owner raw/texture/Save.
"""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

SRC=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"asset-research"/"01d-steam-native-icon-delta.py"
spec=importlib.util.spec_from_file_location("qrw_steam_native_delta",SRC)
delta=importlib.util.module_from_spec(spec)
spec.loader.exec_module(delta)
GUID_A="guid:"+"a"*32
GUID_B="guid:"+"b"*32
DUMMY=b"private-item-bytes-not-for-upload"

def field(n,value):
    return delta.varint(n*8+2)+delta.varint(len(value))+value

def record(category,key,guid=GUID_A,name="SyntheticFixture"):
    item=delta.CATEGORIES[category]+key
    entry=delta.varint(8)+delta.varint(item)+field(2,name.encode())+field(4,guid.encode())
    return delta.varint(key)+delta.varint(len(entry))+entry

def make_version(root,version):
    target=root/version
    target.mkdir(parents=True,exist_ok=True)
    for category in delta.CATEGORIES:
        raw=record(category,1)
        if category=="ActivityItem":
            raw+=record(category,2,GUID_B if version=="v1261" else GUID_A)
            if version=="v1261":raw+=record(category,3,GUID_B)
        (target/(category+".json")).write_bytes(raw)

def command(root,report,*flags,synthetic=True):
    args=[sys.executable,str(SRC),"--source-root",str(root),"--report",str(report)]
    if synthetic:args.append("--synthetic-fixture")
    args.extend(flags)
    return subprocess.run(args,encoding="utf-8",capture_output=True,timeout=20)

def read(out):
    return json.loads(out.read_text("utf-8"))

class SteamNative1261ProvenanceL2(unittest.TestCase):
    def test_one_version_snapshot_is_explicit_readonly_and_does_not_mint_ownership(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"owner";make_version(root,"v1261")
            out=home/"snapshot.json"
            run=command(root,out,"--only-v1261")
            self.assertEqual(run.returncode,0,run.stderr)
            report=read(out)
            self.assertEqual(report["schema"],"wand.01d.steam1261-native-items-source-only@1")
            self.assertEqual(report["evidence"],"SYNTHETIC_FIXTURE_ONLY")
            self.assertEqual(set(report["source"]),{"v1261"})
            self.assertEqual(report["sourceItemCount"],6)
            self.assertEqual(report["source"]["v1261"]["fullVersion"],delta.GAME_VERSIONS["v1261"])
            self.assertEqual(report["source"]["v1261"]["categoryCounts"]["ActivityItem"],3)
            self.assertNotIn("v1253_to_v1261",report)
            self.assertIs(report["comparisonAvailable"],False)
            for key in ["publishAllowed","nativeSaveWriterAllowed","itemVisibilityVerified",
                        "rightsVerified","originalImageBytesCompared"]:
                self.assertIs(report[key],False,key)
            self.assertEqual(report["switch1261BID"],"UNKNOWN_NOT_READ_FROM_STEAM")
            self.assertEqual(report["targetSwitchOriginalPngShaVerified"],0)
            self.assertNotIn("owner",run.stdout.lower())
            self.assertNotIn("published",run.stdout.lower())
            self.assertEqual(json.loads(run.stdout)["publishAllowed"],False)
            self.assertEqual(report["sourcePlatform"],"Steam/Windows")

    def test_legacy_default_never_opens_unrequested_v1261_even_if_corrupt(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"inputs"
            for v in ["v12413","v1250","v1253"]:make_version(root,v)
            first=home/"before.json";self.assertEqual(command(root,first).returncode,0)
            result0=first.read_bytes()
            make_version(root,"v1261")
            (root/"v1261"/"ActivityItem.json").write_bytes(b"\xff\x80")
            second=home/"after.json";r=command(root,second)
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertEqual(second.read_bytes(),result0,"legacy result changes if opt-in source exists")
            self.assertNotIn("v1261",read(second)["source"])
            self.assertNotIn("v1253_to_v1261",read(second))
            self.assertNotIn("v1261",json.loads(r.stdout))
            self.assertEqual(json.loads(r.stdout)["publishAllowed"],False)

    def test_requested_delta_requires_all_old_and_new_sources_and_cannot_infer_cross_platform(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"owner"
            make_version(root,"v1261")
            missing=home/"missing.json"
            r=command(root,missing,"--include-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertIn("MISSING_OR_SYMLINK_NATIVE_SOURCE",r.stderr)
            self.assertFalse(missing.exists(),"must not issue partial evidence")
            for v in ["v12413","v1250","v1253"]:make_version(root,v)
            accepted=home/"delta.json";r=command(root,accepted,"--include-v1261")
            self.assertEqual(r.returncode,0,r.stderr)
            output=read(accepted)
            self.assertEqual(output["v1253_to_v1261"]["sourceCount"],5)
            self.assertEqual(output["v1253_to_v1261"]["targetCount"],6)
            self.assertEqual(output["v1253_to_v1261"]["iconGuidChangedCount"],1)
            self.assertEqual(output["v1253_to_v1261"]["addedCount"],1)
            self.assertEqual(output["v1253_to_v1261"]["nameChangedCount"],0)
            self.assertEqual(output["v1253_to_v1261"]["imagePublicEligibleRows"],0)
            self.assertEqual(output["v1253_to_v1261"]["deployAllowed"],False)
            self.assertEqual(output["switch1261BID"],"UNKNOWN_NOT_READ_FROM_STEAM")
            for key in ["publishAllowed","nativeSaveWriterAllowed","itemVisibilityVerified","rightsVerified"]:
                self.assertIs(output[key],False)
            self.assertEqual(json.loads(r.stdout)["v1253_to_v1261"]["addedCount"],1)

    def test_mode_collision_and_fake_real_original_denied_without_report(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"owner";make_version(root,"v1261")
            collide=home/"collision.json"
            r=command(root,collide,"--only-v1261","--include-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertIn("VERSION_MODE_CONFLICT",r.stderr)
            self.assertFalse(collide.exists())
            not_original=home/"fake-real.json"
            r=command(root,not_original,"--only-v1261",synthetic=False)
            self.assertNotEqual(r.returncode,0)
            self.assertIn("PINNED_NATIVE_SOURCE_SHA_OR_BYTES_MISMATCH",r.stderr)
            self.assertFalse(not_original.exists())

    def test_one_untrusted_new_version_original_or_symlink_denies_entire_proof(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"owner";make_version(root,"v1261")
            changed=root/"v1261"/"Clothing.json"
            prior=changed.read_bytes()
            changed.write_bytes(prior+b"\x00")
            out=home/"invalid-proto.json"
            r=command(root,out,"--only-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertFalse(out.exists())
            changed.unlink();outside=home/"elsewhere.data";outside.write_bytes(prior)
            changed.symlink_to(outside)
            r=command(root,out,"--only-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertIn("MISSING_OR_SYMLINK_NATIVE_SOURCE",r.stderr)
            self.assertFalse(out.exists())
            self.assertEqual(outside.read_bytes(),prior)

    def test_evidence_report_must_not_overwrite_or_live_inside_original_tree(self):
        with tempfile.TemporaryDirectory() as t:
            home=pathlib.Path(t);root=home/"owner";make_version(root,"v1261")
            before={p.name:hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in (root/"v1261").glob("*.json")}
            inside=root/"report.json";r=command(root,inside,"--only-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertIn("REPORT_MUST_BE_NEW_OUTSIDE_SOURCE_ROOT",r.stderr)
            existing=home/"existing.json";existing.write_bytes(DUMMY)
            r=command(root,existing,"--only-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertEqual(existing.read_bytes(),DUMMY)
            link=home/"link.json";link.symlink_to(existing)
            r=command(root,link,"--only-v1261")
            self.assertNotEqual(r.returncode,0)
            self.assertEqual(existing.read_bytes(),DUMMY)
            after={p.name:hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in (root/"v1261").glob("*.json")}
            self.assertEqual(before,after)
            self.assertFalse(inside.exists())

if __name__=="__main__":
    unittest.main(verbosity=2)
