// 04 QR-W independent changed-only ProductScoped shared OPFS encrypted P1G
// Worker lifetime adversarial test. Synthetic ciphertext; never Owner Save or key.
// Executes the original imported product store, not duplicated validation logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {File as BufferFile} from 'node:buffer';
import {createLocalEncryptedCopyStore} from '../src/lib/ddv/core/save/local-encrypted-copy-store.mjs';
const originalCrypto=globalThis.crypto??webcrypto;
const raw=Uint8Array.from({length:64},(_,i)=>(i*13+7)%256);
const digest=b=>createHash('sha256').update(b).digest('hex');
const zero=b=>assert(b?.every(n=>n===0),'unreturned encrypted Worker buffer must be zeroized');
if(!globalThis.File)globalThis.File=BufferFile;
async function prepared(){
 const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const storage=new Map(),original=new File([raw],'owner-local-encrypted.p1g');
 const dir={
  async getFileHandle(name,{create=false}={}){
   if(!storage.has(name)){
    if(!create)throw Object.assign(Error('absent'),{name:'NotFoundError'});
    let file=null;
    storage.set(name,{
     async getFile(){if(!file)throw Error('not written');return file},
     async createWritable(){let pending=null;return{
      async write(b){pending=Uint8Array.from(b)},
      async close(){file=new File([pending],name);pending=null},
      async abort(){pending=null}
     }}
    });
   }
   return storage.get(name);
  },
  async removeEntry(name){storage.delete(name)}
 };
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_id,fn)=>fn()}}});
 try{
  const store=createLocalEncryptedCopyStore({getDirectory:async()=>dir});
  await store.open(original,digest(raw));await store.backupOriginal();
  return {store,cleanup(){store.close();if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator}};
 }catch(e){
  if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;
  throw e;
 }
}
async function probe(mode){
 const {store,cleanup}=await prepared();
 const previousBuffer=Blob.prototype.arrayBuffer,previousCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 let reads=0,hashes=0;
 const allocated=[];
 Blob.prototype.arrayBuffer=async function(){
  const b=await previousBuffer.call(this);
  reads++;
  const returned=mode==='truncated-download'&&reads===2?b.slice(0,b.byteLength-1):b;
  allocated.push(new Uint8Array(returned));
  return returned;
 };
 const controlled={
  getRandomValues:(b)=>originalCrypto.getRandomValues(b),
  subtle:{digest:async(name,bytes)=>{
   hashes++;
   if(mode==='digest-rejection'&&hashes===2)throw Error('CRYPTO_SUBTLE_SHA_REJECT');
   const out=await originalCrypto.subtle.digest(name,bytes);
   if(mode==='close-after-digest'&&hashes===2)store.close();
   return out;
  }}
 };
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:controlled});
 try{
  if(mode==='success'){
   const r=await store.download('backup');
   assert.deepEqual(Object.keys(r).sort(),['kind','name','sha256','sizeBytes','encryptedBytes'].sort());
   assert.equal(r.kind,'VERIFIED_DOWNLOAD');
   assert.equal(r.sizeBytes,64);assert.equal(r.sha256,digest(raw));
   assert.strictEqual(r.encryptedBytes.buffer,allocated[1].buffer);
   assert(allocated[1].some(n=>n!==0),'success must transfer, not prematurely clear the result');
   r.encryptedBytes.fill(0);
  }else if(mode==='digest-rejection'){
   await assert.rejects(store.download('backup'),/CRYPTO_SUBTLE_SHA_REJECT/);
  }else{
   await assert.rejects(store.download('backup'),/LOCAL_ENCRYPTED_COPY_DENIED/);
  }
  assert.equal(reads,2,'must exercise both original read() allocation and distinct download() allocation');
  zero(allocated[0]);zero(allocated[1]);
  if(mode!=='truncated-download')assert.equal(hashes,2,'first hash read() and second download() digest');
  else assert.equal(hashes,1,'length mismatch refuses BEFORE download digest');
  assert.equal(digest(raw),digest(Uint8Array.from({length:64},(_,i)=>(i*13+7)%256)),
   'immutable original encrypted source bytes unaffected');
 }finally{
  Blob.prototype.arrayBuffer=previousBuffer;
  if(previousCrypto)Object.defineProperty(globalThis,'crypto',previousCrypto);else delete globalThis.crypto;
  cleanup();
 }
}
test('original ProductScoped Worker second encrypted allocation wipes when crypto.subtle.digest REJECTS',async()=>{
 await probe('digest-rejection');
});
test('original ProductScoped Worker second encrypted allocation wipes on shorter unexpected OPFS bytes',async()=>{
 await probe('truncated-download');
});
test('original ProductScoped Worker second encrypted allocation wipes if epoch closes AFTER digest before final CAS',async()=>{
 await probe('close-after-digest');
});
test('original ProductScoped Worker verified output success transfers ownership once and requires caller wipe',async()=>{
 await probe('success');
});
test('blocked unbound edited-copy reads never allocate a new Worker encrypted output buffer',async()=>{
 const {store,cleanup}=await prepared();
 const previousBuffer=Blob.prototype.arrayBuffer;let allocs=0;
 Blob.prototype.arrayBuffer=async function(){allocs++;return previousBuffer.call(this)};
 try{
  await assert.rejects(store.download('edited'),/LOCAL_ENCRYPTED_COPY_DENIED/);
  assert.equal(allocs,0);
 }finally{Blob.prototype.arrayBuffer=previousBuffer;cleanup()}
});
