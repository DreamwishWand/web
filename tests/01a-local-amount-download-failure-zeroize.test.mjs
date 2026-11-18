import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readBoundEncryptedCopy} from '../src/lib/dev/local-amount-worker-adapter.mjs';

if (!globalThis.crypto) globalThis.crypto=webcrypto;
const sha=b=>createHash('sha256').update(b).digest('hex');
function originalFixture({size=64,digest,bytes}={}){
 const raw=bytes||new Uint8Array(Array.from({length:64},(_,i)=>i+1));
 const expected=digest??sha(raw);
 const name='wand-verified-edited-copy.p1g';
 const binding={name,sha:expected,size,directory:{
  async getFileHandle(received){
   assert.equal(received,name);
   return {async getFile(){
    return {name,size,async arrayBuffer(){return raw.buffer}};
   }};
  }
 }};
 return {raw,binding};
}
const zero=b=>assert.ok(b.every(x=>x===0),'Worker-local encrypted bytes must be wiped');

test('01A worker-local encrypted Amount bytes wipe on rejected size and digest',async()=>{
 for(const mode of ['size','digest']){
  const {raw,binding}=mode==='size'
   ?originalFixture({size:63})
   :originalFixture({digest:'0'.repeat(64)});
  await assert.rejects(
   readBoundEncryptedCopy(binding,()=>{}),
   /LOCAL_DEV_WORKER_DENIED/
  );
  zero(raw);
 }
});

test('01A worker-local encrypted Amount bytes wipe on generation failure before and after digest',async()=>{
 for(const staleAt of [4,5]){
  const {raw,binding}=originalFixture();
  let n=0;
  await assert.rejects(
   readBoundEncryptedCopy(binding,()=>{
    if(++n===staleAt)throw Error('STALE_GENERATION');
   }),/STALE_GENERATION/
  );
  assert.equal(n,staleAt);
  zero(raw);
 }
});

test('01A verified Amount reply retains owned encrypted bytes until Worker port cleanup',async()=>{
 const {raw,binding}=originalFixture();
 let calls=0;
 const r=await readBoundEncryptedCopy(binding,()=>{calls++});
 assert.equal(calls,5); // three pre-allocation, two post-allocation checks
 assert.deepEqual(Object.keys(r).sort(),
  ['kind','name','sha256','sizeBytes','encryptedBytes'].sort());
 assert.equal(r.kind,'VERIFIED_DOWNLOAD');
 assert.strictEqual(r.encryptedBytes.buffer,raw.buffer);
 assert.equal(r.sizeBytes,64);
 assert.equal(r.sha256,sha(raw));
 assert.ok(raw.some(x=>x!==0));
 // Existing Worker-port reply handling owns post-success zeroization.
 r.encryptedBytes.fill(0);
 zero(raw);
});
