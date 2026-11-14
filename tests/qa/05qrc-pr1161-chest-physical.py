"""Independent synthetic native Chest receipt and exclusive output tests."""
import copy,hashlib,json,os,subprocess,sys,tempfile,concurrent.futures
from pathlib import Path
bin=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
ITEM=30200001
def row(amount,state,item=ITEM):return dict(ItemID=item,Amount=amount,State=state)
def container(id,owner,slots,size,extra=0,**kw):return dict(ID=id,BelongsToPlayer=owner,Size=size,ExtraSize=extra,Inventory=slots,**kw)
doc={"GameInfo":{"Version":626},"Player":{"ContainerInventories":{
 "0":container(0,True,[row(3,None),row(4,{})],2),
 "1":container(1,True,[row(2,{"Opaque":7})],1),
 "12":container(12,True,[row(5,None),row(0,None,0)],3,1,ParentItemID=40000053,BlockMoveTo=False),
 "13":container(13,False,[row(6,None),row(7,{"Other":True})],2),
 "14":container(14,True,[],48),
 "15":container(15,True,[row(11,None),row(13,{"Unknown":[None,"雪"]})],2,1)
}},"World":{"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":40000053,"X":2,"Y":1,"Orientation":"GridOrientation_Up","State":{"Storage":{"ContainerInventoryID":12}}}}}}}}}
def invoke(d,out,selector=("12","0"),entry=None,patch=None,raw=None):
 data=wire(d) if raw is None else raw
 e=dict(WAND_LOCAL_INSTALLED_STEAM_FULLVERSION="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22",WAND_LOCAL_ORIGINAL_SHA256=sha(b'synthetic-placeholder'),WAND_LOCAL_ORIGINAL_SIZE_BYTES="128",WAND_LOCAL_DECODED_SHA256=sha(data))
 e.update(patch or {})
 h=entry or sha(wire(d["Player"]["ContainerInventories"]["12"]["Inventory"][0]))
 return subprocess.run([str(bin),"--chest-amount-dependencies",*selector,h,"--out",str(out)],input=data,env=e,capture_output=True,timeout=30)
with tempfile.TemporaryDirectory(prefix="qa1161-") as root:
 p=Path(root);p.chmod(0o700);out=p/"receipt.json"
 r=invoke(doc,out);assert r.returncode==0,(r.returncode,r.stderr);assert not r.stdout
 v=json.loads(out.read_bytes());t=v["savedPhysicalTotals"]
 assert v["contract"]=="wand.native.private.chest-amount-dependencies@1"
 assert (v["target"]["containerId"],v["target"]["slotIndex"],v["target"]["oldAmount"])==(12,0,5)
 assert v["target"]["entrySha256"]==sha(wire(doc["Player"]["ContainerInventories"]["12"]["Inventory"][0]))
 assert (t["ownedExplicitNullPhysicalAmount"],t["ownedOtherStatePhysicalAmount"],t["nonOwnedPhysicalAmount"])==(19,19,13)
 assert (t["physicalContainerCount"],t["physicalSlotsScanned"],len(t["matches"]))==(6,9,8)
 matches={(x["containerId"],x["slotIndex"]):x for x in t["matches"]}
 assert len(matches)==8
 for (id,pos),x in matches.items():
  c=doc["Player"]["ContainerInventories"][str(id)];z=c["Inventory"][pos]
  assert x["entrySha256"]==sha(wire(z)) and x["stateSha256"]==sha(wire(z["State"]))
  assert x["containerSha256"]==sha(wire(c)) and x["slotsSha256"]==sha(wire(c["Inventory"]))
  assert x["inUsableCapacity"]==(pos<c["Size"]-c["ExtraSize"])
  assert x["physicalRole"]==({0:"BACKPACK_PHYSICAL",1:"HOME_STORAGE_PHYSICAL"}.get(id,"OTHER_PHYSICAL"))
 assert not matches[(15,1)]["inUsableCapacity"]
 assert v["parentPlacementReadSet"]["matches"][0]["gridId"]==7
 for k in ["allEffectiveContainerLinksVerified","runtimeOrphanOrderVerified","effectiveItemDbVerified","rightsVerified","variationVerified","nativeV3Verified","productReadAccepted","writerAuthorized","editedCopyAuthorized","applyAuthorized"]:assert v[k] is False,k
 for k in ["nativeEffectiveTotalVerified","nativeStateEquivalenceVerified","pantryOverflowEffectiveVerified"]:assert t[k] is False,k
 assert out.stat().st_mode&0o777==0o600
 saved=out.read_bytes()
 assert invoke(doc,out).returncode!=0 and out.read_bytes()==saved
 neg=0
 for sel,h,env in [(("012","0"),None,None),(("12","+0"),None,None),(("0","0"),None,None),(("1","0"),None,None),(("12","1"),None,None),(("12","0"),"1"*64,None),(("12","0"),None,{"WAND_LOCAL_DECODED_SHA256":"1"*64}),(("12","0"),None,{"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":"Switch"})]:
  f=p/f"neg{neg}.json";r=invoke(doc,f,sel,h,env);assert r.returncode!=0 and not r.stdout and not f.exists();neg+=1
 for id,k,val in [("0","ID",1),("13","BelongsToPlayer","true"),("14","Size",16385),("15","ExtraSize",3),("1","Inventory",[row(2,None),row(1,None)]),("13","Inventory",[row(0,None)]),("13","Inventory",[row(5,True)]),("13","Inventory",[{"ItemID":ITEM,"Amount":5}]),("12","Inventory",[row(5,{})])]:
  d=copy.deepcopy(doc);d["Player"]["ContainerInventories"][id][k]=val
  f=p/f"neg{neg}.json";r=invoke(d,f);assert r.returncode!=0 and not r.stdout and not f.exists(),(id,k,r.stderr);neg+=1
 # container bound, using empty physical containers so no invented slots.
 d=copy.deepcopy(doc);cs=d["Player"]["ContainerInventories"]
 for id in range(100,100+4096):cs[str(id)]=container(id,True,[],0)
 f=p/"limit.json";r=invoke(d,f);assert r.returncode!=0 and not r.stdout and not f.exists();neg+=1
 # exact output path collision, symlink, hardlink and simultaneous calls.
 link=p/"link.json";link.symlink_to(out);assert invoke(doc,link).returncode!=0 and link.is_symlink() and out.read_bytes()==saved
 hard=p/"hard.json";os.link(out,hard);assert invoke(doc,hard).returncode!=0 and hard.read_bytes()==saved
 race=p/"race.json"
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as e:rs=list(e.map(lambda _:invoke(doc,race),range(2)))
 assert sorted(x.returncode for x in rs)==[0,12] and all(not x.stdout for x in rs)
 assert json.loads(race.read_bytes())["target"]["entrySha256"]==v["target"]["entrySha256"]
 print(f"QA1161_ACTUAL_NATIVE_PHYSICAL_8_MATCHES_9_SLOTS_3_TOTALS_{neg}NEG_RACE_PASS")
