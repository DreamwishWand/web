import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../../src/lib/ddv/core/save/safe-edit-session.js';
import {
  STRUCTURAL_WRITE_CANDIDATE_CAPABILITY
} from '../../src/lib/ddv/core/save/transaction-foundation.js';
import { PlatformFamily } from '../../src/lib/ddv/core/save/versioning.js';
import {
  RoadFencePersistentOperation,
  compileFenceMutationV125,
  compileRoadMutationV125
} from '../../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import {
  ROADFENCE_STRUCTURAL_ADAPTER_ID,
  ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT,
  buildRoadFenceStructuralTransactionPlanV125,
  createRoadFenceVerifiedWriteCandidateV125
} from '../../src/lib/ddv/core/roadfence/persistent-transaction-v125.js';
import { FenceMode } from '../../src/lib/ddv/core/roadfence/logical.js';
import {
  BUILD_V125_SWITCH,
  applyMutation,
  generatedFenceLayoutRequest,
  lineFence,
  makeGrid,
  makeObject,
  roadNetwork
} from '../helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder();

function readVersion(text){
  try{return JSON.parse(text)?.GameInfo?.Version??624;}catch{return 624;}
}
function codec(){
  return {
    contract:'p1g-v0',
    async loadProfile(input){
      const text=decoder.decode(input);
      return {inputType:'plain',jsonText:text,metadata:{version:readVersion(text)}};
    },
    parseProfileText(text){return {metadata:{version:readVersion(text)}};},
    async createEncodedProfile(text){return encoder.encode(text);},
    getProfileVersion(metadata){return metadata.version;}
  };
}
function profileForGrid(grid){
  return {
    GameInfo:{
      InitialVersion:518,
      Version:624,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      OpaqueMetadata:{keep:'exact'}
    },
    Player:{
      Level:50,
      ListInventories:{
        '40100068':{Amount:7000,Marker:'None'},
        '40700246':{Amount:3131,Marker:'Favorite'},
        '40700268':{Amount:3200,Marker:'None'}
      },
      CollectionSets:{
        '40100068':true,
        '40700246':true,
        '40700268':true
      },
      OpaquePlayer:{keep:['p']}
    },
    World:{
      GridCollection:{Grids:{'7':structuredClone(grid)}},
      OpaqueWorld:{keep:{future:true}}
    },
    Settings:{Language:'en'}
  };
}
async function open(root){
  return SafeProfileEditSession.open({
    sourceBytes:encoder.encode(JSON.stringify(root)),
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
}
function snapshotGrid(session){
  return session.getSnapshot().World.GridCollection.Grids['7'];
}


const opaque={FenceMode:{Diagonal:true,Future:{keep:[1,null,"雪"]}}};
const road=(source,ids)=>compileRoadMutationV125({buildIdentity:BUILD_V125_SWITCH,sourceGrid:source,sourceObjectIds:ids,desiredNetwork:roadNetwork(40100068,[{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},targetSurfaceValidated:true});
const fence=(source,ids)=>compileFenceMutationV125({buildIdentity:BUILD_V125_SWITCH,sourceGrid:source,sourceObjectIds:ids,desiredNetwork:lineFence(3,FenceMode.ORTHOGONAL,40700246),representationLayout:generatedFenceLayoutRequest(),transform:{originSave:{x:20,y:20},pitchX:2,pitchY:2},targetSurfaceValidated:true});
test('causal parent destructive replacement versus fixed guard',()=>{
 const src=makeGrid([makeObject(10,40100068,0,0,'GridOrientation_Down',opaque)],11);
 const before=structuredClone(src),r=road(src,[10]);
 if(process.env.QA1142_PARENT==='1'){assert.equal(r.ok,true,JSON.stringify(r.failClosedReason));assert.deepEqual(r.deletedObjectIdentities,[10]);console.log('QA1142_PARENT_OPAQUE_DELETE_ACCEPTED');}
 else{assert.equal(r.ok,false);assert.equal(r.failClosedReason.code,'ROADFENCE_SOURCE_OBJECT_STATE_REPLACEMENT_UNSUPPORTED');console.log('QA1142_FIXED_CAUSAL_DENIED');}
 assert.deepEqual(src,before);
});
test('fresh Road Fence opaque negatives and legacy known positives',()=>{
 const states=[{FenceMode:{Diagonal:true,Future:{nested:[false,null]}}},{FenceMode:{Diagonal:true},Other:null},{Toggle:{Value:true}},{FenceMode:{}},{FenceMode:{Diagonal:0}},{FenceMode:{Diagonal:[true]}},{FenceMode:null},[],42];
 let n=0;
 for(const [item,compile] of [[40100068,road],[40700246,fence]])for(const state of states){
  const src=makeGrid([makeObject(10,item,0,0,'GridOrientation_Down',state)],11),before=structuredClone(src);
  const r=compile(src,[10]);assert.equal(r.ok,false,JSON.stringify({item,state,r}));assert.equal(r.failClosedReason.code,'ROADFENCE_SOURCE_OBJECT_STATE_REPLACEMENT_UNSUPPORTED');assert.deepEqual(src,before);n++;
 }
 for(const state of [null,{}, {FenceMode:{Diagonal:true}}]){const src=makeGrid([makeObject(10,40100068,0,0,'GridOrientation_Down',state)],11);const r=road(src,[10]);assert.equal(r.ok,true,JSON.stringify(r.failClosedReason));assert.deepEqual(r.deletedObjectIdentities,[10]);assert.deepEqual(r.createdObjectIdentities,[11]);}
 console.log('QA1142_'+n+'_ROAD_FENCE_DENIALS_3_LEGACY_POS');
});
test('binding opaque matching source and forged created denied; unrelated raw retained through independent reopen',async()=>{
 const unrelated=makeObject(77,40000001,60,60,'GridOrientation_Down',{Future:{keep:[1,null,"雪"]}},{Opaque:{exact:true}});
 const source=makeGrid([makeObject(10,40100068,0,0),unrelated],100);
 const s=await open(profileForGrid(source)),plan=road(snapshotGrid(s),[10]);assert.equal(plan.ok,true);
 const before=structuredClone(s.getSnapshot());
 for(const state of [opaque,{FenceMode:{Diagonal:true},Future:null},{Toggle:{Value:0}}, {FenceMode:{Diagonal:false}}]){
  const c=structuredClone(plan);c.createdObjects[0].object.State=state;
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session:s,mutationSet:c}),{code:'ROADFENCE_TX_CREATED_OBJECT_STATE_UNSUPPORTED'});
  const d=structuredClone(plan);d.deletedObjects[0].sourceObject.State=state;
  const matching=structuredClone(source);matching.Objects['10'].State=state;
  const session=await open(profileForGrid(matching));const snap=structuredClone(session.getSnapshot());
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session,mutationSet:d}),{code:'ROADFENCE_TX_DELETED_OBJECT_STATE_UNSUPPORTED'});
  assert.deepEqual(session.getSnapshot(),snap);
 }
 assert.deepEqual(s.getSnapshot(),before);
 const bound=await createRoadFenceVerifiedWriteCandidateV125({session:s,mutationSet:plan,planId:'qa1142-unrelated-retained'});
 assert.equal(bound.verification.status,'PASS');assert.equal(bound.persistentWriteAuthorized,false);
 const reopened=await SafeProfileEditSession.open({sourceBytes:bound.candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch});
 assert.deepEqual(snapshotGrid(reopened).Objects['77'],unrelated);assert.deepEqual(reopened.getSnapshot().Player,before.Player);assert.deepEqual(s.getSnapshot(),before);
 console.log('QA1142_BINDING_8NEG_UNRELATED_RAW_REOPEN_PASS');
});
