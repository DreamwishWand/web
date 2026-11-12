import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER_A_CONTRACT,TIER_A_WRITER_ENABLED,STEAM626,
  TIER_A_OPERATIONS,TIER_A_DEPENDENCIES,describeTierARequest
} from '../src/lib/ddv/core/items/tier-a-edit-requests.mjs';

const hash=letter=>letter.repeat(64);
const base=()=>({
  target:{...STEAM626},
  source:{originalEncryptedSha256:hash('a')},
  session:{sessionId:'b'.repeat(32),revision:3,indexGeneration:7,decodedSha256:hash('c')},
  command:{
    operation:'Inventory.ExistingAmountDecrease',
    inventoryId:4,canonicalItemId:30000001,
    compatibleItemType:'ItemType_ActivityItem',
    expectedOldAmount:50,nextAmount:49,entryPresent:true
  }
});
const plan=(f=()=>{})=>{const v=base();f(v);return describeTierARequest(v);};
const blocked=(mutator,code)=>{
  const v=plan(mutator);
  assert.equal(v.status,'BLOCKED',JSON.stringify(v));
  assert.equal(v.code,code);
  assert.equal(v.writerAuthorized,false);
  assert.equal(v.exportAuthorized,false);
};
const chestCommand=()=>({
  operation:'Chest.ExistingSlotAmountDecrease',containerInventoryId:12,
  containerParentItemId:40000047,belongsToPlayer:true,size:2,
  slotCount:2,slotIndex:0,slotItemId:30000002,
  expectedOldAmount:12,nextAmount:11,itemStateReadsetSha256:hash('d'),
  activeReferenceCount:1
});

test('R08 operation matrix classifies all requested Tier A domains without authorizing any writer or inferring fields',()=>{
  assert.equal(TIER_A_WRITER_ENABLED,false);
  assert.equal(TIER_A_OPERATIONS.length,9);
  assert.equal(TIER_A_OPERATIONS[0].name,'Inventory.ExistingAmountDecrease');
  assert.equal(TIER_A_OPERATIONS[1].name,'Chest.ExistingSlotAmountDecrease');
  assert.equal(TIER_A_OPERATIONS[2].name,'Collection.InspectRawGroupFlag');
  for(const name of ['Ownership.Change','Variation.Change','Group.Change',
      'Appearance.Change','Wardrobe.Change','OwnedSkin.Select']){
    const row=TIER_A_OPERATIONS.find(x=>x.name===name);
    assert.equal(row.field,null);
    assert.equal(row.command,null);
    assert.equal(row.shape,['Appearance.Change','Wardrobe.Change','OwnedSkin.Select'].includes(name)?'STEAM626_NATIVE_SCHEMA_ONLY':'UNKNOWN_STEAM626_NATIVE');
    if(row.shape==='STEAM626_NATIVE_SCHEMA_ONLY'){
      assert.ok(row.nativeFieldPaths.length>0);
      assert.ok(Object.isFrozen(row.nativeFieldPaths));
    }
    assert.equal(row.writerAuthorized,false);
  }
  assert.equal(TIER_A_DEPENDENCIES.incompatible.includes('STEAM626'),true);
  assert.ok(TIER_A_OPERATIONS.every(x=>x.writerAuthorized===false));
});
test('Inventory 50→49 is only a strictly scoped scalar candidate, not past actual game proof',()=>{
  const x=plan();
  assert.equal(x.contract,TIER_A_CONTRACT);
  assert.equal(x.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
  assert.equal(x.candidate.fieldPath,'/Player/ListInventories/4/Inventory/30000001/Amount');
  assert.deepEqual(x.candidate.exactAllowedPaths,[x.candidate.fieldPath]);
  assert.equal(x.candidate.expectedOldAmount,50);
  assert.equal(x.candidate.nextAmount,49);
  assert.equal(x.candidate.readSet[0].expectedValue,4);
  assert.equal(x.candidate.readSet[1].expectedValue,'ItemType_ActivityItem');
  assert.deepEqual(x.candidate.nativeDevCommand,{variant:'InventoryExistingAmountDecrease',
    inventory_id:4,canonical_item_id:30000001,
    expected_compatible_item_type:'ItemType_ActivityItem',expected_old_amount:50,new_amount:49});
  assert.equal(x.sessionSnapshot.revision,3);
  assert.equal(x.sessionSnapshot.indexGeneration,7);
  assert.equal(x.authoritativeCoreValidationRequired,true);
  assert.equal(x.sourceIdentityProvenByThisModule,false);
  assert.equal(x.sessionAuthorizedByThisModule,false);
  assert.equal(x.fullDocumentExactDiffVerified,false);
  assert.equal(x.independentQaAccepted,false);
  assert.equal(x.writerAuthorized,false);
  assert.equal(x.exportAuthorized,false);
  assert.equal(x.releaseFlags.MediaPublic,false);
  assert.equal(Object.isFrozen(x.candidate.readSet),true);
  assert.equal(Object.isFrozen(x.candidate.readSet[0]),true);
  assert.equal(Object.isFrozen(x.target),true);
});
test('No amount increment, no noop, no negative, no float, no unsafe/overflow stock',()=>{
  blocked(x=>{x.command.nextAmount=51},'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE');
  blocked(x=>{x.command.nextAmount=50},'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE');
  blocked(x=>{x.command.nextAmount=-1},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.nextAmount=1.5},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.expectedOldAmount=-1},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.expectedOldAmount=2147483648},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.nextAmount=Number.MAX_SAFE_INTEGER},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.expectedOldAmount=1;x.command.nextAmount=0},'INVENTORY_AMOUNT_BOUNDS');
  blocked(x=>{x.command.expectedOldAmount=10000;x.command.nextAmount=9999},'INVENTORY_AMOUNT_BOUNDS');
  const low=plan(x=>{x.command.expectedOldAmount=2;x.command.nextAmount=1});
  assert.equal(low.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
});
test('Unknown ItemID, alias type, missing entry or unverified route fail closed',()=>{
  blocked(x=>{x.command.canonicalItemId=0},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.canonicalItemId=-1},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.canonicalItemId=4294967296},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.canonicalItemId='40000047'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.inventoryId='00'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.inventoryId=0},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.compatibleItemType='ItemType_Premium'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.inventoryId=Number.MAX_SAFE_INTEGER},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.compatibleItemType='untrusted'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.compatibleItemType=1.5},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.entryPresent=false},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{delete x.command.entryPresent},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
});
test('Caller-injected media, ownership, skin or premium flags cannot enter request',()=>{
  blocked(x=>{x.premium=true},'REQUEST_SHAPE_INVALID');
  blocked(x=>{x.command.entitlement=true},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.receipt='approved'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.dlc=true},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.variation='any'},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.owned=true},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  blocked(x=>{x.command.operation='OwnedSkin.Select'},'OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
  blocked(x=>{x.command.operation='Collection.SetFlag'},'OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
  blocked(x=>{x.command.operation='Item.CreateInventoryEntry'},'OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
  blocked(x=>{x.command.operation='Inventory.DeleteEntry'},'OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
});
test('Only the pinned external Steam v1.25.3 FullVersion/schema626 shape is even a candidate',()=>{
  blocked(x=>{x.target.platform='Switch'},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.buildKind='SwitchBid'},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.buildId='9A239D3DB569756D'},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.schema=624},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.gameVersion='1.24.13'},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.buildId+='-unverified'},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
  blocked(x=>{x.target.isVerified=true},'STEAM626_FULLVERSION_SOURCE_REQUIRED');
});
test('Source SHA, single Rust session receipt, revision and index-generation are mandatory',()=>{
  blocked(x=>{x.source.originalEncryptedSha256='A'.repeat(64)},'ORIGINAL_ENCRYPTED_SHA_REQUIRED');
  blocked(x=>{x.source.originalEncryptedSha256=hash('x')},'ORIGINAL_ENCRYPTED_SHA_REQUIRED');
  blocked(x=>{x.source.originalEncryptedSha256=null},'ORIGINAL_ENCRYPTED_SHA_REQUIRED');
  blocked(x=>{x.session.sessionId='0'},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
  blocked(x=>{x.session.revision=-1},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
  blocked(x=>{x.session.revision=1.2},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
  blocked(x=>{x.session.indexGeneration=0},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
  blocked(x=>{x.session.decodedSha256='deadbeef'},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
  blocked(x=>{x.session.writeAuthorized=true},'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED');
});
test('Synthetic existing Chest slot maps only one Amount leaf, retaining ItemState SHA and container identity',()=>{
  const x=plan(r=>{r.command=chestCommand()});
  assert.equal(x.status,'WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE');
  assert.equal(x.candidate.fieldPath,'/Player/ContainerInventories/12/Inventory/0/Amount');
  assert.equal(x.candidate.readSet.find(z=>z.path.endsWith('/State')).expectedContentSha256,hash('d'));
  assert.equal(x.candidate.readSet.find(z=>z.path.endsWith('/BelongsToPlayer')).expectedValue,true);
  assert.deepEqual(x.candidate.nativeDevCommand,{variant:'ChestExistingSlotAmountDecrease',
    container_id:12,slot_index:0,expected_item_id:30000002,
    expected_old_amount:12,new_amount:11});
  assert.deepEqual(x.candidate.exactAllowedPaths,[x.candidate.fieldPath]);
  assert.equal(x.writerAuthorized,false);
  assert.equal(x.nativeCrossDomainRecalculationProven,false);
});
test('Existing Chest refusal covers foreign, duplicate, invalid slot, overflow, missing provenance and creation',()=>{
  const ch=(f)=>blocked(x=>{x.command=chestCommand();f(x.command)},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
  ch(c=>{c.belongsToPlayer=false});
  ch(c=>{c.containerParentItemId=0});
  ch(c=>{c.size=0});
  ch(c=>{c.slotCount=49});
  ch(c=>{c.slotIndex=2});
  ch(c=>{c.slotItemId=0});
  ch(c=>{c.itemStateReadsetSha256=null});
  ch(c=>{c.activeReferenceCount=2});
  ch(c=>{delete c.slotCount});
  ch(c=>{c.containerInventoryId='116'});
  ch(c=>{c.inventoryCreation=true});
});
test('Existing Chest only decrement and fixed numeric bounds; cannot transfer items or mutate ownership',()=>{
  blocked(x=>{x.command=chestCommand();x.command.nextAmount=13},'CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE');
  blocked(x=>{x.command=chestCommand();x.command.nextAmount=12},'CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE');
  blocked(x=>{x.command=chestCommand();x.command.nextAmount=-1},'CHEST_SLOT_AMOUNT_BOUNDS');
  blocked(x=>{x.command=chestCommand();x.command.nextAmount=0},'CHEST_SLOT_AMOUNT_BOUNDS');
  blocked(x=>{x.command=chestCommand();x.command.expectedOldAmount=2147483648},'CHEST_SLOT_AMOUNT_BOUNDS');
  blocked(x=>{x.command=chestCommand();x.command.ItemID=40000047},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
});
test('Mutating caller input after proposal never rewrites immutable candidate; no Session authority leaks',()=>{
  const input=base(),original=structuredClone(input);
  const x=describeTierARequest(input);
  input.command.nextAmount=1;input.source.originalEncryptedSha256=hash('e');
  assert.equal(x.candidate.nextAmount,49);
  assert.equal(x.source.originalEncryptedSha256,hash('a'));
  assert.equal(x.writerAuthorized,false);
  assert.equal(x.productOperationEnabled,false);
  assert.deepEqual(original.command.expectedOldAmount,50);
});

test('Steam626 Native enum membership and signed ItemID prefix reject previous false-positive token and mismatches',()=>{
  for(const token of ['ItemType_Ingredient','ItemType_Unknown','ItemType_Currency','ItemType_Skin','ActivityItemType_Ingredient','ItemType_None','ItemType_Furniture']) {
    blocked(x=>{x.command.compatibleItemType=token},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  }
  for(const id of [1,300000000,2147483648,40000047,90000001]) {
    blocked(x=>{x.command.canonicalItemId=id},'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  }
  const furniture=plan(x=>{x.command.canonicalItemId=40000047;x.command.compatibleItemType='ItemType_Furniture'});
  assert.equal(furniture.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
  assert.equal(furniture.writerAuthorized,false);
});
test('Chest uses signed native item identities and the State field, never ItemState alias',()=>{
  const ch=f=>blocked(x=>{x.command=chestCommand();f(x.command)},'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
  ch(c=>{c.slotItemId=2147483648});
  ch(c=>{c.containerParentItemId=500000});
  ch(c=>{c.containerParentItemId=30000001});
  for(const id of [80000001,170000001,50000001,40000001])ch(c=>{c.slotItemId=id});
  const p=plan(x=>{x.command=chestCommand()});
  assert.ok(p.candidate.readSet.some(x=>x.path.endsWith('/State')));
  assert.ok(!p.candidate.readSet.some(x=>x.path.endsWith('/ItemState')));
  assert.ok(p.candidate.readSet.some(x=>x.path.endsWith('/ExtraSize')));
  assert.ok(p.candidate.readSet.some(x=>x.path.endsWith('/BlockMoveTo')));
  assert.equal(p.writerAuthorized,false);
});
