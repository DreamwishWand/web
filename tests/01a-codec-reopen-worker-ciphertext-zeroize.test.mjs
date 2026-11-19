import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clean=b=>assert.ok(b.every(n=>n===0),'Worker-owned ciphertext must be erased before response');
const original={GameInfo:{Version:626},World:{Objects:[]},Player:{Name:'Only synthetic fixture'},Unknown:{preserve:true}};
const ciphertext=makeSyntheticP1gProfile(original),decodedSha=sha(Buffer.from(JSON.stringify(original),'utf8'));
const source=new URL('../src/lib/dev/local-amount-codec-reopen.worker.mjs',import.meta.url);
const codec=await readFile(source,'utf8');
const product=await readFile(new URL('../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs',import.meta.url),'utf8');
const dev=await readFile(new URL('../src/lib/dev/local-amount-worker-adapter.mjs',import.meta.url),'utf8');
const oldSelf=Object.getOwnPropertyDescriptor(globalThis,'self'),oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
test('01A real fresh Codec Worker clears its private ciphertext before any acknowledgement',async t=>{
 try{
  const output=[];
  Object.defineProperty(globalThis,'self',{configurable:true,value:{postMessage:msg=>output.push(msg)}});
  await import(source.href+'?source-qa='+encodeURIComponent('01a-ciphertext-zeroize'));
  const makeCase=(mutate=()=>{},expected=decodedSha)=>({data:{ciphertext:Uint8Array.from(ciphertext),expectedDecodedSha256:expected},mutate});
  const scenarios=[
   {name:'good encrypted P1G and matching decoded digest',...makeCase(),valid:true},
   {name:'wrong decoded SHA',...makeCase(()=>{},'0'.repeat(64)),valid:false},
   {name:'tampered ciphertext',...makeCase(b=>b[0]^=128),valid:false},
   {name:'invalid receipt digest type',...makeCase(()=>{},'wrong'),valid:false}
  ];
  for(const scenario of scenarios){
   await t.test(scenario.name,async()=>{
    output.length=0;
    const message=scenario.data;
    const cloned=message.ciphertext;
    scenario.mutate(cloned);
    await globalThis.self.onmessage({data:message});
    assert.deepEqual(output,[{freshWorkerReopenVerified:scenario.valid,privatePayloadPosted:false}]);
    clean(cloned);
    assert.ok(ciphertext.some(x=>x!==0),'caller original buffer must not be wiped');
   });
  }
 }finally{
  if(oldSelf)Object.defineProperty(globalThis,'self',oldSelf);
  else delete globalThis.self;
  if(oldCrypto)Object.defineProperty(globalThis,'crypto',oldCrypto);
  else delete globalThis.crypto;
 }
});
test('01A actual send-side Product and DEV ciphertext clone lifetime is explicitly bounded',()=>{
 for(const [label,src] of [['Product',product],['DEV',dev]]){
  assert.match(src,/transient=new Uint8Array\(ciphertext\)/,label+' must allocate a new send-only buffer');
  assert.match(src,/w\.postMessage\(\{ciphertext:transient,expectedDecodedSha256\}\)/);
  assert.match(src,/finally\{if\(transient\)Uint8Array\.prototype\.fill\.call\(transient,0\)\}/);
  assert.doesNotMatch(src,/w\.postMessage\(\{ciphertext:new Uint8Array\(ciphertext\)/);
 }
 assert.match(codec,/Uint8Array\.prototype\.fill\.call\(encrypted,0\)/);
 assert.match(codec,/Uint8Array\.prototype\.fill\.call\(decodedBytes,0\)/);
 assert.ok(codec.indexOf('Uint8Array.prototype.fill.call(encrypted,0)')<
   codec.indexOf('self.postMessage({freshWorkerReopenVerified:verified'),
   'worker must erase receipt-private ciphertext BEFORE responding');
});
