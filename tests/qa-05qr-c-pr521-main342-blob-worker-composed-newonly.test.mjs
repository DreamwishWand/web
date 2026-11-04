import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {inspectW1SceneAreaReferences} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
import {requireOwnerPrivateScope} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';

// Independent 05 QR-C: PR521 MAIN342823 COMPOSITION ONLY.
// This Worker is a synthetic stub, NOT the real P1G codec or native SaveSession.
// No private P1G/key, OS persistence or automatic cloud upload is tested.
const BID='9A239D3DB569756D';
const BUILD=Object.freeze({platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
  buildId:BID,schema:626,externallyConfirmed:true});
const FILE=b=>Object.assign(new Blob([b]),{name:'qa-synthetic-no-private-save.p1g'});
const SCOPE=r=>({sessionId:r.sessionId,sourceSha256:r.sourceSha256,
  revision:r.revision,indexGeneration:r.indexGeneration});
const context=Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:BID,schema:626,sourceSha256:'b'.repeat(64),sourceRevision:'main342823-qa-only'});
function profile(){
  return {GameInfo:{Version:626},World:{
    Villages:[{SceneItemId:1540000000,Areas:{
      '1':{Unlocked:true,GridIDs:[100]}
    }}],
    GridCollection:{Grids:{'100':{ID:100,Objects:{}}},
      DiffGrids:{}}
  }};
}
function mockWorker(){
  const callbacks=new Map();
  let seq=0,active=null,terminated=false;
  const emit=(name,data)=>{for(const f of callbacks.get(name)??[])f({data});};
  const worker={
    addEventListener(name,cb){if(!callbacks.has(name))callbacks.set(name,[]);callbacks.get(name).push(cb);},
    postMessage(msg){
      queueMicrotask(async()=>{
        if(terminated)return;
        if(msg.type==='CLOSE'){active=null;
          emit('message',{id:msg.id,ok:true,result:{closed:true,writerAuthorized:false}});
          return;
        }
        if(msg.type==='OPEN_FILE'){
          const raw=await Blob.prototype.arrayBuffer.call(msg.file);
          const digest=createHash('sha256').update(new Uint8Array(raw)).digest('hex');
          const id=++seq;
          active={sessionId:id.toString(16).padStart(32,'0'),sourceSha256:digest,
            revision:0,indexGeneration:id};
          emit('message',{id:msg.id,ok:true,result:{
            ...active,registrySha256:'e'.repeat(64),sourceSchema:626,
            sourcePlatform:'switch',externalFullVersion:'1.25.3',
            externalBID:BID,savedContainerCount:1,unsupportedContainerCount:0,
            writerAuthorized:false,productRustWorkerAccepted:false
          }});
          return;
        }
        if(msg.type==='QUERY' && active){
          emit('message',{id:msg.id,ok:true,result:{
            ...active,rows:[{eventId:2010000021,kind:'ItemSpawning',nextOccurrence:'2126-08-20T00:00:00Z'}],
            total:1,complete:true,writerAuthorized:false,productRustWorkerAccepted:false
          }});
          return;
        }
        emit('message',{id:msg.id,ok:false,error:'READ_WRITER_OPERATION_DISABLED'});
      });
    },
    terminate(){terminated=true;}
  };
  queueMicrotask(()=>emit('message',{id:0,ready:true,writerAuthorized:false}));
  return worker;
}
async function open(bytes){
  const b=createLocalSaveSessionBridge(mockWorker);
  await b.ensureReady();
  const original=FILE(bytes);
  const receipt=await b.openLocalFile(original,BUILD);
  return {b,original,receipt};
}
function assertReadOnly(b,result){
  for(const k of ['persistedVerified','distinctDiskPathVerified',
    'originalOverwriteProtectionVerified','writerAuthorized'])
    assert.equal(result[k],false,k);
  const c=b.getCapabilities();
  for(const k of ['canCommit','canEncodeEditedCopy','canApply','canReplaceOriginal',
    'sourceCoreWriterAccepted','nativeSemanticsW1Verified','readGrid','readInventory'])
    assert.equal(c[k],false,k);
  assert.equal(c.maxCiphertextBytes,128*1024*1024);
  assert.equal(c.maxCiphertextBytes,LOCAL_MAX_P1G_BYTES);
}

test('latest main W1-only Worker page + Scene source diagnostic coexist with a matching backup candidate; never Native/Writer',async()=>{
  const {b,receipt,original}=await open(Uint8Array.of(11,12,13,14,15));
  const page=await b.readDomainPage({...SCOPE(receipt),domain:'RecurringEvents',limit:1});
  assert.equal(page.rows.length,1);
  assert.equal(page.rows[0].eventId,2010000021);
  await assert.rejects(b.readDomainPage({...SCOPE(receipt),domain:'Grid',limit:1}),
    /LOCAL_READ_CAPABILITY_NOT_ACCEPTED/);
  const scene=inspectW1SceneAreaReferences(profile(),context);
  assert.equal(scene.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(scene.selectedNativeWetlandAreaKey,null);
  assert.equal(scene.actualWetlandAreaVerified,false);
  assert.equal(scene.nativeEffectiveGridVerified,false);
  assert.equal(scene.productWriterAuthorized,false);
  const before=await Blob.prototype.arrayBuffer.call(original);
  const equal=await b.verifyUserSelectedOriginalBackupCandidate(new Blob([before]),SCOPE(receipt));
  assert.equal(equal.candidateBytesMatchOriginal,true);
  assert.equal(equal.comparedByteCount,before.byteLength);
  assert.equal(equal.sourceSha256,receipt.sourceSha256);
  assertReadOnly(b,equal);
  assert.deepEqual(new Uint8Array(await Blob.prototype.arrayBuffer.call(original)),
    new Uint8Array(before),'unmodified source bytes');
  b.destroy();
});

test('across 1MiB chunk boundary latest-main Worker scope still compares native Blob internal bytes, not shadowed properties',async()=>{
  const bytes=new Uint8Array(1024*1024+11);bytes.fill(33);
  bytes[0]=19;bytes[bytes.length-1]=81;
  const {b,receipt,original}=await open(bytes);
  Object.defineProperty(original,'size',{configurable:true,value:2});
  original.slice=()=>new Blob([Uint8Array.of(19,33)]);
  original.arrayBuffer=async()=>Uint8Array.of(19,33).buffer;
  const candidate=new Blob([bytes]);
  Object.defineProperty(candidate,'size',{configurable:true,value:1});
  candidate.slice=()=>new Blob([Uint8Array.of(0)]);
  candidate.arrayBuffer=async()=>Uint8Array.of(0).buffer;
  const ok=await b.verifyUserSelectedOriginalBackupCandidate(candidate,SCOPE(receipt));
  assert.equal(ok.comparedByteCount,bytes.length);
  assert.equal(ok.sourceRevision,receipt.revision);
  assert.equal(ok.indexGeneration,receipt.indexGeneration);
  assertReadOnly(b,ok);
  const mutated=bytes.slice();mutated[mutated.length-1]^=0xff;
  const bad=new Blob([mutated]);
  bad.slice=()=>new Blob([bytes]);bad.arrayBuffer=async()=>bytes.buffer;
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(bad,SCOPE(receipt)),
    /LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER/);
  b.destroy();
});

test('current main single Worker CLOSE revokes a live native-byte comparison without reading an old source twice',async()=>{
  const raw=new Uint8Array(1024*1024+7);raw.fill(42);
  const {b,receipt}=await open(raw);
  const inFlight=b.verifyUserSelectedOriginalBackupCandidate(new Blob([raw]),SCOPE(receipt));
  const closing=b.close(); // synchronous epoch change before its first async chunk settles
  await assert.rejects(inFlight,/LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED/);
  assert.deepEqual(await closing,{closed:true,writerAuthorized:false});
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(new Blob([raw]),SCOPE(receipt)),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  assert.equal(b.getSession(),null);
  b.destroy();
});

test('source epoch A to B and mismatched typed W1 scope never bless old backup candidate or Writer',async()=>{
  const {b,receipt:a}=await open(Uint8Array.of(41,42,43,44));
  const newReceipt=await b.openLocalFile(FILE(Uint8Array.of(51,52,53,54)),BUILD);
  assert.notEqual(a.sessionId,newReceipt.sessionId);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(41,42,43,44)]),SCOPE(a)),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(51,52,53,54)]),{...SCOPE(newReceipt),nativeV3Accepted:true}),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(51,52,53,54)]),{...SCOPE(newReceipt),indexGeneration:newReceipt.indexGeneration-1}),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(b.submitOperation({kind:'SET_W1_NEXT',sessionId:newReceipt.sessionId}),
    /LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
  const ok=await b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(51,52,53,54)]),SCOPE(newReceipt));
  assertReadOnly(b,ok);
  b.destroy();
});

test('main342 W1 Scene refuses paired Grid/DiffGrid corruption independent of positive candidate byte check; local private E2E policy remains CI-blocked',async()=>{
  const {b,receipt}=await open(Uint8Array.of(3,4,5,6));
  const p=profile();
  p.World.GridCollection.DiffGrids['100']={ID:999,ModifiedObjects:{},RemovedObjects:{}};
  const s=inspectW1SceneAreaReferences(p,context);
  assert.equal(s.status,'SOURCE_STRUCTURE_REJECTED');
  assert.equal(s.reason,'SOURCE_GRID_MAP_ID_MISMATCH');
  assert.equal(s.productWriterAuthorized,false);
  assert.equal(s.originalOverwriteAuthorized,false);
  const match=await b.verifyUserSelectedOriginalBackupCandidate(
    new Blob([Uint8Array.of(3,4,5,6)]),SCOPE(receipt));
  assert.equal(match.candidateBytesMatchOriginal,true);
  assertReadOnly(b,match);
  assert.throws(()=>requireOwnerPrivateScope({env:{CI:'true',WEP_PRIVATE_P1G_PATH:'/private/not-for-ci.p1g'}}),
    /PRIVATE_SAVE_CI_FORBIDDEN/);
  b.destroy();
});
