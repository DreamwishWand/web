# Public synthetic only; execute actual fixed parent and changed private CLI.
import os,sys,json,hashlib,subprocess,pathlib,copy
NEW=str(pathlib.Path(sys.argv[1]).resolve());OLD=str(pathlib.Path(sys.argv[2]).resolve())
H=lambda b:hashlib.sha256(b).hexdigest()
raw=lambda v:json.dumps(v,separators=(',',':')).encode()
canonical=lambda v:json.dumps(v,sort_keys=True,separators=(',',':')).encode()
A=30000089; F=40300011
def doc(n):
 return {"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Door","FurnitureItemType_Default"]},"Inventory":{str(F):{"Amount":n,"Marker":None,"Unknown":{"keep":True}}}},"17":{"ID":17,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{str(A):{"Amount":n,"Marker":None,"Unknown":{"keep":True}}}}}}}
def run(exe,d,route,item,mode="--inventory-amount-backup-only",over=None):
 b=raw(d);env={**os.environ,"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","WAND_LOCAL_ORIGINAL_SHA256":"b"*64,"WAND_LOCAL_ORIGINAL_SIZE_BYTES":"123","WAND_LOCAL_DECODED_SHA256":H(b),"WAND_LOCAL_INVENTORY_ID":str(route),"WAND_LOCAL_CANONICAL_ITEM_ID":str(item),"WAND_LOCAL_COMPATIBLE_ITEM_TYPE":"ItemType_Furniture" if route==0 else "ItemType_ActivityItem","WAND_LOCAL_EXPECTED_OLD_AMOUNT":"2","WAND_LOCAL_NEW_AMOUNT":"1",**(over or {})}
 return subprocess.run([exe,mode],input=b,env=env,capture_output=True,timeout=20)
def bad(d,route,item,**kw):
 p=run(NEW,d,route,item,**kw);assert p.returncode!=0 and p.stdout==b"",p.stderr
for n in (1,2,9999):
 d=doc(n)
 for route,item in ((17,A),(0,F)):
  p=run(NEW,d,route,item);assert p.returncode==0,p.stderr
  v=json.loads(p.stdout);assert p.stdout==canonical(v);h=v.pop("sha256");assert h==H(canonical(v))
  assert v["target"]=={"inventoryId":route,"itemId":item}
  assert v["provenance"]["decodedSha256"]==H(raw(d))
  entry=d["Player"]["ListInventories"][str(route)]["Inventory"][str(item)]
  assert v["payload"]["amount"]==n and v["payload"]["entrySha256"]==H(raw(entry))
  assert set(v["payload"])=={"amount","entrySha256","itemType"}
  assert b"Unknown" not in p.stdout and b"keep" not in p.stdout
  if n>=2 and route==17:
   q=run(OLD,d,route,item);assert q.returncode==0 and p.stdout==q.stdout,q.stderr
  else:
   q=run(OLD,d,route,item);assert q.returncode!=0 and q.stdout==b"",q.stderr
for route,item in ((17,A),(0,F)):
 for n in (0,10000):bad(doc(n),route,item)
 bad(doc(1),route,item,mode="--semantic-inventory-existing-decrease-only",over={"WAND_LOCAL_EXPECTED_OLD_AMOUNT":"1","WAND_LOCAL_NEW_AMOUNT":"0"})
 # Existing legacy private Writer CLI accepts positive route IDs only.
 # Zero-route Backup does not expand that CLI's authority.
 d=doc(2);old=run(OLD,d,route,item,mode="--semantic-inventory-existing-decrease-only");new=run(NEW,d,route,item,mode="--semantic-inventory-existing-decrease-only")
 if route==0:
  assert old.returncode==new.returncode!=0 and old.stdout==new.stdout==b""
  assert old.stderr==new.stderr==b"PRIVATE_V2_DENIED:SEMANTIC_EXPECTED_DECIMAL_ID\n"
 else:
  assert old.returncode==new.returncode==0,(old.stderr,new.stderr)
  assert old.stdout==new.stdout
  expected=copy.deepcopy(d);expected["Player"]["ListInventories"][str(route)]["Inventory"][str(item)]["Amount"]=1
  assert new.stdout==raw(expected)
bad(doc(1),0,A);bad(doc(1),17,F)
for i,mask in enumerate(({"List":["FurnitureItemType_Default"]},{"List":["FurnitureItemType_Door","FurnitureItemType_Door"]},{"List":["FurnitureItemType_Door"],"Other":True},{"List":["FurnitureItemType_Future"]})):
 d=doc(1);d["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]=mask;bad(d,0,F)
d=doc(1);d["Player"]["ListInventories"]["0"]["ID"]=1;bad(d,0,F)
d=doc(1);d["Player"]["ListInventories"]["0"]["CompatibleItemType"]="ItemType_ActivityItem";bad(d,0,F)
d=doc(1);d["Player"]["ContainerInventories"]={"0":d["Player"]["ListInventories"].pop("0")};bad(d,0,F)
for route in ("00","+0","-0","4294967296"):bad(doc(1),route,F)
for item in ("0","040300011","+40300011","4294967296"):bad(doc(1),0,item)
bad(doc(1),0,F,over={"WAND_LOCAL_DECODED_SHA256":"f"*64})
bad(doc(1),0,F,over={"WAND_LOCAL_INSTALLED_STEAM_FULLVERSION":"wrong"})
print("QA1155_6POS_2_PARENT_BACKUP_EQ_1_PARENT_WRITER_EQ_1_ZERO_WRITER_DENY_EQ_25NEG_PASS")
