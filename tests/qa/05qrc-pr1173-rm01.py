"""Synthetic only. Actual existing RM01 native CLI and independent lexical oracle."""
import copy,hashlib,json,os,subprocess,sys
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def obj(i,x,y,d=False):return dict(ID=i,ItemID=40100068,X=x,Y=y,Orientation="GridOrientation_Down",State={"FenceMode":{"Diagonal":True}} if d else None)
# Distinct IDs/coords, raw lexical whitespace and unknowns deliberately retained.
d={"GameInfo":{"Version":624},"World":{"Ambient":{"Token":"雪","Number":1.25},"GridCollection":{"DiffGrids":{},"Grids":{"77":{"ID":77,"TessellationFactor":2,"GridDefaultLayoutPath":"","NextGridObjectID":900,"Objects":{"101":obj(101,16,8),"103":obj(103,20,8),"107":{"ID":107,"ItemID":40000001,"X":99,"Y":99,"Unknown":{"Keep":[None,True,"星"]}}}}}}},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100068":{"Amount":4,"Marker":"keep","Unknown":{"nested":[7,None]}}}}}}}
def fixture(doc=d):
 raw=wire(doc)
 g=doc["World"]["GridCollection"]["Grids"]["77"]
 entry=doc["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]
 p=dict(contract="wand.private.switch624.road-rm01-archive@1",sourceDecodedSha256=sha(raw),gridId=77,retainedId=101,movedId=103,expectedNextId=g["NextGridObjectID"],expectedAmount=entry["Amount"],gridSha256=sha(wire(g)),inventoryEntrySha256=sha(wire(entry)),objects=[obj(101,16,8),obj(103,24,12,True),obj(900,20,8,True),obj(901,20,12,True),obj(902,24,8,True)])
 return raw,p
def run(raw,p,env=None,argv=None,plan_raw=None):
 plan=wire(p) if plan_raw is None else plan_raw
 e=dict(WAND_LOCAL_INSTALLED_SWITCH_BID="52BD625D9B4E0053",WAND_LOCAL_ORIGINAL_SHA256=sha(b"synthetic encrypted placeholder"),WAND_LOCAL_ORIGINAL_SIZE_BYTES="128",WAND_LOCAL_DECODED_SHA256=sha(raw),WAND_LOCAL_RM01_CANONICAL_PLAN=plan.decode(),WAND_LOCAL_RM01_PLAN_SHA256=sha(plan))
 e.update(env or {})
 return subprocess.run([str(exe),"--switch624-road-rm01-archive-only",*(argv or [])],input=raw,env=e,capture_output=True,timeout=30)
raw,p=fixture()
# A real lexical oracle: retain original map order, replace only moved object,
# append the 3 new records at the closing brace and debit/counter once.
g=d["World"]["GridCollection"]["Grids"]["77"]; om=wire(g["Objects"])
newom=om.replace(wire(obj(103,20,8)),wire(obj(103,24,12,True)))
newom=newom[:-1]+b''.join(b',"'+str(o["ID"]).encode()+b'":'+wire(o) for o in p["objects"][2:])+b'}'
expect=raw.replace(om,newom).replace(b'"NextGridObjectID":900',b'"NextGridObjectID":903').replace(b'"Amount":4',b'"Amount":1')
r=run(raw,p);assert r.returncode==0,(r.returncode,r.stderr)
assert r.stderr==b'PRIVATE_V2_SWITCH624_RM01_ARCHIVE_EXACT8_PIPE_PASS\n'
assert r.stdout==expect,(r.stdout,expect)
assert run(raw,p).stdout==expect
v=json.loads(r.stdout);g2=v["World"]["GridCollection"]["Grids"]["77"]
assert g2["Objects"]["107"]==g["Objects"]["107"] and g2["Objects"]["101"]==g["Objects"]["101"]
assert v["World"]["Ambient"]==d["World"]["Ambient"]
assert v["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Unknown"]==d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Unknown"]
# Invalid plans are resealed independently, not just rejected by hash.
neg=0
def deny(raw,p,**kw):
 global neg
 x=run(raw,p,**kw);assert x.returncode==12 and not x.stdout,(x.returncode,x.stderr);neg+=1
for k,v in [("expectedNextId",901),("expectedAmount",5),("retainedId",103),("movedId",101),("gridId",78),("sourceDecodedSha256","a"*64),("gridSha256","b"*64),("inventoryEntrySha256","c"*64),("writerAuthorized",True),("expectedAmount",4.0),("objects",p["objects"][::-1])]:
 q=copy.deepcopy(p);q[k]=v;deny(raw,q)
for i,k,v in [(1,"State",{"FenceMode":{"Diagonal":True,"Unknown":1}}),(2,"ID",901),(3,"X",21),(4,"Orientation","GridOrientation_Up")]:
 q=copy.deepcopy(p);q["objects"][i][k]=v;deny(raw,q)
for k,v in [("WAND_LOCAL_INSTALLED_SWITCH_BID","9A239D3DB569756D"),("WAND_LOCAL_DECODED_SHA256","1"*64),("WAND_LOCAL_RM01_PLAN_SHA256","2"*64),("WAND_LOCAL_ORIGINAL_SHA256","0"*64),("WAND_LOCAL_ORIGINAL_SIZE_BYTES","0")]:deny(raw,p,env={k:v})
deny(raw,p,argv=["extra"]);deny(raw,p,plan_raw=b' '+wire(p))
for mode in range(8):
 z=copy.deepcopy(d);gg=z["World"]["GridCollection"]["Grids"]["77"]
 if mode==0:z["World"]["GridCollection"]["DiffGrids"]["77"]={}
 if mode==1:gg["GridDefaultLayoutPath"]="unknown"
 if mode==2:gg["Objects"]["107"]["X"]=24;gg["Objects"]["107"]["Y"]=12
 if mode==3:gg["Objects"]["103"]["State"]={}
 if mode==4:gg["Objects"]["107"]["ID"]=900
 if mode==5:z["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=3
 if mode==6:gg["NextGridObjectID"]=2147483646
 if mode==7:gg["TessellationFactor"]=1
 a,q=fixture(z);deny(a,q)
print("QA1173_NATIVE_EXACT_LEXICAL_8PATHS_1POS",sha(expect),"NEG",neg,"EMPTY_STDOUT")
