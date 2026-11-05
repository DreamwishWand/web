#!/usr/bin/env python3
"""Offline Steam ItemID/IconGUID delta; source-only, no Switch/public image claims."""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import re

SCHEMA = "wand.01d.steam-native-item-guid-diff-source-only@1"
CATEGORIES = {"ActivityItem":30000000,"Furniture":40000000,"Clothing":50000000,"Trimming":160000000}
GAME_VERSIONS = {
  "v12413":"releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33",
  "v1250":"releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14",
  "v1253":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22",
}
# Full original raw protobuf SHA/byte pins; no copyrighted game data in GitHub.
SOURCE_PINS = {
  "v12413":{
    "ActivityItem":("c1c29d2bddff8ccb1461d4b3c78d36dde361c9b936f6ccd535f5a73a2dc9b401",1193733),
    "Furniture":("c813cc381dc37443b7c59dc2397974e8860537919b85bc04dabbce87f3ae34c6",2424496),
    "Clothing":("15a36230569e4824125f6fbf15c412cd7ebd1784ca104f9a97a8c436c699bbf5",629948),
    "Trimming":("7e238064eb84dbdfb9ac3e393a65fb5eb7addba069ebeb9e08ef3e6b2c9b5173",77063)},
  "v1250":{
    "ActivityItem":("6b3d71f2e17e5d84ba5203eb4f8b0428ff0241e7d8df2079b4bdfe0c0d15345f",1229068),
    "Furniture":("4a5320900176f7bd4626e0f23b7b68d1de3780e4d9f395308dc6dfdec8538cad",2458209),
    "Clothing":("e1cdd6e4566a7fe0f3e586876f0dd6b2ffcd1f86846f54e043b5883c23a68cbc",650175),
    "Trimming":("6b8aa170ccbe3431fb508256b2efab697e1f80a1fc97e4f3ce6352c1cb285ed7",77793)},
  "v1253":{
    "ActivityItem":("20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4",1229360),
    "Furniture":("823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674",2458197),
    "Clothing":("e1cdd6e4566a7fe0f3e586876f0dd6b2ffcd1f86846f54e043b5883c23a68cbc",650175),
    "Trimming":("6b8aa170ccbe3431fb508256b2efab697e1f80a1fc97e4f3ce6352c1cb285ed7",77793)}
}
GUID_RE = re.compile(r"guid:[0-9a-f]{32}\Z")

def varint(value):
    if value < 0: raise ValueError("NEGATIVE_VARINT")
    out=bytearray()
    while value > 127:
        out.append((value&127)|128)
        value >>= 7
    out.append(value)
    return bytes(out)

def read_varint(data, pos):
    start=pos
    value=0
    for i in range(10):
        if pos>=len(data): raise ValueError("TRUNCATED_VARINT")
        c=data[pos];pos+=1
        if i==9 and c>1: raise ValueError("OVERFLOW_VARINT")
        value|=(c&127)<<(7*i)
        if c<128:
            if data[start:pos]!=varint(value): raise ValueError("NON_CANONICAL_VARINT")
            return value,pos
    raise ValueError("UNTERMINATED_VARINT")

def parse_item(data, category, frame_id):
    required={}
    pos=0
    while pos<len(data):
        tag,pos=read_varint(data,pos)
        field,wire=tag>>3,tag&7
        if field==0: raise ValueError("PROTO_FIELD_ZERO")
        if wire==0: value,pos=read_varint(data,pos)
        elif wire in (1,5):
            n=8 if wire==1 else 4
            if pos+n>len(data): raise ValueError("TRUNCATED_FIXED")
            value=data[pos:pos+n];pos+=n
        elif wire==2:
            n,pos=read_varint(data,pos)
            if n>len(data)-pos: raise ValueError("TRUNCATED_LENGTH")
            value=data[pos:pos+n];pos+=n
        else: raise ValueError("UNSUPPORTED_WIRE")
        if field in (1,2,4):
            if field in required: raise ValueError("DUPLICATE_REQUIRED_FIELD")
            if wire != (0 if field==1 else 2): raise ValueError("INVALID_FIELD_WIRE")
            required[field]=value
    if set(required)!={1,2,4}: raise ValueError("REQUIRED_FIELD_MISSING")
    item_id=required[1]
    if not isinstance(item_id,int) or item_id<1 or item_id>=2**53 or item_id-CATEGORIES[category]!=frame_id:
        raise ValueError("ITEM_ID_FRAME_MISMATCH")
    try:
        name=required[2].decode("utf-8")
        guid=required[4].decode("ascii")
    except UnicodeDecodeError:
        raise ValueError("INVALID_ITEM_TEXT") from None
    if not name or len(name)>1024 or not GUID_RE.fullmatch(guid):
        raise ValueError("INVALID_NAME_OR_ICON_GUID")
    return str(item_id),{"category":category,"name":name,"iconGuid":guid}

def read_category(data, category):
    if category not in CATEGORIES or len(data)>32*1024*1024: raise ValueError("CATEGORY_OR_FILE_INVALID")
    pos=0
    result={}
    keys=set()
    while pos<len(data):
        key,pos=read_varint(data,pos)
        size,pos=read_varint(data,pos)
        if not size or size>1024*1024 or size>len(data)-pos: raise ValueError("INVALID_RECORD_LENGTH")
        if key in keys: raise ValueError("DUPLICATE_FRAME_KEY")
        keys.add(key)
        item,row=parse_item(data[pos:pos+size],category,key);pos+=size
        if item in result: raise ValueError("DUPLICATE_ITEM_ID")
        result[item]=row
        if len(result)>20000: raise ValueError("CATEGORY_ROWS_OVERSIZED")
    if not result: raise ValueError("EMPTY_CATEGORY")
    return result

def diff(before, after, v1, v2):
    old_ids=set(before);new_ids=set(after)
    common=sorted(old_ids&new_ids,key=int)
    changed=[{"itemId":id,"category":after[id]["category"],"name":after[id]["name"],
              "fromGuid":before[id]["iconGuid"],"toGuid":after[id]["iconGuid"]}
             for id in common if before[id]["iconGuid"]!=after[id]["iconGuid"]]
    added=[{"itemId":id,"category":after[id]["category"],"name":after[id]["name"],"iconGuid":after[id]["iconGuid"]}
           for id in sorted(new_ids-old_ids,key=int)]
    removed=[{"itemId":id,"category":before[id]["category"],"name":before[id]["name"],"iconGuid":before[id]["iconGuid"]}
             for id in sorted(old_ids-new_ids,key=int)]
    return {
      "sourceVersion":v1,"targetVersion":v2,"sourceCount":len(before),"targetCount":len(after),
      "retained":len(common),"iconGuidEqualCandidateCount":len(common)-len(changed),
      "iconGuidChangedCount":len(changed),"addedCount":len(added),"removedCount":len(removed),
      "nameChangedCount":sum(before[id]["name"]!=after[id]["name"] for id in common),
      "changedGuidCandidates":changed,"addedCandidates":added,"removedCandidates":removed,
      "sourceIconPixelShaCompared":False,"targetSwitchOriginalPngShaVerified":0,
      "imagePublicEligibleRows":0,"deployAllowed":False
    }

def analyze(root,synthetic=False):
    root=root.resolve()
    version_rows={}
    sources={}
    for version,full in GAME_VERSIONS.items():
        combined={}
        sources[version]={"fullVersion":full,"raw":{},"categoryCounts":{}}
        for category in CATEGORIES:
            path=root/version/(category+".json")
            if path.is_symlink() or not path.is_file() or root not in path.resolve().parents:
                raise ValueError("MISSING_OR_SYMLINK_NATIVE_SOURCE")
            data=path.read_bytes()
            sha=hashlib.sha256(data).hexdigest()
            if not synthetic and (sha,len(data))!=SOURCE_PINS[version][category]:
                raise ValueError("PINNED_NATIVE_SOURCE_SHA_OR_BYTES_MISMATCH")
            rows=read_category(data,category)
            for id,row in rows.items():
                if id in combined: raise ValueError("DUPLICATE_CROSS_CATEGORY_ITEM_ID")
                combined[id]=row
            sources[version]["raw"][category]={"sha256":sha,"bytes":len(data)}
            sources[version]["categoryCounts"][category]=len(rows)
        version_rows[version]=combined
    return {
      "schema":SCHEMA,"evidence":"SYNTHETIC_FIXTURE_ONLY" if synthetic else "SOURCE_ONLY_ORIGINAL_STEAM_NATIVE_DEFINITIONS",
      "sourcePlatform":"Steam/Windows","source":sources,
      "releaseEligibility":"NO_VERSION_VERIFIED_IMAGE_ROWS",
      "switch1250BID":"UNKNOWN_NOT_READ_FROM_STEAM","switch1253BID":"UNKNOWN_NOT_READ_FROM_STEAM",
      "targetSwitchOriginalPngShaVerified":0,"originalImageBytesCompared":False,
      "itemVisibilityVerified":False,"rightsVerified":False,
      "publishAllowed":False,"nativeSaveWriterAllowed":False,
      "v12413_to_v1250":diff(version_rows["v12413"],version_rows["v1250"],"v12413","v1250"),
      "v1250_to_v1253":diff(version_rows["v1250"],version_rows["v1253"],"v1250","v1253"),
      "v12413_to_v1253":diff(version_rows["v12413"],version_rows["v1253"],"v12413","v1253")
    }

def main():
    p=argparse.ArgumentParser(description="Offline native Steam icon GUID delta; NOT Switch image proof")
    p.add_argument("--source-root",type=pathlib.Path,required=True)
    p.add_argument("--report",type=pathlib.Path,required=True)
    p.add_argument("--synthetic-fixture",action="store_true")
    a=p.parse_args()
    root=a.source_root.resolve()
    if a.report.is_symlink() or a.report.exists() or a.report.resolve()==root or root in a.report.resolve().parents:
        raise ValueError("REPORT_MUST_BE_NEW_OUTSIDE_SOURCE_ROOT")
    result=analyze(root,a.synthetic_fixture)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    with a.report.open("x",encoding="utf-8") as fp:
        json.dump(result,fp,ensure_ascii=False,indent=2)
        fp.write("\n")
    print(json.dumps({"schema":SCHEMA,"evidence":result["evidence"],
      "v12413_to_v1250":{k:result["v12413_to_v1250"][k] for k in ("sourceCount","targetCount","iconGuidChangedCount","addedCount","removedCount")},
      "v1250_to_v1253":{k:result["v1250_to_v1253"][k] for k in ("sourceCount","targetCount","iconGuidChangedCount","addedCount","removedCount")},
      "publishAllowed":False}))

if __name__=="__main__":
    main()
