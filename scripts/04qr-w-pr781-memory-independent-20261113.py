"""Independent PR781 memory-only actual OS synthetic; no private bytes."""
import unittest,tempfile,pathlib,importlib.util,hashlib,json,subprocess,os,sys,contextlib,io
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
S='356974c1d1c1c9e0a36c028fb2368ac9fa4cc94e'
OLD='621bf4576c9ffdc657d22eb7da024e70f70c2011'
BASE='b7d86d47125f1764919b67898c39badaf35976d8'
LIVE='fcd47ff413e7930c58c9bde7fe5d3bf078edde43'
P='scripts/asset-research/01d-v1253-image-preflight.py'
PINS={P:'0467b2037a70da1b3f3742e686a3038008d15d14','tests/01d-v1253-image-preflight.test.mjs':'1794c747ed066ac0e42e17f897d4740a87b787d6','docs/core/01d-v1253-image-preflight-20261108.md':'8ab2eef7e26364c4ffbacf017e7121d47426c381'}
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
spec=importlib.util.spec_from_file_location('preflight',ROOT/P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def vi(n):
 out=bytearray()
 while n>127:out.append((n&127)|128);n>>=7
 out.append(n);return bytes(out)
def field(n,b):return vi(n*8+2)+vi(len(b))+b
def item(i,g):
 body=vi(8)+vi(i)+field(2,b'SYNTHETIC_FIXTURE')+field(4,('guid:'+g*32).encode())
 return vi(i-40000000)+vi(len(body))+body
RAW=item(40000047,'a')+item(40002422,'b')
# Observe real Python filesystem audit events, including importer bytecode.
# No mocking filesystem reads or native parser. Fixture setup outside guard.
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
class QA(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='qrw781-memory-');self.addCleanup(self.tmp.cleanup)
  self.base=pathlib.Path(self.tmp.name);self.src=self.base/'original';self.out=self.base/'out'
  self.src.mkdir();self.out.mkdir();(self.src/'nested').mkdir()
  (self.src/'Furniture.json').write_bytes(RAW);(self.src/'FullVersion.txt').write_bytes(m.FULLVERSION_BYTES)
 def pins(self):return patch.multiple(m,FURNITURE_SHA256=hashlib.sha256(RAW).hexdigest(),FURNITURE_BYTES=len(RAW),STEAM_ITEM_COUNT=2)
 def snapshot(self):return {str(p.relative_to(self.src)):p.read_bytes() for p in self.src.rglob('*') if p.is_file()}
 def test_01_exact_original3_and_changed3(self):
  self.assertEqual(git('merge-base',S,'HEAD'),S)
  self.assertEqual(sorted(git('diff','--name-status',BASE,S).splitlines()),sorted('A\t'+p for p in PINS))
  self.assertEqual(sorted(git('diff','--name-status',OLD,S).splitlines()),sorted('M\t'+p for p in PINS))
  self.assertEqual(len(git('diff','--name-status',S,'HEAD').splitlines()),2)
  for p,h in PINS.items():
   self.assertEqual(git('rev-parse',S+':'+p),h);self.assertEqual(git('rev-parse','HEAD:'+p),h)
   with self.assertRaises(subprocess.CalledProcessError):git('cat-file','-e',LIVE+':'+p)
 def test_02_actual_parser_memory_and_digest_no_write(self):
  before=self.snapshot()
  with self.pins(),no_writes():
   h=m.create_private_report(self.src,['40000047','40002422','40006096'])
   summary=m.report_summary(h)
  self.assertEqual(h['samples'][0]['iconGuid'],'guid:'+'a'*32)
  self.assertEqual(h['samples'][1]['iconGuid'],'guid:'+'b'*32)
  self.assertEqual(h['samples'][2]['status'],'MISSING_NATIVE_ITEM')
  self.assertEqual(h['releaseManifestDraft']['items'],{});self.assertIsNone(h['releaseManifestDraft']['publicUrl'])
  for k in ['canPublishImage','canEnableItemThumb','canWriteSave','cloudUploadAllowed']:self.assertFalse(h[k])
  self.assertEqual(h['rights']['license'],'UNKNOWN');self.assertEqual(h['counts']['currentSwitchImageVerified'],0)
  self.assertEqual(summary['reportSha256'],hashlib.sha256((json.dumps(h,ensure_ascii=False,indent=2)+'\n').encode()).hexdigest())
  self.assertFalse(summary['privateReportWritten']);self.assertEqual(summary['publicImageRows'],0)
  self.assertEqual(self.snapshot(),before);self.assertEqual(list(self.out.iterdir()),[])
 def test_03_legacy_paths_denied_before_io(self):
  alias=self.base/'alias';alias.symlink_to(self.src,target_is_directory=True)
  existing=self.out/'existing';existing.write_bytes(b'SENTINEL')
  paths=[existing,alias/'nested'/'escape',self.out/'..'/'original'/'nested'/'escape',self.src/'nested'/'escape',ROOT/'scripts'/'qrw781-never-write',self.base/'ancestor']
  before=self.snapshot()
  with patch.object(m,'_private_root',side_effect=AssertionError('INPUT_IO_REACHED')),no_writes():
   for p in paths:
    with self.assertRaisesRegex(ValueError,'PRIVATE_REPORT_PATH_WRITE_DISABLED'):m.emit_private_report(self.src,p,['40000047'])
  self.assertEqual(existing.read_bytes(),b'SENTINEL');self.assertEqual(self.snapshot(),before)
  for p in paths[1:]:self.assertFalse(p.exists())
 def test_04_actual_relocation_after_last_root_check_no_output(self):
  before=self.snapshot();moved=self.src/'nested'/'relocated';real=m._same_directory
  def relocate(path,fd,error):
   real(path,fd,error)
   # second same-directory check, after assembly. Actual directory rename.
   if not moved.exists() and relocate.calls==1:
    self.out.rename(moved);self.out.mkdir()
   relocate.calls+=1
  relocate.calls=0
  with self.pins(),patch.object(m,'_same_directory',side_effect=relocate):
   h=m.create_private_report(self.src,['40000047'])
  self.assertTrue(moved.is_dir());self.assertEqual(h['counts']['steamNativePresent'],1)
  with no_writes():
   for p in [moved/'late.json',self.out/'late.json']:
    with self.assertRaisesRegex(ValueError,'PRIVATE_REPORT_PATH_WRITE_DISABLED'):m.emit_private_report(self.src,p,['40000047'])
  self.assertEqual(self.snapshot(),before);self.assertFalse((moved/'late.json').exists());self.assertFalse((self.out/'late.json').exists())
 def test_05_input_root_and_sha_fail_closed(self):
  alias=self.base/'alias';alias.symlink_to(self.src,target_is_directory=True)
  with no_writes():
   with self.assertRaisesRegex(ValueError,'ORIGINAL_FURNITURE_SHA_OR_SIZE_MISMATCH'):m.create_private_report(self.src,['40000047'])
   with self.assertRaisesRegex(ValueError,'PRIVATE_ROOT_INVALID'):m.create_private_report(alias,['40000047'])
   with self.assertRaisesRegex(ValueError,'PRIVATE_ROOT_INVALID'):m.create_private_report(ROOT,['40000047'])
  (self.src/'FullVersion.txt').write_bytes(b'wrong')
  with self.pins(),no_writes():
   with self.assertRaisesRegex(ValueError,'EXTERNAL_FULLVERSION_MISMATCH'):m.create_private_report(self.src,['40000047'])
 def test_06_cli_legacy_denial_and_summary_only(self):
  # Real CLI subprocess denies --report before reading even invalid root.
  p=subprocess.run([sys.executable,str(ROOT/P),'--root',str(self.base/'missing'),'--report',str(self.out/'never'),'--item-id','40000047'],capture_output=True,text=True)
  self.assertNotEqual(p.returncode,0);self.assertIn('PRIVATE_REPORT_PATH_WRITE_DISABLED',p.stderr);self.assertEqual(p.stdout,'');self.assertFalse((self.out/'never').exists())
  # Same actual main function with only synthetic pins; stdout is summary,
  # not full private manifest or raw path/bytes.
  buf=io.StringIO()
  with self.pins(),patch.object(sys,'argv',[str(ROOT/P),'--root',str(self.src),'--item-id','40000047']),contextlib.redirect_stdout(buf),no_writes():m.main()
  o=json.loads(buf.getvalue());self.assertEqual(set(o),{'schema','count','nativePresent','publicImageRows','sourceTier','privateReportWritten','reportSha256'})
  self.assertNotIn(str(self.src),buf.getvalue());self.assertNotIn('guid:',buf.getvalue());self.assertFalse(o['privateReportWritten'])
if __name__=='__main__':unittest.main(verbosity=2)
