// Independent QA-only, synthetic local fixtures. No real Save.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const exe=resolve(process.argv[2]), root=await mkdtemp(join(tmpdir(),'qac968-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const build='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const makeup='{"MakeupItemID":140000001, "Unknown":{"keep":[true,null]}}';
const female='{"HairColorIndex":-2147483648,"HairHighlightColor":0,"Clothes":{"17":0},"IncompatibleClothes":{},"Makeup":{"31":'+makeup+'},"ClothingCustomization":{"50000001":-2147483648}}';
const male='{"HairColorIndex":90,"HairHighlightColorIndex":0,"Clothes":{},"ClothingCustomization":{"50000002":2147483647}}';
const raw=Buffer.from('{"GameInfo":{"Version":626},"World":{},"Player":{"AvatarIsMale":false,"FemaleAvatar":'+female+',"MaleAvatar":'+male+'}}');
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:build,WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'777'};
const run=(args,body=raw,extra={})=>spawnSync(exe,args,{input:body,env:{...env,WAND_LOCAL_DECODED_SHA256:hash(body),...extra},encoding:'utf8'});
const path=n=>join(root,n+'.json'), args=p=>['--active-avatar-receipt-only','--out',p];
const good=async(n,body=raw)=>{const p=path(n),x=run(args(p),body);assert.equal(x.status,0,x.stderr);assert.equal(x.stdout,'');assert.equal(x.stderr.trim(),'LOCAL_RUST_V1_PRIVATE_AVATAR_RECEIPT_WRITTEN');if(process.platform!=='win32')assert.equal((await stat(p)).mode&0o777,0o600);return JSON.parse(await readFile(p));};
const deny=async(n,body=raw,extra={})=>{const p=path(n),x=run(args(p),body,extra);assert.equal(x.status,12,x.stderr);assert.equal(x.stdout,'');assert.match(x.stderr,/^LOCAL_RUST_V1_DENIED:[A-Z_]+\s*$/);await assert.rejects(readFile(p),{code:'ENOENT'});};
try{
 await test('1 exact two branch and map/entry byte hashes; signed scalar extremes and authority OFF',async()=>{
  const v=await good('hashes');assert.equal(v.activeBranch,'FemaleAvatar');assert.equal(v.avatarIsMale,false);assert.equal(v.femaleAvatar.branchSha256,hash(female));assert.equal(v.maleAvatar.branchSha256,hash(male));assert.equal(v.femaleAvatar.hairColorIndex,-2147483648);assert.equal(v.femaleAvatar.hairHighlightColorIndex,0);assert.equal(v.femaleAvatar.clothes.entries[0].savedValue,0);assert.equal(v.femaleAvatar.clothes.mapSha256,hash('{"17":0}'));assert.equal(v.femaleAvatar.makeup.entries[0].entrySha256,hash(makeup));assert.equal(v.femaleAvatar.makeup.entries[0].savedValue,140000001);assert.equal(v.femaleAvatar.clothingCustomization.entries[0].savedValue,-2147483648);assert.equal(v.maleAvatar.clothingCustomization.entries[0].savedValue,2147483647);assert.equal(v.decodedSha256,hash(raw));assert.equal(v.originalSha256SuppliedExternally,'b'.repeat(64));assert.equal(v.originalSizeBytesSuppliedExternally,777);
  for(const k of ['physicalGameInstallCryptographicallyProven','actualAllowedPaletteVerified','rightsVerified','nativeReferenceClosureVerified','cleanupClosureVerified','productReadAccepted','writerAuthorized','editedCopyAuthorized','applyAuthorized','nativeV3Verified','cloudUploadPerformed','originalModifiedByHarness'])assert.equal(v[k],false,k);
  assert.equal(v.activeHairFieldsPresent,true);assert.equal(v.activeBothPackagedHairIndicesCandidate,false);assert.equal(v.fullDocumentRustValidated,true);assert.equal(v.revision,0);assert.equal(v.indexGeneration,1);
 });
 await test('2 active branch switch, missing versus zero, empty versus absent and physical alias only',async()=>{
  const body=Buffer.from(raw.toString().replace('AvatarIsMale":false','AvatarIsMale":true'));const v=await good('male',body);
  assert.equal(v.activeBranch,'MaleAvatar');assert.equal(v.activeHairFieldsPresent,false);assert.equal(v.maleAvatar.hairHighlightColorPresent,false);assert.equal(v.maleAvatar.hairHighlightColorIndex,null);assert.equal(v.maleAvatar.incompatibleClothes.present,false);assert.equal(v.maleAvatar.incompatibleClothes.mapSha256,null);assert.equal(v.femaleAvatar.incompatibleClothes.present,true);assert.equal(v.femaleAvatar.incompatibleClothes.mapSha256,hash('{}'));assert.equal(v.maleAvatar.clothes.present,true);
  const w=await good('physical',Buffer.from(body.toString().replace('"HairHighlightColorIndex":0','"HairHighlightColor":0').replace('"HairColorIndex":90','"HairColorIndex":89')));assert.equal(w.activeBothPackagedHairIndicesCandidate,true);assert.notEqual(w.sessionId,v.sessionId);
 });
 await test('3 canonical decoded keys, exact hashes, duplicate alias and malformed source denial',async()=>{
  const v=await good('escaped',Buffer.from(raw.toString().replace('"AvatarIsMale"','"AvatarIs\\u004dale"').replace('"HairHighlightColor":0','"HairHighlight\\u0043olor":0')));assert.equal(v.femaleAvatar.hairHighlightColorIndex,0);
  for(const [n,s] of [['dup',raw.toString().replace('"HairHighlightColor":0','"HairHighlightColor":0,"HairHighlight\\u0043olor":1')],['extra',raw.toString()+'{}'],['schema',raw.toString().replace('626','624')],['gender',raw.toString().replace('AvatarIsMale":false','AvatarIsMale":"false"')]])await deny(n,Buffer.from(s));
 });
 await test('4 structural bounds: invalid inactive branch, map keys, signed overflow, branch size/fields',async()=>{
  const d=JSON.parse(raw);for(const [n,mut] of [
   ['inactive',x=>x.Player.MaleAvatar.Clothes={'18':50000001}],['mapkey',x=>x.Player.FemaleAvatar.Makeup={'32':{MakeupItemID:140000001}}],['overflow',x=>x.Player.MaleAvatar.HairColorIndex=2147483648],['nullmap',x=>x.Player.MaleAvatar.Clothes=null],['wrongprefix',x=>x.Player.MaleAvatar.ClothingCustomization={'140000001':0}],['fields',x=>{for(let i=0;i<65;i++)x.Player.MaleAvatar['q'+i]=0}],['bytes',x=>x.Player.MaleAvatar.Unknown='x'.repeat(1024*1024)]
  ]){const c=structuredClone(d);mut(c);await deny(n,Buffer.from(JSON.stringify(c)));}
 });
 await test('5 existing no-arg V1 shared paging boundary and redacted receipt',async()=>{
  const d=JSON.parse(raw);for(let i=0;i<35;i++)d.Player['unknown'+i]={a:i};for(let i=0;i<17;i++)d.World['w'+i]=i;
  const b=Buffer.from(JSON.stringify(d)),x=run([],b);assert.equal(x.status,0,x.stderr);const v=JSON.parse(x.stdout);assert.equal(v.contract,'wand.native.private.real-steam-v1@1');assert.equal(v.coreOwnedIndexedPlayerFields,38);assert.equal(v.coreOwnedIndexedWorldFields,17);assert.equal(v.writerAuthorized,false);assert.equal(Object.hasOwn(v,'femaleAvatar'),false);const a=await good('paged',b);assert.equal(a.activeBranch,'FemaleAvatar');
 });
 await test('6 output isolation and external attestation failures',async()=>{
  const p=path('sentinel');await writeFile(p,'keep');const x=run(args(p));assert.equal(x.status,12);assert.equal(x.stdout,'');assert.equal(await readFile(p,'utf8'),'keep');
  if(process.platform!=='win32'){const l=path('link');await symlink(p,l);const y=run(args(l));assert.equal(y.status,12);assert.equal(y.stdout,'');assert.equal(await readFile(p,'utf8'),'keep');const d=join(root,'public');await mkdir(d,{mode:0o755});const z=run(args(join(d,'out')));assert.equal(z.status,12);assert.equal(z.stdout,'');}
  for(const [i,e] of [{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)},{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'},{WAND_LOCAL_DECODED_SHA256:'c'.repeat(64)},{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}].entries())await deny('attest'+i,raw,e);
 });
}finally{await rm(root,{recursive:true,force:true});}
