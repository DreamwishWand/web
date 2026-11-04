import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_THREE_DOMAIN_READ_CONTRACT,
  LOCAL_THREE_DOMAIN_PRODUCT_WRITER_ENABLED,
  LOCAL_THREE_DOMAIN_200MIB_JS_READ_ENABLED,
  describeThreeDomainReadCapabilities,readThreeDomainPage
} from '../src/lib/ddv/core/save/three-domain-read-facade.mjs';
const goodReceipt=Object.freeze({
 contract:'wand.local.save-session.read@1',platform:'switch',
 fullVersion:'1.25.3',buildKind:'switch-bid',buildId:'9A239D3DB569756D',
 schema:626,sourceIdentity:'externally-attested-switch-bid',
 sessionId:'a'.repeat(32),sourceSha256:'b'.repeat(64),
 registrySha256:'c'.repeat(64),revision:0,indexGeneration:1,
 writerAuthorized:false,productRustWorkerAccepted:false
});
const goodCaps=Object.freeze({
 contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
 supportedBID:'9A239D3DB569756D',supportedSchema:626,
 supportedFullVersion:'1.25.3',
 canCommit:false,canEncodeEditedCopy:false,canApply:false,
 canReplaceOriginal:false,readCompleteAllDomains:false,
 readW1RecurringEvents:true,readInventory:false,readOwnership:false,readGrid:false
});
const row=Object.freeze({
 mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',
 nextOccurrence:'2126-08-20T00:00:00Z',
 userPrivateRawSave:{World:{secret:'do-not-project'}}
});
const ok=(o={})=>({
 sessionId:goodReceipt.sessionId,sourceSha256:goodReceipt.sourceSha256,
 revision:0,indexGeneration:1,
 rows:[row],total:1,complete:true,nextCursor:null,
 writerAuthorized:false,productRustWorkerAccepted:false,...o
});
const mock=(receipt=goodReceipt,caps=goodCaps,reply=ok())=>({
 getSession:()=>receipt,getCapabilities:()=>caps,
 readDomainPage:async()=>reply
});
test('Capability source is PR394-only W1 Timing, Collection/World fail closed',()=>{
 const r=describeThreeDomainReadCapabilities(mock());
 assert.equal(r.contract,LOCAL_THREE_DOMAIN_READ_CONTRACT);
 assert.equal(r.sessionBound,true);
 assert.equal(r.domains.Timing.workerReadAvailable,true);
 assert.equal(r.domains.Collection.workerReadAvailable,false);
 assert.equal(r.domains.World.workerReadAvailable,false);
 assert.equal(r.domains.Collection.readPersonalOwnership,false);
 assert.equal(r.domains.World.nativeV3Accepted,false);
 assert.equal(r.canEncodeEditedCopy,false);
 assert.equal(r.canReplaceOriginal,false);
 assert.equal(r.read200MiBSupported,false);
 assert.equal(LOCAL_THREE_DOMAIN_200MIB_JS_READ_ENABLED,false);
 assert.equal(LOCAL_THREE_DOMAIN_PRODUCT_WRITER_ENABLED,false);
});
test('Bounded W1 Timing read passes Core-issued source scope and strips untrusted raw response properties',async()=>{
 let asked=null;
 const b={...mock(),readDomainPage:async q=>{asked=q;return ok();}};
 const r=await readThreeDomainPage(b,{domain:'Timing',search:'wood',limit:1});
 assert.equal(asked.domain,'RecurringEvents');
 assert.equal(asked.sourceSha256,goodReceipt.sourceSha256);
 assert.equal(asked.sessionId,goodReceipt.sessionId);
 assert.equal(asked.revision,0);
 assert.equal(asked.indexGeneration,1);
 assert.equal(r.status,'WORKER_W1_READ_ONLY');
 assert.deepEqual(r.rows,[{
  mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',
  nextOccurrence:'2126-08-20T00:00:00Z',editable:false
 }]);
 assert.equal(r.rows[0].userPrivateRawSave,undefined);
 assert.equal(r.writerAuthorized,false);
 assert.equal(r.nativeV3Accepted,false);
 assert.equal(r.personalPercentage,null);
});
test('Unknown domain, Collection and World cannot query the Worker, even if UI claims all caps true',async()=>{
 let calls=0;
 const fakeCaps={...goodCaps,readGrid:true,readOwnership:true,readInventory:true,
   readCompleteAllDomains:true};
 const b={...mock(goodReceipt,fakeCaps),readDomainPage:async()=>{calls++;return ok();}};
 for(const domain of ['Collection','World','Inventory','Unknown',null]){
  await assert.rejects(readThreeDomainPage(b,{domain}),/LOCAL_DOMAIN_READ_NOT_ACCEPTED|LOCAL_DOMAIN_NOT_MODELLED/);
 }
 assert.equal(calls,0);
 const r=describeThreeDomainReadCapabilities(b);
 assert.equal(r.domains.Collection.workerReadAvailable,false);
 assert.equal(r.domains.World.workerReadAvailable,false);
});
test('Wrong BID/Schema/full version/source/RegistrySHA/session generation never mints W1 read',async()=>{
 for(const receipt of [
  {...goodReceipt,buildId:'52BD625D9B4E0053'},
  {...goodReceipt,schema:624},
  {...goodReceipt,fullVersion:'1.25.0'},
  {...goodReceipt,sourceSha256:'malformed'},
  {...goodReceipt,registrySha256:'malformed'},
  {...goodReceipt,revision:1},
  {...goodReceipt,indexGeneration:0},
  {...goodReceipt,writerAuthorized:true},
  {...goodReceipt,sourceIdentity:'schema-inferred'},
  null
 ]){
  const b=mock(receipt);
  assert.equal(describeThreeDomainReadCapabilities(b).domains.Timing.workerReadAvailable,false);
  await assert.rejects(readThreeDomainPage(b,{domain:'Timing'}),/LOCAL_DOMAIN_SESSION_PROVENANCE_UNVERIFIED/);
 }
});
test('A to B source re-open during a pending query cannot show the old page',async()=>{
 let resolve;
 const pending=new Promise(r=>resolve=r);
 let current=goodReceipt;
 const bridge={getSession:()=>current,getCapabilities:()=>goodCaps,
   readDomainPage:async()=>pending};
 const request=readThreeDomainPage(bridge,{domain:'Timing'});
 current={...goodReceipt,sessionId:'d'.repeat(32)};
 resolve(ok());
 await assert.rejects(request,/LOCAL_DOMAIN_SESSION_CHANGED_DURING_READ/);
});
test('Cursor, search and limit bounds and Worker-forged page reject before UI projection',async()=>{
 for(const query of [
  {domain:'Timing',limit:65},{domain:'Timing',limit:0},
  {domain:'Timing',search:'x'.repeat(121)},
  {domain:'Timing',cursor:'x'.repeat(161)}
 ])await assert.rejects(readThreeDomainPage(mock(),query),/LOCAL_DOMAIN_QUERY_BOUNDS/);
 for(const forged of [
  {writerAuthorized:true},{productRustWorkerAccepted:true},
  {sourceSha256:'f'.repeat(64)},{sessionId:'f'.repeat(32)},
  {revision:1},{indexGeneration:99},{complete:'true'},
  {rows:[{...row,mapKey:'not-a-map-key'}]},
  {rows:[{...row,nextOccurrence:{json:'raw'}}]},
  {total:0}
 ]){
  const b=mock(goodReceipt,goodCaps,ok(forged));
  await assert.rejects(readThreeDomainPage(b,{domain:'Timing'}),/LOCAL_DOMAIN_WORKER_RESULT_UNTRUSTED|LOCAL_DOMAIN_ROW_INVALID/);
 }
});
