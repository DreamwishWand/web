// Public synthetic CLI checks only. No real Save or private artifact.
import {mkdtemp,readFile,rm,stat,symlink,mkdir} from 'node:fs/promises';
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
 // E1324 minimized synthetic regression. Preserve selected target evidence;
 // unrelated route zero is valid only when its own key and ID agree.
 const zero=JSON.parse(input);
 zero.Player.ListInventories[0]={ID:0,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}};
 const body=Buffer.from(JSON.stringify(zero));
 const zpath=join(dir,'zero.json');
 p=call(args(zpath),{WAND_LOCAL_DECODED_SHA256:sha(body)},body);
 assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
 const z=JSON.parse(await readFile(zpath));
 assert.deepEqual(z.character,v.character);assert.deepEqual(z.skinInventory,v.skinInventory);
 assert.notEqual(z.referenceReadSet.listInventoriesSha256,v.referenceReadSet.listInventoriesSha256);
 assert.equal(z.writerAuthorized,false);assert.equal(z.ownedRightsVerified,false);
 for(const badRecord of [
  {ID:1,CompatibleItemType:'ItemType_ActivityItem',Inventory:{}},
  {ID:0,CompatibleItemType:'ItemType_Skin',Inventory:{170000000:{Amount:1}}},
  {ID:'0',CompatibleItemType:'ItemType_ActivityItem',Inventory:{}}
 ]){
  const d=JSON.parse(body);d.Player.ListInventories[0]=badRecord;
  const bytes=Buffer.from(JSON.stringify(d));
  deny(call(args(bad),{WAND_LOCAL_DECODED_SHA256:sha(bytes)},bytes),'CHARACTER_SKIN_READ_DENIED');
 }
 assert.deepEqual(JSON.parse(await readFile(zpath)),z);
 console.log('NONSKIN_ZERO_ROUTE_SYNTHETIC_POS_NEG_PASS');
 assert.deepEqual(JSON.parse(await readFile(path)),v);
 p=call([]);assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).contract,'wand.native.private.real-steam-v1@1');
 assert.equal(Object.hasOwn(JSON.parse(p.stdout),'character'),false);

 // ACT395: new Linux-only pinned private transport. All data synthetic.
 if(process.platform==='linux'){
  const dep=JSON.parse(input);
  dep.Player.ListInventories[42].Inventory[170000001]={Amount:1,Marker:'ItemMarker_None'};
  dep.World.DialogueFlags=[50000001,50000002,50000001];
  dep.ConditionalEventHistory={ActiveEvents:{1520000001:{SpawnState:{Unknown:1}}},Inbox:{}};
  const depArgs=(out,flag='50000001')=>['--character-skin-dependencies-receipt-only','10000053','170000000',flag,'--out',out];
  const depCall=(doc,out,over={},flag='50000001')=>{
   const b=Buffer.from(JSON.stringify(doc));return call(depArgs(out,flag),{WAND_LOCAL_DECODED_SHA256:sha(b),...over},b)
  };
  const target=join(dir,'skin-deps.json');
  p=depCall(dep,target);assert.equal(p.status,0,p.stderr);assert.equal(p.stdout,'');
  const v=JSON.parse(await readFile(target));
  assert.equal(v.contract,'wand.native.private.character-skin-dependencies@1');
  assert.equal(v.dialogueFlag.persistedMembership,true);
  assert.deepEqual(v.dialogueFlag.targetPositions,[0,2]);
  assert.equal(v.dialogueFlag.effectiveFlagValue,null);
  assert.equal(v.dialogueFlag.runtimeOverrideKeyPresent,null);
  assert.equal(v.dialogueFlag.persistedList.sha256,sha(Buffer.from(JSON.stringify(dep.World.DialogueFlags))));
  assert.equal(v.oldSkinInventory.itemId,170000001);
  assert.equal(v.subscriberReadSet.conditionalEventHistory.activeEvents.entries[0].eventId,1520000001);
  assert.equal(v.selectedSkin.sessionId,v.sessionId);
  assert.equal(v.selectedSkin.decodedSha256,v.decodedSha256);
  assert.equal(v.originalSha256SuppliedExternally,'a'.repeat(64));
  for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized','applyAuthorized','nativeV3Verified','rightsVerified'])assert.equal(v[k],false,k);
  assert.equal((await stat(target)).mode&0o777,0o600);
  const absent=structuredClone(dep);delete absent.World.DialogueFlags;
  const absentPath=join(dir,'flags-absent.json');
  p=depCall(absent,absentPath);assert.equal(p.status,0,p.stderr);
  const av=JSON.parse(await readFile(absentPath));
  assert.equal(av.dialogueFlag.persistedMembership,null);
  assert.equal(av.dialogueFlag.effectiveFlagValue,null);
  const off=structuredClone(dep);off.World.DialogueFlags=[50000002];off.World.DialogueFlagsOverride={'50000001':true};
  const offPath=join(dir,'flags-off.json');
  p=depCall(off,offPath);assert.equal(p.status,0,p.stderr);
  assert.equal(JSON.parse(await readFile(offPath)).dialogueFlag.effectiveFlagValue,null);
  const badPath=join(dir,'skin-dep-bad.json');
  for(const mutate of [
   x=>{x.World.DialogueFlags=null},
   x=>{x.World.DialogueFlags=['50000001']},
   x=>{x.World.DialogueFlags=[1.5]},
   x=>{x.ConditionalEventHistory.ActiveEvents={'01520000001':{}}},
   x=>{delete x.Player.ListInventories[42].Inventory[170000001]},
  ]){
   const x=structuredClone(dep);mutate(x);deny(depCall(x,badPath),'CHARACTER_SKIN_DEPENDENCIES_READ_DENIED');
  }
  deny(depCall(dep,target),'PRIVATE_OUTPUT_ALREADY_EXISTS');
  deny(depCall(dep,badPath,{},'050000001'),'CHARACTER_SKIN_SELECTOR_ID');
  deny(depCall(dep,badPath,{WAND_LOCAL_DECODED_SHA256:'f'.repeat(64)}),'DECODED_SOURCE_SHA_MISMATCH');
  deny(depCall(dep,badPath,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'wrong'}),'EXACT_EXTERNAL_STEAM_BUILD_REQUIRED');
  const pub=join(dir,'public');await mkdir(pub,{mode:0o755});
  deny(depCall(dep,join(pub,'bad.json')),'PRIVATE_OUTPUT_DIRECTORY_PERMISSIONS');
  const link=join(dir,'dep-link');await symlink(target,link);
  deny(depCall(dep,link),'PRIVATE_OUTPUT_ALREADY_EXISTS');
  assert.deepEqual(JSON.parse(await readFile(target)),v);
  console.log('ACT395_SKIN_DEPENDENCIES_SAME_SESSION_FLAGS_UNKNOWN_OVERRIDE_PRIVATE_OUTPUT_PASS');
 }
 console.log('PRIVATE_CHARACTER_SKIN_NATIVE_CLI_SYNTHETIC_PASS_NO_PRIVATE_UPLOAD');
}finally{await rm(dir,{recursive:true,force:true})}
