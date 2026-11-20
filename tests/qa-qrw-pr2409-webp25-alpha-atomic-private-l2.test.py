#!/usr/bin/env python3
"""04 QR-W independent L2: 07 DBK v1.26.1 private 25 image RGBA exact/atomic.
Synthetic pixels only. No game artwork, private Owner image/Save, public media.
"""
from __future__ import annotations
import contextlib
import io
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image

SOURCE=Path(__file__).resolve().parents[1]/"scripts"/"asset-research"/"07dbk-steam1261-private-native-webp-pixels.py"
spec=importlib.util.spec_from_file_location("qrw_07dbk_steam_pixel_stage",SOURCE)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
N=25
SCHEMA="wand.07dbk.steam1261-private-guid-image-queue@1"

def guid(i):
    return "guid:"+format(i,"032x")

def private_queue(n=N):
    return {
        "schema":SCHEMA,"sourcePlatform":"Steam Windows",
        "fromVersion":"v1253","toVersion":"v1261",
        "consumerOn":False,"publicMedia":"OFF","sourceOnlyNotAnImageReview":True,
        "summary":{"newUniqueIconGuids":n},
        "extractNewGuidGroups":[{
          "iconGuid":guid(i+1),
          "action":"EXTRACT_NEW_STEAM_TEXTURE_PRIVATE_THEN_RGBA160_SHA_REVIEW",
          "actualTexturePixelsVerified":False,"visibilityVerified":False,
          "publishAllowed":False,
          "items":[{"itemId":str(40000001+i),"category":"Furniture",
                    "name":"Private synthetic item "+str(i+1)}]
        } for i in range(n)]
    }

def image_pair(i):
    img=Image.new("RGBA",(160,160),(i*7%256,37,99,255))
    # Include one partially transparent, one fully transparent pixel with
    # nonzero hidden RGB, proving this is a FULL RGBA comparison.
    img.putpixel((50,60),(i*9%256,80,110,95))
    img.putpixel((55,65),(i*11%256,20,170,0))
    png=io.BytesIO();img.save(png,format="PNG")
    webp=io.BytesIO();img.save(webp,format="WEBP",lossless=True,exact=True,method=4)
    return png.getvalue(),webp.getvalue()

def stage_images(folder,n=N):
    saved={}
    for i in range(1,n+1):
        png,webp=image_pair(i)
        name=guid(i)[5:]
        (folder/(name+".png")).write_bytes(png)
        (folder/(name+".webp")).write_bytes(webp)
        saved[name]=(png,webp)
    return saved

class PrivatePixelBatchL2(unittest.TestCase):
    def test_full_25_distinct_real_lossless_rgba_stage_is_sorted_and_not_publication(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);values=stage_images(root)
            result=m.admit_pixel_batch(private_queue(),[guid(i) for i in range(N,0,-1)],root)
            self.assertEqual(result["verifiedPixelRows"],25)
            self.assertEqual(result["totalNativeGuidCandidateCount"],25)
            self.assertEqual(result["consumedUniqueNewIconGuids"],25)
            self.assertEqual([r["iconGuid"] for r in result["records"]],
                             [guid(i) for i in range(1,N+1)])
            for row in result["records"]:
                expected=values[row["iconGuid"][5:]]
                evidence=row["privateNativeImage"]
                self.assertEqual(evidence["reconstructedPngSha256"],m.sha(expected[0]))
                self.assertEqual(evidence["losslessWebpSha256"],m.sha(expected[1]))
                self.assertEqual(evidence["webpDimensions"],[160,160])
                self.assertTrue(evidence["rgbaPixelExact"])
                self.assertFalse(evidence["publishAllowed"])
                self.assertEqual(evidence["nativeStreamProvenance"],"NOT_ATTESTED_BY_PIXELS_ALONE")
            for status in ["nativeStreamShaVerified","itemVisibilityVerified","newPublicMediaOn"]:
                self.assertEqual(result[status],0)
            for flag in ["consumerEnabled","signedBatchCreated","publishedManifestCreated","rightsLicenseObtained"]:
                self.assertFalse(result[flag])
    def test_alpha_zero_hidden_rgb_and_partial_alpha_are_not_discarded_as_equal(self):
        original=Image.new("RGBA",(160,160),(4,30,60,255))
        original.putpixel((55,65),(11,25,90,0))
        original.putpixel((70,80),(80,30,22,91))
        png=io.BytesIO();original.save(png,"PNG")
        good=io.BytesIO();original.save(good,"WEBP",lossless=True,exact=True,method=4)
        data=m.compare_original_png_to_webp(png.getvalue(),good.getvalue())
        self.assertTrue(data["rgbaPixelExact"])
        self.assertEqual(data["visibility"],"NOT_VERIFIED")
        for pos,pixel in [((55,65),(12,25,90,0)),((70,80),(80,30,22,92))]:
            other=original.copy();other.putpixel(pos,pixel)
            out=io.BytesIO();other.save(out,"WEBP",lossless=True,exact=True,method=4)
            with self.assertRaisesRegex(ValueError,"WEBP_RGBA_OR_ALPHA_PIXELS_NOT_EXACT"):
                m.compare_original_png_to_webp(png.getvalue(),out.getvalue())
    def test_last_of_25_invalid_denies_entire_cli_without_creating_partial_file(self):
        with tempfile.TemporaryDirectory() as d:
            home=Path(d);source=home/"owner-orig";source.mkdir()
            stage=home/"staging";stage.mkdir()
            outdir=home/"private-reports";outdir.mkdir()
            stage_images(stage)
            final=stage/(guid(25)[5:]+".webp")
            final.write_bytes(final.read_bytes()+b"UNTRUSTED_TRAILING_DATA")
            output=outdir/"must-not-exist.json"
            qmod=m.read_queue_module()
            stdout=io.StringIO()
            with patch.object(m,"read_queue_module",return_value=SimpleNamespace(
                secure_private_path=qmod.secure_private_path,run=lambda root:private_queue()
            )),patch.object(sys,"argv",["stage",
                  "--native-root",str(source),"--stage-root",str(stage),
                  "--private-output",str(output),"--guid",*sum([
                    [guid(i)] for i in range(1,N+1)],[])]):
                # Argparse expects each --guid immediately before its value.
                pass
            args=["stage","--native-root",str(source),"--stage-root",str(stage),
                  "--private-output",str(output)]
            for i in range(1,N+1):args.extend(["--guid",guid(i)])
            with patch.object(m,"read_queue_module",return_value=SimpleNamespace(
                secure_private_path=qmod.secure_private_path,run=lambda root:private_queue()
            )),patch.object(sys,"argv",args),contextlib.redirect_stdout(stdout):
                with self.assertRaisesRegex(ValueError,"ENCODED_WEBP_NOT_EXACT_VP8L"):
                    m.main()
            self.assertFalse(output.exists(),"a bad last item cannot emit a partial good batch")
            self.assertEqual(stdout.getvalue(),"","no private names or intermediate success")
    def test_valid_private_cli_is_mode0600_exclusive_nonpublishing_and_no_names_on_stdout(self):
        with tempfile.TemporaryDirectory() as d:
            home=Path(d);source=home/"native";source.mkdir()
            stage=home/"staging";stage.mkdir();stage_images(stage,2)
            evidence=home/"reports";evidence.mkdir()
            output=evidence/"fresh.json"
            args=["stage","--native-root",str(source),"--stage-root",str(stage),
                  "--private-output",str(output),"--guid",guid(1),"--guid",guid(2)]
            qmod=m.read_queue_module()
            def run():
                transcript=io.StringIO()
                with patch.object(m,"read_queue_module",return_value=SimpleNamespace(
                    secure_private_path=qmod.secure_private_path,run=lambda root:private_queue(2)
                )),patch.object(sys,"argv",args),contextlib.redirect_stdout(transcript):
                    m.main()
                return transcript.getvalue()
            stdout=run();self.assertTrue(output.is_file())
            self.assertEqual(stat.S_IMODE(output.stat().st_mode),0o600)
            manifest=json.loads(output.read_text())
            self.assertEqual(manifest["verifiedPixelRows"],2)
            self.assertEqual(manifest["stage"],"PRIVATE_PIXELS_VERIFIED_NATIVE_BINDING_UNATTESTED")
            self.assertFalse(manifest["consumerEnabled"])
            self.assertEqual(manifest["newPublicMediaOn"],0)
            self.assertFalse(manifest["signedBatchCreated"])
            self.assertNotIn("Private synthetic item",stdout)
            self.assertEqual(json.loads(stdout)["newPublicMediaOn"],0)
            before=output.read_bytes()
            with self.assertRaisesRegex(ValueError,"NO_CLOBBER_EXISTING_OUTPUT"):
                run()
            self.assertEqual(output.read_bytes(),before)
    def test_foreign_batch_size_and_forged_rights_denied_before_image_read(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for ids in [[guid(i) for i in range(1,27)],[],[guid(1),guid(1)]]:
                with self.assertRaisesRegex(ValueError,"ITEM_BATCH_INVALID"):
                    m.admit_pixel_batch(private_queue(),ids,root)
            for key,value in [("publicMedia","ON"),("consumerOn",True),
                              ("sourceOnlyNotAnImageReview",False)]:
                q=private_queue();q[key]=value
                with self.assertRaisesRegex(ValueError,"PRIVATE_GUID_QUEUE_IDENTITY_OR_RIGHTS_INVALID"):
                    m.admit_pixel_batch(q,[guid(1)],root)

if __name__=="__main__":
    unittest.main(verbosity=2)
