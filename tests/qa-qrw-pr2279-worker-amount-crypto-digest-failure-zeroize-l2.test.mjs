// 04 QR-W distinct Worker-local Amount encrypted P1G ciphertext read callsite.
// Independent real original readBoundEncryptedCopy, adversarial crypto+OPFS failures.
// No Owner encrypted file or key; the Store shared PR2282 is a separate leaf.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readBoundEncryptedCopy} from '../src/lib/dev/local-amount-worker-adapter.mjs';
const originalCrypto=globalThis.crypto??webcrypto;
const originalDigest=originalCrypto.subtle.digest.bind(originalCrypto.subtle);
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(raw=Uint8Array.from({length:64},(_,i)=>i+1)){
 const name='wand-verified-edited-copy.p1g';
 const b={name,sha:sha(raw),size:64,directory:{
  async getFileHandle(got){assert.equal(got,name);return{
   async getFile(){return {name,size:64,async arrayBuffer(){return raw.buffer}}}
  }}
 }};
 return {binding:b,raw};
}
const zeros=b=>assert(b.every(x=>x===0),'Worker-local encrypted bytes must be zeroized on denial');
async function withDigest(fn,run){
 const before=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{
  getRandomValues: b=>originalCrypto.getRandomValues(b),
  subtle:{digest:fn}
 }});
 try{await run()}finally{
  if(before)Object.defineProperty(globalThis,'crypto',before);else delete globalThis.crypto;
 }
}
test('actual Worker-local Amount ciphertext is zeroized when crypto.subtle.digest rejects after byte allocation',async()=>{
 const {binding,raw}=fixture();let calls=0;
 await withDigest(async()=>{throw Error('DIGEST_BACKEND_REJECTED')},async()=>{
  await assert.rejects(readBoundEncryptedCopy(binding,()=>{calls++}),/DIGEST_BACKEND_REJECTED/);
 });
 assert.equal(calls,4,'three pre-alloc generation checks plus post-allocation check');
 zeros(raw);
});
test('actual Worker-local Amount ciphertext is zeroized for empty or malformed digest bytes',async()=>{
 const {binding,raw}=fixture();
 await withDigest(async()=>new ArrayBuffer(0),async()=>{
  await assert.rejects(readBoundEncryptedCopy(binding,()=>{}),/LOCAL_DEV_WORKER_DENIED/);
 });
 zeros(raw);
});
test('actual Worker-local Amount ciphertext rejects truncated OPFS arrayBuffer despite matching File.size metadata',async()=>{
 const {binding}=fixture();
 const shorter=Uint8Array.from({length:63},(_,i)=>i+1);
 binding.directory={async getFileHandle(){return {async getFile(){return{
  name:binding.name,size:64,async arrayBuffer(){return shorter.buffer}
 }}}}};
 await assert.rejects(readBoundEncryptedCopy(binding,()=>{}),/LOCAL_DEV_WORKER_DENIED/);
 zeros(shorter);
});
test('malformed preallocation binding cannot even access OPFS or allocate a private ciphertext buffer',async()=>{
 const {binding,raw}=fixture();let calls=0;
 binding.sha=binding.sha.toUpperCase();
 binding.directory={async getFileHandle(){calls++;throw Error('NO_TOUCH_OPFS')}};
 await assert.rejects(readBoundEncryptedCopy(binding,()=>{}),/LOCAL_DEV_WORKER_DENIED/);
 assert.equal(calls,0);
 assert(raw.some(x=>x!==0),'caller-owned test input never passed to Worker, not wiped');
});
test('real positive result bytes require caller ownership transfer and accurate digest',async()=>{
 const {binding,raw}=fixture();
 let called=0;
 await withDigest((...args)=>originalDigest(...args),async()=>{
  const r=await readBoundEncryptedCopy(binding,()=>{called++});
  assert.equal(called,5);
  assert.equal(r.kind,'VERIFIED_DOWNLOAD');
  assert.equal(r.sha256,sha(raw));
  assert.strictEqual(r.encryptedBytes.buffer,raw.buffer);
  assert(r.encryptedBytes.some(x=>x!==0));
  r.encryptedBytes.fill(0);
 });
 zeros(raw);
});
