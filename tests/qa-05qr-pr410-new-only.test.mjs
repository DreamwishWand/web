// 05QR independent PR410 new-only Worker-derived mandatory refs; SYNTHETIC ONLY.
import test from 'node:test';import assert from 'node:assert/strict';
import {createTimingWorkerReadCore,SWITCH_1253_BID} from '../src/lib/timing/local-worker-read-core.mjs';
import {createLocalSaveSessionBridge} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {deriveW1RequiredSourceReadSet,W1_MANDATORY_REFERENCE_IDS}
 from '../src/lib/timing/w1-worker-mandatory-readset.mjs';
const OLD='2126-08-20T00:00:00Z';
const att={platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',buildId:SWITCH_1253_BID,schema:626,externallyConfirmed:true};
const file=()=>Object.assign(new Blob([Uint8Array.of(1,2,3,4)]),{name:'qr410.synthetic.p1g'});
const profile=()=>({GameInfo:{Version:626},Player:{},World:{RecurringEvents:{'155':{
 ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD,
 LastOccurrence:'2026-10-01T00:00:00Z',EndDate:'2030-01-01T00:00:00Z'}}},
 GridCollection:{Grids:{},DiffGrids:{}},Villages:[{Areas:{'0':{GridIDs:[]}}}]}});
function workerFactory(raw){
 const core=createTimingWorkerReadCore({
  openSave:async()=>({inputFormat:'packaged',profileSchemaVersion:626,profile:raw,compatibility:{
   productionReadAccepted:true,readOnly:true,editingAuthorized:false,persistentWriteAuthorized:false}}),
  project:()=>({writerAuthorized:false,encodeCopyAuthorized:false,savedContainerCount:1,unsupportedContainerCount:0,rows:[]}),
  filter:()=>[],loadRegistry:async()=>({source:'qr410-worker-pinned'})
 });
 const listeners=new Map(),sent=[];
 function fire(type,data){for(const cb of listeners.get(type)||[])cb({data});}
 const worker={addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},
  postMessage(m){
   sent.push(m);
   Promise.resolve().then(async()=>{try{
    let result;
    if(m.type==='CLOSE')result=core.close();
    else if(m.type==='OPEN_FILE')result=await core.open({
     file:m.file,buildId:m.buildId,sourceConfirmed:m.sourceConfirmed,platform:m.platform,
     fullVersion:m.fullVersion,buildKind:m.buildKind,sourceSchema:m.sourceSchema
    });
    else if(m.type==='QUERY')result=await core.query({search:m.search,cursor:m.cursor,limit:m.limit});
    else if(m.type==='DIAGNOSE_W1')result=core.diagnose();
    else throw Error('READ_WRITER_OPERATION_DISABLED');
    fire('message',{id:m.id,ok:true,result});
   }catch(e){fire('message',{id:m.id,ok:false,error:e.message});}});
  },terminate(){core.close();}};
 queueMicrotask(()=>fire('message',{id:0,ready:true,writerAuthorized:false}));
 return {worker,core,sent};
}
function scope(r){return {sessionId:r.sessionId,sourceSha256:r.sourceSha256,revision:r.revision,indexGeneration:r.indexGeneration};}
test('exact Worker-owned eight refs from validated full source, no timestamps/full profile leaked',async()=>{
 const p=profile(),w=workerFactory(p),b=createLocalSaveSessionBridge(()=>w.worker);
 const r=await b.openLocalFile(file(),att);
 const d=await b.diagnoseW1Dependencies(scope(r));
 assert.equal(d.referenceCount,8);assert.equal(d.presentCount,8);
 assert.equal(d.allSourceReferencesPresent,true);
 assert.deepEqual(d.missingReferences,[]);
 assert.equal(d.sourceSha256,r.sourceSha256);assert.equal(d.sessionId,r.sessionId);
 for(const key of ['sameBuildNativeRegistryAccepted','effectiveWorldDependenciesVerified',
   'clockActualizeVerified','completeNativeDependencyClosureVerified',
   'operationWriterAuthorized','writerAuthorized','productRustWorkerAccepted'])
  assert.equal(d[key],false,key);
 assert.equal(JSON.stringify(d).includes(OLD),false);
 assert.equal('profile' in d,false);
 assert.equal(p.World.RecurringEvents['155'].ItemSpawning.NextOccurrence,OLD);
 b.destroy();
});
test('Each mandatory field type/missing failure stays missing under forged caller readset',()=>{
 for(const path of W1_MANDATORY_REFERENCE_IDS){
  const p=profile();
  if(path==='GameInfo.Version')p.GameInfo.Version=624;
  else if(path==='World.Villages')p.World.Villages={Village04:{Areas:{}}};
  else if(path==='World.GridCollection.Grids')delete p.World.GridCollection.Grids;
  else if(path==='World.GridCollection.DiffGrids')delete p.World.GridCollection.DiffGrids;
  else{
   const leaf=path.split('.').at(-1);delete p.World.RecurringEvents['155'].ItemSpawning[leaf];
  }
  const d=deriveW1RequiredSourceReadSet(p,{sourceReadSet:W1_MANDATORY_REFERENCE_IDS,nativeAccepted:true});
  assert.equal(d.allSourceReferencesPresent,false,path);
  assert.ok(d.missingReferences.includes(path),path);
  assert.equal(d.operationWriterAuthorized,false,path);
 }
});
test('Forged/extra/empty caller scope is refused before sending DIAGNOSE to Worker',async()=>{
 const w=workerFactory(profile()),b=createLocalSaveSessionBridge(()=>w.worker);
 const r=await b.openLocalFile(file(),att),valid=scope(r);
 const n=w.sent.length;
 for(const forged of [{...valid,sourceReadSet:[]},{...valid,nativeAccepted:true},
   {...valid,sourceSha256:'0'.repeat(64)},{...valid,sessionId:'forged'},
   {...valid,revision:1},{...valid,indexGeneration:0},null,{}]){
  await assert.rejects(b.diagnoseW1Dependencies(forged),/LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE/);
 }
 assert.equal(w.sent.length,n);
 await assert.rejects(b.submitOperation({kind:'W1_WRITE',nativeAccepted:true}),/LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
 assert.equal(w.sent.length,n);
 b.destroy();
});
test('A→B source revokes diagnostic lease and previous source ref; partial B remains native OFF',async()=>{
 const w=workerFactory(profile()),b=createLocalSaveSessionBridge(()=>w.worker);
 const a=await b.openLocalFile(file(),att),aScope=scope(a);
 const d=await b.diagnoseW1Dependencies(aScope);assert.equal(d.presentCount,8);
 w.core.close();
 const bReceipt=await b.openLocalFile(file(),att);
 assert.notEqual(a.sessionId,bReceipt.sessionId);
 await assert.rejects(b.diagnoseW1Dependencies(aScope),/LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE/);
 const next=await b.diagnoseW1Dependencies(scope(bReceipt));
 assert.equal(next.operationWriterAuthorized,false);
 await b.close();
 await assert.rejects(b.diagnoseW1Dependencies(scope(bReceipt)),/LOCAL_SESSION_NOT_OPEN/);
 b.destroy();
});
