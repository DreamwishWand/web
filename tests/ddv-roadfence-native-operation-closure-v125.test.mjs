import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRoadFenceNativeRequirementsV125,
  ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT
} from '../src/lib/ddv/core/roadfence/native-operation-closure-v125.js';
import { RoadFenceEditIntent } from '../src/lib/ddv/core/roadfence/operation-intent-v125.js';
import { FenceMode } from '../src/lib/ddv/core/roadfence/logical.js';
import { BUILD_V125_SWITCH } from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

const R = FenceMode.ORTHOGONAL;
function road(xs) {
  return { familyBaseItemID: 40100068,
    cells: xs.map(x => ({x, y:0, mode:R})) };
}
function fence(nodes, edges) {
  return { familyBaseItemID: 40700246, graph: {
    nodes:nodes.map(([id,x,y])=>({id,x,y,mode:R})),
    edges:edges.map(([a,b])=>({a,b}))
  }};
}
function assess(kind,intent,sourceNetwork,desiredNetwork,motion,extra={}) {
  return assessRoadFenceNativeRequirementsV125({
    buildIdentity: BUILD_V125_SWITCH,
    kind,intent,sourceNetwork,desiredNetwork,motion,...extra
  });
}
function bounded(receipt,kind,intent) {
  assert.equal(receipt.contract,ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT);
  assert.equal(receipt.status,'STATIC_REQUIREMENTS_ONLY');
  assert.equal(receipt.kind,kind);
  assert.equal(receipt.operation,intent);
  assert.equal(receipt.operationTier,'B_NATIVE_RECOMPUTE');
  assert.equal(receipt.layoutPolicy,'PRESERVE_EXISTING');
  assert.equal(receipt.targetBuild.profileSchema,624);
  assert.equal(receipt.declaredBuildIsAuthenticated,false);
  assert.equal(receipt.canonicalCompilerMustRunSeparately,true);
  assert.equal(receipt.nativeV3Accepted,false);
  assert.equal(receipt.nativeConsumerAccepted,false);
  assert.equal(receipt.nativeProducerAccepted,false);
  assert.equal(receipt.productWriterAuthorized,false);
  assert.equal(receipt.productApplyAuthorized,false);
  assert.equal(receipt.productEditedCopyAuthorized,false);
  assert.equal(receipt.deviceV4Mandatory,false);
  assert.equal(receipt.nativeInventoryDebitRefund,'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3');
  assert.ok(receipt.requiredEvidence.includes('01E_SAME_BUILD_NATIVE_CONSUMER_INPUT_CALLGRAPH'));
  assert.ok(receipt.requiredEvidence.includes('01E_SAME_BUILD_NATIVE_PRODUCER_OUTPUT_CALLGRAPH'));
}
test('ADD requires topology, allocation and native debit without authorizing Writer',()=>{
  const result=assess('road',RoadFenceEditIntent.ADD,road([0]),road([0,1]));
  bounded(result,'road','ADD');
  assert.equal(result.logicalQuantityDelta,1);
  assert.ok(result.requiredEvidence.includes('NATIVE_QUANTITY_DEBIT_OR_NO_DEBIT_PROOF'));
  assert.equal(result.compilerOperation,'ROAD_SET_TOPOLOGY');
});
test('ERASE retains refund as unknown rather than assuming logical quantity is inventory',()=>{
  const result=assess('road','ERASE',road([0,1]),road([0]));
  bounded(result,'road','ERASE');
  assert.equal(result.logicalQuantityDelta,-1);
  assert.equal(result.logicalQuantityIsNotInventoryDelta,true);
  assert.ok(result.requiredEvidence.includes('NATIVE_QUANTITY_REFUND_OR_NO_REFUND_PROOF'));
});
test('MOVE no quantity change never proves no native recompile',()=>{
  const result=assess('road','MOVE',road([0,1]),road([2,3]),
    {translateX:2,translateY:0});
  bounded(result,'road','MOVE');
  assert.equal(result.logicalQuantityDelta,0);
  assert.equal(result.nativeRecompileRequirement,
    'RECOMPILE_OR_PROVE_NO_NATIVE_DELTA_PER_OPERATION');
  assert.ok(result.requiredEvidence.includes('SOURCE_AND_DESTINATION_NEIGHBOR_RECOMPILE'));
});
test('ROTATE requires Native direction and footprint, not a device-wide gate',()=>{
  const source={familyBaseItemID:40100068,cells:[
    {x:0,y:0,mode:R},{x:1,y:0,mode:R}]};
  const desired={familyBaseItemID:40100068,cells:[
    {x:0,y:0,mode:R},{x:0,y:1,mode:R}]};
  const result=assess('road','ROTATE',source,desired,
    {pivot:{x:0,y:0},rotateQuarterTurns:1});
  bounded(result,'road','ROTATE');
  assert.ok(result.requiredEvidence.includes('EXACT_ROTATED_FOOTPRINT_AND_ORIENTATION'));
});
test('CONNECT and DISCONNECT preserve component change and different Native obligations',()=>{
  const islands=road([0,2]),joined=road([0,1,2]);
  const a=assess('road','CONNECT',islands,joined);
  const b=assess('road','DISCONNECT',joined,islands);
  bounded(a,'road','CONNECT');bounded(b,'road','DISCONNECT');
  assert.equal(a.logicalComponentDelta,-1);
  assert.equal(b.logicalComponentDelta,1);
  assert.ok(a.requiredEvidence.includes('NATIVE_MERGE_VARIATION_QUANTITY_COST_PROOF'));
  assert.ok(b.requiredEvidence.includes('NATIVE_SPLIT_VARIATION_QUANTITY_REFUND_PROOF'));
});
test('Fence edge CONNECT requires Base/Ext/DiagExt/post-layout closure',()=>{
  const nodes=[['a',0,0],['b',1,0]];
  const a=fence(nodes,[]), b=fence(nodes,[['a','b']]);
  const result=assess('fence','CONNECT',a,b);
  bounded(result,'fence','CONNECT');
  assert.equal(result.logicalQuantityDelta,0);
  assert.ok(result.requiredEvidence.includes('FENCE_BASE_EXT_DIAGEXT_CANONICAL_RECOMPILE'));
  assert.ok(result.requiredEvidence.includes('FENCE_POST_LAYOUT_PRESERVE_EXISTING_AND_ANCHOR_BOUNDARY'));
});
test('RECOMPILE with identical logical topology is not Native proof',()=>{
  const r=assess('road','RECOMPILE',road([0,1]),road([0,1]));
  bounded(r,'road','RECOMPILE');
  assert.equal(r.logicalQuantityDelta,0);
  assert.equal(r.nativeRecompileRequirement,
    'EXPLICIT_REQUEST_REQUIRES_NATIVE_RECOMPILE_PROOF');
  assert.equal(r.nativeConsumerProducerRecompute,
    'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3');
});
test('wrong Build, family and forged ADD fail closed',()=>{
  assert.equal(assessRoadFenceNativeRequirementsV125({
    buildIdentity:{...BUILD_V125_SWITCH,bid:'9A239D3DB569756D'},
    kind:'road',intent:'ADD',
    sourceNetwork:road([0]),desiredNetwork:road([0,1])
  }).status,'FAIL_CLOSED');
  assert.equal(assess('road','ADD',road([0,1]),road([0])).status,'FAIL_CLOSED');
  assert.equal(assess('road','ADD',road([0]),{
    ...road([0,1]),familyBaseItemID:40100038
  }).status,'FAIL_CLOSED');
});
test('caller authority spoofing cannot turn static receipt into V3',()=>{
  const r=assess('road','ADD',road([0]),road([0,1]),null,{
    nativeV3Accepted:true,productWriterAuthorized:true,sourceBinding:'CORE_VERIFIED',
    nativeConsumerAccepted:true,inventoryDelta:99
  });
  bounded(r,'road','ADD');
  assert.equal(Object.hasOwn(r,'inventoryDelta'),false);
  assert.equal(r.sourceTopologyAuthenticatedByCore,false);
  assert.equal(r.nativeSavedFieldPath,'UNKNOWN_UNTIL_AUTHENTIC_CORE_SOURCE');
});
test('invalid untrusted input and missing fields reject without mutating source',()=>{
  assert.equal(assessRoadFenceNativeRequirementsV125(null).status,'FAIL_CLOSED');
  assert.equal(assessRoadFenceNativeRequirementsV125([]).status,'FAIL_CLOSED');
  const source=road([0]);
  assert.equal(assess('road','CONNECT',source,source).status,'FAIL_CLOSED');
  assert.deepEqual(source,road([0]));
});
