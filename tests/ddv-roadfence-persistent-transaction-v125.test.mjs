import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  STRUCTURAL_WRITE_CANDIDATE_CAPABILITY
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
  createRoadFenceVerifiedWriteCandidateV125
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
