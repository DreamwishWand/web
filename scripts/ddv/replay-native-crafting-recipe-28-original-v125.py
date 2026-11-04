#!/usr/bin/env python3
"""Offline Owner native callsite proof, Switch DDV 1.25.0 BID 52BD625D9B4E0053 only.
Usage:
  python scripts/ddv/replay-native-crafting-recipe-28-original-v125.py \
    <main NSO> <global-metadata.dat> <dump.cs> <lossless.json.gz> <support.json.gz>
Requires python-lz4. Never publish private game/source/profile bytes.
This verifies SELECTOR-STAGE static evidence only; runtime membership and personal
owned/collected/missing stay UNKNOWN, denominator null and writers OFF.
"""
import base64
import gzip
import hashlib
import json
import struct
import sys
from pathlib import Path
try:
    from lz4.block import decompress
except ImportError:
    raise SystemExit("DEPENDENCY_REQUIRED: python-lz4")

EXPECTED = {
 "main": "3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0",
 "metadata": "07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c",
 "dump": "a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0",
 "lossless": "df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048",
 "support": "537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9",
}
def require(ok, reason):
    if not ok:
        raise AssertionError(reason)
def hash256(b):
    return hashlib.sha256(b).hexdigest()
def u32(b,off=0):
    return struct.unpack_from("<I",b,off)[0]
def u64(b,off=0):
    return struct.unpack_from("<Q",b,off)[0]
def branch_target(word,at):
    require(word>>26==0b100101,"EXPECTED_AARCH64_BL "+hex(at))
    disp=(word&0x3ffffff)<<2
    if disp & (1<<27):
        disp-=1<<28
    return at+disp

def run(paths):
    require(len(paths)==5,"EXPECTED_FIVE_ORIGINAL_FILES")
    raw=dict(zip(EXPECTED,(Path(p).read_bytes() for p in paths)))
    for name,expected in EXPECTED.items():
        require(hash256(raw[name])==expected,"SOURCE_SHA_MISMATCH_"+name)
    nso,md=raw["main"],raw["metadata"]
    require(nso[:4]==b"NSO0" and nso[0x40:0x48].hex()=="52bd625d9b4e0053","NSO_BID_MISMATCH")
    require(struct.unpack_from("<II",md)==(0xFAB11BAF,31),"METADATA_VERSION_MISMATCH")
    sections=[]
    for off,comp_size in zip((0x10,0x20,0x30),struct.unpack_from("<III",nso,0x60)):
        start,va,size=struct.unpack_from("<III",nso,off)
        data=decompress(nso[start:start+comp_size],uncompressed_size=size)
        require(len(data)==size,"DECOMPRESSION_LENGTH_MISMATCH")
        sections.append((va,data))
    def at(addr,n):
        for base,chunk in sections:
            if base<=addr and addr+n<=base+len(chunk):
                return chunk[addr-base:addr-base+n]
        raise AssertionError("NSO_VA_OUTSIDE_SECTIONS_"+hex(addr))
    def addr64(rva):
        return u64(at(rva,8))
    def name_of_type(t):
        pos=u32(md,0xa0)+t*88
        name_index=u32(md,pos)
        off=u32(md,0x18)+name_index
        return md[off:md.index(b"\x00",off)].decode("utf8")
    def get_spec(index,rva,inst,method):
        rawspec=at(rva,12)
        require(struct.unpack("<iii",rawspec)==(method,-1,inst),"METHOD_SPEC_IDENTITY_"+str(index))
    def generic(inst,expected_types):
        table=0xac24890
        p=addr64(table+inst*8)
        require(addr64(p)==len(expected_types),"GENERIC_COUNT_"+str(inst))
        argptr=addr64(p+8)
        observed=[]
        for i in range(len(expected_types)):
            typeptr=addr64(argptr+i*8)
            observed.append(u32(at(typeptr,4)))
        require(observed==expected_types,"GENERIC_TYPES_"+str(inst)+str(observed))
        return [name_of_type(i) for i in observed]
    # Independent historical negative: MethodSpec98710 belongs to CritterItemData.
    require(addr64(0xb1ef488)==0xC003032D,"OLD_CRITTER_USAGE")
    get_spec(98710,0x96e5da4,8335,103721)
    require(generic(8335,[9630])==["CritterItemData"],"OLD_CRITTER_TYPE")
    require(branch_target(u32(at(0x4bfc974,4)),0x4bfc974)==0x37811c0,"OLD_CRITTER_BL")
    require(hash256(at(0x4bfc918,156))=="42c12871749ab6e5faf112e50924e6186b45bfed86678f908cd1c5c035a55940","OLD_CRITTER_SLICE")
    # Independent negative: a separate generic1 Crafting type exists, but is not this call.
    require(addr64(0xb1ef480)==0xC003032B,"UNRELATED_ONE_GENERIC_USAGE")
    get_spec(98709,0x96e5d98,8326,103721)
    require(generic(8326,[9715])==["CraftingRecipeItemData"],"OTHER_RECIPE_CLASS")
    # Actual Crafting branch: original two-generic GetAllByType Type205/subtype3.
    require(addr64(0xb1ef628)==0xC0030395,"ACTUAL_CRAFTING_USAGE")
    get_spec(98762,0x96e6014,34620,103722)
    require(generic(34620,[9715,10402])==["CraftingRecipeItemData","ActivityDataItemType"],"ACTUAL_CRAFTING_CLASSES")
    for rva,target in ((0x4bfd0f8,0x37816f0),(0x4bfd104,0x37566c0),
                       (0x4bfd438,0x3756ae0),(0x4bfd874,0x3752680),
                       (0x4bfd880,0x37566c0)):
        require(branch_target(u32(at(rva,4)),rva)==target,"NATIVE_CALLSITE_"+hex(rva))
    # Direct instruction shape and original bounded byte ranges enforce ADRP/LDR/BL pairing.
    require(hash256(at(0x4bfd0d0,60))=="ceec4dd83d4056294fa57424ffaf8c4deaa91ef06d3ecb3e23c348e45ae34cbe","ACTUAL_GETALL_NATIVE_BYTES")
    require(hash256(at(0x4bfd13c,56))=="3c989a5576c249ddfda216ea4fc97d31e4c8937926a9d2820e59223fd92a786b","CRAFTING_OUTER_CASE8")
    require(hash256(at(0x4bfd3b8,140))=="0bebc977cf0761b5ab7c09531f5460d200d69c142a0075f02051bceb7edb8887","CRAFTING_INNER_CASE2")
    require(hash256(at(0x4c009e0,36))=="d211d013e5a5afa619ff492d1e52f92293a30d5ae3acfd1424d8101c9c191ed6","RECIPE_WHERE_LAMBDA")
    require(hash256(at(0x4bff330,36))=="b0c036d6800e0f1d66a82fcb12b29559287c1ca2259c68f19ef57305213ecdbb","RESULT_ID_PROJECTOR")
    # Explicit branch opcode guarantees Result==null is exceptional, not a valid 0 ItemID.
    require(branch_target(u32(at(0x4bff350,4)),0x4bff350)==0xafb960,"NULL_RESULT_EXCEPTION_HELPER")
    # This is original Source data, NOT Runtime ItemDatabase.
    support=json.loads(gzip.decompress(raw["support"]))
    items=json.loads(gzip.decompress(raw["lossless"]))["items"]
    require(support["buildID"]=="52BD625D9B4E0053","ORIGINAL_SUPPORT_BID")
    rows=support["tables"]["CollectionSet"]
    require(len(rows)==293 and len({r["id"] for r in rows})==293,"ORIGINAL_COLLECTION_SET_COUNT")
    selector=[]
    for row in rows:
        pb=base64.b64decode(row["rawPayloadBase64"],validate=True)
        require(hash256(pb)==row["rawPayloadSha256"],"ORIGINAL_COLLECTION_PROTOBUF_"+str(row["id"]))
        for group in row["parameters"].get("Groups",[]):
            for entry in group.get("CollectionsByType",[]):
                if "Crafting" in entry and "RecipeType" in entry["Crafting"]:
                    selector.append((row["id"],int(entry["Crafting"]["RecipeType"]),bool(entry.get("Ignore",False))))
    require(len(selector)==28 and len({x[0] for x in selector})==25,"CRAFTING_28_OCCURRENCES")
    recipes=[i for i in items if i.get("concreteItemDataType")=="CraftingRecipeItemData"]
    require(len(recipes)==1206,"ORIGINAL_1206_RECIPES")
    for i in recipes:
        require((i["itemType"],i["subtype"])==(205,3),"RECIPE_TYPE_205_SUBTYPE3")
        p=i["parameters"]
        require("Result" in p and "ItemID" in p["Result"],"SOURCE_RESULT_ID_MISSING")
        require(hash256(base64.b64decode(i["rawPayloadBase64"],validate=True))==i["rawPayloadSha256"],"RECIPE_RAW_HASH")
    print("PASS: ORIGINAL Switch1250 five source SHA and NSO metadata MethodSpec 98762 two-generic mapping")
    print("PASS: old Critter98710 and irrelevant CraftingRecipe98709 rejected as Collection callsite")
    print("PASS: direct Native BL chain and 28 original typed selector arguments; 1206 recipe raw items")
    print("OWNER_STATIC_ONLY; QR independent acceptance remains 228/256 until reacceptance")
    print("Runtime ItemDatabase/Collection membership/personal owned/collected UNKNOWN; denominator null; all writers OFF")

if __name__=="__main__":
    run(sys.argv[1:])
