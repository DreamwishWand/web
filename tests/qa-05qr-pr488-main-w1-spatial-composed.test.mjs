import test from 'node:test';
import assert from 'node:assert/strict';
import {
  read626SpatialReferences, inspect626SourceObjectAtRevision, SWITCH_626
} from '../src/lib/wep/real-save-spatial-source.ts';
import {
  inspectW1WetlandGridCandidates, W1_PROBE_BUILD, W1_AREA_GRID_SOURCE_PROBE
} from '../src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs';
import {
  W1_SOURCE_TARGET,W1_NATIVE_STATIC_DEPENDENCIES
} from '../src/lib/ddv/timing/w1-native-v3-source-evidence.mjs';
import {
  createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES
} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';

const SHA='d'.repeat(64);
const ctx={sourceSha256:SHA,sourceRevision:'qa-a043-epoch-1',
  platform:'Nintendo Switch',gameVersion:'1.25.3',schema:626,bid:'9A239D3DB569756D'};
const obj=(id,item=31700014)=>({ID:id,ItemID:item,X:2,Y:3,
  Orientation:'GridOrientation_Up',State:null});
function real626(){
  return {GameInfo:{Version:626},World:{
    Villages:[
      {SceneItemId:1540000001,Areas:{'7':{Unlocked:false,GridIDs:[]}}},
      {SceneItemId:1540000000,Areas:{
        '1':{Unlocked:false,GridIDs:[42,43]},
        '7':{Unlocked:true,GridIDs:[44]}
      }}
    ],
    GridCollection:{
      Grids:{
        '42':{ID:42,GridDataPath:'GridData/Village04/source42.json',TessellationFactor:2,
          Objects:{'7':obj(7),'8':obj(8,31700015)}},
        '44':{ID:44,GridDataPath:'GridData/Village04/source44.json',TessellationFactor:2,
          Objects:{'99':obj(99)}}
      },
      DiffGrids:{'43':{ID:43,GridDefaultLayoutPath:'GridData/Village04/default43.json'}}
    }
  }};
}
function isOff(result){
  for(const k of ['nativeAreaMappingVerified','originalSourceAuthenticated',
    'sourceSessionCasVerified','actualNativeQuotaVerified','nativeRuntimeVerified',
    'productWriterAuthorized','productEditedCopyAuthorized','automaticDateRepairAuthorized'])
    assert.equal(result[k],false,k);
}
const inspect=(index,scope=ctx)=>inspectW1WetlandGridCandidates(index,{
  sourceSha256:scope.sourceSha256,sourceRevision:scope.sourceRevision
});

test('PR488 on current main PR451 Worker + PR469 registry + PR472 626 index: only source candidates, not Wetland',()=>{
  assert.deepEqual(W1_PROBE_BUILD,SWITCH_626);
  assert.equal(W1_SOURCE_TARGET.bid,SWITCH_626.bid);
  assert.equal(W1_SOURCE_TARGET.eventId,2010000021);
  assert.equal(W1_SOURCE_TARGET.itemId,31700014);
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.sceneId,1540000000);
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.villageAreaType,1);
  const index=read626SpatialReferences(real626(),ctx);
  assert.equal(index.contract,'ddv.real-save-spatial-source-read@1');
  assert.equal(index.status,'REFERENCE_ERRORS_FAIL_CLOSED'); // Diff-only default unresolved
  assert.equal(index.geometryFor2d,'NOT_VERIFIED');
  assert.equal(index.persistentWriteAuthorized,false);
  const r=inspect(index);
  assert.equal(r.contract,W1_AREA_GRID_SOURCE_PROBE);
  assert.equal(r.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
  assert.deepEqual(r.candidates.map(x=>x.address),['v1:a1','v1:a7']);
  assert.deepEqual(r.candidates.map(x=>x.referencedGridIds),[[42,43],[44]]);
  assert.deepEqual(r.candidates.map(x=>x.diffOnlyGridIds),[[43],[]]);
  assert.deepEqual(r.candidates.map(x=>x.serializedGridsOnlySoftwoodCount),[1,1]);
  assert.ok(r.riskCodes.includes('DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED'));
  assert.ok(r.riskCodes.includes('WETLAND_ENUM_TO_SAVE_AREA_ID_UNPROVEN'));
  assert.ok(r.riskCodes.includes('SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED'));
  assert.equal(r.sourceVillageAreaEnumWetland,1);
  assert.equal(r.selectedNativeWetlandArea,null);
  assert.equal(r.actualNativeQuota,null);
  isOff(r);
});

test('Current protected main single Worker W1-read only; no PR488 Native/Spatial/Writer capability upgrade',()=>{
  const bridge=createLocalSaveSessionBridge(()=>{throw Error('NO_WORKER_OPENED_IN_QA')});
  const c=bridge.getCapabilities();
  assert.equal(c.readW1RecurringEvents,true);
  for(const k of ['readInventory','readOwnership','readGrid',
    'readCompleteAllDomains','nativeSemanticsW1Verified',
    'sourceCoreWriterAccepted','canCommit','canEncodeEditedCopy','canApply','canReplaceOriginal'])
    assert.equal(c[k],false,k);
  assert.equal(c.maxCiphertextBytes,128*1024*1024);
  assert.equal(LOCAL_MAX_P1G_BYTES,c.maxCiphertextBytes);
});

test('Changed Source SHA/revision, schema624/BID1250 and caller Native/Writer claims cannot inherit 626 authority',()=>{
  const index=read626SpatialReferences(real626(),ctx);
  for(const forged of [
    {sourceSha256:'e'.repeat(64),sourceRevision:ctx.sourceRevision},
    {sourceSha256:ctx.sourceSha256,sourceRevision:'stale-A'},
    {sourceSha256:'invalid',sourceRevision:ctx.sourceRevision}
  ]){
    const r=inspectW1WetlandGridCandidates(index,forged);
    assert.equal(r.status,'SOURCE_REFERENCE_UNAVAILABLE');
    isOff(r);
  }
  assert.throws(()=>read626SpatialReferences(real626(),{
    ...ctx,bid:'52BD625D9B4E0053'}),/SPATIAL_EXACT_VERSION_BID_SCHEMA_REQUIRED/);
  const wrong=real626();wrong.GameInfo.Version=624;
  assert.throws(()=>read626SpatialReferences(wrong,ctx),/SPATIAL_PROFILE_SCHEMA/);
  const indexClone=structuredClone(index);
  indexClone.productWriterAuthorized=true;indexClone.nativePlacementVerified=true;
  const r=inspect(indexClone);
  assert.equal(r.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
  isOff(r);
  assert.equal(r.selectedNativeWetlandArea,null);
  assert.equal(r.actualNativeQuota,null);
});

test('Current main source inspector rejects Diff-only or overlapped Grids; candidate never converts into 2D placement or native producer',()=>{
  const p=real626();p.World.GridCollection.DiffGrids['42']={ID:42};
  const index=read626SpatialReferences(p,ctx);
  assert.equal(index.status,'REFERENCE_ERRORS_FAIL_CLOSED');
  assert.ok(index.issues.some(x=>x.code==='SPATIAL_GRID_DIFF_OVERLAP_UNRESOLVED'));
  const r=inspect(index);
  assert.ok(r.riskCodes.includes('SPATIAL_GRID_DIFF_OVERLAP_UNRESOLVED'));
  assert.equal(r.selectedNativeWetlandArea,null);
  assert.equal(r.nativeRuntimeVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.throws(()=>inspect626SourceObjectAtRevision(index,'g42:o7',ctx.sourceRevision,ctx.sourceSha256),
    /SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
});

test('Core source GridObject ID mismatch remains blocked and PR488 cannot forge over it',()=>{
  const p=real626();
  p.World.GridCollection.Grids['42'].Objects['7'].ID=999;
  const index=read626SpatialReferences(p,ctx);
  assert.equal(index.status,'REFERENCE_ERRORS_FAIL_CLOSED');
  assert.ok(index.issues.some(x=>x.code==='SPATIAL_GRIDOBJECT_ID_MISMATCH'));
  const r=inspect(index);
  assert.ok(r.riskCodes.includes('SPATIAL_GRIDOBJECT_ID_MISMATCH'));
  assert.deepEqual(r.candidates.map(x=>x.serializedGridsOnlySoftwoodCount),[0,1]);
  isOff(r);
});
