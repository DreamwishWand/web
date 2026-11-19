import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION} from '../src/lib/dev/local-amount-workflow.mjs';

const SHA='a'.repeat(64),name='genuine-owner-local.p1g',file={name,size:4096};
const build={file,fullVersion:STEAM626_FULL_VERSION,originalSha256:SHA,buildConfirmed:true};
const flags={writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false};
const receipt=kind=>({kind,ok:true,...flags});
const chest={kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:40000048,
 slotIndex:0,compatibleItemType:null,oldAmount:50,
 registryVerified:true,sourceVerified:true,rightsAllowed:true};

function adapter(independentProcessReopenVerified,other={}){
 return {
  async open(){return receipt('OPEN')},
  async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,
   shaMatched:true,sizeMatched:true,separateName:true,originalName:name,
   originalSha256:SHA,originalSizeBytes:4096,backupName:'original-backup.p1g'}},
  async listVerifiedTargets(){return {targets:[chest],rawDocumentExposed:false}},
  async stageTyped(){return receipt('STAGED')},
  async undo(){return receipt('UNDONE')},
  async redo(){return receipt('REDONE')},
  async exportEditedCopy(){return {
   ...receipt('EXPORTED'),editedCopyName:'edited-copy.p1g',editedSha256:'b'.repeat(64),
   editedSizeBytes:4096,backupName:'original-backup.p1g',
   editedCiphertextVerified:true,freshWorkerReopenVerified:true,
   independentProcessReopenVerified,originalUnchanged:true,...other
  }},
  async downloadVerifiedCopy(){throw Error('DOWNLOAD_NOT_EXPECTED')},
  async close(){return receipt('CLOSED')}
 };
}
async function staged(flag,opts={}){
 const {requireIndependentProcessReopen=false,...receiptOverrides}=opts;
 const w=createLocalAmountDevWorkflow(adapter(flag,receiptOverrides),{
  trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
  requireIndependentProcessReopen
 });
 await w.open(build);
 await w.backupAndRead();
 await w.stage(0,49);
 return w;
}

test('trusted product Port rejects codec-only false independent-process receipt and closes',async()=>{
 const w=await staged(false,{requireIndependentProcessReopen:true});
 await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(w.snapshot().phase,'closed');
 assert.equal(w.snapshot().editedCopy,null);
});

test('trusted product Port accepts only explicit true independent-process receipt',async()=>{
 const w=await staged(true,{requireIndependentProcessReopen:true});
 await w.exportEditedCopy();
 assert.equal(w.snapshot().phase,'exported');
 assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,true);
});

test('historical DEV/OFF admits codec-only false receipt without inventing native OS proof',async()=>{
 const w=await staged(false);
 await w.exportEditedCopy();
 assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,false);
});

test('DEV/OFF rejects untrusted true OS proof and forged owner capability',async()=>{
 const w=await staged(true);
 await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(w.snapshot().phase,'closed');
});

test('product true proof cannot bypass original alias, bitmap or writer restrictions',async()=>{
 for(const other of [
  {editedCopyName:name},{editedCopyName:'original-backup.p1g'},
  {writerAuthorized:true},{originalOverwriteAuthorized:true},
  {freshWorkerReopenVerified:false}
 ]){
  const w=await staged(true,{requireIndependentProcessReopen:true,...other});
  await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
  assert.equal(w.snapshot().phase,'closed');
 }
});

test('unknown product-proof mode fails closed at workflow construction',()=>{
 assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{
  trustedLocalHarness:true,requireIndependentProcessReopen:'true'
 }),/LOCAL_HARNESS_GATE_OFF/);
});

test('actual Svelte binds strict product-proof only to sealed WeakMap product Port',()=>{
 const original=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 compile(original,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert.match(original,/const productScope=switchScope\|\|steamScope\|\|catalogScope/);
 assert.match(original,/requireIndependentProcessReopen:!!productScope/);
 assert.match(original,/data-product-writer="off"/);
 assert.match(original,/data-original-overwrite="off"/);
});
