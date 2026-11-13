"""Independent actual OS synthetic-only path safety; never real game bytes."""
import unittest, tempfile, pathlib, importlib.util, hashlib, json, subprocess, stat
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE='621bf4576c9ffdc657d22eb7da024e70f70c2011'
OLD='74fdf91479d692510c607ab0b892aaedecfd6b47'
LIVE='7823a2d66a0ae8f9a6a80bbf225734d2c52bf204'
BASE='b7d86d47125f1764919b67898c39badaf35976d8'
P='scripts/asset-research/01d-v1253-image-preflight.py'
PINS={P:'8c17c9b8f9c5266277af4bf45c2e1dacd20ce6e2','tests/01d-v1253-image-preflight.test.mjs':'e74f5d9c6949ebef9e07193d0a123c3087f2ce2b','docs/core/01d-v1253-image-preflight-20261108.md':'a298c9cdeb52e9c0f32cc09480d62d6e7d9731f9'}
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
spec=importlib.util.spec_from_file_location('preflight',ROOT/P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def varint(n):
 out=bytearray()
 while n>127:out.append((n&127)|128);n>>=7
 out.append(n);return bytes(out)
def field(n,b):return varint(n*8+2)+varint(len(b))+b
def item(i,g):
 body=varint(8)+varint(i)+field(2,b'SYNTHETIC_FIXTURE')+field(4,('guid:'+g*32).encode())
 return varint(i-40000000)+varint(len(body))+body
RAW=item(40000047,'a')+item(40002422,'b')
class Independent(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='qrw781-synthetic-')
  self.addCleanup(self.tmp.cleanup)
  self.base=pathlib.Path(self.tmp.name)
  self.src=self.base/'original';self.src.mkdir()
  self.out=self.base/'output';self.out.mkdir()
  (self.src/'Furniture.json').write_bytes(RAW)
  (self.src/'FullVersion.txt').write_bytes(m.FULLVERSION_BYTES)
  (self.src/'nested').mkdir()
 def pins(self):
  # ONLY test fixture identity substituted in memory; real reader and actual OS remain.
  return patch.multiple(m,FURNITURE_SHA256=hashlib.sha256(RAW).hexdigest(),FURNITURE_BYTES=len(RAW),STEAM_ITEM_COUNT=2)
 def unchanged(self):
  self.assertEqual((self.src/'Furniture.json').read_bytes(),RAW)
  self.assertEqual((self.src/'FullVersion.txt').read_bytes(),m.FULLVERSION_BYTES)
 def test_01_exact_source(self):
  self.assertEqual(git('merge-base',SOURCE,'HEAD'),SOURCE)
  self.assertEqual(sorted(git('diff','--name-status',BASE,SOURCE).splitlines()),sorted('A\t'+p for p in PINS))
  self.assertEqual(sorted(git('diff','--name-status',OLD,SOURCE).splitlines()),sorted('M\t'+p for p in PINS))
  self.assertEqual(len(git('diff','--name-status',SOURCE,'HEAD').splitlines()),2)
  self.assertTrue(all(x.startswith('A\t') and '04qr-w-pr781-path' in x for x in git('diff','--name-status',SOURCE,'HEAD').splitlines()))
  for p,h in PINS.items():
   with self.assertRaises(subprocess.CalledProcessError):git('cat-file','-e',LIVE+':'+p)
   self.assertEqual(git('rev-parse',SOURCE+':'+p),h);self.assertEqual(git('rev-parse','HEAD:'+p),h)
 def test_02_actual_native_parser_hold_and_exclusive(self):
  report=self.out/'receipt.json'
  with self.pins():
   receipt=m.emit_private_report(self.src,report,['40000047','40006096'])
   data=json.loads(report.read_text());self.assertEqual(receipt['publicImageRows'],0)
   self.assertEqual(data['releaseManifestDraft']['items'],{});self.assertFalse(data['canPublishImage'])
   self.assertFalse(data['canEnableItemThumb']);self.assertFalse(data['canWriteSave'])
   self.assertEqual(data['samples'][0]['iconGuid'],'guid:'+'a'*32)
   self.assertEqual(data['samples'][1]['status'],'MISSING_NATIVE_ITEM')
   self.assertEqual(stat.S_IMODE(report.stat().st_mode),0o600)
   before=report.read_bytes()
   with self.assertRaisesRegex(ValueError,'REPORT_ALIAS_OR_EXISTS'):m.emit_private_report(self.src,report,['40000047'])
   self.assertEqual(report.read_bytes(),before)
  self.unchanged()
 def test_03_actual_sha_and_fullversion_negatives(self):
  p=self.out/'deny.json'
  with self.assertRaisesRegex(ValueError,'ORIGINAL_FURNITURE_SHA_OR_SIZE_MISMATCH'):m.emit_private_report(self.src,p,['40000047'])
  self.assertFalse(p.exists())
  with self.pins():
   (self.src/'FullVersion.txt').write_bytes(b'wrong-version')
   with self.assertRaisesRegex(ValueError,'EXTERNAL_FULLVERSION_MISMATCH'):m.emit_private_report(self.src,p,['40000047'])
   self.assertFalse(p.exists())
 def test_04_direct_alias_and_symlink_parent_denied(self):
  link=self.base/'direct';link.symlink_to(self.src,target_is_directory=True)
  with self.pins():
   for p in [self.src/'nested'/'new.json',link/'new.json']:
    with self.assertRaisesRegex(ValueError,'REPORT_ALIAS_OR_EXISTS|REPORT_PARENT_UNSAFE'):m.emit_private_report(self.src,p,['40000047'])
    self.assertFalse(p.exists())
  self.unchanged()
 def test_05_intermediate_symlink_ancestor_must_not_write_inside_original(self):
  link=self.base/'alias';link.symlink_to(self.src,target_is_directory=True)
  requested=link/'nested'/'forbidden.json';actual=self.src/'nested'/'forbidden.json'
  with self.pins():
   try:m.emit_private_report(self.src,requested,['40000047'])
   except ValueError:pass
   self.assertFalse(actual.exists(),'TRUE_RED_REPORT_INTERMEDIATE_SYMLINK_ESCAPE: actual synthetic original subtree gained a report')
  self.unchanged()
 def test_06_dotdot_alias_must_not_write_inside_original(self):
  requested=self.out/'..'/'original'/'nested'/'forbidden.json';actual=self.src/'nested'/'forbidden.json'
  with self.pins():
   try:m.emit_private_report(self.src,requested,['40000047'])
   except ValueError:pass
   self.assertFalse(actual.exists(),'TRUE_RED_REPORT_DOTDOT_ESCAPE: actual synthetic original subtree gained a report')
  self.unchanged()
 def test_07_root_leaf_git_and_ancestor_denial(self):
  with self.pins():
   root_alias=self.base/'root-link';root_alias.symlink_to(self.src,target_is_directory=True)
   with self.assertRaisesRegex(ValueError,'PRIVATE_ROOT_INVALID'):m.emit_private_report(root_alias,self.out/'root.json',['40000047'])
   for p in [self.base/'ancestor.json',self.src/'nested'/'child.json']:
    with self.assertRaisesRegex(ValueError,'REPORT_ALIAS_OR_EXISTS'):m.emit_private_report(self.src,p,['40000047'])
    self.assertFalse(p.exists())
   leaf=self.out/'leaf.json';leaf.symlink_to(self.src/'Furniture.json')
   with self.assertRaisesRegex(ValueError,'REPORT_ALIAS_OR_EXISTS'):m.emit_private_report(self.src,leaf,['40000047'])
   self.assertTrue(leaf.is_symlink())
   checkout=self.base/'checkout';checkout.mkdir();(checkout/'.git').write_text('gitdir: synthetic')
   with self.assertRaisesRegex(ValueError,'REPORT_PARENT_UNSAFE'):m.emit_private_report(self.src,checkout/'deny.json',['40000047'])
   self.assertFalse((checkout/'deny.json').exists())
  self.unchanged()
 def test_08_actual_directory_replacement_during_parser_denied(self):
  moved=self.base/'moved'
  real=m.assemble
  def swap(*a,**kw):
   value=real(*a,**kw);self.out.rename(moved);self.out.mkdir();return value
  with self.pins(),patch.object(m,'assemble',side_effect=swap):
   with self.assertRaisesRegex(ValueError,'REPORT_PARENT_UNSAFE'):m.emit_private_report(self.src,self.out/'deny.json',['40000047'])
  self.assertFalse((moved/'deny.json').exists());self.assertFalse((self.out/'deny.json').exists());self.unchanged()
 def test_09_pinned_parent_relocated_into_original_after_last_validation(self):
  # The final path recheck is not an atomic containment guarantee. Move the
  # very directory inode held by parent_fd, not merely replace its old name.
  # Actual OS rename, no mock of filesystem or original parser.
  moved=self.src/'nested'/'relocated'
  actual=m._same_directory
  def relocate(path,fd,error):
   actual(path,fd,error)
   if path==self.out:
    self.out.rename(moved)
    self.out.mkdir()
  before={p.relative_to(self.src):p.read_bytes() for p in self.src.rglob('*') if p.is_file()}
  with self.pins(),patch.object(m,'_same_directory',side_effect=relocate):
   try:m.emit_private_report(self.src,self.out/'late.json',['40000047'])
   except ValueError:pass
  after={p.relative_to(self.src):p.read_bytes() for p in self.src.rglob('*') if p.is_file()}
  self.assertEqual(after,before,'TRUE_RED_PINNED_OUTPUT_DIRECTORY_RELOCATED_INTO_ORIGINAL_AFTER_LAST_CHECK')
  self.assertFalse((self.out/'late.json').exists())
if __name__=='__main__':unittest.main(verbosity=2)
