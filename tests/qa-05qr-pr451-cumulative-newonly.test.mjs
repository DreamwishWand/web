// 05 QR new-only cumulative PR451: accepted PR410+PR419 on current-main PR394 ABI.
// This does NOT rerun standalone QA435/438, or claim real private P1G, Rust V2 or Native V3.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimingWorkerReadCore,SWITCH_1253_BID} from '../src/lib/timing/local-worker-read-core.mjs';
import {createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {readThreeDomainPage,describeThreeDomainReadCapabilities}
 from '../src/lib/ddv/core/save/three-domain-read-facade.mjs';
const OLD='2126-08-20T00:00:00Z';
const att=Object.freeze({platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
 buildId:SWITCH_1253_BID,schema:626,externallyConfirmed:true});
let current;
const doc=(date=OLD,complete=true)=>({GameInfo:{Version:626},Player:{UnknownPrivate:'NEVER_UI'},
 World:{RecurringEvents:{'155':{ItemSpawning:{RecurringEventItemID:2010000021,
  NextOccurrence:date,LastOccurrence:'2026-10-01T00:00:00Z',
  ...(complete?{EndDate:'2030-12-31T00:00:00Z'}:{})}}},
 GridCollection:{Grids:{},...(complete?{DiffGrids:{}}:{})},
 Villages:[]}});
const rows=p=>[{mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',
 nextOccurrence:p.World.RecurringEvents['155'].ItemSpawning.NextOccurrence,
 rawProfile:p.Player}];
const newFile=name=>Object.assign(new Blob([new TextEncoder().encode(name)]),{name});
function build(){
 const sent=[], listeners=new Map();
 const core=createTimingWorkerReadCore({
  openSave:async()=>({inputFormat:'packaged',profileSchemaVersion:626,profile:current,
   compatibility:{productionReadAccepted:true,readOnly:true,
   editingAuthorized:false,persistentWriteAuthorized:false}}),
  project:p=>({rows:rows(p),savedContainerCount:1,unsupportedContainerCount:0,
   writerAuthorized:false,encodeCopyAuthorized:false}),
  filter:(all,q)=>all.filter(r=>JSON.stringify(r).toLowerCase().includes(q)),
  loadRegistry:async()=>({fixed:'QA451-LOCAL-ONLY'})
 });
 const dispatch=(type,data)=>{for(const fn of listeners.get(type)||[])fn({data})};
 const w={
  addEventListener(type,cb){listeners.set(type,[...(listeners.get(type)||[]),cb]);},
  postMessage(m){
   sent.push(m);
   Promise.resolve().then(async()=>{try{
    let result;
    switch(m.type){
     case 'CLOSE':result=core.close();break;
     case 'OPEN_FILE':result=await core.open({
      file:m.file,buildId:m.buildId,sourceConfirmed:m.sourceConfirmed,
      platform:m.platform,fullVersion:m.fullVersion,buildKind:m.buildKind,
      sourceSchema:m.sourceSchema});break;
     case 'QUERY':result=await core.query({search:m.search,cursor:m.cursor,limit:m.limit});break;
     case 'DIAGNOSE_W1':result=core.diagnose();break;
     default:throw Error('READ_WRITER_OPERATION_DISABLED');
    }
    dispatch('message',{id:m.id,ok:true,result});
   }catch(err){dispatch('message',{id:m.id,ok:false,error:err.message});}});
  },terminate(){core.close();}
 };
 queueMicrotask(()=>dispatch('message',{id:0,ready:true,writerAuthorized:false}));
 return {w,core,sent};
}
const scope=r=>({sessionId:r.sessionId,sourceSha256:r.sourceSha256,
 revision:r.revision,indexGeneration:r.indexGeneration});
test('One real shared API bridge Session drives Worker-derived 8 refs and read-only Timing facade together',async()=>{
 current=doc();const f=build(),bridge=createLocalSaveSessionBridge(()=>f.w);
 const session=await bridge.openLocalFile(newFile('A'),att);
 const diag=await bridge.diagnoseW1Dependencies(scope(session));
 const caps=describeThreeDomainReadCapabilities(bridge);
 assert.equal(diag.referenceCount,8);assert.equal(diag.presentCount,8);
 assert.equal(diag.allSourceReferencesPresent,true);
 assert.equal(diag.sourceSha256,session.sourceSha256);
 assert.equal(diag.indexGeneration,session.indexGeneration);
 assert.equal(caps.domains.Timing.workerReadAvailable,true);
 assert.equal(caps.domains.Collection.workerReadAvailable,false);
 assert.equal(caps.domains.World.workerReadAvailable,false);
 assert.equal(caps.canEncodeEditedCopy,false);
 const output=await readThreeDomainPage(bridge,{domain:'Timing',search:'',limit:1});
 assert.equal(output.sourceSha256,diag.sourceSha256);
 assert.equal(output.rows.length,1);
 assert.equal(output.rows[0].nextOccurrence,OLD);
 assert.equal(output.rows[0].rawProfile,undefined);
 assert.equal(output.rows[0].editable,false);
 assert.equal(JSON.stringify(diag).includes(OLD),false);
 assert.equal(session.writerAuthorized,false);
 assert.equal(LOCAL_MAX_P1G_BYTES,128*1024*1024);
 assert.equal(f.sent.filter(m=>m.type==='OPEN_FILE').length,1);
 assert.equal(f.sent.filter(m=>m.type==='DIAGNOSE_W1').length,1);
 assert.equal(f.sent.filter(m=>m.type==='QUERY').length,1);
 bridge.destroy();
});
test('Missing two native roots is diagnostic only: W1 timing still read, Collection/World never consulted',async()=>{
 current=doc(OLD,false);const f=build(),bridge=createLocalSaveSessionBridge(()=>f.w);
 const s=await bridge.openLocalFile(newFile('absent'),att);
 const d=await bridge.diagnoseW1Dependencies(scope(s));
 assert.equal(d.allSourceReferencesPresent,false);
 assert.equal(d.presentCount,6);
 assert.ok(d.missingReferences.includes('World.GridCollection.DiffGrids'));
 assert.ok(d.missingReferences.some(v=>v.endsWith('EndDate')));
 const n=f.sent.length;
 for(const domain of ['Collection','World','Inventory']){
  await assert.rejects(readThreeDomainPage(bridge,{domain}),
    /LOCAL_DOMAIN_READ_NOT_ACCEPTED|LOCAL_DOMAIN_NOT_MODELLED/);
 }
 assert.equal(f.sent.length,n,'No Worker requests for unaccepted domains');
 const page=await readThreeDomainPage(bridge,{domain:'Timing',limit:1});
 assert.equal(page.rows.length,1);
 assert.equal(page.nativeV3Accepted,false);
 assert.equal(page.writerAuthorized,false);
 assert.equal(d.operationWriterAuthorized,false);
 bridge.destroy();
});
test('A→B updates same bridge source lease; old diagnostic scope and any forged native capability rejected before Worker',async()=>{
 current=doc();const f=build(),bridge=createLocalSaveSessionBridge(()=>f.w);
 const a=await bridge.openLocalFile(newFile('A'),att),old=scope(a);
 const before=await readThreeDomainPage(bridge,{domain:'Timing',limit:1});
 assert.equal(before.rows[0].nextOccurrence,OLD);
 current=doc('2026-11-04T00:00:00Z',false);
 const b=await bridge.openLocalFile(newFile('B'),att);
 assert.notEqual(b.sourceSha256,a.sourceSha256);
 assert.notEqual(b.sessionId,a.sessionId);
 const beforeSend=f.sent.length;
 for(const forgery of [old,{...scope(b),sourceReadSet:[]},
  {...scope(b),nativeV3Accepted:true},{...scope(b),sourceSha256:a.sourceSha256}]){
  await assert.rejects(bridge.diagnoseW1Dependencies(forgery),
   /LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE/);
 }
 assert.equal(f.sent.length,beforeSend);
 const fresh=await bridge.diagnoseW1Dependencies(scope(b));
 assert.equal(fresh.presentCount,6);
 const page=await readThreeDomainPage(bridge,{domain:'Timing'});
 assert.equal(page.rows[0].nextOccurrence,'2026-11-04T00:00:00Z');
 await assert.rejects(bridge.submitOperation({kind:'W1_TRANSACTION'}),
  /LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
 const beforeDenied=f.sent.length;
 await assert.rejects(readThreeDomainPage(bridge,{domain:'World'}),
  /LOCAL_DOMAIN_READ_NOT_ACCEPTED/);
 assert.equal(f.sent.length,beforeDenied);
 bridge.destroy();
});
test('Wrong external source version/BID and hacked DTO reject without minting Source or Write authority',async()=>{
 current=doc();const f=build(),bridge=createLocalSaveSessionBridge(()=>f.w);
 for(const bad of [{...att,fullVersion:'1.25.0'}, {...att,buildId:'52BD625D9B4E0053'},
  {...att,schema:624},{...att,externallyConfirmed:false}]){
  await assert.rejects(bridge.openLocalFile(newFile('bad'),bad),
   /LOCAL_BUILD_VERSION_BID_SCHEMA_DENIED/);
  assert.equal(bridge.getSession(),null);
 }
 const s=await bridge.openLocalFile(newFile('accepted'),att);
 const c={...bridge.getCapabilities(),readGrid:true,readOwnership:true};
 const fake={getSession:()=>s,getCapabilities:()=>c,
  readDomainPage:()=>{throw Error('SENT_TO_WORKER');}};
 for(const domain of ['Collection','World']){
  await assert.rejects(readThreeDomainPage(fake,{domain}),/LOCAL_DOMAIN_READ_NOT_ACCEPTED/);
 }
 assert.equal(describeThreeDomainReadCapabilities(fake).domains.Collection.workerReadAvailable,false);
 assert.equal(describeThreeDomainReadCapabilities(fake).domains.World.workerReadAvailable,false);
 assert.equal(bridge.getCapabilities().canCommit,false);
 assert.equal(bridge.getCapabilities().canApply,false);
 bridge.destroy();
});
