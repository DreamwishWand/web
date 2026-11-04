import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveW1RequiredSourceReadSet, W1_MANDATORY_REFERENCE_IDS} from
  '../src/lib/timing/w1-worker-mandatory-readset.mjs';
import {createTimingWorkerReadCore, SWITCH_1253_BID} from
  '../src/lib/timing/local-worker-read-core.mjs';
const oldUtc = '2126-08-20T00:00:00Z';
const source = () => ({
  GameInfo:{Version:626}, Player:{},
  World:{
    RecurringEvents:{'155':{ItemSpawning:{
      RecurringEventItemID:2010000021,
      NextOccurrence:oldUtc,
      LastOccurrence:'2026-08-20T00:00:00Z',
      EndDate:'2027-08-20T00:00:00Z'
    }}},
    GridCollection:{Grids:{},DiffGrids:{}},
    Villages:[]
  }
});
const openArgs = {file:new Blob([Uint8Array.of(1,2,3)]),
  buildId:SWITCH_1253_BID,sourceConfirmed:true,platform:'switch',
  fullVersion:'1.25.3',buildKind:'switch-bid',sourceSchema:626};
const factory = (profile=source()) => createTimingWorkerReadCore({
  openSave:async()=>({
    inputFormat:'packaged',profileSchemaVersion:626,profile,
    compatibility:{productionReadAccepted:true,readOnly:true,
      editingAuthorized:false,persistentWriteAuthorized:false}
  }),
  project:()=>({writerAuthorized:false,encodeCopyAuthorized:false,
    savedContainerCount:1,unsupportedContainerCount:0,rows:[]}),
  filter:(rows)=>rows,loadRegistry:async()=>({tag:'fixed-synthetic'})
});
test('Worker derives eight mandatory refs: all present remains Native and Writer OFF',async()=>{
  const s=source(),core=factory(s),receipt=await core.open(openArgs);
  const result=core.diagnose();
  assert.equal(result.sessionId,receipt.sessionId);
  assert.equal(result.sourceSha256,receipt.sourceSha256);
  assert.equal(result.referenceCount,8);
  assert.equal(result.presentCount,8);
  assert.equal(result.allSourceReferencesPresent,true);
  assert.deepEqual(result.missingReferences,[]);
  for(const flag of ['sameBuildNativeRegistryAccepted','effectiveWorldDependenciesVerified',
    'clockActualizeVerified','completeNativeDependencyClosureVerified',
    'operationWriterAuthorized'])assert.equal(result[flag],false);
  assert.equal(JSON.stringify(result).includes(oldUtc),false);
  assert.equal(JSON.stringify(result).includes('Grids":'),false);
  assert.equal(core.status().productRustWorkerAccepted,false);
  assert.equal(s.World.RecurringEvents['155'].ItemSpawning.NextOccurrence,oldUtc);
});
test('missing/forged refs cannot be covered by a caller-supplied read-set',()=>{
  for(const key of ['EndDate','LastOccurrence','NextOccurrence']){
    const s=source();delete s.World.RecurringEvents['155'].ItemSpawning[key];
    const d=deriveW1RequiredSourceReadSet(s,{sourceReadSet:[],allPresent:true});
    assert.equal(d.allSourceReferencesPresent,false);
    assert.ok(d.missingReferences.some(x=>x.endsWith('.'+key)));
  }
  for(const key of ['Grids','DiffGrids']){
    const s=source();delete s.World.GridCollection[key];
    assert.equal(deriveW1RequiredSourceReadSet(s,{sourceReadSet:W1_MANDATORY_REFERENCE_IDS}).allSourceReferencesPresent,false);
  }
  const s=source();delete s.World.Villages;
  assert.ok(deriveW1RequiredSourceReadSet(s).missingReferences.includes('World.Villages'));
  s.World.Villages=[];s.World.RecurringEvents['155'].ItemSpawning.RecurringEventItemID=1;
  assert.ok(deriveW1RequiredSourceReadSet(s).missingReferences.some(x=>x.endsWith('RecurringEventItemID')));
  const wrong=source();wrong.World.RecurringEvents['156']=wrong.World.RecurringEvents['155'];
  delete wrong.World.RecurringEvents['155'];
  assert.equal(deriveW1RequiredSourceReadSet(wrong).allSourceReferencesPresent,false);
});
test('missing Native read-sets remain diagnostics not an edit or automatic 2126 repair',async()=>{
  const s=source();delete s.World.GridCollection.DiffGrids;
  const core=factory(s),receipt=await core.open(openArgs);
  const d=core.diagnose({sourceReadSet:[],nativeAccepted:true});
  assert.equal(d.allSourceReferencesPresent,false);
  assert.ok(d.missingReferences.includes('World.GridCollection.DiffGrids'));
  assert.equal(d.writerAuthorized,false);
  assert.equal(d.operationWriterAuthorized,false);
  assert.equal(s.World.RecurringEvents['155'].ItemSpawning.NextOccurrence,oldUtc);
  core.close();
  assert.throws(()=>core.diagnose(),/READ_SESSION_NOT_OPEN/);
  assert.equal(receipt.writerAuthorized,false);
});
