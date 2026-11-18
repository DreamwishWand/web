// Independent 04 QR-W: PR2261 frozen Source-only Inventory Catalog0 candidate boundary.
// Synthetic caller facts, not an authenticated Save. Rust ProductSession remains sole authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEAM626, TIER_A_WRITER_ENABLED, TIER_A_CONTRACT, TIER_A_OPERATIONS,
  describeTierARequest
} from '../src/lib/ddv/core/items/tier-a-edit-requests.mjs';
const cmd=()=>({
  operation:'Inventory.ExistingAmountDecrease',
  inventoryId:0,canonicalItemId:40000048,compatibleItemType:'ItemType_Furniture',
  expectedOldAmount:50,nextAmount:49,entryPresent:true
});
const call=(patch={},envelope={})=>describeTierARequest({
  target:{...STEAM626},source:{originalEncryptedSha256:'a'.repeat(64)},
  session:{sessionId:'b'.repeat(32),revision:7,indexGeneration:5,decodedSha256:'c'.repeat(64)},
  command:{...cmd(),...patch},...envelope
});
function noAuthority(v){
 assert.equal(v.writerAuthorized,false);
 assert.equal(v.productOperationEnabled,false);
 assert.equal(v.exportAuthorized,false);
 assert.equal(TIER_A_WRITER_ENABLED,false);
 if(v.candidate){
  assert.equal(v.authoritativeCoreValidationRequired,true);
  assert.equal(v.sourceIdentityProvenByThisModule,false);
  assert.equal(v.sessionAuthorizedByThisModule,false);
  assert.equal(v.canonicalItemRoutingProvenByThisModule,false);
  assert.equal(v.fullDocumentExactDiffVerified,false);
  assert.equal(v.editedCopyReopened,false);
  assert.equal(v.independentQaAccepted,false);
  assert.deepEqual(v.releaseFlags,{Writer:false,Apply:false,Cloud:false,Provider:false,MediaPublic:false});
  assert.equal(v.delegatedTo,'01A_SINGLE_RUST_PRODUCTSESSION_ONLY');
 }
}
function blocked(patch,code){
 const v=call(patch);
 assert.equal(v.status,'BLOCKED',JSON.stringify({patch,got:v.status,code:v.code}));
 assert.equal(v.code,code);
 assert.equal(v.candidate,undefined);
 noAuthority(v);
}
function sourceOnly(v,old,next,id=40000048){
 assert.equal(v.contract,TIER_A_CONTRACT);
 assert.equal(v.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
 noAuthority(v);
 const path='/Player/ListInventories/0/Inventory/'+id+'/Amount';
 assert.equal(v.candidate.fieldPath,path);
 assert.equal(v.candidate.kind,'EXISTING_LEAF_NUMBER_ONLY');
 assert.equal(v.candidate.expectedOldAmount,old);
 assert.equal(v.candidate.nextAmount,next);
 assert.deepEqual(v.candidate.exactAllowedPaths,[path]);
 assert.deepEqual(v.candidate.nativeDevCommand,{
  variant:'InventoryExistingAmountDecrease',
  inventory_id:0,canonical_item_id:id,
  expected_compatible_item_type:'ItemType_Furniture',
  expected_old_amount:old,new_amount:next
 });
 assert.deepEqual(v.candidate.readSet,[
  {path:'/Player/ListInventories/0/ID',expectedType:'UINT32',expectedValue:0},
  {path:'/Player/ListInventories/0/CompatibleItemType',expectedType:'EXACT_NATIVE_ENUM',expectedValue:'ItemType_Furniture'},
  {path,expectedType:'SIGNED_NONNEGATIVE_INTEGER',expectedValue:old},
  {path:'/Player/ListInventories/0/Inventory/'+id,expectedType:'EXISTING_ITEM_ENTRY'}
 ]);
 assert.ok(Object.isFrozen(v.candidate));
 assert.ok(Object.isFrozen(v.candidate.readSet));
 assert.ok(v.candidate.readSet.every(Object.isFrozen));
}
test('actual imported fixed candidate only proposes Catalog0 Furniture old minus exactly one, untrusted Rust revalidation',()=>{
 for(const [old,next] of [[50,49],[3,2],[2,1],[9999,9998]]){
  const v=call({expectedOldAmount:old,nextAmount:next});
  sourceOnly(v,old,next);
 }
 assert(TIER_A_OPERATIONS.some(x=>x.name==='Inventory.ExistingAmountDecrease'&&x.writerAuthorized===false));
});
test('rust-unsupported Inventory ID 1/4, legacy ActivityItem and forged route always DENIED independent of scalar amount',()=>{
 for(const inventoryId of [1,4,5,100,4294967295]){
  blocked({inventoryId},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked({inventoryId,expectedOldAmount:2,nextAmount:1},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked({inventoryId,canonicalItemId:30000001,compatibleItemType:'ItemType_ActivityItem'},
   'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
 }
 for(const patch of [
  {compatibleItemType:'ItemType_ActivityItem',canonicalItemId:30000001},
  {compatibleItemType:'ItemType_Unknown'},
  {compatibleItemType:'ItemType_ActivityItem'},
  {canonicalItemId:30000001},
  {compatibleItemType:'ItemType_Ingredient',canonicalItemId:30000001},
  {inventoryId:-1},{inventoryId:'0'},{inventoryId:null},{inventoryId:0.5},
  {inventoryId:4294967296},{entryPresent:false},{entryPresent:1}
 ]) blocked(patch,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
});
test('cannot use a valid Catalog0 Furniture target to decrease more than Rust old−1, increment or empty stack',()=>{
 for(const [old,next,code] of [
  [50,48,'INVENTORY_CATALOG0_EXACT_ONE_UNIT_DECREASE_REQUIRED'],
  [50,1,'INVENTORY_CATALOG0_EXACT_ONE_UNIT_DECREASE_REQUIRED'],
  [50,50,'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE'],
  [50,51,'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE'],
  [1,0,'INVENTORY_AMOUNT_BOUNDS'],
  [2,0,'INVENTORY_AMOUNT_BOUNDS'],
  [0,-1,'INVENTORY_AMOUNT_BOUNDS'],
  [10000,9999,'INVENTORY_AMOUNT_BOUNDS'],
  [3,2.5,'INVENTORY_AMOUNT_BOUNDS']
 ])blocked({expectedOldAmount:old,nextAmount:next},code);
});
test('source-only valid Furniture lexical ID may be proposed, but NOT proof of Rust canonical membership or rights',()=>{
 for(const itemId of [40000048,40000047]){
  const v=call({canonicalItemId:itemId});
  sourceOnly(v,50,49,itemId);
  assert.equal(v.canonicalItemRoutingProvenByThisModule,false);
  assert.equal(v.sourceIdentityProvenByThisModule,false);
  assert.equal(v.productOperationEnabled,false);
 }
});
test('untrusted envelope, session, Source digest and expansion Build cannot grant existing-only proposed action',()=>{
 const cases=[
  {target:{...STEAM626,schema:643}},
  {target:{...STEAM626,platform:'Switch'}},
  {target:{...STEAM626,buildId:'new-expansion-unknown'}},
  {target:{...STEAM626,gameVersion:'1.26'}},
  {source:{originalEncryptedSha256:'A'.repeat(64)}},
  {session:{sessionId:'b'.repeat(32),revision:7,indexGeneration:0,decodedSha256:'c'.repeat(64)}}
 ];
 for(const e of cases){
  const x=call({},e);
  assert.equal(x.status,'BLOCKED');
  noAuthority(x);
 }
});
test('untrusted input cannot introduce DLC rights or arbitrary writer scope into inventory request',()=>{
 for(const patch of [
  {ownership:true},{DLC:'unlock'},{receipt:'valid'},{premium:true},
  {target:{...STEAM626}},{itemStateReadsetSha256:'a'.repeat(64)}
 ]){
  const v=call(patch);
  assert.equal(v.status,'BLOCKED');assert.equal(v.code,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  noAuthority(v);
 }
 for(const operation of ['Ownership.Change','Inventory.Add','Chest.ExistingSlotAmountDecrease','Receipt.Unlock','Collection.SetFlag']){
  // Wrong operation on Inventory payload may be denied at either operation dispatch or shape.
  const v=call({operation});
  assert.equal(v.status,'BLOCKED');
  noAuthority(v);
 }
});
test('candidate immutable snapshot never changes after caller mutates request or replay revision',()=>{
 const input={
  target:{...STEAM626},source:{originalEncryptedSha256:'a'.repeat(64)},
  session:{sessionId:'b'.repeat(32),revision:7,indexGeneration:5,decodedSha256:'c'.repeat(64)},
  command:cmd()
 };
 const x=describeTierARequest(input);
 sourceOnly(x,50,49);
 input.command.inventoryId=4;input.command.nextAmount=9999;input.command.compatibleItemType='ItemType_ActivityItem';
 input.session.revision=999;input.source.originalEncryptedSha256='e'.repeat(64);
 assert.equal(x.candidate.nextAmount,49);
 assert.equal(x.sessionSnapshot.revision,7);
 assert.equal(x.source.originalEncryptedSha256,'a'.repeat(64));
 assert.ok(Object.isFrozen(x.sessionSnapshot));
 assert.ok(Object.isFrozen(x.candidate.nativeDevCommand));
 noAuthority(x);
});
