#!/usr/bin/env python3
"""04 QR-W: independent repaired PR787 private filesystem boundary QA.
Only synthetic bytes and ephemeral directories; no owner media/Save or provider.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

SOURCE = "2744cc61781c72908db338309d034750370bbc37"
OLD = "e67d0b809b036a03b560f9e6c92e4a4824ae01d0"
ORIGINAL_BASE = "b7d86d47125f1764919b67898c39badaf35976d8"
SOURCE_BLOBS = {
 "docs/core/01d-r14-steam1253-private-native-image-pilot-20261108.md": "e09fd506cefa704f5c200bc517cfb119b9db33f4",
 "scripts/asset-research/01d-steam1253-private-native-image-pilot.py": "d8c0ba5ec08cd8a386bd2109f2a3cc0099b42e9e",
 "tests/01d-steam1253-private-native-image-pilot.test.mjs": "c1b847558141f6214be7b1bb5cd6c822a456061c",
}
REPAIR = {
 "scripts/asset-research/01d-steam1253-private-native-image-pilot.py",
 "tests/01d-steam1253-private-native-image-pilot.test.mjs",
}
QA = {
 ".github/workflows/04qr-w-pr787-private-boundary-repair-20261109.yml",
 "scripts/04qr-w-pr787-private-boundary-repair-20261109.py",
}

def git(*args):
 return subprocess.check_output(["git",*args],text=True).strip()
def changed(a,b):
 return {s for s in git("diff","--name-only",a,b).splitlines() if s}
assert git("merge-base",ORIGINAL_BASE,OLD)==ORIGINAL_BASE
assert git("merge-base",OLD,SOURCE)==OLD
assert changed(OLD,SOURCE)==REPAIR, "Source correction must be two existing original files only"
assert changed(ORIGINAL_BASE,SOURCE)==set(SOURCE_BLOBS), "Source original three-file frozen scope"
assert git("merge-base",SOURCE,"HEAD")==SOURCE
assert changed(SOURCE,"HEAD")==QA, "QA-only two audit files"
for file,sha in SOURCE_BLOBS.items():
 assert git("rev-parse",SOURCE+":"+file)==sha, (file,"Source Blob SHA")
 assert git("hash-object",file)==sha, (file,"QA changed Source content")
assert git("diff","--name-only",ORIGINAL_BASE,SOURCE,"--","src/","static/","supabase/",".github/workflows/pages.yml")==""
print("QRW787_FIXED_SOURCE3_REPAIR_ONLY2_IMMUTABLE_QA_ONLY2_PASS",flush=True)

module_file=Path("scripts/asset-research/01d-steam1253-private-native-image-pilot.py")
spec=importlib.util.spec_from_file_location("qaw787_repair_module",module_file)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
assert m.OPERATION=="DEV_READY_SOURCE_ONLY"
assert m.self_test()["realMediaBytesInCI"] is False
assert m.self_test()["publicImageRows"]==0

def check_failure(label,fn,code):
 try: fn()
 except Exception as exc:
  assert code in str(exc),(label,"unexpected rejection cause",repr(exc))
 else: raise AssertionError("FAILED_TO_REJECT: "+label)

def digest(p):
 return hashlib.sha256(p.read_bytes()).hexdigest()
def args(src,cat,bun,out):
 return argparse.Namespace(source_root=src,catalog_root=cat,bundle=bun,private_output=out,item_id=["40000047"])

with tempfile.TemporaryDirectory(prefix="qrw787_repair_synthetic_") as t:
 root=Path(t)
 source=root/"original-steam";catalog=root/"original-catalog"
 bundle_folder=root/"original-bundle";target=root/"private-output"
 for p in (source,catalog,bundle_folder,target):p.mkdir()
 bundle=bundle_folder/"furniture_a1c425a5.bundle"
 fake=[source/"Furniture.json",source/"FullVersion.txt",catalog/"catalog.keyData.bin",bundle]
 for i,f in enumerate(fake):f.write_bytes(("fake synthetic no private original "+str(i)).encode())
 baseline={str(x):digest(x) for x in fake}
 # Positive: completely disjoint output passes path fence, but fake source
 # is denied by exact real original pins BEFORE any output is produced.
 actual=m.private_path_preflight(source,catalog,bundle,target)
 assert actual==(source.resolve(),catalog.resolve(),bundle.resolve(),target.resolve())
 positive=m.run
 check_failure("DISJOINT_OUTPUT_DOES_NOT_MEAN_GENUINE_SHA",
               lambda:positive(args(source,catalog,bundle,target)),"ORIGINAL_TYPE_OR_SIZE_OR_ALIAS")
 assert list(target.iterdir())==[],"no derivative from fabricated original"
 print("QRW787_SEPARATE_OUTPUT_PATH_ACCEPTED_BUT_UNPINNED_SOURCE_DENIED_PASS",flush=True)

 # Repaired boundary check must reject *before* any private original SHA read:
 # poison exact_sha and ensure none of these cases reaches the content reader.
 reads=[]
 def forbidden_reader(*a,**kw):
  reads.append(tuple(map(str,a)))
  raise AssertionError("ORIGINAL_CONTENT_WAS_READ_BEFORE_PRIVATE_FENCE")
 scenarios=[
  ("ALL_INPUT_PARENT",root,source,catalog,bundle),
  ("SOURCE_EQUAL",source,source,catalog,bundle),
  ("CATALOG_EQUAL",catalog,source,catalog,bundle),
  ("BUNDLE_PARENT_EQUAL",bundle_folder,source,catalog,bundle),
 ]
 for label,parent in (("SOURCE_NESTED",source),("CATALOG_NESTED",catalog),
                      ("BUNDLE_PARENT_NESTED",bundle_folder)):
  inner=parent/"private-nested";inner.mkdir()
  scenarios.append((label,inner,source,catalog,bundle))
 s_parent=root/"source-only-parent";s_parent.mkdir()
 s_child=s_parent/"steam-input";s_child.mkdir()
 scenarios.append(("SOURCE_INPUT_CHILD_OF_OUTPUT",s_parent,s_child,catalog,bundle))
 c_parent=root/"catalog-only-parent";c_parent.mkdir()
 c_child=c_parent/"catalog-input";c_child.mkdir()
 scenarios.append(("CATALOG_INPUT_CHILD_OF_OUTPUT",c_parent,source,c_child,bundle))
 b_parent=root/"bundle-only-parent";b_parent.mkdir()
 b_child=b_parent/"bundle-input";b_child.mkdir()
 extra_bundle=b_child/"other-original.bundle";extra_bundle.write_bytes(b"synthetic")
 scenarios.append(("BUNDLE_PARENT_CHILD_OF_OUTPUT",b_parent,source,catalog,extra_bundle))
 scenarios.append(("BUNDLE_PARENT_OF_ALL",root,source,catalog,extra_bundle))
 for label,out,s,c,b in scenarios:
  before=len(reads)
  with patch.object(m,"exact_sha",side_effect=forbidden_reader):
   check_failure(label,lambda s=s,c=c,b=b,out=out:m.run(args(s,c,b,out)),
                 "PRIVATE_OUTPUT_MUST_BE_SEPARATE")
  assert len(reads)==before,label+" attempted content read"
  for leaf in ("01d-r14-steam1253-private-native-hold.json",
               "40000047-steam1253-reconstructed.png",
               "40000047-steam1253-lossless160.webp"):
   assert not (out/leaf).exists(),(label,"wrote unexpected derivative")
 print("QRW787_BIDIRECTIONAL_EQUAL_ANCESTOR_DESCENDANT_10_FENCES_BEFORE_SOURCE_READ_PASS",flush=True)

 # Leaf and intermediate symlink/realpath aliases for input and output,
 # plus the original Unity bundle, must fail before content access.
 aliases=[]
 def link(name,dest,is_dir=True):
  p=root/name
  p.symlink_to(dest,target_is_directory=is_dir)
  return p
 aliases.append(("OUTPUT_LEAF_SYMLINK",source,catalog,bundle,link("out-leaf-link",target)))
 aliases.append(("SOURCE_LEAF_SYMLINK",link("src-leaf-link",source),catalog,bundle,target))
 aliases.append(("CATALOG_LEAF_SYMLINK",source,link("cat-leaf-link",catalog),bundle,target))
 aliases.append(("BUNDLE_FILE_SYMLINK",source,catalog,link("bundle-file-link",bundle,False),target))
 real_parent=root/"real-parent";real_parent.mkdir()
 (real_parent/"inner").mkdir()
 parent_alias=link("intermediate-parent-link",real_parent)
 aliases.append(("OUTPUT_INTERMEDIATE_SYMLINK",source,catalog,bundle,parent_alias/"inner"))
 input_real=root/"real-source-intermediate";input_real.mkdir()
 (input_real/"src").mkdir()
 source_alias=link("intermediate-source-link",input_real)
 aliases.append(("SOURCE_INTERMEDIATE_SYMLINK",source_alias/"src",catalog,bundle,target))
 cat_real=root/"real-cat-intermediate";cat_real.mkdir()
 (cat_real/"catalog").mkdir()
 cat_alias=link("intermediate-catalog-link",cat_real)
 aliases.append(("CATALOG_INTERMEDIATE_SYMLINK",source,cat_alias/"catalog",bundle,target))
 bun_real=root/"real-bundle-intermediate";bun_real.mkdir()
 (bun_real/"in").mkdir()
 (bun_real/"in"/"genuine-only-in-name.bundle").write_bytes(b"fake")
 bun_alias=link("intermediate-bundle-link",bun_real)
 aliases.append(("BUNDLE_INTERMEDIATE_SYMLINK",source,catalog,bun_alias/"in"/"genuine-only-in-name.bundle",target))
 for label,s,c,b,out in aliases:
  before=len(reads)
  with patch.object(m,"exact_sha",side_effect=forbidden_reader):
   check_failure(label,lambda s=s,c=c,b=b,out=out:m.run(args(s,c,b,out)),
                 "PRIVATE_PATH_SYMLINK_OR_ALIAS")
  assert len(reads)==before,label+" accessed original contents"
 with patch.object(m,"exact_sha",side_effect=forbidden_reader):
  check_failure("DUPLICATE_INPUT_ROOT",lambda:m.run(args(source,source,bundle,target)),
                "PRIVATE_INPUT_ROOT_DUPLICATE_OR_ALIAS")
 assert reads==[]
 print("QRW787_SYMLINK_LEAF_INTERMEDIATE_REALPATH_ALIAS_DUPLICATE_ROOT_NO_READ_PASS",flush=True)

 # O_EXCL, O_NOFOLLOW, mode 0600; reusing a target must never overwrite.
 private_file=target/"synthetic-output.bin"
 m.save_exclusive(private_file,b"QA_SYNTHETIC_FIRST")
 assert private_file.read_bytes()==b"QA_SYNTHETIC_FIRST"
 assert private_file.stat().st_mode & 0o777 == 0o600
 check_failure("O_EXCL_EXISTING_FILE",lambda:m.save_exclusive(private_file,b"INVALID_OVERWRITE"),
               "File exists")
 assert private_file.read_bytes()==b"QA_SYNTHETIC_FIRST"
 link_to_file=target/"synthetic-output-symlink"
 link_to_file.symlink_to(private_file)
 check_failure("EXCLUSIVE_SYMLINK_NO_CLOBBER",lambda:m.save_exclusive(link_to_file,b"INVALID"),
               "File exists")
 assert private_file.read_bytes()==b"QA_SYNTHETIC_FIRST"
 assert {str(x):digest(x) for x in fake}==baseline,"synthetic originals were mutated"
 assert [p.name for p in target.iterdir() if p.is_file()]==["synthetic-output.bin"]
 print("QRW787_O_EXCL_0600_NO_CLOBBER_ORIGINAL_SHA_PRESERVED_PASS",flush=True)

 src=module_file.read_text()
 for clause in ('"publicImagesEnabled": False','"canPublish": False',
                '"canWriteSave": False','"cloudUploadAllowed": False'):
  assert clause in src
 print("QRW787_CHANGED_ONLY_INDEPENDENT_PASS_PENDING_NORMAL_CI_MEDIA_HOLD",flush=True)
