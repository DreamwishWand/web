import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  STRUCTURAL_WRITE_CANDIDATE_CAPABILITY,
  createVerifiedWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import { PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  RoadFencePersistentOperation,
  compileFenceMutationV125,
  compileRoadMutationV125
} from '../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import {
  ROADFENCE_STRUCTURAL_ADAPTER_ID,
  ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT,
  buildRoadFenceStructuralTransactionPlanV125,
  createRoadFenceVerifiedWriteCandidateV125,
  roadFenceStructuralMutationAdapterV125
} from '../src/lib/ddv/core/roadfence/persistent-transaction-v125.js';
import { FenceMode } from '../src/lib/ddv/core/roadfence/logical.js';
import {
  BUILD_V125_SWITCH,
  applyMutation,
  generatedFenceLayoutRequest,
  lineFence,
  makeGrid,
  makeObject,
  roadNetwork
} from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

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

test('Road compiler mutation set binds to 01A structural candidate and independently verifies',async()=>{
  const unrelated=makeObject(
    77,40000001,60,60,'GridOrientation_Down',null,
    {Opaque:{preserve:'exact'}}
  );
  const root=profileForGrid(makeGrid([unrelated],100));
  const session=await open(root);
  const desired=roadNetwork(40100068,[
    {x:0,y:0,mode:FenceMode.ORTHOGONAL},
    {x:1,y:0,mode:FenceMode.ORTHOGONAL},
    {x:2,y:0,mode:FenceMode.ORTHOGONAL}
  ]);
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:snapshotGrid(session),
    sourceObjectIds:[],
    desiredNetwork:desired,
    operation:RoadFencePersistentOperation.ROAD_SET_TOPOLOGY,
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},
    targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  assert.equal(
    mutationSet.structuralTransactionDependency.current01aWriteCandidateCompatible,
    true
  );

  const bound=await createRoadFenceVerifiedWriteCandidateV125({
    session,mutationSet,planId:'road-candidate-e2e'
  });
  assert.equal(bound.contract,ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT);
  assert.equal(bound.plan.capabilityRequired,STRUCTURAL_WRITE_CANDIDATE_CAPABILITY);
  assert.equal(bound.plan.mutationAdapter.id,ROADFENCE_STRUCTURAL_ADAPTER_ID);
  assert.equal(bound.verification.status,'PASS');
  assert.equal(bound.candidate.manifest.capability.persistentWrite,false);
  assert.equal(bound.persistentWriteAuthorized,false);

  const reopened=await SafeProfileEditSession.open({
    sourceBytes:bound.candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const snap=reopened.getSnapshot();
  const grid=snap.World.GridCollection.Grids['7'];
  assert.equal(grid.NextGridObjectID,103);
  assert.deepEqual(Object.keys(grid.Objects).sort(),['100','101','102','77']);
  assert.deepEqual(grid.Objects['77'],unrelated);
  assert.deepEqual(snap.Player,root.Player);
  assert.deepEqual(snap.World.OpaqueWorld,root.World.OpaqueWorld);
});

test('Fence FRP01-style replacement binds delete/create lifecycle without inventory mutation',async()=>{
  const sourceNetwork=lineFence(3,FenceMode.ORTHOGONAL,40700246);
  const sourceCreate=compileFenceMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:makeGrid([],100),
    sourceObjectIds:[],
    desiredNetwork:sourceNetwork,
    representationLayout:generatedFenceLayoutRequest(),
    operation:RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
    transform:{originSave:{x:20,y:20},pitchX:2,pitchY:2},
    targetSurfaceValidated:true
  });
  assert.equal(sourceCreate.ok,true);
  assert.equal(sourceCreate.createdObjectIdentities.length,3);
  const sourceGrid=applyMutation(makeGrid([],100),sourceCreate);
  const root=profileForGrid(sourceGrid);
  const session=await open(root);

  const desiredNetwork=lineFence(3,FenceMode.ORTHOGONAL,40700268);
  const mutationSet=compileFenceMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:snapshotGrid(session),
    sourceObjectIds:[...sourceCreate.createdObjectIdentities],
    sourceNetwork,
    desiredNetwork,
    representationLayout:generatedFenceLayoutRequest(),
    operation:RoadFencePersistentOperation.FENCE_STYLE_REPLACE,
    transform:{originSave:{x:20,y:20},pitchX:2,pitchY:2},
    targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  assert.equal(mutationSet.deletedObjectIdentities.length,3);
  assert.equal(mutationSet.createdObjectIdentities.length,3);
  assert.equal(mutationSet.nextGridObjectID.before,103);
  assert.equal(mutationSet.nextGridObjectID.after,106);

  const beforePlayer=structuredClone(session.getSnapshot().Player);
  const bound=await createRoadFenceVerifiedWriteCandidateV125({
    session,mutationSet,planId:'fence-frp01-candidate-e2e'
  });
  assert.equal(bound.verification.status,'PASS');

  const reopened=await SafeProfileEditSession.open({
    sourceBytes:bound.candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const snap=reopened.getSnapshot();
  assert.deepEqual(snap.Player,beforePlayer);
  const objects=snap.World.GridCollection.Grids['7'].Objects;
  for(const id of mutationSet.deletedObjectIdentities){
    assert.equal(objects[String(id)],undefined);
  }
  for(const id of mutationSet.createdObjectIdentities){
    assert.equal(objects[String(id)].ID,id);
  }
  assert.equal(snap.World.GridCollection.Grids['7'].NextGridObjectID,106);
});

test('binding rejects mutation-set path tamper before candidate creation',async()=>{
  const session=await open(profileForGrid(makeGrid([],100)));
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:snapshotGrid(session),
    desiredNetwork:roadNetwork(40100068,[
      {x:0,y:0,mode:FenceMode.ORTHOGONAL}
    ]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},
    targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  const tampered=structuredClone(mutationSet);
  tampered.allowedSemanticPaths.push('/Player/Level');
  assert.throws(
    ()=>buildRoadFenceStructuralTransactionPlanV125({
      session,mutationSet:tampered
    }),
    error=>{
      assert.equal(error.code,'ROADFENCE_TX_ALLOWED_PATHS_MISMATCH');
      return true;
    }
  );
});

test('binding rejects created-object tamper and source drift',async()=>{
  const session=await open(profileForGrid(makeGrid([],100)));
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:snapshotGrid(session),
    desiredNetwork:roadNetwork(40100068,[
      {x:0,y:0,mode:FenceMode.ORTHOGONAL}
    ]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},
    targetSurfaceValidated:true
  });
  const createdTamper=structuredClone(mutationSet);
  createdTamper.createdObjects[0].object.ID=999;
  assert.throws(
    ()=>buildRoadFenceStructuralTransactionPlanV125({
      session,mutationSet:createdTamper
    }),
    error=>{
      assert.equal(error.code,'ROADFENCE_TX_CREATED_OBJECT_ID_MISMATCH');
      return true;
    }
  );

  const driftedRoot=profileForGrid(makeGrid([],101));
  const drifted=await open(driftedRoot);
  assert.throws(
    ()=>buildRoadFenceStructuralTransactionPlanV125({
      session:drifted,mutationSet
    }),
    error=>{
      assert.equal(error.code,'ROADFENCE_TX_SOURCE_NEXT_MISMATCH');
      return true;
    }
  );
});

test('binding machine contract closes 01C-to-01A engineering gap but not persistent Apply',async()=>{
  const artifact=JSON.parse(await readFile(
    new URL('../static/ddv/core/roadfence/v1.25/persistent-transaction-binding-v125.json',import.meta.url),
    'utf8'
  ));
  assert.equal(artifact.schema,ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT);
  assert.equal(artifact.status,'ENGINEERING_CLOSED');
  assert.equal(artifact.current01aWriteCandidateCompatible,true);
  assert.equal(artifact.persistentWriteAuthorized,false);
  assert.equal(artifact.productApplyAuthorized,false);
});


test('binding rejects opaque State on created and deleted objects, including a matching source snapshot', async()=>{
  const source=makeGrid([makeObject(10,40100068,0,0)],11);
  const session=await open(profileForGrid(source));
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH, sourceGrid:snapshotGrid(session), sourceObjectIds:[10],
    desiredNetwork:roadNetwork(40100068,[{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4}, targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  const opaque={FenceMode:{Diagonal:true,Future:1}};
  const created=structuredClone(mutationSet);
  created.createdObjects[0].object.State=opaque;
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session,mutationSet:created}),
    {code:'ROADFENCE_TX_CREATED_OBJECT_STATE_UNSUPPORTED'});
  const deleted=structuredClone(mutationSet);
  deleted.deletedObjects[0].sourceObject.State=opaque;
  const changed=structuredClone(source);
  changed.Objects['10'].State=opaque;
  const matching=await open(profileForGrid(changed));
  const before=structuredClone(matching.getSnapshot());
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session:matching,mutationSet:deleted}),
    {code:'ROADFENCE_TX_DELETED_OBJECT_STATE_UNSUPPORTED'});
  assert.deepEqual(matching.getSnapshot(),before);
});


test('binding rejects a deleted source with an omitted own __proto__ key',async()=>{
  const clean=makeGrid([makeObject(10,40100068,0,0)],11);
  const source=await open(profileForGrid(clean));
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH, sourceGrid:snapshotGrid(source), sourceObjectIds:[10],
    desiredNetwork:roadNetwork(40100068,[{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4}, targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  const altered=structuredClone(clean);
  Object.defineProperty(altered.Objects['10'],'__proto__',{value:{Future:1},enumerable:true});
  const session=await open(profileForGrid(altered));
  const before=session.getSnapshot();
  assert.equal(Object.hasOwn(before.World.GridCollection.Grids['7'].Objects['10'],'__proto__'),true);
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session,mutationSet}),
    {code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
  await assert.rejects(createRoadFenceVerifiedWriteCandidateV125({session,mutationSet}),
    {code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
  assert.deepEqual(session.getSnapshot(),before);
});

test('binding preserves matching opaque own keys and rejects nested old-value drift',async()=>{
  const original=makeObject(10,40100068,0,0);
  original.Opaque=JSON.parse('{"__proto__":{"Future":1},"Keep":true}');
  const source=await open(profileForGrid(makeGrid([original],11)));
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH, sourceGrid:snapshotGrid(source), sourceObjectIds:[10],
    desiredNetwork:roadNetwork(40100068,[{x:0,y:0,mode:FenceMode.ORTHOGONAL},{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4}, targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  assert.deepEqual(mutationSet.preservedObjectIdentities,[10]);
  const bound=await createRoadFenceVerifiedWriteCandidateV125({session:source,mutationSet});
  assert.equal(bound.verification.status,'PASS');
  const reopened=await open(JSON.parse(decoder.decode(bound.candidate.candidateBytes)));
  assert.deepEqual(snapshotGrid(reopened).Objects['10'],original);
  const tampered=structuredClone(mutationSet);
  tampered.preservedObjects[0].sourceObject.Opaque['__proto__'].Future=2;
  assert.throws(()=>buildRoadFenceStructuralTransactionPlanV125({session:source,mutationSet:tampered}),
    {code:'ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH'});
  assert.deepEqual(snapshotGrid(source).Objects['10'],original);
});


test('direct structural adapter refuses omitted, mismatched and opaque intent entries before mutation',async()=>{
  const original=profileForGrid(makeGrid([makeObject(10,40100068,0,0)],11));
  const session=await open(original);
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH,sourceGrid:snapshotGrid(session),sourceObjectIds:[10],
    desiredNetwork:roadNetwork(40100068,[{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  const plan=buildRoadFenceStructuralTransactionPlanV125({session,mutationSet});
  const adapter=roadFenceStructuralMutationAdapterV125;
  const check=(change,code)=>{
    const draft=structuredClone(original),intent=structuredClone(plan.intent);
    change(draft,intent);
    const before=structuredClone(draft);
    assert.throws(()=>adapter.apply(draft,intent,plan),{code});
    assert.deepEqual(draft,before);
  };
  check((d,i)=>{d.World.GridCollection.Grids['7'].Objects['10'].State={FenceMode:{Diagonal:true,Future:7}};i.deletedObjects=[];},
    'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH');
  check((d,i)=>{const state={FenceMode:{Diagonal:true,Future:7}};d.World.GridCollection.Grids['7'].Objects['10'].State=state;i.deletedObjects[0].sourceObject.State=state;},
    'ROADFENCE_TX_DELETED_OBJECT_STATE_UNSUPPORTED');
  check((d,i)=>{i.createdObjects[0].object.State={Future:7};},'ROADFENCE_TX_CREATED_OBJECT_STATE_UNSUPPORTED');
  check((d,i)=>{i.createdObjects[0].object.Opaque=7;},'ROADFENCE_TX_CREATED_OBJECT_FIELD_UNSUPPORTED');
  check((d,i)=>{i.deletedObjects.push(structuredClone(i.deletedObjects[0]));},'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH');
  check((d,i)=>{i.createdObjects=[];},'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH');
  check((d,i)=>{i.createdObjects[0].gridObjectId=12;i.createdObjects[0].object.ID=12;},'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH');
  check((d,i)=>{delete i.deletedObjects;},'ROADFENCE_TX_MUTATION_SET_INVALID');
  const draft=structuredClone(original);
  adapter.apply(draft,structuredClone(plan.intent),plan);
  assert.equal(draft.World.GridCollection.Grids['7'].Objects['10'],undefined);
  assert.deepEqual(draft.World.GridCollection.Grids['7'].Objects['11'],plan.intent.createdObjects[0].object);
  assert.equal(draft.World.GridCollection.Grids['7'].NextGridObjectID,12);
  assert.deepEqual(draft.Player,original.Player);

  const forged=structuredClone(plan);forged.intent.deletedObjects=[];
  await assert.rejects(createVerifiedWriteCandidate({session,plan:forged,adapter}),
    {code:'TX_MUTATION_OR_SERIALIZATION_FAILED',message:/ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH/});
  assert.deepEqual(session.getSnapshot(),original);
});

test('direct adapter rejects omitted preserved entries and retains exact opaque preserved objects',async()=>{
  const original=makeObject(10,40100068,0,0);
  original.Opaque={Future:7};
  const root=profileForGrid(makeGrid([original],11)),session=await open(root);
  const mutationSet=compileRoadMutationV125({
    buildIdentity:BUILD_V125_SWITCH,sourceGrid:snapshotGrid(session),sourceObjectIds:[10],
    desiredNetwork:roadNetwork(40100068,[{x:0,y:0,mode:FenceMode.ORTHOGONAL},{x:1,y:0,mode:FenceMode.ORTHOGONAL}]),
    transform:{originSave:{x:0,y:0},pitchX:4,pitchY:4},targetSurfaceValidated:true
  });
  assert.equal(mutationSet.ok,true);
  const plan=buildRoadFenceStructuralTransactionPlanV125({session,mutationSet});
  const draft=structuredClone(root),intent=structuredClone(plan.intent);
  intent.preservedObjects=[];
  assert.throws(()=>roadFenceStructuralMutationAdapterV125.apply(draft,intent,plan),
    {code:'ROADFENCE_TX_ADAPTER_INTENT_ENTRY_BINDING_MISMATCH'});
  assert.deepEqual(draft,root);
  roadFenceStructuralMutationAdapterV125.apply(draft,structuredClone(plan.intent),plan);
  assert.deepEqual(draft.World.GridCollection.Grids['7'].Objects['10'],original);
});
