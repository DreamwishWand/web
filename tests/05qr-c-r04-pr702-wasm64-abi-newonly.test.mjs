// 05 QR-C R04 NEW_ONLY — immutable PR702, synthetic Wasm-bindgen JS ABI witness.
// Never import private Steam Save, keys or P1G. This is NOT actual browser WASM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createProductWasmReadOwner,
  PRODUCT_WASM_READ_CONTRACT
} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const build={
  platform:'steam-windows',
  buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,
  externallyConfirmed:true
};
const chunks=async function*() {yield new Uint8Array([123,125]);};
const receipt=()=>({
  contract:PRODUCT_WASM_READ_CONTRACT,
  sessionId:'a'.repeat(32),decodedSha256:'b'.repeat(64),
  revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,
  productWorkerBound:true,allDomainReferencesVerified:false,
  productReadAccepted:false,writerAuthorized:false,
  editedCopyAuthorized:false,applyAuthorized:false
});
function scope(r) {
  return {
    sessionId:r.sessionId,revision:r.revision,
    indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256
  };
}
class WasmGlueStyle {
  constructor(platform,kind,id,schema,verified,entropy) {
    assert.equal(verified,true);
    assert.ok(entropy instanceof Uint8Array && entropy.length===32);
    this.closed=false;
  }
  append_chunk(c) { assert.ok(c instanceof Uint8Array); }
  finish() { return JSON.stringify(receipt()); }
  // The generated Wasm i64/u64 binding requires BigInt. This is a faithful
  // signed 64-bit coercion boundary, NOT a compiled or browser WASM runtime.
  read_core_version_witness(id,revision,indexGeneration,sha) {
    BigInt.asUintN(64,revision);
    BigInt.asUintN(64,indexGeneration);
    return JSON.stringify({
      sessionId:id,revision:0,indexGeneration:1,decodedSha256:sha,
      coreOwnedReadset:'/GameInfo/Version',completeAllDomains:false,
      writerAuthorized:false
    });
  }
  close() {this.closed=true;}
}
const make=()=>createProductWasmReadOwner(async()=>({WorkerWasmSource:WasmGlueStyle}));

test('R04-Q01 valid JS/Worker read must cross true wasm-bindgen u64 BigInt call boundary',async()=>{
  const owner=make(),r=await owner.openDecoded({build,decodedChunks:chunks()});
  assert.equal(r.productReadAccepted,false);
  assert.equal(r.writerAuthorized,false);
  // This is expected to fail against PR702: JS passes 0 as Number,
  // so BigInt.asUintN rejects it as a TypeError before Rust is called.
  const read=owner.readCoreVersion(scope(r));
  assert.equal(read.coreOwnedReadset,'/GameInfo/Version');
  assert.equal(read.writerAuthorized,false);
  owner.close();
});

test('R04-Q02 static exact u64-to-Number mismatch witness is anchored to two changed sources',()=>{
  const rust=readFileSync(new URL('../crates/ddv-save-core/src/wasm_worker.rs',import.meta.url),'utf8');
  const types=readFileSync(new URL('../src/lib/ddv/core/save/product-wasm-read-owner.d.mts',import.meta.url),'utf8');
  const js=readFileSync(new URL('../src/lib/ddv/core/save/product-wasm-read-owner.mjs',import.meta.url),'utf8');
  assert.match(rust,/read_core_version_witness\(&self,session_id:&str,\s*revision:u64,index_generation:u64,decoded_sha256:&str/);
  assert.match(types,/read_core_version_witness\(sessionId:string,revision:number,indexGeneration:number,decodedSha256:string\)/);
  assert.match(js,/scope\.revision,scope\.indexGeneration,scope\.decodedSha256/);
  assert.doesNotMatch(js,/BigInt\s*\(\s*scope\.(?:revision|indexGeneration)\s*\)/);
});

test('R04-Q03 forged UI ReadSet, Revision, SHA and Writer command are still rejected',async()=>{
  const owner=make(),r=await owner.openDecoded({build,decodedChunks:chunks()});
  const original=scope(r);
  for(const extra of [{pointer:'/World'},{indexGeneration:2},{revision:1},{decodedSha256:'c'.repeat(64)},{writerAuthorized:true}]){
    assert.throws(()=>owner.readCoreVersion({...original,...extra}),/PRODUCT_WORKER_SCOPE_CAS/);
  }
  assert.throws(()=>owner.submitOperation({kind:'EXPORT'}),/PRODUCT_WORKER_WRITER_DISABLED/);
  assert.equal(owner.close().writerAuthorized,false);
  assert.throws(()=>owner.readCoreVersion(original),/PRODUCT_WORKER_SESSION_CLOSED/);
});

test('R04-Q04 malformed external build and missing wasm factory fail closed',async()=>{
  const owner=make();
  await assert.rejects(owner.openDecoded({build:{...build,externallyConfirmed:false},decodedChunks:chunks()}),/PRODUCT_WORKER_BUILD_NOT_VERIFIED/);
  assert.equal(owner.getReceipt(),null);
  const bad=createProductWasmReadOwner(async()=>null);
  await assert.rejects(bad.openDecoded({build,decodedChunks:chunks()}),/PRODUCT_WORKER_WASM_UNAVAILABLE/);
  assert.equal(bad.getReceipt(),null);
});
