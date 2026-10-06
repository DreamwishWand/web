import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_ITEM_TYPE,
  CONTENT_KIND,
  FURNITURE_ITEM_TYPE,
  ITEM_TYPE,
  SOURCE_LIMIT_SCOPE,
  classifyWorldObjectCountContributionV125,
  countWorldObjectLimitContributionV125,
  describeNativeLimitScopeV125
} from '../src/lib/ddv/core/world/world-object-count-consumption-v125.js';

const source={platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'};
const furniture=(itemId,subType=FURNITURE_ITEM_TYPE.DEFAULT,extra={})=>({kind:CONTENT_KIND.GRID_OBJECT,itemId,itemType:ITEM_TYPE.FURNITURE,itemSubType:subType,...extra});
const building=(itemId,extra={})=>({kind:CONTENT_KIND.GRID_OBJECT,itemId,itemType:ITEM_TYPE.BUILDING,...extra});

test('duplicates increase Total Objects but Distinct Object Types groups by exact ItemID',()=>{
  const r=countWorldObjectLimitContributionV125({source,sourceScope:SOURCE_LIMIT_SCOPE.VILLAGE,contents:[furniture(40000001),furniture(40000001),furniture(40000002)]});
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.vanillaAligned.totalObjects,3);
  assert.equal(r.vanillaAligned.distinctObjectTypes,2);
  assert.equal(r.sourceLimitScope.uniqueLimit,600);
  assert.equal(r.sourceLimitScope.instanceLimit,3000);
});

test('high-end Village variant is 1200 distinct / 6000 total without changing contribution semantics',()=>{
  const scope=describeNativeLimitScopeV125({scope:SOURCE_LIMIT_SCOPE.VILLAGE,extraLimitObject:true});
  assert.equal(scope.uniqueLimit,1200);
  assert.equal(scope.instanceLimit,6000);
  assert.equal(scope.aggregation,'WHOLE_VILLAGE_ALL_AREA_GRID_IDS_RECURSIVE_SUBGRIDS');
});

test('Road and Fence remain raw contents but consume neither generic metric',()=>{
  const r=countWorldObjectLimitContributionV125({source,sourceScope:SOURCE_LIMIT_SCOPE.VILLAGE,contents:[
    furniture(40000010),
    {kind:CONTENT_KIND.ROAD,itemId:40000011},
    {kind:CONTENT_KIND.FENCE,itemId:40000012}
  ]});
  assert.equal(r.vanillaAligned.totalObjects,1);
  assert.equal(r.vanillaAligned.distinctObjectTypes,1);
  assert.equal(r.rawPreset.rawPlacedContentCount,3);
  assert.deepEqual(r.vanillaAligned.excluded.map(x=>x.reason),[
    'OBJECT_LIMIT_EXCLUSION_FURNITURE_GROUND_ALTERATION',
    'OBJECT_LIMIT_EXCLUSION_FURNITURE_FENCE'
  ]);
});

test('Furniture GroundAlteration/Fence subtypes are excluded even when represented as generic GridObject input',()=>{
  assert.equal(classifyWorldObjectCountContributionV125(furniture(1,FURNITURE_ITEM_TYPE.GROUND_ALTERATION)).contributesToTotalObjects,false);
  assert.equal(classifyWorldObjectCountContributionV125(furniture(2,FURNITURE_ITEM_TYPE.FENCE)).contributesToDistinctObjectTypes,false);
});

test('ordinary Furniture, Landscaping, Door and grid-backed Building/PlayerHouse all consume the generic pair',()=>{
  const r=countWorldObjectLimitContributionV125({source,contents:[
    furniture(10,FURNITURE_ITEM_TYPE.DEFAULT),
    furniture(11,FURNITURE_ITEM_TYPE.LANDSCAPING),
    furniture(12,FURNITURE_ITEM_TYPE.DOOR),
    building(20,{semanticClass:'BUILDING'}),
    building(21,{semanticClass:'PLAYER_HOUSE_EXTERIOR'})
  ]});
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.vanillaAligned.totalObjects,5);
  assert.equal(r.vanillaAligned.distinctObjectTypes,5);
});

test('SubGrid parent and descendants are independently counted recursively and excluded children stay raw',()=>{
  const r=countWorldObjectLimitContributionV125({source,contents:[
    furniture(100,FURNITURE_ITEM_TYPE.DEFAULT,{children:[
      furniture(101),
      furniture(101),
      {kind:CONTENT_KIND.ROAD,itemId:102}
    ]})
  ]});
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.rawPreset.rawPlacedContentCount,4);
  assert.equal(r.vanillaAligned.totalObjects,3);
  assert.equal(r.vanillaAligned.distinctObjectTypes,2);
  assert.equal(r.vanillaAligned.excluded.length,1);
});

test('Ephemeral ActivityItem is explicitly excluded while non-ephemeral ActivityItem GridObject is generically counted',()=>{
  const r=countWorldObjectLimitContributionV125({source,contents:[
    {kind:CONTENT_KIND.GRID_OBJECT,itemId:300,itemType:ITEM_TYPE.ACTIVITY_ITEM,itemSubType:ACTIVITY_ITEM_TYPE.EPHEMERAL},
    {kind:CONTENT_KIND.GRID_OBJECT,itemId:301,itemType:ITEM_TYPE.ACTIVITY_ITEM,itemSubType:ACTIVITY_ITEM_TYPE.DEFAULT}
  ]});
  assert.equal(r.vanillaAligned.totalObjects,1);
  assert.equal(r.vanillaAligned.distinctObjectTypes,1);
  assert.equal(r.vanillaAligned.excluded[0].reason,'OBJECT_LIMIT_EXCLUSION_ACTIVITY_EPHEMERAL');
});

test('off-grid Building and environment state are not GridCollection object-limit entries',()=>{
  const r=countWorldObjectLimitContributionV125({source,contents:[
    {kind:CONTENT_KIND.OFF_GRID_BUILDING,itemId:200},
    {kind:CONTENT_KIND.ENVIRONMENT_STATE,itemId:600}
  ]});
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.vanillaAligned.totalObjects,0);
  assert.equal(r.vanillaAligned.distinctObjectTypes,0);
  assert.equal(r.rawPreset.rawPlacedContentCount,2);
});

test('unknown Furniture or Activity subtype fails closed rather than guessing exclusion/inclusion',()=>{
  let r=countWorldObjectLimitContributionV125({source,contents:[{kind:CONTENT_KIND.GRID_OBJECT,itemId:1,itemType:ITEM_TYPE.FURNITURE}]});
  assert.equal(r.status,'BLOCKED_UNKNOWN');
  assert.equal(r.vanillaAligned.totalObjects,null);
  assert.equal(r.vanillaAligned.distinctObjectTypes,null);
  assert.equal(r.unknownBlockers[0].code,'WORLD_OBJECT_COUNT_FURNITURE_SUBTYPE_REQUIRED');

  r=countWorldObjectLimitContributionV125({source,contents:[{kind:CONTENT_KIND.GRID_OBJECT,itemId:2,itemType:ITEM_TYPE.ACTIVITY_ITEM}]});
  assert.equal(r.status,'BLOCKED_UNKNOWN');
  assert.equal(r.unknownBlockers[0].code,'WORLD_OBJECT_COUNT_ACTIVITY_SUBTYPE_REQUIRED');
});

test('Floating Island has no native provider but Preset contribution metrics remain descriptive item-level counts',()=>{
  const r=countWorldObjectLimitContributionV125({source,sourceScope:SOURCE_LIMIT_SCOPE.FLOATING_ISLAND,contents:[furniture(1),furniture(2),{kind:CONTENT_KIND.FENCE,itemId:3}]});
  assert.equal(r.status,'VERIFIED');
  assert.equal(r.sourceLimitScope.nativeObjectLimitProvider,false);
  assert.equal(r.vanillaAligned.totalObjects,2);
  assert.equal(r.vanillaAligned.distinctObjectTypes,2);
});

test('Room is a separate native ObjectLimit scope with unlimited generic pair sentinel',()=>{
  const scope=describeNativeLimitScopeV125({scope:SOURCE_LIMIT_SCOPE.PLAYER_HOUSE_ROOM});
  assert.equal(scope.nativeObjectLimitProvider,true);
  assert.equal(scope.uniqueLimit,-1);
  assert.equal(scope.instanceLimit,-1);
  assert.equal(scope.specificItemLimits,'PRESENT_SEPARATE_FROM_GENERIC_PAIR');
});

test('ToM/design state does not alter exact ItemID grouping',()=>{
  const r=countWorldObjectLimitContributionV125({source,contents:[
    furniture(40012345,FURNITURE_ITEM_TYPE.DEFAULT,{designId:700}),
    furniture(40012345,FURNITURE_ITEM_TYPE.DEFAULT,{designId:701})
  ]});
  assert.equal(r.vanillaAligned.totalObjects,2);
  assert.equal(r.vanillaAligned.distinctObjectTypes,1);
});

test('wrong build metadata blocks verified result',()=>{
  const r=countWorldObjectLimitContributionV125({source:{...source,buildIdentity:'WRONG'},contents:[furniture(1)]});
  assert.equal(r.status,'BLOCKED_UNKNOWN');
  assert.equal(r.vanillaAligned.totalObjects,null);
  assert.ok(r.unknownBlockers.some(x=>x.code==='EXACT_SWITCH_V125_BUILD_REQUIRED'));
});
