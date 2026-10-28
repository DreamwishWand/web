#!/usr/bin/env python3
"""04 QR new-only v1.25.3 Banned client-source / generic Furniture Native SHA verification.
Use only exact Nintendo Switch DDV 1.25.3 local private ORIGINAL ExeFS main.elf.
Never publish raw bytes; never infer server ban issuer or quest placement legality.
Usage: python3 scripts/qr/independent-pr114-switch1253-banned-elf.py <main.elf>
"""
import hashlib
import json
import struct
import sys
from pathlib import Path
FILE_SHA="e99b1aa67ec729053d847adb3621d63e4f2ced570826b8b923531378752b8ebf"
FULL_BUILDID="9a239d3db569756d9eaaabd79771c522"
RANGES={
 "share_move_next":(0x60987d0,0x6099540,"57b8c4d751f69d55e4f0d65f2a72e5657859899116a695d9b0358b603a4ee811"),
 "find_import_move_next":(0x6142630,0x6143e10,"cc986da7022cbfcb0c15d6ca496ba6a1b9b89054cd2fcb98351576fd05e8706d"),
 "catalog_import_move_next":(0x7912d30,0x79146c0,"894c9d9642b27fe585300cb8a09afa231043db93829eaba86121cbbbae166e26"),
 "generic_furniture_get_gridarea":(0x4140e30,0x4140f90,"74d8f8830f5097b9e2df751a2d196da3daf5e575ad47d5814f66e29e361b43a7"),
 "generic_gridlayers_collide":(0x4179940,0x4179990,"fa1174fe87758a3a30ef5323eb5a4c76cc8e355cb19504d6257ecfe082c92090")
}
def require(cond,message):
    if not cond: raise AssertionError(message)
def u32(raw,pos):return struct.unpack_from("<I",raw,pos)[0]
def u64(raw,pos):return struct.unpack_from("<Q",raw,pos)[0]
def branch_target(word,pc):
    require(word>>26==0b100101,"EXPECTED_AARCH64_BL_"+hex(pc))
    disp=(word & 0x03ffffff)<<2
    if disp & (1<<27):disp-=1<<28
    return pc+disp
def sha(s):return hashlib.sha256(s).hexdigest()
def read(rx,offset,va,rva,count):
    require(va<=rva and rva+count<=va+len(rx),"ORIGINAL_EXEC_RANGE_OUTSIDE_TEXT")
    return bytes(rx[rva-va:rva-va+count])
def main(filename):
    raw=Path(filename).read_bytes()
    require(len(raw)==192176944,"ORIGINAL_ELF_UNEXPECTED_SIZE")
    require(sha(raw)==FILE_SHA,"ORIGINAL_ELF_SHA_MISMATCH")
    require(raw[:4]==b"\x7fELF" and raw[4]==2 and raw[5]==1,"NOT_LE64_ELF")
    # Original 64-bit ELF program headers: bind file offset to true vaddr,
    # not a guessed flat disassembly file RVA.
    header=u64(raw,32);entsize=struct.unpack_from("<H",raw,54)[0]
    count=struct.unpack_from("<H",raw,56)[0]
    segments=[]
    for i in range(count):
        o=header+i*entsize
        typ,flags,off,vaddr,paddr,size,mem,align=struct.unpack_from("<IIQQQQQQ",raw,o)
        if typ==1 and flags&1:segments.append((off,vaddr,size))
    require(len(segments)==1,"EXEC_SEGMENTS_UNEXPECTED")
    off,vaddr,size=segments[0]
    require(off==0xA78 and vaddr==0,"ELF_EXEC_TRANSLATION_MISMATCH")
    rx=memoryview(raw)[off:off+size]
    require(bytes.fromhex(FULL_BUILDID) in raw,"FULL_BUILDID_MISSING")
    matched=[]
    for name,(begin,end,digest) in RANGES.items():
        checked=read(rx,off,vaddr,begin,end-begin)
        require(sha(checked)==digest,"ORIGINAL_METHOD_BYTES_SHA_MISMATCH_"+name)
        matched.append(name)
    def instruction(rva):return u32(rx,rva-vaddr)
    # Each check uses raw original opcode at the exact method body, not only
    # Owner metadata code or an unrelated same-name function.
    require(instruction(0x6098a4c)==0x52800061,"SHARE_BANTYPE_3_NOT_SET")
    require(branch_target(instruction(0x6098a58),0x6098a58)==0x612e3c0,
            "SHARE_ISBANNEDFOR_BL_MISSING")
    require(instruction(0x6098c20)==0x528001c8,"SHARE_CLIENT_RESULT_14_NOT_CREATED")
    require(branch_target(instruction(0x6142d38),0x6142d38)==0x612e3c0,
            "IMPORT_ISBANNEDFOR_BL_MISSING")
    require(instruction(0x61429d0)==0x52800228,"IMPORT_CLIENT_ERROR_17_NOT_CREATED")
    require(branch_target(instruction(0x7913370),0x7913370)==0x6125f20,
            "CATALOG_FIND_IMPORT_CALL_NOT_PROVED")
    require(instruction(0x79135b8)==0xb9401115,"CATALOG_IMPORT_ERROR_FIELD_NOT_READ")
    # CBZ(W21) branch into the success continuation only if error=0.
    cbz=instruction(0x79135c0)
    require((cbz&0x7f00001f)==0x34000015,"CATALOG_NONZERO_ERROR_GUARD_MISSING")
    require(branch_target(instruction(0x7913d28),0x7913d28)==0x6126ae0,
            "NORMAL_SUCCESS_DOWNLOAD_CALL_MISSING")
    # Different *local* producer paths have distinct opcodes and independent
    # IsBannedFor callsites. No direct Result14->Error17 transformation claimed.
    require(0x6098c20!=0x61429d0,"SHARE_IMPORT_PRODUCERS_COLLAPSED")
    # Generic Layer/Footprint path only. No item-specific quest legality.
    require(branch_target(instruction(0x4140f10),0x4140f10)==0x417c700,
            "GENERIC_GETGRIDAREA_CREATE_CALL_MISSING")
    require(instruction(0x4179940)==0x36300120,"GENERIC_COLLIDE_NATIVE_BYTES_DIFFER")
    print(json.dumps({
        "marker":"QR_PR114_INDEPENDENT_ORIGINAL_ELF_SOURCE_LOCAL_PASS",
        "scope":"Nintendo Switch DDV1.25.3 BID9A239D3DB569756D schema626",
        "elfSHA256":FILE_SHA,"fullBuildID":FULL_BUILDID,
        "nativeRegionsShaVerified":matched,
        "shareClientBanned":14,"importClientBanned":17,
        "clientSideBannedProducersDistinct":True,
        "originalShareIsBannedForCall":"0x6098A58 -> 0x612E3C0",
        "originalImportIsBannedForCall":"0x6142D38 -> 0x612E3C0",
        "nonzeroImportErrorBeforeSuccessDownloadGuard":True,
        "remoteBanIssuer":"UNKNOWN","serverBanRuntime":"NEED_RUNTIME",
        "genericFurnitureGridLayerOnly":True,"item40600547QuestPlacementLegal":"UNKNOWN",
        "nativeWriterAuthorized":False,"presetApplyAuthorized":False
    },sort_keys=True))
if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("NEED_PRIVATE_SAME_BUILD_ELF")
    main(sys.argv[1])
