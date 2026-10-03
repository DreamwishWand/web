import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RoadFencePersistentOperation,
  compileFenceMutationV125
} from '../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../src/lib/ddv/core/roadfence/catalog-v125-switch.js';
import {
  readRoadFenceNativeGridV125
} from '../src/lib/ddv/core/roadfence/native-reader-v125.js';
import {
  createFencePostLayoutDraft,
  moveFencePost
} from '../src/lib/wep/fence-post-edit-contract.ts';
import {
  ROADFENCE_BINDING_ID,
  ROADFENCE_VERIFIED_EXPORT_CONTRACT,
  analyzeRoadFenceVerifiedDraft,
  commitRoadFenceVerifiedExport,
  reviewRoadFenceVerifiedExport
} from '../src/lib/wep/roadfence-verified-export-v125.ts';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';
import {
  BUILD_V125_SWITCH,
  applyMutation,
  generatedFenceLayoutRequest,
  lineFence,
  makeGrid,
  makeObject
} from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

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
        '40700246':{Amount:3131,Marker:'Favorite'}
      },
      CollectionSets:{
        '40100068':true,
        '40700246':true
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
function opened(profile){
  return {
    inputFormat:'packaged',
    saveIdentity:{sourcePlatform:'switch'},
    compatibility:{gameVersion:'1.25.0'},
    profileSchemaVersion:624,
    profile:structuredClone(profile)
  };
}
function container(kind,networkList,layouts={}){
  return {
    schema:'dreamwish-wand-wep-roadfence-logical-root-draft',
    version:1,
    kind,
    originPolicy:'native-logical-root',
    coordinatePolicy:'per-network-reader-coordinate-space',
    networks:structuredClone(networkList),
    ...(kind==='fences'?{
      representationLayouts:structuredClone(layouts),
      representationLayoutModified:{}
    }:{}),
    normalization:{
      sourceGridObjectIdsRemoved:true,
      sourceReaderProvenanceRemoved:true,
      logicalCoordinatesPreserved:true,
      coordinateSpacePreserved:true,
      partialTopologyFailsClosed:true
    },
    persistentWriteAuthorized:false
  };
}
function documentFromReader(reader,layouts={}){
  return {
    schema:'dreamwish-wand-editor-document',
    version:1,
    target:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      rootGridId:7
    },
    metadata:{
      rootGridBounds:{
        status:'AUTHORITATIVE_GRIDDATAPATH',
        x:0,y:0,w:200,h:200
      }
    },
    capabilities:{},
    objects:[],
    networks:{
      roads:container('roads',reader.roads),
      fences:container('fences',reader.fences,layouts)
    }
  };
}
function readerFor(grid){
  const reader=readRoadFenceNativeGridV125({
    grid,gridId:7,catalog:ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  assert.equal(reader.ok,true);
  return reader;
}
async function expectCode(promise,code){
  await assert.rejects(promise,error=>{
    assert.equal(error.code,code,error?.stack??String(error));
    return true;
  });
}

test('WEP Road edit reaches promoted structural candidate, export bundle, and native-reader reload without mutating source',async()=>{
  const sourceObject=makeObject(
    10,40100068,0,0,'GridOrientation_Down',null,
    {Opaque:{preserve:'road-source'}}
  );
  const grid=makeGrid([sourceObject],11);
  const profile=profileForGrid(grid);
  const reader=readerFor(grid);
  assert.equal(reader.roads.length,1);

  const baseline=documentFromReader(reader);
  const draft=structuredClone(baseline);
  draft.networks.roads.networks[0].cells.push({
    x:1,y:0,mode:'orthogonal'
  });

  const sourceBytes=makeSyntheticP1gProfile(profile);
  const review=await reviewRoadFenceVerifiedExport({
    sourceBytes,
    sourceName:'profile',
    sourceEpoch:1,
    opened:opened(profile),
    baselineDocument:baseline,
    draftDocument:draft,
    exactBuildConfirmed:true
  });
  assert.equal(review.contract,ROADFENCE_VERIFIED_EXPORT_CONTRACT);
  assert.equal(review.bindingId,ROADFENCE_BINDING_ID);
  assert.equal(review.analysis.kind,'road');
  assert.equal(review.analysis.operation,RoadFencePersistentOperation.ROAD_SET_TOPOLOGY);
  assert.equal(review.analysis.mutationSet.ok,true);
  assert.deepEqual(review.analysis.sourceObjectIds,[10]);
  assert.equal(review.persistentWriteAuthorized,false);

  const result=await commitRoadFenceVerifiedExport({
    review,
    currentSourceEpoch:1,
    sourceBytes,
    opened:opened(profile),
    baselineDocument:baseline,
    draftDocument:draft
  });
  assert.equal(result.status,'PASS');
  assert.equal(result.verification.status,'PASS');
  assert.equal(result.reload.status,'PASS');
  assert.equal(result.reload.networkMatch,true);
  assert.equal(result.source.untouched,true);
  assert.equal(result.directSourceReplacementAuthorized,false);
  assert.ok(result.artifacts.editedSave.bytes.length>0);
  assert.ok(result.artifacts.originalBackup.bytes.length>0);
});

test('WEP Fence post move consumes canonical representationLayout and reaches structural candidate',async()=>{
  const initial=makeGrid([],100);
  const sourceNetwork=lineFence(9,'orthogonal',40700246);
  const sourceCreate=compileFenceMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:initial,
    sourceObjectIds:[],
    desiredNetwork:sourceNetwork,
    representationLayout:generatedFenceLayoutRequest(),
    operation:RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
    transform:{originSave:{x:0,y:0},pitchX:2,pitchY:2},
    targetSurfaceValidated:true
  });
  assert.equal(sourceCreate.ok,true);
  const grid=applyMutation(initial,sourceCreate);
  const profile=profileForGrid(grid);
  const reader=readerFor(grid);
  assert.equal(reader.fences.length,1);
  const network=reader.fences[0];
  const captured=createFencePostLayoutDraft(reader,network.networkId);
  assert.equal(captured.validation.ok,true);
  assert.ok(captured.draft.representationLayout.posts.length>=1);

  const post=captured.draft.representationLayout.posts[0];
  let moved=null;
  for(const node of network.graph.nodes){
    if(String(node.id)===String(post.nodeId)) continue;
    try{
      const candidate=moveFencePost(
        captured.draft,
        String(post.nodeId),
        Number(node.x),
        Number(node.y)
      );
      if(
        candidate.accepted===true &&
        candidate.validation.ok===true &&
        candidate.draft.representationLayout.posts.some(
          entry=>String(entry.nodeId)===String(node.id)
        )
      ){
        moved=candidate;
        break;
      }
    }catch{}
  }
  assert.ok(moved,'expected at least one valid alternate post position');

  const baseline=documentFromReader(reader,{
    [network.networkId]:captured.draft
  });
  const draft=structuredClone(baseline);
  draft.networks.fences.representationLayouts[
    network.networkId
  ]=moved.draft;
  draft.networks.fences.representationLayoutModified[
    network.networkId
  ]=true;

  const analysis=analyzeRoadFenceVerifiedDraft({
    opened:opened(profile),
    baselineDocument:baseline,
    draftDocument:draft
  });
  assert.equal(analysis.kind,'fence');
  assert.equal(
    analysis.operation,
    RoadFencePersistentOperation.FENCE_MOVE_POST
  );
  assert.equal(
    analysis.representationLayout.schema,
    'ddv.fence-representation-layout@1'
  );
  assert.equal(analysis.mutationSet.ok,true);

  const sourceBytes=makeSyntheticP1gProfile(profile);
  const review=await reviewRoadFenceVerifiedExport({
    sourceBytes,
    sourceName:'profile',
    sourceEpoch:5,
    opened:opened(profile),
    baselineDocument:baseline,
    draftDocument:draft,
    exactBuildConfirmed:true
  });
  const result=await commitRoadFenceVerifiedExport({
    review,
    currentSourceEpoch:5,
    sourceBytes,
    opened:opened(profile),
    baselineDocument:baseline,
    draftDocument:draft
  });
  assert.equal(result.status,'PASS');
  assert.equal(result.verification.status,'PASS');
  assert.equal(result.reload.networkMatch,true);
  assert.equal(result.source.untouched,true);
});

test('Fence topology edit with invalidated representationLayout fails closed',()=>{
  const initial=makeGrid([],100);
  const sourceNetwork=lineFence(3,'orthogonal',40700246);
  const sourceCreate=compileFenceMutationV125({
    buildIdentity:BUILD_V125_SWITCH,
    sourceGrid:initial,
    sourceObjectIds:[],
    desiredNetwork:sourceNetwork,
    representationLayout:generatedFenceLayoutRequest(),
    operation:RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
    transform:{originSave:{x:0,y:0},pitchX:2,pitchY:2},
    targetSurfaceValidated:true
  });
  const grid=applyMutation(initial,sourceCreate);
  const profile=profileForGrid(grid);
  const reader=readerFor(grid);
  const network=reader.fences[0];
  const captured=createFencePostLayoutDraft(reader,network.networkId);
  const baseline=documentFromReader(reader,{
    [network.networkId]:captured.draft
  });
  const draft=structuredClone(baseline);
  draft.networks.fences.networks[0].graph.nodes.push({
    id:'extra',x:3,y:0,mode:'orthogonal'
  });
  draft.networks.fences.networks[0].graph.edges.push({
    a:network.graph.nodes.at(-1).id,b:'extra'
  });
  delete draft.networks.fences.representationLayouts[
    network.networkId
  ];
  draft.networks.fences.representationLayoutInvalidated={
    [network.networkId]:true
  };

  assert.throws(
    ()=>analyzeRoadFenceVerifiedDraft({
      opened:opened(profile),
      baselineDocument:baseline,
      draftDocument:draft
    }),
    error=>{
      assert.equal(error.code,'WEP_ROADFENCE_FENCE_LAYOUT_INVALIDATED');
      return true;
    }
  );
});

test('Road/Fence verified export source has no direct source replacement or persistent commit executor',async()=>{
  const source=await readFile(
    new URL('../src/lib/wep/roadfence-verified-export-v125.ts',import.meta.url),
    'utf8'
  );
  for(const required of [
    'compileRoadMutationV125',
    'compileFenceMutationV125',
    'createRoadFenceVerifiedWriteCandidateV125',
    'createVerifiedCandidateExportBundle',
    'WEP_ROADFENCE_EXACT_BUILD_CONFIRMATION_REQUIRED',
    'WEP_ROADFENCE_FENCE_LAYOUT_INVALIDATED',
    'persistentWriteAuthorized:false',
    'directSourceReplacementAuthorized:false'
  ]) assert.ok(source.includes(required),required);
  assert.ok(!source.includes('executePersistentCommit('));
  assert.ok(!source.includes('targetPath'));
});
