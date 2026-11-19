// 04 QR-W independent changed-only L2. Switch626 Native raw Inventory
// tuple (source build, ItemID prefix, exact item-type token, own record ID)
// stays structural-only and cannot mint Writer/ownership/public display.
// No actual Save/keys, all profiles generated solely in this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectInventoryAmount,previewInventoryAmountCAS,
 ITEM_WRITER_ENABLED,ITEM_PERSONAL_OVERLAY_ENABLED
} from '../src/lib/ddv/core/items/item-semantics-contract.mjs';
import {steam626ItemTypeOf} from '../src/lib/ddv/core/items/steam626-native-fields.mjs';
const b626=Object.freeze({platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.3',
 buildId:'9A239D3DB569756D',profileSchema:626});
const b624=Object.freeze({platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
 buildId:'52BD625D9B4E0053',profileSchema:624});
const item=40700050;
const make=({version=626,id=0,storedId=0,type='ItemType_Furniture',canonical=item,amount=0}={})=>({
 GameInfo:{Version:version},
 Player:{ListInventories:{[String(id)]:{ID:storedId,CompatibleItemType:type,
  Inventory:{[String(canonical)]:{Amount:amount,UnfamiliarFutureBlob:{untouched:true}}}}}},
 HiddenOtherDomain:{unaltered:true}
});
const inspect=(profile,identity=b626,vars={})=>inspectInventoryAmount({
 profile,identity,inventoryId:0,canonicalItemId:item,compatibleItemType:'ItemType_Furniture',...vars
});
const safe=r=>{assert.equal(r.writerAuthorized,false);assert.equal(r.owned,'UNKNOWN');
 assert.equal(r.discovered,'UNKNOWN');assert.equal(r.missing,'UNKNOWN')};

test('all known same-schema type-prefix buckets stay strictly RAW, no native membership or entitlement escalation',()=>{
 for(const [id,type] of [
  [40700050,'ItemType_Furniture'],[30700050,'ItemType_ActivityItem'],
  [50700050,'ItemType_Clothing'],[60700050,'ItemType_Environment']]){
  assert.equal(steam626ItemTypeOf(id),type);
  const profile=make({type,canonical:id,amount:0}),original=structuredClone(profile);
  const r=inspect(profile,b626,{canonicalItemId:id,compatibleItemType:type});
  assert.equal(r.status,'RAW_SAVE_STRUCTURE_ONLY');
  assert.equal(r.rawAmount,0);assert.equal(r.rawEntry,'PRESENT');
  assert.equal(r.sourceIdentityAttestedByInspector,false);
  assert.equal(r.nativeItemDatabaseObserved,false);
  assert.equal(r.nativeGroupComplete,false);
  assert.equal(r.canonicalVariationProven,false);
  assert.equal(r.personalCollectionDisplayAuthorized,false);
  safe(r);assert.deepEqual(profile,original);
  assert.equal(ITEM_WRITER_ENABLED,false);assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
 }
});
test('the entire tuple must be exact: native type case, ItemID prefix, external build/schema, and target inventory',()=>{
 const profile=make(),cases=[
  [{compatibleItemType:4},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{compatibleItemType:'itemType_Furniture'},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{compatibleItemType:'ItemType_ActivityItem'},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{compatibleItemType:'ItemType_Furniture '},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{canonicalItemId:30700050},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{canonicalItemId:0},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{canonicalItemId:2147483648},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{canonicalItemId:Number.MAX_SAFE_INTEGER},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{inventoryId:-1},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{inventoryId:'0'},'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED'],
  [{inventoryId:1},null],
  [{identity:{...b626,buildId:'52BD625D9B4E0053'}},'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED'],
  [{identity:{...b626,profileSchema:624}},'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED'],
  [{identity:{...b626,sourcePlatform:'steam-windows'}},'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED'],
  [{identity:b624},'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED']
 ];
 for(const [args,code] of cases){
  const r=inspect(profile,b626,args);
  safe(r);
  if(code===null){assert.equal(r.rawEntry,'ABSENT_INVENTORY');assert.equal(r.rawAmount,null)}
  else{assert.equal(r.status,'BLOCKED',JSON.stringify(args));assert.equal(r.code,code)}
 }
});
test('Switch626 requires own numeric exact map-record ID; never execute own/inherited ID accessors',()=>{
 const failures=[
  [null,'INVENTORY_MAP_KEY_ID_CONFLICT'],[undefined,'INVENTORY_MAP_KEY_ID_CONFLICT'],
  ['0','INVENTORY_MAP_KEY_ID_CONFLICT'],[1,'INVENTORY_MAP_KEY_ID_CONFLICT'],
  [-0,'VALID'],[NaN,'INVENTORY_MAP_KEY_ID_CONFLICT'],
  [2147483648,'INVENTORY_MAP_KEY_ID_CONFLICT'],
  [{valueOf(){throw Error('coercion not allowed')}},'INVENTORY_MAP_KEY_ID_CONFLICT']
 ];
 for(const [id,expected] of failures){
  const profile=make({storedId:id});
  const r=inspect(profile);
  if(expected==='VALID'){assert.equal(r.rawEntry,'PRESENT');safe(r)}
  else{assert.equal(r.code,expected);safe(r)}
 }
 for(const variant of ['own-getter','inherited-getter','missing-own']){
  const p=make(),inv=p.Player.ListInventories['0'];let reads=0;
  if(variant==='own-getter'){
   delete inv.ID;
   Object.defineProperty(inv,'ID',{get(){reads++;throw Error('untrusted ID read')},configurable:true});
  }else{
   delete inv.ID;
   if(variant==='inherited-getter')
    Object.setPrototypeOf(inv,Object.defineProperty({},'ID',{get(){reads++;throw Error('inherited ID read')}}));
  }
  const r=inspect(p);
  assert.equal(r.code,variant==='own-getter'?'INVENTORY_MAP_KEY_ID_CONFLICT':'INVENTORY_MAP_KEY_ID_UNVERIFIED');
  assert.equal(reads,0);safe(r);
 }
});
test('624 legacy numeric-compatible raw-only behavior remains separate; own conflicting ID still rejected',()=>{
 const p=make({version:624,type:4,storedId:0});
 const r=inspect(p,b624,{compatibleItemType:4});
 assert.equal(r.rawEntry,'PRESENT');safe(r);
 assert.equal(inspect(p,b624,{compatibleItemType:'ItemType_Furniture'}).code,
  'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
 assert.equal(inspect(p,b626).code,'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
 delete p.Player.ListInventories['0'].ID;
 assert.equal(inspect(p,b624,{compatibleItemType:4}).rawAmount,0);
 p.Player.ListInventories['0'].ID=7;
 assert.equal(inspect(p,b624,{compatibleItemType:4}).code,'INVENTORY_MAP_KEY_ID_CONFLICT');
});
test('phantom inherited Inventory rows cannot supply an item or record; own typed Amount must be finite unsigned',()=>{
 const p=make();
 const map=p.Player.ListInventories;
 const row=map['0'];delete map['0'];
 let accessed=0;
 Object.setPrototypeOf(map,Object.defineProperty({},'0',{get(){accessed++;throw Error('inherited phantom')}}));
 const r=inspect(p);
 assert.equal(r.rawEntry,'ABSENT_INVENTORY');assert.equal(r.rawAmount,null);safe(r);
 assert.equal(accessed,0);
 Object.defineProperty(map,'0',{value:row,configurable:true,enumerable:true,writable:true});
 const stock=row.Inventory[String(item)];
 for(const bad of ['0',-1,NaN,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
  stock.Amount=bad;
  const denied=inspect(p);
  assert.equal(denied.code,'INVENTORY_AMOUNT_FIELD_INVALID');safe(denied);
 }
 let amountAccessed=0;
 delete stock.Amount;
 Object.defineProperty(stock,'Amount',{get(){amountAccessed++;throw Error('untrusted Amount getter')}});
 assert.equal(inspect(p).code,'INVENTORY_AMOUNT_FIELD_INVALID');
 assert.equal(amountAccessed,0);
});
test('even valid tuple and zero amount cannot authorize mutation, ownership, edited export or public display',()=>{
 const p=make(),receipt=inspect(p);
 assert.equal(receipt.status,'RAW_SAVE_STRUCTURE_ONLY');
 assert.equal(receipt.saveObserved,true);
 safe(receipt);
 const preview=previewInventoryAmountCAS({inspection:receipt,expectedOldAmount:0,nextAmount:1});
 assert.equal(preview.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
 assert.equal(preview.sourceRevisionVerified,false);
 assert.equal(preview.crossDomainReferencesVerified,false);
 assert.equal(preview.independentEditedCopyReopenAccepted,false);
 assert.equal(preview.fullDocumentDiffVerified,false);
 assert.equal(preview.writerAuthorized,false);
 assert.equal(preview.exportAuthorized,false);
 assert.equal(preview.noOriginalOverwrite,true);
 assert.equal(p.Player.ListInventories['0'].Inventory[String(item)].Amount,0);
});
