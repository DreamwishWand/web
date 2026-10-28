#!/usr/bin/env python3
"""Independent QA: exact Nintendo Switch DDV 1.25.0 five-private-original
source/Native replay for Crafting RecipeType28 ONLY.

Usage (offline, on an authorized workstation):
  python3 scripts/qr/reaccept-crafting28-switch1250-original.py \
    <main NSO> <global-metadata.dat> <dump.cs> \
    <lossless.json.gz> <support.json.gz>

Requires python-lz4. NEVER commit inputs or private excerpts, paths or
player-save data. stdout emits only a machine-auditable non-sensitive verdict.
No version transfer, device runtime, Collection owned or writer claims.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import json
import struct
import sys

EXPECTED = {
    "main": "3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0",
    "metadata": "07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c",
    "dump": "a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0",
    "lossless": "df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048",
    "support": "537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9",
}
def sha(data):
    return hashlib.sha256(data).hexdigest()
def le32(data,offset):
    return struct.unpack_from("<I",data,offset)[0]
def le64(data,offset):
    return struct.unpack_from("<Q",data,offset)[0]
def check(yes,code):
    if not yes: raise AssertionError(code)
def target(word,pc):
    check((word >> 26) == 0b100101, "NOT_BL_"+hex(pc))
    imm=(word&0x03ffffff)<<2
    if imm&(1<<27): imm-=1<<28
    return pc+imm
def guarded_unpack(view,offset,length):
    check(offset>=0 and offset+length<=len(view),"RVA_OUT_OF_RANGE_"+hex(offset))
    return view[offset:offset+length]

def verify(files):
    if len(files)!=5:
        raise SystemExit("NEED_ORIGINAL_SOURCE: exactly 5 PRIVATE files, never put in GitHub")
    try:
        import lz4.block
    except ImportError as exc:
        raise SystemExit("LOCAL_DEPENDENCY_REQUIRED: python-lz4") from exc
    originals={k:Path(v).read_bytes() for k,v in zip(EXPECTED,files)}
    for kind,expected in EXPECTED.items():
        check(sha(originals[kind])==expected,"PRIVATE_ORIGINAL_HASH_MISMATCH_"+kind)
    nso=originals["main"]
    metadata=originals["metadata"]
    check(nso[:4]==b"NSO0","WRONG_NS0")
    check(nso[0x40:0x48].hex()=="52bd625d9b4e0053","WRONG_SWITCH_BUILD_ID")
    check(struct.unpack_from("<II",metadata,0)==(0xFAB11BAF,31),"WRONG_IL2CPP_METADATA")
    section_sizes=struct.unpack_from("<III",nso,0x60)
    sections=[]
    for desc_off,comp in zip((0x10,0x20,0x30),section_sizes):
        disk_offset,rva,length=struct.unpack_from("<III",nso,desc_off)
        raw=lz4.block.decompress(nso[disk_offset:disk_offset+comp],uncompressed_size=length)
        check(len(raw)==length,"INVALID_DECOMPRESSED_SECTION")
        sections.append((rva,memoryview(raw)))
    def native(rva,length):
        for start,section in sections:
            if start<=rva and rva+length<=start+len(section):
                return bytes(section[rva-start:rva-start+length])
        raise AssertionError("NATIVE_RVA_NOT_PRESENT_"+hex(rva))
    def value(rva):return le64(native(rva,8),0)
    # Independently walk IL2CPP type names from global-metadata and its
    # original concrete AArch64 generic-type pointer records.
    def typename(idx):
        offset=le32(metadata,0xa0)+idx*88
        name_index=le32(metadata,offset)
        pos=le32(metadata,0x18)+name_index
        return metadata[pos:metadata.index(b"\x00",pos)].decode("utf-8")
    def types(inst):
        gen=value(0xac24890+inst*8)
        count=value(gen)
        arglist=value(gen+8)
        return [le32(native(value(arglist+i*8),4),0) for i in range(count)]
    def spec(index,rva,method,inst):
        got=struct.unpack("<iii",native(rva,12))
        check(got==(method,-1,inst),"METHOD_SPEC_WRONG_"+str(index))
    # Negative control — the old selected branch is definitely CRITTER;
    # another one-generic CraftingRecipe specialization is unrelated.
    spec(98710,0x96e5da4,103721,8335)
    check(types(8335)==[9630] and typename(9630)=="CritterItemData","OLD_98710_NOT_CRITTER")
    check(target(le32(native(0x4bfc974,4),0),0x4bfc974)==0x37811c0,"OLD_CRITTER_TARGET")
    spec(98709,0x96e5d98,103721,8326)
    check(types(8326)==[9715],"UNRELATED_98709_TYPE")
    # Independent NEW control: 2-generic MethodSpec98762, not old 98710/98709.
    spec(98762,0x96e6014,103722,34620)
    check(native(0x96e6014,12).hex()=="2a950100ffffffff3c870000","98762_RAW_12_BYTES")
    check(types(34620)==[9715,10402],"98762_WRONG_TWO_GENERIC_TYPES")
    check([typename(i) for i in (9715,10402)]==
          ["CraftingRecipeItemData","ActivityDataItemType"],"98762_CLASS_NAMES")
    check(value(0xb1ef628)==0xC0030395,"CRAFTING_USAGE_PTR")
    check(value(0xb1ef488)==0xC003032D,"CRITTER_USAGE_PTR")
    expected_calls={0x4bfd0f8:0x37816f0,0x4bfd104:0x37566c0,
                    0x4bfd438:0x3756ae0,0x4bfd874:0x3752680,
                    0x4bfd880:0x37566c0}
    for pc,fn in expected_calls.items():
        check(target(le32(native(pc,4),0),pc)==fn,
              "CALLSITE_MISMATCH_"+hex(pc))
    # Original native slice hashes are computed from raw source, not from
    # a copied Owner metadata JSON.
    for start,length,expected,reason in [
       (0x4bfd0d0,60,"ceec4dd83d4056294fa57424ffaf8c4deaa91ef06d3ecb3e23c348e45ae34cbe","98762_BOUND_NATIVE"),
       (0x4bfd13c,56,"3c989a5576c249ddfda216ea4fc97d31e4c8937926a9d2820e59223fd92a786b","OUTER_CASE8"),
       (0x4bfd3b8,140,"0bebc977cf0761b5ab7c09531f5460d200d69c142a0075f02051bceb7edb8887","INNER_CASE2"),
       (0x4c009e0,36,"d211d013e5a5afa619ff492d1e52f92293a30d5ae3acfd1424d8101c9c191ed6","WHERE_RECIPE_FIELD"),
       (0x4bff330,36,"b0c036d6800e0f1d66a82fcb12b29559287c1ca2259c68f19ef57305213ecdbb","PROJECT_RESULT_ITEMID"),
    ]:
        check(sha(native(start,length))==expected,reason)
    check(target(le32(native(0x4bff350,4),0),0x4bff350)==0xafb960,
          "NULL_RESULT_NOT_EXCEPTIONAL")
    support=json.loads(gzip.decompress(originals["support"]))
    db=json.loads(gzip.decompress(originals["lossless"]))
    check(support["buildID"]=="52BD625D9B4E0053","ORIGINAL_SUPPORT_WRONG_BUILD")
    records=support["tables"]["CollectionSet"]
    check(len(records)==293,"DIFFERENT_COLLECTION_SET_COUNT")
    selectors=[]
    for row in records:
        payload=base64.b64decode(row["rawPayloadBase64"],validate=True)
        check(sha(payload)==row["rawPayloadSha256"],"COLLECTION_RAW_HASH_BAD_"+str(row["id"]))
        for group in row["parameters"].get("Groups",()):
            for collection in group.get("CollectionsByType",()):
                if "RecipeType" in collection.get("Crafting",{}):
                    selectors.append((row["id"],int(collection["Crafting"]["RecipeType"]),
                                      bool(collection.get("Ignore",False))))
    check(len(selectors)==28 and len({s[0] for s in selectors})==25,"WRONG_28_RECIPE_SELECTORS")
    items=[x for x in db["items"] if x.get("concreteItemDataType")=="CraftingRecipeItemData"]
    check(len(items)==1206,"WRONG_1206_RECIPE_ITEMS")
    for row in items:
        check((row["itemType"],row["subtype"])==(205,3),"RECIPE_TYPE_OR_SUBTYPE")
        result=row["parameters"].get("Result")
        check(isinstance(result,dict) and "ItemID" in result,"RESULT_FIELD_MISSING")
        payload=base64.b64decode(row["rawPayloadBase64"],validate=True)
        check(sha(payload)==row["rawPayloadSha256"],"ORIGINAL_RECIPE_RAW_HASH")
    print(json.dumps({"marker":"QR_CRAFT28_INDEPENDENT_ORIGINAL_RAW_NATIVE_28_PASS",
                      "bid":"52BD625D9B4E0053",
                      "methodSpec":98762,"genericInst":34620,"genericTypeDefs":[9715,10402],
                      "outerCase":8,"innerCase":2,"selectors":28,
                      "uniqueDefinitions":25,"originalRecipeItems":1206,
                      "legacyCritter98710Rejected":True,
                      "runtimeCollectionMembership":"UNKNOWN",
                      "personalOwned":"UNKNOWN","writerEnabled":False},sort_keys=True))

if __name__=="__main__":
    verify(sys.argv[1:])
