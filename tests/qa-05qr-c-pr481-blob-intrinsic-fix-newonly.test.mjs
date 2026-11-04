import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';

// 05 QR-C: ONLY new PR481 repair delta after frozen QA487 RED.
// This synthetic Worker does not authenticate actual encrypted P1G or Writer.
const BID='9A239D3DB569756D';
const att=Object.freeze({platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
  buildId:BID,schema:626,externallyConfirmed:true});
const sourceFile=b=>Object.assign(new Blob([b]),{name:'synthetic-private.p1g'});
const scope=r=>({sessionId:r.sessionId,sourceSha256:r.sourceSha256,
  revision:r.revision,indexGeneration:r.indexGeneration});
function isolatedWorker(){
  const handlers=new Map();let n=0,terminated=false;
  const emit=(kind,data)=>{for(const fn of handlers.get(kind)||[])fn({data});};
  const worker={
    addEventListener(kind,fn){if(!handlers.has(kind))handlers.set(kind,[]);handlers.get(kind).push(fn);},
    postMessage(msg){
      queueMicrotask(async()=>{
        if(terminated)return;
        if(msg.type==='CLOSE')
          return emit('message',{id:msg.id,ok:true,result:{closed:true,writerAuthorized:false}});
        if(msg.type!=='OPEN_FILE')
          return emit('message',{id:msg.id,ok:false,error:'READ_WRITER_OPERATION_DISABLED'});
        const bytes=await Blob.prototype.arrayBuffer.call(msg.file);
        const digest=createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
        const id=++n;
        emit('message',{id:msg.id,ok:true,result:{
          sessionId:id.toString(16).padStart(32,'0'),revision:0,indexGeneration:id,
          sourceSha256:digest,registrySha256:'a'.repeat(64),sourceSchema:626,
          sourcePlatform:'switch',externalFullVersion:'1.25.3',externalBID:BID,
          savedContainerCount:1,unsupportedContainerCount:0,
          writerAuthorized:false,productRustWorkerAccepted:false
        }});
      });
    },
    terminate(){terminated=true;}
  };
  queueMicrotask(()=>emit('message',{id:0,ready:true,writerAuthorized:false}));
  return worker;
}
async function opened(raw){
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  const r=await b.openLocalFile(sourceFile(raw),att);
  return {b,r};
}
const noPrivileges=(r,b)=>{
  for(const key of ['persistedVerified','distinctDiskPathVerified',
    'originalOverwriteProtectionVerified','writerAuthorized'])
    assert.equal(r[key],false,key);
  const flags=b.getCapabilities();
  for(const key of ['canCommit','canEncodeEditedCopy','canApply','canReplaceOriginal',
    'readInventory','readGrid'])assert.equal(flags[key],false,key);
  assert.equal(flags.maxCiphertextBytes,LOCAL_MAX_P1G_BYTES);
};

test('fixed RED scope: candidate shadows slice AND arrayBuffer but intrinsic bytes differ',async()=>{
  const {b,r}=await opened(Uint8Array.of(11,22,33,44));
  const wrong=new Blob([Uint8Array.of(90,91,92,93)]);
  wrong.slice=()=>new Blob([Uint8Array.of(11,22,33,44)]);
  wrong.arrayBuffer=async()=>Uint8Array.of(11,22,33,44).buffer;
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(wrong,scope(r)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/);
  assert.equal(b.getCapabilities().canEncodeEditedCopy,false);
  b.destroy();
});

test('fixed RED scope: subclass overrides size/slice/arrayBuffer and cannot truncate source compare',async()=>{
  const {b,r}=await opened(Uint8Array.of(1,2,3,4));
  class PoisonBlob extends Blob{
    get size(){return 4;}
    slice(){return new Blob([Uint8Array.of(1,2,3,4)]);}
    async arrayBuffer(){return Uint8Array.of(1,2,3,4).buffer;}
  }
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new PoisonBlob([Uint8Array.of(1,2,3,4,9)]),scope(r)),
    /LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED/);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new PoisonBlob([Uint8Array.of(1,2,3,9)]),scope(r)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/);
  b.destroy();
});

test('fixed RED scope: fake instanceof Blob without native internal slots fails closed',async()=>{
  const {b,r}=await opened(Uint8Array.of(1,2,3,4));
  const masquerade=Object.create(Blob.prototype);
  Object.defineProperty(masquerade,'size',{value:4});
  masquerade.slice=()=>new Blob([Uint8Array.of(1,2,3,4)]);
  assert.equal(masquerade instanceof Blob,true);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(masquerade,scope(r)),
    /LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED/);
  b.destroy();
});

test('fixed RED scope: real original/candidate bytes across 1MiB boundary ignore both shadowed methods; no OS persistence',async()=>{
  const size=1024*1024+17,bytes=new Uint8Array(size);
  bytes.fill(71);bytes[bytes.length-1]=9;
  const src=sourceFile(bytes);
  src.slice=()=>new Blob([Uint8Array.of(0)]);
  src.arrayBuffer=async()=>Uint8Array.of(0).buffer;
  Object.defineProperty(src,'size',{value:1,configurable:true});
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  // The accepted bridge still bounds opening via caller File.size; use a
  // normal source for opening, then poison its methods before reimport.
  delete src.size;
  const receipt=await b.openLocalFile(src,att);
  Object.defineProperty(src,'size',{value:1,configurable:true});
  const candidate=new Blob([bytes]);
  candidate.slice=()=>new Blob([Uint8Array.of(99)]);
  candidate.arrayBuffer=async()=>Uint8Array.of(99).buffer;
  Object.defineProperty(candidate,'size',{value:1,configurable:true});
  const ok=await b.verifyUserSelectedOriginalBackupCandidate(candidate,scope(receipt));
  assert.equal(ok.candidateBytesMatchOriginal,true);
  assert.equal(ok.comparedByteCount,size);
  assert.equal(ok.sourceSha256,receipt.sourceSha256);
  noPrivileges(ok,b);
  const changed=bytes.slice();changed[changed.length-1]^=0xff;
  const wrong=new Blob([changed]);
  wrong.slice=()=>new Blob([bytes]);
  wrong.arrayBuffer=async()=>bytes.buffer;
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(wrong,scope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/);
  b.destroy();
});

test('fixed repair cannot mint Native/Writer from source spoof and stale A to B receipt',async()=>{
  const {b,r}=await opened(Uint8Array.of(1,2,3,4));
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(1,2,3,4)]),{...scope(r),nativeV3Accepted:true}),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  const next=await b.openLocalFile(sourceFile(Uint8Array.of(5,6,7,8)),att);
  assert.notEqual(next.sessionId,r.sessionId);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(1,2,3,4)]),scope(r)),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(b.submitOperation({kind:'SET_W1_NEXT',sessionId:next.sessionId}),
    /LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
  b.destroy();
});
