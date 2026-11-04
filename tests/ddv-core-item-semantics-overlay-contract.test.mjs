import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_SEMANTIC_CONTRACT,ITEM_PERSONAL_OVERLAY_ENABLED,ITEM_WRITER_ENABLED,
  ITEM_SOURCE_TARGETS,ITEM_OPERATION_MATRIX,ITEM_TYPED_READ_COMMANDS,
  ITEM_TYPED_WRITE_CANDIDATES,inspectCollectionSaveFlag,inspectInventoryAmount,
  previewInventoryAmountCAS
} from '../src/lib/ddv/core/items/item-semantics-contract.mjs';

const id1250={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
  buildId:'52BD625D9B4E0053',profileSchema:624};
const id1253={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.3',
  buildId:'9A239D3DB569756D',profileSchema:626};
const makeProfile=(version=624)=>({
  GameInfo:{Version:version,LastSaveDeviceInfo:'DO_NOT_USE_AS_PROVENANCE'},
  Player:{
    CollectionSets:[{CollectionDefinitionID:2120000121,GroupData:[
      {GroupIndex:0,GroupsCollectionItems:{'40700050':true,'40700051':false}}
    ]}],
    ListInventories:{'0':{CompatibleItemType:4,Inventory:{
      '40700050':{Amount:0,UnknownCustomField:'preserve'},
      '40700051':{Amount:8}
    }}}
  },OtherUserOpaque:{x:1}
});
const col=(overrides={})=>inspectCollectionSaveFlag({
  profile:makeProfile(),identity:id1250,definitionId:2120000121,
  itemId:40700050,...overrides
});
const inv=(overrides={})=>inspectInventoryAmount({
  profile:makeProfile(),identity:id1250,inventoryId:0,
  canonicalItemId:40700050,compatibleItemType:4,...overrides
});
test('01D matrix exposes only source/raw inspection, never a writer, even for apparent simple item counts',()=>{
  assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
  assert.equal(ITEM_WRITER_ENABLED,false);
  assert.equal(ITEM_OPERATION_MATRIX.length,10);
  assert.ok(ITEM_OPERATION_MATRIX.every(x=>x.write==='OFF' && !x.nativeV3Accepted && !x.productWriterEnabled));
  assert.ok(ITEM_OPERATION_MATRIX.some(x=>x.operation==='touch-of-magic'));
  assert.ok(ITEM_OPERATION_MATRIX.some(x=>x.operation==='recipes-unlock'));
  assert.ok(ITEM_OPERATION_MATRIX.some(x=>x.operation==='quest-progression'&&x.read==='EXCLUDED'));
  assert.ok(ITEM_TYPED_READ_COMMANDS.every(x=>x.name.startsWith('Item.')));
  assert.equal(ITEM_TYPED_WRITE_CANDIDATES[0].commitAuthorized,false);
  assert.equal(ITEM_TYPED_WRITE_CANDIDATES[0].nativeV3Required,true);
});

test('Collection definition is looked up by definition ID, not array offset; true/false/absent distinguish RAW only',()=>{
  const t=col(),f=col({itemId:40700051}),absent=col({itemId:40700052});
  assert.equal(t.rawFlag,'SAVE_BOOL_TRUE');assert.equal(f.rawFlag,'SAVE_BOOL_FALSE');
  assert.equal(absent.rawFlag,'ABSENT_ITEM_ENTRY');
  assert.equal(t.collected,undefined); // not a UI-discovered assertion
  for (const r of [t,f,absent]) {
    assert.equal(r.status,'RAW_SAVE_STRUCTURE_ONLY');
    assert.equal(r.discovered,'UNKNOWN');assert.equal(r.owned,'UNKNOWN');
    assert.equal(r.missing,'UNKNOWN');assert.equal(r.denominator,null);
    assert.equal(r.nativeGroupComplete,false);
    assert.equal(r.personalCollectionDisplayAuthorized,false);
    assert.equal(r.writerAuthorized,false);
  }
  assert.equal(col({definitionId:2120000122}).rawFlag,'ABSENT_DEFINITION');
  assert.equal(col({groupIndex:1}).rawFlag,'ABSENT_GROUP');
});

test('Malformed and duplicate Collection entries block; boolean false never implies missing',()=>{
  const invalid=makeProfile();invalid.Player.CollectionSets[0].GroupData[0].GroupsCollectionItems['40700050']=1;
  assert.equal(col({profile:invalid}).code,'COLLECTION_BOOLEAN_FIELD_INVALID');
  const duplicated=makeProfile();duplicated.Player.CollectionSets.push(structuredClone(duplicated.Player.CollectionSets[0]));
  assert.equal(col({profile:duplicated}).code,'COLLECTION_DUPLICATE_DEFINITION');
  const badGroup=makeProfile();badGroup.Player.CollectionSets[0].GroupData[0].GroupIndex=5;
  assert.equal(col({profile:badGroup}).code,'COLLECTION_GROUP_INDEX_CONFLICT');
  assert.equal(col({itemId:0}).status,'BLOCKED');
});

test('Inventory raw zero, positive and absence do not authorize Owned, and unknown original fields are not mutated',()=>{
  const original=makeProfile();
  const before=structuredClone(original);
  const zero=inv({profile:original}),positive=inv({profile:original,canonicalItemId:40700051});
  const missing=inv({profile:original,canonicalItemId:40700052});
  assert.equal(zero.rawAmount,0);assert.equal(zero.rawEntry,'PRESENT');
  assert.equal(positive.rawAmount,8);assert.equal(positive.rawEntry,'PRESENT');
  assert.equal(missing.rawEntry,'ABSENT_ITEM_ENTRY');assert.equal(missing.rawAmount,null);
  assert.equal(zero.owned,'UNKNOWN');assert.equal(positive.owned,'UNKNOWN');
  assert.equal(zero.writerAuthorized,false);
  assert.deepEqual(original,before);
});

test('Inventory canonical route, compatible item type and amount bounds fail closed',()=>{
  assert.equal(inv({compatibleItemType:5}).code,'INVENTORY_COMPATIBLE_ITEM_TYPE_MISMATCH');
  assert.equal(inv({compatibleItemType:undefined}).code,'CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
  assert.equal(inv({inventoryId:-1}).status,'BLOCKED');
  assert.equal(inv({canonicalItemId:0}).status,'BLOCKED');
  const invalid=makeProfile();invalid.Player.ListInventories['0'].Inventory['40700050'].Amount='5';
  assert.equal(inv({profile:invalid}).code,'INVENTORY_AMOUNT_FIELD_INVALID');
  const negative=makeProfile();negative.Player.ListInventories['0'].Inventory['40700050'].Amount=-2;
  assert.equal(inv({profile:negative}).code,'INVENTORY_AMOUNT_FIELD_INVALID');
  const missing=makeProfile();missing.Player.ListInventories['0'].Inventory={};
  assert.equal(inv({profile:missing}).rawAmount,null);
  assert.equal(inv({profile:missing}).rawEntry,'ABSENT_ITEM_ENTRY');
});

test('Both Switch builds can inspect matching save SHAPE but cannot share semantic acceptance',()=>{
  const r1253=inspectCollectionSaveFlag({
    profile:makeProfile(626),identity:id1253,
    definitionId:2120000121,itemId:40700050
  });
  assert.equal(r1253.status,'RAW_SAVE_STRUCTURE_ONLY');
  assert.equal(r1253.target.buildId,ITEM_SOURCE_TARGETS.switch1253.buildId);
  assert.equal(r1253.nativeGroupComplete,false);
  assert.equal(r1253.discovered,'UNKNOWN');
  const r1250=col();assert.equal(r1250.target.profileSchema,624);
  assert.equal(col({profile:makeProfile(626)}).code,'EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
  assert.equal(col({identity:id1253}).status,'BLOCKED');
  assert.equal(col({identity:{...id1250,sourcePlatform:'steam-windows'}}).status,'BLOCKED');
  assert.equal(col({identity:{...id1250,buildId:id1253.buildId}}).status,'BLOCKED');
  assert.equal(inv({identity:{...id1250,gameVersion:'1.25.3'}}).status,'BLOCKED');
});

test('Preview inventory CAS stays hypothetical and fails closed on stale old value, bounds or absence',()=>{
  const original=makeProfile();
  const old=inv({profile:original});
  const p=previewInventoryAmountCAS({inspection:old,expectedOldAmount:0,nextAmount:1});
  assert.equal(p.schema,ITEM_SEMANTIC_CONTRACT);
  assert.equal(p.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
  assert.equal(p.sourceRevisionVerified,false);
  assert.equal(p.fullDocumentDiffVerified,false);
  assert.equal(p.crossDomainReferencesVerified,false);
  assert.equal(p.writerAuthorized,false);
  assert.equal(p.exportAuthorized,false);
  assert.equal(previewInventoryAmountCAS({inspection:old,expectedOldAmount:1,nextAmount:2}).status,'BLOCKED');
  assert.equal(previewInventoryAmountCAS({inspection:old,expectedOldAmount:0,nextAmount:0}).code,'INVENTORY_PREVIEW_NO_OP');
  assert.equal(previewInventoryAmountCAS({inspection:old,expectedOldAmount:0,nextAmount:2147483648}).code,'INVENTORY_PREVIEW_BOUNDS');
  assert.equal(previewInventoryAmountCAS({inspection:inv({canonicalItemId:40700052}),expectedOldAmount:0,nextAmount:1}).status,'BLOCKED');
  assert.equal(original.Player.ListInventories['0'].Inventory['40700050'].Amount,0);
});

test('Missing source/unknown version/unknown build/identity-spoofed profile is never personal evidence',()=>{
  for (const identity of [
    undefined,{}, {...id1250,gameVersion:'1.25.2'},
    {...id1250,profileSchema:626}, {...id1250,platform:'steam-windows'}
  ]) assert.equal(col({identity}).status,'BLOCKED');
  assert.equal(inv({profile:{}}).status,'BLOCKED');
  const r=col({identity:{...id1250,externalBidAttested:true,fullVersion:'self-asserted'}});
  assert.equal(r.sourceIdentityAttestedByInspector,false);
  assert.equal(r.personalCollectionDisplayAuthorized,false);
});
