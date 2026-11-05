#!/usr/bin/env python3
"""04 QR-W new-only PR620 dualSHA emitter QA using only generated toy PNG.
Never touch real DDV images or user Save. Original Source Python import stays unchanged.
"""
import argparse,gzip,hashlib,importlib.util,io,json,tempfile
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_STORED
from PIL import Image,features
ROOT=Path(__file__).resolve().parents[1]
PRODUCER=ROOT/"scripts/01d-r39-lossless-webp160.py"
spec=importlib.util.spec_from_file_location("r39_original_01d_source",PRODUCER)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
assert mod.MANIFEST_SHA=="f0ea2248bc7a91d9a8afb655bf142150798aa96fbde1fd91ae028927b4ef3aba"
assert features.check("webp"),"NOT_RUN Pillow/libwebp unavailable"
H=lambda b:hashlib.sha256(b).hexdigest()
im=Image.new("RGBA",(256,160))
for y in range(160):
 for x in range(256):
  im.putpixel((x,y),((17*x+11*y)%256,(13*x+7*y)%256,(5*x+23*y)%256,0 if (x+y)%9==0 else 255))
bio=io.BytesIO();im.save(bio,format="PNG");png=bio.getvalue()
pngsha=H(png);shard=format(int(pngsha[:2],16)>>3,"02x")
origbytes=png
def makezip():
 b=io.BytesIO()
 with ZipFile(b,"w",ZIP_STORED) as a:
  a.writestr(ZipInfo(pngsha+".png",date_time=(1980,1,1,0,0,0)),png)
 return b.getvalue()
zbytes=makezip()
manifest={"gameVersion":"1.24.13","shards":[]}
fname="synthetic-source-"+shard+".zip"
for j in range(32):
 sh=format(j,"02x")
 manifest["shards"].append({"shard":sh,"file":fname if sh==shard else "absent-"+sh+".zip",
  "bytes":len(zbytes) if sh==shard else 0,"sha256":H(zbytes) if sh==shard else "0"*64,
  "uniquePng":1 if sh==shard else 0})
rawmanifest=gzip.compress(json.dumps(manifest,sort_keys=True).encode(),mtime=0)
args=lambda man,source,out,complete=False: argparse.Namespace(manifest=man,png_dir=source,out=out,require_complete=complete)
with tempfile.TemporaryDirectory(prefix="qr620-dualsha-synthetic-") as d:
 root=Path(d);indir=root/"original";indir.mkdir()
 (indir/fname).write_bytes(zbytes)
 manifestpath=root/"manifest.json.gz";manifestpath.write_bytes(rawmanifest)
 strict=root/"no-partial"
 try:mod.main(args(manifestpath,indir,strict,True))
 except ValueError as e: assert "ALL_32_ORIGINAL_PNG_SHARDS_REQUIRED" in str(e)
 else:raise AssertionError("missing 31 original shards must fail before any output")
 assert not strict.exists()
 print("QR620_DUALSHA_STRICT_MISSING31_FAILCLOSED_PASS",flush=True)
 try:mod.main(args(manifestpath,indir,root/"wrongsource"))
 except ValueError as e:assert "R39_SOURCE_MANIFEST_SHA_MISMATCH" in str(e)
 else:raise AssertionError("original production manifest SHA must reject toy fixture")
 # Override only a mutable in-memory variable in independent QA's imported module.
 # No Source code, real original manifest or release asset is modified.
 mod.MANIFEST_SHA=H(rawmanifest)
 out=root/"partial";mod.main(args(manifestpath,indir,out))
 report=json.loads((out/"R39_lossless_SOURCE_ONLY_report.json").read_text())
 assert report["status"]=="HOLD_NOT_DEPLOY" and report["deployAllowed"] is False
 assert report["publicationManifestGenerated"] is False
 assert report["target1250VerifiedRows"]==report["target1253VerifiedRows"]==0
 assert report["processedCount"]==1 and report["completeR39Lossless"] is False
 assert len(report["missingShards"])==31
 row=report["sourceRows"][0]
 assert row["consumerPathAbi"]=="sourcePngSha256-encodedWebpSha256.webp"
 assert row["sourcePngSha256"]==pngsha
 encodedsha=row["losslessWebpSha256"]
 path="ddv/item-images/webp-lossless-160-v1/v1.24.13/"+shard+"/"+pngsha+"-"+encodedsha+".webp"
 assert row["path"]==path
 zipfile=out/("R39_webp-lossless-160-v1_shard_"+shard+".zip")
 assert zipfile.is_file()
 with ZipFile(zipfile) as zp:
  assert zp.testzip() is None
  assert zp.namelist()==[path],zp.namelist()
  actual=zp.read(path)
  assert actual[12:16]==b"VP8L","actual encoded output must be true lossless WebP"
  assert H(actual)==encodedsha
  from PIL import Image
  with Image.open(io.BytesIO(actual)) as img:
   expected=im.convert("RGBA")
   expected.thumbnail((160,160),Image.Resampling.LANCZOS)
   assert img.size==expected.size
   assert img.convert("RGBA").tobytes()==expected.tobytes()
  assert H(actual+b"tampered")!=encodedsha,"changed encoded bytes must be different digest"
 assert H((indir/fname).read_bytes())==H(zbytes)
 assert H(png)==H(origbytes)
 assert len(row["path"].split("/")[-1])==64+1+64+5
 print("QR620_DUALSHA_ACTUAL_PILLOW_VP8L_BYTES_PATH_CRC_PIXEL_SHA_MATCH_PASS",flush=True)
 print("QR620_DUALSHA_SYNTHETIC_RESULT "+json.dumps({
  "sourceSha":pngsha,"encodedSha":encodedsha,"path":path,"shard":shard,
  "variant":"webp-lossless-160-v1","reportStatus":report["status"],"sourceCount":1,
  "target1250VerifiedRows":0,"target1253VerifiedRows":0,"sourceOriginalUnmodified":True
 },sort_keys=True),flush=True)
