import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWasmReadOwner,PRODUCT_WASM_WORKER_MAX_BYTES,PRODUCT_WASM_CHUNK_MAX_BYTES,PRODUCT_WASM_READ_CONTRACT} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
const identity={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const source=async function*(){yield new Uint8Array([1,2,3]);yield new Uint8Array([4,5,6]);};
const receipt=()=>({contract:PRODUCT_WASM_READ_CONTRACT,sessionId:'a'.repeat(32),decodedSha256:'b'.repeat(64),revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,productWorkerBound:true,allDomainReferencesVerified:false,productReadAccepted:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
class FakeRustWasm {
 constructor(p,k,b,s,verified,entropy){this.chunks=0;this.closed=false;this.seedValid=entropy instanceof Uint8Array&&entropy.length===32&&entropy.some(x=>x!==0);assert.equal(verified,true);}
 append_chunk(c){this.chunks++;assert.ok(c.length<=PRODUCT_WASM_CHUNK_MAX_BYTES);}
 finish(){assert.ok(this.seedValid);return JSON.stringify(receipt());}
 read_core_version_witness(id,rev,gen,sha){assert.equal(id,'a'.repeat(32));assert.equal(typeof rev,'bigint');assert.equal(typeof gen,'bigint');assert.equal(BigInt.asUintN(64,rev),0n);assert.equal(BigInt.asUintN(64,gen),1n);assert.equal(sha,'b'.repeat(64));return JSON.stringify({sessionId:id,decodedSha256:sha,revision:Number(rev),indexGeneration:Number(gen),coreOwnedReadset:'/GameInfo/Version',completeAllDomains:false,writerAuthorized:false});}
 close(){this.closed=true}
}
const make=()=>createProductWasmReadOwner(async()=>({WorkerWasmSource:FakeRustWasm}));
test('Worker-only Rust receipt and fixed Core read with no Writer authority',async()=>{
 const w=make();const r=await w.openDecoded({build:identity,decodedChunks:source()});assert.deepEqual(r,receipt());
 assert.equal(w.readCoreVersion({sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256}).coreOwnedReadset,'/GameInfo/Version');
 const c=w.getCapabilities();assert.equal(c.oneRustSession,true);assert.equal(c.maxDecodedBytes,128*1024*1024);assert.equal(c.canExportEditedCopy,false);
 assert.throws(()=>w.submitOperation({kind:'STAGE'}),/PRODUCT_WORKER_WRITER_DISABLED/);
 assert.equal(w.close().writerAuthorized,false);assert.equal(w.getReceipt(),null);
 assert.throws(()=>w.readCoreVersion({}),/PRODUCT_WORKER_SESSION_CLOSED/);
});
test('wrong platform/build/version/schema/attestation closes existing session',async()=>{
 const w=make();await w.openDecoded({build:identity,decodedChunks:source()});
 for(const wrong of [{buildId:'wrong'},{schema:624},{buildKind:'switch-bid'},{platform:'switch'},{externallyConfirmed:false}]){
   await assert.rejects(w.openDecoded({build:{...identity,...wrong},decodedChunks:source()}),/PRODUCT_WORKER_BUILD_NOT_VERIFIED/);
   assert.equal(w.getReceipt(),null);
 }
});
test('forged sessionID, SHA, revision, generation and UI extra readset all denied',async()=>{
 const w=make();const r=await w.openDecoded({build:identity,decodedChunks:source()});
 const scope={sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256};
 for(const changed of [{sessionId:'c'.repeat(32)},{decodedSha256:'d'.repeat(64)},{revision:1},{indexGeneration:2},{pointer:'/World'}, {writerAuthorized:true}]){
   assert.throws(()=>w.readCoreVersion({...scope,...changed}),/PRODUCT_WORKER_SCOPE_CAS/);
 }
 assert.equal(w.getReceipt().sessionId,r.sessionId);w.close();
});
test('malformed Rust receipt cannot promote read or writer',async()=>{
 for(const changed of [{productReadAccepted:true},{writerAuthorized:true},{productWorkerBound:false},{allDomainReferencesVerified:true},{sessionId:'fake'}, {decodedSha256:'bad'}, {schema:624}]){
   class ForgedWasm extends FakeRustWasm {finish(){return JSON.stringify({...receipt(),...changed})}}
   const w=createProductWasmReadOwner(async()=>({WorkerWasmSource:ForgedWasm}));
   await assert.rejects(w.openDecoded({build:identity,decodedChunks:source()}),/PRODUCT_WORKER_RUST_RECEIPT_INVALID/);
   assert.equal(w.getReceipt(),null);
 }
});
test('malformed Core read response cannot promote Writer or UI readset',async()=>{
 for(const changed of [{writerAuthorized:true},{coreOwnedReadset:'/World'},{completeAllDomains:true},{sessionId:'c'.repeat(32)}]){
   class ForgedRead extends FakeRustWasm {read_core_version_witness(){return JSON.stringify({sessionId:'a'.repeat(32),revision:0,indexGeneration:1,decodedSha256:'b'.repeat(64),coreOwnedReadset:'/GameInfo/Version',completeAllDomains:false,writerAuthorized:false,...changed})}}
   const w=createProductWasmReadOwner(async()=>({WorkerWasmSource:ForgedRead}));const r=await w.openDecoded({build:identity,decodedChunks:source()});
   assert.throws(()=>w.readCoreVersion({sessionId:r.sessionId,revision:0,indexGeneration:1,decodedSha256:r.decodedSha256}),/PRODUCT_WORKER_RUST_READ_RECEIPT_INVALID/);w.close();
 }
});
test('empty, nonbyte and >1 MiB chunk fail before WASM transfer',async()=>{
 const w=make();const build=identity;
 for(const iterable of [async function*(){},async function*(){yield 'fake';},async function*(){yield new Uint8Array(0);},async function*(){yield new Uint8Array(PRODUCT_WASM_CHUNK_MAX_BYTES+1); }]){
    await assert.rejects(w.openDecoded({build,decodedChunks:iterable()}),/PRODUCT_WORKER_EMPTY_DOCUMENT|PRODUCT_WORKER_CHUNK_BOUNDS/);
    assert.equal(w.getReceipt(),null);
 }
 assert.equal(PRODUCT_WASM_WORKER_MAX_BYTES,128*1024*1024);
});
test('Open A blocked on wasm loader cannot resurrect after Close or Open B',async()=>{
 let release;const stalled=new Promise(r=>release=r);let starts=0;
 const w=createProductWasmReadOwner(async()=>{starts++;if(starts===1)await stalled;return {WorkerWasmSource:FakeRustWasm}});
 const a=w.openDecoded({build:identity,decodedChunks:source()});w.close();
 const b=w.openDecoded({build:identity,decodedChunks:source()});release();
 await assert.rejects(a,/PRODUCT_WORKER_OPEN_REVOKED/);const r=await b;
 assert.equal(w.getReceipt().sessionId,r.sessionId);w.close();
});
test('Open A blocked on chunks cannot resurrect after Close',async()=>{
 let release;const stalled=new Promise(r=>release=r);
 const src=async function*(){yield new Uint8Array([1]);await stalled;yield new Uint8Array([2]);};
 const w=make();const a=w.openDecoded({build:identity,decodedChunks:src()});
 await new Promise(r=>setImmediate(r));w.close();release();
 await assert.rejects(a,/PRODUCT_WORKER_OPEN_REVOKED/);assert.equal(w.getReceipt(),null);
});
test('missing WASM source or entropy and UI-context deny fail closed',async()=>{
 const w=createProductWasmReadOwner(async()=>null);
 await assert.rejects(w.openDecoded({build:identity,decodedChunks:source()}),/PRODUCT_WORKER_WASM_UNAVAILABLE/);
 await assert.rejects(w.openDecoded({build:identity,decodedChunks:null}),/PRODUCT_WORKER_CHUNK_SOURCE_REQUIRED/);
});

const collSelector={definitionId:2120000001,groupIndex:0,itemId:40000001};
const collReceipt=(build,selector,id,rev,gen,sha)=>({contract:'wand.worker.collection-scoped-candidate@1',
 platform:build.platform==='steam-windows'?'SteamWindows':'Switch',buildKind:build.platform==='steam-windows'?'SteamFullVersion':'SwitchBid',buildId:build.buildId,
 sessionId:id,revision:Number(rev),indexGeneration:Number(gen),decodedSha256:sha,...selector,old:false,new:true,falseCount:3,positiveStock:1,
 itemDefinitionSha256:sha,collectionDefinitionSha256:sha,groupDefinitionSha256:sha,entrySha256:sha,groupSha256:sha,mapSha256:sha,stockEntrySha256:sha,
 packagedCandidateVerified:true,sourcePhysicalVerified:true,effectiveEligibilityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false});
class CollectionRust extends FakeRustWasm{
 constructor(p,k,b,...rest){super(p,k,b,...rest);this.build={platform:p,buildKind:k,buildId:b};}
 preview_scoped_collection_candidate(def,group,item,id,rev,gen,sha){
  assert.equal(this.closed,false);assert.equal(id,receipt().sessionId);assert.equal(rev,0n);assert.equal(gen,1n);assert.equal(sha,receipt().decodedSha256);
  assert.deepEqual({definitionId:def,groupIndex:group,itemId:item},collSelector);
  return JSON.stringify(collReceipt(this.build,collSelector,id,rev,gen,sha));
 }
}
const collectionOwner=(C=CollectionRust)=>createProductWasmReadOwner(async()=>({WorkerWasmSource:C}),{allowCollectionCandidateSource:true});
test('Collection candidate opt-in uses same existing owner, both Builds, no authority',async()=>{
 const off=make();await off.openDecoded({build:identity,decodedChunks:source()});assert.equal(off.readCollectionCandidate,undefined);off.close();
 for(const build of [identity,{...identity,platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D'}]){
  const w=collectionOwner();await assert.rejects(w.readCollectionCandidate(collSelector),/CANDIDATE_OFF/);
  const r=await w.openDecoded({build,decodedChunks:source()});const x=await w.readCollectionCandidate(collSelector);
  assert.equal(x.platform,build.platform);assert.equal(x.kind,'COLLECTION_CANDIDATE_READ_ONLY');assert.equal(x.effectiveEligibilityVerified,false);
  assert.equal(x.writerAuthorized,false);assert.equal(x.editedCopyAuthorized,false);assert.equal(x.applyAuthorized,false);
  assert.equal(w.getReceipt(),r);assert.equal(w.getCapabilities().canStage,false);assert.throws(()=>w.submitOperation({kind:'STAGE'}),/WRITER_DISABLED/);
  assert.equal('sessionId' in x,false);assert.equal('entrySha256' in x,false);w.close();
  await assert.rejects(w.readCollectionCandidate(collSelector),/CANDIDATE_OFF/);
 }
});
test('Collection candidate import boundary snapshots selector and rejects stale A after close/reopen',async()=>{
 const w=collectionOwner();await w.openDecoded({build:identity,decodedChunks:source()});
 const s={...collSelector},pending=w.readCollectionCandidate(s);s.itemId=40000002;
 assert.equal((await pending).itemId,collSelector.itemId);
 const old=w.readCollectionCandidate(collSelector);w.close();
 const rejected=assert.rejects(old,/CANDIDATE_OFF/);
 const newer=await w.openDecoded({build:identity,decodedChunks:source()});await rejected;
 assert.equal(w.getReceipt(),newer);assert.equal((await w.readCollectionCandidate(collSelector)).itemId,collSelector.itemId);w.close();
});
test('Collection candidate strict parser rejects duplicate keys and forged authority; exact active session revoked',async()=>{
 for(const type of ['duplicate','authority']){
  class Bad extends CollectionRust{preview_scoped_collection_candidate(...args){const raw=super.preview_scoped_collection_candidate(...args);return type==='duplicate'?raw.slice(0,-1)+',"writerAuthorized":false}':JSON.stringify({...JSON.parse(raw),writerAuthorized:true});}}
  const w=collectionOwner(Bad);await w.openDecoded({build:identity,decodedChunks:source()});
  await assert.rejects(w.readCollectionCandidate(collSelector),/COLLECTION_CANDIDATE_READ_DENIED/);assert.equal(w.getReceipt(),null);
 }
 const w=collectionOwner(FakeRustWasm);const r=await w.openDecoded({build:identity,decodedChunks:source()});
 await assert.rejects(w.readCollectionCandidate({...collSelector,sessionId:r.sessionId}),/CANDIDATE_SELECTOR/);
 await assert.rejects(w.readCollectionCandidate(collSelector),/COLLECTION_CANDIDATE_READ_DENIED/);assert.equal(w.getReceipt(),r);w.close();
});
