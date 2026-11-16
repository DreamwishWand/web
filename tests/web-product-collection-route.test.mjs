import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {scopedCollectionReadyOk,productCollectionPortScope,createProductCollectionPort}
 from '../src/lib/collection/product-collection-client.mjs';
const scope={releaseId:'a'.repeat(64),operation:'collection.fixed-exact1',mode:'private-product-v2',
 builds:[{platform:'switch',buildId:'9A239D3DB569756D',productV2EvidenceSha256:null}]};
const ready={kind:'SCOPED_COLLECTION_RUNTIME_READY',...scope,writerAuthorized:false};
test('product Collection ready binds exact sealed release identity, build list and mode',()=>{
 assert.equal(scopedCollectionReadyOk(ready,scope),true);
 for(const patch of [{writerAuthorized:true},{releaseId:'b'.repeat(64)},{operation:'amount'},
  {mode:'public-accepted'},{builds:[]},{builds:[{...scope.builds[0],buildId:'unknown'}]},{extra:true}])
  assert.equal(scopedCollectionReadyOk({...ready,...patch},scope),false);
 assert.equal(productCollectionPortScope({...ready}),null);
});
test('committed null anchor and arbitrary caller adapter/options cannot construct product Worker',async()=>{
 const oldDoc=Object.getOwnPropertyDescriptor(globalThis,'document'),oldLoc=Object.getOwnPropertyDescriptor(globalThis,'location'),oldWorker=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 let constructed=0;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://dreamwishwand.github.io/web/editor/collection/?enable=true')});
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){constructed++;throw Error('unexpected')}}});
 try{
  await assert.rejects(createProductCollectionPort({verifiedLocalDevGate:true,workerFactory:()=>{},anchor:scope}));
  assert.equal(constructed,0);
 }finally{
  for(const [k,v] of [['document',oldDoc],['location',oldLoc],['Worker',oldWorker]])if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];
 }
});
test('actual product route, existing Collection component and hub compile; no test runtime or public flag fallback',()=>{
 for(const file of ['src/routes/editor/collection/+page.svelte','src/lib/collection/CollectionExact1Dev.svelte','src/routes/editor/+page.svelte']){
  const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(compile(src,{filename:file,generate:'client'}).js.code.length>0);
 }
 const route=readFileSync(new URL('../src/routes/editor/collection/+page.svelte',import.meta.url),'utf8');
 assert.ok(route.includes('createProductCollectionPort')&&!route.includes('verifiedLocalDevGate'));
 const worker=readFileSync(new URL('../src/lib/collection/product-collection.worker.mjs',import.meta.url),'utf8');
 assert.ok(worker.includes('loadProtectedScopedCollectionRustWasm()')&&worker.includes('runtime.builds.some')&&!worker.includes('loadSourcePinnedRustWasmCandidate'));
});
