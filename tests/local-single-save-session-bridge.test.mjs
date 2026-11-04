import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimingWorkerReadCore,SWITCH_1253_BID} from '../src/lib/timing/local-worker-read-core.mjs';
import {
 createLocalSaveSessionBridge,getSingleSaveSessionBridge,
 SINGLE_SAVESESSION_CONTRACT,LOCAL_MAX_P1G_BYTES
} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
const att={
 platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
 buildId:SWITCH_1253_BID,schema:626,externallyConfirmed:true
};
const sample=()=>Object.assign(new Blob([Uint8Array.from([1,2,3,4])]),{name:'synthetic.p1g'});
const rows=Object.freeze([
 {mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',name:'Softwood',nextOccurrence:'2126-08-20T00:00:00Z',items:[{linkIndex:0,itemId:31700014,en:'Softwood',ja:'軟材'}]},
 {mapKey:'156',eventId:2010500008,oneof:'FlowerSpawningInVillage',name:'Flower',nextOccurrence:'2025-01-01T00:00:00Z',items:[]}
]);
const goodDecoded={
 inputFormat:'packaged',profileSchemaVersion:626,
 profile:{GameInfo:{Version:626},Player:{},World:{RecurringEvents:{}}},
 compatibility:{productionReadAccepted:true,readOnly:true,editingAuthorized:false,persistentWriteAuthorized:false}
};
function syntheticWorkerFactory({stalledOpen=null}={}){
 let count=0;const emitters=new Map();
 const core=createTimingWorkerReadCore({
  openSave:async()=>{
   count++;
   if(count===1&&stalledOpen)await stalledOpen;
   return goodDecoded;
  },
  project:()=>({writerAuthorized:false,encodeCopyAuthorized:false,
    savedContainerCount:2,unsupportedContainerCount:0,rows}),
  filter:(all,q)=>all.filter(row=>JSON.stringify(row).toLowerCase().includes(q)),
  loadRegistry:async()=>({source:'synthetic'})
 });
 const listeners=new Map(),worker={
  destroyed:false,
  addEventListener(name,cb){let a=listeners.get(name);if(!a)listeners.set(name,a=[]);a.push(cb);},
  postMessage(m){
   Promise.resolve().then(async()=>{
    if(worker.destroyed)return;
    try{
     let result;
     if(m.type==='CLOSE')result=core.close();
     else if(m.type==='OPEN_FILE')result=await core.open({
       file:m.file,buildId:m.buildId,sourceConfirmed:m.sourceConfirmed,
       platform:m.platform,fullVersion:m.fullVersion,
       buildKind:m.buildKind,sourceSchema:m.sourceSchema
     });
     else if(m.type==='QUERY')result=await core.query({search:m.search,cursor:m.cursor,limit:m.limit});
     else if(m.type==='DIAGNOSE_W1')result=core.diagnose();
     else throw Error('READ_WRITER_OPERATION_DISABLED');
     if(!worker.destroyed)emit('message',{id:m.id,ok:true,result});
    }catch(e){if(!worker.destroyed)emit('message',{id:m.id,ok:false,error:e.message});}
   });
  },
  terminate(){worker.destroyed=true;core.close();}
 };
 function emit(name,data){for(const cb of listeners.get(name)||[])cb({data});}
 queueMicrotask(()=>emit('message',{id:0,ready:true,writerAuthorized:false}));
 return worker;
}
test('single tab SaveSession has Worker-only receipt and scoped page, no edit capabilities',async()=>{
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 const updates=[],unsubscribe=bridge.subscribe(s=>updates.push(s));
 await bridge.ensureReady();
 const src=sample();
 const receipt=await bridge.openLocalFile(src,att);
 assert.equal(receipt.contract,SINGLE_SAVESESSION_CONTRACT);
 assert.equal(receipt.platform,'switch');
 assert.equal(receipt.fullVersion,'1.25.3');
 assert.equal(receipt.buildId,SWITCH_1253_BID);
 assert.equal(receipt.schema,626);
 assert.match(receipt.sourceSha256,/^[0-9a-f]{64}$/);
 assert.match(receipt.sessionId,/^[0-9a-f]{32}$/);
 assert.equal(receipt.revision,0);
 assert.ok(receipt.indexGeneration>0);
 assert.deepEqual(receipt.indexedRoots,['World.RecurringEvents']);
 assert.equal('profile' in receipt,false);
 const c=bridge.getCapabilities();
 assert.equal(c.canCommit,false);
 assert.equal(c.canEncodeEditedCopy,false);
 assert.equal(c.readW1RecurringEvents,true);
 assert.equal(c.readInventory,false);
 assert.equal(c.readGrid,false);
 assert.equal(c.maxCiphertextBytes,128*1024*1024);
 assert.equal(LOCAL_MAX_P1G_BYTES,128*1024*1024);
 const first=await bridge.queryW1Page({limit:1});
 assert.equal(first.rows[0].eventId,2010000021);
 const second=await bridge.queryW1Page({cursor:first.nextCursor,limit:1});
 assert.equal(second.rows[0].mapKey,'156');
 assert.equal(second.complete,true);
 await assert.rejects(bridge.queryW1Page({cursor:first.nextCursor,limit:1}),/READ_CURSOR/);
 await assert.rejects(bridge.submitOperation({kind:'INVENTORY_CHANGE',sessionId:receipt.sessionId}),/LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
 assert.equal(updates.at(-1).receipt.sessionId,receipt.sessionId);
 unsubscribe();
 bridge.destroy();
});
test('external provenance Version, Platform, BID and Schema required; B invalid revokes A',async()=>{
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await bridge.ensureReady();const a=await bridge.openLocalFile(sample(),att);
 for(const wrong of [{platform:'steam-windows'},{fullVersion:'1.25.0'},
  {buildId:'0000000000000000'},{schema:624},{buildKind:'steam-full-version'},
  {externallyConfirmed:false}]){
  await assert.rejects(bridge.openLocalFile(sample(),{...att,...wrong}),
    /LOCAL_BUILD_VERSION_BID_SCHEMA_DENIED/);
  assert.equal(bridge.getSession(),null);
  await assert.rejects(bridge.queryW1Page({}),/LOCAL_SESSION_NOT_OPEN/);
  await bridge.openLocalFile(sample(),att);
 }
 const b=await bridge.openLocalFile(sample(),att);
 assert.notEqual(a.sessionId,b.sessionId);
 await bridge.close();
 assert.equal(bridge.getSession(),null);
 bridge.destroy();
});
test('reopen B revokes A Cursor, and close clears active Session',async()=>{
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await bridge.ensureReady();
 const a=await bridge.openLocalFile(sample(),att);
 const cursor=(await bridge.queryW1Page({limit:1})).nextCursor;
 const b=await bridge.openLocalFile(sample(),att);
 assert.notEqual(a.sessionId,b.sessionId);
 await assert.rejects(bridge.queryW1Page({cursor,limit:1}),/READ_CURSOR_REPLAY_OR_SCOPE/);
 assert.equal((await bridge.queryW1Page({limit:1})).rows.length,1);
 await bridge.close();
 assert.equal(bridge.getSession(),null);
 bridge.destroy();
});
test('A open with slow decode cannot resurrect after B or close',async()=>{
 let release,entered;
 const stall=new Promise(resolve=>{release=resolve;});
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory({stalledOpen:stall}));
 await bridge.ensureReady();
 const pending=bridge.openLocalFile(sample(),att);
 const rejectA=assert.rejects(pending,/LOCAL_SESSION_STALE_OPEN|READ_OPEN_REVOKED/);
 await new Promise(resolve=>{entered=resolve;setImmediate(resolve);});
 const b=bridge.openLocalFile(sample(),att);
 release();
 const result=await b;
 await rejectA;
 assert.equal(bridge.getSession().sessionId,result.sessionId);
 bridge.destroy();
});
test('unsupported Writer and large save fail closed, no P1G bytes persisted by bridge',async()=>{
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await bridge.ensureReady();await bridge.openLocalFile(sample(),att);
 for(const command of [
  {kind:'W1_NEXT_OCCURRENCE_CHANGE'},
  {kind:'INVENTORY_CHANGE'},
  {kind:'OWNERSHIP_CHANGE'},
  {kind:'WORLD_OBJECT_CHANGE'},
  {kind:'EXPORT_EDITED_COPY'}
 ])await assert.rejects(bridge.submitOperation(command),/LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
 const oversized=Object.assign(new Blob([new Uint8Array(0)]),{name:'bad'});
 await assert.rejects(bridge.openLocalFile(oversized,att),/LOCAL_FILE_BOUNDS/);
 assert.equal(bridge.getSession(),null);
 await bridge.close();
 bridge.destroy();
});
test('shared instance provides one route-owned Worker and same receipt across consumers',async()=>{
 let workers=0;
 const make=()=>{workers++;return syntheticWorkerFactory()};
 const a=getSingleSaveSessionBridge(make);
 const b=getSingleSaveSessionBridge(()=>{throw Error('SECOND_WORKER_MUST_NOT_BE_CREATED')});
 assert.equal(a,b);
 await a.ensureReady();
 const old=await a.openLocalFile(sample(),att);
 assert.equal(workers,1);
 assert.equal(b.getSession(),old);
 assert.equal((await b.queryW1Page({search:'31700014'})).rows[0].eventId,2010000021);
 await b.close();
 assert.equal(a.getSession(),null);
 a.destroy();
});

test('01D Item/Ownership and 01B Spatial consumers share one Source scope yet fail closed',async()=>{
 const core=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await core.ensureReady();
 const s=await core.openLocalFile(sample(),att);
 const read={domain:'RecurringEvents',sessionId:s.sessionId,
  sourceSha256:s.sourceSha256,revision:s.revision,
  indexGeneration:s.indexGeneration,limit:1};
 const page=await core.readDomainPage(read);
 assert.equal(page.rows[0].eventId,2010000021);
 for(const domain of ['Inventory','Ownership','Spatial','ItemDetail']){
  await assert.rejects(core.readDomainPage({...read,domain}),
   /LOCAL_READ_CAPABILITY_NOT_ACCEPTED/);
 }
 for(const forged of [
  {sessionId:'forged'},{sourceSha256:'0'.repeat(64)},
  {revision:1},{indexGeneration:s.indexGeneration+1}
 ]){
  await assert.rejects(core.readDomainPage({...read,...forged}),
   /LOCAL_READ_STALE_SOURCE_SCOPE/);
 }
 const other=await core.openLocalFile(sample(),att);
 assert.notEqual(other.sessionId,s.sessionId);
 await assert.rejects(core.readDomainPage(read),/LOCAL_READ_STALE_SOURCE_SCOPE/);
 const fresh=await core.readDomainPage({...read,sessionId:other.sessionId,
  sourceSha256:other.sourceSha256,indexGeneration:other.indexGeneration});
 assert.equal(fresh.rows.length,1);
 assert.equal(core.getCapabilities().readInventory,false);
 assert.equal(core.getCapabilities().readGrid,false);
 core.destroy();
});

test('original File handle remains scoped for backup across routes, never authorizes Writer',async()=>{
 const core=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await core.ensureReady();
 const first=await core.openLocalFile(sample(),att);
 assert.equal(core.hasUntouchedOriginalBackupSource(first),true);
 assert.throws(()=>core.requestUntouchedOriginalBackup(first),/LOCAL_ORIGINAL_BACKUP_BROWSER_ONLY/);
 assert.equal(core.getCapabilities().canEncodeEditedCopy,false);
 const second=await core.openLocalFile(sample(),att);
 assert.notEqual(first.sessionId,second.sessionId);
 assert.equal(core.hasUntouchedOriginalBackupSource(first),false);
 assert.throws(()=>core.requestUntouchedOriginalBackup(first),/LOCAL_ORIGINAL_BACKUP_STALE_OR_UNAVAILABLE/);
 assert.equal(core.hasUntouchedOriginalBackupSource(second),true);
 await core.close();
 assert.equal(core.hasUntouchedOriginalBackupSource(second),false);
 core.destroy();
});

test('Worker-owned diagnostic API is source scoped, caller cannot forge read-set and B revokes A',async()=>{
 const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
 await bridge.ensureReady();
 const a=await bridge.openLocalFile(sample(),att);
 const scope={sessionId:a.sessionId,sourceSha256:a.sourceSha256,
   revision:a.revision,indexGeneration:a.indexGeneration};
 const diag=await bridge.diagnoseW1Dependencies(scope);
 assert.equal(diag.contract,'wand.local.w1-core-source-readset@1');
 assert.equal(diag.referenceCount,8);
 assert.equal(diag.presentCount,1); // synthetic has only GameInfo.Version
 assert.ok(diag.missingReferences.includes('World.Villages'));
 assert.equal(diag.allSourceReferencesPresent,false);
 assert.equal(diag.completeNativeDependencyClosureVerified,false);
 assert.equal(diag.operationWriterAuthorized,false);
 assert.equal(JSON.stringify(diag).includes('2126-08-20'),false);
 for(const forged of [{sourceSha256:'0'.repeat(64)},{revision:1},
   {indexGeneration:a.indexGeneration+1},{sessionId:'forged'},
   {sourceReadSet:[]},{nativeAccepted:true}]){
   await assert.rejects(bridge.diagnoseW1Dependencies({...scope,...forged}),
     /LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE/);
 }
 const b=await bridge.openLocalFile(sample(),att);
 await assert.rejects(bridge.diagnoseW1Dependencies(scope),
   /LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE/);
 const fresh=await bridge.diagnoseW1Dependencies({...scope,
   sessionId:b.sessionId,sourceSha256:b.sourceSha256,indexGeneration:b.indexGeneration});
 assert.equal(fresh.sessionId,b.sessionId);
 await bridge.close();
 await assert.rejects(bridge.diagnoseW1Dependencies({...scope,
   sessionId:b.sessionId,indexGeneration:b.indexGeneration}),/LOCAL_SESSION_NOT_OPEN/);
 bridge.destroy();
});

const candidateScope=r=>({
  sessionId:r.sessionId,sourceSha256:r.sourceSha256,
  revision:r.revision,indexGeneration:r.indexGeneration
});
test('explicit reimported backup candidate matches original in bounded local chunks but never claims persistence',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge.ensureReady();
  const size=1024*1024+13;
  const bytes=new Uint8Array(size);
  bytes.fill(0x42);
  bytes[size-1]=0x01;
  const original=Object.assign(new Blob([bytes]),{name:'private-local-synthetic.p1g'});
  const receipt=await bridge.openLocalFile(original,att);
  const candidate=new Blob([bytes]);
  const result=await bridge.verifyUserSelectedOriginalBackupCandidate(candidate,candidateScope(receipt));
  assert.equal(result.candidateBytesMatchOriginal,true);
  assert.equal(result.comparedByteCount,size);
  assert.equal(result.sourceSha256,receipt.sourceSha256);
  assert.equal(result.persistedVerified,false);
  assert.equal(result.distinctDiskPathVerified,false);
  assert.equal(result.originalOverwriteProtectionVerified,false);
  assert.equal(result.writerAuthorized,false);
  assert.equal('file' in result,false);
  assert.equal('decoded' in result,false);
  assert.equal(bridge.getCapabilities().canEncodeEditedCopy,false);
  assert.equal(bridge.getCapabilities().canReplaceOriginal,false);
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(original,candidateScope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED/
  );
  bridge.destroy();
});
test('reimport candidate must match every byte and session scope; no silent false backup success',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge.ensureReady();
  const original=sample(),receipt=await bridge.openLocalFile(original,att);
  const scope=candidateScope(receipt);
  for(const forged of [
    {...scope,sourceSha256:'0'.repeat(64)},{...scope,indexGeneration:scope.indexGeneration+1},
    {...scope,revision:1},{...scope,sessionId:'forged'},
    {...scope,writerAuthorized:true}
  ]){
    await assert.rejects(
      bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([Uint8Array.of(1,2,3,4)]),forged),
      /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/
    );
  }
  for(const wrong of [new Blob([Uint8Array.of(1,2,3)]),
    new Blob([Uint8Array.of(1,2,3,9)])]){
    await assert.rejects(
      bridge.verifyUserSelectedOriginalBackupCandidate(wrong,scope),
      /LOCAL_BACKUP_CANDIDATE_(NOT_DISTINCT_BOUNDED|BYTES_DIFFER)/
    );
  }
  const b=await bridge.openLocalFile(sample(),att);
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([Uint8Array.of(1,2,3,4)]),scope),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/
  );
  await bridge.close();
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([Uint8Array.of(1,2,3,4)]),
       candidateScope(b)),/LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/
  );
  bridge.destroy();
});
test('A to B during intrinsic candidate Blob read revokes result before any success',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge.ensureReady();
  const a=await bridge.openLocalFile(sample(),att);
  const candidate=new Blob([Uint8Array.of(1,2,3,4)]);
  const pending=bridge.verifyUserSelectedOriginalBackupCandidate(candidate,candidateScope(a));
  // openLocalFile increments epoch synchronously before its first async Worker CLOSE.
  // Intrinsic Blob.arrayBuffer resolves asynchronously; no forged slice necessary.
  const next=bridge.openLocalFile(sample(),att);
  await assert.rejects(pending,/LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED/);
  await next;
  assert.equal(bridge.getCapabilities().canCommit,false);
  bridge.destroy();
});
test('QA487 RED: overridden Blob slice and arrayBuffer cannot forge equal original bytes',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge.ensureReady();
  const source=sample();
  const receipt=await bridge.openLocalFile(source,att);
  const candidate=new Blob([Uint8Array.of(1,2,3,9)]);
  // An adversary controls methods on the candidate and can return any Blob.
  candidate.slice=()=>new Blob([Uint8Array.of(1,2,3,4)]);
  candidate.arrayBuffer=async()=>new Uint8Array([1,2,3,4]).buffer;
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(candidate,candidateScope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/
  );
  const alteredSource=Object.assign(new Blob([Uint8Array.of(1,2,3,4)]),{name:'spoofed-original.p1g'});
  alteredSource.slice=()=>new Blob([Uint8Array.of(0,0,0,0)]);
  // The source's own spoofed method must also be ignored.
  const bridge2=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge2.ensureReady();
  const r2=await bridge2.openLocalFile(alteredSource,att);
  const candidate2=new Blob([Uint8Array.of(1,2,3,4)]);
  const verified=await bridge2.verifyUserSelectedOriginalBackupCandidate(candidate2,candidateScope(r2));
  assert.equal(verified.candidateBytesMatchOriginal,true);
  assert.equal(verified.persistedVerified,false);
  bridge.destroy();bridge2.destroy();
});
test('QA487: a shadowed size and subclass cannot truncate byte comparison',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>syntheticWorkerFactory());
  await bridge.ensureReady();
  const receipt=await bridge.openLocalFile(sample(),att);
  class ForgedBlob extends Blob{
    get size(){return 4;}
    slice(){return new Blob([Uint8Array.of(1,2,3,4)]);}
  }
  const altered=new ForgedBlob([Uint8Array.of(1,2,3,9,7)]);
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(altered,candidateScope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED/
  );
  const sameSize=new ForgedBlob([Uint8Array.of(1,2,3,9)]);
  await assert.rejects(
    bridge.verifyUserSelectedOriginalBackupCandidate(sameSize,candidateScope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/
  );
  bridge.destroy();
});
