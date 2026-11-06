// 05 QR-C / R04 corrected PR702 JS↔WASM u64 BigInt NEW-ONLY differential.
// Synthetic, not a generated wasm-bindgen bundle or genuine private P1G.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createProductWasmReadOwner,PRODUCT_WASM_READ_CONTRACT,
  PRODUCT_WASM_CHUNK_MAX_BYTES,PRODUCT_WASM_WORKER_MAX_BYTES
} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';

const build={
  platform:'steam-windows',
  buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true
};
const receipt=()=>({
  contract:PRODUCT_WASM_READ_CONTRACT,
  sessionId:'a'.repeat(32),decodedSha256:'b'.repeat(64),
  revision:0,indexGeneration:1,schema:626,fullDocumentJsonValidated:true,
  productWorkerBound:true,allDomainReferencesVerified:false,productReadAccepted:false,
  writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false
});
const chunks=async function*(){yield new Uint8Array([123,125]);};
const scope=r=>({
  sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256
});
class GeneratedGlueStyle {
  constructor(platform,kind,id,schema,attested,entropy){
    assert.equal(attested,true);
    assert.equal(entropy instanceof Uint8Array,true);
    assert.equal(entropy.length,32);
    this.closed=false;this.appendCount=0;this.readCount=0;
  }
  append_chunk(chunk){
    assert.equal(chunk instanceof Uint8Array,true);
    assert.ok(chunk.byteLength>0&&chunk.byteLength<=PRODUCT_WASM_CHUNK_MAX_BYTES);
    this.appendCount++;
  }
  finish(){return JSON.stringify(receipt());}
  read_core_version_witness(id,revision,indexGeneration,sha){
    // Mirror actual wasm-bindgen u64 JS argument boundary; do NOT accept Number.
    assert.equal(typeof revision,'bigint');
    assert.equal(typeof indexGeneration,'bigint');
    assert.equal(BigInt.asUintN(64,revision),0n);
    assert.equal(BigInt.asUintN(64,indexGeneration),1n);
    assert.equal(id,'a'.repeat(32));
    assert.equal(sha,'b'.repeat(64));
    this.readCount++;
    return JSON.stringify({
      sessionId:id,revision:Number(revision),
      indexGeneration:Number(indexGeneration),decodedSha256:sha,
      coreOwnedReadset:'/GameInfo/Version',completeAllDomains:false,
      writerAuthorized:false
    });
  }
  close(){this.closed=true;}
}
const make=()=>{
  const created=[];
  const w=createProductWasmReadOwner(async()=>({
    WorkerWasmSource:class extends GeneratedGlueStyle {
      constructor(...args){super(...args);created.push(this);}
    }
  }));
  return {w,created};
};

test('Q01 repaired valid Core Version read crosses wasm-bindgen u64 BigInt boundary',async()=>{
  const {w,created}=make();
  const r=await w.openDecoded({build,decodedChunks:chunks()});
  assert.equal(r.revision,0);
  assert.equal(r.indexGeneration,1);
  assert.equal(typeof r.revision,'number','external UI scope is numeric CAS receipt');
  const out=w.readCoreVersion(scope(r));
  assert.deepEqual(out,{
    sessionId:'a'.repeat(32),revision:0,indexGeneration:1,
    decodedSha256:'b'.repeat(64),
    coreOwnedReadset:'/GameInfo/Version',
    completeAllDomains:false,writerAuthorized:false
  });
  assert.equal(created[0].readCount,1);
  assert.equal(w.getCapabilities().canApply,false);
  assert.equal(w.getCapabilities().canExportEditedCopy,false);
  assert.equal(w.getCapabilities().maxDecodedBytes,PRODUCT_WASM_WORKER_MAX_BYTES);
  w.close();
  assert.equal(created[0].closed,true);
});

test('Q02 corrected Rust u64 / type declaration bigint / internal JS BigInt are aligned',()=>{
  const rust=readFileSync(new URL('../crates/ddv-save-core/src/wasm_worker.rs',import.meta.url),'utf8');
  const dts=readFileSync(new URL('../src/lib/ddv/core/save/product-wasm-read-owner.d.mts',import.meta.url),'utf8');
  const js=readFileSync(new URL('../src/lib/ddv/core/save/product-wasm-read-owner.mjs',import.meta.url),'utf8');
  assert.match(rust,/read_core_version_witness\(&self,session_id:&str,\s*revision:u64,index_generation:u64,decoded_sha256:&str/);
  assert.match(dts,/read_core_version_witness\(sessionId:string,revision:bigint,indexGeneration:bigint,decodedSha256:string\)/);
  assert.match(js,/BigInt\(scope\.revision\),BigInt\(scope\.indexGeneration\),scope\.decodedSha256/);
  assert.match(dts,/revision:0;indexGeneration:1;schema:626/);
});

test('Q03 BigInt conversion never permits forged CAS scope, UI readset or Writer promotion',async()=>{
  const {w,created}=make();
  const r=await w.openDecoded({build,decodedChunks:chunks()});
  const valid=scope(r);
  for(const wrong of [
    {sessionId:'f'.repeat(32)},{revision:1},{revision:0n},
    {indexGeneration:2},{indexGeneration:1n},
    {decodedSha256:'f'.repeat(64)},{readset:['/World']},
    {writerAuthorized:true}
  ]){
    assert.throws(()=>w.readCoreVersion({...valid,...wrong}),/PRODUCT_WORKER_SCOPE_CAS/);
  }
  assert.equal(created[0].readCount,0,'all fake UI scopes rejected before WASM call');
  assert.equal(w.readCoreVersion(valid).coreOwnedReadset,'/GameInfo/Version');
  assert.equal(created[0].readCount,1);
  assert.throws(()=>w.submitOperation({kind:'EXPORT_EDITED_COPY'}),/PRODUCT_WORKER_WRITER_DISABLED/);
  assert.equal(w.close().writerAuthorized,false);
  assert.throws(()=>w.readCoreVersion(valid),/PRODUCT_WORKER_SESSION_CLOSED/);
});
