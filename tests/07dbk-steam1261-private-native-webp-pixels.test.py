#!/usr/bin/env python3
"""Independent synthetic real Pillow+libwebp tests. No Owner item names, photos or media."""
import copy
import io
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image

SOURCE = Path(__file__).resolve().parents[1] / "scripts/asset-research/07dbk-steam1261-private-native-webp-pixels.py"
spec = importlib.util.spec_from_file_location("wand_07dbk_steam1261_pixel_batch", SOURCE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
A = "guid:" + "a"*32
B = "guid:" + "b"*32
S = "wand.07dbk.steam1261-private-guid-image-queue@1"


def fake_queue():
    return {
        "schema": S, "sourcePlatform": "Steam Windows", "fromVersion": "v1253",
        "toVersion": "v1261", "consumerOn": False, "publicMedia": "OFF",
        "sourceOnlyNotAnImageReview": True,
        "summary": {"newUniqueIconGuids": 2},
        "extractNewGuidGroups": [
            {"iconGuid": A, "action": "EXTRACT_NEW_STEAM_TEXTURE_PRIVATE_THEN_RGBA160_SHA_REVIEW",
             "items": [{"itemId": "40000050", "category": "Furniture", "name": "Synthetic Item A"},
                       {"itemId": "40000051", "category": "Furniture", "name": "Synthetic Item B"}],
             "actualTexturePixelsVerified": False, "visibilityVerified": False, "publishAllowed": False},
            {"iconGuid": B, "action": "EXTRACT_NEW_STEAM_TEXTURE_PRIVATE_THEN_RGBA160_SHA_REVIEW",
             "items": [{"itemId": "40000052", "category": "Furniture", "name": "Synthetic Item C"}],
             "actualTexturePixelsVerified": False, "visibilityVerified": False, "publishAllowed": False}
        ]
    }


def make_image(seed=10, *, source_size=256):
    img = Image.new("RGBA", (source_size, source_size), (seed, 47, 121, 0))
    for x in range(10, source_size-10):
        for y in range(10, source_size-10):
            img.putpixel((x,y), (seed, x % 256, y % 256, (x+y) % 256))
    png = io.BytesIO(); img.save(png, "PNG")
    ref = img.copy(); ref.thumbnail((160,160), Image.Resampling.LANCZOS)
    webp = io.BytesIO(); ref.save(webp, "WEBP", lossless=True, exact=True, method=4)
    return png.getvalue(),webp.getvalue()


class NativePixelBatch(unittest.TestCase):
    def stage(self, root, guid=A, seed=10):
        png,webp=make_image(seed)
        (root/(guid[5:]+".png")).write_bytes(png)
        (root/(guid[5:]+".webp")).write_bytes(webp)
        return png,webp

    def test_positive_bounded_original_png_and_webp_actual_rgba_exact(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            raw, webp = self.stage(root, A)
            self.stage(root, B, 80)
            result = m.admit_pixel_batch(fake_queue(), [B,A], root)
            self.assertEqual(result["verifiedPixelRows"], 2)
            self.assertEqual(result["records"][0]["iconGuid"], A)
            rec = result["records"][0]["privateNativeImage"]
            self.assertEqual(rec["reconstructedPngSha256"],m.sha(raw))
            self.assertEqual(rec["losslessWebpSha256"],m.sha(webp))
            self.assertEqual(rec["webpDimensions"],[160,160])
            self.assertTrue(rec["rgbaPixelExact"])
            self.assertEqual(result["nativeStreamShaVerified"],0)
            self.assertEqual(result["itemVisibilityVerified"],0)
            self.assertEqual(result["newPublicMediaOn"],0)
            self.assertFalse(result["signedBatchCreated"])
            self.assertFalse(result["consumerEnabled"])
            self.assertFalse(rec["publishAllowed"])
            self.assertEqual(result["records"][0]["itemIds"],["40000050","40000051"])

    def test_pixel_mismatch_halts_no_partial_report(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            self.stage(root,A)
            _,foreign=make_image(20)
            (root/(A[5:]+".webp")).write_bytes(foreign)
            with self.assertRaisesRegex(ValueError,"WEBP_RGBA_OR_ALPHA_PIXELS_NOT_EXACT"):
                m.admit_pixel_batch(fake_queue(),[A],root)

    def test_lossy_webp_format_denied_even_if_pixels_look_similar(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); self.stage(root,A)
            source=Image.new("RGB",(160,160),(4,6,8))
            out=io.BytesIO(); source.save(out,"WEBP",lossless=False,quality=100)
            (root/(A[5:]+".webp")).write_bytes(out.getvalue())
            with self.assertRaisesRegex(ValueError,"ENCODED_WEBP_NOT_EXACT_VP8L"):
                m.admit_pixel_batch(fake_queue(),[A],root)

    def test_png_truncated_and_riff_extra_bytes_denied(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);png,webp=self.stage(root,A)
            (root/(A[5:]+".png")).write_bytes(png[:40])
            with self.assertRaisesRegex(ValueError,"MEDIA_DECODER_REJECTED"):
                m.admit_pixel_batch(fake_queue(),[A],root)
            (root/(A[5:]+".png")).write_bytes(png)
            (root/(A[5:]+".webp")).write_bytes(webp+b"TRAILER")
            with self.assertRaisesRegex(ValueError,"ENCODED_WEBP_NOT_EXACT_VP8L"):
                m.admit_pixel_batch(fake_queue(),[A],root)

    def test_symlink_and_missing_media_denied(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);self.stage(root,A)
            (root/(A[5:]+".png")).unlink()
            with self.assertRaisesRegex(ValueError,"IMAGE_SUBJECT_MISSING_OR_SYMLINK"):
                m.admit_pixel_batch(fake_queue(),[A],root)
            other=root/"real.png";other.write_bytes(b"\x89PNG\r\n\x1a\n"+b"0"*30)
            (root/(A[5:]+".png")).symlink_to(other)
            with self.assertRaisesRegex(ValueError,"IMAGE_SUBJECT_MISSING_OR_SYMLINK"):
                m.admit_pixel_batch(fake_queue(),[A],root)

    def test_guid_scope_duplicate_and_forged_release_denied(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);self.stage(root,A)
            for ids in ([A,A],["guid:"+"f"*32],["__proto__"],[],[A]*26):
                with self.assertRaisesRegex(ValueError,"ITEM_BATCH_INVALID|GUID_NOT_IN_ACTUAL_NEW"):
                    m.admit_pixel_batch(fake_queue(),ids,root)
            for prop,val in (("consumerOn",True),("publicMedia","ON")):
                corrupted=fake_queue();corrupted[prop]=val
                with self.assertRaisesRegex(ValueError,"PRIVATE_GUID_QUEUE_IDENTITY_OR_RIGHTS_INVALID"):
                    m.admit_pixel_batch(corrupted,[A],root)
            counterfeit=fake_queue()
            counterfeit["extractNewGuidGroups"][0]["visibilityVerified"]=True
            with self.assertRaisesRegex(ValueError,"GUID_SOURCE_CLAIMS_IMAGE_PUBLICATION"):
                m.admit_pixel_batch(counterfeit,[A],root)

    def test_non_square_source_fails_no_false160_positive(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);self.stage(root,A)
            image=Image.new("RGBA",(256,128),(11,12,13,14))
            raw=io.BytesIO();image.save(raw,"PNG")
            (root/(A[5:]+".png")).write_bytes(raw.getvalue())
            with self.assertRaisesRegex(ValueError,"ORIGINAL_PNG_DIMENSIONS_OR_FRAMES_INVALID|IMAGE_160_SQUARE_REQUIRED"):
                m.admit_pixel_batch(fake_queue(),[A],root)


if __name__=="__main__":
    unittest.main()
