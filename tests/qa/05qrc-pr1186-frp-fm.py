"""Independent exact FRP01/FM01 synthetic native lexical and catalog boundary."""
import copy,hashlib,itertools,json,subprocess,sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def obj(i,item,x,y,left=False,diagonal=False):
 return dict(ID=i,ItemID=item,X=x,Y=y,Orientation='GridOrientation_Left' if left else 'GridOrientation_Down',State={'FenceMode':{'Diagonal':True}} if diagonal else None)
def setup(frp):
 x,y=32,12; base,ext=40700246,40700247
 if frp:
  old=[obj(101,base,x,y),obj(103,ext,x,y+2,True),obj(105,base,x,y+4)]; keep=[]; deleted=[101,103,105]
  new=[obj(900,40700268,x,y),obj(901,40700269,x,y+2,True),obj(902,40700268,x,y+4)]
 else:
  old=[obj(101,base,x,y),obj(103,ext,x+2,y),obj(105,base,x+4,y),obj(107,ext,x+4,y+2,True),obj(109,base,x+4,y+4)];keep=[101];deleted=[103,105,107,109]
  new=[obj(900,ext,x,y+2,True),obj(901,base,x,y+4),obj(902,base,x+2,y+6,False,True)]
 records={str(o['ID']):o for o in old};records['113']={'ID':113,'ItemID':40000001,'X':99,'Y':99,'Opaque':{'keep':[None,'雪',7]}}
 inv={'40700246':{'Amount':1,'Marker':'keep','Unknown':['星',None]},'40700268':{'Amount':2,'Marker':'other'}}
 d={'GameInfo':{'Version':624},'World':{'Ambient':{'keep':'星'},'GridCollection':{'DiffGrids':{},'Grids':{'77':{'ID':77,'TessellationFactor':2,'GridDefaultLayoutPath':'','NextGridObjectID':900,'Objects':records}}}},'Player':{'ListInventories':{'0':{'ID':0,'CompatibleItemType':'ItemType_Furniture','CompatibleFurnitureTypes':{'List':['FurnitureItemType_Fence']},'Inventory':inv}}}}
 return d,keep,deleted,new
def bind(d,frp,order=None,spaced=False):
 _,keep,deleted,new=setup(frp);g=d['World']['GridCollection']['Grids']['77'];o=g['Objects'];order=order or list(o)
 def rec(k):return wire(k)+(b' : ' if spaced else b':')+(json.dumps(o[k],ensure_ascii=False,separators=(', ',': '),sort_keys=True).encode() if spaced else wire(o[k]))
 rs={k:rec(k) for k in order};sep=b', ' if spaced else b',';old=b'{'+sep.join(rs[k] for k in order)+b'}'
 grid=wire(g).replace(wire(o),old);raw=wire(d).replace(wire(g),grid)
 inv=d['Player']['ListInventories']['0']['Inventory'];ids=['40700246','40700268'] if frp else ['40700246']
 p={'contract':'wand.private.switch624.fence-'+('frp01' if frp else 'fm01')+'-archive@1','layout':'PRESERVE_EXISTING','sourceDecodedSha256':sha(raw),'gridId':77,'expectedNextId':g['NextGridObjectID'],'gridSha256':sha(grid),'retainedIds':keep,'deletedIds':deleted,'created':new,'inventoryEntrySha256':{k:sha(wire(inv[k])) for k in ids if k in inv}}
 return raw,p,rs,old
def run(raw,p,frp,override=None,mode=None,plan=None):
 b=wire(p) if plan is None else plan
 e={'WAND_LOCAL_INSTALLED_SWITCH_BID':'52BD625D9B4E0053','WAND_LOCAL_ORIGINAL_SHA256':sha(b'Synthetic original placeholder'),'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'128','WAND_LOCAL_DECODED_SHA256':sha(raw)}
 tag='FRP01' if frp else 'FM01';e['WAND_LOCAL_'+tag+'_CANONICAL_PLAN']=b.decode();e['WAND_LOCAL_'+tag+'_PLAN_SHA256']=sha(b);e.update(override or {})
 return subprocess.run([str(exe),mode or '--switch624-fence-'+tag.lower()+'-archive-only'],input=raw,env=e,capture_output=True,timeout=30)
for frp in (True,False):
 d,keep,deleted,new=setup(frp);g=d['World']['GridCollection']['Grids']['77'];n=0;neg=0
 for order in itertools.permutations(g['Objects']):
  raw,p,rs,old=bind(d,frp,order);r=run(raw,p,frp)
  assert r.returncode==0,(frp,order,r.stderr)
  expected_map=b'{'+b','.join([rs[k] for k in order if int(k) not in deleted]+[wire(str(o['ID']))+b':'+wire(o) for o in new])+b'}'
  expect=raw.replace(old,expected_map).replace(b'"NextGridObjectID":900',b'"NextGridObjectID":903')
  assert r.stdout==expect,(frp,order,r.stdout,expect)
  assert r.stderr==('PRIVATE_V2_SWITCH624_FRP01_ARCHIVE_EXACT7_PIPE_PASS\n' if frp else 'PRIVATE_V2_SWITCH624_FM01_ARCHIVE_PRESERVE8_PIPE_PASS\n').encode()
  v=json.loads(r.stdout);assert v['Player']==d['Player'] and v['World']['Ambient']==d['World']['Ambient'];n+=1
 for order in [list(g['Objects']),list(reversed(g['Objects']))]:
  raw,p,rs,_=bind(d,frp,order,True);r=run(raw,p,frp);assert r.returncode==0,r.stderr
  for k in order:
   if int(k) not in deleted:assert rs[k] in r.stdout
  v=json.loads(r.stdout);assert v['Player']==d['Player'];assert v['World']['Ambient']==d['World']['Ambient']
 raw,p,_,_=bind(d,frp)
 def deny(raw,p,**kw):
  global neg
  r=run(raw,p,frp,**kw);assert r.returncode==12 and not r.stdout,(frp,r.returncode,r.stderr);neg+=1
 for k,v in [('layout','EXPLICIT_USER_LAYOUT'),('expectedNextId',901),('gridId',78),('sourceDecodedSha256','a'*64),('gridSha256','b'*64),('deletedIds',deleted[::-1]),('retainedIds',deleted),('created',new[::-1]),('refund',1),('inventoryDelta',1),('inventoryEntrySha256',{}),('contract','wand.private.switch624.fence-'+('fm01' if frp else 'frp01')+'-archive@1')]:
  q=copy.deepcopy(p);q[k]=v;deny(raw,q)
 for k in p['inventoryEntrySha256']:
  q=copy.deepcopy(p);q['inventoryEntrySha256'][k]='0'*64;deny(raw,q)
 q=copy.deepcopy(p);q['inventoryEntrySha256']['99999999']='0'*64;deny(raw,q)
 for i,k,v in [(0,'ID',901),(1,'X',33),(2,'State',{'Unknown':True}),(0,'ItemID',40700252)]:
  q=copy.deepcopy(p);q['created'][i][k]=v;deny(raw,q)
 for mode in range(8):
  z=copy.deepcopy(d);gg=z['World']['GridCollection']['Grids']['77'];route=z['Player']['ListInventories']['0']
  if mode==0:gg['Objects']['103']['State']={'Unknown':1}
  if mode==1:gg['Objects']['113']['X']=32;gg['Objects']['113']['Y']=14
  if mode==2:gg['NextGridObjectID']=2147483646
  if mode==3:gg['GridDefaultLayoutPath']='unknown'
  if mode==4:z['World']['GridCollection']['DiffGrids']['77']={}
  if mode==5:route['Inventory']['40700246']['Amount']=0
  if mode==6:route['CompatibleFurnitureTypes']['List']=['FurnitureItemType_Default']
  if mode==7:gg['Objects']['113']['ID']=900
  a,q,_,_=bind(z,frp);deny(a,q)
 if frp:
  z=copy.deepcopy(d);z['Player']['ListInventories']['0']['Inventory']['40700268']['Amount']=0;a,q,_,_=bind(z,frp);deny(a,q)
 deny(raw,p,plan=b' '+wire(p));deny(raw,p,override={'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'})
 assert (n,neg)==((24,30) if frp else (720,28))
 print('QA1186', 'FRP01' if frp else 'FM01',n,'EXACT_PERMUTATIONS',2,'RAW_POS',neg,'NEG',flush=True)
