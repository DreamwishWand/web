// 04 QR W-QR-041: new-only main PR405 01D raw Item semantic composite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEM_PERSONAL_OVERLAY_ENABLED,ITEM_WRITER_ENABLED,ITEM_OPERATION_MATRIX,
 inspectCollectionSaveFlag,inspectInventoryAmount,previewInventoryAmountCAS}
 from '../src/lib/ddv/core/items/item-semantics-contract.mjs';
const identity={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
 buildId:'52BD625D9B4E0053',profileSchema:624};
const profile=()=>({GameInfo:{Version:624},Player:{CollectionSets:[{
 CollectionDefinitionID:2120000121,GroupData:[{GroupIndex:0,GroupsCollectionItems:{'40000047':false,'40000048':true}}]}],
 ListInventories:{'0':{CompatibleItemType:3,Inventory:{
 '40000047':{Amount:0,OtherField:{untouched:true}},'40000048':{Amount:7}}}}},Opaque:{x:22}});
const c=(p,i=40000047)=>inspectCollectionSaveFlag({profile:p,identity,definitionId:2120000121,itemId:i,groupIndex:0});
const s=(p,i=40000047)=>inspectInventoryAmount({profile:p,identity,inventoryId:0,canonicalItemId:i,compatibleItemType:3});
test('04QR main-composed Item false/true/ABSENT and 0/7/ABSENT distinct, never infer ownership',()=>{
 const p=profile(),before=JSON.stringify(p);
 assert.deepEqual([c(p).rawFlag,c(p,40000048).rawFlag,c(p,40000049).rawFlag],
 ['SAVE_BOOL_FALSE','SAVE_BOOL_TRUE','ABSENT_ITEM_ENTRY']);
 assert.deepEqual([s(p).rawAmount,s(p,40000048).rawAmount,s(p,40000049).rawAmount],[0,7,null]);
 for(const view of [c(p),c(p,40000048),s(p),s(p,40000048)]) {
  assert.equal(view.owned,'UNKNOWN');assert.equal(view.discovered,'UNKNOWN');
  assert.equal(view.denominator,null);assert.equal(view.personalCollectionDisplayAuthorized,false);
  assert.equal(view.writerAuthorized,false);
 }
 assert.equal(JSON.stringify(p),before,'source opaque records must remain unchanged');
 console.log('QR_405_MAIN_ITEM_RAW_FALSE_TRUE_ABSENT_ZERO_UNKNOWN_NO_MUTATION_PASS');
});
test('04QR reject revision-independent cross-build fields and forged identity, no item Writer',()=>{
 const p=profile();
 for(const wrong of [
  {...identity,sourcePlatform:'xbox'}, {...identity,profileSchema:626},
  {...identity,buildId:'9A239D3DB569756D'}, {...identity,gameVersion:'1.25.3'}
 ]) {
  assert.equal(inspectCollectionSaveFlag({profile:p,identity:wrong,definitionId:2120000121,itemId:40000047}).status,'BLOCKED');
 }
 assert.equal(inspectCollectionSaveFlag({profile:{...p,GameInfo:{Version:626}},identity,definitionId:2120000121,itemId:40000047}).status,'BLOCKED');
 assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
 assert.equal(ITEM_WRITER_ENABLED,false);
 assert.ok(ITEM_OPERATION_MATRIX.every(e=>e.write==='OFF'&&!e.productWriterEnabled&&!e.nativeV3Accepted));
 const attempt=previewInventoryAmountCAS({inspection:s(p),expectedOldAmount:0,nextAmount:10});
 assert.equal(attempt.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
 assert.equal(attempt.writerAuthorized,false);assert.equal(attempt.exportAuthorized,false);
 assert.equal(attempt.sourceRevisionVerified,false);assert.equal(attempt.independentEditedCopyReopenAccepted,false);
 assert.equal(previewInventoryAmountCAS({inspection:s(p),expectedOldAmount:7,nextAmount:10}).status,'BLOCKED');
 console.log('QR_405_MAIN_ITEM_VERSION_BID_SCHEMA_REVISION_CAS_WRITER_FAILCLOSED_PASS');
});
