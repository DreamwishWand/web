#!/usr/bin/env python3
"""Generate reference-only Steam626 Vase geometry/limit pack from installed assets.
Inputs are original installed data, not save/profile files. No raw data is emitted.
"""
import collections, hashlib, json, pathlib, struct, sys
P=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); H=lambda b: hashlib.sha256(b).hexdigest()
PINS={'Furniture.json':'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674','Building.json':'c111aea8770c2b210d4e544a7562d3d08a068b1427842f604f878ea8f4d294a3','Village04-DarkLevel-GridData.json':'8fbda0bf2eca25bc1b6ea38461f325d24a658fb646ed5698e3cf6c306f8d1aa7','protoDb.bin':'1912bb552abddac8b112fa5a781a0401672add38a62276d6c9174db39b899ae1','FullVersion.txt':'763d42f58ed345430ced4627af6dddd8c31a941e3a6a2de30cba3408cd4aabb4'}
def raw(n):
 b=(P/n).read_bytes(); assert H(b)==PINS[n],n; return b
def vi(b,i):
 start=i;v=0
 for j in range(10):
  assert i<len(b);c=b[i];i+=1;v|=(c&127)<<(7*j)
  if not c&128:
   assert not(i-start>1 and c==0) and not(j==9 and c>1);return v,i
 raise ValueError('varint')
def fields(b):
 i=0; out=[]
 while i<len(b):
  tag,i=vi(b,i);n,w=tag>>3,tag&7;assert 0<n<=536870911
  if w==0:v,i=vi(b,i)
  elif w in (1,5,2):
   if w==2:z,i=vi(b,i)
   else:z=8 if w==1 else 4
   assert i+z<=len(b);v=b[i:i+z];i+=z
  else:raise ValueError('wire')
  out.append((n,w,v))
 return out
def group(b,schema,repeated=()):
 d={}
 for n,w,v in fields(b):
  assert schema.get(n)==w
  if n in repeated:d.setdefault(n,[]).append(v)
  else:assert n not in d;d[n]=v
 return d
def catalog(name,major):
 b=raw(name);i=0;d={}
 while i<len(b):
  k,i=vi(b,i);n,i=vi(b,i);assert 0<n<=len(b)-i;r=b[i:i+n];i+=n
  ids=[v for f,w,v in fields(r) if (f,w)==(1,0)];assert len(ids)==1
  v=ids[0];assert v//10000000==major and v%10000000==k and v not in d;d[v]=r
 return d
f=catalog('Furniture.json',4);b=catalog('Building.json',2);assert len(f)==6233 and len(b)==440
D={};missing=[];VASE=40000066
for i,r in sorted({**f,**b}.items()):
 a=[v for n,w,v in fields(r) if (n,w)==(6,2)]
 if not a:missing.append(i);continue
 assert len(a)==1;q=group(a[0],{1:0,2:0,3:2,4:0,5:2},(3,));w,h=q[1],q[2];assert 0<w<=256 and 0<h<=256 and len(b''.join(q[3]))==4*w*h
 D[i]=(w,h)
 if i==VASE:assert (w,h,struct.unpack('<I',b''.join(q[3]))[0],q[4],H(r))==(1,1,0x144,0x07cbf4ff,'60f840fa471e3678b5f7a018466d150882ad7bddaece6ada9a86327fd1c0607a')
assert len(D)==6591 and len(missing)==82 and all(i//10000000==2 for i in missing)
# exact ground-alteration subtype membership; no major-only classification at runtime
ex=sorted(i for i in f if i//10000000==4 and i%10000000//100000==1)
g=group(raw('Village04-DarkLevel-GridData.json'),{1:0,2:0,4:2,5:2});nx,ny=g[1],g[2];lut=struct.unpack('<IIII',g[4]);assert (nx,ny,lut)==(250,175,(0,64,256,512)) and len(g[5])==(nx*ny+3)//4
floor=bytearray((nx*ny+7)//8)
for i in range(nx*ny):
 if lut[(g[5][i//4]>>(6-2*(i%4)))&3]==64:floor[i//8]|=1<<(i%8)
# Read the exact limit records from the pinned protobuf map (outer repeated tag1, inner key/value).
proto=raw('protoDb.bin'); rows={}
for n,w,v in fields(proto):
 assert (n,w)==(1,2);q=group(v,{1:2,2:2});k=q[1].decode();assert k not in rows;rows[k]=q[2]
assert len(rows)==1944
limits=[]
for name,expected,u,c in [('Village04ObjectLimit','6412c6019d56c560cad44548c19bc348418e23fe093975a1a50d3955a7f98a08',600,3000),('HighEndVillageObjectLimit','08708bdcca1525eb9a1183aab20de5864ff1141068e8aae4c74bd096e1e60fef',1200,6000)]:
 e=group(rows[name],{2:2,3:2,4:2,5:2,6:2});assert e[2]==b'Villages' and e[3].decode()==name and e[5]==b'Definitions.Grid.ObjectLimitData'
 r=e[6];assert H(r)==expected
 o=group(r,{1:0,2:0,3:2,4:2},(3,4)); selectors=[group(x,{1:0,2:0,3:2}) for x in o[3]]
 assert len(selectors)==3 and {(x[1],x[2],x[3].decode()) for x in selectors}=={(3,1,'Ephemeral'),(4,1,'Fence'),(4,1,'GroundAlteration')}
 assert (o[1],o[2])==(u,c) and not o.get(4);limits.append([name,u,c,expected])
assert raw('FullVersion.txt').decode().strip()=='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'
header={'contract':'wand.core.steam626.vase-geometry-quota-reference@1','build':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22','schema':626,'authority':'REFERENCE_ONLY_FIXED_NORMAL_RETAIL','gridPath':'GridData/Villages/Village04-DarkLevel-GridData.json','gridSize':[250,175],'tessellation':2,'floorMask':64,'floorEncoding':'x-major-lsb0-hex','floorCount':sum(x.bit_count() for x in floor),'vase':[VASE,1,1,324,130807039],'pins':PINS,'dimsCount':len(D),'excludedCount':len(ex),'limits':limits}
lines=[header]
for off in range(0,len(floor),256):lines.append(['floor',off,floor[off:off+256].hex()])
by=collections.defaultdict(list)
for i,(w,h) in D.items():by[w,h].append(i)
for (w,h),ids in sorted(by.items()):
 for off in range(0,len(ids),64):lines.append(['dims',w,h,ids[off:off+64]])
for off in range(0,len(ex),64):lines.append(['excluded',ex[off:off+64]])
content=''.join(json.dumps(x,separators=(',',':'),sort_keys=True)+'\n' for x in lines).encode();out.write_bytes(content)
print('pack',len(content),H(content),'lines',len(lines),'floor',header['floorCount'],'dims',len(D),'excluded',len(ex),'max line',max(map(len,content.splitlines())))
