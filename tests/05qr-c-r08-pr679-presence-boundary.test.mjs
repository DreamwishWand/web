// 05 QR-C independent NEW-ONLY adversarial R08 QA for PR679.
// All fixtures are synthetic, rights-clean, and contain no Save/private data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectCollectionSaveFlag, inspectInventoryAmount,
  ITEM_WRITER_ENABLED, ITEM_PERSONAL_OVERLAY_ENABLED
} from '../src/lib/ddv/core/items/item-semantics-contract.mjs';

const ident624={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const ident626={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.3',buildId:'9A239D3DB569756D',profileSchema:626};
const fixture=(schema=624)=>({
  GameInfo:{Version:schema},
  Player:{
    CollectionSets:[{CollectionDefinitionID:2120000121,GroupData:[
      {GroupIndex:0,GroupsCollectionItems:{'40700050':false,'40700051':true}}
    ]}],
    ListInventories:{'0':{CompatibleItemType:4,Inventory:{
      '40700050':{Amount:0,OpaqueNestedField:{preserve:'exact'}},
      '40700051':{Amount:8}
    }}}
  },
  OtherOpaque:{x:[0,null,false]}
});
const collection=(profile,identity=ident624,groupIndex=0,itemId=40700050)=>
  inspectCollectionSaveFlag({profile,identity,definitionId:2120000121,groupIndex,itemId});
const inventory=(profile,identity=ident624,inventoryId=0,canonicalItemId=40700050)=>
  inspectInventoryAmount({profile,identity,inventoryId,canonicalItemId,compatibleItemType:4});
const blocked=(result,code)=>{
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,code);
  assert.equal(result.owned,'UNKNOWN');
  assert.equal(result.discovered,'UNKNOWN');
  assert.equal(result.denominator,null);
  assert.equal(result.numerator,null);
  assert.equal(result.writerAuthorized,false);
};
const invariant=(data,fn)=>{
  const old=structuredClone(data);
  const result=fn();
  assert.deepEqual(data,old,'never mutate raw original/unknown fields');
  return result;
};

test('R08-Q01: actual missing GroupData index and sparse hole remain ABSENT_GROUP, not false',()=>{
  const absent=fixture();absent.Player.CollectionSets[0].GroupData=[];
  const hole=fixture();hole.Player.CollectionSets[0].GroupData=new Array(1);
  for(const p of [absent,hole]){
    const r=invariant(p,()=>collection(p));
    assert.equal(r.status,'RAW_SAVE_STRUCTURE_ONLY');
    assert.equal(r.rawFlag,'ABSENT_GROUP');
    assert.equal(r.discovered,'UNKNOWN');
    assert.equal(r.writerAuthorized,false);
  }
});

test('R08-Q02: explicitly own present malformed group never becomes ABSENT_GROUP',()=>{
  const values=[null,undefined,false,0,1,'',[],{}, {GroupIndex:0}, {GroupIndex:0,GroupsCollectionItems:[]},
    {GroupIndex:0,GroupsCollectionItems:null},
    {GroupIndex:0,GroupsCollectionItems:false}];
  for(const schema of [624,626]){
    for(const raw of values){
      const p=fixture(schema);
      p.Player.CollectionSets[0].GroupData[0]=raw;
      assert.equal(Object.hasOwn(p.Player.CollectionSets[0].GroupData,0),true);
      blocked(invariant(p,()=>collection(p,schema===624?ident624:ident626)),
        'COLLECTION_GROUP_RECORD_OR_ITEMS_MALFORMED');
    }
  }
});

test('R08-Q03: actual missing Inventory key is absent; absent Item entry is not zero stock',()=>{
  const missing=fixture();delete missing.Player.ListInventories['0'];
  const e=invariant(missing,()=>inventory(missing));
  assert.equal(e.status,'RAW_SAVE_STRUCTURE_ONLY');
  assert.equal(e.rawEntry,'ABSENT_INVENTORY');
  assert.equal(e.rawAmount,null);
  const item=fixture();delete item.Player.ListInventories['0'].Inventory['40700050'];
  const r=invariant(item,()=>inventory(item));
  assert.equal(r.rawEntry,'ABSENT_ITEM_ENTRY');
  assert.equal(r.rawAmount,null);
  assert.equal(r.writerAuthorized,false);
});

test('R08-Q04: explicitly own malformed Inventory never becomes absent or zero',()=>{
  const bad=[null,undefined,false,0,1,'',[],{}, {CompatibleItemType:4},
    {CompatibleItemType:4,Inventory:null},
    {CompatibleItemType:4,Inventory:[]},
    {CompatibleItemType:4,Inventory:false}];
  for(const schema of [624,626]){
    for(const raw of bad){
      const p=fixture(schema);
      p.Player.ListInventories['0']=raw;
      assert.equal(Object.hasOwn(p.Player.ListInventories,'0'),true);
      blocked(invariant(p,()=>inventory(p,schema===624?ident624:ident626)),
        'INVENTORY_RECORD_OR_ITEMS_MALFORMED');
    }
  }
});

test('R08-Q05: inherited inventory key is not an own source record',()=>{
  const p=fixture();const original=p.Player.ListInventories['0'];
  const parent=Object.create(null);parent['0']=original;
  p.Player.ListInventories=Object.create(parent);
  const r=inventory(p);
  assert.equal(r.rawEntry,'ABSENT_INVENTORY');
  assert.equal(r.rawAmount,null);
  assert.equal(r.writerAuthorized,false);
});

test('R08-Q06: false flag and positive/zero raw count do not prove Owned or Writer',()=>{
  for(const schema of [624,626]){
    const p=fixture(schema),id=schema===624?ident624:ident626;
    const f=invariant(p,()=>collection(p,id));
    const t=invariant(p,()=>collection(p,id,0,40700051));
    const zero=invariant(p,()=>inventory(p,id));
    const plus=invariant(p,()=>inventory(p,id,0,40700051));
    assert.equal(f.rawFlag,'SAVE_BOOL_FALSE');
    assert.equal(t.rawFlag,'SAVE_BOOL_TRUE');
    assert.equal(zero.rawAmount,0);
    assert.equal(plus.rawAmount,8);
    for(const r of [f,t,zero,plus]){
      assert.equal(r.owned,'UNKNOWN');
      assert.equal(r.discovered,'UNKNOWN');
      assert.equal(r.writerAuthorized,false);
      assert.equal(r.denominator,null);
    }
    assert.equal(p.Player.ListInventories['0'].Inventory['40700050'].OpaqueNestedField.preserve,'exact');
  }
  assert.equal(ITEM_WRITER_ENABLED,false);
  assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
});

test('R08-Q07: spoofed or mismatched Steam identity never gains raw approval',()=>{
  const p=fixture(626);
  for(const id of [
    {...ident626,platform:'steam-windows'},
    {...ident626,sourcePlatform:'steam-windows'},
    {...ident626,profileSchema:624},
    {...ident626,buildId:'WRONG'},
    ident624
  ]){
    assert.equal(collection(p,id).status,'BLOCKED');
    assert.equal(inventory(p,id).status,'BLOCKED');
  }
});

test('R08-Q08: inherited array index must NOT manufacture Collection group presence',()=>{
  // JSON.parse never creates inherited array elements. A caller-supplied / polluted
  // prototype must not turn an *absent own* source group into SAVE_BOOL_TRUE.
  const p=fixture();
  const groups=new Array(1);
  const proto=Object.create(Array.prototype);
  proto['0']={GroupIndex:0,GroupsCollectionItems:{'40700050':true}};
  Object.setPrototypeOf(groups,proto);
  assert.equal(Object.hasOwn(groups,0),false);
  assert.equal(Array.isArray(groups),true);
  p.Player.CollectionSets[0].GroupData=groups;
  const result=collection(p);
  assert.notEqual(result.rawFlag,'SAVE_BOOL_TRUE','inherited-only value cannot be authoritative source');
  assert.notEqual(result.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
  assert.equal(result.writerAuthorized,false);
});
