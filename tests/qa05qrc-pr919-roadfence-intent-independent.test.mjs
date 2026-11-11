import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RoadFenceEditIntent as I,
  ROADFENCE_OPERATION_INTENT_CONTRACT as CONTRACT,
  assessRoadFenceEditIntentV125 as assess
} from '../src/lib/ddv/core/roadfence/operation-intent-v125.js';
import { FenceMode } from '../src/lib/ddv/core/roadfence/logical.js';
import { BUILD_V125_SWITCH } from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

const R = FenceMode.ORTHOGONAL;
const D = FenceMode.DIAGONAL;
const cell = (x,y,mode=R) => ({x,y,mode});
const road = (cells, familyBaseItemID=40100068) => ({familyBaseItemID,cells});
const node = (id,x,y,mode=R) => ({id,x,y,mode});
const fence = (nodes,edges,familyBaseItemID=40700246) =>
  ({familyBaseItemID,graph:{nodes,edges}});
const edge = (a,b) => ({a,b});
const check=(kind,intent,sourceNetwork,desiredNetwork,motion,buildIdentity=BUILD_V125_SWITCH)=>
  assess({buildIdentity,kind,intent,sourceNetwork,desiredNetwork,motion});
function locked(r) {
  assert.equal(r.contract,CONTRACT);
  assert.equal(r.layoutPolicy,'PRESERVE_EXISTING');
  assert.equal(r.sourceBinding,'REQUIRES_CORE_SESSION_TYPED_SOURCE_WITNESS');
  assert.equal(r.compilerSupport,'MUST_RUN_EXISTING_01C_COMPILER_SEPARATELY');
  assert.equal(r.nativeProducerConsumerRecompileV3,'UNKNOWN');
  assert.equal(r.nativeInventoryCostRefund,'UNKNOWN');
  assert.equal(r.wandInventoryDelta,0);
  for(const k of ['writerAuthorized','persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125','productApplyAuthorized']){
    assert.equal(r[k],false,k);
  }
}
function yes(r){
  locked(r);assert.equal(r.status,'STATIC_INTENT_VALIDATED_ONLY',JSON.stringify(r));
  assert.equal(r.sourceBuildIdentity.platform,'Nintendo Switch');
  assert.equal(r.sourceBuildIdentity.gameVersion,'1.25.0');
  assert.equal(r.sourceBuildIdentity.bid,'52BD625D9B4E0053');
  assert.equal(r.sourceBuildIdentity.profileSchema,624);
  assert.equal(r.nextGate,'EXACT_COMPILER_SCOPE_AND_01E_SAME_BUILD_V3');
}
function no(r,code){
  locked(r);assert.equal(r.status,'FAIL_CLOSED',JSON.stringify(r));
  assert.equal(r.errorCode,code);
}
test('QAC919 delimiter | different valid Fence edges may not masquerade as monotonic ADD',()=>{
  const nodes=[node('a',0,0),node('b|c',1,0),node('a|b',10,0),node('c',11,0)];
  const before=fence(nodes,[edge('a','b|c')]);
  const replaced=fence([...nodes,node('unused',21,0)],[edge('a|b','c')]);
  no(check('fence',I.ADD,before,replaced),'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
  const monotonic=fence([...nodes,node('unused',21,0)],[edge('a','b|c')]);
  const res=check('fence',I.ADD,before,monotonic);
  yes(res);assert.equal(res.addedLogicalElements,1);
  assert.equal(res.removedExplicitConnections,0);
  assert.equal(res.logicalQuantityDelta,1);
  assert.equal(res.wandInventoryDelta,0);
});
test('QAC919 FALSE ADD cannot remove an edge when a different explicit edge appears',()=>{
  const nodes=[node('x',0,0),node('y',1,0),node('p',10,0),node('q',11,0)];
  const old=fence(nodes,[edge('x','y')]);
  const replaced=fence([...nodes,node('new',30,0)],[edge('p','q')]);
  no(check('fence',I.ADD,old,replaced),'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
  no(check('fence',I.ERASE,old,replaced),'ROADFENCE_OPERATION_ERASE_NOT_MONOTONIC');
});
test('QAC919 RECOMPILE must reject changed valid Fence edge even if legacy :: fingerprint collides',()=>{
  const nodes=[
    node('a',0,0),node('b::c',1,0),node('a::b',10,0),node('c',11,0)
  ];
  const old=fence(nodes,[edge('a','b::c')]);
  const changed=fence(nodes,[edge('a::b','c')]);
  assert.notDeepEqual(old.graph.edges,changed.graph.edges);
  // Distinct native topology: old a--b::c; new a::b--c. Both are valid.
  // A shared preexisting "::"-joined topology fingerprint can collide.
  // New PR919 RECOMPILE must independently compare unambiguous endpoints,
  // not inadvertently promote changed topology to STATIC_INTENT_VALIDATED_ONLY.
  no(check('fence',I.RECOMPILE,old,changed),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
  yes(check('fence',I.RECOMPILE,old,old));
});
test('QAC919 Road ADD/ERASE logical quantity differs from inventory and Native cost',()=>{
  const a=road([cell(1,1)]);
  const b=road([cell(1,1),cell(2,1),cell(3,1)]);
  const added=check('road',I.ADD,a,b);
  yes(added);assert.equal(added.logicalQuantityBefore,1);
  assert.equal(added.logicalQuantityAfter,3);
  assert.equal(added.logicalQuantityDelta,2);
  assert.equal(added.wandInventoryDelta,0);
  const erased=check('road',I.ERASE,b,a);
  yes(erased);assert.equal(erased.logicalQuantityDelta,-2);
  assert.equal(erased.wandInventoryDelta,0);
  no(check('road',I.ADD,b,a),'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
  no(check('road',I.ERASE,a,b),'ROADFENCE_OPERATION_ERASE_NOT_MONOTONIC');
});
test('QAC919 Fence connect/disconnect component count must change in correct direction',()=>{
  const nodes=[node('aa',0,0),node('bb',1,0),node('cc',2,0)];
  const separate=fence(nodes,[]);
  const joined=fence(nodes,[edge('aa','bb'),edge('bb','cc')]);
  const connect=check('fence',I.CONNECT,separate,joined);
  yes(connect);assert.equal(connect.sourceComponents,3);
  assert.equal(connect.desiredComponents,1);
  assert.equal(connect.logicalQuantityDelta,0);
  assert.equal(connect.addedExplicitConnections,2);
  const disconnect=check('fence',I.DISCONNECT,joined,separate);
  yes(disconnect);assert.equal(disconnect.sourceComponents,1);
  assert.equal(disconnect.desiredComponents,3);
  assert.equal(disconnect.removedExplicitConnections,2);
  no(check('fence',I.CONNECT,joined,joined),'ROADFENCE_OPERATION_CONNECTION_NOT_PROVEN');
  no(check('fence',I.DISCONNECT,separate,joined),'ROADFENCE_OPERATION_DISCONNECTION_NOT_PROVEN');
  no(check('fence',I.ADD,separate,joined),'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
});
test('QAC919 illegal connect disguised by inserted isolated node fails component gate',()=>{
  const source=fence([node('u',0,0),node('v',1,0)],[]);
  const desired=fence([node('u',0,0),node('v',1,0),node('z',10,0)],[edge('u','v')]);
  // Component count remains 2: 2 old -> connected pair + isolated = 2.
  no(check('fence',I.CONNECT,source,desired),'ROADFENCE_OPERATION_CONNECTION_NOT_PROVEN');
});
test('QAC919 Road bridge and broken edge must not invert CONNECT/DISCONNECT',()=>{
  const unconnected=road([cell(0,5),cell(2,5)]);
  const connected=road([cell(0,5),cell(1,5),cell(2,5)]);
  const join=check('road',I.CONNECT,unconnected,connected);
  yes(join);assert.equal(join.sourceComponents,2);assert.equal(join.desiredComponents,1);
  const cut=check('road',I.DISCONNECT,connected,unconnected);
  yes(cut);assert.equal(cut.sourceComponents,1);assert.equal(cut.desiredComponents,2);
  no(check('road',I.CONNECT,connected,unconnected),'ROADFENCE_OPERATION_CONNECTION_NOT_PROVEN');
  no(check('road',I.DISCONNECT,unconnected,connected),'ROADFENCE_OPERATION_DISCONNECTION_NOT_PROVEN');
});
test('QAC919 Move/Rotate require true canonical transform and prohibit reflection',()=>{
  const old=road([cell(0,0),cell(1,0)]);
  const moved=road([cell(0,3),cell(1,3)]);
  yes(check('road',I.MOVE,old,moved,{translateY:3}));
  no(check('road',I.MOVE,old,moved,{translateY:4}),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
  no(check('road',I.MOVE,old,moved,{translateY:3,rotateQuarterTurns:1}),'ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID');
  no(check('road',I.MOVE,old,moved,{translateY:3,reflection:true}),'ROADFENCE_OPERATION_TRANSFORM_UNRECOGNIZED_FIELD');
  no(check('road',I.MOVE,old,moved,{translateY:0}),'ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID');
  const rotated=road([cell(0,0),cell(0,1)]);
  yes(check('road',I.ROTATE,old,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:1}));
  no(check('road',I.ROTATE,old,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:0}),'ROADFENCE_OPERATION_ROTATE_TRANSFORM_INVALID');
  no(check('road',I.ROTATE,old,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:1,translateY:1}),'ROADFENCE_OPERATION_ROTATE_TRANSFORM_INVALID');
  no(check('road',I.ROTATE,old,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:4}),'ROADFENCE_OPERATION_ROTATE_TRANSFORM_INVALID');
});
test('QAC919 invalid transform and forged motion fields fail closed',()=>{
  const src=road([cell(0,0)]),dst=road([cell(1,0)]);
  no(check('road',I.MOVE,src,dst,{}),'ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID');
  no(check('road',I.MOVE,src,dst,{translateX:0.25}),'ROADFENCE_OPERATION_TRANSFORM_INVALID');
  no(check('road',I.MOVE,src,dst,{translateX:1,unverifiedNative:true}),'ROADFENCE_OPERATION_TRANSFORM_UNRECOGNIZED_FIELD');
});
test('QAC919 wrong Switch BID/TID/schema/version and Steam family are rejected',()=>{
  const old=road([cell(1,1)]),next=road([cell(1,1),cell(2,1)]);
  const bad=[
    {bid:'9A239D3DB569756D'}, {bid:'BAD'}, {tid:'0100D39012C1A001'},
    {profileSchema:626}, {profileSchema:625}, {gameVersion:'1.25.3'},
    {platform:'SteamWindows'}, {platform:'Nintendo Steam'}
  ];
  for(const patch of bad){
    no(check('road',I.ADD,old,next,null,{...BUILD_V125_SWITCH,...patch}),
       'ROADFENCE_UNSUPPORTED_BUILD_IDENTITY');
  }
});
test('QAC919 Family crossover, foreign kind, invalid diagonals, unknown intent deny',()=>{
  const old=road([cell(0,0)]),next=road([cell(0,0),cell(1,0)]);
  no(check('road',I.ADD,old,road(next.cells,40100038)),'ROADFENCE_OPERATION_FAMILY_CHANGED');
  // Wrong-kind object must fail closed; reject code may be set after an empty normalized graph.
  const foreign=check('fence',I.ADD,old,next);
  locked(foreign);assert.equal(foreign.status,'FAIL_CLOSED');
  no(check('road','MINTED_WRITER',old,next),'ROADFENCE_OPERATION_INTENT_UNKNOWN');
  const bad=fence([node('d1',0,0,D),node('d2',1,0,D)], [edge('d1','d2')]);
  const empty=fence([node('d1',0,0,D),node('d2',1,0,D)],[]);
  no(check('fence',I.CONNECT,empty,bad),'ROADFENCE_OPERATION_TOPOLOGY_INVALID');
});
test('QAC919 RECOMPILE may only keep exact topology and cannot grant Native regen',()=>{
  const old=road([cell(0,0),cell(1,0)]);
  yes(check('road',I.RECOMPILE,old,old));
  no(check('road',I.RECOMPILE,old,road([cell(0,0)])),
     'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
});
