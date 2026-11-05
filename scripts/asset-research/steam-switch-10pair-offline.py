#!/usr/bin/env python3
"""Offline ORIGINAL Switch vs Steam 10-pair DDV icon analysis.

Only reads user-authorized, previously extracted ORIGINAL PNGs. Never uploads,
generates public asset manifest, licenses art, changes product flags or infers
Native Save ABI. PASS requires ten actual version/semantic-matched image pairs.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, pathlib, re, sys

SCHEMA = "wand.01d.steam-switch-10pair-original-quality@1"
VERSION = "1.24.13"
STEAM_FULL_VERSION = "releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33"
HEX = set("0123456789abcdef")
CANONICAL_ITEM = re.compile(r"[1-9][0-9]{0,15}\Z")


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def valid_sha(s):
    return isinstance(s, str) and len(s) == 64 and set(s) <= HEX


def safe_original_png(root, reference, Image):
    if not isinstance(reference, dict):
        return None, "MISSING_ORIGINAL_REFERENCE"
    rel = reference.get("path")
    expected = reference.get("pngSha256")
    if not isinstance(rel, str) or not rel or rel.startswith(("/", "\\")) or "\\" in rel or ".." in pathlib.PurePosixPath(rel).parts:
        return None, "UNSAFE_ORIGINAL_PATH"
    if not valid_sha(expected):
        return None, "UNVERIFIED_ORIGINAL_PNG_SHA"
    path = (root / rel).resolve()
    if root != path and root not in path.parents:
        return None, "OUTSIDE_PRIVATE_LOCAL_INPUT_ROOT"
    if not path.is_file():
        return None, "ORIGINAL_PNG_MISSING"
    if path.stat().st_size > 32 * 1024 * 1024:
        return None, "ORIGINAL_PNG_SIZE_LIMIT"
    data = path.read_bytes()
    if sha256(data) != expected:
        return None, "ORIGINAL_PNG_SHA_MISMATCH"
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format != "PNG" or im.width < 1 or im.height < 1 or im.width * im.height > 4096*4096:
                return None, "ORIGINAL_PNG_FORMAT_OR_SIZE_INVALID"
            original = im.convert("RGBA").copy()
    except (OSError, ValueError, SyntaxError):
        return None, "PNG_IMAGE_DECODE_FAILED"
    return original, None


def normalized_rgba(im, size, Image):
    out = im.copy()
    out.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(out, ((size-out.width)//2, (size-out.height)//2))
    return canvas


def lossless_webp(im, Image):
    stream = io.BytesIO()
    im.save(stream, format="WEBP", lossless=True, exact=True, method=4)
    b = stream.getvalue()
    with Image.open(io.BytesIO(b)) as reloaded:
        if reloaded.format != "WEBP" or reloaded.convert("RGBA").tobytes() != im.tobytes():
            raise ValueError("LOSSLESS_WEBP_RGBA_ROUNDTRIP_FAIL")
    if b[12:16] != b"VP8L" and b"VP8L" not in b[:80]:
        raise ValueError("LOSSLESS_WEBP_CODEC_NOT_VP8L")
    return b


def analyze_original(im, Image):
    width, height = im.size
    pixels = im.tobytes()
    alpha = im.getchannel("A")
    h = alpha.histogram()
    nonzero = sum(h[1:])
    partial = sum(h[1:255])
    return {
        "size":[width,height],
        "decodedRgbaSha256":sha256(pixels),
        "hasTransparency":nonzero < width*height,
        "alphaNonzeroPixels":nonzero,
        "alphaPartiallyTransparentPixels":partial,
        "alphaBounds":list(alpha.getbbox() or (0,0,0,0)),
        "decodedRgbaBytes":len(pixels)
    }


def grayscale_edge_energy(image):
    gray = image.convert("RGB").convert("L")
    width, height = gray.size
    p = gray.load()
    n = 0
    acc = 0
    for y in range(height):
        for x in range(width):
            if x+1 < width:
                acc += abs(int(p[x,y])-int(p[x+1,y])); n += 1
            if y+1 < height:
                acc += abs(int(p[x,y])-int(p[x,y+1])); n += 1
    return round(acc/max(1,n), 6)


def compare_images(a, b):
    if a.size != b.size:
        raise ValueError("NONCOMPARABLE_OUTPUT_SIZE")
    p1 = a.tobytes()
    p2 = b.tobytes()
    diffs = [int(x)-int(y) for x,y in zip(p1,p2)]
    mse = sum(x*x for x in diffs)/max(1,len(diffs))
    psnr = None if mse == 0 else round(10*math.log10(255*255/mse),4)
    return {
        "sameNormalizedRgbaPixels":p1 == p2,
        "normalizedRgbaMse":round(mse,6),
        "normalizedRgbaPsnrDb":psnr,
        "normalizedAlphaPixelsEqual":p1[3::4] == p2[3::4],
        "switchEdgeEnergy":grayscale_edge_energy(a),
        "steamEdgeEnergy":grayscale_edge_energy(b),
        "note":"Edge energy/PSNR are differences, not independent proofs of superior detail."
    }


def compare_pair(row, root, Image):
    out={"slot":row.get("slot"),"itemId":row.get("itemId"),"category":row.get("category"),"status":"NOT_RUN"}
    if row.get("matchStatus") != "SOURCE_PROVENANCE_CONFIRMED" or row.get("gameVersion") != VERSION:
        out.update(status="INSUFFICIENT_EVIDENCE",reason="CROSS_PLATFORM_ITEM_IDENTITY_OR_VERSION_NOT_CONFIRMED")
        return out
    item_id=row.get("itemId")
    if not isinstance(item_id,str) or not CANONICAL_ITEM.fullmatch(item_id):
        out.update(status="INSUFFICIENT_EVIDENCE",reason="MISSING_CANONICAL_ITEM_ID")
        return out
    s=row.get("switch"); t=row.get("steam")
    if not isinstance(s,dict) or not isinstance(t,dict):
        out.update(status="INSUFFICIENT_EVIDENCE",reason="ONE_OR_BOTH_PLATFORM_SOURCE_ENTRIES_MISSING")
        return out
    if (s.get("platform"),t.get("platform")) != ("Nintendo Switch","Steam/Windows") or s.get("gameVersion")!=VERSION or t.get("gameVersion")!=VERSION or t.get("fullVersion")!=STEAM_FULL_VERSION:
        out.update(status="INSUFFICIENT_EVIDENCE",reason="PLATFORM_OR_STEAM_FULL_VERSION_CONFLICT")
        return out
    if s.get("itemId")!=item_id or t.get("itemId")!=item_id:
        out.update(status="INSUFFICIENT_EVIDENCE",reason="SOURCE_ITEM_IDENTITY_MISMATCH")
        return out
    if not all(isinstance(x.get("itemDefinitionSourceSha256"),str) and valid_sha(x["itemDefinitionSourceSha256"]) and
               isinstance(x.get("iconReference"),str) and x["iconReference"].startswith("guid:") and
               len(x["iconReference"])==37 and set(x["iconReference"][5:])<=HEX for x in (s,t)):
        out.update(status="INSUFFICIENT_EVIDENCE",reason="MISSING_SEMANTIC_OR_GUID_SOURCE_PROVENANCE")
        return out
    if s["iconReference"] != t["iconReference"]:
        out.update(status="INSUFFICIENT_EVIDENCE",reason="CROSS_PLATFORM_ICON_GUID_MISMATCH")
        return out
    if s.get("path") == t.get("path"):
        out.update(status="INSUFFICIENT_EVIDENCE",reason="SAME_ORIGINAL_FILE_NOT_TWO_INDEPENDENT_SOURCES")
        return out
    switch,swerr=safe_original_png(root,s,Image)
    steam,sterr=safe_original_png(root,t,Image)
    if swerr or sterr:
        out.update(status="INSUFFICIENT_EVIDENCE",reason=";".join(x for x in [("SWITCH_"+swerr if swerr else None),("STEAM_"+sterr if sterr else None)] if x))
        return out
    out["switch"]=analyze_original(switch,Image)
    out["steam"]=analyze_original(steam,Image)
    out["sourceOriginalPngSha256"]={"switch":s["pngSha256"],"steam":t["pngSha256"]}
    out["matchEvidence"]={"switchItemDefinitionSha256":s["itemDefinitionSourceSha256"],
                          "steamItemDefinitionSha256":t["itemDefinitionSourceSha256"],
                          "switchIconGuid":s["iconReference"],"steamIconGuid":t["iconReference"],
                          "sameGuid":s["iconReference"]==t["iconReference"]}
    for px in (160,320):
        if px==320 and not (min(switch.size)>=320 and min(steam.size)>=320):
            out["comparison320"]={"status":"NATIVE_SOURCE_DIMENSIONS_INSUFFICIENT"}
            continue
        a=normalized_rgba(switch,px,Image)
        b=normalized_rgba(steam,px,Image)
        wa=lossless_webp(a,Image)
        wb=lossless_webp(b,Image)
        out["comparison"+str(px)]={
            "status":"MEASURED_SOURCE_ONLY",
            "switchWebpBytes":len(wa),"steamWebpBytes":len(wb),
            "switchWebpSha256":sha256(wa),"steamWebpSha256":sha256(wb),
            "switchPixelSha256":sha256(a.tobytes()),"steamPixelSha256":sha256(b.tobytes()),
            **compare_images(a,b)}
    out["status"]="MEASURED_SOURCE_ONLY"
    return out


def main():
    p=argparse.ArgumentParser(description="Private-local, exact 10-pair ORIGINAL PNG DDV source-quality comparison; NO upload")
    p.add_argument("--manifest",required=True,type=pathlib.Path)
    p.add_argument("--source-root",required=True,type=pathlib.Path)
    p.add_argument("--report",required=True,type=pathlib.Path)
    args=p.parse_args()
    # Read-only original assets and manifests: reject any existing target
    # before parsing, and use exclusive mode on final output to close races.
    if args.report.is_symlink() or args.report.exists():
        raise ValueError("REPORT_OUTPUT_EXISTS_NO_CLOBBER")
    root=args.source_root.resolve()
    with args.manifest.open(encoding="utf-8") as f:
        manifest=json.load(f)
    if (manifest.get("schema")!=SCHEMA or manifest.get("gameVersion")!=VERSION or
        manifest.get("steamFullVersion")!=STEAM_FULL_VERSION or not isinstance(manifest.get("pairs"),list) or len(manifest["pairs"])!=10):
        raise ValueError("TEN_EXACT_SAME_VERSION_SOURCE_SLOTS_REQUIRED")
    if [x.get("slot") for x in manifest["pairs"]] != list(range(1,11)):
        raise ValueError("TEN_DISTINCT_ORDERED_SLOTS_REQUIRED")
    seen=[x.get("itemId") for x in manifest["pairs"] if x.get("itemId") is not None]
    if len(set(seen)) != len(seen) or any(not isinstance(x,str) or not CANONICAL_ITEM.fullmatch(x) for x in seen):
        raise ValueError("DUPLICATE_OR_NONCANONICAL_ITEM_ID")
    try:
        from PIL import Image, features
    except ImportError as e:
        raise RuntimeError("PILLOW_REQUIRED_FOR_ORIGINAL_PIXEL_VERIFICATION") from e
    if not features.check("webp"):
        raise RuntimeError("LIBWEBP_REQUIRED")
    rows=[compare_pair(x,root,Image) for x in manifest["pairs"]]
    complete=sum(x["status"]=="MEASURED_SOURCE_ONLY" for x in rows)
    result={
        "schema":SCHEMA,
        "status":"TEN_PAIR_ORIGINAL_SOURCE_MEASURED" if complete==10 else "INSUFFICIENT_EVIDENCE",
        "qualityVerdict":"NOT_ASSIGNED_BY_SCRIPT",
        "productMigrationAuthority":False,
        "qualityDecisionRequired":"GPT_REVIEW_OF_TEN_ORIGINAL_PAIRS" if complete==10 else "MISSING_ACTUAL_PAIRED_ORIGINALS",
        "gameVersion":VERSION,
        "measuredPairs":complete,
        "requiredPairs":10,
        "measurements":rows,
        "caution":"Native resolution/edge energy alone is NOT a Steam superiority proof. No Public/Save/Writer/rights gates changed."
    }
    if args.report.resolve()==args.manifest.resolve():
        raise ValueError("NEVER_OVERWRITE_ORIGINAL_MANIFEST")
    args.report.parent.mkdir(parents=True,exist_ok=True)
    # 'x' is exclusive no-clobber creation; never mutate a native input PNG
    # or another existing report even if a concurrent process races us.
    with args.report.open('x',encoding='utf-8') as report_file:
        report_file.write(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"measuredPairs":complete,"report":str(args.report)}))
    return 0 if complete==10 else 2


if __name__=="__main__":
    sys.exit(main())
