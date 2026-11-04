import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W1_SCENE_AREA_SOURCE,inspectW1SceneAreaReferences
} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// 05 QR-C: independent NEW-HEAD two-file repair delta only, after QA486 RED.
// No genuine original P1G, Native game execution or Product Writer.
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'b'.repeat(64),sourceRevision:'independent-qa-epoch-6'};
function fixture(){
  return {GameInfo:{Version:626},World:{
    Villages:[{SceneItemId:1540000000,Areas:{
      '1':{Unlocked:true,GridIDs:[100]}}}],
    GridCollection:{
      Grids:{'100':{ID:100,Objects:{}}},
      DiffGrids:{'100':{ID:100,ModifiedObjects:{},RemovedObjects:{}}}
    },
    RecurringEvents:{'155':{ItemSpawning:{NextOccurrence:'2126-08-20T00:00:00Z'}}}
  }};
}
const inspect=(p,c=ctx)=>inspectW1SceneAreaReferences(p,c);
const deny=(r)=>{
  assert.equal(r.status,'SOURCE_STRUCTURE_REJECTED');
  assert.equal(r.reason,'SOURCE_GRID_MAP_ID_MISMATCH');
  for(const f of ['sourceSceneReferenceMatched','inputAuthenticatedByThisReader',
    'sourceRevisionCasVerified','actualWetlandAreaVerified','nativeEffectiveGridVerified',
    'nativeSoftwoodQuotaVerified','productWriterAuthorized','productEditedCopyAuthorized',
    'originalOverwriteAuthorized','automatic2126RepairAuthorized'])
    assert.equal(r[f],false,f);
};
test('QA486 historical TRUE RED: valid Grids[100] cannot hide conflicting DiffGrids[100].ID',()=>{
  const p=fixture();
  p.World.GridCollection.DiffGrids['100'].ID=999;
  const old=JSON.stringify(p);
  deny(inspect(p));
  assert.equal(JSON.stringify(p),old,'original synthetic source must remain unchanged');
});
test('both paired source maps independently prove own ID, invalid Grids and malformed DiffGrids denied',()=>{
  const cases=[
    p=>p.World.GridCollection.Grids['100'].ID=999,
    p=>p.World.GridCollection.DiffGrids['100']=null,
    p=>p.World.GridCollection.DiffGrids['100']={ID:'100'},
    p=>{p.World.GridCollection.Grids['100']={ID:100};p.World.GridCollection.DiffGrids['100'].ID=101;}
  ];
  for(const mutate of cases){const p=fixture();mutate(p);deny(inspect(p));}
});
test('matching both witnesses stays unresolved source-only; no Native Wetland mapping or Writer grant',()=>{
  const p=fixture();
  p.nativeV3Accepted=true;p.productWriterAuthorized=true;
  const result=inspect(p,{...ctx,nativeRuntimeVerified:true,writerAuthorized:true});
  assert.equal(result.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(result.sourceCandidates.length,1);
  assert.equal(result.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(result.sourceCandidates[0].sourceGridRefs[0].effectiveGridVerified,false);
  assert.equal(result.nativeWetlandAreaEnum,1);
  assert.equal(result.selectedNativeWetlandAreaKey,null);
  assert.equal(result.nativeEffectiveGridVerified,false);
  assert.equal(result.nativeSoftwoodQuotaVerified,false);
  assert.equal(result.nativeClockLastNextVerified,false);
  assert.equal(result.sourceRevisionCasVerified,false);
  assert.equal(result.productWriterAuthorized,false);
  assert.equal(result.productEditedCopyAuthorized,false);
  assert.equal(result.automatic2126RepairAuthorized,false);
  assert.equal(p.World.RecurringEvents['155'].ItemSpawning.NextOccurrence,'2126-08-20T00:00:00Z');
  assert.equal(W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId,1540000000);
});
test('DIFF_ONLY invalid actual ID denied; valid DIFF_ONLY stays unresolved default without quota',()=>{
  const p=fixture();delete p.World.GridCollection.Grids['100'];
  p.World.GridCollection.DiffGrids['100'].ID=999;
  deny(inspect(p));
  p.World.GridCollection.DiffGrids['100'].ID=100;
  const ok=inspect(p);
  assert.equal(ok.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(ok.sourceCandidates[0].sourceGridRefs[0].sourceKind,'DIFF_ONLY_DEFAULT_UNRESOLVED');
  assert.equal(ok.nativeEffectiveGridVerified,false);
  assert.equal(ok.nativeSoftwoodQuotaVerified,false);
  assert.equal(ok.productWriterAuthorized,false);
});
