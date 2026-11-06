// 05 QR-C NEW_ONLY independent Q08 repair receipt for PR679 fixed 18c14b1f.
// Synthetic only; no user private Save/keys/actual native Item semantics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCollectionSaveFlag, inspectInventoryAmount, ITEM_WRITER_ENABLED} from
  '../src/lib/ddv/core/items/item-semantics-contract.mjs';

const identities = [
  {platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624},
  {platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.3',buildId:'9A239D3DB569756D',profileSchema:626}
];
function synthetic(schema) {
  return {GameInfo:{Version:schema}, Player:{
    CollectionSets:[{CollectionDefinitionID:2120000121,GroupData:[
      {GroupIndex:0,GroupsCollectionItems:{'40700050':false,'40700051':true}}
    ]}],
    ListInventories:{'0':{CompatibleItemType:4,Inventory:{
      '40700050':{Amount:0,OpaqueUnknown:{keep:'unaltered'}},
      '40700051':{Amount:8}
    }}}
  },OpaqueUnknown:{snapshot:[null,false,0]}};
}
const group = (p,identity,i=0,item=40700050) => inspectCollectionSaveFlag({
  profile:p,identity,definitionId:2120000121,groupIndex:i,itemId:item
});
const inventory=(p,identity,id=0,item=40700050)=>inspectInventoryAmount({
  profile:p,identity,inventoryId:id,canonicalItemId:item,compatibleItemType:4
});

test('Q08-R1 inherited getter-phantom group cannot counterfeit raw positive or be invoked (624/626)',()=>{
  for(const identity of identities){
    const p=synthetic(identity.profileSchema);
    const arr=new Array(1), proto=Object.create(Array.prototype);
    let calls=0;
    Object.defineProperty(proto,'0',{configurable:true,get(){
      calls++;
      return {GroupIndex:0,GroupsCollectionItems:{'40700050':true}};
    }});
    Object.setPrototypeOf(arr,proto);
    p.Player.CollectionSets[0].GroupData=arr;
    assert.equal(Object.hasOwn(arr,0),false);
    const result=group(p,identity);
    assert.equal(result.status,'RAW_SAVE_STRUCTURE_ONLY');
    assert.equal(result.rawFlag,'ABSENT_GROUP');
    assert.equal(result.saveObserved,false);
    assert.equal(result.owned,'UNKNOWN');
    assert.equal(result.discovered,'UNKNOWN');
    assert.equal(result.denominator,null);
    assert.equal(result.writerAuthorized,false);
    assert.equal(calls,0,'no untrusted inherited getter should be evaluated');
    assert.equal(Object.hasOwn(arr,0),false);
    assert.equal(p.Player.CollectionSets[0].GroupData,arr);
  }
});

test('Q08-R2 missing own hole with inherited plain positive stays absent, not true',()=>{
  for(const identity of identities){
    const p=synthetic(identity.profileSchema);
    const arr=new Array(1);
    const proto=Object.create(Array.prototype);
    Object.defineProperty(proto,'0',{value:{GroupIndex:0,GroupsCollectionItems:{'40700050':true}},configurable:true});
    Object.setPrototypeOf(arr,proto);
    p.Player.CollectionSets[0].GroupData=arr;
    const result=group(p,identity);
    assert.equal(result.rawFlag,'ABSENT_GROUP');
    assert.equal(result.writerAuthorized,false);
  }
});

test('Q08-R3 own explicit malformed undefined/null/0/false/array is BLOCKED, distinct from absence',()=>{
  for(const identity of identities){
    for(const value of [undefined,null,0,false,[],{}]){
      const p=synthetic(identity.profileSchema);
      p.Player.CollectionSets[0].GroupData[0]=value;
      assert.equal(Object.hasOwn(p.Player.CollectionSets[0].GroupData,0),true);
      const before=structuredClone(p);
      const r=group(p,identity);
      assert.equal(r.status,'BLOCKED');
      assert.equal(r.code,'COLLECTION_GROUP_RECORD_OR_ITEMS_MALFORMED');
      assert.equal(r.discovered,'UNKNOWN');
      assert.equal(r.denominator,null);
      assert.equal(r.writerAuthorized,false);
      assert.deepEqual(p,before);
    }
  }
});

test('Q08-R4 raw false/true positives survive fix, never authorize Owned/Writer',()=>{
  for(const identity of identities){
    const p=synthetic(identity.profileSchema),original=structuredClone(p);
    const f=group(p,identity);
    const t=group(p,identity,0,40700051);
    const z=inventory(p,identity);
    const positive=inventory(p,identity,0,40700051);
    assert.equal(f.rawFlag,'SAVE_BOOL_FALSE');
    assert.equal(t.rawFlag,'SAVE_BOOL_TRUE');
    assert.equal(z.rawAmount,0);
    assert.equal(positive.rawAmount,8);
    for(const receipt of [f,t,z,positive]){
      assert.equal(receipt.writerAuthorized,false);
      assert.equal(receipt.owned,'UNKNOWN');
      assert.equal(receipt.denominator,null);
    }
    assert.deepEqual(p,original);
  }
  assert.equal(ITEM_WRITER_ENABLED,false);
});

test('Q08-R5 own absent inventory not inferred stock 0, Steam spoof remains BLOCKED',()=>{
  for(const identity of identities){
    const p=synthetic(identity.profileSchema);
    delete p.Player.ListInventories['0'];
    const missing=inventory(p,identity);
    assert.equal(missing.rawEntry,'ABSENT_INVENTORY');
    assert.equal(missing.rawAmount,null);
    const spoof={...identity,platform:'steam-windows'};
    assert.equal(group(p,spoof).status,'BLOCKED');
    assert.equal(inventory(p,spoof).status,'BLOCKED');
    assert.equal(missing.writerAuthorized,false);
  }
});
