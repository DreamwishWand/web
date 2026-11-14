# Independent synthetic actual native CLI: no genuine save data.
import os,sys,json,hashlib,subprocess,copy,pathlib
exe=str(pathlib.Path(sys.argv[1]).resolve())
H=lambda x:hashlib.sha256(x).hexdigest()
raw=lambda x:json.dumps(x,ensure_ascii=False,separators=(', ',': ')).encode()
canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':')).encode()
STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'
C=30200071;F=40000077
def fixture():
 a=[{'ItemID':0,'Amount':0,'State':None} for _ in range(48)]
 a[0]={'ItemID':C,'Amount':50,'State':None,'tag':'other'}
 a[47]={'ItemID':C,'Amount':50,'State':None,'tag':'selected','Unknown':[False,7]}
 return {'GameInfo':{'Version':626},'World':{'Unknown':False},'Player':{'ContainerInventories':{'29':{'ID':29,'ParentItemID':40000047,'BelongsToPlayer':True,'BlockMoveTo':False,'Size':48,'ExtraSize':0,'Inventory':a}},'ListInventories':{'0':{'ID':0,'CompatibleItemType':'ItemType_Furniture','CompatibleFurnitureTypes':{'List':['FurnitureItemType_Default']},'Inventory':{str(F):{'Amount':2,'Marker':None,'Unknown':{'keep':True}}}},'4':{'ID':4,'CompatibleItemType':'ItemType_ActivityItem','Inventory':{str(C):{'Amount':50}}}}},'Unknown':{'preserve':'星'}}
def plan(d,chest):
 e=d['Player']['ContainerInventories']['29']['Inventory'][47] if chest else d['Player']['ListInventories']['0']['Inventory'][str(F)]
 return {'contract':'wand.private.steam626.chest-crop-existing-50-to-49@1' if chest else 'wand.private.steam626.catalog0-ordinary-existing-decrease-one@1','fullVersion':STEAM,'sourceDecodedSha256':H(raw(d)),'originalSha256':'b'*64,'originalSizeBytes':987,'backupSha256':'b'*64,'backupSizeBytes':987,'revision':0,'indexGeneration':1,'selector':{'containerId':29,'slotIndex':47} if chest else {'inventoryId':0,'itemId':F},'target':{'itemId':C if chest else F,'oldAmount':e['Amount'],'newAmount':e['Amount']-1,'compatibleItemType':'ItemType_ActivityItem' if chest else 'ItemType_Furniture','entrySha256':H(raw(e)),'chest':{'parentItemId':40000047,'belongsToPlayer':True,'blockMoveTo':False,'size':48,'extraSize':0,'physicalSlotCount':48,'stateSha256':H(b'null'),'packagedStackBound':50} if chest else None}}
def run(d,chest,p=None,over=None,mode=None,extra=None):
 p=p if p is not None else plan(d,chest);q=canon(p);b=raw(d)
 env={**os.environ,'WAND_LOCAL_INSTALLED_STEAM_FULLVERSION':STEAM,'WAND_LOCAL_ORIGINAL_SHA256':'b'*64,'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'987','WAND_LOCAL_BACKUP_SHA256':'b'*64,'WAND_LOCAL_BACKUP_SIZE_BYTES':'987','WAND_LOCAL_DECODED_SHA256':H(b),'WAND_LOCAL_PRIVATE_AMOUNT_PLAN':q.decode(),'WAND_LOCAL_PRIVATE_AMOUNT_PLAN_SHA256':H(q)}
 env.pop('WAND_LOCAL_INSTALLED_SWITCH_BID',None);env.update(over or {})
 mode=mode or ('--private-steam626-bound-chest-decrease-only' if chest else '--private-steam626-bound-catalog0-decrease-only')
 return subprocess.run([exe,mode,*(extra or [])],input=b,env=env,capture_output=True,timeout=20)
def deny(d,chest,**kw):
 r=run(d,chest,**kw);assert r.returncode!=0 and r.stdout==b'',r.stderr
d=fixture()
for chest in (True,False):
 p=plan(d,chest);r=run(d,chest);assert r.returncode==0,r.stderr
 expected=copy.deepcopy(d)
 if chest:expected['Player']['ContainerInventories']['29']['Inventory'][47]['Amount']=49
 else:expected['Player']['ListInventories']['0']['Inventory'][str(F)]['Amount']=1
 assert r.stdout==raw(expected)
 for k in ('contract','fullVersion','sourceDecodedSha256','originalSha256','backupSha256','revision','indexGeneration'):
  q=copy.deepcopy(p);q[k]='bad';deny(d,chest,p=q)
 for k,value in (('oldAmount',999),('newAmount',0),('newAmount',p['target']['oldAmount']-2),('entrySha256','f'*64),('compatibleItemType','ItemType_Currency'),('authority',True)):
  q=copy.deepcopy(p);q['target'][k]=value;deny(d,chest,p=q)
 for over in ({'WAND_LOCAL_PRIVATE_AMOUNT_PLAN_SHA256':'f'*64},{'WAND_LOCAL_BACKUP_SHA256':'a'*64},{'WAND_LOCAL_BACKUP_SIZE_BYTES':'988'},{'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'},{'WAND_LOCAL_DECODED_SHA256':'f'*64}):
  deny(d,chest,over=over)
 deny(d,chest,extra=['unexpected'])
 deny(d,chest,p=plan(d,not chest))
q=plan(d,True);q['selector']['slotIndex']=0;deny(d,True,p=q)
for field,value in [('Size',47),('ExtraSize',1),('BlockMoveTo',True),('BelongsToPlayer',False)]:
 x=fixture();x['Player']['ContainerInventories']['29'][field]=value;deny(x,True)
for value in ({}, {'Unknown':False}, 'null'):
 x=fixture();x['Player']['ContainerInventories']['29']['Inventory'][47]['State']=value;deny(x,True)
x=fixture();x['Player']['ContainerInventories']['29']['Inventory'].pop(1);deny(x,True)
x=fixture();x['Player']['ContainerInventories']['29']['Inventory'][47]['Amount']=49;deny(x,True)
x=fixture();x['Player']['ListInventories']['0']['CompatibleFurnitureTypes']['List']=['FurnitureItemType_Door'];deny(x,False)
x=fixture();x['Player']['ListInventories']['0']['Inventory'][str(F)]['Amount']=1;deny(x,False)
legacy={'WAND_LOCAL_CONTAINER_ID':'29','WAND_LOCAL_SLOT_INDEX':'47','WAND_LOCAL_SLOT_ITEM_ID':str(C),'WAND_LOCAL_CHEST_EXPECTED_OLD_AMOUNT':'50','WAND_LOCAL_CHEST_NEW_AMOUNT':'49'}
v=run(d,True,mode='--semantic-chest-existing-decrease-only',over=legacy)
assert v.returncode==0 and v.stdout==run(d,True).stdout,v.stderr
print('ACT893_PRIVATE_BOUND_AMOUNT_2POS_52NEG_LEGACY_CHEST_EQ_PASS')
