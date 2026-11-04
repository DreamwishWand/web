// 05 QR independently scoped PR379 raw item semantics: synthetic source ONLY.
// No Native V3, real P1G, claimed personal Owned, edit or product Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectCollectionSaveFlag,inspectInventoryAmount,previewInventoryAmountCAS,
 ITEM_OPERATION_MATRIX,ITEM_PERSONAL_OVERLAY_ENABLED,ITEM_WRITER_ENABLED,
 ITEM_SOURCE_TARGETS,ITEM_TYPED_WRITE_CANDIDATES,ITEM_TYPED_READ_COMMANDS
} from '../src/lib/ddv/core/items/item-semantics-contract.mjs';
const mk=(schema=624)=>({
 GameInfo:{Version:schema,DoNotInferBID:'9A239D3DB569756D'},
 Player:{
  CollectionSets:[{CollectionDefinitionID:2120000121,GroupData:[
   {GroupIndex:0,GroupsCollectionItems:{'40700050':true,'40700051':false}}
  ]}],
  ListInventories:{'0':{CompatibleItemType:4,Inventory:{
   '40700050':{Amount:0,UnknownExtra:'do not modify'},
   '40700051':{Amount:19,UnknownExtra:'future'}
  }}}
 },
 World:{Unknown:{doNotTouch:['x','y']}},OpaqueUnknown:'KEEP EXACT'
});
const a={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
 buildId:'52BD625D9B4E0053',profileSchema:624};
const b={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.3',
 buildId:'9A239D3DB569756D',profileSchema:626};
const col=(profile=mk(),identity=a,itemId=40700050,definitionId=2120000121,groupIndex=0)=>
 inspectCollectionSaveFlag({profile,identity,definitionId,groupIndex,itemId});
const inv=(profile=mk(),identity=a,canonicalItemId=40700050,inventoryId=0,compatibleItemType=4)=>
 inspectInventoryAmount({profile,identity,canonicalItemId,inventoryId,compatibleItemType});
function unknown(x){
 assert.equal(x.owned,'UNKNOWN');
 assert.equal(x.discovered,'UNKNOWN');
 assert.equal(x.missing,'UNKNOWN');
 assert.equal(x.denominator,null);
 assert.equal(x.numerator,null);
 assert.equal(x.writerAuthorized,false);
}
test('bool true false absent item group definition differ, never personal Owned/denominator',()=>{
 const t=col(),f=col(mk(),a,40700051),abs=col(mk(),a,40700052);
 const missingGroup=col(mk(),a,40700050,2120000121,1);
 const missingDefinition=col(mk(),a,40700050,2120000999);
 assert.deepEqual([t.rawFlag,f.rawFlag,abs.rawFlag,missingGroup.rawFlag,missingDefinition.rawFlag],
  ['SAVE_BOOL_TRUE','SAVE_BOOL_FALSE','ABSENT_ITEM_ENTRY','ABSENT_GROUP','ABSENT_DEFINITION']);
 for(const x of [t,f,abs,missingGroup,missingDefinition]){
  assert.equal(x.status,'RAW_SAVE_STRUCTURE_ONLY');
  unknown(x);
  assert.equal(x.personalCollectionDisplayAuthorized,false);
  assert.equal(x.nativeGroupComplete,false);
 }
 assert.equal(t.saveObserved,true);assert.equal(f.saveObserved,true);
 assert.equal(abs.saveObserved,false);
 assert.equal(false!==null,true);
});
test('inventory Amount0/positive/ABSENT inventory and item never infer owned',()=>{
 const p=mk(),before=JSON.stringify(p);
 const zero=inv(p),positive=inv(p,a,40700051),absItem=inv(p,a,40700052);
 const absInventory=inv(p,a,40700050,99);
 assert.deepEqual([zero.rawAmount,positive.rawAmount,absItem.rawAmount,absInventory.rawAmount],
  [0,19,null,null]);
 assert.deepEqual([zero.rawEntry,positive.rawEntry,absItem.rawEntry,absInventory.rawEntry],
  ['PRESENT','PRESENT','ABSENT_ITEM_ENTRY','ABSENT_INVENTORY']);
 for(const x of [zero,positive,absItem,absInventory]){
  assert.equal(x.status,'RAW_SAVE_STRUCTURE_ONLY');unknown(x);
  assert.equal(x.nativeItemDatabaseObserved,false);
  assert.equal(x.canonicalVariationProven,false);
 }
 assert.equal(JSON.stringify(p),before,'read must preserve all unknown bytes/values');
});
test('full Version/BID/schema/Platform exact matching, old Catalog never gets current personal authorizations',()=>{
 for(const [ident,p] of [[a,mk(624)],[b,mk(626)]]){
  const x=col(p,ident);
  assert.equal(x.status,'RAW_SAVE_STRUCTURE_ONLY');
  unknown(x);
  assert.equal(x.target.buildId,ident.buildId);
  assert.equal(x.sourceIdentityAttestedByInspector,false);
  assert.equal(x.personalCollectionDisplayAuthorized,false);
  const q=inv(p,ident);
  assert.equal(q.status,'RAW_SAVE_STRUCTURE_ONLY');
  unknown(q);
 }
 for(const id of [{...a,gameVersion:'1.25.3'}, {...a,buildId:b.buildId},
   {...a,profileSchema:626},{...a,platform:'steam-windows'},
   {...a,sourcePlatform:'windows'}, {...a,gameVersion:'1.25.2'},
   {...b,profileSchema:624},{...b,buildId:a.buildId},undefined]){
  assert.equal(col(mk(),id).code,'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
 }
 assert.equal(col(mk(626),a).code,'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
 assert.equal(col(mk(624),b).code,'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
 assert.equal(ITEM_SOURCE_TARGETS.switch1250.profileSchema,624);
 assert.equal(ITEM_SOURCE_TARGETS.switch1253.profileSchema,626);
});
test('malformed duplicate Collection/Group/Boolean and missing list fail closed',()=>{
 let p=mk();p.Player.CollectionSets.push(structuredClone(p.Player.CollectionSets[0]));
 assert.equal(col(p).code,'COLLECTION_DUPLICATE_DEFINITION');
 p=mk();p.Player.CollectionSets[0].GroupData[0].GroupIndex=3;
 assert.equal(col(p).code,'COLLECTION_GROUP_INDEX_CONFLICT');
 p=mk();p.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems['40700050']='true';
 assert.equal(col(p).code,'COLLECTION_BOOLEAN_FIELD_INVALID');
 p=mk();p.Player.CollectionSets=null;
 assert.equal(col(p).code,'COLLECTION_SETS_MISSING_OR_UNBOUNDED');
 p=mk();p.Player.CollectionSets[0].CollectionDefinitionID='2120000121';
 assert.equal(col(p).code,'COLLECTION_DEFINITION_ROW_INVALID');
 assert.equal(col(mk(),a,0).status,'BLOCKED');
});
test('Inventory amount rejects string/negative/fraction/overflow/bad compatible variation route',()=>{
 for(const amount of ['0',-1,1.25,Number.MAX_SAFE_INTEGER+1,null]){
  const p=mk();p.Player.ListInventories['0'].Inventory['40700050'].Amount=amount;
  assert.equal(inv(p).code,'INVENTORY_AMOUNT_FIELD_INVALID');
 }
 assert.equal(inv(mk(),a,40700050,0,5).code,'INVENTORY_COMPATIBLE_ITEM_TYPE_MISMATCH');
 assert.equal(inv(mk(),a,0).code,'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
 assert.equal(inv(mk(),a,40700050,-1).code,'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
 assert.equal(inv(mk(),a,40700050,0,undefined).code,'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
 const p=mk();p.Player.ListInventories=null;
 assert.equal(inv(p).code,'LIST_INVENTORIES_MISSING');
});
test('inert CAS Preview: matches raw Amount but never attests same Session/revision/full diff or changes source',()=>{
 const p=mk(),bytes=JSON.stringify(p),old=inv(p);
 const success=previewInventoryAmountCAS({inspection:old,expectedOldAmount:0,nextAmount:2147483647});
 assert.equal(success.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
 assert.equal(success.expectedOldAmount,0);
 assert.equal(success.nextAmount,2147483647);
 for(const field of ['sourceRevisionVerified','fullDocumentDiffVerified',
  'sourceIdentityAttested','nativeV3Accepted','crossDomainReferencesVerified',
  'independentEditedCopyReopenAccepted','writerAuthorized','exportAuthorized'])
  assert.equal(success[field],false,field);
 assert.equal(success.noOriginalOverwrite,true);
 const rejects=[
  {inspection:old,expectedOldAmount:1,nextAmount:2},
  {inspection:old,expectedOldAmount:0,nextAmount:0},
  {inspection:old,expectedOldAmount:0,nextAmount:2147483648},
  {inspection:old,expectedOldAmount:0,nextAmount:-1},
  {inspection:inv(p,a,40700052),expectedOldAmount:0,nextAmount:1},
  {inspection:{...old,status:'OWNER_ASSERTION'},expectedOldAmount:0,nextAmount:1}
 ];
 for(const q of rejects)assert.equal(previewInventoryAmountCAS(q).status,'BLOCKED');
 assert.equal(JSON.stringify(p),bytes);
});
test('all 10 operation families explicitly OFF; Source 293 records is not a personal numerator',()=>{
 assert.equal(ITEM_OPERATION_MATRIX.length,10);
 assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
 assert.equal(ITEM_WRITER_ENABLED,false);
 for(const x of ITEM_OPERATION_MATRIX){
  assert.equal(x.write,'OFF');
  assert.equal(x.productWriterEnabled,false);
  assert.equal(x.publicReleaseEnabled,false);
  assert.equal(x.nativeV3Accepted,false);
  assert.equal(x.independentEditedCopyReopenAccepted,false);
 }
 assert.equal(ITEM_SOURCE_TARGETS.switch1253.collectionMembership,'NATIVE_RUNTIME_UNKNOWN');
 assert.match(ITEM_SOURCE_TARGETS.switch1253.collectionDefinitionSource,/293_ORIGINAL/);
 assert.equal(ITEM_OPERATION_MATRIX.find(x=>x.operation==='quest-progression').read,'EXCLUDED');
 assert.equal(ITEM_OPERATION_MATRIX.find(x=>x.operation==='premium-entitlement').read,'EXCLUDED');
 assert.ok(ITEM_TYPED_READ_COMMANDS.every(x=>x.authority!=='PRODUCT_WRITER'));
 assert.ok(ITEM_TYPED_WRITE_CANDIDATES.every(x=>x.commitAuthorized===false));
});
