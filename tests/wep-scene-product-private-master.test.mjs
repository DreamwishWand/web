import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearScenePresetPublication,
  getScenePresetPrivateMaster,
  markScenePresetUnpublished,
  recordScenePresetPublication,
  saveScenePresetPrivateMaster
} from '../src/lib/wep/scene-preset-private-master.ts';
import {
  createScenePresetHandoff,
  normalizeWorldEditorHandoff
} from '../src/lib/wep/world-editor-handoff.ts';
import {
  preflightScene,
  validatePublishablePreset
} from '../src/lib/wep/scene-preset-runtime.ts';
import { preflightScenePresetDestinationV125 } from '../src/lib/wep/scene-preset-destination-preflight.ts';

class MemoryStorage {
  #map=new Map();
  getItem(key){return this.#map.has(key)?this.#map.get(key):null;}
  setItem(key,value){this.#map.set(key,String(value));}
  removeItem(key){this.#map.delete(key);}
}

const artifact={
  schema:'dreamwish-wand-preset',
  artifactVersion:1,
  type:'scene',
  source:{
    platform:'Nintendo Switch',
    gameVersion:'1.25.0',
    exactBuildKnown:true,
    buildIdentity:'52BD625D9B4E0053',
    profileSchemaVersion:624
  },
  bounds:{w:4,h:3},
  originPolicy:'capture-region-top-left',
  objects:[{
    artifactObjectId:'o0',
    itemId:40000049,
    layer:'furniture',
    localX:0,
    localY:0,
    orientation:0,
    footprint:[{x:0,y:0}],
    portableState:null,
    dependencyIds:[]
  }],
  networks:{roads:null,fences:null},
  requirements:{itemQuantities:{40000049:1},roadTopology:false,fenceTopology:false}
};

test('private Scene master survives publication and preserves one master identity across later edits',()=>{
  const storage=new MemoryStorage();
  const first=saveScenePresetPrivateMaster(storage,{
    artifact,
    authoredTitle:'Quiet Plaza',
    now:'2026-10-07T12:00:00.000Z'
  });
  assert.equal(first.presetType,'scene');
  assert.equal(first.publication,null);
  assert.equal(first.publicLifecycle,'none');
  assert.equal(first.changesNotPublished,false);
  assert.equal(first.persistentWriteAuthorized,false);
  assert.equal(first.productApplyAuthorized,false);
  assert.equal(first.directSourceReplacementAuthorized,false);

  const published=recordScenePresetPublication(storage,first.masterId,{
    presetArtifactId:'00000000-0000-4000-8000-000000000001',
    presetRevisionId:'00000000-0000-4000-8000-000000000002',
    workId:'00000000-0000-4000-8000-000000000003',
    workRevisionId:'00000000-0000-4000-8000-000000000004',
    galleryWorkId:'00000000-0000-4000-8000-000000000005',
    galleryWorkRevisionId:'00000000-0000-4000-8000-000000000006',
    checksumSha256:'a'.repeat(64),
    byteSize:321,
    publishedAt:'2026-10-07T12:01:00.000Z'
  },'2026-10-07T12:01:00.000Z');
  assert.equal(published.publicLifecycle,'published');
  assert.equal(published.changesNotPublished,false);

  const changed=structuredClone(artifact);
  changed.objects[0].localX=2;
  const second=saveScenePresetPrivateMaster(storage,{
    artifact:changed,
    masterId:first.masterId,
    authoredTitle:'Quiet Plaza v2',
    now:'2026-10-07T12:02:00.000Z'
  });
  assert.equal(second.masterId,first.masterId);
  assert.equal(second.publication.presetArtifactId,published.publication.presetArtifactId);
  assert.equal(second.publication.presetRevisionId,published.publication.presetRevisionId);
  assert.equal(second.publicLifecycle,'published');
  assert.equal(second.changesNotPublished,true);

  const unpublished=markScenePresetUnpublished(storage,first.masterId,'2026-10-07T12:03:00.000Z');
  assert.equal(unpublished.publicLifecycle,'unpublished');
  assert.equal(unpublished.publication.presetArtifactId,published.publication.presetArtifactId);

  const cleared=clearScenePresetPublication(storage,first.masterId,'2026-10-07T12:04:00.000Z');
  assert.equal(cleared.publicLifecycle,'none');
  assert.equal(cleared.publication,null);
  assert.equal(cleared.artifact.objects[0].localX,2);
  assert.equal(getScenePresetPrivateMaster(storage,first.masterId).artifact.objects[0].localX,2);
});

test('Scene Preset handoff binds exact public revision identity without authorizing persistent Apply',()=>{
  const handoff=createScenePresetHandoff({
    presetArtifactId:'preset-a',
    presetRevisionId:'revision-a',
    checksumSha256:'b'.repeat(64),
    byteSize:999,
    createdAt:'2026-10-07T12:03:00.000Z'
  });
  const normalized=normalizeWorldEditorHandoff(structuredClone(handoff));
  assert.equal(normalized.sourceSurface,'presets');
  assert.equal(normalized.intent,'SCENE_PRESET');
  assert.equal(normalized.presetArtifactId,'preset-a');
  assert.equal(normalized.presetRevisionId,'revision-a');
  assert.equal(normalized.checksumSha256,'b'.repeat(64));
  assert.equal(normalized.byteSize,999);
  assert.equal(normalized.persistentWriteAuthorized,false);
  assert.equal(normalized.productApplyAuthorized,false);
  assert.equal(normalized.directSourceReplacementAuthorized,false);
});

test('Scene schema version mismatch fails closed and preflight never promotes whole-Scene persistent Apply',()=>{
  const unsupported=structuredClone(artifact);
  unsupported.artifactVersion=2;
  const validation=validatePublishablePreset(unsupported);
  assert.equal(validation.ok,false);
  assert.equal(validation.issues.some((issue)=>issue.code==='PRESET_SCHEMA_VERSION_UNSUPPORTED'),true);

  const preflight=preflightScene(artifact,{inventory:{40000049:1}});
  assert.equal(preflight.ok,true);
  assert.equal(preflight.writeReady,false);
  assert.equal(preflight.reason,'CORE_COMMIT_ADAPTER_NOT_BOUND');
});


test('destination preflight binds exact Switch target and native placement without authorizing whole-Scene Apply',()=>{
  const destination={
    target:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      exactBuildKnown:true,
      contractBuildIdentity:'52BD625D9B4E0053',
      sourceBuildIdentity:'52BD625D9B4E0053',
      gridDataPath:'Village_Grid',
      tessellationFactor:1
    },
    objects:[]
  };
  const placementBinding={
    contract:'dreamwish-wand-wep-v125-placement-binding@1',
    classifyEditorCandidates({candidateIds}){
      return {ok:true,issues:[],results:candidateIds.map((editorId)=>({editorId}))};
    }
  };
  const result=preflightScenePresetDestinationV125({
    artifact,
    destinationDocument:destination,
    placementBinding,
    anchor:{x:5,y:7},
    roadFenceTopologySupported:false
  });
  assert.equal(result.ok,true);
  assert.equal(result.writeReady,false);
  assert.equal(result.reason,'WHOLE_SCENE_PERSISTENT_APPLY_NOT_AUTHORIZED');
  assert.equal(result.persistentWriteAuthorized,false);
  assert.equal(result.productApplyAuthorized,false);
  assert.equal(result.directSourceReplacementAuthorized,false);
  assert.deepEqual(result.placements.map((entry)=>[entry.x,entry.y]),[[5,7]]);
});

test('destination preflight returns exact version, placement and topology blockers fail closed',()=>{
  const destination={
    target:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      exactBuildKnown:false,
      contractBuildIdentity:'52BD625D9B4E0053',
      sourceBuildIdentity:null,
      gridDataPath:'Village_Grid',
      tessellationFactor:1
    },
    objects:[]
  };
  const badPlacement={
    contract:'dreamwish-wand-wep-v125-placement-binding@1',
    classifyEditorCandidates(){
      return {ok:false,issues:[{severity:'BLOCK',code:'NATIVE_PLACEMENT_INVALID'}]};
    }
  };
  const withRoad=structuredClone(artifact);
  withRoad.networks.roads={
    schema:'dreamwish-wand-wep-network-capture',
    version:1,
    kind:'roads',
    originPolicy:'capture-region-top-left',
    networks:[{networkId:'r0',familyBaseItemID:40100068,cells:[{x:0,y:0,mode:'orthogonal'}]}],
    normalization:{sourceGridObjectIdsRemoved:true,artifactNetworkIdsLocal:true,partialTopologyFailsClosed:true},
    persistentWriteAuthorized:false
  };
  withRoad.requirements.roadTopology=true;

  const result=preflightScenePresetDestinationV125({
    artifact:withRoad,
    destinationDocument:destination,
    placementBinding:badPlacement,
    roadFenceTopologySupported:false
  });
  const codes=new Set(result.issues.map((issue)=>issue.code));
  assert.equal(result.ok,false);
  assert.equal(codes.has('DESTINATION_VERSION_BUILD_UNSUPPORTED'),true);
  assert.equal(codes.has('ROAD_TOPOLOGY_APPLY_UNAVAILABLE'),true);
  assert.equal(result.writeReady,false);
});


test('destination preflight surfaces native placement blockers from the promoted v1.25 binding',()=>{
  const destination={
    target:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      exactBuildKnown:true,
      contractBuildIdentity:'52BD625D9B4E0053',
      sourceBuildIdentity:'52BD625D9B4E0053',
      gridDataPath:'Village_Grid',
      tessellationFactor:1
    },
    objects:[]
  };
  const placementBinding={
    contract:'dreamwish-wand-wep-v125-placement-binding@1',
    classifyEditorCandidates(){
      return {ok:false,issues:[{severity:'BLOCK',code:'NATIVE_PLACEMENT_INVALID'}]};
    }
  };
  const result=preflightScenePresetDestinationV125({
    artifact,
    destinationDocument:destination,
    placementBinding
  });
  assert.equal(result.ok,false);
  assert.equal(result.issues.some((issue)=>issue.code==='NATIVE_PLACEMENT_INVALID'),true);
  assert.equal(result.writeReady,false);
});
