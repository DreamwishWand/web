#!/usr/bin/env python3
"""04 QR-W independent new-only synthetic-original Switch-vs-Steam ten-pair QA.
The intentionally destructive-input negative is run ONLY on disposable self-made
PNG files in a TemporaryDirectory; never on original DDV media/Save.
"""
import hashlib
import json
import subprocess
import tempfile
import copy
import io
from pathlib import Path
from PIL import Image, ImageDraw, features

ROOT=Path(__file__).resolve().parents[1]
MAIN="decd251df76c094da1fabdc691ccfbd90c4ea2ea"
SOURCE="7bb0cb181d7de012289c61dfb12eaa7751c22c98"
SRC=[
 "docs/core/01d-steam-switch-10pair-source-ledger-20261105.json",
 "docs/core/01d-steam-switch-ten-original-image-quality-study-20261105.md",
 "scripts/asset-research/steam-switch-10pair-offline.py",
 "tests/01d-steam-switch-10pair-quality-offline.test.mjs",
]
QA=[
 ".github/workflows/04qr-w-pr624-tenpair-original-nooverwrite.yml",
 "scripts/04qr-w-pr624-tenpair-original-nooverwrite.py",
]
ACCEPTED={
 "docs/core/01d-r39-real-asset-source-20261105.md":"f2c58039dea630722ca6a17513f2103060fe0745",
 "src/lib/ddv/core/items/r39-image-source-contract.mjs":"6ba8e08899e90ec674ecd4f9902bb214a51076c5",
 "tests/01d-r39-item-media-source-contract.test.mjs":"afdd044909d2eb6da076850ff73335f1a66ee555",
}
BLOBS={
 "docs/core/01d-steam-switch-10pair-source-ledger-20261105.json":"36eef43b8037433f4a68f48881be8a505b7ddd4a",
 "docs/core/01d-steam-switch-ten-original-image-quality-study-20261105.md":"fc160c4617c299f4fd18cb4f00a6254e2c2b45a4",
 "scripts/asset-research/steam-switch-10pair-offline.py":"5edfaf3363ed4223c5eaa655cf340e0196653bdd",
 "tests/01d-steam-switch-10pair-quality-offline.test.mjs":"64e814781a02d4aef6fc1fda6e62097562358b76",
}
def git(*args):
 return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
assert git("merge-base",MAIN,SOURCE)==MAIN, "original Owner Source must descend from protected parent"
assert git("merge-base",SOURCE,"HEAD")==SOURCE, "QA only on frozen exact Source"
assert sorted(git("diff","--name-only",MAIN,SOURCE).splitlines())==sorted(SRC), "original Source4 invariant"
current=git("diff","--name-only",SOURCE,"HEAD").splitlines()
for p in current:
 if p in ACCEPTED:
  assert git("rev-parse","HEAD:"+p)==ACCEPTED[p],p
assert sorted(p for p in current if p not in ACCEPTED)==sorted(QA), "QA2 plus immutably accepted main01D3"
for p,blob in BLOBS.items():
 assert git("rev-parse",SOURCE+":"+p)==blob, "do not change original research Source:"+p
print("QR624_SOURCE4_QA2_IMMUTABLE_GIT_BLOBS_PASS",flush=True)

assert features.check("webp"),"NOT_RUN: genuine Pillow/libwebp needed"
source_script=ROOT/"scripts/asset-research/steam-switch-10pair-offline.py"
ledger=json.loads((ROOT/"docs/core/01d-steam-switch-10pair-source-ledger-20261105.json").read_text())
assert ledger["status"]=="INSUFFICIENT_EVIDENCE"
assert ledger["sourceOnly"] is True and ledger["ownerVisualABRequired"] is False
assert len(ledger["pairs"])==10
assert [r["slot"] for r in ledger["pairs"]]==list(range(1,11))
assert all(x["matchStatus"]!="SOURCE_PROVENANCE_CONFIRMED" for x in ledger["pairs"])
print("QR624_SOURCE_LEDGER_10_SLOTS_0_REAL_PAIRS_NO_SUPERIORITY_PASS",flush=True)
sha=lambda b: hashlib.sha256(b).hexdigest()
def toy_png(size,color):
 im=Image.new("RGBA",(size,size),(color[0],color[1],color[2],0))
 d=ImageDraw.Draw(im)
 d.ellipse((size//7,size//7,size-size//7,size-size//7),fill=(color[0],color[1],color[2],189),outline=(255,255,255,255),width=3)
 out=io.BytesIO()
 im.save(out,format="PNG")
 return out.getvalue()

with tempfile.TemporaryDirectory(prefix="qr624-only-selfmade-") as d:
 root=Path(d)
 switch=root/"switch-original.png"
 steam=root/"steam-original.png"
 sw=toy_png(384,(85,90,20));st=toy_png(512,(85,95,22))
 switch.write_bytes(sw);steam.write_bytes(st)
 swsha=sha(sw);stsha=sha(st)
 guid="guid:"+"c"*32
 def side(platform,name,image_sha,definition_sha):
  data={
   "platform":platform,"gameVersion":"1.24.13","itemId":"30800076",
   "iconReference":guid,"itemDefinitionSourceSha256":definition_sha,
   "pngSha256":image_sha,"path":name
  }
  if platform=="Steam/Windows":
   data["fullVersion"]="releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33"
  return data
 data=copy.deepcopy(ledger)
 data["pairs"][0]={
  "slot":1,"itemId":"30800076","category":"QA_FAKE_FLOWER","gameVersion":"1.24.13",
  "matchStatus":"SOURCE_PROVENANCE_CONFIRMED",
  "switch":side("Nintendo Switch",switch.name,swsha,"1"*64),
  "steam":side("Steam/Windows",steam.name,stsha,"2"*64)
 }
 manifest=root/"manifest.json"
 def run(doc,destination):
  manifest.write_text(json.dumps(doc))
  return subprocess.run(["python3",str(source_script),"--manifest",str(manifest),"--source-root",str(root),
                         "--report",str(destination)],capture_output=True,text=True,cwd=ROOT)
 positive=run(data,root/"report.json")
 assert positive.returncode==2,(positive.returncode,positive.stderr,positive.stdout)
 report=json.loads((root/"report.json").read_text())
 assert report["status"]=="INSUFFICIENT_EVIDENCE" and report["measuredPairs"]==1
 assert report["requiredPairs"]==10 and report["qualityVerdict"]=="NOT_ASSIGNED_BY_SCRIPT"
 assert report["productMigrationAuthority"] is False
 assert report["qualityDecisionRequired"]=="MISSING_ACTUAL_PAIRED_ORIGINALS"
 row=report["measurements"][0]
 assert row["status"]=="MEASURED_SOURCE_ONLY"
 assert row["switch"]["size"]==[384,384] and row["steam"]["size"]==[512,512]
 assert row["comparison160"]["status"]=="MEASURED_SOURCE_ONLY"
 assert row["comparison320"]["status"]=="MEASURED_SOURCE_ONLY"
 assert len(row["comparison160"]["switchWebpSha256"])==64
 assert len(row["comparison320"]["steamWebpSha256"])==64
 assert sha(switch.read_bytes())==swsha and sha(steam.read_bytes())==stsha
 print("QR624_SYNTHETIC_TWO_ORIGINAL_PNG_FULL_RGBA_WEBP160_320_MEASURED1_OF10_NO_MIGRATION_PASS",flush=True)

 bad=copy.deepcopy(data);bad["pairs"][0]["steam"]["iconReference"]="guid:"+"d"*32
 g=run(bad,root/"guid-bad.json")
 assert g.returncode==2 and json.loads((root/"guid-bad.json").read_text())["measuredPairs"]==0
 bad=copy.deepcopy(data);bad["pairs"][0]["steam"]["itemId"]="30800077"
 g=run(bad,root/"item-bad.json")
 assert g.returncode==2 and json.loads((root/"item-bad.json").read_text())["measuredPairs"]==0
 bad=copy.deepcopy(data);bad["pairs"][0]["switch"]["pngSha256"]="f"*64
 g=run(bad,root/"sha-bad.json")
 assert g.returncode==2 and json.loads((root/"sha-bad.json").read_text())["measuredPairs"]==0
 bad=copy.deepcopy(data);bad["pairs"][0]["steam"]["path"]="../outside-private.png"
 g=run(bad,root/"path-bad.json")
 assert g.returncode==2 and json.loads((root/"path-bad.json").read_text())["measuredPairs"]==0
 bad=copy.deepcopy(data);bad["pairs"][1]["itemId"]="30800076"
 g=run(bad,root/"duplicate.json")
 assert g.returncode!=0 and "DUPLICATE_OR_NONCANONICAL_ITEM_ID" in g.stderr
 assert sha(switch.read_bytes())==swsha and sha(steam.read_bytes())==stsha
 print("QR624_GUID_ITEM_SHA_PATH_DUPLICATE_FAILCLOSED_0_VERIFIED_PASS",flush=True)

 # P0 original preservation: NEVER allow --report to overwrite any ORIGINAL
 # input PNG, even if the report manifest itself is a distinct file.
 # All bytes below are self-authored disposable image data. This negative is
 # deliberately expected to FAIL on broken Source; a final PASS requires the
 # script to reject the alias BEFORE replacing bytes.
 before=sha(switch.read_bytes())
 collision=run(data,switch)
 after=sha(switch.read_bytes())
 assert after==before, (
  "QR624_TRUE_SOURCE_RED_ORIGINAL_PNG_DESTROYED_BY_REPORT_PATH_ALIAS "
  "report=sourceRoot/switch-original.png, original SHA changed; "+
  "returncode="+str(collision.returncode)+" stdout="+collision.stdout[:400])
 assert collision.returncode != 0, "report-to-existing-original should fail closed"
 assert not switch.read_bytes().startswith(b"{"), "original PNG overwritten with JSON"
 print("QR624_REPORT_PATH_CANNOT_CLOBBER_PRIVATE_ORIGINAL_PNG_PASS",flush=True)

print("QR624_INDEPENDENT_SYNTHETIC_QA_COMPLETED",flush=True)
