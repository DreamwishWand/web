import assert from 'node:assert/strict';
import { SafeProfileEditSession } from '../../src/lib/ddv/core/save/safe-edit-session.js';
import { PlatformFamily } from '../../src/lib/ddv/core/save/versioning.js';
import { compileRoadMutationV125 } from '../../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import { buildRoadFenceStructuralTransactionPlanV125 as plan, createRoadFenceVerifiedWriteCandidateV125 as candidate, roadFenceStructuralMutationAdapterV125 as adapter } from '../../src/lib/ddv/core/roadfence/persistent-transaction-v125.js';
import { roadFenceStructuralMutationAdapterV125 as oldAdapter } from '../../src/lib/ddv/core/roadfence/.qa1226-parent.mjs';
import { createVerifiedWriteCandidate } from '../../src/lib/ddv/core/save/transaction-foundation.js';
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

const session=await open(makeGrid([base()],70));const m=compile(session,false);assert.equal(m.ok,true);const p=plan({session,mutationSet:m});const original=session.getSnapshot();
let neg=0,pos=0,old=0;
const check=(f,code)=>{const draft=structuredClone(original),q=structuredClone(p);f(draft,q);const before=structuredClone(draft);assert.throws(()=>adapter.apply(draft,q.intent,q),{code});assert.deepEqual(draft,before);neg++};
for(const mutate of [q=>q.intent.deletedObjects=[],q=>q.intent.createdObjects=[],q=>q.intent.deletedObjects.push(structuredClone(q.intent.deletedObjects[0])),q=>q.intent.createdObjects.push(structuredClone(q.intent.createdObjects[0])),q=>q.intent.createdObjects[0].gridObjectId=71,q=>{q.intent.createdObjects[0].gridObjectId=71;q.intent.createdObjects[0].object.ID=71}]){
 const q=structuredClone(p),d=structuredClone(original);mutate(q);
 try{oldAdapter.apply(d,q.intent,q);old++}catch{}
 const before=structuredClone(original);assert.throws(()=>adapter.apply(before,q.intent,q));assert.deepEqual(before,original);neg++;
}
for(const x of [null,7,'x',[1],{Future:7}]){
 check((d,q)=>{q.intent.createdObjects[0].object.Opaque=x},'ROADFENCE_TX_CREATED_OBJECT_FIELD_UNSUPPORTED');
}
check((d,q)=>{const x={FenceMode:{Diagonal:true,Future:1}};d.World.GridCollection.Grids[7].Objects[41].State=x;q.intent.deletedObjects[0].sourceObject.State=x},'ROADFENCE_TX_DELETED_OBJECT_STATE_UNSUPPORTED');
check((d,q)=>{q.intent.createdObjects[0].object.State={Future:1}},'ROADFENCE_TX_CREATED_OBJECT_STATE_UNSUPPORTED');
check((d,q)=>{d.World.GridCollection.Grids[7].Objects[41].X=8},'ROADFENCE_TX_ADAPTER_DELETE_SOURCE_MISMATCH');
check((d,q)=>{delete q.intent.deletedObjects},'ROADFENCE_TX_MUTATION_SET_INVALID');
const d=structuredClone(original);adapter.apply(d,structuredClone(p.intent),p);assert.equal(d.World.GridCollection.Grids[7].Objects[41],undefined);assert.deepEqual(d.World.GridCollection.Grids[7].Objects[70],p.intent.createdObjects[0].object);assert.equal(d.World.GridCollection.Grids[7].NextGridObjectID,71);assert.deepEqual(d.Player,original.Player);pos++;
const out=await candidate({session,mutationSet:m});assert.equal(out.verification.status,'PASS');pos++;
const preserved=base();preserved.Opaque={nested:[JSON.parse('{"__proto__":{"Future":7},"Keep":true}')]};const ps=await open(makeGrid([preserved],70));const pm=compile(ps,true);const pp=plan({session:ps,mutationSet:pm});const pd=ps.getSnapshot(),pq=structuredClone(pp);pq.intent.preservedObjects=[];assert.throws(()=>adapter.apply(pd,pq.intent,pq),{code:'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH'});assert.deepEqual(pd,ps.getSnapshot());neg++;
const ppout=await candidate({session:ps,mutationSet:pm});assert.equal(ppout.verification.status,'PASS');const reopened=await SafeProfileEditSession.open({sourceBytes:ppout.candidate.candidateBytes,codec,sourcePlatform:PlatformFamily.Switch});assert.deepEqual(snap(reopened).Objects[41],preserved);pos++;
const forged=structuredClone(p);forged.intent.deletedObjects=[];await assert.rejects(createVerifiedWriteCandidate({session,plan:forged,adapter}),{code:'TX_MUTATION_OR_SERIALIZATION_FAILED'});assert.deepEqual(session.getSnapshot(),original);neg++;
console.log('QA1226_ENTRY_BOUNDARY',pos,'POS',neg,'NEG','PARENT_ACCEPTED',old);
// Both target and intent may be coherently forged. The exported adapter must
// not mutate a draft on an inconsistent structural partition/counter/pair.
const defects=[];
for(const [label,mutate] of [
 ['overlap-preserve-delete',q=>{q.target.preservedGridObjectIds=[41];q.intent.target.preservedGridObjectIds=[41];q.intent.preservedObjects=[{gridObjectId:41,sourceObject:structuredClone(q.intent.deletedObjects[0].sourceObject)}]}],
 ['counter-transition',q=>{q.target.nextGridObjectIDAfter=72;q.intent.target.nextGridObjectIDAfter=72}],
 ['noncontiguous-created-id',q=>{q.target.createdGridObjectIds=[71];q.intent.target.createdGridObjectIds=[71];q.intent.createdObjects[0].gridObjectId=71;q.intent.createdObjects[0].object.ID=71}]
]){
 const q=structuredClone(p),draft=structuredClone(original);mutate(q);
 let accepted=false;try{adapter.apply(draft,q.intent,q);accepted=true}catch(e){assert.deepEqual(draft,original);console.log('QA1226_COHERENT_FORGE_DENIED',label,e.code)}
 if(accepted){assert.notDeepEqual(draft,original);defects.push(label);console.log('QA1226_DIRECT_ADAPTER_COUNTEREXAMPLE',label,JSON.stringify({next:draft.World.GridCollection.Grids[7].NextGridObjectID,ids:Object.keys(draft.World.GridCollection.Grids[7].Objects)}))}
 let fullAccepted=false;try{await createVerifiedWriteCandidate({session,plan:q,adapter});fullAccepted=true}catch(e){console.log('QA1226_FULL_CANDIDATE_DENIED',label,e.code)}
 assert.equal(fullAccepted,false);console.log('QA1226_FULL_CANDIDATE_ACCEPTED',label,fullAccepted);assert.deepEqual(session.getSnapshot(),original);
}
assert.equal(defects.length,0,'QA1226_TRUE_RED_DIRECT_ADAPTER_COHERENT_TARGET_FORGE '+defects.join(','));
