// Public synthetic CLI checks only. No real Save or private artifact.
import {mkdtemp,readFile,rm,stat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'wand-character-skin-read-'));
const exe=resolve(process.argv[2]);
const input=Buffer.from(JSON.stringify({GameInfo:{Version:626},World:{Characters:[
 {Base:{id:10000002},SkinID:0},{Base:{id:10000053},SkinID:170000001}
]},Player:{ListInventories:{
 7:{ID:7,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}},
 42:{ID:42,CompatibleItemType:'ItemType_Skin',Inventory:{170000000:{Amount:1,Marker:'ItemMarker_None'}}}
}}}));
const sha=b=>createHash('sha256').update(b).digest('hex');
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'123',WAND_LOCAL_DECODED_SHA256:sha(input)};
const args=(path,c='10000053',s='170000000')=>['--character-skin-receipt-only',c,s,'--out',path];
const call=(a,over={},body=input)=>spawnSync(exe,a,{input:body,env:{...env,...over},encoding:'utf8'});
const deny=(r,code)=>{assert.equal(r.status,12,r.stderr);assert.equal(r.stdout,'');assert.match(r.stderr,new RegExp(code));};
try{
 const path=join(dir,'private.json');
 let p=call(args(path));assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const v=JSON.parse(await readFile(path));
 assert.equal(v.contract,'wand.native.private.character-skin-read@1');
 assert.equal(v.character.characterId,10000053);assert.equal(v.character.currentSkinId,170000001);
 assert.equal(v.skinInventory.inventoryId,42);assert.equal(v.skinInventory.savedAmount,1);
 assert.equal(v.skinInventory.savedMarker,'ItemMarker_None');
 assert.equal(v.decodedSha256,sha(input));assert.equal(v.revision,0);assert.equal(v.indexGeneration,1);
 const d=JSON.parse(input);
 assert.equal(v.character.characterSha256,sha(Buffer.from(JSON.stringify(d.World.Characters[1]))));
 assert.equal(v.skinInventory.entrySha256,sha(Buffer.from(JSON.stringify(d.Player.ListInventories[42].Inventory[170000000]))));
 for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','nativeV3Verified','ownedRightsVerified','characterSkinCompatibilityVerified'])assert.equal(v[k],false,k);
 for(const k of ['catalogDefinitionVerified','actualConditionsEvaluated','activeReferenceClosureVerified','subscriberClosureVerified'])assert.equal(v.referenceReadSet[k],false,k);
 if(process.platform!=='win32')assert.equal((await stat(path)).mode&0o777,0o600);
 const bad=join(dir,'bad.json');
 deny(call(args(path)),'PRIVATE_OUTPUT_ALREADY_EXISTS');
 deny(call(args('relative.json')),'PRIVATE_OUTPUT_ABSOLUTE_REQUIRED');
 deny(call(args(bad,'010000053')),'CHARACTER_SKIN_SELECTOR_ID');
 deny(call(args(bad,'10000053','2147483648')),'CHARACTER_SKIN_SELECTOR_ID');
 deny(call(args(bad,'10000099')),'CHARACTER_SKIN_READ_DENIED');
 deny(call(args(bad,'10000053','170100001')),'CHARACTER_SKIN_READ_DENIED');
 deny(call(args(bad),{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)}),'DECODED_SOURCE_SHA_MISMATCH');
 deny(call(args(bad),{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}),'EXACT_EXTERNAL_STEAM_BUILD_REQUIRED');
 if(process.platform!=='win32'){
  const link=join(dir,'link');await symlink(path,link);
  deny(call(args(link)),'PRIVATE_OUTPUT_ALREADY_EXISTS');
 }
 assert.deepEqual(JSON.parse(await readFile(path)),v);
 p=call([]);assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).contract,'wand.native.private.real-steam-v1@1');
 assert.equal(Object.hasOwn(JSON.parse(p.stdout),'character'),false);
 console.log('PRIVATE_CHARACTER_SKIN_NATIVE_CLI_SYNTHETIC_PASS_NO_PRIVATE_UPLOAD');
}finally{await rm(dir,{recursive:true,force:true})}
