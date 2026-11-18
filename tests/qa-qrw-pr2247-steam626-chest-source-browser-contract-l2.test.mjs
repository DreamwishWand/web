// Independent 04 QR-W fixed 01D PR2247: JS source-only proposal disclosure, not ProductSession authority.
// Fully synthetic envelopes, no actual game Save, keys, Native rights or Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  STEAM626,TIER_A_WRITER_ENABLED,TIER_A_OPERATIONS,
  describeTierARequest
} from '../src/lib/ddv/core/items/tier-a-edit-requests.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const nullSha=sha(Buffer.from('null','utf8'));
const chest=()=>({
 operation:'Chest.ExistingSlotAmountDecrease',containerInventoryId:12,containerParentItemId:40000047,
 belongsToPlayer:true,size:48,slotCount:48,slotIndex:47,slotItemId:30000002,
 expectedOldAmount:50,nextAmount:49,itemStateReadsetSha256:nullSha,activeReferenceCount:1
});
const request=(patch={})=>({
 target:{...STEAM626},source:{originalEncryptedSha256:'a'.repeat(64)},
 session:{sessionId:'b'.repeat(32),revision:2,indexGeneration:3,decodedSha256:'c'.repeat(64)},
 command:{...chest(),...patch}
});
const ask=patch=>describeTierARequest(request(patch));
function noGrant(result){
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.exportAuthorized,false);
 assert.equal(result.productOperationEnabled,false);
 assert.equal(TIER_A_WRITER_ENABLED,false);
}
function refused(patch,expectedCode){
 const x=ask(patch);
 assert.equal(x.status,'BLOCKED',JSON.stringify({patch,actual:x.code,expectedCode}));
 if(expectedCode)assert.equal(x.code,expectedCode);
 assert.equal(x.candidate,undefined);
 noGrant(x);
}
function notExecutable(x){
 assert.equal(x.status,'WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE');
 noGrant(x);
 assert.equal(x.authoritativeCoreValidationRequired,true);
 assert.equal(x.sourceIdentityProvenByThisModule,false);
 assert.equal(x.sessionAuthorizedByThisModule,false);
 assert.equal(x.canonicalItemRoutingProvenByThisModule,false);
 assert.equal(x.fullDocumentExactDiffVerified,false);
 assert.equal(x.nativeCrossDomainRecalculationProven,false);
 assert.equal(x.independentQaAccepted,false);
 assert.equal(x.editedCopyReopened,false);
 assert.deepEqual(x.releaseFlags,{Writer:false,Apply:false,Cloud:false,Provider:false,MediaPublic:false});
 assert.equal(x.delegatedTo,'01A_SINGLE_RUST_PRODUCTSESSION_ONLY');
}
test('source candidate exact linked48 50->49 is a non-executable Rust-only proposal with one leaf',()=>{
 assert.equal(nullSha,'74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b');
 for(const slotIndex of [0,23,47]){
  const x=ask({slotIndex});notExecutable(x);
  const path='/Player/ContainerInventories/12/Inventory/'+slotIndex+'/Amount';
  assert.equal(x.candidate.fieldPath,path);
  assert.deepEqual(x.candidate.exactAllowedPaths,[path]);
  assert.deepEqual(x.candidate.nativeDevCommand,{variant:'ChestExistingSlotAmountDecrease',
   container_id:12,slot_index:slotIndex,expected_item_id:30000002,
   expected_old_amount:50,new_amount:49});
  assert.equal(x.candidate.expectedOldAmount,50);
  assert.equal(x.candidate.nextAmount,49);
  assert.equal(x.candidate.readSet.length,11);
  const state=x.candidate.readSet.filter(y=>y.path.endsWith('/State'));
  assert.equal(state.length,1);
  assert.equal(state[0].expectedContentSha256,nullSha);
  assert.equal(x.candidate.readSet.find(y=>y.path.endsWith('/Inventory')).expectedLength,48);
  assert.equal(x.candidate.readSet.filter(y=>y.path.endsWith('/ExtraSize')).length,1);
  assert.equal(x.candidate.readSet.filter(y=>y.path.endsWith('/BlockMoveTo')).length,1);
  assert.equal(x.candidate.readSet.find(y=>y.path==='/World/GridCollection').expectedReferenceCount,1);
  assert.ok(Object.isFrozen(x.candidate.readSet));
  assert.ok(x.candidate.readSet.every(Object.isFrozen));
 }
});
test('historical 2-slot 12->11 source candidate and spoofed capacity always fail CLOSED',()=>{
 for(const size of [0,1,2,47,49,50,256,'48',null]){
  refused({size,slotCount:48},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
  refused({size:48,slotCount:size},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 }
 refused({size:2,slotCount:2,expectedOldAmount:12,nextAmount:11},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 refused({slotIndex:48},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 refused({slotIndex:-1},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 refused({slotIndex:1.5},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 for(const id of [0,1,-1,'12',null])refused({containerInventoryId:id},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
});
test('real Rust target profile old 50->49 only, cannot silently widen to 2->1, 99->98 or 50->48',()=>{
 refused({expectedOldAmount:2,nextAmount:1},'CHEST_STEAM626_LINKED_CROP_PROFILE_NOT_ESTABLISHED');
 refused({expectedOldAmount:49,nextAmount:48},'CHEST_STEAM626_LINKED_CROP_PROFILE_NOT_ESTABLISHED');
 refused({expectedOldAmount:50,nextAmount:48},'CHEST_EXACT_ONE_UNIT_DECREASE_REQUIRED');
 refused({expectedOldAmount:50,nextAmount:50},'CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE');
 refused({expectedOldAmount:50,nextAmount:51},'CHEST_PACKAGED_STACK_BOUND_UNSUPPORTED');
 refused({expectedOldAmount:99,nextAmount:98},'CHEST_PACKAGED_STACK_BOUND_UNSUPPORTED');
 refused({nextAmount:0},'CHEST_SLOT_AMOUNT_BOUNDS');
 refused({nextAmount:-1},'CHEST_SLOT_AMOUNT_BOUNDS');
 refused({expectedOldAmount:0},'CHEST_SLOT_AMOUNT_BOUNDS');
 refused({expectedOldAmount:50,nextAmount:49,slotItemId:31700001},'CHEST_STEAM626_LINKED_CROP_PROFILE_NOT_ESTABLISHED');
});
test('literal null State SHA only; candidate cannot treat absent/empty/forged state as genuine',()=>{
 for(const state of [sha(Buffer.from('{}')),sha(Buffer.from('null ')),'d'.repeat(64),'0'.repeat(64)]){
  refused({itemStateReadsetSha256:state},'CHEST_STEAM626_LINKED_CROP_PROFILE_NOT_ESTABLISHED');
 }
 for(const state of [undefined,null,'NULL','A'.repeat(64),0]){
  refused({itemStateReadsetSha256:state},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 }
});
test('untrusted parent ownership, active reference count and cost/entitlement fields cannot authorize candidate',()=>{
 for(const patch of [
  {belongsToPlayer:false},{belongsToPlayer:1},{containerParentItemId:30000001},
  {containerParentItemId:0},{activeReferenceCount:2},{activeReferenceCount:4294967296},
  {activeReferenceCount:-1},{activeReferenceCount:'1'}]){
  refused(patch,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
 }
 const zero=ask({activeReferenceCount:0});
 notExecutable(zero);
 assert.equal(zero.candidate.readSet.find(y=>y.path==='/World/GridCollection').expectedReferenceCount,0);
 // 0 is a caller-proposed negative reference claim, not verification: Core re-reads the actual map.
 const evil=request();evil.command.DLC='unlock';const result=describeTierARequest(evil);
 assert.equal(result.status,'BLOCKED');noGrant(result);
});
test('strict selected build/session/source constraints and unsupported edits stay blocked',()=>{
 for(const patch of [
  {target:{...STEAM626,buildId:'EXPANSION_NEW_BUILD'}},
  {target:{...STEAM626,platform:'Switch'}},
  {target:{...STEAM626,schema:624}},
  {source:{originalEncryptedSha256:'A'.repeat(64)}},
  {session:{sessionId:'b'.repeat(32),revision:2,indexGeneration:0,decodedSha256:'c'.repeat(64)}}
 ]){
  const bad={...request(),...patch};
  const x=describeTierARequest(bad);assert.equal(x.status,'BLOCKED');noGrant(x);
 }
 for(const operation of ['Ownership.Change','Collection.SetFlag','Receipt.Unlock','Chest.CreateSlot','Appearance.Change']){
  const x=ask({operation});assert.equal(x.status,'BLOCKED');noGrant(x);
 }
});
test('mutating original JS caller after source proposal cannot alter source receipt or mint any rights',()=>{
 const req=request(),x=describeTierARequest(req);notExecutable(x);
 req.command.nextAmount=999;req.command.size=1;req.command.itemStateReadsetSha256='f'.repeat(64);
 req.session.revision=900;req.source.originalEncryptedSha256='d'.repeat(64);
 assert.equal(x.candidate.nextAmount,49);
 assert.equal(x.candidate.readSet.find(y=>y.path.endsWith('/State')).expectedContentSha256,nullSha);
 assert.equal(x.sessionSnapshot.revision,2);
 assert.equal(x.source.originalEncryptedSha256,'a'.repeat(64));
 noGrant(x);
 assert(TIER_A_OPERATIONS.every(z=>z.writerAuthorized===false));
});
