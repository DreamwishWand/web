import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readonlyReleaseIdentityText,loadProtectedReadonlyRustWasm} from '../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
import {PROTECTED_READONLY_RELEASE_ANCHOR} from '../src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs';
import {loadSourcePinnedRustWasmCandidate} from '../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';

test('unsealed source and QA candidate cannot promote to product provenance',async()=>{
 assert.equal(PROTECTED_READONLY_RELEASE_ANCHOR,null);
 await assert.rejects(loadProtectedReadonlyRustWasm({qaCandidate:true}),/CALLER_AUTHORITY_DENIED/);
 globalThis.self={location:new URL('https://dreamwishwand.github.io/web/_app/test.js')};
 try{
  await assert.rejects(loadProtectedReadonlyRustWasm(),/BUILD_ANCHOR_MISSING_OR_INVALID/);
  await assert.rejects(loadProtectedReadonlyRustWasm(),/LOAD_REPLAY_DENIED/);
  await assert.rejects(loadSourcePinnedRustWasmCandidate({qaCandidate:false}),/UNSIGNED_PRODUCT_DISTRIBUTION_OFF/);
 }finally{delete globalThis.self}
});
test('immutable release identity changes with any subject, source or delivery scope',()=>{
 const pins={sourceHead:'a'.repeat(40),manifestSha256:'b'.repeat(64),manifestSizeBytes:100,
 jsSha256:'c'.repeat(64),jsSizeBytes:200,wasmSha256:'d'.repeat(64),wasmSizeBytes:300};
 const a={repository:'DreamwishWand/web',signerWorkflow:'DreamwishWand/web/.github/workflows/pages.yml',
 sourceRef:'refs/heads/main',origin:'https://dreamwishwand.github.io',basePath:'/web',pins};
 const hash=x=>createHash('sha256').update(readonlyReleaseIdentityText(x)).digest('hex');
 for(const k of Object.keys(pins)){
  const v=pins[k],next=typeof v==='number'?v+1:'f'.repeat(v.length);
  assert.notEqual(hash(a),hash({...a,pins:{...pins,[k]:next}}),k);
 }
 for(const [k,v] of [['origin','https://other.invalid'],['basePath',''],['sourceRef','refs/heads/other'],
  ['signerWorkflow','DreamwishWand/web/.github/workflows/other.yml']])
  assert.notEqual(hash(a),hash({...a,[k]:v}),k);
});
test('Pages source signs before sealing and bundling, then checks exact build bytes; no flag or new public file',async()=>{
 const y=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const order=['actions/attest-build-provenance@v2','scripts/readonly-release/seal.mjs seal',
  '- name: Build static site','scripts/readonly-release/seal.mjs check-built','actions/upload-pages-artifact@v3'];
 assert.ok(order.every((s,i)=>y.includes(s)&&(!i||y.indexOf(order[i-1])<y.indexOf(s))));
 assert.match(y,/--features worker-wasm,indexed-read/);
 assert.match(y,/find build\/worker-wasm -maxdepth 1 -type f \| wc -l\)" -eq 3/);
 const worker=await readFile(new URL('../src/lib/wep/steam-saved-diffgrids.consumer.worker.ts',import.meta.url),'utf8');
 assert.match(worker,/PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false/);
});
