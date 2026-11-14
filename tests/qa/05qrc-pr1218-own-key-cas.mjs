import assert from 'node:assert/strict';
import { SafeProfileEditSession } from '../../src/lib/ddv/core/save/safe-edit-session.js';
import { PlatformFamily } from '../../src/lib/ddv/core/save/versioning.js';
import { compileRoadMutationV125 } from '../../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import { buildRoadFenceStructuralTransactionPlanV125 as plan, createRoadFenceVerifiedWriteCandidateV125 as candidate } from '../../src/lib/ddv/core/roadfence/persistent-transaction-v125.js';
import { buildRoadFenceStructuralTransactionPlanV125 as oldPlan } from '../../src/lib/ddv/core/roadfence/.qa1218-parent.mjs';
import { FenceMode } from '../../src/lib/ddv/core/roadfence/logical.js';
import { BUILD_V125_SWITCH, makeGrid, makeObject, roadNetwork } from '../helpers/ddv-roadfence-persistent-v125-fixtures.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const codec={contract:'p1g-v0',async loadProfile(input){return {inputType:'plain',jsonText:dec.decode(input),metadata:{version:624}}},parseProfileText(){return {metadata:{version:624}}},async createEncodedProfile(t){return enc.encode(t)},getProfileVersion(m){return m.version}};
const root=grid=>({GameInfo:{Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},Player:{ListInventories:{'40100068':{Amount:5}},Opaque:{keep:'雪'}},World:{GridCollection:{Grids:{'7':grid}},Ambient:{keep:true}},Settings:{Language:'en'}});
const open=async g=>SafeProfileEditSession.open({sourceBytes:enc.encode(JSON.stringify(root(g))),codec,sourcePlatform:PlatformFamily.Switch});
const snap=s=>s.getSnapshot().World.GridCollection.Grids['7'];
const compile=(s,preserve)=>compileRoadMutationV125({buildIdentity:BUILD_V125_SWITCH,sourceGrid:snap(s),sourceObjectIds:[41],desiredNetwork:roadNetwork(40100068,preserve?[{x:0,y:0,mode:FenceMode.ORTHOGONAL},{x:1,y:0,mode:FenceMode.ORTHOGONAL}]:[{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},targetSurfaceValidated:true});
const base=()=>makeObject(41,40100068,0,0);
const own=(obj,k,v)=>Object.defineProperty(obj,k,{value:v,enumerable:true,writable:true,configurable:true});
let oldAccepted=0,denied=0,positive=0;
for(const value of [null,7,'text',[1,2],{Future:{nested:[true,null]}}]){
 const clean=await open(makeGrid([base()],70));const m=compile(clean,false);assert.equal(m.ok,true);
 const modified=base();own(modified,'__proto__',value);const s=await open(makeGrid([modified],70));const before=s.getSnapshot();
 assert.equal(Object.hasOwn(snap(s).Objects['41'],'__proto__'),true);
 assert.doesNotThrow(()=>oldPlan({session:s,mutationSet:m}));oldAccepted++;
 assert.throws(()=>plan({session:s,mutationSet:m}),{code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
 await assert.rejects(candidate({session:s,mutationSet:m}),{code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
 assert.deepEqual(s.getSnapshot(),before);denied++;
}
for(const value of [null,7,'text',[1,2],{Future:{nested:[true,null]}}]){
 const obj=base();obj.Opaque={array:[{Keep:1}],constructor:'data',prototype:'data'};own(obj.Opaque.array[0],'__proto__',value);
 const s=await open(makeGrid([obj],70));const m=compile(s,true);assert.equal(m.ok,true);assert.deepEqual(m.preservedObjectIdentities,[41]);
 const tamper=structuredClone(m);delete tamper.preservedObjects[0].sourceObject.Opaque.array[0]['__proto__'];
 assert.doesNotThrow(()=>oldPlan({session:s,mutationSet:tamper}));oldAccepted++;
 assert.throws(()=>plan({session:s,mutationSet:tamper}),{code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
 await assert.rejects(candidate({session:s,mutationSet:tamper}),{code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});denied++;
 const drift=structuredClone(m);own(drift.preservedObjects[0].sourceObject.Opaque.array[0],'__proto__',{different:true});
 assert.throws(()=>plan({session:s,mutationSet:drift}),{code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});denied++;
 // Same own keys and JSON values but changed key order must be accepted.
 const reorder=structuredClone(m);const old=reorder.preservedObjects[0].sourceObject.Opaque;
 reorder.preservedObjects[0].sourceObject.Opaque={prototype:old.prototype,constructor:old.constructor,array:old.array};
 const out=await candidate({session:s,mutationSet:reorder});assert.equal(out.verification.status,'PASS');assert.equal(out.persistentWriteAuthorized,false);
 const reopened=await SafeProfileEditSession.open({sourceBytes:out.candidate.candidateBytes,codec,sourcePlatform:PlatformFamily.Switch});
 assert.deepEqual(snap(reopened).Objects['41'],obj);assert.deepEqual(reopened.getSnapshot().Player,s.getSnapshot().Player);
 assert.equal(Object.hasOwn(snap(reopened).Objects['41'].Opaque.array[0],'__proto__'),true);positive++;
}
assert.deepEqual([oldAccepted,denied,positive],[10,15,5]);
console.log('QA1218_PARENT_ACCEPTED',oldAccepted,'FIXED_DENIED',denied,'EXACT_REOPEN',positive,'NO_WRITER');
