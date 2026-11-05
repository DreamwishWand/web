#!/usr/bin/env python3
"""01D local-only v1.24.13 original PNG -> true lossless WebP variant.

Source provenance is R39 ONLY. No v1.25.x Image/Owned/Release approval
is emitted, even when every source pixel and archive SHA verifies.
Requires Pillow with libwebp; genuine DDVRE original PNG portable32 shards.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo
from PIL import Image, features

MANIFEST_SHA = "f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba"
VARIANT = "webp-lossless-160-v1"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def transcode(png_bytes):
    with Image.open(io.BytesIO(png_bytes)) as image:
        original_size = list(image.size)
        reference = image.convert("RGBA")
        reference.thumbnail((160, 160), Image.Resampling.LANCZOS)
        stream = io.BytesIO()
        # "quality=100" is NOT lossless. Preserve invisible RGB via exact.
        reference.save(stream, format="WEBP", lossless=True, method=4, exact=True)
        webp = stream.getvalue()
        with Image.open(io.BytesIO(webp)) as decoded:
            if decoded.format != "WEBP" or decoded.size != reference.size or decoded.convert("RGBA").tobytes() != reference.tobytes():
                raise ValueError("WEBP_PIXEL_OR_ALPHA_LOSS")
        return webp, original_size, list(reference.size)

def main(args):
    if not features.check("webp"):
        raise RuntimeError("WEBP_ENCODER_UNAVAILABLE")
    manifest_bytes = args.manifest.read_bytes()
    if sha(manifest_bytes) != MANIFEST_SHA:
        raise ValueError("R39_SOURCE_MANIFEST_SHA_MISMATCH")
    manifest = json.loads(gzip.decompress(manifest_bytes))
    if manifest.get("gameVersion") != "1.24.13" or len(manifest.get("shards", [])) != 32:
        raise ValueError("WRONG_R39_SOURCE_VERSION")
    # Fail before writing ANY derivative if a complete release-like source set
    # was requested. Historical partial runs must not leave misleading output.
    if args.require_complete:
        missing = [s['shard'] for s in manifest['shards'] if not (args.png_dir / s['file']).is_file()]
        if missing:
            raise ValueError('ALL_32_ORIGINAL_PNG_SHARDS_REQUIRED: ' + ','.join(missing))
    if args.out.exists() and any(args.out.iterdir()):
        raise ValueError('OUTPUT_DIRECTORY_NOT_EMPTY_RUN_IN_FRESH_DIR')
    args.out.mkdir(parents=True, exist_ok=True)
    report = {
        "schema":"wand.01d.r39.lossless160-source-only@1",
        "sourceVersion":"1.24.13",
        "variant":VARIANT,
        "status":"HOLD_NOT_DEPLOY",
        "publicationManifestGenerated":False,
        "deployAllowed":False,
        "target1250VerifiedRows":0,
        "target1253VerifiedRows":0,
        "presentShards":[],
        "missingShards":[],
        "sourceRows":[]
    }
    for shard in manifest["shards"]:
        in_file = args.png_dir / shard["file"]
        if not in_file.exists():
            report["missingShards"].append(shard["shard"])
            continue
        data = in_file.read_bytes()
        if len(data) != shard["bytes"] or sha(data) != shard["sha256"]:
            raise ValueError("R39_PNG_ZIP_BYTES_OR_SHA_MISMATCH")
        output = args.out / ("R39_" + VARIANT + "_shard_" + shard["shard"] + ".zip")
        with ZipFile(io.BytesIO(data)) as source, ZipFile(output, "w", ZIP_STORED) as dest:
            if source.testzip() is not None:
                raise ValueError("ORIGINAL_PNG_ZIP_CRC_FAIL")
            names = sorted(x for x in source.namelist() if x.endswith(".png"))
            if len(names) != shard["uniquePng"]:
                raise ValueError("ORIGINAL_PNG_SHARD_COUNT_MISMATCH")
            for name in names:
                source_sha = Path(name).stem
                png = source.read(name)
                if len(source_sha) != 64 or any(c not in "0123456789abcdef" for c in source_sha) or sha(png) != source_sha:
                    raise ValueError("PNG_CONTENT_IDENTITY_MISMATCH")
                n = format(int(source_sha[:2], 16) >> 3, "02x")
                if n != shard["shard"]:
                    raise ValueError("WRONG_SHA_SHARD")
                encoded, original_size, dimensions = transcode(png)
                asset_path = "ddv/item-images/" + VARIANT + "/v1.24.13/" + n + "/" + source_sha + ".webp"
                entry = ZipInfo(asset_path, date_time=(1980,1,1,0,0,0))
                entry.compress_type = ZIP_STORED
                dest.writestr(entry, encoded)
                report["sourceRows"].append({
                    "sourcePngSha256":source_sha,
                    "sourceSize":original_size,
                    "outputSize":dimensions,
                    "sourcePngBytes":len(png),
                    "losslessWebpSha256":sha(encoded),
                    "losslessWebpBytes":len(encoded),
                    "rgbaPixelExact":True,
                    "path":asset_path,
                    "sameVersionTargetEquivalent":None
                })
        with ZipFile(output) as check:
            if check.testzip() is not None:
                raise ValueError("LOSSLESS_PACK_CRC_FAIL")
        report["presentShards"].append({
            "shard":shard["shard"],
            "count":len(names),
            "zipSha256":sha(output.read_bytes()),
            "zipBytes":output.stat().st_size
        })
    report["processedCount"] = len(report["sourceRows"])
    report["completeR39Lossless"] = not report["missingShards"] and report["processedCount"] == 12082
    if args.require_complete and not report["completeR39Lossless"]:
        raise ValueError("ALL_32_ORIGINAL_PNG_SHARDS_REQUIRED")
    (args.out / "R39_lossless_SOURCE_ONLY_report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"sourceCount":report["processedCount"], "missingShards":report["missingShards"],
                      "completeR39Lossless":report["completeR39Lossless"],"deployAllowed":False}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest",type=Path,required=True)
    parser.add_argument("--png-dir",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--require-complete",action="store_true")
    main(parser.parse_args())
