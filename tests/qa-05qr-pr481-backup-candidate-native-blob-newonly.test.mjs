import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createLocalSaveSessionBridge, LOCAL_MAX_P1G_BYTES
} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';

const BID='9A239D3DB569756D';
const att={platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
  buildId:BID,schema:626,externallyConfirmed:true};
const sourceFile=bytes=>Object.assign(new Blob([bytes]),{name:'synthetic-private-source.p1g'});
const scope=r=>({sessionId:r.sessionId,sourceSha256:r.sourceSha256,
  revision:r.revision,indexGeneration:r.indexGeneration});

function isolatedWorker(){
  const handlers=new Map();
  let seq=0,dead=false;
  const emit=(name,data)=>{for(const fn of handlers.get(name)||[])fn({data});};
  const worker={
    addEventListener(name,fn){
      if(!handlers.has(name))handlers.set(name,[]);
      handlers.get(name).push(fn);
    },
    postMessage(message){
      queueMicrotask(async()=>{
        if(dead)return;
        if(message.type==='CLOSE'){
          emit('message',{id:message.id,ok:true,result:{closed:true,writerAuthorized:false}});
        }else if(message.type==='OPEN_FILE'){
          const digest=createHash('sha256').update(new Uint8Array(await message.file.arrayBuffer())).digest('hex');
          emit('message',{id:message.id,ok:true,result:{
            sessionId:(++seq).toString(16).padStart(32,'0'),
            revision:0,indexGeneration:seq,sourceSha256:digest,
            registrySha256:'a'.repeat(64),
            sourceSchema:626,sourcePlatform:'switch',
            externalFullVersion:'1.25.3',externalBID:BID,
            savedContainerCount:1,unsupportedContainerCount:0,
            writerAuthorized:false,productRustWorkerAccepted:false
          }});
        }else emit('message',{id:message.id,ok:false,error:'READ_WRITER_OPERATION_DISABLED'});
      });
    },
    terminate(){dead=true;}
  };
  queueMicrotask(()=>emit('message',{id:0,ready:true,writerAuthorized:false}));
  return worker;
}

test('separately selected equal candidate across 1MiB boundary proves bytes only and explicitly not persistence',async()=>{
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  const bytes=new Uint8Array(1024*1024+13);
  bytes.fill(43);bytes.at(-1);bytes[bytes.length-1]=79;
  const first=await b.openLocalFile(sourceFile(bytes),att);
  const r=await b.verifyUserSelectedOriginalBackupCandidate(new Blob([bytes]),scope(first));
  assert.equal(r.candidateBytesMatchOriginal,true);
  assert.equal(r.comparedByteCount,bytes.length);
  for(const k of ['persistedVerified','distinctDiskPathVerified',
    'originalOverwriteProtectionVerified','writerAuthorized'])assert.equal(r[k],false,k);
  assert.equal('privateFile' in r,false);
  assert.equal('decodedProfile' in r,false);
  assert.equal(b.getCapabilities().maxCiphertextBytes,LOCAL_MAX_P1G_BYTES);
  assert.equal(b.getCapabilities().canEncodeEditedCopy,false);
  assert.equal(b.getCapabilities().canReplaceOriginal,false);
  b.destroy();
});

test('misleading session and same-size changed byte cannot claim byte equality',async()=>{
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  const original=Uint8Array.from([1,2,3,4]);
  const r=await b.openLocalFile(sourceFile(original),att);
  for(const forged of [
    {...scope(r),revision:1},{...scope(r),indexGeneration:r.indexGeneration+1},
    {...scope(r),writerAuthorized:true},{...scope(r),sourceSha256:'0'.repeat(64)}
  ])await assert.rejects(
    b.verifyUserSelectedOriginalBackupCandidate(new Blob([original]),forged),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(
    b.verifyUserSelectedOriginalBackupCandidate(new Blob([Uint8Array.from([1,2,3,99])]),scope(r)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/);
  b.destroy();
});

test('a caller-modified Blob.slice must NOT spoof equal backup bytes',async()=>{
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  const original=Uint8Array.from([11,22,33,44]);
  const receipt=await b.openLocalFile(sourceFile(original),att);
  const malicious=new Blob([Uint8Array.from([99,98,97,96])]);
  // Actual intrinsic Blob bytes differ. UI may pass a Blob subclass/instance
  // with shadowed .slice; the public read-only result must not certify it.
  malicious.slice=()=>new Blob([original]);
  await assert.rejects(
    b.verifyUserSelectedOriginalBackupCandidate(malicious,scope(receipt)),
    /LOCAL_BACKUP_CANDIDATE_(BYTES_DIFFER|LOCAL_READ_FAILED|NOT_DISTINCT_BOUNDED)/);
  assert.equal(b.getCapabilities().canEncodeEditedCopy,false);
  b.destroy();
});

test('a real Blob.slice candidate still rejects same original object, stale A→B and no OS durability claim',async()=>{
  const b=createLocalSaveSessionBridge(isolatedWorker);
  await b.ensureReady();
  const original=sourceFile(Uint8Array.from([8,7,6,5]));
  const a=await b.openLocalFile(original,att);
  await assert.rejects(
    b.verifyUserSelectedOriginalBackupCandidate(original,scope(a)),
    /LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED/);
  const next=await b.openLocalFile(sourceFile(Uint8Array.from([4,3,2,1])),att);
  assert.notEqual(next.sessionId,a.sessionId);
  await assert.rejects(
    b.verifyUserSelectedOriginalBackupCandidate(new Blob([Uint8Array.from([8,7,6,5])]),scope(a)),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  b.destroy();
});
