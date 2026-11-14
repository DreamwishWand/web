"""Synthetic-only independent Switch626 physical Collection readset oracle."""
import copy, hashlib, json, os, subprocess, sys, tempfile
from pathlib import Path
exe=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
BID="9A239D3DB569756D"; STEAM="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22"
DEF=2120000099; ITEM=40000891
def wire(v,sp=False):
 return json.dumps(v,ensure_ascii=False,separators=(', ',': ') if sp else (',',':')).encode()
def make(pos=1,sp=False,amt=1,extra_false=True):
 def o(v):return wire(v,sp)
 def joinobj(parts):return b'{'+(b', ' if sp else b',').join(o(k)+(b': ' if sp else b':')+v for k,v in parts)+b'}'
 def arr(parts):return b'['+(b', ' if sp else b',').join(parts)+b']'
 mp=joinobj([(str(ITEM+2),b'true'),(str(ITEM),b'false'),(str(ITEM+1),b'false' if extra_false else b'true')])
 state=o("SetState_NotComplete")
 g=joinobj([("Unknown",o({"keep":["雪",None]})),("GroupIndex",o(pos)),("GroupsCollectionItems",mp),("State",state)])
 groups=[o({"GroupIndex":i,"GroupsCollectionItems":{str(ITEM+10):True},"State":"Uninterpreted"}) for i in range(pos)]+[g]
 st=joinobj([("GroupData",arr(groups)),("CollectionDefinitionID",o(DEF))])
 other=o({"CollectionDefinitionID":DEF+1,"GroupData":[{"GroupsCollectionItems":{str(ITEM+11):False}}]})
 sets=arr([other,st])
 entry=joinobj([("Unknown",o([7,"星"])),("Marker",o("Keep")),("Amount",o(amt))])
 inv=joinobj([(str(ITEM+2),o({"Amount":2})),(str(ITEM),entry)])
 route=joinobj([("Inventory",inv),("CompatibleItemType",o("ItemType_Furniture")),("ID",b'0')])
 lists=joinobj([("4",o({"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":2}}})),("0",route)])
 player=joinobj([("ListInventories",lists),("CollectionSets",sets)])
 raw=joinobj([("Player",player),("GameInfo",o({"Version":626})),("World",o({"Ambient":{"keep":"星"}}))])
 return raw,dict(sets=sets,st=st,g=g,mp=mp,state=state,entry=entry,inv=inv,route=route,lists=lists)
def run(raw,path,pos=1,mode="--switch626-collection-furniture-receipt-only",definition=DEF,target=ITEM,over=None,args=None):
 env=dict(WAND_LOCAL_INSTALLED_SWITCH_BID=BID,WAND_LOCAL_ORIGINAL_SHA256=sha(b"Synthetic original placeholder"),WAND_LOCAL_ORIGINAL_SIZE_BYTES="128",WAND_LOCAL_DECODED_SHA256=sha(raw))
 env.update(over or {})
 return subprocess.run([str(exe),*(args or [mode,str(definition),str(pos),str(target),"--out",str(path)])],input=raw,env=env,capture_output=True,timeout=30)
false_keys=["packagedMembershipVerified","effectiveEligibilityVerified","ownershipVerified","rightsVerified","subscriberClosureVerified","nativeV3Verified","productReadAccepted","writerAuthorized","editedCopyAuthorized","applyAuthorized","cloudUploadPerformed","originalModifiedByHarness"]
with tempfile.TemporaryDirectory(prefix="qa1210-") as root:
 p=Path(root);p.chmod(0o700);n=0;neg=0
 for pos in (0,1,256):
  for sp in (False,True):
   amt=1 if not sp else 2147483647;raw,b=make(pos,sp,amt);out=p/f"pos-{n}.json"
   r=run(raw,out,pos);assert r.returncode==0 and not r.stdout,(pos,sp,r.stderr)
   assert r.stderr==b"LOCAL_RUST_V1_PRIVATE_COLLECTION_GROUP_RECEIPT_WRITTEN\n"
   v=json.loads(out.read_bytes());g=v["selectedGroup"];s=v["storedStock"];m=v["storedMemberships"]
   assert v["contract"]=="wand.native.private.switch626.furniture-collection-group-readset@1" and v["platform"]=="Switch" and v["buildKind"]=="SwitchBid" and v["buildId"]==BID and "fullVersion" not in v
   assert v["schema"]==626 and v["decodedSha256"]==sha(raw) and v["revision"]==0 and v["indexGeneration"]==1 and v["fullDocumentRustValidated"] is True
   assert v["setCount"]==2 and v["groupCount"]==pos+2 and v["scannedEntryCount"]==pos+4
   assert v["collectionSetsSha256"]==sha(b["sets"]) and v["targetItemId"]==ITEM
   assert (g["definitionId"],g["setPosition"],g["groupPosition"],g["storedGroupIndex"])==(DEF,1,pos,pos)
   assert (g["setSha256"],g["groupSha256"],g["mapSha256"])==(sha(b["st"]),sha(b["g"]),sha(b["mp"]))
   assert g["falseCount"]==2 and g["state"]["token"]=='"SetState_NotComplete"' and g["state"]["sha256"]==sha(b["state"]) and g["state"]["numericCode"] is None
   assert g["switchSavedNotCompleteMultiFalseShape"] is True and g["numericNotCompleteMultiFalseShape"] is False
   assert g["entries"]==[{"itemId":ITEM+2,"collected":True,"tokenSha256":sha(b"true")},{"itemId":ITEM,"collected":False,"tokenSha256":sha(b"false")},{"itemId":ITEM+1,"collected":False,"tokenSha256":sha(b"false")}]
   assert len(m)==1 and m[0]["groupSha256"]==sha(b["g"]) and m[0]["entrySha256"]==sha(b"false")
   assert s["inventoryId"]==0 and s["entry"]["amount"]==amt and s["entry"]["entrySha256"]==sha(b["entry"])
   assert (s["listSha256"],s["routeSha256"],s["inventorySha256"])==(sha(b["lists"]),sha(b["route"]),sha(b["inv"]))
   assert all(v[k] is False for k in false_keys) and out.stat().st_mode&0o777==0o600
   n+=1
 raw,b=make();d=json.loads(raw);bad=p/"deny.json"
 def deny(data=raw,**kw):
  global neg
  r=run(data,bad,**kw);assert r.returncode==12 and not r.stdout and not bad.exists(),(neg,r.returncode,r.stderr);neg+=1
 for x in ("52BD625D9B4E0053",BID.lower(),"", "wrong"):deny(over={"WAND_LOCAL_INSTALLED_SWITCH_BID":x})
 deny(over={"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":STEAM});deny(over={"WAND_LOCAL_DECODED_SHA256":"f"*64})
 for x in (0,2,257,"01","-1"):deny(pos=x)
 for x in (30000001,ITEM+99,"040000891"):deny(target=x)
 deny(definition=DEF+9);deny(mode="--collection-group-receipt-only",over={"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":STEAM})
 for case in range(18):
  z=copy.deepcopy(d);g=z["Player"]["CollectionSets"][1]["GroupData"][1];r=z["Player"]["ListInventories"]["0"];mp=g["GroupsCollectionItems"]
  if case==0:g["State"]=0
  if case==1:g["State"]="NotComplete"
  if case==2:g["State"]="SetState_Complete"
  if case==3:g.pop("State")
  if case==4:mp[str(ITEM)]=True
  if case==5:mp[str(ITEM+1)]=True
  if case==6:mp[str(ITEM)]=0
  if case==7:mp.pop(str(ITEM))
  if case==8:z["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"][str(ITEM)]=False
  if case==9:z["Player"]["CollectionSets"][1]["GroupData"][0]["GroupsCollectionItems"][str(ITEM)]=True
  if case==10:g["GroupIndex"]=0
  if case==11:r["Inventory"][str(ITEM)]["Amount"]=0
  if case==12:r["Inventory"][str(ITEM)]["Amount"]=1.0
  if case==13:r["Inventory"][str(ITEM)]["Amount"]=-1
  if case==14:r["ID"]=1
  if case==15:z["Player"]["ListInventories"]["7"]={"ID":7,"CompatibleItemType":"ItemType_Furniture","Inventory":{}}
  if case==16:r["CompatibleItemType"]="ItemType_ActivityItem"
  if case==17:z["Player"]["CollectionSets"][0]["GroupData"][0]["GroupsCollectionItems"]["40000002"]="false"
  deny(wire(z))
 deny(raw.replace(b'"SetState_NotComplete"',b'"SetState_NotComple\\u0074e"'))
 deny(raw.replace(b'"GroupIndex":1',b'"GroupIndex":1,"GroupIndex":1'))
 deny(raw.replace(b'"40000891":false',b'"40000891":false,"40000891":true'))
 deny(raw+b'\n{}')
 # The affected route must preserve existing create-new transport guarantees.
 saved=(p/"pos-0.json").read_bytes();x=run(raw,p/"pos-0.json");assert x.returncode==12 and not x.stdout and (p/"pos-0.json").read_bytes()==saved
 (p/"link").symlink_to(p/"pos-0.json");x=run(raw,p/"link");assert x.returncode==12 and not x.stdout and (p/"pos-0.json").read_bytes()==saved
 print("QA1210_SWITCH_COLLECTION",n,"POS",neg+2,"NEG_NO_STDOUT_NO_OVERWRITE",flush=True)
