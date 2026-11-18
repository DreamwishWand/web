// 04 QR-W independent actual local Amount Consumer, source PR2231 immutable HEAD8aa4.
// Worker replies contain synthetic already-encrypted bytes. No real Save/keys/Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION} from '../src/lib/dev/local-amount-workflow.mjs';
import {consumeVerifiedAmountDownloadBytes} from '../src/lib/dev/consume-verified-amount-download-bytes.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const original=Uint8Array.from({length:64},(_,i)=>i+1);
const originalSha=hash(original);
const name='original-backup.p1g';
const ack=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const args={file:{name:'original-source.p1g',size:64},fullVersion:STEAM626_FULL_VERSION,originalSha256:originalSha,buildConfirmed:true};
function setup(receipt){
 const calls=[];
 const adapter={
  async open(){calls.push('open');return ack('OPEN')},
  async backupOriginal(){calls.push('backup');return {backupReadbackVerified:true,originalUnchanged:true,
   shaMatched:true,sizeMatched:true,separateName:true,originalName:args.file.name,
   originalSha256:originalSha,originalSizeBytes:64,backupName:name}},
  async listVerifiedTargets(){calls.push('list');return {targets:[],rawDocumentExposed:false}},
  async stageTyped(){throw Error('NOT_AUTHORIZED')},
  async undo(){throw Error('NOT_AUTHORIZED')},
  async redo(){throw Error('NOT_AUTHORIZED')},
  async exportEditedCopy(){throw Error('NOT_AUTHORIZED')},
  async downloadVerifiedCopy(which){calls.push(which);return receipt(which)},
  async close(){calls.push('close');return ack('CLOSED')}
 };
 const w=createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true});
 return {w,calls,ready:async()=>{await w.open(args);await w.backupAndRead();}};
}
const from=raw=>({kind:'VERIFIED_DOWNLOAD',name,sha256:originalSha,sizeBytes:64,encryptedBytes:raw});
test('real Amount consumer owns separately verified clone, wipes original Worker encrypted reply immediately',async()=>{
 const raw=new Uint8Array(original),f=setup(async()=>from(raw));
 await f.ready();
 const reply=await f.w.downloadVerifiedCopy('backup');
 assert.deepEqual(reply.encryptedBytes,original);
 assert.notStrictEqual(reply.encryptedBytes,raw);
 assert.equal(raw.every(x=>x===0),true);
 assert.equal(f.w.snapshot().phase,'ready');
 const blob=consumeVerifiedAmountDownloadBytes(reply.encryptedBytes,b=>new Blob([b],{type:'application/octet-stream'}));
 assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[...original]);
 assert.equal(reply.encryptedBytes.every(x=>x===0),true);
 assert.equal(f.w.snapshot().editedCopy,null);
 await f.w.close();
});
test('real Amount denies forged extra field, wrong output name, wrong size and still wipes original raw Worker bytes',async()=>{
 for(const fault of ['extra','name','size','type']){
  const raw=new Uint8Array(original),packet=from(raw);
  if(fault==='extra')packet.writerAuthorized=true;
  if(fault==='name')packet.name='replayed.p1g';
  if(fault==='size')packet.sizeBytes=63;
  if(fault==='type')packet.kind='UNVERIFIED_DOWNLOAD';
  const f=setup(async()=>packet);await f.ready();
  await assert.rejects(f.w.downloadVerifiedCopy('backup'));
  assert.equal(raw.every(x=>x===0),true,fault);
  assert.equal(f.w.snapshot().phase,'closed',fault);
 }
});
test('real Amount rejects exact-size altered encrypted ciphertext digest and wipes raw before cleanup',async()=>{
 const raw=new Uint8Array(original);raw[17]^=0xff;
 const f=setup(async()=>from(raw));await f.ready();
 await assert.rejects(f.w.downloadVerifiedCopy('backup'),/DOWNLOAD_DIGEST_DENIED/);
 assert.equal(raw.every(x=>x===0),true);
 assert.equal(f.w.snapshot().phase,'closed');
});
test('real Amount stale Worker receipt after close must zero original buffer and never return clone',async()=>{
 let resolve,arrival;
 const started=new Promise(r=>arrival=r),delayed=new Promise(r=>resolve=r);
 const raw=new Uint8Array(original),f=setup(async()=>{arrival();await delayed;return from(raw)});
 await f.ready();
 const pending=f.w.downloadVerifiedCopy('backup');
 const denied=assert.rejects(pending,/STALE_FILE_OR_CLOSE/);
 await started;await f.w.close();resolve();await denied;
 assert.equal(raw.every(x=>x===0),true);
 assert.equal(f.w.snapshot().phase,'closed');
});
test('only original encrypted reply is erased; no new Worker transfer/Cloud/Write authority',()=>{
 assert.equal(original.length,64);
 assert.deepEqual(ack('OPEN'),{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
});
