"""QA-only: existing protected Pages artifact and actual HTTPS exclusion, no rebuild or private data."""
import hashlib,json,pathlib,subprocess,sys,tarfile,urllib.request,urllib.error
MAIN='e3e8a9275f6a2ca3e4ad17d0c3db2f9a6889df9b'
MANIFEST='ca61abd9df4b3aab0d292e174b100300b9b82989b3054946dbe5c18ff6ddc321'
ORIGIN='https://dreamwishwand.github.io/web/'
PINS={
 'scripts/asset-research/01d-v1253-image-preflight.py':'0467b2037a70da1b3f3742e686a3038008d15d14',
 'scripts/asset-research/01d-v1253-image-consumer-hold.mjs':'63d5e239f6d229116dd6ee7d29b1c04260cae615',
 'docs/core/01d-v1253-image-preflight-20261108.md':'8ab2eef7e26364c4ffbacf017e7121d47426c381',
 'docs/core/01d-r14-v1253-image-consumer-contract-hold-20261108.md':'4d6984a4e619e99046285886e3410de5fd358b55',
 'tests/01d-v1253-image-preflight.test.mjs':'1794c747ed066ac0e42e17f897d4740a87b787d6',
 'tests/01d-v1253-image-consumer-hold.test.mjs':'0ce35b8269c914155f77c098caef059bf32a6903'}
MARKERS=[b'wand.01d.v1253-original-image-candidate-preflight@1',b'wand.01d.v1253-item-image-consumer-hold@1']
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
assert git('merge-base',MAIN,'HEAD')==MAIN
assert sorted(git('diff','--name-status',MAIN,'HEAD').splitlines())==sorted(['A\t.github/workflows/04qr-w-pages-private-research-20261113.yml','A\tscripts/04qr-w-pages-private-research-20261113.py'])
for p,s in PINS.items():assert git('rev-parse','HEAD:'+p)==s
def sha(b):return hashlib.sha256(b).hexdigest()
archive=pathlib.Path(sys.argv[1])/'artifact.tar'
assert archive.is_file(),'WAIT_ENV_FIXED_PAGES_ARTIFACT_MISSING'
with tarfile.open(archive,'r:*') as t:
 files={}
 for m in t.getmembers():
  name=m.name.removeprefix('./').rstrip('/')
  if not name or name=='.':continue
  path=pathlib.PurePosixPath(name)
  assert not path.is_absolute() and '..' not in path.parts,'UNSAFE_ARCHIVE_MEMBER'
  if m.isfile():
   assert name not in files,'DUPLICATE_ARTIFACT_MEMBER'
   files[name]=m
  else:assert m.isdir(),'NONREGULAR_ARTIFACT_MEMBER'
 assert 'index.html' in files and '404.html' in files and 'editor/timing/index.html' in files
 assert sha(t.extractfile(files['worker-wasm/manifest.json']).read())==MANIFEST,'WAIT_HEAD_ARTIFACT_MANIFEST_MISMATCH'
 for p in PINS:
  assert p not in files and not any(pathlib.PurePosixPath(n).name==pathlib.PurePosixPath(p).name for n in files),'RESEARCH_SOURCE_FILE_INCLUDED '+p
 assert not any(n.startswith(('scripts/asset-research/','docs/core/','tests/stage-f/fixtures/')) for n in files),'RESEARCH_OR_FIXTURE_TREE_INCLUDED'
 for n,m in files.items():
  assert m.size<=64*1024*1024,'UNEXPECTED_ARTIFACT_FILE_SIZE'
  b=t.extractfile(m).read()
  for marker in MARKERS:assert marker not in b,'RESEARCH_ONLY_SCHEMA_INCLUDED '+n
 assert sorted(n for n in files if n.startswith('worker-wasm/'))==['worker-wasm/ddv_save_core.js','worker-wasm/ddv_save_core_bg.wasm','worker-wasm/manifest.json']
 print('QRW_FIXED_PAGES_ARTIFACT_RESEARCH6_EXCLUSION_PASS',json.dumps({'main':MAIN,'artifactId':14021061938,'files':len(files),'exact6Absent':True,'researchSchemaMarkersAbsent':2,'signedManifestSha256':MANIFEST,'threePublicWasmAssets':True}))
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**kw):return None
opener=urllib.request.build_opener(NoRedirect())
def fetch(path,limit=4*1024*1024):
 try:
  with opener.open(urllib.request.Request(ORIGIN+path,headers={'Cache-Control':'no-cache','User-Agent':'Dreamwish-Wand-QA'}),timeout=25) as r:
   return r.status,r.headers.get('Content-Type',''),r.read(limit+1)
 except urllib.error.HTTPError as e:
  try:return e.code,e.headers.get('Content-Type',''),e.read(limit+1)
  finally:e.close()
def live_manifest():
 code,mime,b=fetch('worker-wasm/manifest.json')
 assert code==200 and 'application/json' in mime,'WAIT_ENV_MANIFEST_HTTP_OR_MIME'
 assert sha(b)==MANIFEST,'WAIT_HEAD_DEPLOYMENT_DRIFT'
live_manifest()
code,mime,b=fetch('editor/timing/')
assert code==200 and 'text/html' in mime,'WAIT_ENV_PUBLIC_CONTROL'
statuses={}
for p in PINS:
 code,mime,b=fetch(p)
 assert code==404,'RESEARCH_SOURCE_HTTP_NOT_404 '+p+' '+str(code)
 assert 'text/html' in mime,'UNEXPECTED_404_CONTENT_TYPE '+p
 assert not any(m in b for m in MARKERS),'RESEARCH_SCHEMA_IN_HTTP_RESPONSE '+p
 statuses[p]=code
live_manifest()
print('QRW_ACTUAL_HTTPS_RESEARCH6_EXCLUSION_PASS',json.dumps({'main':MAIN,'publicControl':200,'exact6':statuses,'manifestBeforeAfter':MANIFEST,'privateDataUsed':False}))
