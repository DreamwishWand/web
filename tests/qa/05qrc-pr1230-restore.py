import json,hashlib,os,sys,subprocess,tempfile,copy,pathlib
exe=str(pathlib.Path(sys.argv[1]).resolve())
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'
def doc(a,ambient=1):
 return {'GameInfo':{'Version':626},'Player':{'ListInventories':{'0':{'ID':0,'CompatibleItemType':'ItemType_Furniture','CompatibleFurnitureTypes':{'List':['FurnitureItemType_Default']},'Inventory':{'40000053':{'Amount':a,'Marker':'ItemMarker_None','Opaque':{'keep':'雪'}},'40000054':{'Amount':a}}}}},'World':{'Ambient':ambient}}
def entry(d):return d['Player']['ListInventories']['0']['Inventory']['40000053']
def run(d,flag,extra={}):
 raw=wire(d);env={'WAND_LOCAL_INSTALLED_STEAM_FULLVERSION':steam,'WAND_LOCAL_ORIGINAL_SHA256':sha(b'synthetic original'),'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'128','WAND_LOCAL_DECODED_SHA256':sha(raw),'WAND_LOCAL_INVENTORY_ID':'0','WAND_LOCAL_CANONICAL_ITEM_ID':'40000053',**extra}
 return subprocess.run([exe,flag],input=raw,env=env,capture_output=True,timeout=5)
pos=neg=0
with tempfile.TemporaryDirectory() as td:
 p=pathlib.Path(td)/'snapshot.wand.json'
 for old in [1,49,9999]:
  d=doc(old);r=run(d,'--inventory-amount-backup-only');assert r.returncode==0,r.stderr
  b=r.stdout;v=json.loads(b);p.write_bytes(b);p.chmod(0o600)
  assert v['payload']['amount']==old and v['payload']['entrySha256']==sha(wire(entry(d)))
  def env(cur):return {'WAND_LOCAL_RESTORE_BACKUP_PATH':str(p),'WAND_LOCAL_RESTORE_BACKUP_SHA256':sha(b),'WAND_LOCAL_RESTORE_BACKUP_SOURCE_SHA256':sha(wire(d)),'WAND_LOCAL_RESTORE_BACKUP_ENTRY_SHA256':sha(wire(entry(d))),'WAND_LOCAL_RESTORE_CURRENT_ENTRY_SHA256':sha(wire(entry(cur))),'WAND_LOCAL_RESTORE_EXPECTED_CURRENT_AMOUNT':str(entry(cur)['Amount'])}
  for a,ambient in [(old,1),(old,2),*(([(old+1,2)] if old<9999 else [])),*(([(old-1,2)] if old>1 else []))]:
   cur=doc(a,ambient);r=run(cur,'--inventory-amount-restore-review-only',env(cur));assert r.returncode==0,r.stderr
   x=json.loads(r.stdout);assert x['backupAmount']==old and x['currentAmount']==a and x['sameSourceDecoded']==(ambient==1)
   assert x['disposition']==('AlreadyMatches' if a==old else 'PositiveDecreaseCandidate' if a>old else 'IncreaseUnsupported')
   assert x['backupSha256']==sha(b) and x['currentDecodedSha256']==sha(wire(cur)) and x['currentEntrySha256']==sha(wire(entry(cur))) and x['revision']==0 and x['indexGeneration']==1
   assert all(x[k] is False for k in ['originalTargetLineageVerified','rightsVerified','writerAuthorized','applyAuthorized','editedCopyAuthorized','nativeV3Verified']);assert p.read_bytes()==b;pos+=1
  cur=doc(old,2);e=env(cur)
  def deny(over):
   global neg
   r=run(cur,'--inventory-amount-restore-review-only',{**e,**over});assert r.returncode!=0 and not r.stdout,(over,r.returncode,r.stdout);neg+=1
  for k,val in [('WAND_LOCAL_RESTORE_BACKUP_SHA256','f'*64),('WAND_LOCAL_RESTORE_BACKUP_SOURCE_SHA256','f'*64),('WAND_LOCAL_RESTORE_BACKUP_ENTRY_SHA256','f'*64),('WAND_LOCAL_RESTORE_CURRENT_ENTRY_SHA256','f'*64),('WAND_LOCAL_RESTORE_EXPECTED_CURRENT_AMOUNT','0'+str(old)),('WAND_LOCAL_CANONICAL_ITEM_ID','40000054'),('WAND_LOCAL_INVENTORY_ID','00'),('WAND_LOCAL_INSTALLED_STEAM_FULLVERSION','9A239D3DB569756D'),('WAND_LOCAL_DECODED_SHA256','f'*64)]:deny({k:val})
  for label,content in [('noncanonical',b+b' '),('invalid',b'{}'),('oversize',b' '*1048577)]:
   bad=pathlib.Path(td)/label;bad.write_bytes(content);deny({'WAND_LOCAL_RESTORE_BACKUP_PATH':str(bad),'WAND_LOCAL_RESTORE_BACKUP_SHA256':sha(content)})
  link=pathlib.Path(td)/'link';link.symlink_to(p);fifo=pathlib.Path(td)/'fifo';os.mkfifo(fifo)
  for path in [link,fifo,pathlib.Path(td),'relative']:deny({'WAND_LOCAL_RESTORE_BACKUP_PATH':str(path)})
  link.unlink();fifo.unlink();assert p.read_bytes()==b
print('QA1230',pos,'POS',neg,'NEG', 'READ_ONLY')
assert (pos,neg)==(10,48)
