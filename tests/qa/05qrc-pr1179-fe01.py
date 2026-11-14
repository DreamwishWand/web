"""Independent FE01 lexical member permutation and route isolation; synthetic only."""
import copy,hashlib,itertools,json,subprocess,sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def obj(i,item,x,y):return dict(ID=i,ItemID=item,X=x,Y=y,Orientation="GridOrientation_Down" if item==40700246 else "GridOrientation_Left",State=None)
records={"101":obj(101,40700246,24,8),"103":obj(103,40700252,24,10),"105":obj(105,40700246,24,22),"107":obj(107,40700246,24,24),"109":{"ID":109,"ItemID":40000001,"X":99,"Y":99,"Unknown":{"Preserve":[None,"雪",7]}}}
doc={"GameInfo":{"Version":624},"World":{"Ambient":{"keep":"星"},"GridCollection":{"DiffGrids":{},"Grids":{"77":{"ID":77,"TessellationFactor":2,"GridDefaultLayoutPath":"","NextGridObjectID":900,"Objects":records}}}},"Player":{"ListInventories":{"0":{"Inventory":{"40700246":{"Amount":17,"Marker":"Keep","Unknown":True}}}}}}
created=[obj(900,40700248,24,10),obj(901,40700246,24,14),obj(902,40700246,24,18),obj(903,40700248,24,20)]
def fixture(order=None,d=doc):
 g=d["World"]["GridCollection"]["Grids"]["77"];o=g["Objects"];order=order or list(o)
 old=wire(o);new=b'{'+b','.join(wire(k)+b':'+wire(o[k]) for k in order)+b'}'
 grid=wire(g).replace(old,new);raw=wire(d).replace(wire(g),grid)
 p=dict(contract="wand.private.switch624.fence-fe01-archive@1",layout="PRESERVE_EXISTING",sourceDecodedSha256=sha(raw),gridId=77,expectedNextId=g["NextGridObjectID"],gridSha256=sha(grid),retainedIds=[101,107],deletedIds=[103,105],created=created)
 return raw,p,new
def run(raw,p,mode="--switch624-fence-fe01-archive-only",env=None,plan=None):
 b=wire(p) if plan is None else plan
 e=dict(WAND_LOCAL_INSTALLED_SWITCH_BID="52BD625D9B4E0053",WAND_LOCAL_ORIGINAL_SHA256=sha(b"synthetic placeholder"),WAND_LOCAL_ORIGINAL_SIZE_BYTES="128",WAND_LOCAL_DECODED_SHA256=sha(raw),WAND_LOCAL_FE01_CANONICAL_PLAN=b.decode(),WAND_LOCAL_FE01_PLAN_SHA256=sha(b))
 e.update(env or {})
 return subprocess.run([str(exe),mode],input=raw,env=e,capture_output=True,timeout=30)
n=0
for order in itertools.permutations(records):
 raw,p,old=fixture(order)
 new=b'{'+b','.join([wire(k)+b':'+wire(records[k]) for k in order if k not in ('103','105')]+[wire(str(o["ID"]))+b':'+wire(o) for o in created])+b'}'
 expect=raw.replace(old,new).replace(b'"NextGridObjectID":900',b'"NextGridObjectID":904')
 r=run(raw,p);assert r.returncode==0,(order,r.stderr);assert r.stderr==b'PRIVATE_V2_SWITCH624_FE01_ARCHIVE_PRESERVE7_PIPE_PASS\n'
 assert r.stdout==expect,(order,r.stdout,expect)
 v=json.loads(r.stdout);assert v["Player"]==doc["Player"] and v["World"]["Ambient"]==doc["World"]["Ambient"]
 n+=1
print("QA1179_EXACT_LEXICAL_120_PERMUTATIONS_PRESERVE7_PLAYER_PASS",n)
raw,p,_=fixture();neg=0
def deny(raw,p,**kw):
 global neg
 r=run(raw,p,**kw);assert r.returncode==12 and not r.stdout,(r.returncode,r.stderr);neg+=1
for k,v in [("layout","EXPLICIT_USER_LAYOUT"),("expectedNextId",901),("retainedIds",[101,101]),("deletedIds",[103,107]),("gridId",78),("gridSha256","a"*64),("sourceDecodedSha256","b"*64),("created",created[::-1]),("refund",1),("inventoryDelta",1),("writerAuthorized",True)]:
 q=copy.deepcopy(p);q[k]=v;deny(raw,q)
for i,k,v in [(0,"ID",901),(1,"X",25),(2,"State",{}),(3,"ItemID",40700252)]:
 q=copy.deepcopy(p);q["created"][i][k]=v;deny(raw,q)
deny(raw,p,plan=b' '+wire(p));deny(raw,p,env={"WAND_LOCAL_INSTALLED_SWITCH_BID":"9A239D3DB569756D"});deny(raw,p,env={"WAND_LOCAL_FE01_PLAN_SHA256":"c"*64})
# The sibling RM01 route must not accept a FE01 plan even if its own env is populated.
deny(raw,p,mode="--switch624-road-rm01-archive-only",env={"WAND_LOCAL_RM01_CANONICAL_PLAN":wire(p).decode(),"WAND_LOCAL_RM01_PLAN_SHA256":sha(wire(p))})
for mode in range(6):
 d=copy.deepcopy(doc);g=d["World"]["GridCollection"]["Grids"]["77"]
 if mode==0:g["Objects"]["103"]["State"]={"Unknown":7}
 if mode==1:g["Objects"]["109"]["X"]=24;g["Objects"]["109"]["Y"]=16
 if mode==2:g["NextGridObjectID"]=2147483645
 if mode==3:g["GridDefaultLayoutPath"]="unknown"
 if mode==4:d["World"]["GridCollection"]["DiffGrids"]["77"]={}
 if mode==5:g["Objects"]["109"]["ID"]=900
 a,q,_=fixture(d=d);deny(a,q)
print("QA1179_RESEALED",neg,"NEG_EMPTY_STDOUT_CROSS_ROUTE_DENIED")
