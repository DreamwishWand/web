#!/usr/bin/env python3
"""01D private source-only CollectionSet v1.26.1 / schema643 structure witness.

This is NOT a Save Reader product capability, a Collection membership registry,
an owned/collected projection, or a Writer. Report only safe aggregates.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import pathlib
import re
import stat

CONTRACT='wand.01d.collection1261-private-structure-only@1'
COLLECTION_SHA='722fd17c7042f74108e41e4c84b46424ed3571605c73613eef3a2e7bf2a29440'
COLLECTION_BYTES=46939
MAX_COLLECTION=1024*1024
MAX_PRIVATE_SAVE=32*1024*1024
MAX_COLLECTION_DEFINITIONS=4096
MAX_TOTAL_FLAGS=250000
HEX64=re.compile(r'[0-9a-f]{64}\Z')

class SourceDenied(ValueError): pass

def deny(code):
    raise SourceDenied('COLLECTION1261_'+code)

def varint(data:bytes,pos:int,end:int):
    start=pos; value=0
    for i in range(10):
        if pos>=end:deny('TRUNCATED_VARINT')
        b=data[pos];pos+=1
        if i==9 and b>1:deny('OVERFLOW_VARINT')
        value|=(b&127)<<(7*i)
        if b<128:
            if encode_varint(value)!=data[start:pos]:deny('NONCANONICAL_VARINT')
            return value,pos
    deny('UNTERMINATED_VARINT')

def encode_varint(value:int)->bytes:
    if value<0:deny('NEGATIVE_VARINT')
    out=[]
    while value>127:
        out.append((value&127)|128); value>>=7
    out.append(value)
    return bytes(out)

def parse_definition_record(raw:bytes,frame:int)->int:
    pos=0; found=None
    while pos<len(raw):
        tag,pos=varint(raw,pos,len(raw))
        field,wire=tag>>3,tag&7
        if field==0:deny('ZERO_FIELD')
        if wire==0:
            value,pos=varint(raw,pos,len(raw))
            if field==1:
                if found is not None:deny('DUPLICATE_DEFINITION_ID')
                found=value
        elif wire==2:
            size,pos=varint(raw,pos,len(raw))
            if size>len(raw)-pos:deny('FIELD_TRUNCATED')
            if field==1:deny('DEFINITION_ID_WIRE_MISMATCH')
            pos+=size
        elif wire in (1,5):
            pos+=8 if wire==1 else 4
            if pos>len(raw):deny('FIXED_FIELD_TRUNCATED')
            if field==1:deny('DEFINITION_ID_WIRE_MISMATCH')
        else:deny('UNKNOWN_WIRE')
    if found is None or not(2120000000<found<2130000000) or found-2120000000!=frame:
        deny('DEFINITION_FRAME_ID_CONFLICT')
    return found

def source_ids(raw:bytes)->set[int]:
    if not 0<len(raw)<=MAX_COLLECTION:deny('SOURCE_SIZE_INVALID')
    pos=0;ids=set();frames=set()
    while pos<len(raw):
        frame,pos=varint(raw,pos,len(raw));size,pos=varint(raw,pos,len(raw))
        if size==0 or size>65536 or size>len(raw)-pos:deny('FRAME_SIZE_INVALID')
        if frame in frames:deny('FRAME_DUPLICATE')
        frames.add(frame)
        id=parse_definition_record(raw[pos:pos+size],frame);pos+=size
        if id in ids:deny('DEFINITION_DUPLICATE')
        ids.add(id)
        if len(ids)>MAX_COLLECTION_DEFINITIONS:deny('DEFINITION_BOUND')
    if not ids:deny('SOURCE_EMPTY')
    return ids

def read_regular_original(path:pathlib.Path,max_bytes:int)->bytes:
    if not path.is_absolute() or '..' in path.parts:deny('ABSOLUTE_PATH_REQUIRED')
    for parent in (path,*path.parents):
        if parent.is_symlink():deny('SOURCE_SYMLINK')
        if parent==parent.parent:break
    for parent in (path.parent,*path.parents):
        if (parent/'.git').exists() or (parent/'.git').is_symlink():
            deny('PRIVATE_ORIGINAL_GIT_DIRECTORY')
        if parent==parent.parent:break
    try: mode=path.stat().st_mode
    except OSError:deny('SOURCE_MISSING')
    if not stat.S_ISREG(mode):deny('SOURCE_NOT_REGULAR')
    if path.stat().st_size>max_bytes:deny('SOURCE_TOO_LARGE')
    data=path.read_bytes()
    if len(data)>max_bytes:deny('SOURCE_TOO_LARGE')
    return data

def attest_pair(steam_raw:bytes,switch_raw:bytes):
    if len(steam_raw)!=COLLECTION_BYTES or hashlib.sha256(steam_raw).hexdigest()!=COLLECTION_SHA:
        deny('STEAM_ORIGINAL_SHA_MISMATCH')
    if len(switch_raw)!=COLLECTION_BYTES or hashlib.sha256(switch_raw).hexdigest()!=COLLECTION_SHA:
        deny('SWITCH_ORIGINAL_SHA_MISMATCH')
    if steam_raw!=switch_raw:deny('ORIGINAL_BYTE_DIFFERENCE')
    ids=source_ids(steam_raw)
    if len(ids)!=305:deny('ORIGINAL_DEFINITION_COUNT_UNEXPECTED')
    return ids

def read_private_save(raw:bytes,expected_sha:str,source_definition_ids:set[int]):
    if not isinstance(expected_sha,str) or not HEX64.fullmatch(expected_sha):
        deny('PRIVATE_SAVE_SHA_INVALID')
    if len(raw)>MAX_PRIVATE_SAVE or hashlib.sha256(raw).hexdigest()!=expected_sha:
        deny('PRIVATE_SAVE_SHA_MISMATCH')
    def unique_pairs(pairs):
        out={}
        for key,value in pairs:
            if key in out:deny('DUPLICATE_JSON_KEY')
            out[key]=value
        return out
    def nonfinite(_):deny('NONFINITE_JSON')
    try: obj=json.loads(raw,object_pairs_hook=unique_pairs,parse_constant=nonfinite)
    except (ValueError,UnicodeDecodeError):deny('PRIVATE_SAVE_INVALID_JSON')
    if (not isinstance(obj,dict) or not isinstance(obj.get('GameInfo'),dict) or
        type(obj['GameInfo'].get('Version')) is not int or obj['GameInfo'].get('Version')!=643):
        deny('PRIVATE_SAVE_SCHEMA643_REQUIRED')
    player=obj.get('Player')
    if not isinstance(player,dict) or not isinstance(player.get('CollectionSets'),list):
        deny('PRIVATE_COLLECTION_SETS_REQUIRED')
    sets=player['CollectionSets']
    if len(sets)>MAX_COLLECTION_DEFINITIONS:deny('PRIVATE_COLLECTION_BOUND')
    visited=set();total=0;trues=0;falses=0;groups=0
    for row in sets:
        if not isinstance(row,dict) or not set(row)>={'CollectionDefinitionID','GroupData'}:
            deny('COLLECTION_ROW_SHAPE')
        definition=row['CollectionDefinitionID']
        if type(definition)!=int or definition in visited:deny('COLLECTION_ID_INVALID_OR_DUPLICATE')
        visited.add(definition)
        gd=row['GroupData']
        if not isinstance(gd,list) or len(gd)>256:deny('GROUP_COUNT_BOUND')
        group_indices=set()
        for g in gd:
            if not isinstance(g,dict) or not {'GroupIndex','GroupsCollectionItems'}<=set(g):
                deny('GROUP_SHAPE')
            idx=g['GroupIndex']
            if type(idx)!=int or not 0<=idx<=256 or idx in group_indices:
                deny('GROUP_INDEX_INVALID_OR_DUPLICATE')
            group_indices.add(idx);groups+=1
            items=g['GroupsCollectionItems']
            if not isinstance(items,dict) or len(items)>65536:deny('ITEM_MAP_BOUND')
            for key,val in items.items():
                if (not isinstance(key,str) or not key.isascii() or not key.isdigit() or
                    not key or key.startswith('0') or not 0<int(key)<=0xffffffff):
                    deny('NONCANONICAL_ITEM_KEY')
                if type(val)!=bool:deny('NONBOOL_ITEM_VALUE')
                total+=1
                if total>MAX_TOTAL_FLAGS:deny('FLAG_SCAN_BOUND')
                if val:trues+=1
                else:falses+=1
    if visited!=source_definition_ids:deny('PRIVATE_SOURCE_DEFINITION_SET_MISMATCH')
    return dict(observedSavedDefinitions=len(sets),observedGroupRecords=groups,
                observedSavedBooleanFlags=total,observedTrueTokens=trues,observedFalseTokens=falses,
                privateSaveShaVerified=True,sourceDefinitionSetEqual=True)

def make_report(steam_raw,switch_raw,private_profile=None,expected_private_sha=None):
    ids=attest_pair(steam_raw,switch_raw)
    result={
      'contract':CONTRACT,'sourcePlatformPair':['SteamWindows','NintendoSwitch'],
      'sourceGameVersion':'v1.26.1','sourceDefinitionCount':len(ids),
      'collectionDefinitionSourceSha256':COLLECTION_SHA,
      'sourceBytesIdentical':True,
      'profileExamined':private_profile is not None,
      'savedVsStaticItemMembershipVerified':False,
      'nativeDynamicGroupVerified':False,
      'displayedCollectedMeaning':'UNKNOWN',
      'ownedEntitlementVerified':False,
      'buildNativeABICompatible':'UNKNOWN',
      'writerAuthorized':False,'saveEdited':False,'publishAllowed':False,
      'operationOn':False,
    }
    if private_profile is not None:
        result.update(read_private_save(private_profile,expected_private_sha,ids))
    elif expected_private_sha is not None:
        deny('PROFILE_REQUIRED_FOR_PRIVATE_SHA')
    return result

def _output_path(path:pathlib.Path,sources:list[pathlib.Path]):
    if not path.is_absolute() or '..' in path.parts:deny('OUTPUT_ABSOLUTE_PATH_REQUIRED')
    for p in (path,*path.parents):
        if p.is_symlink():deny('OUTPUT_SYMLINK')
        if p==p.parent:break
    if path.exists() or path.is_symlink():deny('OUTPUT_EXISTS_NO_CLOBBER')
    parent=path.parent
    if not parent.is_dir():deny('OUTPUT_PARENT_REQUIRED')
    for folder in (parent,*parent.parents):
        if (folder/'.git').exists() or (folder/'.git').is_symlink():
            deny('PRIVATE_OUTPUT_GIT_DIRECTORY')
        if folder==folder.parent:break
    if path in sources or any(p==parent or parent in p.parents for p in sources):
        deny('OUTPUT_SOURCE_DIRECTORY')
    return path

def main():
    p=argparse.ArgumentParser(description='Private Source-only CollectionSet1261 + optional genuine643 structural attestation; NO Writer')
    p.add_argument('--steam-collection',type=pathlib.Path,required=True)
    p.add_argument('--switch-collection',type=pathlib.Path,required=True)
    p.add_argument('--private-profile',type=pathlib.Path)
    p.add_argument('--expected-private-profile-sha256')
    p.add_argument('--private-report',type=pathlib.Path,required=True)
    a=p.parse_args()
    if (a.private_profile is None)!=(a.expected_private_profile_sha256 is None):
        deny('PRIVATE_SHA_AND_FILE_MUST_PAIR')
    s=read_regular_original(a.steam_collection,MAX_COLLECTION)
    t=read_regular_original(a.switch_collection,MAX_COLLECTION)
    prof=read_regular_original(a.private_profile,MAX_PRIVATE_SAVE) if a.private_profile else None
    report=make_report(s,t,prof,a.expected_private_profile_sha256)
    dest=_output_path(a.private_report,[a.steam_collection,a.switch_collection]+([a.private_profile] if a.private_profile else []))
    data=(json.dumps(report,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode('utf-8')
    if len(data)>8192:deny('REPORT_SIZE_BOUND')
    fd=os.open(dest,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600)
    with os.fdopen(fd,'wb') as f:f.write(data)
    print(json.dumps({'contract':CONTRACT,'sourceDefinitionCount':report['sourceDefinitionCount'],
                      'sourceBytesIdentical':True,'profileExamined':report['profileExamined'],
                      'observedSavedBooleanFlags':report.get('observedSavedBooleanFlags'),
                      'writerAuthorized':False,'publishAllowed':False},sort_keys=True))

if __name__=='__main__':main()
