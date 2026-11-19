// 04 QR-W independent changed-only 01A Codec worker JS ciphertext lifetime L2.
// Uses actual original Worker onmessage and extracted unmodified freshReopen
// function bodies (only import.meta.url replaced with a stable file URL for Node).
// All P1G objects synthetic; never Owner Save, password or keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
const codecURL=new URL('../src/lib/dev/local-amount-codec-reopen.worker.mjs',import.meta.url);
const productURL=new URL('../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs',import.meta.url);
const devURL=new URL('../src/lib/dev/local-amount-worker-adapter.mjs',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const clear=b=>assert(b?.every(x=>x===0),'private encrypted/decrypted transient must be zero before acknowledgment');
const original=Object.freeze({GameInfo:{Version:626},World:{Objects:[]},Player:{Name:'Synthetic 04 QRW'},Unknown:{preserve:true}});
const raw=makeSyntheticP1gProfile(original);
const exactDecoded=JSON.stringify(original),decodedSha=sha(Buffer.from(exactDecoded,'utf8'));
const originalBytes=Uint8Array.from(raw);
test('actual fresh Codec Worker receive buffer and decoded UTF8 digest input wipe BEFORE reply',async t=>{
 const oldSelf=Object.getOwnPropertyDescriptor(globalThis,'self');
 const oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const initialCrypto=globalThis.crypto??webcrypto;
 if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
 let rawCase,atAck=[];
 const messages=[];
 Object.defineProperty(globalThis,'self',{configurable:true,value:{
  postMessage:function(response){
   atAck.push({bytes:rawCase?Uint8Array.from(rawCase):null,response});
   messages.push(response);
  }
 }});
 const originalEncode=TextEncoder.prototype.encode;
 try{
  await import(codecURL.href+'?qrw-codec-after-accepted-source-44f');
  await t.test('good original Codec P1G reopen success clears receiver and actual decoded digest buffer',async()=>{
   rawCase=Uint8Array.from(raw);messages.length=0;atAck=[];
   const encoded=[];
   TextEncoder.prototype.encode=function(s){const b=originalEncode.call(this,s);encoded.push(b);return b};
   try{await globalThis.self.onmessage({data:{ciphertext:rawCase,expectedDecodedSha256:decodedSha}})}
   finally{TextEncoder.prototype.encode=originalEncode}
   assert.deepEqual(messages,[{freshWorkerReopenVerified:true,privatePayloadPosted:false}]);
   clear(rawCase);clear(atAck[0].bytes);
   assert(encoded.some(b=>b.length===Buffer.byteLength(exactDecoded,'utf8')&&b.every(x=>x===0)),
    'actual decoded JSON UTF8 buffer must be zero when postMessage is called');
   assert(originalBytes.some(x=>x!==0),'caller original synthetic P1G cannot be wiped by receiver');
  });
  const scenarios=[
   ['mismatched decoded digest',Uint8Array.from(raw),'0'.repeat(64)],
   ['tampered encrypted P1G',Uint8Array.from(raw),decodedSha],
   ['invalid receipt SHA',Uint8Array.from(raw),'not-a-sha'],
   ['extra user-controlled receipt',Uint8Array.from(raw),decodedSha,true]
  ];
  scenarios[1][1][0]^=128;
  for(const [name,ciphertext,expectedDecodedSha256,extra] of scenarios){
   await t.test(name+' denial preserves zero-before-ack',async()=>{
    rawCase=ciphertext;messages.length=0;atAck=[];
    const data={ciphertext,expectedDecodedSha256};
    if(extra)data.fakeOwnerAuthority=true;
    await globalThis.self.onmessage({data});
    assert.deepEqual(messages,[{freshWorkerReopenVerified:false,privatePayloadPosted:false}]);
    clear(rawCase);clear(atAck[0].bytes);
   });
  }
  await t.test('a throwing acknowledgement sink cannot leave Worker-owned ciphertext resident',async()=>{
   rawCase=Uint8Array.from(raw);messages.length=0;atAck=[];
   const normal=globalThis.self.postMessage;
   globalThis.self.postMessage=function(){throw Error('ACK_REJECTED')};
   try{await assert.rejects(globalThis.self.onmessage({data:{ciphertext:rawCase,expectedDecodedSha256:decodedSha}}),/ACK_REJECTED/)}
   finally{globalThis.self.postMessage=normal}
   clear(rawCase);
  });
 }finally{
  TextEncoder.prototype.encode=originalEncode;
  if(oldSelf)Object.defineProperty(globalThis,'self',oldSelf);else delete globalThis.self;
  if(oldCrypto)Object.defineProperty(globalThis,'crypto',oldCrypto);else delete globalThis.crypto;
 }
});
function extractActualFreshReopen(source,marker,tail,WorkerClass){
 const start=source.indexOf(marker),end=source.indexOf(tail,start);
 assert(start>=0&&end>start,'original freshReopen function exact boundary must exist');
 const rawFunction=source.slice(start,end).replaceAll('import.meta.url',JSON.stringify('file:///04qrw-runtime.mjs'));
 return new Function('Worker','setTimeout','clearTimeout',rawFunction+'\nreturn freshReopen;')(
  WorkerClass,setTimeout,clearTimeout
 );
}
test('actual DEV and Product send-side freshReopen bodies wipe structured-clone source allocation, success and postMessage throw',async t=>{
 const sources=[
  ['DEV',readFileSync(devURL,'utf8'),'async function freshReopen(','async function getNewFile('],
  ['Product',readFileSync(productURL,'utf8'),'function freshReopen(','const STEAM=']
 ];
 for(const [label,source,marker,tail] of sources){
  for(const failSend of [false,true]){
   await t.test(label+' '+(failSend?'postMessage throws':'postMessage success'),async()=>{
    let sent,terminated=0,posts=0;
    class StubWorker{
     constructor(){this.onmessage=null;this.onerror=null}
     terminate(){terminated++}
     postMessage(r){
      posts++;sent=r.ciphertext;
      if(failSend)throw Error('SYNC_STRUCTURED_CLONE_REJECTED');
      queueMicrotask(()=>this.onmessage?.({data:{freshWorkerReopenVerified:true,privatePayloadPosted:false}}));
     }
    }
    const actual=extractActualFreshReopen(source,marker,tail,StubWorker);
    const sourceBytes=Uint8Array.from(raw);
    if(label==='DEV'&&failSend)await assert.rejects(actual(sourceBytes,decodedSha),/REOPEN_DENIED/);
    else assert.equal(await actual(sourceBytes,decodedSha),!failSend);
    assert.equal(posts,1);
    clear(sent);
    assert(sourceBytes.some(x=>x!==0),'original encrypted input remains caller-owned');
    assert.equal(terminated,1,'Worker terminates on send success and synchronous failure');
   });
  }
 }
});
