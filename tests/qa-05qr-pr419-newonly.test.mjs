// Independent PR419 three-domain read facade scoped to PR394 Worker READ only.
import test from 'node:test';import assert from 'node:assert/strict';
import {describeThreeDomainReadCapabilities,readThreeDomainPage,
 LOCAL_THREE_DOMAIN_PRODUCT_WRITER_ENABLED,LOCAL_THREE_DOMAIN_200MIB_JS_READ_ENABLED}
 from '../src/lib/ddv/core/save/three-domain-read-facade.mjs';
const receipt={contract:'wand.local.save-session.read@1',platform:'switch',
 fullVersion:'1.25.3',buildKind:'switch-bid',buildId:'9A239D3DB569756D',
 schema:626,sourceIdentity:'externally-attested-switch-bid',
 sessionId:'a'.repeat(32),sourceSha256:'b'.repeat(64),registrySha256:'c'.repeat(64),
 revision:0,indexGeneration:1,writerAuthorized:false,productRustWorkerAccepted:false};
const caps={contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
 supportedBID:'9A239D3DB569756D',supportedSchema:626,supportedFullVersion:'1.25.3',
 canCommit:false,canEncodeEditedCopy:false,canApply:false,canReplaceOriginal:false,
 readCompleteAllDomains:false,readW1RecurringEvents:true,readInventory:false,
 readOwnership:false,readGrid:false};
const row={mapKey:'155',eventId:2010000021,oneof:'ItemSpawning',
 nextOccurrence:'2126-08-20T00:00:00Z',
 maliciousRawProfile:{Player:{secret:'Never leak to UI'}}};
const response=(opts={})=>({
 sessionId:receipt.sessionId,sourceSha256:receipt.sourceSha256,
 revision:0,indexGeneration:1,total:1,rows:[row],complete:true,nextCursor:null,
 writerAuthorized:false,productRustWorkerAccepted:false,...opts});
const bridge=(session=receipt,capabilities=caps,reply=response())=>({
 getSession:()=>session,getCapabilities:()=>capabilities,readDomainPage:async()=>reply
});
test('only Timing allowed; forged Collection/World full capabilities still denied BEFORE Worker',async()=>{
 let calls=0;
 const c={...caps,readOwnership:true,readGrid:true,readInventory:true};
 const b={...bridge(receipt,c),readDomainPage:async()=>{calls++;return response();}};
 for(const domain of ['Collection','World','Inventory','Spatial']){
  await assert.rejects(readThreeDomainPage(b,{domain}),/LOCAL_DOMAIN_READ_NOT_ACCEPTED|LOCAL_DOMAIN_NOT_MODELLED/);
 }
 assert.equal(calls,0);
 const d=describeThreeDomainReadCapabilities(b);
 assert.equal(d.domains.Collection.workerReadAvailable,false);
 assert.equal(d.domains.World.workerReadAvailable,false);
 assert.equal(d.domains.Timing.workerReadAvailable,false,'forged completeAllDomains cannot mint typed read');
 assert.equal(d.read200MiBSupported,false);
 assert.equal(LOCAL_THREE_DOMAIN_200MIB_JS_READ_ENABLED,false);
 assert.equal(LOCAL_THREE_DOMAIN_PRODUCT_WRITER_ENABLED,false);
});
test('strict single-session W1 DTO strips arbitrary decoded original and denies Writer',async()=>{
 const b=bridge(),out=await readThreeDomainPage(b,{domain:'Timing',limit:1});
 assert.equal(out.rows.length,1);
 assert.deepEqual(out.rows[0],{mapKey:'155',eventId:2010000021,
  oneof:'ItemSpawning',nextOccurrence:'2126-08-20T00:00:00Z',editable:false});
 assert.equal('maliciousRawProfile' in out.rows[0],false);
 assert.equal(out.writerAuthorized,false);
 assert.equal(out.nativeV3Accepted,false);
 assert.equal(out.personalCollectionOwned,'UNKNOWN');
 assert.equal(out.personalPercentage,null);
 assert.equal(describeThreeDomainReadCapabilities(b).domains.Timing.workerReadAvailable,true);
});
test('Stale A reply cannot display after B changed SHA/session/index; copied same fields not sufficient',async()=>{
 let release;const promise=new Promise(resolve=>release=resolve);
 let curr=receipt;
 const b={getSession:()=>curr,getCapabilities:()=>caps,readDomainPage:async()=>promise};
 const result=readThreeDomainPage(b,{domain:'Timing'});
 curr={...receipt,sourceSha256:'d'.repeat(64),sessionId:'e'.repeat(32),indexGeneration:2};
 release(response());
 await assert.rejects(result,/LOCAL_DOMAIN_SESSION_CHANGED_DURING_READ/);
});
test('Wrong BID/full version/schema/RegistrySHA/SHA/Writer receipt and mutated worker page denied',async()=>{
 for(const delta of [{buildId:'52BD625D9B4E0053'},{fullVersion:'1.25.0'},
   {schema:624},{registrySha256:'x'}, {sourceSha256:'x'}, {writerAuthorized:true},
   {indexGeneration:-1},{revision:1}]){
  const b=bridge({...receipt,...delta});
  assert.equal(describeThreeDomainReadCapabilities(b).sessionBound,false);
  await assert.rejects(readThreeDomainPage(b,{domain:'Timing'}),/LOCAL_DOMAIN_SESSION_PROVENANCE_UNVERIFIED/);
 }
 for(const delta of [{sourceSha256:'0'.repeat(64)},{sessionId:'x'.repeat(32)},
  {writerAuthorized:true},{productRustWorkerAccepted:true},
  {rows:[{...row,mapKey:'not-a-key'}]},
  {rows:[{...row,nextOccurrence:{raw:'source'}}]},
  {rows:[row,row],total:1}]){
  await assert.rejects(readThreeDomainPage(bridge(receipt,caps,response(delta)),
   {domain:'Timing',limit:1}),/LOCAL_DOMAIN_WORKER_RESULT_UNTRUSTED|LOCAL_DOMAIN_ROW_INVALID/);
 }
});
