import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {describeNativeOperation as describe,previewNativeInventoryAmount as preview,inspectNativeStaticTraceDraft as trace,NATIVE_SOURCE_TARGETS as targets} from '../src/lib/ddv/native/operation-native-static-gate.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const main='7d95accf9098cc54cc2fb698e95d3034e152102b';
const file='src/lib/ddv/core/items/steam626-native-fields.mjs';
assert.equal(git('rev-parse',main+':'+file).trim(),'9b6306faa7420ab83001c65d02b6e1c5390b1e0f');
const fields=await import('data:text/javascript;base64,'+Buffer.from(git('show',main+':'+file)).toString('base64'));
const steam=targets.steam1253,sw=targets.switch1253,sha='66644cf655e158086f83ffd654222ecfb5744c08423a644d3c0edc3244d66e4c';
const A='ItemType_ActivityItem',F='ItemType_Furniture';
function input(id=31100001,type=A,inventoryId=12,oldAmount=50,nextAmount=49){
 return {declaredBuild:steam,inventoryId,canonicalItemId:id,compatibleItemType:type,existingRow:true,oldAmount,nextAmount,sourceHash:'a'.repeat(64),changedPaths:['/Player/ListInventories/'+inventoryId+'/Inventory/'+id+'/Amount']};
}
const pass=x=>{assert.equal(x.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');for(const k of ['originalShaValidatedByCore','externalBuildIsAuthentication','fullReferenceClosureVerified','nativeV3Accepted','independentRealEditedCopyVerified','productWriterAuthorized','productEditedCopyAuthorized','operationEnabled'])assert.equal(x[k],false,k);};
const deny=x=>{assert.equal(x.status,'REJECTED');assert.equal(x.productWriterAuthorized,false);};
test('QAC943 exact repaired amount prefix and actual accepted 01D source parity',()=>{
 assert.equal(fields.STEAM626_NATIVE_ITEM_TYPES[A],3);assert.equal(fields.STEAM626_NATIVE_ITEM_TYPES[F],4);
 assert.equal(fields.STEAM626_ACTIVITY_SUBTYPES.ActivityItemType_Ingredient,11);
 for(const id of [0,1,29999999,30000000,31100001,39999999,40000000,49999999,50000000,110000000,2147483647,2147483648,-1,31100001.5,'31100001',NaN]){
  for(const token of [A,F,'ItemType_Ingredient','ActivityItemType_Ingredient','ItemType_Tool','ItemType_None',3,4,11,'itemtype_activityitem',null]){
   const got=preview(input(id,token));const expected=fields.isSteam626ExistingListAmountType(token,id);
   if(expected)pass(got);else deny(got);
  }
 }
});
test('QAC943 DEV amount and inventory bounds, exact leaf and untrusted caller',()=>{
 for(const id of [1,4294967295])pass(preview(input(31100001,A,id,9999,1)));
 for(const id of [0,-1,4294967296,12.5,'12',null])deny(preview(input(31100001,A,id)));
 for(const [a,b] of [[10000,1],[2,2],[2,3],[1,0],[0,1],[3,-1],[3,1.5],['3',1],[50,NaN]])deny(preview(input(31100001,A,12,a,b)));
 const base=input();for(const p of [[],[base.changedPaths[0],'/Player/Entitlements/1'],['/Player/ListInventories/012/Inventory/31100001/Amount'],['/Player/ListInventories/12/Inventory/031100001/Amount'],['/Player/ListInventories/12/Inventory/31100001/Marker']])deny(preview({...base,changedPaths:p}));
 deny(preview({...base,existingRow:false}));deny(preview({...base,sourceHash:'x'.repeat(64)}));
 pass(preview({...base,writerAuthorized:true,nativeV3Accepted:true,fullReferenceClosureVerified:true}));
});
test('QAC943 exact Steam witness only, deeply frozen, all authority false',()=>{
 for(const op of ['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE']){
  const d=describe(op,{...steam,writerAuthorized:true,nativeV3Accepted:true});const w=d.archivedSteam626NativeWitness;
  assert.equal(w.operationId,op);assert.equal(w.binarySha256,sha);assert.equal(w.kind,'ARCHIVED_STEAM626_NATIVE_STATIC_PARTIAL');
  for(const k of ['fullReferenceClosureVerified','nativeV3Accepted','nativeEventReplayAuthorized','productWriterAuthorized'])assert.equal(w[k],false);
  for(const k of ['nativeConsumerVerified','nativeProducerVerified','nativeRecomputeVerified','nativeV3Accepted','coreIssuedReadsetVerified','externalBuildIsAuthentication','operationEnabled','productWriterAuthorized'])assert.equal(d[k],false);
  for(const v of [d,d.target,w,w.consumer,w.producer,w.derived,w.requiredBeforeOperationV3])assert.ok(Object.isFrozen(v));
  assert.throws(()=>w.derived.push('FAKE'),TypeError);
  assert.equal(describe(op,sw).archivedSteam626NativeWitness,undefined);
  for(const b of [{...steam,buildId:sw.buildId},{...steam,platform:sw.platform},{...steam,buildKind:sw.buildKind},{...steam,schema:624},{...steam,gameVersion:'1.25.0'}])deny(describe(op,b));
 }
 assert.equal(describe('TIME_EVENT',steam).archivedSteam626NativeWitness,undefined);
});
test('QAC943 archive facts preserve separate producer, consumer, derived dependency boundaries',()=>{
 const w=id=>describe(id,steam).archivedSteam626NativeWitness;
 const inv=w('INV_AMOUNT'),ch=w('CHEST_AMOUNT'),g=w('GRID_MOVE');
 assert.ok(inv.consumer.includes('VARIATION_CAN_CHANGE_ITEM_AND_AMOUNT'));
 assert.ok(inv.producer.includes('LOW_LEVEL_ZERO_RETAINS_ROW_NOT_PRODUCT_AUTHORIZATION'));
 assert.ok(inv.derived.includes('CONSUME_ITEM_REASON_GATED_NOT_EQUIVALENT_TO_OFFLINE_DECREMENT'));
 assert.ok(inv.requiredBeforeOperationV3.includes('ACTIVE_MISSION_FILTER_AND_OTHER_SUBSCRIBER_CLOSURE'));
 assert.ok(ch.producer.includes('ZERO_RESETS_ITEM_AMOUNT_STATE_434C250_NOT_PRODUCT_AUTHORIZATION'));
 assert.ok(ch.derived.includes('POSITIVE_REMAINDER_UPDATES_RUNTIME_CACHE_NOT_NEW_SAVE_FIELD'));
 assert.ok(ch.requiredBeforeOperationV3.includes('AUTHENTIC_PLAYER_CHEST_PARENT_ACTIVE_REFERENCE_AND_SLOT'));
 assert.ok(g.producer.includes('DEFAULT_ONLY_OBJECT_REQUIRES_CLONE_AND_MODIFIED_MAP_INSERT'));
 assert.ok(g.derived.includes('MISSION_GRID_CHANGED_CAN_CHANGE_STATUS_AFTER_DECOR_CHECK'));
 assert.ok(g.requiredBeforeOperationV3.includes('ACTIVE_DECOR_MISSION_AND_OTHER_SUBSCRIBER_CLOSURE'));
});
test('QAC943 actual archived hash in caller trace is not an authenticated proof',()=>{
 const t={operationId:'INV_AMOUNT',declaredBuild:steam,nativeBinarySha256:sha,producerCalls:[{symbol:'ListInventory.RemoveItem',binarySha256:sha}],consumerCalls:[{symbol:'ListInventory.GetItemAmount',binarySha256:sha}],saveReadPointers:[input().changedPaths[0]],saveWritePointers:[input().changedPaths[0]],derivedWritePointers:[],claim:{fullReferenceClosureVerified:true,nativeV3Accepted:true,writerAuthorized:true}};
 const x=trace(t);assert.equal(x.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');
 for(const k of ['declaredBuildIsAuthentic','nativeBinaryAuthenticated','noDerivedWritesProven','sourceDigestValidated','nativeV3Accepted','fullReferenceClosureVerified','productWriterAuthorized','operationEnabled'])assert.equal(x[k],false);
 deny(trace({...t,derivedWritePointers:['/Player/Entitlements/1']}));
});
test('QAC943 new archive binding must never pair Steam witness with Switch target under mutable declared Build',()=>{
 // Return Switch for the first two matches, then Steam during the new witness lookup.
 // The target displayed on the same receipt must never disagree with archive provenance.
 for(const op of ['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE']){
  let n=0;const b={get platform(){return ++n<=2?sw.platform:steam.platform;},
   get buildKind(){return n<=2?sw.buildKind:steam.buildKind;},get buildId(){return n<=2?sw.buildId:steam.buildId;},
   gameVersion:'1.25.3',schema:626};
  const d=describe(op,b);
  if(d.status!=='REJECTED'&&d.archivedSteam626NativeWitness)assert.equal(d.target.platform,'steam-windows','Steam archive bound to Switch target');
 }
});
test('QAC943 new archive binding must not attach to a Build that changes between checks',()=>{
 let n=0;const b={get platform(){return ++n<=2?sw.platform:'invalid';},buildKind:sw.buildKind,buildId:sw.buildId,gameVersion:'1.25.3',schema:626};
 const d=describe('INV_AMOUNT',b);
 if(d.status!=='REJECTED'){assert.equal(d.target.platform,'switch');assert.equal(d.archivedSteam626NativeWitness,undefined);}
});
