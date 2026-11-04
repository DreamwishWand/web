// 05 QR NEW-only PR459: independent static Registry SOURCE negative tests.
// Exact tracked public 508-row corpus. No private Save, game binary, key or runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 W1_V3_SOURCE_CONTRACT, W1_SOURCE_TARGET, W1_NATIVE_STATIC_DEPENDENCIES,
 inspectW1StaticRegistry, describeW1NativeV3Gaps
} from '../src/lib/ddv/timing/w1-native-v3-source-evidence.mjs';
const original=readFileSync(new URL('../static/ddv/timing/v1.25.3/recurring-events.json',import.meta.url));
const digest=bytes=>createHash('sha1').update('blob '+bytes.byteLength+'\0').update(bytes).digest('hex');
const originalReg=JSON.parse(original.toString('utf8'));
const copy=()=>JSON.parse(original.toString('utf8'));
const targetId=2010000021, itemId=31700014;
const forward=d=>d.events.find(x=>x.id===targetId);
const outputGrantNames=['nativeV3Accepted','productWriterAuthorized','editedCopyAuthorized','automaticDateRepairAuthorized','completeOperationReadSetAccepted'];
const expectedIds=[2010000021,2010000022,2010000024,2010000025,2010000099,2010000121,2010000122,2010000123];
function assertDenied(d,reason) {
 const r=inspectW1StaticRegistry(d,{nativeV3Accepted:true,productWriterAuthorized:true});
 assert.equal(r.status,'SOURCE_UNAVAILABLE');
 assert.equal(r.reason,reason);
 for(const k of outputGrantNames)assert.equal(r[k],false,k);
 const g=describeW1NativeV3Gaps(r);
 assert.equal(g.status,'SOURCE_UNAVAILABLE');
 assert.equal(g.nativeV3Accepted,false);
 assert.equal(g.productWriterAuthorized,false);
}
test('Independent Git blob over full original 508-row registry, exactly matching fixed W1 target identity',()=>{
 assert.equal(digest(original),'d8a4031a20369e2ba70cb143dec178b73254eff8');
 assert.equal(digest(original),W1_SOURCE_TARGET.staticRegistryGitBlob);
 assert.equal(originalReg.events.length,508);
 const row=forward(originalReg);
 assert.equal(row.eventPolicy,'W1');
 assert.equal(row.name,'Wood!Wetland_Softwood');
 assert.equal(row.active,true);
 assert.deepEqual(row.items.map(v=>v.id),[itemId]);
 const ids=originalReg.events.filter(r=>r.items.some(v=>v?.id===itemId)).map(r=>r.id);
 assert.deepEqual(ids,expectedIds);
 const r=inspectW1StaticRegistry(originalReg);
 assert.equal(r.contract,W1_V3_SOURCE_CONTRACT);
 assert.equal(r.status,'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH');
 assert.deepEqual(r.referrerEventIds,expectedIds);
 assert.equal(r.activeReferrerCount,4);
 assert.equal(r.sourceEventId,targetId);
 assert.equal(r.savedMapKey,'155');
 assert.equal(r.itemIdUniqueProducer,false);
 assert.equal(r.reverseItemIdLookupAuthorized,false);
 assert.equal(r.sourceBlobAuthenticatedByThisFunction,false);
 assert.equal(r.installedBidAuthenticatedByThisFunction,false);
 assert.equal(r.productWriterAuthorized,false);
 assert.equal(r.automaticDateRepairAuthorized,false);
});
test('All registered version/BID/schema/ROMFS hashes and Writer metadata must match; no schema→BID inference',()=>{
 for(const [key,mutation] of [
  ['version','1.25.0'],['buildId','52BD625D9B4E0053'],['schema',624],
  ['rawEventSHA256','a'.repeat(64)],['writerAuthorization',true],
  ['writerAuthorization',undefined]
 ]) {
  const d=copy();if(mutation===undefined)delete d.source[key];else d.source[key]=mutation;
  assertDenied(d,'EXACT_ROMFS_VERSION_AND_SOURCE_IDENTITY_REQUIRED');
 }
 assert.equal(W1_SOURCE_TARGET.bid,'9A239D3DB569756D');
 assert.equal(W1_SOURCE_TARGET.schema,626);
 assert.equal(W1_SOURCE_TARGET.originalRomfsEventSha256,'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea');
});
test('Mutation/removal of target event, single Softwood forward relation or source W1 state fails closed',()=>{
 const variations=[
  d=>{forward(d).name='Wood!VillageOther';},
  d=>{forward(d).eventPolicy='other';},
  d=>{forward(d).active=false;},
  d=>{forward(d).items=[];},
  d=>{forward(d).items[0].id=31700015;},
  d=>{forward(d).items.push({id:31700014});},
  d=>{d.events=d.events.filter(r=>r.id!==targetId);d.events.push({id:999999900,name:'replacement',items:[]});}
 ];
 for(const edit of variations){const d=copy();edit(d);
  assertDenied(d,'TARGET_EVENT_TO_ITEM_FORWARD_REFERENCE_CHANGED');
 }
});
test('Every one of eight inverse referrers is required with exact active state; reverse unique ItemID lookup denied',()=>{
 for(const id of expectedIds.filter(x=>x!==targetId)){
  const d=copy();const row=d.events.find(x=>x.id===id);
  row.items=row.items.filter(x=>x.id!==itemId);
  assertDenied(d,'SOFTWOOD_ITEM_ID_INVERSE_REFERENCE_SET_CHANGED');
 }
 for(const id of expectedIds.filter(x=>x!==targetId)){
  const d=copy(),row=d.events.find(x=>x.id===id);row.active=!row.active;
  assertDenied(d,'SOFTWOOD_ITEM_ID_INVERSE_REFERENCE_SET_CHANGED');
 }
 const positive=inspectW1StaticRegistry(originalReg,{sourceBlobAuthenticatedByThisFunction:true,
  itemIdUniqueProducer:true,reverseItemIdLookupAuthorized:true});
 assert.equal(positive.itemIdUniqueProducer,false);
 assert.equal(positive.reverseItemIdLookupAuthorized,false);
 assert.equal(positive.sourceBlobAuthenticatedByThisFunction,false);
 assert.equal(positive.nativeV3Accepted,false);
});
test('Corpus shape changes, duplicate ID, extra Softwood producer and spoofed claim cannot upgrade SOURCE_ONLY',()=>{
 const edits=[
  d=>{d.events.pop();},
  d=>{d.events.push({...d.events[0]});},
  d=>{d.events[0].id=d.events[1].id;},
  d=>{d.events[0].items='spoofed';}
 ];
 for(const edit of edits){const d=copy();edit(d);
  assert.equal(inspectW1StaticRegistry(d).status,'SOURCE_UNAVAILABLE');
 }
 const d=copy();
 const unrelated=d.events.find(x=>!expectedIds.includes(x.id));
 unrelated.items.push({id:itemId});
 assertDenied(d,'SOFTWOOD_ITEM_ID_INVERSE_REFERENCE_SET_CHANGED');
 const forged=inspectW1StaticRegistry(originalReg,{
  nativeV3Accepted:true,completeOperationReadSetAccepted:true,
  productWriterAuthorized:true,editedCopyAuthorized:true,automaticDateRepairAuthorized:true,
  installedBidAuthenticatedByThisFunction:true,sourceBlobAuthenticatedByThisFunction:true
 });
 for(const k of outputGrantNames)assert.equal(forged[k],false);
 assert.equal(forged.callerClaimsIgnored,true);
 assert.equal(forged.installedBidAuthenticatedByThisFunction,false);
});
test('W1 Native dependency ledger leaves Wetland Area/Grid/Quota and cold Clock unproved, 2126 never auto-repaired',()=>{
 const r=inspectW1StaticRegistry(originalReg),g=describeW1NativeV3Gaps(r);
 assert.equal(g.status,'NATIVE_V3_OUTSTANDING');
 assert.equal(g.evidenceClass,undefined);
 assert.equal(g.sourceEventId,targetId);
 assert.equal(g.savedMapKey,'155');
 assert.equal(g.sourceStaticFacts.evidenceClass,'SOURCE_ONLY');
 assert.equal(g.sourceStaticFacts.villageAreaType,1);
 assert.equal(g.sourceStaticFacts.sceneId,1540000000);
 assert.equal(g.sourceStaticFacts.tagId,2001200008);
 assert.equal(g.sourceStaticFacts.basicMaximum,8);
 assert.equal(g.sourceStaticFacts.overdueMaximumSeconds,3840);
 assert.equal(g.sourceStaticFacts.effectiveGrid,'DEFAULT_PLUS_MODIFIED_MINUS_REMOVED_NOT_YET_PROVEN_FOR_REAL_SAVE');
 assert.ok(g.requiredSourceClosures.includes('AUTHENTIC_SAME_BID_NATIVE_REGISTRY_AND_ENUM_WETLAND1_TO_SAVE_AREA_KEY'));
 assert.ok(g.requiredSourceClosures.includes('GRID_DEFAULT_LAYOUT_BYTES_SHA_AND_GRID_DIFF_OVERLAY'));
 assert.ok(g.requiredSourceClosures.includes('ACTUAL_SOFTWOOD_OWNER_GROUP_QUOTA_NOT_ITEMID_REVERSE_LOOKUP'));
 assert.ok(g.requiredNativeOutcomes.includes('NATIVE_CLOCK_HOST_NOW_AND_STARTUP_ACTUALIZE_BRANCH'));
 assert.ok(g.requiredNativeOutcomes.includes('LAST_OCCURRENCE_TO_RESCHEDULE_NEXT_AND_COLD_SAVE_REOPEN'));
 assert.deepEqual(g.changedFieldsAllowedIfSeparatelyAccepted,
  ['/World/RecurringEvents/155/ItemSpawning/NextOccurrence']);
 assert.deepEqual(g.changesCurrentlyAuthorized,[]);
 assert.equal(g.nativeRuntimeObserved,false);
 assert.equal(g.nativeV3Accepted,false);
 assert.equal(g.productWriterAuthorized,false);
 assert.equal(g.editedCopyAuthorized,false);
 assert.equal(g.originalOverwriteAuthorized,false);
 assert.equal(g.automaticDateRepairAuthorized,false);
 assert.equal(g.deviceV4Done,false);
 assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.gridReadPrecedence,'Grids_THEN_DiffGrids');
});
test('Arbitrary malformed, forged ledger receipt and null input cannot mint Native or product operation',()=>{
 for(const invalid of [null,undefined,[],{}, {contract:W1_V3_SOURCE_CONTRACT,
  status:'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH',sourceEventToItemMatched:false},
  {contract:'forged',status:'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH',sourceEventToItemMatched:true}
 ]) {
  const g=describeW1NativeV3Gaps(invalid);
  assert.equal(g.status,'SOURCE_UNAVAILABLE');
  assert.equal(g.productWriterAuthorized,false);
  assert.equal(g.nativeV3Accepted,false);
 }
 for(const invalid of [null,[],{}, {schema:'not-registry',source:{},events:[]},
   {schema:'wand.timing.recurring-registry@1',source:{},events:{}}]){
  assert.equal(inspectW1StaticRegistry(invalid).productWriterAuthorized,false);
 }
});
