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
 // Same existing CLI + actual native dependency projection. All IDs are
 // synthetic, no real Save. Missing membership is evidence, not ownership.
 const d=JSON.parse(input);
 d.Player.ListInventories={
  0:{ID:0,CompatibleItemType:'ItemType_Furniture',Inventory:{}},
  1:{ID:1,CompatibleItemType:'ItemType_Clothing',Inventory:{50000001:{Amount:2,Marker:'ItemMarker_None'},50000002:{Amount:1}}},
  3:{ID:3,CompatibleItemType:'ItemType_Makeup',Inventory:{140000001:{Amount:1}}}
 };
 d.Player.AchievementsData=[{AchievementID:2110000001,CurAmount:2,MaxAmount:10,ClaimedRewardMilestone:0,State:'AchievementState_OnGoing'}];
 d.Player.EvolveStatesProfile={EvolveProgressState:{40000001:{ItemID:40000001,Level:1,Objective:{CurAmount:2,TargetAmount:5}}}};
 d.World.MissionSlots={0:{Slots:[{SlotId:0,MissionId:2070000001,CurrentStepIndex:0,State:'MissionSlotState_OnGoing',MissionSteps:[{SubSteps:[{Objectives:[{TargetAmount:4,ProgressKeys:{CurrentAmount:'2'},Status:'MissionStepStatus_Ongoing',StepType:'StepGameplay'}]}]}]}]}};
 const depCall=(doc,out,over={})=>{const b=Buffer.from(JSON.stringify(doc));return spawnSync(exe,['--avatar-dependencies-receipt-only','--out',out],{input:b,env:{...env,WAND_LOCAL_DECODED_SHA256:createHash('sha256').update(b).digest('hex'),...over},encoding:'utf8'})};
 const dep=join(dir,'dependencies.json');
 r=depCall(d,dep);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
 const w=JSON.parse(await readFile(dep));assert.equal(w.contract,'wand.native.private.avatar-dependencies@1');
 assert.equal(w.ownership.routes[0].entries.length,2);assert.equal(w.ownership.routes[1].entries[0].savedAmount,1);
 assert.equal(w.ownership.allObservedReferencesHavePositiveSavedAmount,true);
 assert.equal(w.subscriberReadSet.achievementsData.entries[0].curAmount.value,2);
 assert.equal(w.subscriberReadSet.missionSlots.groups[0].slots[0].steps[0].subSteps[0].objectives[0].witness.progressEntries[0].savedValue,'2');
 assert.equal(w.subscriberReadSet.evolveStatesProfile.entries[0].objective.curAmount.value,2);
 assert.equal(w.subscriberReadSet.nativeSubscriberClosureVerified,false);assert.equal(w.rightsVerified,false);assert.equal(w.writerAuthorized,false);
 if(process.platform!=='win32')assert.equal((await stat(dep)).mode&0o777,0o600);
 const absent=structuredClone(d);delete absent.Player.ListInventories[1].Inventory[50000001];
 r=depCall(absent,join(dir,'absent.json'));assert.equal(r.status,0,r.stderr);
 const aw=JSON.parse(await readFile(join(dir,'absent.json')));assert.equal(aw.ownership.allObservedReferencesHavePositiveSavedAmount,false);
 const bad=join(dir,'dep-bad.json');
 for(const mutate of [
  x=>{x.Player.ListInventories[1].ID=2},
  x=>{x.Player.ListInventories[3].CompatibleItemType='ItemType_Skin'},
  x=>{x.Player.ListInventories[1].Inventory[50000001].Amount='2'},
  x=>{x.Player.AchievementsData[0].CurAmount='2'},
  x=>{x.Player.EvolveStatesProfile.EvolveProgressState[40000001].ItemID=40000002},
 ]){
  const x=structuredClone(d);mutate(x);r=depCall(x,bad);assert.equal(r.status,12);assert.equal(r.stdout,'');assert.match(r.stderr,/AVATAR_DEPENDENCIES_READ_DENIED/);
 }
 r=depCall(d,dep);assert.equal(r.status,12);assert.match(r.stderr,/PRIVATE_OUTPUT_ALREADY_EXISTS/);
 assert.deepEqual(JSON.parse(await readFile(dep)),w);
 console.log('PRIVATE_AVATAR_DEPENDENCIES_SYNTHETIC_2POS6NEG_PASS');
 // Existing no-argument V1 result stays redacted and unchanged.
 r=call([]);assert.equal(r.status,0,r.stderr);const old=JSON.parse(r.stdout);
 assert.equal(old.contract,'wand.native.private.real-steam-v1@1');assert.equal(old.writerAuthorized,false);
 assert.equal(Object.hasOwn(old,'femaleAvatar'),false);
 console.log('PRIVATE_ACTIVE_AVATAR_NATIVE_CLI_SYNTHETIC_PASS_NO_PRIVATE_UPLOAD');
}finally{await rm(dir,{recursive:true,force:true})}
