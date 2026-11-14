// PUBLIC SYNTHETIC, PRIVATE native V2 existing executable only.
// No real owner Save, key, encrypted P1G or private path in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const bin=process.env.WAND_TEST_SEMANTIC_RUST;
if(!bin){
 console.log('DEV_SEMANTIC_RUST_BINARY_ABSENT_GENERIC_NODE_NOT_RUN');
 process.exit(0);
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const original='{"GameInfo":{"Version":626},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_Ingredient","Inventory":{"30000001":{"Amount":50,"Marker":"ItemMarker_None","Unknown":{"future":true,"ratio":1.00}}}}},"ContainerInventories":{"12":{"ID":12,"BelongsToPlayer":true,"ParentItemID":500000,"Size":1,"Inventory":[{"ItemID":30000002,"Amount":12,"Keep":"opaque"}]}}},"World":{},"Other":{"OriginalUnknown":true}}';
const env=()=>({
 ...process.env,
 WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:STEAM,
 WAND_LOCAL_ORIGINAL_SHA256:sha('public-synthetic-placeholder-encrypted-p1g'),
 WAND_LOCAL_ORIGINAL_SIZE_BYTES:'128',
 WAND_LOCAL_DECODED_SHA256:sha(original),
 WAND_LOCAL_INVENTORY_ID:'4',
 WAND_LOCAL_CANONICAL_ITEM_ID:'30000001',
 WAND_LOCAL_COMPATIBLE_ITEM_TYPE:'ItemType_Ingredient',
 WAND_LOCAL_EXPECTED_OLD_AMOUNT:'50',
 WAND_LOCAL_NEW_AMOUNT:'49',
 WAND_LOCAL_CONTAINER_ID:'12',
 WAND_LOCAL_SLOT_INDEX:'0',
 WAND_LOCAL_SLOT_ITEM_ID:'30000002',
 WAND_LOCAL_CHEST_EXPECTED_OLD_AMOUNT:'12',
 WAND_LOCAL_CHEST_NEW_AMOUNT:'11'
});
function invoke(flag,alter={},input=original){
 const p=spawnSync(bin,[flag],{env:{...env(),...alter},input,encoding:'utf8',maxBuffer:8*1024*1024});
 return {status:p.status,stdout:p.stdout??'',stderr:p.stderr??''};
}
function passed(v){
 assert.equal(v.status,0,v.stderr.slice(0,200));
 assert.match(v.stderr,/PRIVATE_V2_RUST_REAL_AMOUNT_SEMANTIC_CHANGE_CAS_ATOMIC_UNDO_REDO_ONE_TIME_PIPE_PASS/);
 assert.doesNotMatch(v.stderr,/30000001|releases_1.25|ItemType_Ingredient|OriginalUnknown|future|ratio/);
}
test('Tier A 50→49 changes exactly one real Amount token; no whole JSON serialization',()=>{
 const p=invoke('--semantic-inventory-existing-decrease-only');
 passed(p);
 assert.equal(p.stdout,original.replace('"Amount":50','"Amount":49'));
 assert.equal(p.stdout.length,original.length);
 assert.match(p.stdout,/"ratio":1\.00/);
 assert.equal(sha(p.stdout)!==sha(original),true);
});
test('same Rust ProductSession Chest existing slot amount 12→11',()=>{
 const p=invoke('--semantic-chest-existing-decrease-only');
 passed(p);
 assert.equal(p.stdout,original.replace('"Amount":12','"Amount":11'));
 assert.match(p.stdout,/"Keep":"opaque"/);
});
test('atomic cross-domain Inventory+Chest exact typed batch',()=>{
 const p=invoke('--semantic-inventory-and-chest-decrease-only');
 passed(p);
 assert.equal(p.stdout,original.replace('"Amount":50','"Amount":49').replace('"Amount":12','"Amount":11'));
 assert.equal(p.stdout.length,original.length);
});
test('wrong Source SHA/Build/old Amount/IDs/rights/amount bounds reject without leaked JSON',()=>{
 for(const patch of [
  {WAND_LOCAL_DECODED_SHA256:'0'.repeat(64)},
  {WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'Switch9A239D3DB569756D'},
  {WAND_LOCAL_EXPECTED_OLD_AMOUNT:'49'},
  {WAND_LOCAL_NEW_AMOUNT:'51'},
  {WAND_LOCAL_NEW_AMOUNT:'0'},
  {WAND_LOCAL_CANONICAL_ITEM_ID:'0'},
  {WAND_LOCAL_INVENTORY_ID:'999'},
  {WAND_LOCAL_COMPATIBLE_ITEM_TYPE:'ItemType_Premium'},
  {WAND_LOCAL_COMPATIBLE_ITEM_TYPE:'ItemType_Quest'},
  {WAND_LOCAL_ORIGINAL_SIZE_BYTES:'0'}
 ]){
  const p=invoke('--semantic-inventory-existing-decrease-only',patch);
  assert.notEqual(p.status,0);
  assert.equal(p.stdout,'');
  assert.doesNotMatch(p.stderr,/OriginalUnknown|30000001|future|ItemType_Ingredient|ratio/);
 }
});
test('No other operation or source version/schema accepted',()=>{
 const wrong=invoke('--semantic-appearance-edit-only');
 assert.notEqual(wrong.status,0); assert.equal(wrong.stdout,'');
 const schema=invoke('--semantic-inventory-existing-decrease-only',{},original.replace('"Version":626','"Version":624'));
 assert.notEqual(schema.status,0);assert.equal(schema.stdout,'');
 const protectedSlot=invoke('--semantic-chest-existing-decrease-only',{WAND_LOCAL_SLOT_ITEM_ID:'33333333'});
 assert.notEqual(protectedSlot.status,0);assert.equal(protectedSlot.stdout,'');
});
console.log('DEV_RUST_SINGLE_PRODUCTSESSION_TRUE_TYPED_INVENTORY_CHEST_SEMANTIC_CHANGE_PUBLIC_SYNTHETIC_TESTS_REGISTERED');

test('Policy73 backup uses existing native executor and Core-owned actual amount, not mutation env',()=>{
 const source=original.replace('ItemType_Ingredient','ItemType_ActivityItem');
 const patch={WAND_LOCAL_DECODED_SHA256:sha(source),
  WAND_LOCAL_EXPECTED_OLD_AMOUNT:'999',WAND_LOCAL_NEW_AMOUNT:'0',
  WAND_LOCAL_COMPATIBLE_ITEM_TYPE:'ItemType_Premium'};
 const p=invoke('--inventory-amount-backup-only',patch,source);
 assert.equal(p.status,0,p.stderr.slice(0,200));
 assert.match(p.stderr,/PRIVATE_V2_INVENTORY_AMOUNT_BACKUP_READONLY_PIPE_PASS/);
 assert.doesNotMatch(p.stderr,/30000001|releases_1.25|OriginalUnknown|future|ratio/);
 const v=JSON.parse(p.stdout);
 assert.equal(v.type,'inventory.existing-amount');
 assert.deepEqual(v.target,{inventoryId:4,itemId:30000001});
 assert.equal(v.payload.amount,50);
 assert.equal(v.payload.itemType,'ItemType_ActivityItem');
 assert.equal(v.payload.entrySha256,sha('{"Amount":50,"Marker":"ItemMarker_None","Unknown":{"future":true,"ratio":1.00}}'));
 assert.equal(v.provenance.decodedSha256,sha(source));
 const {sha256,...body}=v;
 assert.equal(sha256,sha(JSON.stringify(body)));
 assert.equal(p.stdout,JSON.stringify(v));
 assert.doesNotMatch(p.stdout,/OriginalUnknown|future|ratio|writerAuthorized/);
 const again=invoke('--inventory-amount-backup-only',patch,source);
 assert.equal(again.status,0);
 assert.equal(again.stdout,p.stdout);
});
test('Policy73 native backup refuses invalid scope without stdout or private values',()=>{
 const source=original.replace('ItemType_Ingredient','ItemType_ActivityItem');
 const base={WAND_LOCAL_DECODED_SHA256:sha(source)};
 for(const patch of [
  {WAND_LOCAL_DECODED_SHA256:'0'.repeat(64)},
  {WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'Switch9A239D3DB569756D'},
  {WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)},
  {WAND_LOCAL_ORIGINAL_SIZE_BYTES:'0'},
  {WAND_LOCAL_INVENTORY_ID:'0'},
  {WAND_LOCAL_INVENTORY_ID:'04'},
  {WAND_LOCAL_CANONICAL_ITEM_ID:'30000099'},
  {WAND_LOCAL_CANONICAL_ITEM_ID:'80000001'}
 ]){
  const p=invoke('--inventory-amount-backup-only',{...base,...patch},source);
  assert.notEqual(p.status,0);assert.equal(p.stdout,'');
  assert.doesNotMatch(p.stderr,/30000001|OriginalUnknown|future|ratio/);
 }
 for(const doc of [source.replace('"Version":626','"Version":624'),
   source.replace('"Amount":50','"Amount":1'),
   original]){
  const p=invoke('--inventory-amount-backup-only',{WAND_LOCAL_DECODED_SHA256:sha(doc)},doc);
  assert.notEqual(p.status,0);assert.equal(p.stdout,'');
 }
});
