import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {File as BufferFile} from 'node:buffer';
import {createLocalEncryptedCopyStore} from '../src/lib/ddv/core/save/local-encrypted-copy-store.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
if(!globalThis.File)globalThis.File=BufferFile;
const hash=b=>createHash('sha256').update(b).digest('hex');
const isZero=b=>assert.ok(b.every(n=>n===0),'released Worker-private ciphertext must be zeroized');

async function preparedStore(){
 const bytes=Uint8Array.from({length:64},(_,i)=>i+1);
 const original=new File([bytes],'p1g-owner-original.p1g');
 const handles=new Map();
 const root={
  async getFileHandle(name,options={}){
   if(!handles.has(name)){
    if(!options.create)throw Object.assign(Error('Not found'),{name:'NotFoundError'});
    let file=null,pending=null;
    handles.set(name,{
     async getFile(){if(!file)throw Error('NOT_WRITTEN');return file},
     async createWritable(){return{
      async write(data){pending=Uint8Array.from(data)},
      async close(){file=new File([pending],name);pending=null},
      async abort(){pending=null}
     }}
    });
   }
   return handles.get(name);
  },
  async removeEntry(name){handles.delete(name)}
 };
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
  locks:{request:async (_name,run)=>run()}
 }});
 try{
  const store=createLocalEncryptedCopyStore({getDirectory:async()=>root});
  await store.open(original,hash(bytes));
  await store.backupOriginal();
  return {store,restore(){if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);
   else delete globalThis.navigator}};
 }catch(e){
  if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);
  else delete globalThis.navigator;
  throw e;
 }
}
async function probe(mode){
 const {store,restore}=await preparedStore();
 const originalMethod=Blob.prototype.arrayBuffer;
 let reads=0;
 const observed=[];
 Blob.prototype.arrayBuffer=async function(){
  const buffer=await originalMethod.call(this);
  reads++;
  // The first Store.read() copy is wiped by its own finally. The second
  // allocation is the Store.download() result that used to leak on failure.
  if(reads===2){
   const view=new Uint8Array(buffer);
   if(mode==='mismatched-sha')view[0]^=255;
   if(mode==='stale-epoch')store.close();
  }
  observed.push(new Uint8Array(buffer));
  return buffer;
 };
 try{
  if(mode==='success'){
   const result=await store.download('backup');
   assert.equal(result.kind,'VERIFIED_DOWNLOAD');
   assert.equal(result.encryptedBytes.length,64);
   assert.ok(result.encryptedBytes.some(n=>n!==0));
   assert.strictEqual(result.encryptedBytes.buffer,observed[1].buffer);
   result.encryptedBytes.fill(0);
  }else{
   await assert.rejects(store.download('backup'),/LOCAL_ENCRYPTED_COPY_DENIED/);
  }
  assert.equal(reads,2);
  isZero(observed[0]);
  isZero(observed[1]);
 }finally{
  Blob.prototype.arrayBuffer=originalMethod;
  store.close();
  restore();
 }
}

test('01A shared product encrypted copy download wipes final buffer on digest mismatch',async()=>{
 await probe('mismatched-sha');
});
test('01A shared product encrypted copy download wipes final buffer on stale close',async()=>{
 await probe('stale-epoch');
});
test('01A shared product encrypted copy download transfers valid buffer to existing caller owner',async()=>{
 await probe('success');
});
