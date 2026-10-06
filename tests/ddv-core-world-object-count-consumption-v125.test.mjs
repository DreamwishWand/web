import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COUNT_PROFILE,
  NATIVE_SCOPE,
  WORLD_OBJECT_COUNT_RESULT_SCHEMA,
  buildDefinitionIndexFromCurrentGameDbItemsV125,
  classifyWorldObjectCountContributionV125,
  countWorldObjectConsumptionV125
} from '../src/lib/ddv/core/world/world-object-count-consumption-v125.js';

const source={
  platform:'Nintendo Switch',
  gameVersion:'1.25.0',
  profileSchemaVersion:624,
  buildIdentity:'52BD625D9B4E0053'
};

const definitions=buildDefinitionIndexFromCurrentGameDbItemsV125([
  {itemID:40000001,itemType:4,itemTypeName:'Furniture',subtype:0,concreteItemDataType:'FurnitureItemData'},
  {itemID:40000002,itemType:4,itemTypeName:'Furniture',subtype:0,concreteItemDataType:'FurnitureItemData'},
  {itemID:42000001,itemType:4,itemTypeName:'Furniture',subtype:2,concreteItemDataType:'LandscapingItemData'},
  {itemID:15000001,itemType:2,itemTypeName:'Building',subtype:0,concreteItemDataType:'BuildingItemData'},
  {itemID:15000002,itemType:2,itemTypeName:'Building',subtype:5,concreteItemDataType:'BuildingItemData'},
  {itemID:15000003,itemType:2,itemTypeName:'Building',subtype:4,concreteItemDataType:'OffGridBuildingItemData'},
  {itemID:44000001,itemType:4,itemTypeName:'Furniture',subtype:1,concreteItemDataType:'FenceAndRoadItemData'},
  {itemID:44000002,itemType:4,itemTypeName:'Furniture',subtype:7,concreteItemDataType:'FenceAndRoadItemData'},
  {itemID:33000001,itemType:3,itemTypeName:'ActivityItem',subtype:13,concreteItemDataType:'EphemeralItemData'},
  {itemID:40001920,itemType:4,itemTypeName:'Furniture',subtype:0,concreteItemDataType:'FurnitureItemData'}
]);

const obj=(itemId,id,portableState=null)=>({
  artifactObjectId:id,
  itemId,
  localX:0,
  localY:0,
  orientation:0,
  footprint:[{x:0,y:0}],
  portableState
});

test('duplicate ordinary instances increment Total for every occurrence but Distinct once',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'a'),obj(40000001,'b')],
    definitionIndex:definitions,
    profile:COUNT_PROFILE.PRESET_VILLAGE_CONTRIBUTION,
    sourceNativeScope:NATIVE_SCOPE.VILLAGE
  });
  assert.equal(r.schema,WORLD_OBJECT_COUNT_RESULT_SCHEMA);
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.distinctObjectTypes,1);
  assert.equal(r.totalObjects,2);
  assert.equal(r.countedOccurrences.length,2);
});

test('different ordinary ItemIDs increment both generic counters',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'a'),obj(40000002,'b'),obj(42000001,'c')],
    definitionIndex:definitions,
    sourceNativeScope:NATIVE_SCOPE.VILLAGE
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.distinctObjectTypes,3);
  assert.equal(r.totalObjects,3);
});

test('grid-placed Building and PlayerHouse exterior consume the generic pair',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(15000001,'house'),obj(15000002,'player-house')],
    definitionIndex:definitions,
    sourceNativeScope:NATIVE_SCOPE.VILLAGE
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.distinctObjectTypes,2);
  assert.equal(r.totalObjects,2);
  assert.deepEqual(r.countedOccurrences.map(x=>x.itemId),[15000001,15000002]);
});

test('SubGrid parent and descendants count independently while ItemID grouping is aggregate-wide',()=>{
  const nested={
    codec:'subgrid.serialized-local-child@1',
    child:{
      width:4,height:4,tessellationFactor:1,
      objects:[
        obj(40000002,'c0'),
        obj(40000001,'c1')
      ]
    }
  };
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'parent',nested)],
    definitionIndex:definitions,
    sourceNativeScope:NATIVE_SCOPE.VILLAGE
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.rawPresetContents.rootGridObjectNodes,1);
  assert.equal(r.rawPresetContents.subGridDescendantNodes,2);
  assert.equal(r.totalObjects,3);
  assert.equal(r.distinctObjectTypes,2);
  assert.deepEqual(
    r.countedOccurrences.map(x=>x.relation),
    ['ROOT','SUBGRID_DESCENDANT','SUBGRID_DESCENDANT']
  );
});

test('Village/Preset profile excludes Road, Fence and Ephemeral from both counters',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[
      obj(44000001,'road-grid-object'),
      obj(44000002,'fence-grid-object'),
      obj(33000001,'ephemeral'),
      obj(40000001,'ordinary')
    ],
    networks:{roads:[{networkId:'r0'}],fences:[{networkId:'f0'}]},
    definitionIndex:definitions,
    profile:COUNT_PROFILE.PRESET_VILLAGE_CONTRIBUTION,
    sourceNativeScope:NATIVE_SCOPE.VILLAGE
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.distinctObjectTypes,1);
  assert.equal(r.totalObjects,1);
  assert.equal(r.excludedNonConsumingContents.length,5);
  const reasons=r.excludedNonConsumingContents.map(x=>x.reason);
  assert.ok(reasons.includes('VILLAGE_OBJECT_LIMIT_EXCLUSION_GROUND_ALTERATION'));
  assert.ok(reasons.includes('VILLAGE_OBJECT_LIMIT_EXCLUSION_FENCE'));
  assert.ok(reasons.includes('VILLAGE_OBJECT_LIMIT_EXCLUSION_EPHEMERAL'));
  assert.equal(r.rawPresetContents.roadLogicalContents,1);
  assert.equal(r.rawPresetContents.fenceLogicalContents,1);
});

test('raw Preset content is intentionally distinct from vanilla-limit contribution',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'f'),obj(44000001,'road-object')],
    networks:{roads:[{networkId:'r0'}],fences:null},
    definitionIndex:definitions
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.rawPresetContents.gridObjectNodes,2);
  assert.equal(r.rawPresetContents.roadLogicalContents,1);
  assert.equal(r.rawPresetContents.combinedRawObjectCountIntentionallyUndefined,true);
  assert.equal(r.totalObjects,1);
  assert.equal(r.distinctObjectTypes,1);
});

test('unknown definition fails closed instead of guessing counts',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(99999999,'unknown')],
    definitionIndex:definitions
  });
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.distinctObjectTypes,null);
  assert.equal(r.totalObjects,null);
  assert.ok(r.unknownBlockers.some(x=>x.code==='UNKNOWN_COUNT_CONSUMPTION'));
});

test('unsupported nested portable-state codec fails closed',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'x',{codec:'future.codec@9'})],
    definitionIndex:definitions
  });
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.distinctObjectTypes,null);
  assert.equal(r.totalObjects,null);
  assert.ok(r.unknownBlockers.some(x=>x.code==='PRESET_PORTABLE_STATE_CODEC_UNKNOWN'));
});

test('Room native generic ObjectLimit has no Village Road/Fence/Ephemeral exclusions for GridObjects',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[
      obj(44000001,'road-like'),
      obj(44000002,'fence-like'),
      obj(33000001,'ephemeral-like')
    ],
    definitionIndex:definitions,
    profile:COUNT_PROFILE.NATIVE_ROOM,
    sourceNativeScope:NATIVE_SCOPE.ROOM
  });
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.totalObjects,3);
  assert.equal(r.distinctObjectTypes,3);
  assert.deepEqual(r.sourceNativeScope.genericLimits,{uniqueLimit:-1,instanceLimit:-1});
  assert.equal(r.sourceNativeScope.specificItemLimits[0].instanceLimit,5);
});

test('logical Road/Fence network payload must not borrow Village exclusions in Room profile',()=>{
  const r=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'ordinary')],
    networks:{roads:[{networkId:'r'}],fences:null},
    definitionIndex:definitions,
    profile:COUNT_PROFILE.NATIVE_ROOM,
    sourceNativeScope:NATIVE_SCOPE.ROOM
  });
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.totalObjects,null);
  assert.ok(r.unknownBlockers.some(x=>x.code==='ROOM_LOGICAL_NETWORK_COUNT_SEMANTICS_UNSUPPORTED'));
});

test('Floating Island native profile is explicitly not applicable, while Preset contribution profile remains computable',()=>{
  const native=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'a')],
    definitionIndex:definitions,
    profile:COUNT_PROFILE.NATIVE_FLOATING_ISLAND,
    sourceNativeScope:NATIVE_SCOPE.FLOATING_ISLAND
  });
  assert.equal(native.status,'BLOCKED');
  assert.equal(native.totalObjects,null);
  assert.equal(native.sourceNativeScope.provider,null);

  const preset=countWorldObjectConsumptionV125({
    source,
    objects:[obj(40000001,'a'),obj(44000002,'fence')],
    networks:{roads:null,fences:[{networkId:'f'}]},
    definitionIndex:definitions,
    profile:COUNT_PROFILE.PRESET_VILLAGE_CONTRIBUTION,
    sourceNativeScope:NATIVE_SCOPE.FLOATING_ISLAND
  });
  assert.equal(preset.status,'VERIFIED');
  assert.equal(preset.distinctObjectTypes,1);
  assert.equal(preset.totalObjects,1);
  assert.equal(preset.sourceNativeScope.provider,null);
  assert.equal(preset.metadata.presetReportingSemantics,'VILLAGE_GENERIC_LIMIT_CONTRIBUTION_NOT_RAW_SERIALIZED_NODE_COUNT');
});

test('classification proves same current Village inclusion for Total and Distinct',()=>{
  const ordinary=classifyWorldObjectCountContributionV125({
    source,definition:definitions['40000001']
  });
  assert.equal(ordinary.status,'VERIFIED_INCLUDED');
  assert.equal(ordinary.contributesToTotalObjects,'YES');
  assert.equal(ordinary.contributesToDistinctObjectTypes,'YES');
  assert.deepEqual(ordinary.distinctGroupingKey,{kind:'ITEM_ID',value:40000001});

  const road=classifyWorldObjectCountContributionV125({
    source,definition:definitions['44000001']
  });
  assert.equal(road.status,'VERIFIED_EXCLUDED');
  assert.equal(road.contributesToTotalObjects,'NO');
  assert.equal(road.contributesToDistinctObjectTypes,'NO');
});

test('exact Switch v1.25 build boundary is mandatory',()=>{
  const r=countWorldObjectConsumptionV125({
    source:{...source,buildIdentity:'WRONG'},
    objects:[obj(40000001,'a')],
    definitionIndex:definitions
  });
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.totalObjects,null);
  assert.ok(r.unknownBlockers.some(x=>x.code==='EXACT_SWITCH_BID_REQUIRED'));
});
