#!/usr/bin/env python3
"""04 QR-W new-only PR650 original-Steam bundle identity trust-boundary QA.
Synthetic bytes only, no original proprietary UnityFS, art, P1G or Save.
"""
from __future__ import annotations
import hashlib,importlib.util,json,pathlib,subprocess,sys,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
OWNER=ROOT/"scripts/asset-research/01d-steam-bundle-byte-identity.py"
PARENT="1847a3b1c4f3c65151e64e9e6405c3b5c272a361"
SOURCE="951dfce0c3b753585c6f82709059c09180079544"
SOURCE_BLOBS={
 "docs/core/01d-steam-v1253-generated-icon-bundle-sha-20261106.md":"2d2a0fe7d672dc3d5a32c430b62f0f380f23278d",
 "scripts/asset-research/01d-steam-bundle-byte-identity.py":"6abfdde423cdc9b3ffa57504db19d7dd7192f788",
 "tests/01d-steam-bundle-byte-identity.test.mjs":"7d606ffa3838eb4091d595cf00b88b8de7f0fb17",
 "tests/01d-steam-bundle-byte-identity.test.py":"96ebab86bf2d2d4536c1feb7236a914bc49d920a",
}
QA=[
 ".github/workflows/04qr-w-pr650-original-steam-bundle-negative.yml",
 "scripts/04qr-w-pr650-original-steam-bundle-negative.py"
]
def git(*args):
 return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
assert git("merge-base",PARENT,SOURCE)==PARENT
assert git("merge-base",SOURCE,"HEAD")==SOURCE
assert sorted(git("diff","--name-only",PARENT,SOURCE).splitlines())==sorted(SOURCE_BLOBS)
assert sorted(git("diff","--name-only",SOURCE,"HEAD").splitlines())==sorted(QA)
for p,blob in SOURCE_BLOBS.items(): assert git("rev-parse",SOURCE+":"+p)==blob,p
print("QR650_ORIGINAL_SOURCE4_QA2_SHA_PINNED_PARENT1847_PASS",flush=True)

spec=importlib.util.spec_from_file_location("steam_source",OWNER)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
assert mod.SCHEMA=="wand.01d.steam-bundle-identity-source-only@1"
assert mod.VERSIONS==("v1250","v1253")
expected={
 "flower_584a9f69.bundle":("e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770",3784859),
 "seed_8c733f88.bundle":("3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f",6372358),
 "meal_7a31d699.bundle":("9770b0d4980da18332bf1870f7fdb0969cc88046d769e25316b0663cdf47ccf5",24835033)
}
assert mod.BUNDLE_PINS==expected
assert sum(n for _,n in expected.values())==34992250
print("QR650_ORIGINAL_THREE_STEAM_UNITYFS_BUNDLE_SHA_SIZE_METADATA_PIN_PASS",flush=True)

def sha(b):return hashlib.sha256(b).hexdigest()
def toy(n):return (b"SYNTHETIC_ONLY_UnityFS_like_QA_"+n.encode())*3
def expect(substr,fn):
 try:fn()
 except ValueError as e:
  assert substr in str(e),(substr,str(e));return
 raise AssertionError("expected deny: "+substr)
with tempfile.TemporaryDirectory(prefix="qr650-original-identity-synthetic-") as d:
 home=pathlib.Path(d);root=home/"source";root.mkdir()
 fixture_pins={}
 originals={}
 for ver in mod.VERSIONS:
  sub=root/ver;sub.mkdir()
  for filename in expected:
   fake=toy(filename)
   path=sub/filename
   path.write_bytes(fake)
   originals[path]=sha(fake)
   fixture_pins[filename]=(sha(fake),len(fake))
 positive=mod.analyze(root,fixture_pins,synthetic=True)
 assert positive["tier"]=="SYNTHETIC_ONLY"
 assert positive["sourcePlatform"]=="Steam/Windows"
 assert positive["fullVersions"]=={
  "v1250":"releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14",
  "v1253":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22"
 }
 assert positive["comparedBundles"]==positive["identicalBundles"]==3
 assert all(x["reuseSourceBundleCandidate"] for x in positive["bundles"])
 for flag in ("publishAllowed","nativeSaveWriterAllowed","allOtherBundlesChecked","itemIdToTextureAddressVerified"):
  assert positive[flag] is False
 assert positive["sourceBytesEqualImpliesSameBundlePayloadOnly"] is True
 assert positive["switchSameBuildOriginalPngShaVerified"]==0
 print("QR650_SYNTHETIC_EQUAL_THREE_PAIRS_REPORT_PUBLICATION_OFF_PASS",flush=True)
 # Same-size changes MUST NOT count as byte equality.
 changed=root/"v1253"/"flower_584a9f69.bundle"
 raw=changed.read_bytes()
 changed.write_bytes(raw[:-1]+(b"X" if raw[-1:]!=b"X" else b"Y"))
 assert changed.stat().st_size==len(raw)
 unequal=mod.analyze(root,fixture_pins,synthetic=True)
 assert unequal["comparedBundles"]==3 and unequal["identicalBundles"]==2
 assert next(x for x in unequal["bundles"] if x["bundleName"]=="flower_584a9f69.bundle")["reuseSourceBundleCandidate"] is False
 expect("ORIGINAL_BUNDLE_PIN_MISMATCH",lambda:mod.analyze(root,synthetic=False))
 changed.write_bytes(raw)
 print("QR650_SAME_SIZE_CHANGED_BYTES_NOT_IDENTICAL_OR_REUSABLE_PASS",flush=True)
 # Hiding data outside allowlist must not be treated as 40/40 checked.
 assert len(expected)==3
 assert not positive["allOtherBundlesChecked"]
 assert not positive["itemIdToTextureAddressVerified"]
 assert not positive["publishAllowed"]
 assert not positive["nativeSaveWriterAllowed"]
 print("QR650_THIRTYSEVEN_OTHER_BUNDLES_SWITCH_PNG_NOT_VERIFIED_PASS",flush=True)
 # Unsafe filename or missing/symlink are denied rather than reading outside root.
 for pins in ({},{"../other.bundle":("0"*64,1)},{"extra.txt":("0"*64,1)},
              {"dir\\evil.bundle":("0"*64,1)}):
  expect("UNSAFE_BUNDLE_FILENAME" if pins else "INVALID_PIN_COUNT",
         lambda pins=pins:mod.analyze(root,pins,synthetic=True))
 src=root/"v1250"/"seed_8c733f88.bundle"
 raw=src.read_bytes()
 src.unlink()
 expect("MISSING_OR_SYMLINK_ORIGINAL_BUNDLE",lambda:mod.analyze(root,fixture_pins,synthetic=True))
 src.symlink_to(root/"v1253"/src.name)
 expect("BUNDLE_ROOT_OR_SYMLINK_INVALID",lambda:mod.analyze(root,fixture_pins,synthetic=True))
 src.unlink();src.write_bytes(raw)
 print("QR650_MISSING_SYMLINK_UNSAFE_BUNDLE_PATH_FAILCLOSED_PASS",flush=True)
 def cli(report):
  return subprocess.run([sys.executable,str(OWNER),"--root",str(root),"--report",str(report)],text=True,capture_output=True,timeout=30)
 target=root/"v1250"/"flower_584a9f69.bundle"
 original=target.read_bytes()
 outside=home/"unrelated.json";outside.write_bytes(b"existing-original-not-to-clobber")
 link=home/"symlink-report.json";link.symlink_to(target)
 dangling=home/"dangling-report";dangling.symlink_to(home/"nonexistent.txt")
 for path in (target,outside,link,dangling,root/"private-report.json"):
  res=cli(path)
  assert res.returncode!=0,(path,res.stdout)
  assert "OUTPUT_PATH_MUST_BE_NEW_OUTSIDE_ORIGINALS" in res.stderr,(path,res.stderr)
 assert target.read_bytes()==original
 assert outside.read_bytes()==b"existing-original-not-to-clobber"
 assert not (root/"private-report.json").exists() and link.is_symlink() and dangling.is_symlink()
 fresh=home/"fresh-report.json"
 res=cli(fresh)
 assert res.returncode!=0 and "ORIGINAL_BUNDLE_PIN_MISMATCH" in res.stderr
 assert not fresh.exists(),"invalid synthetic fake data cannot produce REAL_SOURCE report through CLI"
 assert all(sha(p.read_bytes())==digest for p,digest in originals.items())
 print("QR650_CLI_FALSE_ORIGINAL_REPORT_PIN_OUTPUT_ALIAS_NO_MUTATION_PASS",flush=True)
 # Critical negative: arbitrary caller-provided toy test pins must not promote a
 # synthetic fixture to REAL_STEAM_ORIGINAL_BUNDLE_BYTES_SOURCE_ONLY.
 # The Source API exposes 'pins' publicly, but trust root should be immutable
 # in real mode (only allow pin substitution when synthetic=True).
 try:
  forged=mod.analyze(root,fixture_pins,synthetic=False)
 except ValueError as e:
  print("QR650_FORGED_REAL_MODE_PIN_OVERRIDE_DENIED "+str(e),flush=True)
 else:
  assert forged["tier"]!="REAL_STEAM_ORIGINAL_BUNDLE_BYTES_SOURCE_ONLY", (
   "QR650_TRUE_SOURCE_RED_FORGED_CUSTOM_PINS_MINT_REAL_STEAM_SOURCE_EVIDENCE "
   "synthetic first-party fake bytes with attacker-supplied matching pins "
   "were accepted as REAL_STEAM_ORIGINAL_BUNDLE_BYTES_SOURCE_ONLY. "
   "CLI remains SHA-pinned but importable source analyze() caller is not. "
   "Scope evidence confidence only, publishAllowed remains false."
  )
 print("QR650_REAL_SOURCE_TRUST_ROOT_NOT_OVERRIDEABLE_BY_SYNTHETIC_PINS_PASS",flush=True)
print("QR650_INDEPENDENT_FIXED_SOURCE_SAFETY_COMPLETED",flush=True)
