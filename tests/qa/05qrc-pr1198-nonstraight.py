"""Independent nonstraight Fence exact lexical and shape boundary, synthetic only."""
import copy, hashlib, itertools, json, subprocess, sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
SHAPES={
 'ortho-l':[(246,0,0,0,0),(247,2,0,0,0),(246,4,0,0,0),(247,4,2,1,0),(246,4,4,0,0)],
 'diagonal90':[(246,0,0,0,1),(253,2,2,0,1),(246,4,4,0,1),(253,6,2,1,1),(246,8,0,0,1)],
 'ortho-t':[(246,0,0,0,0),(247,2,0,0,0),(246,4,0,0,0),(247,6,0,0,0),(246,8,0,0,0),(247,4,2,1,0),(246,4,4,0,0)]}
def obj(i,item,x,y,left,diag):return dict(ID=i,ItemID=40700000+item,X=x,Y=y,Orientation='GridOrientation_Left' if left else 'GridOrientation_Down',State={'FenceMode':{'Diagonal':True}} if diag else None)
def doc(amount=1):
 return {'GameInfo':{'Version':624},'World':{'Ambient':{'keep':'星'},'GridCollection':{'DiffGrids':{},'Grids':{'77':{'ID':77,'TessellationFactor':2,'GridDefaultLayoutPath':'','NextGridObjectID':900,'Objects':{'101':{'ID':101,'ItemID':40000001,'X':99,'Y':99,'Unknown':{'keep':[None,'雪',7]}},'103':obj(103,246,12,12,0,1),'105':{'ID':105,'ItemID':40000001,'X':100,'Y':100,'State':{'Future':True}}}}}}},'Player':{'ListInventories':{'0':{'ID':0,'CompatibleItemType':'ItemType_Furniture','CompatibleFurnitureTypes':{'List':['FurnitureItemType_Fence']},'Inventory':{'40700246':{'Amount':amount,'Marker':'Keep','Opaque':['星',None]}}}}}}
def bind(d,shape,order=None,spaced=False,x=32,y=20):
 g=d['World']['GridCollection']['Grids']['77'];o=g['Objects'];order=order if order is not None else list(o)
 def rec(k):return wire(k)+(b' : ' if spaced else b':')+(json.dumps(o[k],ensure_ascii=False,separators=(', ',': '),sort_keys=True).encode() if spaced else wire(o[k]))
 old=b'{'+(b', ' if spaced else b',').join(rec(k) for k in order)+b'}';grid=wire(g).replace(wire(o),old);raw=wire(d).replace(wire(g),grid);v=d['Player']['ListInventories']['0']['Inventory']['40700246'];n=g['NextGridObjectID']
 new=[obj(n+i,item,x+dx,y+dy,left,diag) for i,(item,dx,dy,left,diag) in enumerate(SHAPES[shape])]
 p={'contract':'wand.private.switch624.fence-'+shape+'-archive@1','layout':'PRESERVE_EXISTING','sourceDecodedSha256':sha(raw),'gridId':77,'expectedNextId':n,'gridSha256':sha(grid),'inventoryEntrySha256':sha(wire(v)),'created':new}
 return raw,p,old
def run(raw,p,shape,over=None,plan=None,mode=None):
 b=wire(p) if plan is None else plan
 e={'WAND_LOCAL_INSTALLED_SWITCH_BID':'52BD625D9B4E0053','WAND_LOCAL_ORIGINAL_SHA256':sha(b'Synthetic original placeholder'),'WAND_LOCAL_ORIGINAL_SIZE_BYTES':'128','WAND_LOCAL_DECODED_SHA256':sha(raw),'WAND_LOCAL_FENCE_ADD_CANONICAL_PLAN':b.decode(),'WAND_LOCAL_FENCE_ADD_PLAN_SHA256':sha(b)};e.update(over or {})
 return subprocess.run([str(exe),mode or '--switch624-fence-'+shape+'-archive-only'],input=raw,env=e,capture_output=True,timeout=30)
for shape,desc in SHAPES.items():
 n=0;neg=0
 for amt in (1,9999):
  d=doc(amt);g=d['World']['GridCollection']['Grids']['77']
  for order in itertools.permutations(g['Objects']):
   for spaced in (False,True):
    raw,p,old=bind(d,shape,order,spaced);r=run(raw,p,shape);assert r.returncode==0,(shape,amt,order,r.stderr)
    expected_map=old[:-1]+b','+b','.join(wire(str(o['ID']))+b':'+wire(o) for o in p['created'])+b'}'
    expect=raw.replace(old,expected_map).replace(b'"NextGridObjectID":900',b'"NextGridObjectID":'+str(900+len(desc)).encode())
    assert r.stdout==expect,(shape,order,r.stdout,expect);assert r.stderr==('PRIVATE_V2_SWITCH624_FENCE_'+shape.upper().replace('-','_')+'_EXACT'+str(len(desc)+1)+'_PIPE_PASS\n').encode();n+=1
 raw,p,_=bind(doc(),shape)
 def deny(raw,p,**kw):
  global neg
  r=run(raw,p,shape,**kw);assert r.returncode==12 and not r.stdout,(shape,neg,r.returncode,r.stderr);neg+=1
 for k,v in [('layout','EXPLICIT_USER_LAYOUT'),('gridId',78),('expectedNextId',901),('sourceDecodedSha256','a'*64),('gridSha256','b'*64),('inventoryEntrySha256','c'*64),('created',p['created'][::-1]),('refund',1),('inventoryDelta',1),('writerAuthorized',True)]:
  q=copy.deepcopy(p);q[k]=v;deny(raw,q)
 for other in SHAPES:
  if other!=shape:
   deny(raw,p,mode='--switch624-fence-'+other+'-archive-only')
   q=copy.deepcopy(p);q['contract']='wand.private.switch624.fence-'+other+'-archive@1';deny(raw,q)
 for i,k,v in [(0,'ID',901),(1,'X',35),(2,'State',{'Unknown':True}),(1,'Orientation','GridOrientation_Up'),(0,'ItemID',40700268),(2,'Opaque',7)]:
  q=copy.deepcopy(p);q['created'][i][k]=v;deny(raw,q)
 for _,dx,dy,_,_ in desc:
  d=doc();d['World']['GridCollection']['Grids']['77']['Objects']['101'].update(X=32+dx,Y=20+dy);a,q,_=bind(d,shape);deny(a,q)
 for mode in range(10):
  d=doc();g=d['World']['GridCollection']['Grids']['77'];route=d['Player']['ListInventories']['0']
  if mode==0:g['Objects']={}
  if mode==1:g['NextGridObjectID']=2147483646
  if mode==2:g['GridDefaultLayoutPath']='unknown'
  if mode==3:d['World']['GridCollection']['DiffGrids']['77']={}
  if mode==4:route['Inventory']['40700246']['Amount']=0
  if mode==5:route['Inventory']['40700246']['Amount']=10000
  if mode==6:route['CompatibleFurnitureTypes']['List']=['FurnitureItemType_Default']
  if mode==7:g['Objects']['101']['ID']=900
  if mode==8:g['Objects']['101']['X']='99'
  if mode==9:g['Objects']['0101']=g['Objects'].pop('101')
  a,q,_=bind(d,shape);deny(a,q)
 a,q,_=bind(doc(),shape,x=2147483646);deny(a,q)
 deny(raw,p,plan=b' '+wire(p));deny(raw,p,over={'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'});deny(raw,p,over={'WAND_LOCAL_FENCE_ADD_PLAN_SHA256':'d'*64});deny(raw,p,over={'WAND_LOCAL_DECODED_SHA256':'e'*64})
 assert (n,neg)==(24,35+len(desc)),(n,neg)
 print('QA1198',shape,n,'EXACT_LEXICAL_POS',neg,'NEG_EMPTY_STDOUT',flush=True)
