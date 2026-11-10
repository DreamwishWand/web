// W-CORE-REAL-WASM-BROWSER-099: synthetic-only REAL generated Rust wasm-bindgen
// executed inside a Chrome MODULE WORKER. No P1G, cloud or UI JSON transport.
import init,{WorkerWasmSource} from './pkg/ddv_save_core.js';
import {runSavedDiffGridsBridge} from './saved-diffgrids-typed-bridge.mjs';
import {
  createProductWasmReadOwner,
  PRODUCT_WASM_WORKER_MAX_BYTES,
  PRODUCT_WASM_CHUNK_MAX_BYTES
} from '../../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const BUILD=Object.freeze({
  platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true
});
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const fail=label=>{throw Error('STAGEE_REAL_WASM_'+label)};
const assert=(condition,label)=>{if(!condition)fail(label)};
const bytes=new TextEncoder();
const fixture=()=>{
  const player={};
  for(let i=0;i<33;i++)player['field_'+String(i).padStart(3,'0')]=
    i%2?{nested:[true,null,{future:'unknown'}]}:[1,2,{future:'opaque'}];
  return bytes.encode(JSON.stringify({
    GameInfo:{Version:626},Player:player,World:{WorldRoot:{opaque:true},Clock:0},
    UnknownFuture:{large:'x'.repeat(1024*1024)}
  }));
};
async function* chunks(data){
  for(let p=0;p<data.byteLength;p+=PRODUCT_WASM_CHUNK_MAX_BYTES)
    yield data.subarray(p,Math.min(data.byteLength,p+PRODUCT_WASM_CHUNK_MAX_BYTES));
}
const factory=()=>Promise.resolve({WorkerWasmSource});
async function rejected(operation,expected){
  try{await operation()}catch(e){
    assert(String(e.message||e).includes(expected),'WRONG_NEGATIVE_'+expected);
    return;
  }
  fail('UNEXPECTED_ACCEPT_'+expected);
}
function hex(a){return [...new Uint8Array(a)].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function run(){
  assert(typeof document==='undefined','NOT_ISOLATED_WORKER');
  assert(typeof crypto?.getRandomValues==='function','WORKER_WEBCRYPTO_MISSING');
  const initAt=performance.now();
  await init(new URL('./pkg/ddv_save_core_bg.wasm',import.meta.url));
  const wasmLoadMs=Math.round(performance.now()-initAt);
  assert(typeof WorkerWasmSource==='function','GENERATED_BINDGEN_CLASS_MISSING');
  // A deliberately wrong/zero worker seed must be rejected by ACTUAL Rust WASM.
  await rejected(()=>new WorkerWasmSource(
    BUILD.platform,BUILD.buildKind,BUILD.buildId,626,true,new Uint8Array(32)
  ),'WORKER_ENTROPY_REQUIRED');
  const original=fixture();
  assert(original.byteLength>1024*1024 && original.byteLength<2*1024*1024,
    'SYNTHETIC_FIXTURE_RANGE');
  const expected=hex(await crypto.subtle.digest('SHA-256',original));
  const owner=createProductWasmReadOwner(factory);
  const started=performance.now();
  const r=await owner.openDecoded({build:BUILD,decodedChunks:chunks(original)});
  const openMs=Math.round(performance.now()-started);
  assert(r.sessionId.length===32&&!/^0+$/.test(r.sessionId),'INVALID_RUST_SESSION_ID');
  assert(r.decodedSha256===expected,'SOURCE_SHA_MISMATCH');
  assert(r.revision===0&&r.indexGeneration===1,'SESSION_REV_GEN_MISMATCH');
  assert(r.fullDocumentJsonValidated===true,'FULL_DOCUMENT_NOT_VALIDATED');
  assert(r.productReadAccepted===false&&r.writerAuthorized===false&&
    r.editedCopyAuthorized===false&&r.applyAuthorized===false,'WRITER_FLAGS_PROMOTED');
  const s=scope(r);
  const core=owner.readCoreVersion(s);
  assert(core.coreOwnedReadset==='/GameInfo/Version'&&core.writerAuthorized===false,
    'CORE_WITNESS_FAILURE');
  await rejected(()=>owner.issueTypedCursor(s,'/Secrets'),'PRODUCT_WORKER_DOMAIN_DENIED');
  const first=owner.issueTypedCursor(s,'player');
  assert(first.cursor.length===32&&!/^0+$/.test(first.cursor),'ZERO_RUST_CURSOR');
  const fieldKeys=[];
  let token=first.cursor;
  const startedPage=performance.now();
  for(let i=0;i<3;i++){
    const p=owner.readTypedPage(s,token);
    fieldKeys.push(...p.fields.map(f=>f.key));
    assert(p.fields.length===(i===2?1:16),'PAGE_COUNT');
    assert(p.fields.every(f=>f.valueBytes>0&&f.valueBytes<PRODUCT_WASM_WORKER_MAX_BYTES),
      'UNBOUNDED_FIELD_DESCRIPTOR');
    assert(p.productReadAccepted===false&&p.writerAuthorized===false,'PAGE_WRITER_PROMOTED');
    const old=token;
    token=p.nextCursor;
    await rejected(()=>owner.readTypedPage(s,old),'PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');
    if(i<2)assert(typeof token==='string'&&token!==old&&!/^0+$/.test(token),
      'CURSOR_NOT_ROTATED');
    else assert(token===null,'EOF_NOT_REVOKED');
  }
  const pageMs=Math.round(performance.now()-startedPage);
  assert(fieldKeys.length===33&&fieldKeys[0]==='field_000'&&
    fieldKeys[32]==='field_032','MISSING_PLAYER_FIELDS');
  const world=owner.issueTypedCursor(s,'world');
  const wp=owner.readTypedPage(s,world.cursor);
  assert(wp.fields.length===2&&wp.nextCursor===null,'WORLD_TYPED_PAGE');
  const stale={...s,revision:1};
  await rejected(()=>owner.issueTypedCursor(stale,'player'),'PRODUCT_WORKER_SCOPE_CAS');
  await rejected(()=>owner.issueTypedCursor({...s,uiReadset:'/Secrets'},'player'),
    'PRODUCT_WORKER_SCOPE_CAS');
  await rejected(()=>owner.submitOperation({operation:'APPLY'}),
    'PRODUCT_WORKER_WRITER_DISABLED');
  owner.close();
  await rejected(()=>owner.issueTypedCursor(s,'player'),'PRODUCT_WORKER_SESSION_CLOSED');
  assert(owner.close().closed===true,'DOUBLE_CLOSE_REJECTED');

  // Build/schema mismatch and full-document duplicate keys: genuine Rust
  // worker pipeline denies without ever yielding an accepted Product receipt.
  const bad=createProductWasmReadOwner(factory);
  await rejected(()=>bad.openDecoded({build:{...BUILD,schema:624},
      decodedChunks:chunks(original)}),'PRODUCT_WORKER_BUILD_NOT_VERIFIED');
  assert(bad.getReceipt()===null,'BAD_BUILD_SESSION_RESURRECTED');
  const malformed=bytes.encode('{"GameInfo":{"Version":626},"Player":{"a":1,"a":2},"World":{}}');
  await rejected(()=>bad.openDecoded({build:BUILD,decodedChunks:chunks(malformed)}),
    'PRODUCT_WORKER_RUST_FAILURE');
  assert(bad.getReceipt()===null,'DUPLICATE_JSON_SESSION_RESURRECTED');
  const badSchema=bytes.encode('{"GameInfo":{"Version":624},"Player":{},"World":{}}');
  await rejected(()=>bad.openDecoded({build:BUILD,decodedChunks:chunks(badSchema)}),
    'PRODUCT_WORKER_RUST_FAILURE');
  assert(bad.getReceipt()===null,'SCHEMA_MISMATCH_ACCEPTED');

  // 129 x 1MiB chunks force actual compiled Rust's strict 128MiB cap.
  // One reused chunk, no 129MiB payload sent to the UI or GitHub logs.
  const over=createProductWasmReadOwner(factory);
  const piece=new Uint8Array(PRODUCT_WASM_CHUNK_MAX_BYTES);
  async function* oversized(){for(let i=0;i<=128;i++)yield piece}
  await rejected(()=>over.openDecoded({build:BUILD,decodedChunks:oversized()}),
    'PRODUCT_WORKER_CHUNK_BOUNDS');
  assert(over.getReceipt()===null,'OVER_CAP_SESSION_ACCEPTED');

  // Missing WebCrypto is tested on a fresh facade. Do not touch the original
  // global crypto beyond an isolated, reversible Worker-local own property.
  const own=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  let missingCryptoDenied=false;
  try{
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
    const absent=createProductWasmReadOwner(factory);
    await rejected(()=>absent.openDecoded({build:BUILD,decodedChunks:chunks(original)}),
      'PRODUCT_WORKER_ENTROPY_UNAVAILABLE');
    missingCryptoDenied=true;
  }finally{
    if(own)Object.defineProperty(globalThis,'crypto',own);
    else delete globalThis.crypto;
  }
  assert(missingCryptoDenied,'MISSING_WEBCRYPTO_NOT_DENIED');
  // New R22 DEV-only Rust Worker ABI: different synthetic fixture, SAME
  // generated WASM module and isolated Chrome module Worker. No UI bridge ON.
  const savedDiffGrids=await runSavedDiffGridsBridge(WorkerWasmSource);
  assert(savedDiffGrids.records===17&&savedDiffGrids.pages===3&&
    savedDiffGrids.externalLayoutUnresolved&&!savedDiffGrids.productReadAccepted,
    'SAVED_DIFFGRIDS_REAL_WASM_BRIDGE_INVARIANT');
  return Object.freeze({
    scenario:'synthetic-real-wasm-worker-stage-e',
    browserWorker:true,generatedWasm:true,wasmBindgen:true,
    sourceBytes:original.byteLength,wasmLoadMs,openMs,pageMs,
    playerFields:fieldKeys.length,worldFields:wp.fields.length,
    coreWitness:true,actualDecodedSHA:true,
    wasmEntropyZeroDenied:true,workerMissingCryptoDenied:true,
    rustDuplicateJsonDenied:true,rustSchemaMismatchDenied:true,
    staleCASDenied:true,cursorReplayDenied:true,oversize129MiBDenied:true,
    storedDiffGridsWorkerAbi:true,storedDiffGridsRecords:savedDiffGrids.records,
    storedDiffGridsTypedPages:savedDiffGrids.pages,
    storedDiffGridsExternalLayoutUnresolved:savedDiffGrids.externalLayoutUnresolved,
    rawSavePostedToUI:false,productReadAccepted:false,writerAuthorized:false,
    realEncryptedSteamP1G:false,nativeV3:false,deviceV4:false
  });
}
self.onmessage=async e=>{
  if(e.data?.kind!=='RUN_STAGE_E')return;
  try{
    const summary=await run();
    self.postMessage({status:'PASS',summary});
  }catch(e){
    self.postMessage({status:'FAIL',error:String(e?.message||e).slice(0,400)});
  }
};
