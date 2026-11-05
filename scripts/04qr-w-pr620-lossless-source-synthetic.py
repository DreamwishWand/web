#!/usr/bin/env python3
"""04 QR-W independent PR620 offline lossless encoder QA with synthetic PNGs ONLY.

No DDV original art, real P1G, keys, gameplay assets, external media/CDN or provider data.
Uses exact 01D Source module unchanged. In the artificial test only, the in-memory
immutable real original-manifest SHA expectation is switched to a newly generated
synthetic fixture digest to exercise the original codec/ZIP algorithm.
"""
import argparse
import gzip
import hashlib
import importlib.util
import io
import json
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo

from PIL import Image, features

ROOT=Path(__file__).resolve().parents[1]
MOD=ROOT/"scripts"/"01d-r39-lossless-webp160.py"
MAIN="decd251df76c094da1fabdc691ccfbd90c4ea2ea"
SRC="218cf1977447476777647a863265bae4be5c18bf"
SRCFILES=sorted(["scripts/01d-r39-lossless-webp160.py","docs/core/01d-r39-lossless-webp160-source-20261105.md"])
QAFILES=sorted(["scripts/04qr-w-pr620-lossless-source-synthetic.py",".github/workflows/04qr-w-pr620-lossless-source-synthetic.yml"])
CUMULATIVE={
    "docs/core/01d-r39-real-asset-source-20261105.md":"f2c58039dea630722ca6a17513f2103060fe0745",
    "src/lib/ddv/core/items/r39-image-source-contract.mjs":"6ba8e08899e90ec674ecd4f9902bb214a51076c5",
    "tests/01d-r39-item-media-source-contract.test.mjs":"afdd044909d2eb6da076850ff73335f1a66ee555",
}
def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
assert git("merge-base",MAIN,SRC)==MAIN
assert git("merge-base",SRC,"HEAD")==SRC
assert sorted(git("diff","--name-only",MAIN,SRC).splitlines())==SRCFILES
current=sorted(git("diff","--name-only",SRC,"HEAD").splitlines())
for p in current:
    if p in CUMULATIVE:
        assert git("rev-parse","HEAD:"+p)==CUMULATIVE[p],p
assert sorted(p for p in current if p not in CUMULATIVE)==QAFILES,current
assert git("rev-parse",SRC+":scripts/01d-r39-lossless-webp160.py")=="d180832db24023547b0828426747541bb446aca1"
assert git("rev-parse",SRC+":docs/core/01d-r39-lossless-webp160-source-20261105.md")=="d6aa423a09b431ae3b46c08db982b999b2e9aa71"
print("QR620_FIXED_SOURCE2_QA2_CUMULATIVE_01D3_IMMUTABLE_PASS")

spec=importlib.util.spec_from_file_location("r39_encoder",MOD)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
REAL_MANIFEST_SHA="f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba"
assert mod.MANIFEST_SHA==REAL_MANIFEST_SHA
assert mod.VARIANT=="webp-lossless-160-v1"
assert features.check("webp"),"NOT_RUN: system libwebp encoder missing"
sha=lambda x:hashlib.sha256(x).hexdigest()

# Self-authored variable RGB/alpha pattern with fully transparent hidden RGB.
im=Image.new("RGBA",(256,192))
for y in range(192):
    for x in range(256):
        im.putpixel((x,y),((13*x+7*y)%256,(19*x+3*y)%256,(11*x+17*y)%256,
                           0 if (x+y)%7==0 else (128 if (x*y)%11==0 else 255)))
buf=io.BytesIO()
im.save(buf,format="PNG")
png=buf.getvalue()
png_sha=sha(png)
shard=format(int(png_sha[:2],16)>>3,"02x")
assert len(png_sha)==64
encoded,original_size,output_size=mod.transcode(png)
assert original_size==[256,192]
assert output_size[0]<=160 and output_size[1]<=160
assert encoded[:4]==b"RIFF" and encoded[8:12]==b"WEBP" and encoded[12:16]==b"VP8L"
with Image.open(io.BytesIO(encoded)) as check:
    expected=im.convert("RGBA")
    expected.thumbnail((160,160),Image.Resampling.LANCZOS)
    assert check.size==expected.size
    assert check.convert("RGBA").tobytes()==expected.tobytes()
print("QR620_SYNTHETIC_LOSSLESS_TRUE_VP8L_RGBA_AND_HIDDEN_RGB_PASS")

def makezip(name,payload):
    b=io.BytesIO()
    with ZipFile(b,"w",ZIP_STORED) as z:
        i=ZipInfo(name,date_time=(1980,1,1,0,0,0))
        i.compress_type=ZIP_STORED
        z.writestr(i,payload)
    return b.getvalue()

def make_manifest(zipdata,file_name,game_version="1.24.13"):
    shards=[]
    for i in range(32):
        h=format(i,"02x")
        shards.append({
            "shard":h,
            "file":file_name if h==shard else "synthetic_missing_"+h+".zip",
            "bytes":len(zipdata) if h==shard else 0,
            "sha256":sha(zipdata) if h==shard else "0"*64,
            "uniquePng":1 if h==shard else 0,
        })
    return gzip.compress(json.dumps({"gameVersion":game_version,"shards":shards},sort_keys=True).encode(),mtime=0)

def args(manifest,indir,out,complete=False):
    return argparse.Namespace(manifest=manifest,png_dir=indir,out=out,require_complete=complete)

def raises(prefix,operation):
    try:
        operation()
    except Exception as e:
        assert prefix in str(e),(prefix,repr(e))
        return
    raise AssertionError("Expected failclosed: "+prefix)

with tempfile.TemporaryDirectory(prefix="04qrw-synthetic-lossless-") as d:
    root=Path(d)
    source=root/"source"
    source.mkdir()
    name="synthetic_png_shard_"+shard+".zip"
    zdata=makezip(png_sha+".png",png)
    (source/name).write_bytes(zdata)
    man=root/"manifest.json.gz"
    man.write_bytes(make_manifest(zdata,name))

    # The fixed real manifest MUST reject all synthetic data before any mutation.
    raises("R39_SOURCE_MANIFEST_SHA_MISMATCH",
           lambda:mod.main(args(man,source,root/"old-real-sha-reject")))
    assert not (root/"old-real-sha-reject").exists()

    # Synthetic-only in-memory trust root, never persisted back to original Source.
    mod.MANIFEST_SHA=sha(man.read_bytes())
    out_strict=root/"require-complete"
    raises("ALL_32_ORIGINAL_PNG_SHARDS_REQUIRED",
           lambda:mod.main(args(man,source,out_strict,True)))
    assert not out_strict.exists(),"missing 31 shards must cause NO output before any writes"
    print("QR620_MISSING_31_ORIGINAL_SHARDS_STRICT_PREFLIGHT_NO_OUTPUT_PASS")

    nonempty=root/"nonempty"
    nonempty.mkdir()
    (nonempty/"keep-me.txt").write_text("synthetic immutable old file")
    raises("OUTPUT_DIRECTORY_NOT_EMPTY_RUN_IN_FRESH_DIR",
           lambda:mod.main(args(man,source,nonempty,False)))
    assert sorted(p.name for p in nonempty.iterdir())==["keep-me.txt"]
    print("QR620_REJECT_NONEMPTY_OUTPUT_NO_OVERWRITE_PASS")

    result=root/"partial"
    mod.main(args(man,source,result,False))
    report=json.loads((result/"R39_lossless_SOURCE_ONLY_report.json").read_text())
    assert report["schema"]=="wand.01d.r39.lossless160-source-only@1"
    assert report["status"]=="HOLD_NOT_DEPLOY"
    assert report["variant"]=="webp-lossless-160-v1"
    assert report["deployAllowed"] is False
    assert report["publicationManifestGenerated"] is False
    assert report["target1250VerifiedRows"]==0 and report["target1253VerifiedRows"]==0
    assert report["completeR39Lossless"] is False
    assert report["processedCount"]==1
    assert len(report["missingShards"])==31
    assert report["presentShards"][0]["shard"]==shard
    item=report["sourceRows"][0]
    assert item["sourcePngSha256"]==png_sha
    assert item["losslessWebpSha256"]==sha(encoded)
    assert item["rgbaPixelExact"] is True
    assert item["sameVersionTargetEquivalent"] is None
    pack=result/("R39_webp-lossless-160-v1_shard_"+shard+".zip")
    assert pack.exists()
    with ZipFile(pack) as archive:
        assert archive.testzip() is None
        assert archive.namelist()==[item["path"]]
        binary=archive.read(item["path"])
        assert binary[12:16]==b"VP8L"
        assert sha(binary)==item["losslessWebpSha256"]
        with Image.open(io.BytesIO(binary)) as check:
            assert check.convert("RGBA").tobytes()==expected.tobytes()
    assert item["path"].startswith("ddv/item-images/webp-lossless-160-v1/v1.24.13/"+shard+"/")
    assert item["path"].endswith(png_sha+".webp")
    assert "ddv/item-images/v1.24.13/" not in item["path"]
    print("QR620_PARTIAL_ONE_SYNTHETIC_ZIP_CRC_SHA_ALPHA_REPORT_OFF_PASS")

    wrong=root/"wrong"
    wrong.mkdir()
    (wrong/name).write_bytes(zdata[:-1]+b"\0")
    raises("R39_PNG_ZIP_BYTES_OR_SHA_MISMATCH",
           lambda:mod.main(args(man,wrong,root/"wrong-sha-output")))
    assert not (root/"wrong-sha-output"/"R39_lossless_SOURCE_ONLY_report.json").exists()

    bad_png_zip=makezip("f"*64+".png",png)
    (wrong/name).write_bytes(bad_png_zip)
    bad_manifest=root/"wrong-filename.json.gz"
    bad_manifest.write_bytes(make_manifest(bad_png_zip,name))
    mod.MANIFEST_SHA=sha(bad_manifest.read_bytes())
    raises("PNG_CONTENT_IDENTITY_MISMATCH",
           lambda:mod.main(args(bad_manifest,wrong,root/"wrong-id-output")))
    assert not (root/"wrong-id-output"/"R39_lossless_SOURCE_ONLY_report.json").exists()

    wrong_ver_manifest=root/"future.json.gz"
    wrong_ver_manifest.write_bytes(make_manifest(zdata,name,game_version="1.25.3"))
    mod.MANIFEST_SHA=sha(wrong_ver_manifest.read_bytes())
    raises("WRONG_R39_SOURCE_VERSION",
           lambda:mod.main(args(wrong_ver_manifest,source,root/"future-output")))
    assert not (root/"future-output").exists()
    print("QR620_BAD_ZIP_SHA_BAD_PNG_ID_WRONG_VERSION_FAILCLOSED_PASS")

    # This is intentionally an ABI-readiness observation, NOT a retroactive
    # failure of source-only historical PNG -> VP8L conversion:
    consumer="ddv/item-images/webp-lossless-160-v1/v1.24.13/"+shard+"/"+png_sha+"-"+sha(binary)+".webp"
    assert item["path"]!=consumer
    print("QR620_PRODUCER_WEB_CONSUMER_FILENAME_ABI_NOT_ALIGNED_NEEDS_01D_09INT_FIX")
print("QR620_INDEPENDENT_SOURCE_ONLY_SYNTHETIC_QA_COMPLETED")
