// 05 QR-C Task099 / PR741 new-only: genuine compiled wasm-bindgen inside Chrome module Worker.
// Distinct from Owner StageE fixture: independently exercise reopen/revoke, entropy injection,
// escaped-equivalent nested JSON, strict UI summary-only transport. No P1G, keys or Writer.
import init,{WorkerWasmSource} from './pkg/ddv_save_core.js';
import {createProductWasmReadOwner,PRODUCT_WASM_CHUNK_MAX_BYTES} from
  '../../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const build=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true});
const encode=new TextEncoder();
const check=(v,label)=>{if(!v)throw Error('INDEPENDENT_STAGEE_'+label)};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const factory=async()=>({WorkerWasmSource});
const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');
async function denial(operation,phrase){
  let caught=false;
  try{await operation()}catch(e){
    check(String(e?.message||e).includes(phrase),'WRONG_DENIAL_'+phrase);
    caught=true;
  }
  check(caught,'ACCEPTED_DENIED_OPERATION_'+phrase);
}
function synthetic(){
  const player={};
  for(let n=0;n<33;n++)player['qa_field_'+String(n).padStart(3,'0')]=
    n%3===0?{future:{stillUnknown:true}}:[null,true,n];
  return encode.encode(JSON.stringify({
    GameInfo:{Version:626},Player:player,
    World:{WorldRoot:{seed:'synthetic'},Clock:42},
    UnknownFuture:{oneMegabyte:'Q'.repeat(1024*1024)}
  }));
}
async function* chunks(a){
  for(let i=0;i<a.byteLength;i+=PRODUCT_WASM_CHUNK_MAX_BYTES)
    yield a.subarray(i,Math.min(i+PRODUCT_WASM_CHUNK_MAX_BYTES,a.byteLength));
}
async function run(){
  check(typeof document==='undefined','NOT_REAL_WORKER');
  check(typeof crypto?.getRandomValues==='function' &&
    typeof crypto?.subtle?.digest==='function','NO_NATIVE_WORKER_WEBCRYPTO');
  const startWasm=performance.now();
  await init(new URL('./pkg/ddv_save_core_bg.wasm',import.meta.url));
  check(typeof WorkerWasmSource==='function','NO_GENERATED_RUST_WASM_EXPORT');
  const wasmLoadMs=Math.round(performance.now()-startWasm);
  await denial(()=>new WorkerWasmSource(build.platform,build.buildKind,
    build.buildId,626,true,new Uint8Array(32)),'WORKER_ENTROPY_REQUIRED');

  const original=synthetic();
  check(original.byteLength>1024*1024 && original.byteLength<2*1024*1024,
    'UNEXPECTED_SYNTHETIC_LENGTH');
  const digest=hex(await crypto.subtle.digest('SHA-256',original));
  const w=createProductWasmReadOwner(factory);
  const started=performance.now();
  const receipt1=await w.openDecoded({build,decodedChunks:chunks(original)});
  check(receipt1.decodedSha256===digest && receipt1.fullDocumentJsonValidated===true,
    'NATIVE_RUST_FULL_DOCUMENT_SHA_MISMATCH');
  check(receipt1.revision===0 && receipt1.indexGeneration===1 &&
    receipt1.writerAuthorized===false && receipt1.productReadAccepted===false,
    'RUST_SCOPE_OR_PERMISSION_MISMATCH');
  const openMs=Math.round(performance.now()-started);
  const s1=scope(receipt1),first=w.issueTypedCursor(s1,'player');
  check(!/^0+$/.test(first.cursor),'ZERO_CORE_CURSOR');
  const firstPage=w.readTypedPage(s1,first.cursor);
  check(firstPage.fields.length===16,'FIRST_PAGE_BOUNDS');
  await denial(()=>w.readTypedPage(s1,first.cursor),
    'PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');

  // A second OPEN synchronously revokes the entire first session and all cursors.
  const receipt2=await w.openDecoded({build,decodedChunks:chunks(original)});
  const s2=scope(receipt2);
  check(receipt2.sessionId!==receipt1.sessionId &&
    receipt2.decodedSha256===digest,'REOPEN_SESSION_NOT_FRESH');
  await denial(()=>w.readTypedPage(s1,firstPage.nextCursor),
    'PRODUCT_WORKER_SCOPE_CAS');
  await denial(()=>w.readTypedPage(s2,firstPage.nextCursor),
    'PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');
  await denial(()=>w.issueTypedCursor({...s2,uiReadset:'/Secrets'},'player'),
    'PRODUCT_WORKER_SCOPE_CAS');
  await denial(()=>w.issueTypedCursor(s2,'/Secrets'),
    'PRODUCT_WORKER_DOMAIN_DENIED');
  const t0=performance.now();
  const all=[];
  let cursor=w.issueTypedCursor(s2,'player').cursor;
  for(const count of [16,16,1]){
    const page=w.readTypedPage(s2,cursor);
    check(page.fields.length===count && page.completeAllDomains===false &&
      page.writerAuthorized===false && page.productReadAccepted===false,
      'PAGE_COUNT_OR_AUTHORIZATION');
    all.push(...page.fields.map(x=>x.key));
    const old=cursor;cursor=page.nextCursor;
    await denial(()=>w.readTypedPage(s2,old),'PRODUCT_WORKER_CURSOR_UNKNOWN_OR_CONSUMED');
  }
  const pageMs=Math.round(performance.now()-t0);
  check(cursor===null&&all.length===33&&all[0]==='qa_field_000'&&
    all[32]==='qa_field_032','EOF_OR_FIELD_ORDER');
  const world=w.issueTypedCursor(s2,'world');
  const wp=w.readTypedPage(s2,world.cursor);
  check(wp.fields.length===2&&wp.nextCursor===null,'WORLD_READSET');
  check(w.getCapabilities().canReadTypedMetadataInProduct===false &&
    w.getCapabilities().canExportEditedCopy===false,'PRODUCT_FLAG_ENABLED');
  await denial(()=>w.submitOperation({operation:'APPLY'}),'PRODUCT_WORKER_WRITER_DISABLED');
  w.close();check(w.getReceipt()===null && w.close().closed===true,'CLOSE_DID_NOT_REVOKE');
  await denial(()=>w.issueTypedCursor(s2,'player'),'PRODUCT_WORKER_SESSION_CLOSED');

  // Caller cannot inject claimed entropy: illegal extra argument must deny.
  const argsW=createProductWasmReadOwner(factory);
  await denial(()=>argsW.openDecoded({
    build,decodedChunks:chunks(original),entropy:new Uint8Array(32)
  }),'PRODUCT_WORKER_UNTRUSTED_OPEN_ARGS');
  check(argsW.getReceipt()===null,'ENTROPY_INJECTION_SESSION_CREATED');
  await denial(()=>argsW.openDecoded({
    build:{...build,schema:624},decodedChunks:chunks(original)
  }),'PRODUCT_WORKER_BUILD_NOT_VERIFIED');

  // Escaped-equivalent duplicate JSON keys are forbidden during real Rust V1
  // full-document decode, not just in the synthetic JS mocked receipt parser.
  const malformed=encode.encode(
    '{"GameInfo":{"Version":626},"Player":{"qa":1,"\\u0071a":2},"World":{}}'
  );
  await denial(()=>argsW.openDecoded({build,decodedChunks:chunks(malformed)}),
    'PRODUCT_WORKER_RUST_FAILURE');
  check(argsW.getReceipt()===null,'DUPLICATE_JSON_ISSUED_SESSION');
  const badSchema=encode.encode('{"GameInfo":{"Version":624},"Player":{},"World":{}}');
  await denial(()=>argsW.openDecoded({build,decodedChunks:chunks(badSchema)}),
    'PRODUCT_WORKER_RUST_FAILURE');
  check(argsW.getReceipt()===null,'SCHEMA_MISMATCH_ISSUED_SESSION');

  // Both per-chunk and cumulative size caps must fail closed and leave no session.
  const large=createProductWasmReadOwner(factory);
  async function* wrongChunk(){yield new Uint8Array(PRODUCT_WASM_CHUNK_MAX_BYTES+1)}
  await denial(()=>large.openDecoded({build,decodedChunks:wrongChunk()}),
    'PRODUCT_WORKER_CHUNK_BOUNDS');
  check(large.getReceipt()===null,'LARGE_CHUNK_ISSUED_SESSION');
  const limit=createProductWasmReadOwner(factory);
  const piece=new Uint8Array(PRODUCT_WASM_CHUNK_MAX_BYTES);
  async function* tooLarge(){for(let i=0;i<129;i++)yield piece}
  await denial(()=>limit.openDecoded({build,decodedChunks:tooLarge()}),
    'PRODUCT_WORKER_CHUNK_BOUNDS');
  check(limit.getReceipt()===null,'OVER128MIB_ISSUED_SESSION');

  // Missing genuine Worker WebCrypto must refuse even with working generated WASM.
  const existing=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  let missingCryptoDenied=false;
  try{
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
    const isolated=createProductWasmReadOwner(factory);
    await denial(()=>isolated.openDecoded({build,decodedChunks:chunks(original)}),
      'PRODUCT_WORKER_ENTROPY_UNAVAILABLE');
    check(isolated.getReceipt()===null,'MISSING_CRYPTO_ISSUED_SESSION');
    missingCryptoDenied=true;
  }finally{
    if(existing)Object.defineProperty(globalThis,'crypto',existing);
    else delete globalThis.crypto;
  }
  // This response contains no raw JSON/text, source SHA, private Save, or decoded fixture.
  const summary=Object.freeze({
    scenario:'synthetic-real-wasm-worker-stage-e',
    browserWorker:true,generatedWasm:true,wasmBindgen:true,
    sourceBytes:original.byteLength,wasmLoadMs,openMs,pageMs,
    playerFields:all.length,worldFields:wp.fields.length,
    coreWitness:true,actualDecodedSHA:receipt2.decodedSha256===digest,
    wasmEntropyZeroDenied:true,workerMissingCryptoDenied:missingCryptoDenied,
    rustDuplicateJsonDenied:true,rustSchemaMismatchDenied:true,
    staleCASDenied:true,cursorReplayDenied:true,oversize129MiBDenied:true,
    rawSavePostedToUI:false,productReadAccepted:false,writerAuthorized:false,
    realEncryptedSteamP1G:false,nativeV3:false,deviceV4:false
  });
  const serialized=JSON.stringify(summary);
  check(serialized.length<1024 && !serialized.includes('UnknownFuture') &&
    !serialized.includes('qa_field_') && !serialized.includes(digest) &&
    !serialized.includes(original.byteLength+'Q'),'MAIN_PAGE_DATA_LEAK');
  return summary;
}
self.onmessage=async event=>{
  if(event.data?.kind!=='RUN_STAGE_E')return;
  try{self.postMessage({status:'PASS',summary:await run()})}
  catch(e){self.postMessage({status:'FAIL',error:String(e?.message||e).slice(0,220)})}
};
