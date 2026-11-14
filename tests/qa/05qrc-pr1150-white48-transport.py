# Independent synthetic mixed-profile transport; no real Save data.
import os, sys, json, hashlib, pathlib, tempfile, subprocess, copy, stat
NEW=str(pathlib.Path(sys.argv[1]).resolve()); OLD=str(pathlib.Path(sys.argv[2]).resolve())
H=lambda b:hashlib.sha256(b).hexdigest()
raw=lambda v:json.dumps(v,separators=(',',':')).encode()
W=40001838; O=40000053
def obj(i,c,item):
 return {"ID":i,"ItemID":item,"X":-7,"Y":9,"Orientation":"GridOrientation_Left","State":{"Storage":{"ContainerInventoryID":c,"DefaultContainerInventoryData":"","UnlockKeyItemID":0,"UnlockLocId":"","DesignID":None}}}
def cont(i,item,n,cap):
 return {"ID":i,"ParentItemID":item,"BelongsToPlayer":True,"BlockMoveTo":False,"Size":cap,"ExtraSize":0,"Inventory":[{"ItemID":0,"Amount":0,"State":None} for _ in range(n)]}
def fixture(n):
 a=cont(22,W,n,48); z=cont(31,O,1,16)
 if n:a["Inventory"][-1]={"ItemID":30200011,"Amount":5,"State":{"Opaque":[7,0]},"Future":True}
 return {"GameInfo":{"Version":626},"World":{"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"9":obj(9,22,W)}},"8":{"ID":8,"Objects":{"9":obj(9,31,O)}}},"DiffGrids":{"10":{"ID":10,"DefaultLayoutGridID":10,"ModifiedObjects":{},"RemovedObjects":[]}}}},"Player":{"ContainerInventories":{"22":a,"31":z,"42":{"ID":42,"ParentItemID":W},"43":{"ID":43,"ParentItemID":O}},"NextContainerInventoryID":100,"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{str(W):{"Amount":0,"Marker":None},str(O):{"Amount":13}}}}}}
def run(exe,root,doc,mode="--storage48-white-object",g="7",o="9",name="receipt",over=None):
 b=raw(doc);p=root/name
 aa=[mode,"--out",str(p)] if mode=="--storage-candidate" else [mode,str(g),str(o),"--out",str(p)]
 env={**os.environ,"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","WAND_LOCAL_ORIGINAL_SHA256":"b"*64,"WAND_LOCAL_ORIGINAL_SIZE_BYTES":"123","WAND_LOCAL_DECODED_SHA256":H(b),**(over or {})}
 r=subprocess.run([exe,*aa],input=b,env=env,capture_output=True,timeout=20)
 assert r.stdout==b"",r.stdout
 return r,p,b
def good(root,d,**kw):
 r,p,b=run(NEW,root,d,**kw);assert r.returncode==0,r.stderr;assert stat.S_IMODE(p.stat().st_mode)==0o600
 v=json.loads(p.read_bytes());assert v["decodedSha256"]==H(b);assert v["revision"]==0 and v["indexGeneration"]==1
 for k in ("rightsVerified","variationVerified","initializedGeometryVerified","nativeSubscriberClosureVerified","nativeV3Verified","productReadAccepted","writerAuthorized","editedCopyAuthorized","applyAuthorized","cloudUploadPerformed","originalModifiedByHarness"):assert v[k] is False,k
 for k in ("runtimeOrphanOrderVerified","effectiveDefaultGridVerified","effectiveSubgridParentClosureVerified","allEffectiveReferencesVerified"):assert v["storedReferences"][k] is False,k
 return v
def bad(root,d,**kw):
 r,p,b=run(NEW,root,d,**kw);assert r.returncode==12,r.stderr;assert not p.exists(),p
with tempfile.TemporaryDirectory(prefix="qa1150-") as td:
 root=pathlib.Path(td)
 for n in (0,1,47,48):
  d=fixture(n);v=good(root,d,name=f"w{n}")
  assert v["contract"]=="wand.native.private.storage48-white-stored-readset@1"
  assert v["target"]["itemId"]==W and v["target"]["gridId"]==7 and v["target"]["objectId"]==9
  c=v["container"];assert c["size"]==48 and c["physicalSlotCount"]==n and len(c["slots"])==n
  assert c["slotsSha256"]==H(raw(d["Player"]["ContainerInventories"]["22"]["Inventory"]))
  assert v["catalog"]["itemId"]==W and v["catalog"]["amount"]==0 and v["catalog"]["marker"]["sha256"]==H(b"null")
  assert [x["containerId"] for x in v["storedReferences"]["sameParentStoredUnmatchedContainers"]]==[42]
  assert len(v["storedReferences"]["links"])==2
  if n:assert c["slots"][-1]["position"]==n-1 and c["slots"][-1]["stateSha256"]==H(b'{"Opaque":[7,0]}')
  # Compare old16 complete receipt against parent binary for the same mixed doc.
  for mode in ("--storage-object","--storage-candidate"):
   r,p,b=run(OLD,root,d,mode=mode,g="8",name=f"old{n}{mode}");assert r.returncode==0,r.stderr
   old=json.loads(p.read_bytes());new=good(root,d,mode=mode,g="8",name=f"new{n}{mode}")
   assert old.pop("sessionId")!=new.pop("sessionId")
   assert old==new,(n,mode,old,new)
   assert old["contract"]=="wand.native.private.storage-stored-readset@1"
   assert old["target"]["itemId"]==O and old["container"]["size"]==16
   assert [x["containerId"] for x in old["storedReferences"]["sameParentStoredUnmatchedContainers"]]==[43]
 d=fixture(48);bad(root,d,g="8",name="wrongprofile");bad(root,d,mode="--storage-object",name="wrongold")
 bad(root,fixture(49),name="overflow")
 for i,(key,val) in enumerate([("Size",16),("Size",49),("ParentItemID",O),("ExtraSize",1),("BelongsToPlayer",False),("BlockMoveTo",True)]):
  d=fixture(1);d["Player"]["ContainerInventories"]["22"][key]=val;bad(root,d,name=f"role{i}")
 d=fixture(1);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]["ItemID"]=W+1;bad(root,d,name="wrongitem")
 d=fixture(1);del d["Player"]["ListInventories"]["0"]["Inventory"][str(W)];bad(root,d,name="wrongcatalog")
 d=fixture(1);d["World"]["GridCollection"]["Grids"]["8"]["Objects"]["9"]["State"]["Storage"]["ContainerInventoryID"]=22;bad(root,d,name="duplicate")
 d=fixture(1);d["World"]["GridCollection"]["DiffGrids"]["7"]={"ID":7,"RemovedObjects":[9]};bad(root,d,name="removed")
 d=fixture(1);d["World"]["GridCollection"]["DiffGrids"]["7"]={"ID":7,"ModifiedObjects":{"9":{"ID":9,"ItemID":W,"State":None}}};bad(root,d,name="modified")
 d=fixture(1);d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]["State"]["Storage"]["DefaultContainerInventoryData"]="Furniture_48Slot";bad(root,d,name="template")
 d=fixture(1);del d["Player"]["ContainerInventories"]["22"];bad(root,d,name="dangling")
 for i,g in enumerate(("+7","07","-1","9007199254740992")):bad(root,fixture(1),g=g,name=f"selector{i}")
 bad(root,fixture(1),over={"WAND_LOCAL_DECODED_SHA256":"f"*64},name="sha")
 # Same path replay remains denied and preserves original receipt.
 p=root/"w48";before=p.read_bytes();r,_,_=run(NEW,root,fixture(48),name="w48");assert r.returncode==12 and p.read_bytes()==before
print("QA1150_WHITE48_MIXED_4POS_8_OLD16_EXACT_COMPARE_21NEG_REPLAY_PASS")
