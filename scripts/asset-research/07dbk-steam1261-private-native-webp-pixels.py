#!/usr/bin/env python3
"""07 DBK: bounded PRIVATE Steam v1.26.1 native-PNG to lossless WebP exact-pixel admission.

01D owns the native Unity IconGUID->Texture decode and original Build pins;
this never mints a visibility, rights, public-asset or signed Pages grant.
No licensed art, Owner original ItemDB, Save or decrypted bytes are emitted to
CI, GitHub, public Pages, or log output. The output is metadata-only PRIVATE.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import sys

SCHEMA = "wand.07dbk.steam1261-private-native-webp160-pixel-stage@1"
QUEUE_MODULE = Path(__file__).with_name("07dbk-steam1261-image-batch-queue.py")
GUID = re.compile(r"guid:[0-9a-f]{32}\Z")
HEX = re.compile(r"[0-9a-f]{64}\Z")
MAX_WEBP = 200000
MAX_PNG = 5 * 1024 * 1024
MAX_BATCH = 25


def fail(code):
    raise ValueError("07DBK_PRIVATE_WEBP_STAGE_" + code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_queue_module():
    spec = importlib.util.spec_from_file_location("wand_07dbk_private_native_queue", QUEUE_MODULE)
    if not spec or not spec.loader:
        fail("QUEUE_SOURCE_MISSING")
    mod = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(mod)
    finally:
        sys.dont_write_bytecode = previous
    return mod


def read_pinned_subject(path: Path, limit: int):
    # Both canonical parent and leaf are private and not symbolic links.
    if path.parent.is_symlink() or path.is_symlink() or not path.is_file():
        fail("IMAGE_SUBJECT_MISSING_OR_SYMLINK")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(fd)
        item = os.stat(path, follow_symlinks=False)
        if not stat.S_ISREG(before.st_mode) or before.st_size < 16 or before.st_size > limit or \
           (before.st_dev, before.st_ino) != (item.st_dev, item.st_ino):
            fail("IMAGE_SUBJECT_NOT_SAFE_REGULAR_BOUNDED")
        chunks = []
        remaining = before.st_size
        while remaining:
            data = os.read(fd, min(remaining, 1024 * 1024))
            if not data:
                fail("IMAGE_SUBJECT_SHORT_READ")
            chunks.append(data)
            remaining -= len(data)
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns
        ):
            fail("IMAGE_SUBJECT_CHANGED_DURING_READ")
        return b"".join(chunks)
    finally:
        os.close(fd)


def compare_original_png_to_webp(png: bytes, webp: bytes):
    # Reject nonlossless WebP and extra RIFF trailer before trusting a decoder.
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        fail("SOURCE_NOT_PNG")
    if len(webp) < 20 or webp[:4] != b"RIFF" or webp[8:16] != b"WEBPVP8L" or \
       int.from_bytes(webp[4:8], "little") + 8 != len(webp):
        fail("ENCODED_WEBP_NOT_EXACT_VP8L")
    try:
        from PIL import Image, ImageFile, features
    except ImportError:
        fail("PILLOW_REQUIRED_FOR_ACTUAL_PIXEL_PROOF")
    if not features.check("webp"):
        fail("LIBWEBP_REQUIRED_FOR_ACTUAL_PIXEL_PROOF")
    ImageFile.LOAD_TRUNCATED_IMAGES = False
    try:
        with Image.open(io.BytesIO(png)) as original:
            if original.format != "PNG" or getattr(original, "n_frames", 1) != 1 or \
               original.width > 2048 or original.height > 2048 or \
               original.width < 160 or original.height < 160:
                fail("ORIGINAL_PNG_DIMENSIONS_OR_FRAMES_INVALID")
            reference = original.convert("RGBA")
            reference.thumbnail((160, 160), Image.Resampling.LANCZOS)
            if reference.size != (160, 160):
                fail("IMAGE_160_SQUARE_REQUIRED")
            pixels = reference.tobytes()
            original_size = [original.width, original.height]
        with Image.open(io.BytesIO(webp)) as derivative:
            if derivative.format != "WEBP" or derivative.size != (160, 160) or \
               getattr(derivative, "n_frames", 1) != 1:
                fail("WEBP_DIMENSIONS_OR_FRAMES_INVALID")
            actual = derivative.convert("RGBA").tobytes()
    except (OSError, ValueError) as e:
        if str(e).startswith("07DBK_PRIVATE_WEBP_STAGE_"):
            raise
        fail("MEDIA_DECODER_REJECTED_OR_TRUNCATED")
    if actual != pixels:
        fail("WEBP_RGBA_OR_ALPHA_PIXELS_NOT_EXACT")
    return {
        "reconstructedPngSha256": sha(png),
        "losslessWebpSha256": sha(webp),
        "rgba160Sha256": sha(pixels),
        "reconstructedPngBytes": len(png),
        "webpBytes": len(webp),
        "originalRasterDimensions": original_size,
        "webpDimensions": [160, 160],
        "rgbaPixelExact": True,
        "losslessCodec": "WEBP_VP8L_EXACT",
        # It is NOT proof that 01D actually decoded the claimed native stream.
        "nativeStreamProvenance": "NOT_ATTESTED_BY_PIXELS_ALONE",
        "visibility": "NOT_VERIFIED",
        "rightsHolderLicense": "UNKNOWN",
        "publishAllowed": False
    }


def admit_pixel_batch(queue, items, stage_dir: Path):
    if not isinstance(queue, dict) or \
       queue.get("schema") != "wand.07dbk.steam1261-private-guid-image-queue@1" or \
       queue.get("sourcePlatform") != "Steam Windows" or \
       queue.get("fromVersion") != "v1253" or \
       queue.get("toVersion") != "v1261" or \
       queue.get("consumerOn") is not False or queue.get("publicMedia") != "OFF" or \
       queue.get("sourceOnlyNotAnImageReview") is not True:
        fail("PRIVATE_GUID_QUEUE_IDENTITY_OR_RIGHTS_INVALID")
    all_groups = queue.get("extractNewGuidGroups")
    if not isinstance(all_groups, list) or \
       len(all_groups) != queue.get("summary", {}).get("newUniqueIconGuids"):
        fail("GUID_QUEUE_INCOMPLETE_OR_CONFLICT")
    if not isinstance(items, list) or len(items) < 1 or len(items) > MAX_BATCH or \
       any(not isinstance(i, str) or GUID.fullmatch(i) is None for i in items) or \
       len(set(items)) != len(items):
        fail("ITEM_BATCH_INVALID")
    by_guid = {}
    for group in all_groups:
        if not isinstance(group, dict) or \
           group.get("action") != "EXTRACT_NEW_STEAM_TEXTURE_PRIVATE_THEN_RGBA160_SHA_REVIEW" or \
           group.get("actualTexturePixelsVerified") is not False or \
           group.get("visibilityVerified") is not False or group.get("publishAllowed") is not False or \
           not isinstance(group.get("items"), list):
            fail("GUID_SOURCE_CLAIMS_IMAGE_PUBLICATION")
        guid = group.get("iconGuid")
        if not isinstance(guid, str) or not GUID.fullmatch(guid) or guid in by_guid:
            fail("DUPLICATE_OR_UNSAFE_SOURCE_GUID")
        by_guid[guid] = group
    if any(guid not in by_guid for guid in items):
        fail("GUID_NOT_IN_ACTUAL_NEW_SOURCE_DELTA")
    reports = []
    for guid in sorted(items):
        stem = guid[5:]
        png = read_pinned_subject(stage_dir / (stem + ".png"), MAX_PNG)
        webp = read_pinned_subject(stage_dir / (stem + ".webp"), MAX_WEBP)
        validated = compare_original_png_to_webp(png, webp)
        ids = by_guid[guid]["items"]
        if not ids or any(not isinstance(r, dict) or
                          set(r) != {"itemId", "category", "name"} or
                          not isinstance(r["itemId"], str) or
                          not r["itemId"].isdigit() for r in ids):
            fail("PRIVATE_IMAGE_ITEM_BINDING_INVALID")
        reports.append({
            "iconGuid": guid, "itemIds": sorted([r["itemId"] for r in ids], key=int),
            "privateNativeImage": validated
        })
    return {
        "schema": SCHEMA,
        "platform": "Steam Windows",
        "gameBuild": "v1261",
        "stage": "PRIVATE_PIXELS_VERIFIED_NATIVE_BINDING_UNATTESTED",
        "consumedUniqueNewIconGuids": len(reports),
        "totalNativeGuidCandidateCount": len(all_groups),
        "records": reports,
        "verifiedPixelRows": len(reports),
        "nativeStreamShaVerified": 0,
        "itemVisibilityVerified": 0,
        "newPublicMediaOn": 0,
        "consumerEnabled": False,
        "signedBatchCreated": False,
        "publishedManifestCreated": False,
        "rightsLicenseObtained": False
    }


def main():
    parser = argparse.ArgumentParser(description="PRIVATE 07DBK exact PNG vs WebP stage; no media publishing")
    parser.add_argument("--native-root", type=Path, required=True)
    parser.add_argument("--stage-root", type=Path, required=True)
    parser.add_argument("--private-output", type=Path, required=True)
    parser.add_argument("--guid", action="append", required=True)
    args = parser.parse_args()
    queue_mod = read_queue_module()
    native = queue_mod.secure_private_path(args.native_root, is_dir=True)
    stage = queue_mod.secure_private_path(args.stage_root, is_dir=True)
    output = queue_mod.secure_private_path(args.private_output, is_dir=False)
    # No original, staged media, or generated evidence can sit in each
    # other's trees; private output may not be written inside either input.
    if native == stage or stage in native.parents or native in stage.parents or \
       output.parent in (native, stage) or native in output.parent.parents or \
       stage in output.parent.parents or output.parent in native.parents or \
       output.parent in stage.parents:
        fail("ORIGINAL_STAGE_OR_OUTPUT_DIRECTORY_OVERLAP")
    verified_queue = queue_mod.run(native)
    result = admit_pixel_batch(verified_queue, args.guid, stage)
    payload = (json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode()
    if len(payload) > 128 * 1024:
        fail("PRIVATE_REPORT_TOO_LARGE")
    # Preserve Owner originals and all existing outputs, no write of game art.
    queue_mod.secure_private_path(output, is_dir=False)
    fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY |
                 getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(payload)
    print(json.dumps({
        "stage": result["stage"],
        "pixelVerifiedUniqueGuids": result["verifiedPixelRows"],
        "nativeStreamShaVerified": 0,
        "itemVisibilityVerified": 0,
        "newPublicMediaOn": 0,
        "publishedManifestCreated": False,
        "privateOutputWritten": True
    }, sort_keys=True))


if __name__ == "__main__":
    main()
