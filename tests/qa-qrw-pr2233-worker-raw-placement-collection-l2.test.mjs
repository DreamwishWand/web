// 04 QR-W independent actual product Worker-result raw-buffer lifetime on fixed PR2233.
// Synthetic already-encrypted bytes only; no original Save, auth, Provider or keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalPlacementDevWorkflow} from '../src/lib/dev/local-placement-workflow.mjs';
import {createCollectionExact1Consumer,COLLECTION_EXACT1_BUILDS} from '../src/lib/collection/collection-exact1-consumer.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const cipher=Uint8Array.from({length:16},(_,i)=>i+7);
const pinnedSha=digest(cipher);
const falseAuthority=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const validBackup=()=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,
 separateName:true,originalName:'game.p1g',originalSha256:pinnedSha,originalSizeBytes:16,backupName:'backup.p1g'});
const target={definitionId:21,groupIndex:0,itemId:40000001,oldValue:false,groupState:'NotComplete',
 falseCount:3,coreMinted:true,eligibilityVerified:true};
async function initialized(which,receipt){
 const source=which==='placement'?{
  open:async()=>falseAuthority('OPEN'),
  backupOriginal:async()=>validBackup(),
  previewPlacement:async()=>{throw Error('PREVIEW_NOT_USED')},
  stagePlacement:async()=>{throw Error('STAGE_NOT_USED')},
  undo:async()=>falseAuthority('UNDONE'),redo:async()=>falseAuthority('REDONE'),
  exportEditedCopy:async()=>{throw Error('EXPORT_NOT_USED')},
  downloadVerifiedCopy:receipt,close:async()=>falseAuthority('CLOSED')
 }:{
  inspectCollectionTargets:async()=>({
   selection:1,build:COLLECTION_EXACT1_BUILDS['steam-windows'],originalName:'game.p1g',
   originalSha256:pinnedSha,originalSizeBytes:16,targets:[target],
   writerAuthorized:false,originalOverwriteAuthorized:false}),
  backupOriginal:async()=>validBackup(),
  previewCollectionTarget:async()=>{throw Error('PREVIEW_NOT_USED')},
  stageCollectionTarget:async()=>{throw Error('STAGE_NOT_USED')},
  undo:async()=>{throw Error('UNDO_NOT_USED')},
  redo:async()=>{throw Error('REDO_NOT_USED')},
  exportEditedCopy:async()=>{throw Error('EXPORT_NOT_USED')},
  downloadVerifiedCopy:receipt,close:async()=>falseAuthority('CLOSED')
 };
 const w=which==='placement'
  ? createLocalPlacementDevWorkflow(source,{trustedLocalHarness:true,operation:'comp03'})
  : createCollectionExact1Consumer(source,{trustedLocalHarness:true});
 if(which==='placement')await w.openFile({file:new File([cipher],'game.p1g'),buildConfirmed:true});
 else await w.load();
 await w.backupOriginal();
 return w;
}
const packet=raw=>({kind:'VERIFIED_DOWNLOAD',name:'backup.p1g',sha256:pinnedSha,sizeBytes:16,encryptedBytes:raw});
for(const kind of ['placement','collection']){
 test(kind+' actual source wipes raw return synchronously, keeps independent verified encrypted bytes, subsequent Blob handoff byte-identical',async()=>{
  const original=new Uint8Array(cipher);
  const raw=new Uint8Array(original),w=await initialized(kind,async()=>packet(raw));
  const result=await w.downloadVerifiedCopy('backup');
  assert.notStrictEqual(result.encryptedBytes,raw);
  assert.deepEqual(result.encryptedBytes,original);
  assert.equal(raw.every(x=>x===0),true);
  const blob=new Blob([result.encryptedBytes],{type:'application/octet-stream'});
  result.encryptedBytes.fill(0);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),original);
  assert.equal(w.snapshot().phase,'ready');
  await w.close();
 });
 for(const name of ['forged-additional-field','wrong-copy-name','changed-receipt-kind','bad-digest']){
  test(kind+' '+name+' original raw Worker return zero before error',async()=>{
   const raw=new Uint8Array(cipher);
   const p=packet(raw);
   if(name==='forged-additional-field')p.debugOwnerReceipt=true;
   else if(name==='wrong-copy-name')p.name='unbound.p1g';
   else if(name==='changed-receipt-kind')p.kind='SAVE_WRITER_UNLOCKED';
   else raw[0]^=0x42;
   const w=await initialized(kind,async()=>p);
   await assert.rejects(w.downloadVerifiedCopy('backup'));
   assert.equal(raw.every(x=>x===0),true,name);
   assert.equal(w.snapshot().phase,'closed');
   await w.close();
  });
 }
 test(kind+' stale Worker result after local Close revokes pending ciphertext and wipes raw',async()=>{
  let release,enter;
  const arrived=new Promise(r=>enter=r),block=new Promise(r=>release=r);
  const raw=new Uint8Array(cipher);
  const w=await initialized(kind,async()=>{enter();await block;return packet(raw)});
  const result=w.downloadVerifiedCopy('backup'),deny=assert.rejects(result);
  await arrived;await w.close();release();await deny;
  assert.equal(raw.every(x=>x===0),true);
  assert.equal(w.snapshot().phase,'closed');
 });
}
test('no exported source Worker secrets, rights, or ephemeral ciphertext in snapshot',async()=>{
 const raw=new Uint8Array(cipher),w=await initialized('collection',async()=>packet(raw));
 const result=await w.downloadVerifiedCopy('backup');
 assert.equal(JSON.stringify(w.snapshot()).includes('encryptedBytes'),false);
 assert.equal(JSON.stringify(w.snapshot()).includes('writerAuthorized":true'),false);
 result.encryptedBytes.fill(0);await w.close();
});
