# Synthetic independent transport checks; never use real Save data.
import os,sys,json,hashlib,pathlib,tempfile,subprocess,copy,time,stat
EXE=str(pathlib.Path(sys.argv[1]).resolve())
H=lambda x:hashlib.sha256(x).hexdigest()
enc=lambda x:json.dumps(x,separators=(',',':')).encode()
D=2120000049; T=30000089
g={'GroupIndex':0,'State':0,'GroupsCollectionItems':{str(T):False,'30000090':False,'40000077':True},'Opaque':{'keep':7}}
doc={'GameInfo':{'Version':626},'World':{},'Player':{'CollectionSets':[{'CollectionDefinitionID':D,'GroupData':[g,{'State':'FutureState','GroupsCollectionItems':{str(T):True}}]},{'CollectionDefinitionID':D+1,'GroupData':[{'GroupsCollectionItems':{'30000099':False}}]}],'ListInventories':{'17':{'ID':17,'CompatibleItemType':'ItemType_ActivityItem','Inventory':{str(T):{'Amount':0,'Marker':None}}}}}}
def env(b):
 return {**os.environ,'WAND_LOCAL_INSTALLED_STEAM_FULLVERSION':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22','WAND_LOCAL_ORIGINAL_SHA256':'b'*64,'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'456','WAND_LOCAL_DECODED_SHA256':H(b)}
def args(p,d=D,g=0,t=T):return ['--collection-group-receipt-only',str(d),str(g),str(t),'--out',str(p)]
def run(p,b,aa=None):return subprocess.run([EXE,*(aa or args(p))],input=b,env=env(b),capture_output=True,timeout=20)
flags=['packagedMembershipVerified','effectiveEligibilityVerified','ownershipVerified','rightsVerified','subscriberClosureVerified','nativeV3Verified','productReadAccepted','writerAuthorized','editedCopyAuthorized','applyAuthorized','cloudUploadPerformed','originalModifiedByHarness']
def good(p,b,aa=None):
 r=run(p,b,aa);assert r.returncode==0,r.stderr;assert r.stdout==b'';assert stat.S_IMODE(p.stat().st_mode)==0o600
 v=json.loads(p.read_bytes());assert v['decodedSha256']==H(b) and v['revision']==0 and v['indexGeneration']==1 and v['fullDocumentRustValidated'] is True
 assert all(v[k] is False for k in flags)
 assert v['originalSha256SuppliedExternally']=='b'*64 and v['originalSizeBytesSuppliedExternally']==456
 return v
def bad(p,b,aa=None):
 r=run(p,b,aa);assert r.returncode==12 and r.stdout==b'',r.stderr
 assert not os.path.lexists(p)
with tempfile.TemporaryDirectory(prefix='qa1074-') as tmp:
 root=pathlib.Path(tmp);b=enc(doc);p=root/'first';v=good(p,b);assert v['selectedGroup']['groupSha256']==H(enc(g));assert v['storedStock']['entry']['amount']==0 and v['storedStock']['entry']['markerSha256']==H(b'null')
 v2=good(root/'second',b);assert v2['sessionId']!=v['sessionId'] and v2['selectedGroup']==v['selectedGroup']
 before=p.read_bytes();r=run(p,b);assert r.returncode==12 and p.read_bytes()==before
 q=root/'absent';x=good(q,b,args(q,d=D+1));assert x['selectedGroup']['targetEntry'] is None and x['selectedGroup']['state']['present'] is False
 q=root/'unknown';x=good(q,b,args(q,g=1));assert x['selectedGroup']['state']['numericCode'] is None
 d=copy.deepcopy(doc);d['Player']['CollectionSets'][0]['GroupData']=[{'GroupsCollectionItems':{str(T):False}} for _ in range(257)]
 q=root/'max';x=good(q,enc(d),args(q,g=256));assert x['selectedGroup']['groupPosition']==256 and len(x['storedMemberships'])==257
 q=root/'deny';bad(q,enc(d),args(q,g=257));d['Player']['CollectionSets'][0]['GroupData'].append({'GroupsCollectionItems':{}});bad(q,enc(d))
 for dd,gg,tt in [('+'+str(D),0,T),(2147483648,0,T),(D,'+0',T),(D,'00',T),(D,0,40000001)]:bad(q,b,args(q,dd,gg,tt))
 for mode in ('rename','collision'):
  parent=root/mode;parent.mkdir(mode=0o700);moved=root/(mode+'-moved');foreign=root/(mode+'-foreign');foreign.mkdir(mode=0o700);out=parent/'receipt'
  proc=subprocess.Popen([EXE,*args(out)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env(b))
  try:
   deadline=time.monotonic()+10;found=False
   while time.monotonic()<deadline and proc.poll() is None:
    for fd in pathlib.Path(f'/proc/{proc.pid}/fd').iterdir():
     try:found=found or os.readlink(fd)==str(parent)
     except OSError:pass
    if found:break
    time.sleep(.01)
   assert found,'pinned fd not observed'
   if mode=='collision':out.write_bytes(b'sentinel')
   else:parent.rename(moved);parent.symlink_to(foreign,target_is_directory=True)
   stdout,stderr=proc.communicate(b,timeout=20);assert stdout==b''
   if mode=='collision':assert proc.returncode==12 and out.read_bytes()==b'sentinel'
   else:assert proc.returncode==0 and (moved/'receipt').exists() and not (foreign/'receipt').exists()
  finally:
   if proc.poll() is None:proc.kill();proc.communicate()
print('QA1074 independent Collection transport 5POS8NEG2RACE PASS')
