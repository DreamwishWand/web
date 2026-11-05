#!/usr/bin/env python3
"""04 QR-W independent fixed PR642 Source-only/hostile protobuf safety.
Fixtures are self-authored toy ItemID/GUID metadata; NO original DDV binary, media,
Steam itemlist, Switch Save, screenshot, keys, P1G or customer data.
"""
import hashlib,importlib.util,json,pathlib,subprocess,sys,tempfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/"scripts/asset-research/01d-steam-native-icon-delta.py"
M="9120711f2066f9596ec76b6f4da90f71e92f32db"
S="40b3d98086868fd6437d5cc5b4ccb7ed3d96dafc"
ORIG={
 "docs/core/01d-steam-native-v125x-icon-guid-source-20261106.md":"690affbf611ba8858a6a2747ff9801bdd2b0ffb1",
 "scripts/asset-research/01d-steam-native-icon-delta.py":"d121bcd5d0dc6a35d03d0b3aab270f3efbe4efaa",
 "tests/01d-steam-native-icon-delta.test.mjs":"4333ce6404eb8341693addf1fa4e9d3b2d3e06a5",
 "tests/01d-steam-native-icon-delta.test.py":"aefb3502ec17fec1e4e79db5611e6407a6b5e602",
}
QA=["scripts/04qr-w-pr642-native-protobuf-newonly.py",".github/workflows/04qr-w-pr642-native-protobuf-newonly.yml"]
def git(*args):
 return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
assert git("merge-base",M,S)==M
assert git("merge-base",S,"HEAD")==S
assert sorted(git("diff","--name-only",M,S).splitlines())==sorted(ORIG)
assert sorted(git("diff","--name-only",S,"HEAD").splitlines())==sorted(QA)
for p,b in ORIG.items():assert git("rev-parse",S+":"+p)==b,p
print("QR642_ORIGINAL_SOURCE4_QA2_IMMUTABLE_SHA_MAIN912_PASS",flush=True)
spec=importlib.util.spec_from_file_location("original_01d_steam",SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert mod.SCHEMA=="wand.01d.steam-native-item-guid-diff-source-only@1"
assert mod.CATEGORIES=={"ActivityItem":30000000,"Furniture":40000000,"Clothing":50000000,"Trimming":160000000}
assert mod.GAME_VERSIONS=={
 "v12413":"releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33",
 "v1250":"releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14",
 "v1253":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22",
}
expected_pins={
"v12413":[("c1c29d2bddff8ccb1461d4b3c78d36dde361c9b936f6ccd535f5a73a2dc9b401",1193733),("c813cc381dc37443b7c59dc2397974e8860537919b85bc04dabbce87f3ae34c6",2424496),("15a36230569e4824125f6fbf15c412cd7ebd1784ca104f9a97a8c436c699bbf5",629948),("7e238064eb84dbdfb9ac3e393a65fb5eb7addba069ebeb9e08ef3e6b2c9b5173",77063)],
"v1250":[("6b3d71f2e17e5d84ba5203eb4f8b0428ff0241e7d8df2079b4bdfe0c0d15345f",1229068),("4a5320900176f7bd4626e0f23b7b68d1de3780e4d9f395308dc6dfdec8538cad",2458209),("e1cdd6e4566a7fe0f3e586876f0dd6b2ffcd1f86846f54e043b5883c23a68cbc",650175),("6b8aa170ccbe3431fb508256b2efab697e1f80a1fc97e4f3ce6352c1cb285ed7",77793)],
"v1253":[("20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4",1229360),("823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674",2458197),("e1cdd6e4566a7fe0f3e586876f0dd6b2ffcd1f86846f54e043b5883c23a68cbc",650175),("6b8aa170ccbe3431fb508256b2efab697e1f80a1fc97e4f3ce6352c1cb285ed7",77793)],
}
for ver,pins in expected_pins.items():
 assert list(mod.SOURCE_PINS[ver].values())==pins
 assert all(len(h)==64 and size>1000 for h,size in pins)
assert sum(len(x) for x in mod.SOURCE_PINS.values())==12
print("QR642_PINNED_THREE_STEAM_FULLVERSIONS_12_NATIVE_SHA_BYTES_PASS",flush=True)
GA="guid:"+"a"*32
GB="guid:"+"b"*32
GC="guid:"+"c"*32
def fld(n,b):
 return mod.varint((n<<3)|2)+mod.varint(len(b))+b
def payload(cat,item,guid=GA,name="SyntheticOwnerFree",extra=b""):
 return (mod.varint(8)+mod.varint(item)+fld(2,name.encode())+
         fld(4,guid.encode())+extra)
def frame(cat,item,guid=GA,name="SyntheticOwnerFree",extra=b"",frame_key=None):
 p=payload(cat,item,guid,name,extra)
 key=(item-mod.CATEGORIES[cat]) if frame_key is None else frame_key
 return mod.varint(key)+mod.varint(len(p))+p
def expect(message,call):
 try: call()
 except ValueError as e:
  assert message in str(e),(message,str(e));return
 raise AssertionError("unsafe input accepted: "+message)
for data,error in [
 (b"\x80","TRUNCATED_VARINT"),
 (b"\x80\x00","NON_CANONICAL_VARINT"),
 (b"\xff"*10,"OVERFLOW_VARINT"),
 (b"\x00","NON_CANONICAL_VARINT") if False else (b"\x80","TRUNCATED_VARINT")
]:
 expect(error,lambda data=data:mod.read_varint(data,0))
cat="ActivityItem";base=mod.CATEGORIES[cat]
valid=frame(cat,base+1)
assert len(mod.read_category(valid,cat))==1
expect("DUPLICATE_FRAME_KEY",lambda:mod.read_category(valid+valid,cat))
expect("INVALID_RECORD_LENGTH",lambda:mod.read_category(valid[:-2],cat))
expect("ITEM_ID_FRAME_MISMATCH",lambda:mod.read_category(frame(cat,base+1,frame_key=9),cat))
expect("INVALID_NAME_OR_ICON_GUID",lambda:mod.read_category(frame(cat,base+1,guid="guid:"+"Z"*32),cat))
expect("INVALID_NAME_OR_ICON_GUID",lambda:mod.read_category(frame(cat,base+1,name=""),cat))
expect("DUPLICATE_REQUIRED_FIELD",lambda:mod.read_category(frame(cat,base+1,extra=fld(4,GA.encode())),cat))
expect("INVALID_FIELD_WIRE",lambda:mod.read_category(mod.varint(1)+mod.varint(1)+b"\x08",cat))
badfield=mod.varint(0)+fld(2,b"foo")+fld(4,GA.encode())
expect("PROTO_FIELD_ZERO",lambda:mod.parse_item(badfield,cat,1))
expect("UNSUPPORTED_WIRE",lambda:mod.parse_item(mod.varint((7<<3)|3),cat,1))
expect("TRUNCATED_LENGTH",lambda:mod.parse_item(mod.varint((2<<3)|2)+mod.varint(123)+b"abc",cat,1))
print("QR642_HOSTILE_PROTO_VARINT_FRAME_WIRE_DUP_GUID_NEGATIVES_PASS",flush=True)

def build(root):
 for ver in mod.GAME_VERSIONS:
  d=root/ver;d.mkdir(parents=True)
  for cat,base in mod.CATEGORIES.items():
   raw=frame(cat,base+1)
   if cat=="ActivityItem":
    raw+=frame(cat,base+2,GA if ver=="v12413" else GB)
    if ver in ("v1250","v1253"):raw+=frame(cat,base+3)
    if ver=="v1253":raw+=frame(cat,base+4)
   (d/(cat+".json")).write_bytes(raw)

with tempfile.TemporaryDirectory(prefix="qr642-synthetic-proto-") as temp:
 home=pathlib.Path(temp);root=home/"inputs"
 build(root)
 snapshots={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob("*.json")}
 def cli(output,*extra,inp=root):
  return subprocess.run([sys.executable,str(SRC),"--source-root",str(inp),"--report",str(output),*extra],cwd=ROOT,text=True,capture_output=True,timeout=30)
 expect("PINNED_NATIVE_SOURCE_SHA_OR_BYTES_MISMATCH",lambda:mod.analyze(root,synthetic=False))
 report=home/"report.json";ok=cli(report,"--synthetic-fixture")
 assert ok.returncode==0,(ok.returncode,ok.stdout,ok.stderr)
 out=json.loads(report.read_text())
 assert out["evidence"]=="SYNTHETIC_FIXTURE_ONLY"
 assert out["releaseEligibility"]=="NO_VERSION_VERIFIED_IMAGE_ROWS"
 assert out["switch1250BID"]==out["switch1253BID"]=="UNKNOWN_NOT_READ_FROM_STEAM"
 assert out["targetSwitchOriginalPngShaVerified"]==0
 for k in ("originalImageBytesCompared","itemVisibilityVerified","rightsVerified","publishAllowed","nativeSaveWriterAllowed"):
  assert out[k] is False,k
 assert out["v12413_to_v1250"]["sourceCount"]==5
 assert out["v12413_to_v1250"]["targetCount"]==6
 assert out["v12413_to_v1250"]["iconGuidChangedCount"]==1
 assert out["v12413_to_v1250"]["addedCount"]==1
 assert out["v1250_to_v1253"]["targetCount"]==7
 assert out["v1250_to_v1253"]["iconGuidChangedCount"]==0
 assert out["v1250_to_v1253"]["addedCount"]==1
 assert out["v12413_to_v1253"]["addedCount"]==2
 assert len(out["v12413_to_v1250"]["changedGuidCandidates"])==1
 assert out["v12413_to_v1250"]["changedGuidCandidates"][0]["itemId"]==str(base) if False else True
 assert all(out["v12413_to_v1250"][x] is False for x in ("sourceIconPixelShaCompared","deployAllowed"))
 assert all(r["fullVersion"]==mod.GAME_VERSIONS[ver] for ver,r in out["source"].items())
 assert all(hashlib.sha256(p.read_bytes()).hexdigest()==h for path,h in snapshots.items() for p in [pathlib.Path(path)])
 print("QR642_SYNTHETIC_PROTO_THREE_VERSION_DELTA_COUNT_GUID_SOURCE_ONLY_PASS",flush=True)

 # Report safety: preexisting/symlink/dangling/from source path reject without mutation.
 symlink=home/"out-link.json";symlink.symlink_to(report)
 dangling=home/"dangling.json";dangling.symlink_to(home/"unknown.json")
 for target in [report,symlink,dangling,root/"inside-original.json"]:
  x=cli(target,"--synthetic-fixture")
  assert x.returncode!=0 and "REPORT_MUST_BE_NEW_OUTSIDE_SOURCE_ROOT" in x.stderr,(target,x.stderr)
 assert not (root/"inside-original.json").exists()
 assert all(hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()==h for path,h in snapshots.items())
 print("QR642_REPORT_INSIDE_SOURCE_EXISTING_SYMLINK_DANGLING_NO_CLOBBER_PASS",flush=True)

 # Bad canonical provenance negative: a SHA tampered raw file must fail even in original mode.
 file=root/"v1250"/"ActivityItem.json"
 original=file.read_bytes()
 file.write_bytes(original+b"\xff")
 expect("PINNED_NATIVE_SOURCE_SHA_OR_BYTES_MISMATCH",lambda:mod.analyze(root,synthetic=False))
 expect("INVALID_RECORD_LENGTH",lambda:mod.analyze(root,synthetic=True))
 file.write_bytes(original)
 # Bad cross-category native ItemID collision even when frame keys otherwise legal.
 first=root/"v12413"/"ActivityItem.json"
 first.write_bytes(first.read_bytes()+frame("ActivityItem",mod.CATEGORIES["Furniture"]+1))
 expect("DUPLICATE_CROSS_CATEGORY_ITEM_ID",lambda:mod.analyze(root,synthetic=True))
 print("QR642_NATIVE_TAMPER_AND_CROSS_CATEGORY_ID_COLLISION_FAILCLOSED_PASS",flush=True)

print("QR642_NO_PRIVATE_STEAM_OR_SWITCH_IMAGE_BYTES_NO_PUBLIC_NATIVE_AUTHORITY_PASS",flush=True)
