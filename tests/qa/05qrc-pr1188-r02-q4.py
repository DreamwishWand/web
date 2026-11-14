"""Independent synthetic R02 Native q4 lexical boundary."""
import copy,hashlib,itertools,json,subprocess,sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def road(i,x,y):return dict(ID=i,ItemID=40100068,X=x,Y=y,Orientation='GridOrientation_Down',State={'FenceMode':{'Diagonal':True}})
def doc(amount=5):
 return {'GameInfo':{'Version':624},'World':{'Ambient':{'keep':'星'},'GridCollection':{'DiffGrids':{},'Grids':{'77':{'ID':77,'TessellationFactor':2,'GridDefaultLayoutPath':'','NextGridObjectID':900,'Objects':{'101':{'ID':101,'ItemID':40000001,'X':99,'Y':99,'Unknown':{'keep':[None,'雪',7]}},'103':road(103,12,12),'105':{'ID':105,'ItemID':40000001,'X':100,'Y':100,'State':{'Future':True}}}}}}},'Player':{'ListInventories':{'0':{'ID':0,'CompatibleItemType':'ItemType_Furniture','CompatibleFurnitureTypes':{'List':['FurnitureItemType_GroundAlteration']},'Inventory':{'40100068':{'Amount':amount,'Marker':'Keep','Opaque':['星',None]}}}}}}
def bind(d,order=None,spaced=False,x=32,y=20):
 g=d['World']['GridCollection']['Grids']['77'];o=g['Objects'];order=order if order is not None else list(o)
 def rec(k):return wire(k)+(b' : ' if spaced else b':')+(json.dumps(o[k],ensure_ascii=False,separators=(', ',': '),sort_keys=True).encode() if spaced else wire(o[k]))
 rs={k:rec(k) for k in order};old=b'{'+(b', ' if spaced else b',').join(rs[k] for k in order)+b'}'
 grid=wire(g).replace(wire(o),old);raw=wire(d).replace(wire(g),grid);v=d['Player']['ListInventories']['0']['Inventory']['40100068'];n=g['NextGridObjectID']
 new=[road(n,x,y),road(n+1,x+4,y+4),road(n+2,x+4,y),road(n+3,x,y+4)]
 p={'contract':'wand.private.switch624.road-r02-native-q4-archive@1','sourceDecodedSha256':sha(raw),'gridId':77,'expectedNextId':n,'expectedAmount':v['Amount'],'gridSha256':sha(grid),'inventoryEntrySha256':sha(wire(v)),'objects':new}
 return raw,p,old,rs
def run(raw,p,over=None,plan=None,mode='--switch624-road-r02-native-q4-archive-only'):
 b=wire(p) if plan is None else plan
 e={'WAND_LOCAL_INSTALLED_SWITCH_BID':'52BD625D9B4E0053','WAND_LOCAL_ORIGINAL_SHA256':sha(b'Synthetic original placeholder'),'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'128','WAND_LOCAL_DECODED_SHA256':sha(raw),'WAND_LOCAL_R02_CANONICAL_PLAN':b.decode(),'WAND_LOCAL_R02_PLAN_SHA256':sha(b)};e.update(over or {})
 return subprocess.run([str(exe),mode],input=raw,env=e,capture_output=True,timeout=30)
n=0
for amt in (5,9999):
 d=doc(amt);g=d['World']['GridCollection']['Grids']['77'];entry=d['Player']['ListInventories']['0']['Inventory']['40100068']
 for order in itertools.permutations(g['Objects']):
  for spaced in (False,True):
   raw,p,old,rs=bind(d,order,spaced);r=run(raw,p);assert r.returncode==0,(amt,order,r.stderr)
   expected_map=old[:-1]+b','+b','.join(wire(str(o['ID']))+b':'+wire(o) for o in p['objects'])+b'}'
   v=copy.deepcopy(entry);v['Amount']=amt-4
   expect=raw.replace(old,expected_map).replace(b'"NextGridObjectID":900',b'"NextGridObjectID":904').replace(wire(entry),wire(v))
   assert r.stdout==expect,(amt,order,r.stdout,expect);assert r.stderr==b'PRIVATE_V2_SWITCH624_R02_NATIVE_Q4_EXACT6_PIPE_PASS\n';n+=1
raw,p,_,_=bind(doc());neg=0
def deny(raw,p,**kw):
 global neg
 r=run(raw,p,**kw);assert r.returncode==12 and not r.stdout,(r.returncode,r.stderr);neg+=1
for k,v in [('contract','wand.private.switch624.road-rm01-archive@1'),('gridId',78),('expectedNextId',901),('expectedAmount',6),('sourceDecodedSha256','a'*64),('gridSha256','b'*64),('inventoryEntrySha256','c'*64),('objects',p['objects'][::-1]),('refund',1),('layout','PRESERVE_EXISTING')]:
 q=copy.deepcopy(p);q[k]=v;deny(raw,q)
for i,k,v in [(0,'ID',901),(1,'X',35),(2,'State',None),(3,'Orientation','GridOrientation_Left'),(0,'ItemID',40700246),(2,'State',{'FenceMode':{'Diagonal':True},'Future':7})]:
 q=copy.deepcopy(p);q['objects'][i][k]=v;deny(raw,q)
for x,y in [(32,20),(36,24),(36,20),(32,24)]:
 d=doc();d['World']['GridCollection']['Grids']['77']['Objects']['101'].update(X=x,Y=y);a,q,_,_=bind(d);deny(a,q)
for mode in range(10):
 d=doc();g=d['World']['GridCollection']['Grids']['77'];route=d['Player']['ListInventories']['0']
 if mode==0:g['Objects']={}
 if mode==1:g['NextGridObjectID']=2147483644
 if mode==2:g['GridDefaultLayoutPath']='unknown'
 if mode==3:d['World']['GridCollection']['DiffGrids']['77']={}
 if mode==4:route['Inventory']['40100068']['Amount']=4
 if mode==5:route['Inventory']['40100068']['Amount']=10000
 if mode==6:route['CompatibleFurnitureTypes']['List']=['FurnitureItemType_Default']
 if mode==7:g['Objects']['101']['ID']=900
 if mode==8:g['Objects']['101']['X']='99'
 if mode==9:g['Objects']['0101']=g['Objects'].pop('101')
 a,q,_,_=bind(d);deny(a,q)
a,q,_,_=bind(doc(),x=2147483644);deny(a,q)
deny(raw,p,plan=b' '+wire(p));deny(raw,p,over={'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'});deny(raw,p,over={'WAND_LOCAL_R02_PLAN_SHA256':'d'*64});deny(raw,p,over={'WAND_LOCAL_DECODED_SHA256':'e'*64})
assert (n,neg)==(24,35),(n,neg)
print('QA1188_R02_NATIVE_Q4',n,'EXACT_LEXICAL_POS',neg,'RESEALED_NEG_EMPTY_STDOUT')
