// Synthetic native CLI test only. No owner Save or private artifact.
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'wand-avatar-read-'));
const exe=resolve(process.argv[2]);
const input=Buffer.from(JSON.stringify({GameInfo:{Version:626},World:{},Player:{
 AvatarIsMale:false,FemaleAvatar:{HairColorIndex:0,HairHighlightColor:0,Clothes:{0:50000001},Makeup:{},ClothingCustomization:{50000001:7}},
 MaleAvatar:{HairColorIndex:89,HairHighlightColor:1,Clothes:{5:50000002},Makeup:{1:{MakeupItemID:140000001}},ClothingCustomization:{}}
}}));
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'123',WAND_LOCAL_DECODED_SHA256:createHash('sha256').update(input).digest('hex')};
const call=(args,over={})=>spawnSync(exe,args,{input,env:{...env,...over},encoding:'utf8'});
try{
 const path=join(dir,'private.json');
 let r=call(['--active-avatar-receipt-only','--out',path]);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
 const v=JSON.parse(await readFile(path));
 assert.equal(v.activeBranch,'FemaleAvatar');assert.equal(v.femaleAvatar.hairColorIndex,0);
 assert.equal(v.maleAvatar.hairColorIndex,89);assert.equal(v.maleAvatar.makeup.entries[0].savedValue,140000001);
 assert.equal(v.femaleAvatar.clothingCustomization.entries[0].savedValue,7);
 assert.equal(v.femaleAvatar.incompatibleClothes.present,false);
 assert.equal(v.activeBothPackagedHairIndicesCandidate,true);
 for(const k of ['rightsVerified','actualAllowedPaletteVerified','nativeReferenceClosureVerified','cleanupClosureVerified','writerAuthorized','productReadAccepted','applyAuthorized','nativeV3Verified'])assert.equal(v[k],false,k);
 if(process.platform!=='win32')assert.equal((await stat(path)).mode&0o777,0o600);
 for(const [args,over,code] of [
  [['--active-avatar-receipt-only','--out',path],{},'PRIVATE_OUTPUT_ALREADY_EXISTS'],
  [['--active-avatar-receipt-only','--out','relative'],{},'PRIVATE_OUTPUT_ABSOLUTE_REQUIRED'],
  [['--active-avatar-receipt-only','--out',join(dir,'bad')],{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)},'DECODED_SOURCE_SHA_MISMATCH'],
  [['--active-avatar-receipt-only','--out',join(dir,'bad')],{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'},'EXACT_EXTERNAL_STEAM_BUILD_REQUIRED']
 ]){
  r=call(args,over);assert.equal(r.status,12);assert.equal(r.stdout,'');assert.match(r.stderr,new RegExp(code));
 }
 // Existing no-argument V1 result stays redacted and unchanged.
 r=call([]);assert.equal(r.status,0,r.stderr);const old=JSON.parse(r.stdout);
 assert.equal(old.contract,'wand.native.private.real-steam-v1@1');assert.equal(old.writerAuthorized,false);
 assert.equal(Object.hasOwn(old,'femaleAvatar'),false);
 console.log('PRIVATE_ACTIVE_AVATAR_NATIVE_CLI_SYNTHETIC_PASS_NO_PRIVATE_UPLOAD');
}finally{await rm(dir,{recursive:true,force:true})}
