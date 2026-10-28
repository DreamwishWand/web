#!/usr/bin/env python3
"""Offline ONLY: replay the bounded QR198 original Switch v1.25.0 source proof.
Usage: python scripts/ddv/replay-native-isvalid-original-v125.py <main NSO> <global-metadata.dat> <dump.cs>
Requires python-lz4. Source files stay local; prints no private profile data.
NEVER treats the historical untraced d548... digest as original or issues a runtime capability.
"""
from pathlib import Path
import hashlib,struct,sys
try:
    from lz4.block import decompress
except ImportError:
    raise SystemExit("DEPENDENCY_REQUIRED: pip install lz4")
H={
"main":"3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0",
"meta":"07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c",
"dump":"a94ae73d522f160d21255b195b4d834bf5c79db59ddbd8cdfc32e54c6e0671f0"}
def sha(b):return hashlib.sha256(b).hexdigest()
def ui(b,p):return struct.unpack_from("<I",b,p)[0]
def u64(b,p):return struct.unpack_from("<Q",b,p)[0]
def check(ok,reason):
    if not ok:raise AssertionError(reason)
def run(args):
    check(len(args)==3,"require <main NSO> <global-metadata.dat> <dump.cs>")
    m,md,d=[Path(p).read_bytes() for p in args]
    for name,b in (("main",m),("meta",md),("dump",d)):
        check(sha(b)==H[name],"WRONG_OR_MISSING_ORIGINAL_"+name)
    check(m[:4]==b"NSO0" and m[0x40:0x48].hex()=="52bd625d9b4e0053","NSO BID")
    check(struct.unpack_from("<II",md)==(0xFAB11BAF,31),"original v31")
    sections=[]
    for off,z in zip((0x10,0x20,0x30),struct.unpack_from("<III",m,0x60)):
        p,v,size=struct.unpack_from("<III",m,off)
        section=decompress(m[p:p+z],uncompressed_size=size)
        check(len(section)==size,"LZ4 section")
        sections.append((v,section))
    def src(addr,n):
        for start,b in sections:
            if start<=addr and addr+n<=start+len(b):return b[addr-start:addr-start+n]
        raise AssertionError("original NSO RVA outside sections")
    def su64(a):return u64(src(a,8),0)
    def st(ident):
        p=ui(md,0xA0)+ident*88
        v=struct.unpack_from("<22I",md,p)
        q=ui(md,0x18)+v[0]
        return md[q:md.index(b"\x00",q)].decode(),v
    def method(ident):
        p=ui(md,0x30)+ident*36
        b=md[p:p+36]
        check(len(b)==36,"methodDef bounds")
        ix,owner=struct.unpack_from("<II",b)
        q=ui(md,0x18)+ix
        return md[q:md.index(b"\x00",q)].decode(),owner
    check(st(10722)[0]=="ICollectionItem" and st(10722)[1][2]==64932,"ICollectionItem")
    check(st(10720)[0]=="IItemIsVariationOf" and st(10720)[1][2]==65831,"IItemIsVariationOf")
    check(st(10610)[0]=="ItemDatabase","ItemDatabase")
    check(method(103729)==("TryGetItemData",10610),"TryGetItemData method def")
    for idx,inst,ty,ra,token in ((98945,34666,10722,0x96E68A8,0xB1EFBE0),(98963,33277,10720,0x96E6980,0xB1EFC70)):
        check(struct.unpack("<iii",src(ra,12))==(103729,-1,inst),"original MethodSpec "+str(idx))
        val=su64(token)
        check((val>>29)==6 and ((val&0x1fffffff)>>1)==idx,"encoded NSO MethodSpec usage")
        generic=su64(0xAC24890+inst*8)
        check(su64(generic)==1,"genericInst argument count")
        type_ptr=su64(su64(generic+8))
        check(ui(src(type_ptr,4),0)==ty,"original generic type arg")
    for ident,iface,slot,vt,methodref,entry in (
        (9619,26,27,0x4835F20,0x6002D223,92433),
        (9314,32,33,0x4685D50,0x6002AA91,87368)):
        _,v=st(ident)
        start=v[15]
        n=v[19]>>16
        off=ui(md,0x98)
        pairs=[struct.unpack_from("<ii",md,off+(start+i)*8) for i in range(n)]
        check((64932,iface) in pairs and all(k!=65831 for k,_ in pairs),"concrete interfaces")
        word=ui(md,ui(md,0x90)+(v[14]+slot)*4)
        check(word==methodref and (word&0x1fffffff)>>1==entry,"concrete vtable")
        check(method(entry)[0]=="get_CanBeCollected","method name")
        check(src(vt,8).hex()=="20008052c0035fd6","constant true Native getter")
    check((st(9314)[1][18]>>16)==42 and (st(9314)[1][16]&65535)==58,"Figurine vtable vs methods")
    check(sha(src(0x4BFA300,832))=="7b86791e0fa80577a3358dc9cf5d00f9c6c9bdc8e1a10ba2acc8a51c325f559d","IsValid NSO code hash")
    check(src(0x4BFA454,4).hex()=="9b20ae97" and src(0x4BFA574,4).hex()=="5320ae97","Native BL")
    print("OWNER_ORIGINAL_RAW_REPLAY_PASS: methodSpecs 98945/98963, original typedef interfaces, Pet/Figurine getters")
    print("NEED_SOURCE: historic d5487eb7 metadata bytes, size, extraction manifest; no original hash equivalence")
    print("NO_RUNTIME_AUTHORITY: finalMembershipKnown=false denominator=null writer=false")
if __name__=="__main__":run(sys.argv[1:])
