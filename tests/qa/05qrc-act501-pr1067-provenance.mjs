import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {loadPinnedReadOnlyRustBytes as load} from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';

const SOURCE='bf2fbac24db7c566ca03bfd6adacf90dc86efcb0';
const OLD='14db794f05ecbb2b5e5662a0bdb8f1e38f79cc41';
const LOCK='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const sha=b=>createHash('sha256').update(b).digest('hex');
const js=Buffer.from('/* synthetic fixture: never execute */');
const wasm=Buffer.from([1,2,3,4]); // intentionally not executable: stop after both genuine byte checks
const oldSource=execFileSync('git',['show',OLD+':src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs']);
const oldLoad=(await import('data:text/javascript;base64,'+oldSource.toString('base64'))).loadPinnedReadOnlyRustBytes;
const manifest=()=>({
 contract:'wand.r22.rust-wasm-source-provenance-candidate@1',
 source:{repository:'DreamwishWand/web',commit:SOURCE,wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',defaultFeatures:false,features:['indexed-read','worker-wasm'],cargoLockOrigin:'approved-repository-lock',cargoLockSha256:LOCK,cargoTomlSha256:'a'.repeat(64)},
 signature:{status:'UNKNOWN',verified:false},
 release:{publishedPages:true,autoUpload:false,productConsumerEnabled:false,writerAuthorized:false},
 abi:{exportClass:'WorkerWasmSource',maxPageRecords:8,writerAuthorized:false,nativeV3:false,methods:['append_chunk','finish','issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page','close']},
 assets:{js:{path:'ddv_save_core.js',sha256:sha(js),sizeBytes:js.length},wasm:{path:'ddv_save_core_bg.wasm',sha256:sha(wasm),sizeBytes:wasm.length}}
});
async function probe(base,{edit=()=>{},pinsEdit=()=>{},tamper='',implementation=load}={}){
 const m=manifest();edit(m);
 const mf=Buffer.from(JSON.stringify(m));
 const pins={contract:'wand.r22.candidate-pinned-digests@1',sourceHead:SOURCE,manifestSha256:sha(mf),manifestSizeBytes:mf.length,jsSha256:sha(js),wasmSha256:sha(wasm),jsSizeBytes:js.length,wasmSizeBytes:wasm.length,sourceProvenanceOnly:true,verifiedSignature:false};
 pinsEdit(pins);
 const calls=[];
 globalThis.self={location:new URL('https://example.test'+base+'/_app/worker.js')};
 try{
  await assert.rejects(async()=>implementation({basePath:base,trustedPins:pins,fetcher:async(url,options)=>{
   assert.deepEqual(options,{cache:'no-store',redirect:'error',credentials:'same-origin',mode:'same-origin'});
   const name=new URL(url).pathname.split('/').at(-1);calls.push(name);
   assert.equal(url,'https://example.test'+base+'/worker-wasm/'+name);
   let bytes=name==='manifest.json'?mf:name==='ddv_save_core.js'?js:wasm;
   if(tamper===name){bytes=Buffer.from(bytes);bytes[0]^=1;}
   const mime=name==='manifest.json'?'application/json':name==='ddv_save_core.js'?'text/javascript':'application/wasm';
   return {ok:true,status:200,redirected:false,url,type:'basic',headers:{get:()=>mime},arrayBuffer:async()=>bytes};
  }}),e=>{calls.error=e.message;return true;});
 }finally{delete globalThis.self;}
 return {calls:[...calls],error:calls.error};
}
const all=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const one=['manifest.json'];
function expect(r,code,calls){assert.equal(r.error,'R22_WASM_CANDIDATE_'+code);assert.deepEqual(r.calls,calls);}
test('ACT501 exact approved lock bytes and immutable source identity',async()=>{
 const lock=await readFile('scripts/wasm-distribution/approved-Cargo.lock');
 assert.equal(lock.length,7052);assert.equal(sha(lock),LOCK);
 const cfg=JSON.parse(await readFile('scripts/wasm-distribution/protected-release-inputs.json'));
 assert.equal(cfg.approvedCargoLockSha256,LOCK);
});
for(const base of ['','/web']){
 test('ACT501 causal repair and actual byte verification '+(base||'/'),async()=>{
  expect(await probe(base,{implementation:oldLoad}),'MANIFEST_PROVENANCE_OR_ABI_DENIED',one);
  expect(await probe(base),'WASM_MAGIC',all);
  expect(await probe(base,{edit:m=>{m.source.cargoLockOrigin='cargo-generated-this-ci-job';m.source.cargoLockSha256='f'.repeat(64)}}),'WASM_MAGIC',all);
  for(const edit of [
   m=>{m.source.cargoLockSha256='f'.repeat(64)},
   m=>{delete m.source.cargoLockSha256},
   m=>{m.source.cargoLockSha256=LOCK.toUpperCase()},
   m=>{m.source.cargoLockOrigin='approved-repository-lock '},
   m=>{delete m.source.cargoLockOrigin},
   m=>{m.source.cargoLockOrigin='cargo-generated-this-ci-job';m.source.cargoLockSha256='not-a-digest'},
   m=>{m.source.commit=OLD},
   m=>{m.source.features.push('private-native-v1')},
   m=>{m.signature.verified=true},
   m=>{m.release.writerAuthorized=true},
   m=>{m.abi.maxPageRecords=9},
   m=>{m.assets.js.sha256='0'.repeat(64)}
  ])expect(await probe(base,{edit}),'MANIFEST_PROVENANCE_OR_ABI_DENIED',one);
  expect(await probe(base,{pinsEdit:p=>{p.verifiedSignature=true}}),'TRUSTED_SOURCE_PIN_MISSING',[]);
  expect(await probe(base,{tamper:'manifest.json'}),'ASSET_SHA256_MISMATCH',one);
  for(const name of all.slice(1))expect(await probe(base,{tamper:name}),'ASSET_SHA256_MISMATCH',all);
  console.log('ACT501_CAUSAL_BOUNDARY_PASS',base||'/', 'old reject, new approved+historical reach actual byte checks; 16 negative cases');
 });
}
