import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectW1SceneAreaReferences,W1_SCENE_AREA_SOURCE
} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
import {
  read626SpatialReferences
} from '../src/lib/wep/real-save-spatial-source.ts';
import {
  inspectW1WetlandGridCandidates
} from '../src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs';
import {
  W1_SOURCE_TARGET
} from '../src/lib/ddv/timing/w1-native-v3-source-evidence.mjs';
import {
  createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES
} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';

// New-main composition ONLY. PR480/QA497 dual-map source standalone,
// PR488/QA492 Spatial and main W1 Worker ancestors are independently accepted.
const SHA='d'.repeat(64);
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:SHA,sourceRevision:'composed-main24a-epoch-1'};
const rawObject=(id,itemId=31700014)=>({
  ID:id,ItemID:itemId,X:3,Y:5,Orientation:'GridOrientation_Up',State:null
});
function fixture(){
  return {GameInfo:{Version:626},World:{
    Villages:[
      {SceneItemId:1540000000,Areas:{
        '1':{Unlocked:true,GridIDs:[100]},
        '7':{Unlocked:false,GridIDs:[101]}
      }},
      {SceneItemId:1540000001,Areas:{'2':{Unlocked:true,GridIDs:[102]}}}
    ],
    GridCollection:{
      Grids:{
        '100':{ID:100,GridDataPath:'GridData/synthetic100',
          TessellationFactor:2,Objects:{'7':rawObject(7)}},
        '101':{ID:101,GridDataPath:'GridData/synthetic101',
          TessellationFactor:2,Objects:{'8':rawObject(8,31700015)}}
      },
      DiffGrids:{
        '102':{ID:102,GridDefaultLayoutPath:'GridData/synthetic102'}
      }
    }
  }};
}
const clockAndWriterOff=x=>{
  for(const key of ['productWriterAuthorized','productEditedCopyAuthorized'])
    assert.equal(x[key],false,key);
};

test('current main Source registry and spatial projector join added SceneID bridge by references only',()=>{
  const p=fixture(),scene=inspectW1SceneAreaReferences(p,ctx);
  assert.equal(scene.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(scene.sceneId,1540000000);
  assert.equal(W1_SOURCE_TARGET.eventId,2010000021);
  assert.equal(W1_SCENE_AREA_SOURCE.sourceEventId,W1_SOURCE_TARGET.eventId);
  assert.equal(scene.villageIndex,0);
  assert.deepEqual(scene.sourceCandidates.map(a=>a.saveAreaKey),['1','7']);
  assert.deepEqual(scene.sourceCandidates.map(a=>a.sourceGridRefs[0].gridId),[100,101]);
  const spatial=read626SpatialReferences(p,ctx);
  assert.equal(spatial.status,'REFERENCE_ERRORS_FAIL_CLOSED',
    'different Village has DiffOnly default but cannot grant native effect');
  assert.equal(spatial.nativePlacementVerified,false);
  const wetland=inspectW1WetlandGridCandidates(spatial,ctx);
  assert.equal(wetland.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
  assert.ok(wetland.candidates.some(c=>c.address==='v0:a1' && c.referencedGridIds.includes(100)));
  assert.equal(scene.selectedNativeWetlandAreaKey,null);
  assert.equal(wetland.selectedNativeWetlandArea,null);
  assert.equal(wetland.actualNativeQuota,null);
  assert.equal(scene.actualWetlandAreaVerified,false);
  assert.equal(wetland.nativeAreaMappingVerified,false);
  assert.equal(wetland.nativeRuntimeVerified,false);
  clockAndWriterOff(scene);clockAndWriterOff(wetland);
});

test('main composed spatial and new Scene helper preserve overlapping DiffGrid provenance and lack of Native permission',()=>{
  const p=fixture();p.World.GridCollection.DiffGrids['100']={
    ID:100,ModifiedObjects:{},RemovedObjects:{}};
  const scene=inspectW1SceneAreaReferences(p,ctx);
  assert.equal(scene.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(scene.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  const spatial=read626SpatialReferences(p,ctx);
  assert.equal(spatial.status,'REFERENCE_ERRORS_FAIL_CLOSED');
  assert.ok(spatial.issues.some(i=>i.code==='SPATIAL_GRID_DIFF_OVERLAP_UNRESOLVED'));
  const wetland=inspectW1WetlandGridCandidates(spatial,ctx);
  assert.ok(wetland.riskCodes.includes('SPATIAL_GRID_DIFF_OVERLAP_UNRESOLVED'));
  assert.equal(scene.nativeEffectiveGridVerified,false);
  assert.equal(wetland.nativeAreaMappingVerified,false);
  clockAndWriterOff(scene);clockAndWriterOff(wetland);
});

test('new composite rejects diverging two map ID witnesses in Source Scene and current-main 626 spatial',()=>{
  const p=fixture();p.World.GridCollection.DiffGrids['100']={ID:999,ModifiedObjects:{}};
  const scene=inspectW1SceneAreaReferences(p,ctx);
  assert.equal(scene.status,'SOURCE_STRUCTURE_REJECTED');
  assert.equal(scene.reason,'SOURCE_GRID_MAP_ID_MISMATCH');
  assert.throws(()=>read626SpatialReferences(p,ctx),/SPATIAL_DIFF_GRID_ID_MISMATCH/);
  clockAndWriterOff(scene);
  assert.equal(scene.inputAuthenticatedByThisReader,false);
});

test('external BID/schema mismatches and inconsistent Source provenance never cross-read into accepted Native or writer evidence',()=>{
  const p=fixture();
  for(const fake of [
    {...ctx,bid:'52BD625D9B4E0053'},
    {...ctx,schema:624},
    {...ctx,sourceRevision:''},
    {...ctx,sourceSha256:'forged'}
  ]){
    assert.equal(inspectW1SceneAreaReferences(p,fake).status,'SOURCE_STRUCTURE_REJECTED');
  }
  const spatial=read626SpatialReferences(p,ctx);
  for(const fake of [{...ctx,sourceRevision:'stale'},
    {...ctx,sourceSha256:'e'.repeat(64)}]){
    const wetland=inspectW1WetlandGridCandidates(spatial,fake);
    assert.equal(wetland.status,'SOURCE_REFERENCE_UNAVAILABLE');
    clockAndWriterOff(wetland);
  }
  assert.equal(inspectW1SceneAreaReferences(p,{...ctx,productWriterAuthorized:true}).productWriterAuthorized,false);
});

test('merged main Single Worker retains W1 timing only and does not receive 626 Scene or World Writer from PR509',()=>{
  const bridge=createLocalSaveSessionBridge(()=>{throw Error('NO_SOURCE_FILE_SELECTED')});
  const capabilities=bridge.getCapabilities();
  assert.equal(capabilities.readW1RecurringEvents,true);
  for(const key of ['readInventory','readOwnership','readGrid','readCompleteAllDomains',
    'nativeSemanticsW1Verified','sourceCoreWriterAccepted','canCommit',
    'canEncodeEditedCopy','canApply','canReplaceOriginal'])
    assert.equal(capabilities[key],false,key);
  assert.equal(capabilities.maxCiphertextBytes,LOCAL_MAX_P1G_BYTES);
  assert.equal(LOCAL_MAX_P1G_BYTES,128*1024*1024);
  const original=fixture(),before=JSON.stringify(original);
  const scene=inspectW1SceneAreaReferences(original,ctx);
  assert.equal(JSON.stringify(original),before,'source-only observer must not edit or auto-repair 2126');
  assert.equal(scene.productWriterAuthorized,false);
});
