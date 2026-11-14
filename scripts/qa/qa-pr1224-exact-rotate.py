"""Independent synthetic lexical oracle for exact same-anchor SubGrid rotate, two builds."""
import copy, hashlib, itertools, json, subprocess, sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
def wire(v,sp=False,sort=False):return json.dumps(v,ensure_ascii=False,sort_keys=sort,separators=(', ',': ') if sp else (',',':')).encode()
def doc(x=32,y=20):
 return {'GameInfo':{'Version':626},'World':{'GridCollection':{'DiffGrids':{},'Grids':{'77':{'ID':77,'TessellationFactor':2,'GridDefaultLayoutPath':'','NextGridObjectID':900,'Objects':{'101':{'ID':101,'ItemID':40000178,'X':x,'Y':y,'Orientation':'GridOrientation_Up','State':{'SubGrid':{'GridID':88,'DesignID':None}},'Opaque':['雪','GridOrientation_Up']},'103':{'ID':103,'ItemID':40000001,'X':44,'Y':44,'Orientation':'GridOrientation_Up','State':{'Other':True}},'105':{'ID':105,'ItemID':40000001,'Unknown':{'keep':'星'}}}},'88':{'ID':88,'NextGridObjectID':0,'GridDefaultLayoutPath':'','Objects':{},'Opaque':[None,'月']}}},'Ambient':{'keep':True}},'Player':{'Inventory':{'keep':[1,2,3]}}}
def contract(steam):return 'wand.private.'+('steam' if steam else 'switch')+'626.subgrid-same-anchor-up-right@1'
def bind(d,steam,sp=False):
 gc=d['World']['GridCollection'];g=gc['Grids']['77'];o=g['Objects']['101'];c=gc['Grids']['88'];raw=wire(d,sp)
 p=dict(contract=contract(steam),sourceDecodedSha256=sha(raw),gridCollectionSha256=sha(wire(gc,sp)),gridId=77,gridSha256=sha(wire(g,sp)),objectId=101,objectSha256=sha(wire(o,sp)),itemId=40000178,expectedX=o['X'],expectedY=o['Y'],expectedNextId=g['NextGridObjectID'],childId=88,childSha256=sha(wire(c,sp)),expectedOrientation='GridOrientation_Up',newOrientation='GridOrientation_Right')
 return raw,p,wire(o,sp)
def run(raw,p,steam,over=None,plan=None,mode=None):
 b=wire(p,sort=True) if plan is None else plan
 e={'WAND_LOCAL_INSTALLED_STEAM_FULLVERSION':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'} if steam else {'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'}
 e.update(WAND_LOCAL_ORIGINAL_SHA256=sha(b'Synthetic original placeholder'),WAND_LOCAL_ORIGINAL_SIZE_BYTES='128',WAND_LOCAL_DECODED_SHA256=sha(raw),WAND_LOCAL_SUBGRID_ROTATE_CANONICAL_PLAN=b.decode(),WAND_LOCAL_SUBGRID_ROTATE_PLAN_SHA256=sha(b));e.update(over or {})
 return subprocess.run([str(exe),mode or ('--steam' if steam else '--switch')+'626-subgrid-same-anchor-rotate-only'],input=raw,env=e,capture_output=True,timeout=30)
for steam in (True,False):
 n=neg=0
 for x,y in [(32,20),(0,2147483647)]:
  for order in itertools.permutations(['101','103','105']):
   for sp in (False,True):
    d=doc(x,y);g=d['World']['GridCollection']['Grids']['77'];g['Objects']={k:g['Objects'][k] for k in order};a,p,o=bind(d,steam,sp);r=run(a,p,steam)
    assert r.returncode==0,(steam,x,y,order,r.stderr)
    assert r.stdout==a.replace(o,o.replace(b'"GridOrientation_Up"',b'"GridOrientation_Right"',1)),r.stdout
    assert r.stderr==b'PRIVATE_V2_SUBGRID_SAME_ANCHOR_ROTATE_EXACT1_PIPE_PASS\n';n+=1
 a,p,_=bind(doc(),steam)
 def deny(a,p,**kw):
  global neg
  r=run(a,p,steam,**kw);assert r.returncode==12 and not r.stdout,(steam,neg,r.returncode,r.stderr);neg+=1
 for k,v in [('contract',contract(not steam)),('sourceDecodedSha256','a'*64),('gridCollectionSha256','b'*64),('gridSha256','c'*64),('objectSha256','d'*64),('childSha256','e'*64),('gridId',78),('objectId',103),('itemId',40000001),('expectedX',33),('expectedY',21),('expectedNextId',901),('childId',89),('expectedOrientation','GridOrientation_Left'),('newOrientation','GridOrientation_Down'),('newX',33),('writerAuthorized',True)]:
  q=copy.deepcopy(p);q[k]=v;deny(a,q)
 for i in range(17):
  d=doc();gc=d['World']['GridCollection'];g=gc['Grids']['77'];o=g['Objects']['101'];c=gc['Grids']['88']
  if i==0:d['GameInfo']['Version']=624
  if i==1:o['State']['SubGrid']['DesignID']=1
  if i==2:o['State']['SubGrid']['GridID']=89
  if i==3:o['State']['Other']=True
  if i==4:o['State']['SubGrid'].pop('DesignID')
  if i==5:c['Objects']['1']={'ID':1}
  if i==6:c['NextGridObjectID']=1
  if i==7:c['GridDefaultLayoutPath']='other'
  if i==8:gc['DiffGrids']['77']={}
  if i==9:gc['DiffGrids']['88']={}
  if i==10:o['Orientation']='GridOrientation_Right'
  if i==11:g['ID']=78
  if i==12:o['ID']=102
  if i==13:c['ID']=89
  if i==14:g['TessellationFactor']=3
  if i==15:o['X']=-1
  if i==16:g['NextGridObjectID']=101
  b,q,_=bind(d,steam);deny(b,q)
 deny(a,p,plan=b' '+wire(p,sort=True));deny(a,p,over={'WAND_LOCAL_SUBGRID_ROTATE_PLAN_SHA256':'0'*64});deny(a,p,over={'WAND_LOCAL_DECODED_SHA256':'0'*64})
 deny(a,p,over={'WAND_LOCAL_INSTALLED_SWITCH_BID':'9A239D3DB569756D'} if steam else {'WAND_LOCAL_INSTALLED_STEAM_FULLVERSION':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'})
 deny(a,p,mode=('--switch' if steam else '--steam')+'626-subgrid-same-anchor-rotate-only')
 assert (n,neg)==(24,39)
 print('QA1224', 'steam' if steam else 'switch',n,'EXACT_LEXICAL_POS',neg,'NEG_EMPTY_STDOUT',flush=True)
