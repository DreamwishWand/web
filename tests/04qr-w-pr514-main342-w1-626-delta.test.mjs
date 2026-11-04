/** 04QR-W / PR514 changed-main342 W1×World 626 cross-domain NEW-ONLY QA.
 * Old QA517 main24a6 and independent 05QR-C QA515 are inherited, not repeated.
 * This is synthetic, not a native semantics/real P1G test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {inspectW1SceneAreaReferences} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const MAIN='342823eb03eff6bb7c5d80f4a804249bb174df10';
const INTEGRATED='22d47dffc48c2eb7301c4c8074c1bdc9c5d019cb';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const four=Object.freeze({
 'scripts/wep-schema626-readonly-browser-acceptance.mjs':'7c63a131e5dc75002e06158c7a826ceb03feaa8e',
 'src/lib/wep/world-save-source.ts':'9888b91c92953cf0f9fd828d2ba0cb763e35dac5',
 'tests/wep-schema626-gridobject-structural-count.test.mjs':'ab48f8e251511c017d81b130ceef04a040c8a8d4',
 'tests/wep-world-readonly626.test.mjs':'5719697f0dcabaf8b1008082346568e7d289627b'
});
const newMainW1=Object.freeze({
 'docs/core/01e-w1-scene-area-reference-readonly-20261104.md':'20b819f42508681bd9349054d9f3dc1e3f2b0d01',
 'src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs':'f8b6d87d17690a283088feaa38df8064dc0bc4b3',
 'tests/01e-w1-scene-area-reference-readonly.test.mjs':'c9845f19b1724e1e2c52c20c8de1bb8eb9b033ee'
});
const external={sourcePlatform:'switch',targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE};
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626,sourceSha256:'a'.repeat(64),sourceRevision:'untrusted-claim'};
const fixture=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},
 World:{Villages:[
  {SceneItemId:1540000000,Areas:{
   '1':{Unlocked:true,GridIDs:[10,20]},
   '7':{Unlocked:false,GridIDs:[21]}
  }},
  {SceneItemId:1540000001,Areas:{'20':{Unlocked:true,GridIDs:[]}}}
 ],GridCollection:{Grids:{
  '10':{ID:10,Objects:{'42':{State:{FutureOpaque:true}},'43':{State:{}}}},
  '20':{ID:20,Objects:{'44':{State:{}}}}
 },DiffGrids:{
  '10':{ID:10,ModifiedObjects:{'47':{}},RemovedObjects:{}},
  '21':{ID:21,ModifiedObjects:{},RemovedObjects:{}}
 }}}});
const inspect=async p=>{
 const bytes=makeSyntheticP1gProfile(p),original=bytes.slice();
 const sha=createHash('sha256').update(bytes).digest('hex');
 const open=await openWorldSaveBytes(bytes,external);
 assert.deepEqual(bytes,original);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
 const w1=inspectW1SceneAreaReferences(open.profile,ctx);
 assert.equal(open.profileSchemaVersion,626);
 assert.equal(open.compatibility.readOnly,true);
 assert.equal(open.compatibility.routesAuthorized,false);
 assert.equal(open.compatibility.editingAuthorized,false);
 assert.equal(open.compatibility.persistentWriteAuthorized,false);
 assert.equal(open.compatibility.verifiedReplacementCandidateAuthorized,false);
 assert.equal(open.compatibility.productApplyAuthorized,false);
 return {open,w1};
};
test('NEW main342 plus PR514 exact 4 approved Source blobs; no duplicate old-main QA',()=>{
 assert.equal(git('merge-base',MAIN,INTEGRATED),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,INTEGRATED).split('\n').sort(),Object.keys(four).sort());
 for(const [p,sha] of Object.entries(four))assert.equal(git('hash-object',p),sha,'selected '+p);
 for(const [p,sha] of Object.entries(newMainW1)){
  assert.equal(git('hash-object',p),sha,'W1 main '+p);
  assert.equal(git('rev-parse',MAIN+':'+p),sha,'W1 inherited '+p);
 }
});
test('QA-only 3 new files, exact no Writer, product/01E/02 WEP source untouched',()=>{
 assert.deepEqual(git('diff','--name-only',INTEGRATED,'HEAD').split('\n').sort(),[
 '.github/workflows/04qr-w-pr514-main342-w1-626-delta.yml',
 'scripts/04qr-w-pr514-main342-w1-626-chromium.mjs',
 'tests/04qr-w-pr514-main342-w1-626-delta.test.mjs'
 ]);
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),'5ae7f7640a99b05083b20b784fb0cbf3693fee84');
 assert.match(readFileSync('.github/workflows/04qr-w-pr514-main342-w1-626-delta.yml','utf8'),/WEP_PRIVATE_P1G_PATH/);
});
test('NEW cross-domain W1 candidate can coexist with 626 read-only raw count, never Native/Writer',async()=>{
 const {open,w1}=await inspect(fixture());
 assert.equal(open.structuralDiagnostics.villageCount,2);
 assert.equal(open.structuralDiagnostics.areaRecordCount,4);
 assert.equal(open.structuralDiagnostics.gridObjectEntryCount,3);
 assert.equal(open.structuralDiagnostics.gridRecordCount,2);
 assert.deepEqual(open.areas,[]);
 assert.equal(w1.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
 assert.deepEqual(w1.sourceCandidates.map(x=>x.saveAreaKey),['1','7']);
 assert.deepEqual(w1.sourceCandidates.find(x=>x.saveAreaKey==='1').sourceGridRefs.map(x=>x.sourceKind),['GRIDS_AND_DIFF_UNRESOLVED','GRIDS_ONLY']);
 assert.deepEqual(w1.sourceCandidates.find(x=>x.saveAreaKey==='7').sourceGridRefs.map(x=>x.sourceKind),['DIFF_ONLY_DEFAULT_UNRESOLVED']);
 assert.equal(w1.selectedNativeWetlandAreaKey,null);
 assert.equal(w1.nativeEffectiveGridVerified,false);
 assert.equal(w1.nativeSoftwoodQuotaVerified,false);
 assert.equal(w1.sourceRevisionCasVerified,false);
 assert.equal(w1.inputAuthenticatedByThisReader,false);
 assert.equal(w1.productWriterAuthorized,false);
 assert.equal(w1.productEditedCopyAuthorized,false);
});
test('negative: 626 World raw count is NOT W1 Source integrity when paired DiffGrid Source ID is corrupt',async()=>{
 const p=fixture();p.World.GridCollection.DiffGrids['10'].ID=999;
 const {open,w1}=await inspect(p);
 assert.equal(open.structuralDiagnostics.gridObjectEntryCount,3,'raw World remains readable cardinality ONLY');
 assert.equal(w1.status,'SOURCE_STRUCTURE_REJECTED');
 assert.equal(w1.reason,'SOURCE_GRID_MAP_ID_MISMATCH');
 assert.equal(w1.productWriterAuthorized,false);
 assert.equal(open.compatibility.persistentWriteAuthorized,false);
});
test('negative: duplicate SceneItemId cannot be inferred from valid 626 raw diagnostic count',async()=>{
 const p=fixture();p.World.Villages[1].SceneItemId=1540000000;
 const {open,w1}=await inspect(p);
 assert.equal(open.structuralDiagnostics.gridObjectEntryCount,3);
 assert.equal(w1.status,'SOURCE_STRUCTURE_REJECTED');
 assert.equal(w1.reason,'SCENE_ID_NOT_UNIQUE');
 assert.equal(open.compatibility.routesAuthorized,false);
});
test('negative: caller-given W1 trust or Native flags cannot elevate independently read-only 626 source',async()=>{
 const p=fixture();
 const {open}=await inspect(p);
 const forged=inspectW1SceneAreaReferences(open.profile,{...ctx,sourceRevisionCasVerified:true,inputAuthenticatedByThisReader:true,productWriterAuthorized:true,nativeEffectiveGridVerified:true});
 assert.equal(forged.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
 assert.equal(forged.sourceRevisionCasVerified,false);
 assert.equal(forged.inputAuthenticatedByThisReader,false);
 assert.equal(forged.nativeEffectiveGridVerified,false);
 assert.equal(forged.productWriterAuthorized,false);
 await assert.rejects(()=>openWorldSaveBytes(makeSyntheticP1gProfile(p),{...external,targetBuild:{...external.targetBuild,value:'0000000000000000'}}),/UNSUPPORTED_BUILD/);
});
