import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W1_SCENE_AREA_REFERENCE_CONTRACT,
  W1_SCENE_AREA_SOURCE,
  inspectW1SceneAreaReferences as inspect
} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

const context=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'b'.repeat(64),sourceRevision:'test-source-epoch-12'});
const copy=x=>structuredClone(x);
function fixture(){
  return {GameInfo:{Version:626},World:{
    Villages:[
      {SceneItemId:1540000001,Areas:{'1':{Unlocked:false,GridIDs:[9]}}},
      {SceneItemId:1540000000,Areas:{
        '9':{Unlocked:true,GridIDs:[102]},
        '1':{Unlocked:false,GridIDs:[100]},
        '7':{Unlocked:true,GridIDs:[101]}
      }},
      {SceneItemId:1540000002,Areas:{}}
    ],
    GridCollection:{
      Grids:{'100':{ID:100,Objects:{}},'102':{ID:102,Objects:{}}},
      DiffGrids:{'101':{ID:101,ModifiedObjects:{},RemovedObjects:{}}}
    }
  }};
}
function denied(v,reason){
  assert.equal(v.status,'SOURCE_STRUCTURE_REJECTED');
  if(reason)assert.equal(v.reason,reason);
  for(const flag of ['sourceSceneReferenceMatched','actualWetlandAreaVerified',
    'nativeEffectiveGridVerified','nativeSoftwoodQuotaVerified',
    'nativeProducerConsumerVerified','inputAuthenticatedByThisReader',
    'sourceRevisionCasVerified','productWriterAuthorized',
    'productEditedCopyAuthorized','originalOverwriteAuthorized',
    'automatic2126RepairAuthorized']) assert.equal(v[flag],false,flag);
}

test('schema626 SceneItemId is selected by exact unique record, not Village index or Wetland enum1',()=>{
  const result=inspect(fixture(),context);
  assert.equal(result.contract,W1_SCENE_AREA_REFERENCE_CONTRACT);
  assert.equal(result.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(result.villageIndex,1);
  assert.equal(result.sceneId,1540000000);
  assert.deepEqual(result.sourceCandidates.map(a=>a.saveAreaKey),['1','7','9']);
  assert.deepEqual(result.sourceCandidates.map(a=>a.savedUnlockedRaw),[false,true,true]);
  assert.deepEqual(result.sourceCandidates.map(a=>a.sourceGridRefs[0].sourceKind),
    ['GRIDS_ONLY','DIFF_ONLY_DEFAULT_UNRESOLVED','GRIDS_ONLY']);
  assert.equal(result.nativeWetlandAreaEnum,1);
  assert.equal(result.selectedNativeWetlandAreaKey,null);
  assert.equal(result.inputAuthenticatedByThisReader,false);
  assert.equal(result.sourceRevisionCasVerified,false);
  assert.equal(result.nativeClockLastNextVerified,false);
  assert.equal(result.productWriterAuthorized,false);
  assert.equal(result.productEditedCopyAuthorized,false);
  assert.equal(result.originalOverwriteAuthorized,false);
  assert.equal(result.automatic2126RepairAuthorized,false);
});

test('version/BID/schema and source hint reject invalid contexts without Native authority',()=>{
  for(const [key,value] of [
    ['platform','Steam'],['gameVersion','1.25.0'],['bid','52BD625D9B4E0053'],
    ['schema',624],['sourceSha256','not-hash'],['sourceRevision','']
  ])denied(inspect(fixture(),{...context,[key]:value}));
  const f=fixture();f.GameInfo.Version=624;
  denied(inspect(f,context));
});

test('nonunique/forged SceneItemId, missing Area, noncanonical decimal keys fail closed',()=>{
  const edits=[
    f=>{f.World.Villages[0].SceneItemId=1540000000},
    f=>{f.World.Villages[1].SceneItemId=1540000003},
    f=>{f.World.Villages[1].SceneItemId='1540000000'},
    f=>{f.World.Villages[1].Areas=null},
    f=>{f.World.Villages[1].Areas['01']={Unlocked:true,GridIDs:[]}},
    f=>{f.World.Villages[1].Areas['9007199254740992']={Unlocked:false,GridIDs:[]}}
  ];
  for(const edit of edits){const f=fixture();edit(f);denied(inspect(f,context));}
});

test('all grid references must be canonical, within area unique and have correct map identity',()=>{
  const edits=[
    f=>{f.World.Villages[1].Areas['1'].GridIDs=[100,100]},
    f=>{f.World.Villages[1].Areas['1'].GridIDs=['100']},
    f=>{f.World.Villages[1].Areas['1'].GridIDs=[444]},
    f=>{f.World.Villages[1].Areas['1'].Unlocked='true'},
    f=>{f.World.GridCollection.Grids['100'].ID=101},
    f=>{f.World.GridCollection.DiffGrids['101'].ID=102},
    f=>{f.World.GridCollection.Grids['102']=null}
  ];
  for(const edit of edits){const f=fixture();edit(f);denied(inspect(f,context));}
});

test('overlapping Grids+DiffGrids must validate BOTH keyed Grid ID witnesses',()=>{
  const f=fixture();
  f.World.GridCollection.DiffGrids['100']={ID:999,ModifiedObjects:{},RemovedObjects:{}};
  // A forged/stale DiffGrids member contradicts keyed Grid100 even if Grids100 is valid.
  // Read-only diagnostic must not silently certify this as a coherent source ID set.
  denied(inspect(f,context),'SOURCE_GRID_MAP_ID_MISMATCH');
});

test('valid overlapping Grids/DiffGrids is unresolved; never derives effective quota, Native semantics or edit',()=>{
  const f=fixture();
  f.World.GridCollection.DiffGrids['100']={ID:100,ModifiedObjects:{},RemovedObjects:{}};
  const r=inspect(f,{...context,callerSaysNativeV3:true,productWriterAuthorized:true});
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  const a=r.sourceCandidates.find(x=>x.saveAreaKey==='1');
  assert.equal(a.sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(a.sourceGridRefs[0].effectiveGridVerified,false);
  assert.equal(r.nativeEffectiveGridVerified,false);
  assert.equal(r.nativeTreeEligibilityVerified,false);
  assert.equal(r.nativeSoftwoodQuotaVerified,false);
  assert.equal(r.nativeProducerConsumerVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.automatic2126RepairAuthorized,false);
  assert.equal(W1_SCENE_AREA_SOURCE.nativeWetlandAreaEnum,1);
});

test('bounded input denies oversized/invalid GridIDs and forged Writer flags',()=>{
  const f=fixture();f.World.Villages[1].Areas['1'].GridIDs=Array.from({length:2049},(_,i)=>i);
  denied(inspect(f,context));
  const g=fixture();g.World.Villages[1].NativeV3Accepted=true;g.WriterAuthorized=true;
  const r=inspect(g,{...context,sourceSha256:'c'.repeat(64),sourceRevision:'forged'});
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.inputAuthenticatedByThisReader,false);
  assert.equal(r.sourceRevisionCasVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.productEditedCopyAuthorized,false);
});
