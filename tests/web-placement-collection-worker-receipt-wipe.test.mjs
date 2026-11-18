import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalPlacementDevWorkflow} from '../src/lib/dev/local-placement-workflow.mjs';
import {createCollectionExact1Consumer,COLLECTION_EXACT1_BUILDS} from '../src/lib/collection/collection-exact1-consumer.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const original=Uint8Array.from({length:16},(_,i)=>i+1);
const sourceSha=digest(original);
const safe=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const backup=()=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
 originalName:'source.p1g',originalSha256:sourceSha,originalSizeBytes:16,backupName:'backup.p1g'});
const target={definitionId:21,groupIndex:0,itemId:40000001,oldValue:false,groupState:'NotComplete',
 falseCount:3,coreMinted:true,eligibilityVerified:true};

async function prepared(kind,raw,{name='backup.p1g',delay=null}={}){
 const response=()=>({kind:'VERIFIED_DOWNLOAD',name,sha256:sourceSha,sizeBytes:16,encryptedBytes:raw});
 const download=async()=>{if(delay){delay.enter();await delay.wait}return response()};
 const adapter=kind==='placement'?{
  open:async()=>safe('OPEN'),backupOriginal:async()=>backup(),
  previewPlacement:async()=>{throw Error('NO_PREVIEW')},stagePlacement:async()=>{throw Error('NO_STAGE')},
  undo:async()=>safe('UNDONE'),redo:async()=>safe('REDONE'),
  exportEditedCopy:async()=>{throw Error('NO_EXPORT')},
  downloadVerifiedCopy:download,close:async()=>safe('CLOSED')
 }:{
  inspectCollectionTargets:async()=>({selection:1,build:COLLECTION_EXACT1_BUILDS['steam-windows'],
   originalName:'source.p1g',originalSha256:sourceSha,originalSizeBytes:16,
   targets:[target],writerAuthorized:false,originalOverwriteAuthorized:false}),
  backupOriginal:async()=>backup(),
  previewCollectionTarget:async()=>{throw Error('NO_PREVIEW')},
  stageCollectionTarget:async()=>{throw Error('NO_STAGE')},
  undo:async()=>{throw Error('NO_UNDO')},redo:async()=>{throw Error('NO_REDO')},
  exportEditedCopy:async()=>{throw Error('NO_EXPORT')},
  downloadVerifiedCopy:download,close:async()=>safe('CLOSED')
 };
 let w;
 if(kind==='placement'){
  w=createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness:true,operation:'comp03'});
  const f=new File([original],'source.p1g');
  await w.openFile({file:f,buildConfirmed:true});await w.backupOriginal();
 }else{
  w=createCollectionExact1Consumer(adapter,{trustedLocalHarness:true});
  await w.load();await w.backupOriginal();
 }
 return w;
}
for(const kind of ['placement','collection']){
 test(kind+' wipes nonzero raw Worker reply while preserving independently checked ciphertext',async()=>{
  const raw=new Uint8Array(original),w=await prepared(kind,raw);
  const returned=await w.downloadVerifiedCopy('backup');
  assert.deepEqual(returned.encryptedBytes,original);
  assert.notStrictEqual(returned.encryptedBytes,raw);
  assert.equal(raw.every(x=>x===0),true,'raw Worker reply must be zeroed before returning');
  returned.encryptedBytes.fill(0);
  await w.close();
 });
 test(kind+' rejects malformed Worker name and wipes original encrypted reply',async()=>{
  const raw=new Uint8Array(original),w=await prepared(kind,raw,{name:'not-authorized.p1g'});
  await assert.rejects(w.downloadVerifiedCopy('backup'));
  assert.equal(raw.every(x=>x===0),true);
  await w.close();
 });
 test(kind+' denies digest mismatch and wipes both borrowed raw and disposable copy',async()=>{
  const raw=Uint8Array.from({length:16},(_,i)=>i+21);
  const w=await prepared(kind,raw);
  await assert.rejects(w.downloadVerifiedCopy('backup'));
  assert.equal(raw.every(x=>x===0),true);
  await w.close();
 });
 test(kind+' stale close after Worker await wipes returned encrypted bytes',async()=>{
  let entered,release;
  const wait=new Promise(r=>release=r),arrival=new Promise(r=>entered=r);
  const raw=new Uint8Array(original);
  const w=await prepared(kind,raw,{delay:{enter:()=>entered(),wait}});
  const pending=w.downloadVerifiedCopy('backup'),denied=assert.rejects(pending);
  await arrival;await w.close();release();await denied;
  assert.equal(raw.every(x=>x===0),true);
 });
}
