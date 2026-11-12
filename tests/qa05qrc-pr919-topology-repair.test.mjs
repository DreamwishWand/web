import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {assessRoadFenceEditIntentV125 as assess} from '../src/lib/ddv/core/roadfence/operation-intent-v125.js';
import {createFenceNetwork,FenceMode} from '../src/lib/ddv/core/roadfence/logical.js';
import {BUILD_V125_SWITCH} from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';
const path='src/lib/ddv/core/roadfence/operation-intent-v125.js';
const oldHead='384bbff7f89a4e3e0ae24d6fdca52ed3c93a4aef';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
assert.equal(git('rev-parse',oldHead+':'+path).trim(),'50c856244cbbdc6536293eb3eb96b8d2d96fa3f8');
const url=new URL('../'+path,import.meta.url);
const oldText=git('show',oldHead+':'+path).replace(/from '(\.\/[^']+)'/g,(_,p)=>"from '"+new URL(p,url).href+"'");
const {assessRoadFenceEditIntentV125:old}=await import('data:text/javascript;base64,'+Buffer.from(oldText).toString('base64'));
const R=FenceMode.ORTHOGONAL,D=FenceMode.DIAGONAL;
const n=(id,x,y,mode=R)=>({id,x,y,mode});
const e=(a,b)=>({a,b});
const f=(nodes,edges)=>({familyBaseItemID:40700246,graph:{nodes,edges}});
const road=cells=>({familyBaseItemID:40100068,cells});
const c=(x,y,mode=R)=>({x,y,mode});
const graph=(sep='::')=>{
 const nodes=[n('a',0,0),n('b'+sep+'c',1,0),n('a'+sep+'b',10,0),n('c',11,0)];
 return [f(nodes,[e('a','b'+sep+'c')]),f(nodes,[e('a'+sep+'b','c')])];
};
const call=(fn,kind,intent,sourceNetwork,desiredNetwork,motion=null)=>fn({buildIdentity:BUILD_V125_SWITCH,kind,intent,sourceNetwork,desiredNetwork,motion});
const off=r=>{
 for(const k of ['writerAuthorized','persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125','productApplyAuthorized'])assert.equal(r[k],false,k);
 assert.equal(r.nativeProducerConsumerRecompileV3,'UNKNOWN');
 assert.equal(r.nativeInventoryCostRefund,'UNKNOWN');
 assert.equal(r.wandInventoryDelta,0);
 assert.equal(r.layoutPolicy,'PRESERVE_EXISTING');
 assert.equal(r.sourceBinding,'REQUIRES_CORE_SESSION_TYPED_SOURCE_WITNESS');
 assert.equal(r.compilerSupport,'MUST_RUN_EXISTING_01C_COMPILER_SEPARATELY');
};
const yes=r=>{off(r);assert.equal(r.status,'STATIC_INTENT_VALIDATED_ONLY');return r};
const no=(r,code)=>{off(r);assert.equal(r.status,'FAIL_CLOSED');assert.equal(r.errorCode,code)};
const move=(g,dx,dy)=>f(g.graph.nodes.map(v=>({...v,x:v.x+dx,y:v.y+dy})),g.graph.edges);
const rotate=g=>f(g.graph.nodes.map(v=>({...v,x:-v.y,y:v.x})),g.graph.edges);
const reordered=g=>f([...g.graph.nodes].reverse(),[...g.graph.edges].reverse().map(({a,b})=>e(b,a)));
const counts=(r,v,k)=>{assert.equal(r.sourceComponents,k);assert.equal(r.desiredComponents,k);assert.equal(r.logicalQuantityBefore,v);assert.equal(r.logicalQuantityAfter,v);assert.equal(r.logicalQuantityDelta,0)};
test('QAC919 repair: exact QA928 colon delimiter alias reproduces old defect and rejects fixed',()=>{
 const [a,b]=graph();
 assert.equal(createFenceNetwork(a).ok,true);assert.equal(createFenceNetwork(b).ok,true);
 const bad=yes(call(old,'fence','RECOMPILE',a,b));
 counts(bad,4,3);assert.equal(bad.addedExplicitConnections,1);assert.equal(bad.removedExplicitConnections,1);
 no(call(assess,'fence','RECOMPILE',a,b),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
 no(call(assess,'fence','RECOMPILE',b,a),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
 const good=yes(call(assess,'fence','RECOMPILE',a,a));counts(good,4,3);
 assert.equal(good.addedExplicitConnections,0);assert.equal(good.removedExplicitConnections,0);
});
test('QAC919 repair: exact multi-edge unordered topology, reversed endpoints and distinct tuple strings',()=>{
 const nodes=[n('a',0,0),n('b::c',1,0),n('d"\\\\::e',2,0),n('孤立|::',8,0)];
 const a=f(nodes,[e('a','b::c'),e('b::c','d"\\\\::e')]);
 const b=reordered(a);
 assert.equal(createFenceNetwork(a).ok,true);assert.equal(createFenceNetwork(b).ok,true);
 const out=yes(call(assess,'fence','RECOMPILE',a,b));counts(out,4,2);
 assert.equal(out.addedExplicitConnections,0);assert.equal(out.removedExplicitConnections,0);
 const removed=f(nodes,[e('a','b::c')]);
 no(call(assess,'fence','RECOMPILE',a,removed),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
});
test('QAC919 repair: MOVE old edge alias despite exact translated nodes fails new comparator',()=>{
 const [a,b]=graph();const motion={translateX:3,translateY:-2};
 const actual=move(a,3,-2),fake=move(b,3,-2);
 assert.equal(createFenceNetwork(actual).ok,true);assert.equal(createFenceNetwork(fake).ok,true);
 yes(call(old,'fence','MOVE',a,fake,motion));
 no(call(assess,'fence','MOVE',a,fake,motion),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
 const out=yes(call(assess,'fence','MOVE',a,reordered(actual),motion));counts(out,4,3);
 assert.equal(out.addedExplicitConnections,0);assert.equal(out.removedExplicitConnections,0);
 no(call(assess,'fence','MOVE',a,actual,{translateX:4,translateY:-2}),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
});
test('QAC919 repair: ROTATE old edge alias despite exact rotated nodes fails new comparator',()=>{
 const [a,b]=graph();const motion={pivot:{x:0,y:0},rotateQuarterTurns:1};
 const actual=rotate(a),fake=rotate(b);
 assert.equal(createFenceNetwork(actual).ok,true);assert.equal(createFenceNetwork(fake).ok,true);
 yes(call(old,'fence','ROTATE',a,fake,motion));
 no(call(assess,'fence','ROTATE',a,fake,motion),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
 const out=yes(call(assess,'fence','ROTATE',a,reordered(actual),motion));counts(out,4,3);
 no(call(assess,'fence','ROTATE',a,actual,{pivot:{x:0,y:0},rotateQuarterTurns:2}),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
});
test('QAC919 repair: exact vertex ID coordinate mode and cardinality comparison, not count-only',()=>{
 const [a]=graph();
 const changedId=f(a.graph.nodes.map(v=>v.id==='c'?{...v,id:'new-c'}:v),a.graph.edges);
 const changedCoord=f(a.graph.nodes.map(v=>v.id==='c'?{...v,x:12}:v),a.graph.edges);
 const changedMode=f(a.graph.nodes.map(v=>v.id==='c'?{...v,mode:D}:v),a.graph.edges);
 for(const b of [changedId,changedCoord,changedMode,f([...a.graph.nodes,n('extra',30,0)],a.graph.edges)]){
  assert.equal(createFenceNetwork(b).ok,true);
  no(call(assess,'fence','RECOMPILE',a,b),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
 }
});
test('QAC919 repair: previous pipe ADD lost-edge rejection preserved, genuine ADD and quantity',()=>{
 const [a,b]=graph('|');
 const added=n('spare',20,0);
 const bad=f([...b.graph.nodes,added],b.graph.edges);
 no(call(assess,'fence','ADD',a,bad),'ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
 const good=yes(call(assess,'fence','ADD',a,f([...a.graph.nodes,added],a.graph.edges)));
 assert.equal(good.logicalQuantityBefore,4);assert.equal(good.logicalQuantityAfter,5);
 assert.equal(good.logicalQuantityDelta,1);assert.equal(good.sourceComponents,3);assert.equal(good.desiredComponents,4);
 assert.equal(good.removedExplicitConnections,0);
 no(call(assess,'fence','RECOMPILE',a,b),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
});
test('QAC919 repair: Road comparator reorder, exact movement/rotation and mode-change denial',()=>{
 const a=road([c(0,0),c(1,0),c(5,0)]);
 counts(yes(call(assess,'road','RECOMPILE',a,road([...a.cells].reverse()))),3,2);
 no(call(assess,'road','RECOMPILE',a,road([c(0,0,D),c(1,0),c(5,0)])),'ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
 const moved=road(a.cells.map(v=>({...v,x:v.x+2,y:v.y+3})).reverse());
 counts(yes(call(assess,'road','MOVE',a,moved,{translateX:2,translateY:3})),3,2);
 no(call(assess,'road','MOVE',a,moved,{translateX:2,translateY:4}),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
 const rotated=road(a.cells.map(v=>({...v,x:-v.y,y:v.x})).reverse());
 counts(yes(call(assess,'road','ROTATE',a,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:1})),3,2);
 no(call(assess,'road','ROTATE',a,rotated,{pivot:{x:0,y:0},rotateQuarterTurns:2}),'ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
});
