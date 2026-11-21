#!/usr/bin/env python3
"""Owner-only bounded source replay of 124 Switch DDV v1.25.0 Collection Universe selectors.
Run locally (requires python-lz4); original proprietary input bytes must never be committed.
Usage: python scripts/ddv/replay-native-universe-124-original-v125.py <main NSO> <global-metadata.dat> <dump.cs> <lossless.json.gz> <support.json.gz>
Outputs selector-stage static proof ONLY, not runtime Collection membership or owned/collected.
"""
from pathlib import Path
import base64, gzip, hashlib, json, struct, sys
try:
    from lz4.block import decompress
except ImportError as e:
    raise SystemExit("DEPENDENCY_REQUIRED: install python-lz4 for local offline replay") from e

SHA={
 "main":"3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0",
 "metadata":"07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c",
 "dump":"a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0",
 "lossless":"df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048",
 "support":"537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9",
}
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/"static/ddv/core/collection/v1.25/native-universe-124-original-native-v125.json"
SOURCE=ROOT/"static/ddv/core/collection/v1.25/native-universe-source-candidate-124-v125.json"

def chk(ok,what):
    if not ok: raise AssertionError(what)
def sha(x): return hashlib.sha256(x).hexdigest()
def u32(x,p=0): return struct.unpack_from("<I",x,p)[0]
def u64(x,p=0): return struct.unpack_from("<Q",x,p)[0]
def call_target(op,at):
    w=u32(op)
    chk(w>>26==0b100101,"not original AArch64 BL "+hex(at))
    v=(w&0x3ffffff)<<2
    if v&(1<<27):v-=1<<28
    return at+v

def run(paths):
    chk(len(paths)==5,"require main metadata dump lossless.gz support.gz")
    b=dict(zip(SHA,(Path(p).read_bytes() for p in paths)))
    for name,digest in SHA.items():chk(sha(b[name])==digest,"ORIGINAL_SHA_MISMATCH:"+name)
    main,meta,dump=b["main"],b["metadata"],b["dump"]
    chk(main[:4]==b"NSO0" and main[0x40:0x48].hex()=="52bd625d9b4e0053","BID")
    chk(struct.unpack_from("<II",meta,0)==(0xFAB11BAF,31),"metadata-v31")
    sections=[]
    for off,length in zip((0x10,0x20,0x30),struct.unpack_from("<III",main,0x60)):
        p,virtual,size=struct.unpack_from("<III",main,off)
        raw=decompress(main[p:p+length],uncompressed_size=size)
        chk(len(raw)==size,"NSO section wrong size")
        sections.append((virtual,raw))
    def at(addr,size):
        for virtual,raw in sections:
            if virtual<=addr and addr+size<=virtual+len(raw):return raw[addr-virtual:addr-virtual+size]
        raise AssertionError("NSO range not in original sections:"+hex(addr))
    def addr64(a):return u64(at(a,8))
    def iltype(i):
        record=struct.unpack_from("<22I",meta,u32(meta,0xA0)+88*i)
        pos=u32(meta,0x18)+record[0]
        end=meta.index(b"\x00",pos)
        return meta[pos:end].decode(),record
    def mdmethod(i):
        p=u32(meta,0x30)+i*36
        name_idx,declaring=struct.unpack_from("<II",meta,p)
        st=u32(meta,0x18)+name_idx
        return meta[st:meta.index(b"\x00",st)].decode(),declaring
    chk(iltype(9204)[0]=="ClothingItemData","Clothing TypeDef")
    chk(iltype(9078)[0]=="FurnitureItemData","Furniture TypeDef")
    chk(iltype(9664)[0]=="SetItemData","Set TypeDef")
    chk(iltype(10341)[0]=="CollectionClothing","Clothing universe owner")
    chk(iltype(10336)[0]=="CollectionFurniture","Furniture universe owner")
    chk(mdmethod(103721)[0]=="GetAllByType","GetAllByType MethodDef")
    chk(mdmethod(103727)[0]=="GetItemData","GetItemData MethodDef")
    chk("SetItemIDFieldNumber = 8;" in dump.decode("utf8"),"SetItemID field not in dump")
    evidence=json.loads(EVIDENCE.read_text())
    projection=json.loads(SOURCE.read_text())
    chk(evidence["scope"]=={"platform":"Nintendo Switch","version":"1.25.0","bid":"52BD625D9B4E0053","saveSchema":624},"scope")
    chk(projection["entries"] and len(evidence["entries"])==len(projection["entries"])==124,"124 entries")
    chk(evidence["coverage"]["ownerStatic"]==256 and evidence["coverage"]["independentQrLastVerified"]==103,"Owner/QA separation")
    chk(evidence["safety"]["denominator"] is None and not evidence["safety"]["nativeWriter"],"fail closed")
    usage=evidence["originalNative"]["commonSetLookup"]
    chk(addr64(int(usage["encodedUsageRva"],16))==0xC00304A7,"Set MethodSpec token")
    for fam,inst,expected_type in (("Clothing",8166,9204),("Furniture",8574,9078),("SetItemData",9013,9664)):
        generic=addr64(0xAC24890+inst*8)
        chk(addr64(generic)==1,"genericinst arg count "+fam)
        arg_type=addr64(addr64(generic+8))
        chk(u32(at(arg_type,4))==expected_type,"genericinst TypeDef "+fam)
    for idx,kind,instancetype,method in ((98706,"GetAllByType",8166,103721),(98722,"GetAllByType",8574,103721),(98899,"GetItemData",9013,103727)):
        rva=0x96E5DF8+(idx-98717)*12
        chk(struct.unpack("<iii",at(rva,12))==(method,-1,instancetype),"MethodSpec "+str(idx))
    for fam in ("clothing","furniture"):
        arm=evidence["originalNative"][fam]
        for prefix in ("dispatch","loop","boundedPredicate"):
            start=int(arm[prefix+"Rva"] if prefix=="dispatch" else (arm["loopStartRva"] if prefix=="loop" else arm["boundedPredicateStartRva"]),16)
            end=int(arm["dispatchEndExclusiveRva"] if prefix=="dispatch" else (arm["loopEndExclusiveRva"] if prefix=="loop" else arm["boundedPredicateEndExclusiveRva"]),16)
            label=("dispatchSha256" if prefix=="dispatch" else "loopSha256" if prefix=="loop" else "predicateSha256")
            chk(sha(at(start,end-start))==arm[label],fam+" "+prefix+" native hash")
        type_token=int(arm["getAllTypeUsageRva"],16)
        chk(addr64(type_token)==int(arm["getAllTypeEncoded"],16),fam+" getAll MethodSpec usage")
        for op,target in ((arm["setLookupCallRva"],0x3782230),(arm["containsCallRva"],0x39349D0),(arm["addResultRva"],0x2306960)):
            rva=int(op,16)
            chk(call_target(at(rva,4),rva)==target,fam+" native call target "+op)
    support=json.loads(gzip.decompress(b["support"]))
    lossless=json.loads(gzip.decompress(b["lossless"]))
    chk(support["buildID"]=="52BD625D9B4E0053" and lossless["gameVersion"]=="1.25.0","Source version")
    original={}
    for row in support["tables"]["CollectionSet"]:
        raw=base64.b64decode(row["rawPayloadBase64"],validate=True)
        chk(sha(raw)==row["rawPayloadSha256"],"Original Collection raw SHA "+str(row["id"]))
        chk(row["id"] not in original,"Collection DefinitionID duplicate")
        original[row["id"]]=row
    chk(len(original)==293,"original Collection count")
    key=lambda x:(x["definitionId"],x["family"],int(x.get("universeTag",x.get("selectorUniverseTag"))))
    chk({key(x) for x in evidence["entries"]}=={key(x) for x in projection["entries"]},"Original typed selector index parity")
    for row in evidence["entries"]:
        ident,family,universe=key(row)
        orig=original[ident]
        cases=[v for group in orig["parameters"]["Groups"] for v in group.get("CollectionsByType",[])
               if family in v and "Universe" in v[family] and not v.get("Ignore",False)]
        chk(len(cases)==1 and cases[0][family]["Universe"]==universe,
            "Wrong original protobuf oneof/argument "+str(ident)+" "+family)
    for family,count in (("Clothing",61),("Furniture",63)):
        chk(sum(e["family"]==family for e in evidence["entries"])==count,"Family occurrence "+family)
    print("PASS ORIGINAL SAME-BUILD: 5 raw SHA, original NSO+metadata, 3 MethodSpec/generic TypeDefs")
    print("PASS 124 SELECTOR-STAGE: Clothing61 Furniture63; 293 original raw Collection Definitions SHA checked")
    print("OWNER_STATIC=256/256 QR_INDEPENDENT_LAST_VERIFIED=103/256 (NOT QA ACCEPTED)")
    print("NO_RUNTIME_AUTHORITY: denominator=NULL, Owned/Collected/Missing UNKNOWN, Writer/Apply/Publisher OFF")
    print("DRAFT DO_NOT_MERGE DO_NOT_DEPLOY; Steam/schema626 untransferred")

if __name__=="__main__":
    run(sys.argv[1:])
