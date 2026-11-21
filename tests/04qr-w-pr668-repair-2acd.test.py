"""04 QR-W PR668 repair-only independent CLI root-symlink proof.
All files created in temporary sandbox. Never load private game Bundle or Save.
"""
import hashlib
import pathlib
import subprocess
import sys
import tempfile
import unittest

REPO=pathlib.Path(__file__).resolve().parents[1]
SOURCE="2acd359faf13b353fe6b0cf653b5d887c514300d"
OLD="46447ad05f86eecd83d449ab66aefcbda200c13c"
SOURCE_BLOBS={
 "docs/core/01d-steam-v1253-furniture-byte-delta-20261106.md":"2e76708cd9b8b2c5fdd10549ab64b0b28cf28310",
 "scripts/asset-research/01d-steam-furniture-stream-delta.py":"9d9e222ec6d0057ecbb4764e4d29841474ef2bc7",
 "tests/01d-steam-furniture-stream-delta.test.mjs":"5a1aee6c9dc16c80ffa9ff00a2440a674f3f4f67",
 "tests/01d-steam-furniture-stream-delta.test.py":"9544b39b4004c5888d6fde59f2dda01d5691e29d"}
QA_FILES=[
 ".github/workflows/04qr-w-pr668-repair-2acd.yml",
 "tests/04qr-w-pr668-repair-2acd.test.py"]
SCRIPT=REPO/"scripts/asset-research/01d-steam-furniture-stream-delta.py"

def git(*args):
 return subprocess.check_output(["git","-C",str(REPO),*args],text=True).strip()
def tiny(root):
 for v,b in (("v1250",b"independent synthetic 1250"),("v1253",b"independent synthetic 1253")):
  folder=root/v
  folder.mkdir()
  (folder/"furniture_a1c425a5.bundle").write_bytes(b)
def cli(root,report):
 return subprocess.run([sys.executable,str(SCRIPT),"--root",str(root),"--report",str(report)],
                       text=True,capture_output=True,timeout=15)

class ChangedRisk(unittest.TestCase):
 def test_source_four_blobs_and_delta_three_and_qa_two(self):
  self.assertEqual(git("rev-parse",SOURCE),SOURCE)
  self.assertEqual(sorted(git("diff","--name-only",OLD,SOURCE).splitlines()),
                   sorted(["scripts/asset-research/01d-steam-furniture-stream-delta.py",
                           "tests/01d-steam-furniture-stream-delta.test.mjs",
                           "tests/01d-steam-furniture-stream-delta.test.py"]))
  for name,sha in SOURCE_BLOBS.items():
   self.assertEqual(git("hash-object",name),sha,name)
  self.assertEqual(sorted(git("diff","--name-only",SOURCE,"HEAD").splitlines()),sorted(QA_FILES))

 def test_repaired_cli_symlink_root_denies_without_report_or_original_change(self):
  with tempfile.TemporaryDirectory() as temp:
   base=pathlib.Path(temp)
   source=base/"originals"
   source.mkdir()
   tiny(source)
   alias=base/"symlinked-originals"
   alias.symlink_to(source,target_is_directory=True)
   originals={p.name:hashlib.sha256(p.read_bytes()).hexdigest()
              for p in (source/"v1250"/"furniture_a1c425a5.bundle",source/"v1253"/"furniture_a1c425a5.bundle")}
   report=base/"report.json"
   run=cli(alias,report)
   self.assertNotEqual(run.returncode,0)
   self.assertIn("ORIGINAL_ROOT_INVALID",run.stderr)
   self.assertNotIn("ORIGINAL_SIZE_MISMATCH",run.stderr,
                    "literal symlink denial must precede size check")
   self.assertFalse(report.exists())
   self.assertEqual(originals,{
    p.name:hashlib.sha256(p.read_bytes()).hexdigest()
    for p in (source/"v1250"/"furniture_a1c425a5.bundle",source/"v1253"/"furniture_a1c425a5.bundle")})

 def test_literal_relative_symlink_root_denies_before_ordinary_size_gate(self):
  with tempfile.TemporaryDirectory() as temp:
   base=pathlib.Path(temp)
   source=base/"originals"
   source.mkdir()
   tiny(source)
   alias=base/"sym"
   alias.symlink_to(source,target_is_directory=True)
   report=base/"new.json"
   bad=cli(alias,report)
   self.assertNotEqual(bad.returncode,0)
   self.assertIn("ORIGINAL_ROOT_INVALID",bad.stderr)
   good=cli(source,report)
   self.assertNotEqual(good.returncode,0)
   self.assertIn("ORIGINAL_SIZE_MISMATCH",good.stderr)
   self.assertNotIn("ORIGINAL_ROOT_INVALID",good.stderr)
   self.assertFalse(report.exists())

 def test_symlink_refusal_does_not_clobber_preexisting_report(self):
  with tempfile.TemporaryDirectory() as temp:
   base=pathlib.Path(temp)
   src=base/"originals"
   src.mkdir()
   tiny(src)
   alias=base/"link"
   alias.symlink_to(src,target_is_directory=True)
   report=base/"existing.json"
   report.write_text('{"preserve":"unchanged"}',encoding="utf8")
   r=cli(alias,report)
   self.assertNotEqual(r.returncode,0)
   self.assertEqual(report.read_text(encoding="utf8"),'{"preserve":"unchanged"}')

if __name__=="__main__":
 unittest.main(verbosity=2)
