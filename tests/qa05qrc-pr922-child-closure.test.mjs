import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessRoadFenceNativeRequirementsV125 as assess, ROADFENCE_NATIVE_OPERATION_CLOSURE_CONTRACT as contract} from '../src/lib/ddv/core/roadfence/native-operation-closure-v125.js';
import {assessRoadFenceEditIntentV125 as parent} from '../src/lib/ddv/core/roadfence/operation-intent-v125.js';
import {FenceMode} from '../src/lib/ddv/core/roadfence/logical.js';
import {BUILD_V125_SWITCH as buildIdentity} from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';
const R=FenceMode.ORTHOGONAL;
const road=points=>({familyBaseItemID:40100068,cells:points.map(([x,y])=>({x,y,mode:R}))});
const fence=(nodes,edges)=>({familyBaseItemID:40700246,graph:{nodes:nodes.map(([id,x,y])=>({id,x,y,mode:R})),edges:edges.map(([a,b])=>({a,b}))}});
const n=[['a',0,0],['b',1,0],['c',2,0]];
const common=['CORE_ATTESTED_EXACT_BUILD_AND_SOURCE_SHA','SINGLE_PRODUCT_SESSION_TYPED_GRID_SOURCE_AND_REVISION_CAS','01B_BOUNDS_FOOTPRINT_PARENT_AND_COLLISION','01C_CANONICAL_COMPILER_SUPPORT_AND_NATIVE_DESCRIPTOR_DIFF','01E_SAME_BUILD_NATIVE_CONSUMER_INPUT_CALLGRAPH','01E_SAME_BUILD_NATIVE_PRODUCER_OUTPUT_CALLGRAPH','01E_DEPENDENT_RECALC_NEGATIVE_BRANCH_CLOSURE','01A_ATOMIC_EXACT_DIFF_UNDO_BACKUP_EDITED_COPY_INDEPENDENT_REOPEN','05QR_INDEPENDENT_OPERATION_SCOPE_AND_00CTRL_WRITE_GATE'];
const roadReq=['ROAD_NEIGHBOR_ADJACENCY_AND_MODE_RECOMPILE','ROAD_CELL_ORIENTATION_AND_VARIATION','ROAD_GRID_OBJECT_ALLOCATION_AND_PRESERVED_IDENTITIES'];
const fenceReq=['FENCE_BASE_EXT_DIAGEXT_CANONICAL_RECOMPILE','FENCE_POST_LAYOUT_PRESERVE_EXISTING_AND_ANCHOR_BOUNDARY','FENCE_VARIATION_AND_EXTENSION_KEY','FENCE_GRID_OBJECT_ALLOCATION_AND_PRESERVED_IDENTITIES'];
const opReq={ADD:['SOURCE_AND_DESTINATION_COMPONENT_EXTENT','NATIVE_PLACEMENT_AND_NEIGHBOR_RECOMPILE','NATIVE_QUANTITY_DEBIT_OR_NO_DEBIT_PROOF'],MOVE:['EXACT_OLD_NEW_POSITION_AND_NATIVE_ORIENTATION','SOURCE_AND_DESTINATION_NEIGHBOR_RECOMPILE','MOVE_COST_OR_NO_COST_NATIVE_PROOF'],ROTATE:['EXACT_ROTATED_FOOTPRINT_AND_ORIENTATION','ROTATED_NEIGHBOR_MODE_AND_VARIATION','ROTATION_COST_OR_NO_COST_NATIVE_PROOF'],ERASE:['FULL_AFFECTED_COMPONENT_AND_ID_DELETION','NATIVE_NEIGHBOR_RECOMPILE_AFTER_ERASE','NATIVE_QUANTITY_REFUND_OR_NO_REFUND_PROOF'],CONNECT:['BOTH_OLD_COMPONENTS_AND_NEW_MERGED_COMPONENT','NATIVE_NEW_EDGE_OR_CELL_REPRESENTATION','NATIVE_MERGE_VARIATION_QUANTITY_COST_PROOF'],DISCONNECT:['OLD_COMPONENT_AND_ALL_SPLIT_COMPONENTS','NATIVE_EDGE_OR_CELL_REMOVAL_RECOMPILE','NATIVE_SPLIT_VARIATION_QUANTITY_REFUND_PROOF'],RECOMPILE:['UNCHANGED_LOGICAL_TOPOLOGY_AND_UNCHANGED_FAMILY','EXACT_NATIVE_BEFORE_AFTER_DESCRIPTOR_COMPARISON','NATIVE_RECOMPILE_TRIGGER_IDEMPOTENCE_AND_SIDE_EFFECTS']};
const flags=['nativeConsumerAccepted','nativeProducerAccepted','nativeV3Accepted','productWriterAuthorized','productApplyAuthorized','productEditedCopyAuthorized'];
const cases=[
 ['road','ADD',road([[0,0]]),road([[0,0],[1,0]]),null,1,0],
 ['road','MOVE',road([[0,0],[1,0]]),road([[-2,3],[-1,3]]),{translateX:-2,translateY:3},0,0],
 ['road','ROTATE',road([[0,0],[1,0]]),road([[0,0],[0,-1]]),{pivot:{x:0,y:0},rotateQuarterTurns:-1},0,0],
 ['road','ERASE',road([[0,0],[1,0]]),road([[0,0]]),null,-1,0],
 ['road','CONNECT',road([[0,0],[2,0]]),road([[0,0],[1,0],[2,0]]),null,1,-1],
 ['road','DISCONNECT',road([[0,0],[1,0],[2,0]]),road([[0,0],[2,0]]),null,-1,1],
 ['road','RECOMPILE',road([[0,0],[1,0]]),road([[1,0],[0,0]]),null,0,0],
 ['fence','ADD',fence(n.slice(0,2),[['a','b']]),fence(n,[['a','b'],['b','c']]),null,1,0],
 ['fence','MOVE',fence(n.slice(0,2),[['a','b']]),fence([['a',3,2],['b',4,2]],[['a','b']]),{translateX:3,translateY:2},0,0],
 ['fence','ROTATE',fence(n.slice(0,2),[['a','b']]),fence([['a',0,0],['b',0,1]],[['a','b']]),{pivot:{x:0,y:0},rotateQuarterTurns:1},0,0],
 ['fence','ERASE',fence(n,[['a','b'],['b','c']]),fence(n.slice(0,2),[['a','b']]),null,-1,0],
 ['fence','CONNECT',fence(n,[['a','b']]),fence(n,[['a','b'],['b','c']]),null,0,-1],
 ['fence','DISCONNECT',fence(n,[['a','b'],['b','c']]),fence(n,[['a','b']]),null,0,1],
 ['fence','RECOMPILE',fence(n,[['a','b'],['b','c']]),fence([...n].reverse(),[['c','b'],['b','a']]),null,0,0]
];
function deny(r){assert.equal(r.status,'FAIL_CLOSED');assert.equal(r.readOnly,true);for(const f of flags)assert.equal(r[f],false);assert.equal(r.requiredEvidence,undefined);}
for(const [kind,intent,sourceNetwork,desiredNetwork,motion,q,c] of cases){
 test(kind+' '+intent+' exact obligations and nonauthority',()=>{
  const input={buildIdentity,kind,intent,sourceNetwork,desiredNetwork,motion};
  const before=JSON.stringify(input);const r=assess(input);const p=parent(input);
  assert.equal(r.status,'STATIC_REQUIREMENTS_ONLY');assert.equal(r.contract,contract);assert.equal(r.operation,intent);assert.equal(r.kind,kind);assert.equal(r.operationTier,'B_NATIVE_RECOMPUTE');
  assert.deepEqual(r.requiredEvidence,[...common,...(kind==='road'?roadReq:fenceReq),...opReq[intent]]);
  assert.equal(new Set(r.requiredEvidence).size,r.requiredEvidence.length);
  assert.equal(r.logicalQuantityDelta,q);assert.equal(r.logicalComponentDelta,c);
  assert.equal(r.compilerOperation,p.compilerOperation);assert.equal(r.sourceComponents,p.sourceComponents);assert.equal(r.desiredComponents,p.desiredComponents);
  assert.equal(r.sourceBinding,'REQUIRES_CORE_SESSION_TYPED_SOURCE_WITNESS');assert.equal(r.sourceTopologyAuthenticatedByCore,false);assert.equal(r.declaredBuildIsAuthenticated,false);
  assert.equal(r.layoutPolicy,'PRESERVE_EXISTING');assert.equal(r.canonicalCompilerMustRunSeparately,true);assert.equal(r.logicalQuantityIsNotInventoryDelta,true);
  assert.equal(r.nativeInventoryDebitRefund,'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3');assert.equal(r.nativeConsumerProducerRecompute,'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_V3');assert.equal(r.nativeBaseExtDiagExtVariationDelta,'UNKNOWN_UNTIL_EXACT_COMPILER_AND_NATIVE_V3');assert.equal(r.nativeSavedFieldPath,'UNKNOWN_UNTIL_AUTHENTIC_CORE_SOURCE');
  for(const f of flags)assert.equal(r[f],false);assert.equal(r.deviceV4Mandatory,false);assert.equal(r.readOnly,true);assert.equal(Object.hasOwn(r,'inventoryDelta'),false);
  assert.equal(r.nativeRecompileRequirement,intent==='RECOMPILE'?'EXPLICIT_REQUEST_REQUIRES_NATIVE_RECOMPILE_PROOF':'RECOMPILE_OR_PROVE_NO_NATIVE_DELTA_PER_OPERATION');
  assert.equal(JSON.stringify(input),before);assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.requiredEvidence));assert.ok(Object.isFrozen(r.nextOwner));
 });
}
test('all seven invalid transforms/monotonicity/component intents deny in both domains',()=>{
 for(const [kind,intent,sourceNetwork,desiredNetwork,motion] of cases){
  const d=assess({buildIdentity,kind,intent,sourceNetwork,desiredNetwork:intent==='RECOMPILE'?(kind==='road'?road([[9,9]]):fence([['z',9,9]],[])):sourceNetwork,motion});
  deny(d);
 }
});
test('wrong build/unknown/prototype operation and malformed inputs deny',()=>{
 const x={buildIdentity,kind:'road',intent:'ADD',sourceNetwork:road([[0,0]]),desiredNetwork:road([[0,0],[1,0]])};
 for(const b of [null,{}, {...buildIdentity,bid:'9A239D3DB569756D'}, {...buildIdentity,profileSchema:626}, {...buildIdentity,platform:'SteamWindows'}])deny(assess({...x,buildIdentity:b}));
 for(const v of [null,[],undefined,3,'x',{...x,kind:'__proto__'},{...x,intent:'constructor'},{...x,intent:'toString'},{...x,sourceNetwork:null},{...x,desiredNetwork:{...x.desiredNetwork,familyBaseItemID:40100038}}])deny(assess(v));
});
test('forged proof/getters and receipt reuse cannot authorize',()=>{
 const x={buildIdentity,kind:'road',intent:'ADD',sourceNetwork:road([[0,0]]),desiredNetwork:road([[0,0],[1,0]])};
 const forged={...x,...Object.fromEntries(flags.map(f=>[f,true])),declaredBuildIsAuthenticated:true,sourceTopologyAuthenticatedByCore:true,requiredEvidence:[],sourceBinding:'AUTHENTIC',inventoryDelta:999,layoutPolicy:'REGENERATE'};
 const r=assess(forged);assert.equal(r.status,'STATIC_REQUIREMENTS_ONLY');for(const f of flags)assert.equal(r[f],false);assert.equal(r.layoutPolicy,'PRESERVE_EXISTING');assert.equal(r.requiredEvidence.length,15);assert.equal(r.sourceTopologyAuthenticatedByCore,false);assert.equal(Object.hasOwn(r,'inventoryDelta'),false);
 deny(assess(r));deny(assess({...x,get sourceNetwork(){throw Error('untrusted getter')}}));
});
test('child documentation pins accepted repaired parent, not historical TRUE_RED parent',()=>{
 const doc=readFileSync(new URL('../docs/core/01c-roadfence-operation-native-closure-20261112.md',import.meta.url),'utf8');
 assert.ok(doc.includes('02c5a5d92d8dcdb7ee92e46a64b2a69a36853bcb'),'provenance must pin repaired PR919 Source');
 assert.ok(!/fixed[^\n]*384bbff7f89a4e3e0ae24d6fdca52ed3c93a4aef/i.test(doc),'historical TRUE_RED HEAD must not be called fixed parent');
});
