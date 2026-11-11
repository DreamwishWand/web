// 04 QR-W independent 01D PR916 typed scalar request changed-only Node QA.
// Public synthetic scalar facts only. This test NEVER opens, edits or exports a
// Save. Rust PR914 is a pinned read-only ABI contract, NOT re-QA of Rust tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
 TIER_A_CONTRACT,TIER_A_WRITER_ENABLED,TIER_A_OPERATIONS,TIER_A_DEPENDENCIES,
 STEAM626,describeTierARequest
} from '../src/lib/ddv/core/items/tier-a-edit-requests.mjs';

const SOURCE='d10b0df838716beae0119a0982ce319f4a4f6615';
const MAIN='13751f265296d06616900e1f087aff6dce1426d1';
const CORE='4f7f18990ea470d49e1d5fe9b9aceae649072516';
const checks=[
 ['.github/workflows/01d-tier-a-scalar-requests.yml','e734b8f0a38068f3c2cc9d64e0e82566dde3cc2f'],
 ['docs/core/01d-tier-a-steam626-typed-operation-handoff-20261111.md',''],
 ['src/lib/ddv/core/items/tier-a-edit-requests.mjs','473aabc9a83ab9227cd8c8c915d4f225139d386d'],
 ['tests/ddv-core-tier-a-edit-requests.test.mjs','3e79edffd745b62f3756eb743bdbcc11b6cc0404']
];
const rustBlob='9e77d3d0243ea01fb061de7134f6aeb867ac5297';
const qaOnly=[
 '.github/workflows/04qr-w-pr916-tier-a-independent-node-20261112.yml',
 'tests/04qr-w-pr916-tier-a-independent-node-20261112.test.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const shaChar=x=>x.repeat(64);
const sample=()=>({
 target:{...STEAM626},
 source:{originalEncryptedSha256:shaChar('a')},
 session:{sessionId:'1'.repeat(32),revision:10,indexGeneration:2,decodedSha256:shaChar('b')},
 command:{operation:'Inventory.ExistingAmountDecrease',inventoryId:4,
  canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',
  expectedOldAmount:50,nextAmount:49,entryPresent:true}
});
const chest=()=>({
 operation:'Chest.ExistingSlotAmountDecrease',containerInventoryId:12,
 containerParentItemId:500000,belongsToPlayer:true,size:2,
 slotCount:2,slotIndex:0,slotItemId:30000002,expectedOldAmount:12,nextAmount:11,
 itemStateReadsetSha256:shaChar('d'),activeReferenceCount:1
});
const proposed=x=>describeTierARequest(x);
const deny=(mutate,code,setup=sample)=>{
 const input=setup();mutate(input);
 const unchanged=structuredClone(input);
 const out=proposed(input);
 assert.deepEqual(input,unchanged,'deny must not modify caller fields');
 assert.equal(out.status,'BLOCKED',JSON.stringify(out));
 assert.equal(out.code,code);
 assert.equal(out.writerAuthorized,false);
 assert.equal(out.exportAuthorized,false);
 assert.equal(out.productOperationEnabled,false);
 assert.equal(Object.isFrozen(out),true);
};
const notAuthorized=o=>{
 assert.equal(o.contract,TIER_A_CONTRACT);
 assert.equal(o.writerAuthorized,false);
 assert.equal(o.exportAuthorized,false);
 assert.equal(o.productOperationEnabled,false);
 assert.equal(o.authoritativeCoreValidationRequired,true);
 for(const k of [
  'sourceIdentityProvenByThisModule','sessionAuthorizedByThisModule',
  'canonicalItemRoutingProvenByThisModule','nativeCrossDomainRecalculationProven',
  'completeAllDomains','fullDocumentExactDiffVerified',
  'independentQaAccepted','editedCopyReopened'
 ])assert.equal(o[k],false,'do not claim '+k);
 assert.equal(o.delegatedTo,'01A_SINGLE_RUST_PRODUCTSESSION_ONLY');
 assert.equal(o.releaseFlags.Writer,false);
 assert.equal(o.releaseFlags.Apply,false);
 assert.equal(o.releaseFlags.Cloud,false);
 assert.equal(o.releaseFlags.Provider,false);
 assert.equal(o.releaseFlags.MediaPublic,false);
 assert.equal(Object.isFrozen(o),true);
 assert.equal(Object.isFrozen(o.candidate),true);
 assert.equal(Object.isFrozen(o.candidate.readSet),true);
 assert.ok(o.candidate.readSet.every(Object.isFrozen));
 assert.deepEqual(o.candidate.exactAllowedPaths,[o.candidate.fieldPath],
  'exact one preexisting Amount leaf, no other writable field');
 assert.equal(o.candidate.kind,'EXISTING_LEAF_NUMBER_ONLY');
};
test('PR916 immutable 4 ADD + exact QA-only diff, no private Sources or merged Rust dependency',()=>{
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').trim().split('\n').sort(),
  qaOnly.map(p=>'A\t'+p).sort(),'QA-only 2 ADD, no source changes');
 const original=git('diff','--name-status',MAIN,SOURCE).trim().split('\n').sort();
 assert.deepEqual(original,checks.map(([path])=>'A\t'+path).sort(),'Original Source 4 ADD only');
 for(const [path,blob] of checks){
  assert.match(git('rev-parse',SOURCE+':'+path),/^[a-f0-9]{40}$/);
  if(blob)assert.equal(git('rev-parse',SOURCE+':'+path),blob,path+' exact original source blob');
 }
 assert.equal(TIER_A_WRITER_ENABLED,false);
 const runtime=readFileSync('src/lib/ddv/core/items/tier-a-edit-requests.mjs','utf8');
 assert.doesNotMatch(runtime,/\b(?:fetch|XMLHttpRequest|WebSocket|IndexedDB|FileReader|writeFile|renameSync|appendFile|WebAssembly)\s*\(/);
 assert.equal(TIER_A_DEPENDENCIES.commonRust.includes('SINGLE_01A_PRODUCTSESSION'),true);
 console.log('QRW_PR916_SOURCE4_QA2_FIXED_SHA_WRITER_OFF_PASS');
});
test('01A PR914 fixed real Rust typed enum and Type+Field ABI correspond exactly (read-only static inspection)',()=>{
 assert.equal(git('rev-parse',CORE+':crates/ddv-save-core/src/semantic_writer.rs'),rustBlob);
 const rust=git('show',CORE+':crates/ddv-save-core/src/semantic_writer.rs');
 assert.match(rust,/pub enum TypedSemanticCommand\s*\{/);
 const typed=rust.slice(rust.indexOf('pub enum TypedSemanticCommand'),
  rust.indexOf('pub struct SemanticStageReceipt'));
 const match=(name)=>typed.match(new RegExp(name+'\\s*\\{([^}]+)\\}'))?.[1].replace(/\s+/g,'');
 const inventory=match('InventoryExistingAmountDecrease');
 const container=match('ChestExistingSlotAmountDecrease');
 assert.ok(inventory,'Rust Inventory variant exists');
 assert.ok(container,'Rust Chest variant exists');
 assert.ok(inventory.includes('inventory_id:u32,canonical_item_id:u32,'));
 assert.ok(inventory.includes('expected_compatible_item_type:String,'));
 assert.ok(inventory.includes('expected_old_amount:u32,new_amount:u32'));
 assert.ok(container.includes('container_id:u32,slot_index:usize,expected_item_id:u32,'));
 assert.ok(container.includes('expected_old_amount:u32,new_amount:u32'));
 for(const [name,kind] of [
  ['Inventory.ExistingAmountDecrease','inventory.existing.amount.decrease@1'],
  ['Chest.ExistingSlotAmountDecrease','chest.existing.slot.amount.decrease@1']
 ]){
  const d=TIER_A_OPERATIONS.find(v=>v.name===name);
  assert.equal(d?.command,kind);
  assert.equal(d.coreOwner,'01A');
  assert.equal(d.writerAuthorized,false);
  assert.ok(rust.includes('name:"'+kind+'"'));
 }
 assert.ok(rust.includes('const MAX_CONSERVATIVE_AMOUNT:u64=9999'));
 assert.ok(rust.includes('const MAX_CONTAINER_SLOTS:usize=256'));
 assert.ok(rust.includes('b.platform!=Platform::SteamWindows'));
 assert.ok(rust.includes('b.build_kind!=BuildKind::SteamFullVersion'));
 assert.ok(rust.includes('b.schema!=626'));
 assert.ok(rust.includes('b.externally_attested'));
 // Rust PR914 DEV Chest checks owner/parent/size/slot and CAS, but NOT
 // ItemState content SHA or World active refs. This is an unmet dependency,
 // not an accepted product Chest Native semantic.
 const dev=rust.slice(rust.indexOf('TypedSemanticCommand::ChestExistingSlotAmountDecrease {'),
  rust.indexOf('fn build_check('));
 for(const field of ['BelongsToPlayer','ParentItemID','Size','ItemID','Amount'])
  assert.ok(dev.includes(field),'Rust DEV checks '+field);
 assert.doesNotMatch(dev,/ItemState|expectedContentSha256|GridCollection|activeReferenceCount/,
  'never falsely claim Rust implemented 01D extra Chest read-set');
 console.log('QRW_PR916_01A_PR914_FIXED_ENUM_ABI_ONLY_PASS_CHEST_ITEMSTATE_WORLD_REF_WAIT');
});
test('Inventory positive 50 to49 yields exact read-set, single Amount path, frozen and untrusted metadata',()=>{
 const source=sample(),before=structuredClone(source);
 const o=proposed(source);
 assert.deepEqual(source,before,'pure request module must preserve all input fields');
 assert.equal(o.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
 notAuthorized(o);
 assert.equal(o.candidate.fieldPath,'/Player/ListInventories/4/Inventory/30000001/Amount');
 assert.equal(o.candidate.expectedOldAmount,50);
 assert.equal(o.candidate.nextAmount,49);
 assert.equal(o.candidate.readSet.length,4);
 assert.deepEqual(o.candidate.readSet.map(r=>r.path),[
  '/Player/ListInventories/4/ID',
  '/Player/ListInventories/4/CompatibleItemType',
  '/Player/ListInventories/4/Inventory/30000001/Amount',
  '/Player/ListInventories/4/Inventory/30000001'
 ]);
 assert.equal(o.candidate.readSet[1].expectedType,'EXACT_NATIVE_ENUM');
 assert.equal(o.candidate.readSet[1].expectedValue,'ItemType_Ingredient');
 assert.equal(o.candidate.readSet[2].expectedValue,50);
 assert.equal(o.candidate.readSet[3].expectedType,'EXISTING_ITEM_ENTRY');
 assert.deepEqual(o.candidate.nativeDevCommand,{
  variant:'InventoryExistingAmountDecrease',inventory_id:4,
  canonical_item_id:30000001,expected_compatible_item_type:'ItemType_Ingredient',
  expected_old_amount:50,new_amount:49
 });
 assert.deepEqual(o.sessionSnapshot,{...source.session});
 assert.deepEqual(o.source,{...source.source});
 assert.equal(o.sourceIdentityProvenByThisModule,false);
});
test('Conservative Rust scalar amount limits: 2 to1, 9999 to1, UINT32 IDs and unknown ItemType token still NON-authoritative',()=>{
 for(const [oldAmt,nextAmt,inventoryId,itemId] of [
  [2,1,1,1],[9999,1,4294967295,4294967295]
 ]){
  const data=sample();
  Object.assign(data.command,{inventoryId,canonicalItemId:itemId,
   expectedOldAmount:oldAmt,nextAmount:nextAmt,compatibleItemType:'ItemType_Ingredient'});
  const out=proposed(data);notAuthorized(out);
  assert.equal(out.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
  assert.equal(out.candidate.fieldPath,
   '/Player/ListInventories/'+inventoryId+'/Inventory/'+itemId+'/Amount');
 }
 const unproven=sample();
 unproven.command.compatibleItemType='ItemType_UnprovenFutureEnum';
 const x=proposed(unproven);
 assert.equal(x.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
 notAuthorized(x);
 assert.equal(x.canonicalItemRoutingProvenByThisModule,false,
  'Native enum MEMBERSHIP is not established by lexical ItemType string shape');
});
test('Inventory negative matrix rejects wrong Build, invalid session CAS source and protected enum',()=>{
 const cases=[
  [x=>x.target.platform='Switch','STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.target.buildKind='SwitchBID','STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.target.buildId='9A239D3DB569756D','STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.target.schema=624,'STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.target.gameVersion='1.25.0','STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.target.versionSource='user','STEAM626_FULLVERSION_SOURCE_REQUIRED'],
  [x=>x.source.originalEncryptedSha256='a'.repeat(63),'ORIGINAL_ENCRYPTED_SHA_REQUIRED'],
  [x=>x.source.originalEncryptedSha256='A'.repeat(64),'ORIGINAL_ENCRYPTED_SHA_REQUIRED'],
  [x=>x.source.verifiedBuild=true,'ORIGINAL_ENCRYPTED_SHA_REQUIRED'],
  [x=>x.session.sessionId='f'.repeat(31),'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.session.decodedSha256='xyz','RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.session.indexGeneration=0,'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.session.revision=-1,'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.session.revision=1.5,'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.session.claimsValidated=true,'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED'],
  [x=>x.command.inventoryId=0,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.inventoryId='4','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.canonicalItemId=4294967296,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.canonicalItemId=null,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.entryPresent=false,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.compatibleItemType='ItemType_Premium','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.compatibleItemType='ItemType_Currency','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.compatibleItemType='ItemType_Quest','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.compatibleItemType='Ingredient','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.compatibleItemType=3,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.entitlement=true,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.receipt='fake','EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.ownedSkin=true,'EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED'],
  [x=>x.command.nextAmount=0,'INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=-1,'INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=1.5,'INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.expectedOldAmount=10000,'INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=Number.MAX_SAFE_INTEGER,'INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount='49','INVENTORY_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=50,'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE'],
  [x=>x.command.nextAmount=51,'INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE'],
  [x=>x.command.operation='OwnedSkin.Select','OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND'],
  [x=>x.command.operation='Appearance.Change','OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND'],
  [x=>x.command.operation='Ownership.Change','OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND'],
  [x=>x.command.operation='Collection.SetFlag','OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND'],
  [x=>x.command.operation='Inventory.CreateSlot','OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND'],
  [x=>x.writerAuthorized=true,'REQUEST_SHAPE_INVALID']
 ];
 for(const [fn,code] of cases)deny(fn,code);
 console.log('QRW_PR916_INVENTORY_FAIL_CLOSED_40_NEGATIVE_CASES_'+cases.length);
});
test('Chest 12 to11 candidate has 9 immutable typed owner/parent/size/slot/ItemState/reference read-set and MUST WAIT',()=>{
 const data=sample();data.command=chest();
 const before=structuredClone(data),o=proposed(data);
 assert.deepEqual(data,before,'non-target input keys and nested values unchanged');
 notAuthorized(o);
 assert.equal(o.status,'WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE');
 assert.equal(o.candidate.fieldPath,'/Player/ContainerInventories/12/Inventory/0/Amount');
 assert.equal(o.candidate.readSet.length,9);
 const prefix='/Player/ContainerInventories/12';
 const fields=Object.fromEntries(o.candidate.readSet.map(r=>[r.path,r]));
 assert.equal(fields[prefix+'/ID'].expectedValue,12);
 assert.equal(fields[prefix+'/BelongsToPlayer'].expectedValue,true);
 assert.equal(fields[prefix+'/ParentItemID'].expectedValue,500000);
 assert.equal(fields[prefix+'/Size'].expectedValue,2);
 assert.deepEqual(fields[prefix+'/Inventory'],{
  path:prefix+'/Inventory',expectedType:'ARRAY',expectedLength:2
 });
 assert.equal(fields[prefix+'/Inventory/0/ItemID'].expectedValue,30000002);
 assert.equal(fields[prefix+'/Inventory/0/ItemState'].expectedContentSha256,shaChar('d'));
 assert.equal(fields[prefix+'/Inventory/0/Amount'].expectedValue,12);
 assert.equal(fields['/World/GridCollection'].required,'COMPLETE_ACTIVE_CONTAINER_REFERENCES');
 assert.equal(fields['/World/GridCollection'].expectedReferenceCount,1);
 assert.deepEqual(o.candidate.nativeDevCommand,{
  variant:'ChestExistingSlotAmountDecrease',container_id:12,slot_index:0,
  expected_item_id:30000002,expected_old_amount:12,new_amount:11
 });
 assert.equal(o.editedCopyReopened,false);
});
test('Chest boundary 256 slots is inert even with 0 external refs; no Native ownership authority inferred',()=>{
 const data=sample();data.command=chest();
 Object.assign(data.command,{size:256,slotCount:256,slotIndex:255,
  expectedOldAmount:9999,nextAmount:1,activeReferenceCount:0});
 const o=proposed(data);notAuthorized(o);
 assert.equal(o.status,'WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE');
 assert.equal(o.candidate.fieldPath,'/Player/ContainerInventories/12/Inventory/255/Amount');
 assert.equal(o.candidate.readSet[8].expectedReferenceCount,0);
 assert.equal(o.candidate.readSet[4].expectedLength,256);
});
test('Chest negative matrix rejects forged ownership parent capacity slot itemstate/references and amount',()=>{
 const init=()=>{const d=sample();d.command=chest();return d};
 const cases=[
  [x=>x.command.containerInventoryId=0,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.containerInventoryId='12','CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.containerParentItemId=0,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.containerParentItemId=4294967296,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.belongsToPlayer=false,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.size=0,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.size=257,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotCount=1,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotCount=3,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotIndex=2,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotIndex=-1,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotItemId=0,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.itemStateReadsetSha256='D'.repeat(64),'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.itemStateReadsetSha256='0'.repeat(63),'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.activeReferenceCount=2,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.activeReferenceCount=-1,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.slotCreated=true,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.owned=true,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.entitlement=true,'CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID'],
  [x=>x.command.expectedOldAmount=0,'CHEST_SLOT_AMOUNT_BOUNDS'],
  [x=>x.command.expectedOldAmount=10000,'CHEST_SLOT_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=0,'CHEST_SLOT_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount='11','CHEST_SLOT_AMOUNT_BOUNDS'],
  [x=>x.command.nextAmount=12,'CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE'],
  [x=>x.command.nextAmount=13,'CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE']
 ];
 for(const [fn,code] of cases)deny(fn,code,init);
 console.log('QRW_PR916_CHEST_FAIL_CLOSED_'+cases.length+'_CASES');
});
test('No new semantics for owned/group/variant/appearance/wardrobe/skin/premium; single Rust execution owner only',()=>{
 assert.equal(TIER_A_OPERATIONS.length,9);
 for(const operation of ['Ownership.Change','Variation.Change','Group.Change',
  'Appearance.Change','Wardrobe.Change','OwnedSkin.Select']){
  const entry=TIER_A_OPERATIONS.find(x=>x.name===operation);
  assert.equal(entry.field,null);
  assert.equal(entry.command,null);
  assert.equal(entry.shape,'UNKNOWN_STEAM626_NATIVE');
  assert.equal(entry.writerAuthorized,false);
  const input=sample();input.command.operation=operation;
  const x=proposed(input);
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.code,'OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
 }
 const collection=TIER_A_OPERATIONS.find(x=>x.name==='Collection.InspectRawGroupFlag');
 assert.ok(collection);
 assert.equal(collection.command,null);
 assert.equal(collection.semantic,'GAME_DISCOVERED_COLLECTED_OWNED_NOT_PROVEN');
 assert.equal(TIER_A_DEPENDENCIES.authorization.includes('WRITER_OFF'),true);
 assert.equal(TIER_A_DEPENDENCIES.export.includes('ORIGINAL_BACKUP_DISTINCT_EDITED_COPY'),true);
});
test('Spoofing plausible SourceSHA/Session/revision still cannot grant Writer or certify native legality',()=>{
 const forged=sample();
 forged.source.originalEncryptedSha256='f'.repeat(64);
 forged.session={sessionId:'a'.repeat(32),revision:4294967295,
  indexGeneration:4294967295,decodedSha256:'c'.repeat(64)};
 const o=proposed(forged);
 notAuthorized(o);
 assert.equal(o.sessionSnapshot.revision,4294967295);
 assert.equal(o.sessionAuthorizedByThisModule,false);
 assert.equal(o.sourceIdentityProvenByThisModule,false);
 assert.equal(o.nativeCrossDomainRecalculationProven,false);
 assert.equal(o.independentQaAccepted,false);
 console.log('QRW_PR916_EXPLICIT_BOUNDED_DESCRIPTOR_ONLY_NO_CAS_AUTHORITY_NO_V3_NO_P1G');
});
