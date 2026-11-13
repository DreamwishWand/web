"""Independent changed-risk PR787 memory-only QA. Synthetic inputs; no game bytes."""
import contextlib, hashlib, importlib.util, io, json, os, pathlib, subprocess, sys, tempfile, types, unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
S='b3b51ca692a22d6ffdf001db8bbcb1e73382ad14'
OLD='2744cc61781c72908db338309d034750370bbc37'
BASE='b7d86d47125f1764919b67898c39badaf35976d8'
LIVE='e3e8a9275f6a2ca3e4ad17d0c3db2f9a6889df9b'
P='scripts/asset-research/01d-steam1253-private-native-image-pilot.py'
PINS={P:'fce27deda2fd6d6482f56bccc175210b7726c92e','tests/01d-steam1253-private-native-image-pilot.test.mjs':'274fc70354ca34b99f89088f2e6043370745d036','docs/core/01d-r14-steam1253-private-native-image-pilot-20261108.md':'cc291c3a786964d205be74fd236dc12901f96a77'}
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
spec=importlib.util.spec_from_file_location('pilot',ROOT/P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
GUARD=False
EVENTS=[]
def audit(event,args):
 if not GUARD:return
 if event=='open':
  path,mode,flags=args
  if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):
   EVENTS.append(event);raise AssertionError('UNEXPECTED_WRITE_OPEN')
 elif event in ('os.mkdir','os.remove','os.rmdir','os.rename','os.link','os.symlink','os.chmod','os.truncate'):
  EVENTS.append(event);raise AssertionError('UNEXPECTED_FS_MUTATION_'+event)
sys.addaudithook(audit)
@contextlib.contextmanager
def no_writes():
 global GUARD
 EVENTS.clear();GUARD=True
 try:yield
 finally:GUARD=False
 assert not EVENTS,EVENTS
@contextlib.contextmanager
def injected_os_change():
 global GUARD
 old=GUARD;GUARD=False
 try:yield
 finally:GUARD=old
class QA(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='qrw787-memory-');self.addCleanup(self.tmp.cleanup)
  self.base=pathlib.Path(self.tmp.name);self.src=self.base/'source';self.cat=self.base/'catalog';self.bd=self.base/'bundle';self.out=self.base/'out'
  for p in (self.src,self.cat,self.bd,self.out):p.mkdir()
  self.bundle=self.bd/'original.bundle';self.pins={}
  for name in m.PINS:
   p=self.src/name if name=='Furniture.json' else self.bundle if name.endswith('.bundle') else self.cat/name
   data=('SYNTHETIC:'+name).encode();p.write_bytes(data);self.pins[name]=(hashlib.sha256(data).hexdigest(),len(data))
  (self.src/'FullVersion.txt').write_bytes(m.VERSION.encode())
  self.sentinel=self.src/'40000047-steam1253-reconstructed.png';self.sentinel.write_bytes(b'KEEP-ORIGINAL')
  self.args=types.SimpleNamespace(source_root=self.src,catalog_root=self.cat,bundle=self.bundle,private_output=self.out,item_id=['40000047','40006096'])
  self.products=[]
  for i in self.args.item_id:
   png=('SYNTHETIC-PNG:'+i).encode();webp=('SYNTHETIC-WEBP:'+i).encode()
   meta={'itemId':i,'webpRgbaExact':True,'canPublish':False,'steamReconstructedPngSha256':hashlib.sha256(png).hexdigest(),'steamLossless160WebpSha256':hashlib.sha256(webp).hexdigest()}
   self.products.append((meta,png,webp))
 def snapshot(self):
  return {str(p.relative_to(self.base)):p.read_bytes() for d in (self.src,self.cat,self.bd) for p in d.rglob('*') if p.is_file()}
 @contextlib.contextmanager
 def fixture(self,decode):
  # Actual filesystem and exact_sha + FullVersion. Only synthetic identity pins
  # and upstream Native parser/catalog/decode seams substituted.
  with patch.object(m,'PINS',self.pins),patch.object(m,'accepted_furniture_rows') as rows,patch.object(m,'resolve_catalog') as cat,patch.object(m,'decode_products',side_effect=decode) as dec:
   yield rows,cat,dec
 def test_01_exact_original3_and_changed3_native_body_preserved(self):
  self.assertEqual(git('merge-base',S,'HEAD'),S)
  self.assertEqual(sorted(git('diff','--name-status',BASE,S).splitlines()),sorted('A\t'+p for p in PINS))
  self.assertEqual(sorted(git('diff','--name-status',OLD,S).splitlines()),sorted('M\t'+p for p in PINS))
  self.assertEqual(len(git('diff','--name-status',S,'HEAD').splitlines()),2)
  for p,h in PINS.items():
   self.assertEqual(git('rev-parse',S+':'+p),h);self.assertEqual(git('rev-parse','HEAD:'+p),h)
   with self.assertRaises(subprocess.CalledProcessError):git('cat-file','-e',LIVE+':'+p)
  old=git('show',OLD+':'+P);new=git('show',S+':'+P)
  # Native decoder and raster bytes/metadata logic preserved, moved to helper.
  a=old[old.index('    from PIL import Image'):old.index('    # Outputs are not made')]
  b=new[new.index('    from PIL import Image'):new.index('    return products')]
  self.assertEqual(a.replace('for item in check_sample_ids(args.item_id):','for item in ids:'),b)
  self.assertEqual(old[old.index('def check_sample_ids'):old.index('def self_test')].replace('    spec.loader.exec_module(module)','    previous = sys.dont_write_bytecode\n    try:\n        sys.dont_write_bytecode = True\n        spec.loader.exec_module(module)\n    finally:\n        sys.dont_write_bytecode = previous'),new[new.index('def check_sample_ids'):new.index('def self_test')])
 def test_02_memory_products_digest_no_writes_actual_hashes(self):
  before=self.snapshot()
  with self.fixture(lambda *a:self.products) as (rows,cat,dec),no_writes():
   h=m.run(self.args);summary=m.report_summary(h)
  rows.assert_called_once_with(self.src/'Furniture.json');cat.assert_called_once_with(self.cat);dec.assert_called_once_with(self.bundle,self.args.item_id)
  self.assertEqual(h['products'],tuple(self.products));self.assertEqual(h['record']['nativeSamples'],[x for x,_,_ in self.products])
  self.assertEqual(h['record']['releaseManifestDraft']['items'],{});self.assertIsNone(h['record']['releaseManifestDraft']['publicUrl'])
  self.assertFalse(h['record']['releaseManifestDraft']['publicImagesEnabled'])
  for k in ('canPublish','canWriteSave','cloudUploadAllowed'):self.assertFalse(h['record'][k])
  self.assertEqual(h['record']['rights']['license'],'UNKNOWN');self.assertEqual(h['record']['currentSwitchSameBuildSourcePositive'],0)
  self.assertEqual(summary['receiptSha256'],hashlib.sha256((json.dumps(h['record'],ensure_ascii=False,indent=2,sort_keys=True)+'\n').encode()).hexdigest())
  self.assertEqual(summary['sourceOriginal'],'NOT_ATTESTED_BY_SUMMARY');self.assertFalse(summary['privateFilesWritten']);self.assertEqual(summary['publicImages'],0)
  self.assertEqual(m.report_summary({'record':{},'products':()})['sourceOriginal'],'NOT_ATTESTED_BY_SUMMARY')
  self.assertEqual(self.snapshot(),before);self.assertEqual(list(self.out.iterdir()),[])
 def test_03_actual_post_preflight_alias_no_write_or_unlink(self):
  before=self.snapshot()
  def swap(*a):
   with injected_os_change():
    self.out.rename(self.base/'moved-out');self.out.symlink_to(self.src,target_is_directory=True)
   return self.products
  with self.fixture(swap),no_writes():h=m.run(self.args)
  self.assertTrue(self.out.is_symlink());self.assertEqual(h['products'],tuple(self.products))
  self.assertEqual(self.snapshot(),before);self.assertEqual(list((self.base/'moved-out').iterdir()),[])
  with no_writes():
   with self.assertRaisesRegex(ValueError,'PRIVATE_IMAGE_PATH_WRITE_DISABLED'):m.save_exclusive(self.out/'forbidden.png',b'no')
  self.assertFalse((self.src/'forbidden.png').exists())
 def test_04_actual_relocation_then_exception_no_cleanup(self):
  before=self.snapshot();moved=self.src/'relocated'
  def fail(*a):
   with injected_os_change():
    self.out.rename(moved);self.out.mkdir()
   raise RuntimeError('SYNTHETIC_DECODE_FAILURE')
  with self.fixture(fail),no_writes():
   with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_DECODE_FAILURE'):m.run(self.args)
  self.assertTrue(moved.is_dir());self.assertEqual(list(moved.iterdir()),[]);self.assertEqual(list(self.out.iterdir()),[]);self.assertEqual(self.snapshot(),before)
 def test_05_legacy_hint_optional_and_cli_summary(self):
  self.args.private_output=None
  with self.fixture(lambda *a:self.products),no_writes():h=m.run(self.args)
  self.assertEqual(h['products'],tuple(self.products))
  args=[str(ROOT/P),'--source-root',str(self.src),'--catalog-root',str(self.cat),'--bundle',str(self.bundle),'--item-id','40000047','--item-id','40006096']
  out=io.StringIO()
  with self.fixture(lambda *a:self.products),patch.object(sys,'argv',args),contextlib.redirect_stdout(out),no_writes():m.main()
  summary=json.loads(out.getvalue());self.assertEqual(set(summary),{'sourceOriginal','items','webpRgbaExact','publicImages','privateFilesWritten','receiptSha256'})
  self.assertEqual(summary['sourceOriginal'],'STEAM1253_SHA_VERIFIED')
  for s in (str(self.base),'SYNTHETIC-PNG','SYNTHETIC-WEBP','nativeSamples','guid:'):self.assertNotIn(s,out.getvalue())
  self.assertFalse(summary['privateFilesWritten']);self.assertEqual(summary['publicImages'],0)
 def test_06_actual_sha_and_root_negatives_before_decode(self):
  for path in (self.src,self.cat,self.bd,self.base,ROOT):
   with self.fixture(lambda *a:self.products) as (_,_,dec),no_writes():
    self.args.private_output=path
    with self.assertRaisesRegex(ValueError,'PRIVATE_OUTPUT_MUST_BE_SEPARATE|PRIVATE_PATH_INSIDE_REPOSITORY'):m.run(self.args)
    dec.assert_not_called()
  self.args.private_output=None
  (self.cat/'catalog.keyData.bin').write_bytes(b'X'*self.pins['catalog.keyData.bin'][1])
  with self.fixture(lambda *a:self.products) as (_,_,dec),no_writes():
   with self.assertRaisesRegex(ValueError,'ORIGINAL_SHA_OR_MUTATION_MISMATCH'):m.run(self.args)
   dec.assert_not_called()
if __name__=='__main__':unittest.main(verbosity=2)
