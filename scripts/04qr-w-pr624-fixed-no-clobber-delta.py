#!/usr/bin/env python3
"""04 QR-W new-only PR624 fixed report destination no-clobber QA.
All PNGs here are self-generated disposal fixtures, never original game art.
"""
import hashlib,io,json,subprocess,tempfile
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OLD="7bb0cb181d7de012289c61dfb12eaa7751c22c98"
FIX="385d5695a95203dc4ce2d5ff3d63d17c3ada25d8"
SRC=[
 "docs/core/01d-steam-switch-10pair-source-ledger-20261105.json",
 "docs/core/01d-steam-switch-ten-original-image-quality-study-20261105.md",
 "scripts/asset-research/steam-switch-10pair-offline.py",
 "tests/01d-steam-switch-10pair-quality-offline.test.mjs",
]
CHANGED=["scripts/asset-research/steam-switch-10pair-offline.py",
         "tests/01d-steam-switch-10pair-quality-offline.test.mjs"]
QA=["scripts/04qr-w-pr624-fixed-no-clobber-delta.py",
    ".github/workflows/04qr-w-pr624-fixed-no-clobber-delta.yml"]
BLOBS={
 "scripts/asset-research/steam-switch-10pair-offline.py":"c8769afdb9c008c3aafe5f695ad54da2d820ab1e",
 "tests/01d-steam-switch-10pair-quality-offline.test.mjs":"6e3c95c023b76e934db90aba3cbd67328bafa909",
 "docs/core/01d-steam-switch-10pair-source-ledger-20261105.json":"36eef43b8037433f4a68f48881be8a505b7ddd4a",
 "docs/core/01d-steam-switch-ten-original-image-quality-study-20261105.md":"fc160c4617c299f4fd18cb4f00a6254e2c2b45a4",
}
def git(*args):
 return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
assert git("merge-base",OLD,FIX)==OLD
assert git("merge-base",FIX,"HEAD")==FIX
assert sorted(git("diff","--name-only","decd251df76c094da1fabdc691ccfbd90c4ea2ea",FIX).splitlines())==sorted(SRC)
assert sorted(git("diff","--name-only",OLD,FIX).splitlines())==sorted(CHANGED)
assert sorted(git("diff","--name-only",FIX,"HEAD").splitlines())==sorted(QA)
for f,s in BLOBS.items():assert git("rev-parse",FIX+":"+f)==s,f
print("QR624_FIXED_SOURCE4_DELTA2_QA2_SOURCE_BLOBS_PASS",flush=True)

P=ROOT/"scripts/asset-research/steam-switch-10pair-offline.py"
LEDGER=json.loads((ROOT/"docs/core/01d-steam-switch-10pair-source-ledger-20261105.json").read_text())
assert LEDGER["status"]=="INSUFFICIENT_EVIDENCE"
assert len(LEDGER["pairs"])==10
assert all(x["matchStatus"]!="SOURCE_PROVENANCE_CONFIRMED" for x in LEDGER["pairs"])
H=lambda b:hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory(prefix="qr624-no-clobber-only-") as directory:
 root=Path(directory)
 src=root/"originals";src.mkdir()
 manifest=root/"10slot.json";manifest.write_text(json.dumps(LEDGER))
 im=Image.new("RGBA",(12,12),(79,181,20,0))
 for x in range(12):im.putpixel((x,(5*x)%12),(20,36,240,255))
 f=io.BytesIO();im.save(f,format="PNG")
 raw=f.getvalue()
 sw=src/"switch-original.png";st=src/"steam-original.png"
 sw.write_bytes(raw);st.write_bytes(raw+b"synthetic-variant-trailer")
 other=root/"unrelated.txt";other.write_bytes(b"irrelevant private-local original placeholder")
 backup=root/"prior-report.json";backup.write_bytes(b"PRIOR_SYNTHETIC_REPORT_DO_NOT_OVERWRITE")
 alias=root/"alias-switch.png";alias.symlink_to(sw)
 dangling=root/"dangling-link";dangling.symlink_to(root/"absent-original.png")
 existingdir=root/"existing-report-dir";existingdir.mkdir()
 targets=[manifest,sw,st,other,backup,alias,dangling,existingdir]
 original={str(p):p.read_bytes() for p in [manifest,sw,st,other,backup]}
 script=[ "python3",str(P),"--manifest",str(manifest),"--source-root",str(src),"--report" ]
 def run(target):
  return subprocess.run(script+[str(target)],cwd=ROOT,text=True,capture_output=True,timeout=20)
 for target in targets:
  z=run(target)
  assert z.returncode!=0,(target,z.stdout,z.stderr)
  assert "REPORT_OUTPUT_EXISTS_NO_CLOBBER" in z.stderr,(target,z.stderr)
  for p in [manifest,sw,st,other,backup]:
   assert p.read_bytes()==original[str(p)],(target,p,"original mutated")
  assert alias.is_symlink() and dangling.is_symlink()
  assert not (root/"absent-original.png").exists()
  assert existingdir.is_dir()
 print("QR624_REPORT_MANIFEST_SWITCH_STEAM_EXISTING_UNRELATED_SYMLINK_DANGLING_DIR_NO_CLOBBER_PASS",flush=True)

 fresh=root/"new-report.json"
 assert not fresh.exists()
 z=run(fresh)
 assert z.returncode==2,(z.stdout,z.stderr)
 result=json.loads(fresh.read_text())
 assert result["status"]=="INSUFFICIENT_EVIDENCE"
 assert result["measuredPairs"]==0
 assert result["requiredPairs"]==10
 assert result["productMigrationAuthority"] is False
 assert result["qualityVerdict"]=="NOT_ASSIGNED_BY_SCRIPT"
 once=fresh.read_bytes()
 repeat=run(fresh)
 assert repeat.returncode!=0 and "REPORT_OUTPUT_EXISTS_NO_CLOBBER" in repeat.stderr
 assert fresh.read_bytes()==once
 for p in [manifest,sw,st,other,backup]:
  assert p.read_bytes()==original[str(p)]
 print("QR624_FRESH_EXCLUSIVE_REPORT_ONCE_INCOMPLETE10_NO_MIGRATION_RETRY_DENY_PASS",flush=True)

 # Race: even if both workers check .exists() before either creates a file,
 # the final open('x') must permit no more than one writer to succeed.
 concurrent=root/"concurrent-report.json"
 cmds=script+[str(concurrent)]
 a=subprocess.Popen(cmds,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 b=subprocess.Popen(cmds,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 out_a,err_a=a.communicate(timeout=20)
 out_b,err_b=b.communicate(timeout=20)
 assert sorted([a.returncode,b.returncode])==[1,2],(
  a.returncode,b.returncode,out_a,err_a,out_b,err_b)
 assert json.loads(concurrent.read_text())["measuredPairs"]==0
 for p in [manifest,sw,st,other,backup]:
  assert p.read_bytes()==original[str(p)]
 print("QR624_CONCURRENT_EXCLUSIVE_CREATE_ONE_WINNER_ORIGINAL_SHA_UNCHANGED_PASS",flush=True)

print("QR624_FIXED_HEAD_PRIVATE_ORIGINAL_REPORT_NOCLOBBER_INDEPENDENT_PASS",flush=True)
