// 05 QR — PR383 new-only independent Session/Worker lease negative proof.
// PUBLIC SYNTHETIC 4-byte Blob; mock transport in NODE only. Browser E2E
// independently uses real compiled Worker in qa-pr383-browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalSaveSessionBridge,getSingleSaveSessionBridge}
  from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {createTimingWorkerReadCore} from '../src/lib/timing/local-worker-read-core.mjs';

const bid='9A239D3DB569756D';
const att={platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
 buildId:bid,schema:626,externallyConfirmed:true};
const file=()=>Object.assign(new Blob([Uint8Array.from([1,2,3,4])]),{name:'qr383.p1g'});
const record=()=>({
 inputFormat:'packaged',profileSchemaVersion:626,
 compatibility:{productionReadAccepted:true,readOnly:true,
 editingAuthorized:false,persistentWriteAuthorized:false},profile:{
 GameInfo:{Version:626},Player:{},World:{RecurringEvents:{}}}
});
const rows=[
 {mapKey:'155',eventId:2010000021,name:'Softwood',oneof:'ItemSpawning',items:[{itemId:31700014}]},
 {mapKey:'156',eventId:2010500008,name:'Flower',oneof:'FlowerSpawningInVillage',items:[]},
 {mapKey:'157',eventId:2010000021,name:'Softwood2',oneof:'ItemSpawning',items:[{itemId:31700014}]}
];
function factory({delayedRead=null,delayOpen=null,malformedReceipt=null}={}){
 const events=new Map(),sent=[],state={creations:0};
 const core=createTimingWorkerReadCore({
  openSave:async()=>{if(delayOpen)await delayOpen;return record();},
  project:()=>({writerAuthorized:false,encodeCopyAuthorized:false,
    savedContainerCount:3,unsupportedContainerCount:0,rows}),
  filter:(all,q)=>q?all.filter(v=>JSON.stringify(v).toLowerCase().includes(q)):all,
  loadRegistry:async()=>({source:'worker-owned-synthetic'})
 });
 const fire=(type,data)=>{for(const fn of events.get(type)||[])fn({data});};
 const worker={
  addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},
  postMessage(m){
   sent.push(m);
   Promise.resolve().then(async()=>{
    try{
     let result;
     if(m.type==='CLOSE')result=core.close();
     else if(m.type==='OPEN_FILE'){
      result=await core.open({file:m.file,buildId:m.buildId,sourceConfirmed:m.sourceConfirmed,
       platform:m.platform,fullVersion:m.fullVersion,buildKind:m.buildKind,sourceSchema:m.sourceSchema});
      if(malformedReceipt)result={...result,...malformedReceipt};
     }else if(m.type==='QUERY'){
      if(delayedRead)await delayedRead;
      result=await core.query({search:m.search,cursor:m.cursor,limit:m.limit});
     }else throw Error('READ_WRITER_OPERATION_DISABLED');
     fire('message',{id:m.id,ok:true,result});
    }catch(e){fire('message',{id:m.id,ok:false,error:e.message});}
   });
  },terminate(){state.terminated=true;core.close();}
 };
 queueMicrotask(()=>fire('message',{id:0,ready:true,writerAuthorized:false}));
 return {worker,sent,state};
}
test('single Worker, two independent consumer handles, no authority for non-W1 domains',async()=>{
 let builds=0;const f=factory();
 const bridge=createLocalSaveSessionBridge(()=>{builds++;return f.worker;});
 await bridge.ensureReady();
 const primary=await bridge.openLocalFile(file(),att);
 const other=bridge; // route-level consumers must share exactly one owner
 assert.equal(other.getSession(),primary);
 assert.equal(builds,1);
 assert.equal(primary.revision,0);
 assert.ok(primary.indexGeneration>=1);
 assert.equal(primary.completeAllDomainIndexes,false);
 assert.equal(primary.completeNativeReferenceClosure,false);
 assert.equal('profile' in primary,false);
 assert.equal('decodedJson' in primary,false);
 const capabilities=other.getCapabilities();
 for(const key of ['readInventory','readOwnership','readGrid','canCommit','canEncodeEditedCopy',
   'canApply','canReplaceOriginal','nativeSemanticsW1Verified','sourceCoreWriterAccepted'])
  assert.equal(capabilities[key],false,key);
 assert.equal(capabilities.readW1RecurringEvents,true);
 const page=await other.queryW1Page({search:'31700014',limit:1});
 assert.equal(page.rows[0].eventId,2010000021);
 assert.equal(page.complete,false);
 assert.equal(page.writerAuthorized,false);
 assert.equal('profile' in page,false);
 bridge.destroy();
 assert.equal(f.state.terminated,true);
});
test('single-use Worker Cursor cannot cross search, replay or A to B source',async()=>{
 const f=factory(),bridge=createLocalSaveSessionBridge(()=>f.worker);
 const first=await bridge.openLocalFile(file(),att);
 const one=await bridge.queryW1Page({limit:1});
 assert.ok(one.nextCursor?.startsWith('w1r1.'));
 await assert.rejects(bridge.queryW1Page({cursor:'w1r1.1.'+'0'.repeat(64),limit:1}),/READ_CURSOR/);
 const valid=await bridge.queryW1Page({cursor:one.nextCursor,limit:1});
 assert.equal(valid.rows[0].mapKey,'156');
 await assert.rejects(bridge.queryW1Page({cursor:one.nextCursor,limit:1}),/READ_CURSOR/);
 const next=await bridge.openLocalFile(file(),att);
 assert.notEqual(first.sessionId,next.sessionId);
 assert.ok(next.indexGeneration>first.indexGeneration);
 await assert.rejects(bridge.queryW1Page({cursor:valid.nextCursor,limit:1}),/READ_CURSOR/);
 await bridge.close();
 assert.equal(bridge.getSession(),null);
 await assert.rejects(bridge.queryW1Page({}),/LOCAL_SESSION_NOT_OPEN/);
 bridge.destroy();
});
test('rejected B attestation, bounds and external exact version always revoke A',async()=>{
 const f=factory(),bridge=createLocalSaveSessionBridge(()=>f.worker);
 await bridge.openLocalFile(file(),att);
 for(const delta of [{platform:'steam-windows'},{fullVersion:'1.25.0'},
  {buildKind:'steam'},{buildId:'0000000000000000'},{schema:624},
  {externallyConfirmed:false},{externallyConfirmed:1}]){
  await assert.rejects(bridge.openLocalFile(file(),{...att,...delta}),
    /LOCAL_BUILD_VERSION_BID_SCHEMA_DENIED/);
  assert.equal(bridge.getSession(),null);
  await bridge.openLocalFile(file(),att);
 }
 await assert.rejects(bridge.openLocalFile(new Blob([]),att),/LOCAL_FILE_BOUNDS/);
 assert.equal(bridge.getSession(),null);
 bridge.destroy();
});
test('typed operation and unknown commands never reach Worker transport',async()=>{
 const f=factory(),bridge=createLocalSaveSessionBridge(()=>f.worker);
 const receipt=await bridge.openLocalFile(file(),att);
 const count=f.sent.length;
 for(const kind of ['W1_NEXT_OCCURRENCE_CHANGE','INVENTORY_CHANGE','OWNERSHIP_CHANGE',
  'WORLD_OBJECT_CHANGE','EXPORT_EDITED_COPY','APPLY_TO_GAME','ORIGINAL_OVERWRITE','UNKNOWN']){
  await assert.rejects(bridge.submitOperation({
   kind,sessionId:receipt.sessionId,sourceSha256:receipt.sourceSha256,
   revision:0,capability:{canCommit:true},authorized:true
  }),/LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
 }
 assert.equal(f.sent.length,count,'forged client writes must be denied BEFORE postMessage');
 assert.equal(bridge.getSession()?.sessionId,receipt.sessionId);
 bridge.destroy();
});
test('forged Worker ticket with Writer authority or version mismatch is refused',async()=>{
 for(const extra of [{writerAuthorized:true},{productRustWorkerAccepted:true},
  {externalBID:'0000000000000000'},{sourceSchema:624},
  {sessionId:'caller-chosen-id'},{revision:1},{indexGeneration:-1}]){
  const f=factory({malformedReceipt:extra});
  const bridge=createLocalSaveSessionBridge(()=>f.worker);
  await assert.rejects(bridge.openLocalFile(file(),att),/LOCAL_SESSION_WORKER_RECEIPT_INVALID/);
  assert.equal(bridge.getSession(),null);
  bridge.destroy();
 }
});
test('explicit page bounds and invalid Cursor shapes do not cross Worker',async()=>{
 const f=factory(),bridge=createLocalSaveSessionBridge(()=>f.worker);
 await bridge.openLocalFile(file(),att);
 const n=f.sent.length;
 for(const args of [{limit:0},{limit:65},{limit:1.5},{search:'x'.repeat(121)},
  {cursor:'w1r1.'+'A'.repeat(180),limit:1}]){
  await assert.rejects(bridge.queryW1Page(args),/LOCAL_QUERY_BOUNDS/);
 }
 assert.equal(f.sent.length,n,'invalid queries must not reach Worker');
 bridge.destroy();
});
test('pending A query cannot publish rows after B replaces source, without loose UI session',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const f=factory({delayedRead:gate}),bridge=createLocalSaveSessionBridge(()=>f.worker);
 const a=await bridge.openLocalFile(file(),att);
 const pending=bridge.queryW1Page({limit:1});
 const rejection=assert.rejects(pending,/LOCAL_QUERY_STALE_SESSION|READ_SESSION_NOT_OPEN/);
 const b=await bridge.openLocalFile(file(),att);
 assert.notEqual(a.sessionId,b.sessionId);
 release();
 await rejection;
 assert.equal(bridge.getSession().sessionId,b.sessionId);
 bridge.destroy();
});
