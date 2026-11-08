#!/usr/bin/env python3
"""Independent 04 QR-W / PR787 NEW_ONLY. Synthetic temp bytes only; no private assets."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile

SOURCE = "e67d0b809b036a03b560f9e6c92e4a4824ae01d0"
PARENT = "b7d86d47125f1764919b67898c39badaf35976d8"
ORIGINAL = {
 "docs/core/01d-r14-steam1253-private-native-image-pilot-20261108.md": "e09fd506cefa704f5c200bc517cfb119b9db33f4",
 "scripts/asset-research/01d-steam1253-private-native-image-pilot.py": "b77311c59b581ece190848db4bf54975aaac8898",
 "tests/01d-steam1253-private-native-image-pilot.test.mjs": "59737c561281a2398ed094f16004f7da9b8d1f88"
}
QA = {
 ".github/workflows/04qr-w-pr787-steam-native-hold-newonly-20261109.yml",
 "scripts/04qr-w-pr787-steam-native-hold-newonly-20261109.py"
}
def git(*args):
 return subprocess.check_output(["git",*args],text=True).strip()
def difference(before,after):
 return set(x for x in git("diff","--name-only",before,after).splitlines() if x)
assert git("merge-base",PARENT,SOURCE)==PARENT
assert difference(PARENT,SOURCE)==set(ORIGINAL), "Source must be exactly original three"
assert git("merge-base",SOURCE,"HEAD")==SOURCE
assert difference(SOURCE,"HEAD")==QA, "QA must add exactly two audit-only paths"
for path,sha in ORIGINAL.items():
 assert git("rev-parse",SOURCE+":"+path)==sha
 assert git("hash-object",path)==sha
assert git("diff","--name-only",PARENT,SOURCE,"--","src/","static/","supabase/",".github/workflows/pages.yml")==""
print("QRW787_FROZEN_ORIGINAL_SOURCE3_QA_ONLY2_NO_PUBLIC_IMAGE_DIFF_PASS",flush=True)

source = Path("scripts/asset-research/01d-steam1253-private-native-image-pilot.py")
spec=importlib.util.spec_from_file_location("qrw787_private",source)
assert spec is not None and spec.loader is not None
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
assert m.OPERATION=="DEV_READY_SOURCE_ONLY"
assert m.SCHEMA=="wand.01d.steam1253-native-image-sample-hold@1"
assert m.VERSION.startswith("releases_1.25-v1.25.3-")
assert len(m.ITEMS)==3
assert m.self_test()["realMediaBytesInCI"] is False
assert m.self_test()["publicImageRows"]==0
print("QRW787_STEAM1253_PRIVATE_3_ITEM_PINNED_BUILD_RELEASE_HOLD_PASS",flush=True)

def deny(label,fn,code=None):
 try:fn()
 except Exception as e:
  if code is not None:
   assert code in str(e),label+" wrong reject cause "+repr(e)
 else:raise AssertionError("FALSE_ALLOW "+label)

for values in [[],["40000047","40000047"],["40000047"]*4,
               ["40000048"],["__proto__"],["040000047"],["0"],["40006096","40006096"]]:
 deny("UNVERIFIED_ITEM_"+str(values),lambda v=values:m.check_sample_ids(v))
with tempfile.TemporaryDirectory(prefix="qrw787_synthetic_only_") as temp:
 d=Path(temp)
 exact=d/"temp-synthetic-15bytes.bin"
 exact.write_bytes(b"test safe bytes")
 sha=hashlib.sha256(b"test safe bytes").hexdigest()
 assert m.exact_sha(exact,(sha,15)) is None
 deny("FORGED_SHA",lambda:m.exact_sha(exact,("f"*64,15)),"ORIGINAL_SHA_OR_MUTATION_MISMATCH")
 deny("FORGED_SIZE",lambda:m.exact_sha(exact,(sha,14)),"ORIGINAL_TYPE_OR_SIZE_OR_ALIAS")
 link=d/"symlink-input"
 link.symlink_to(exact)
 deny("SYMLINK_AS_INPUT",lambda:m.exact_sha(link,(sha,15)),"ORIGINAL_MISSING_OR_SYMLINK")
 destination=d/"private-output.bin"
 m.save_exclusive(destination,b"SYNTHETIC_ONLY")
 assert destination.read_bytes()==b"SYNTHETIC_ONLY"
 assert destination.stat().st_mode & 0o777 == 0o600
 deny("EXISTING_OUTPUT_NO_CLOBBER",lambda:m.save_exclusive(destination,b"CLobber"))
 assert destination.read_bytes()==b"SYNTHETIC_ONLY"
 print("QRW787_SYNTHETIC_ORIGINAL_SHA_SIZE_SYMLINK_OUTPUT_EXCL_NO_CLOBBER_PASS",flush=True)
 # Explicit contract: output is a separate private directory, not the
 # same directory as input, or an ancestor/descendant of an original input.
 root=d/"steam-original"
 catalog=d/"steam-catalog"
 root.mkdir();catalog.mkdir()
 bundle=d/"furniture-original.bundle"
 bundle.write_bytes(b"dummy no owner material")
 base=argparse.Namespace(source_root=root,catalog_root=catalog,bundle=bundle,
                         private_output=d,item_id=["40000047"])
 deny("OUTPUT_IS_INPUT_ANCESTOR",lambda:m.run(base),"PRIVATE_OUTPUT_MUST_BE_SEPARATE")
 base.private_output=root
 deny("OUTPUT_IS_INPUT_FOLDER",lambda:m.run(base),"PRIVATE_OUTPUT_MUST_BE_SEPARATE")
 nested=root/"derived";nested.mkdir()
 base.private_output=nested
 deny("OUTPUT_NESTED_UNDER_INPUT",lambda:m.run(base),"PRIVATE_OUTPUT_MUST_BE_SEPARATE")
 print("QRW787_INDEPENDENT_OUTPUT_ANCESTOR_AND_NESTED_SOURCE_SEPARATION_PASS",flush=True)

src=source.read_text()
assert '"publicImagesEnabled": False' in src
assert '"canPublish": False' in src
assert '"canWriteSave": False' in src
assert '"cloudUploadAllowed": False' in src
assert '"license": "UNKNOWN"' in src
assert '"switch1253OriginalPngSha256": None' in src
assert '"originalSteamPngSha256": None' in src
assert "historicalR39LossyWebpNotReused" in src
assert "static/ddv/item-images/webp-lossless-160-v1/manifest.json" not in src
print("QRW787_PRIVATE_STEAM_SOURCE_ONLY_PUBLIC_PROJECTION_OFF_DEVICE_NOT_RUN_PASS",flush=True)
print("QRW787_INDEPENDENT_CHANGED_ONLY_SOURCE_SCOPED_PASS_PENDING_NORMAL_CI",flush=True)
