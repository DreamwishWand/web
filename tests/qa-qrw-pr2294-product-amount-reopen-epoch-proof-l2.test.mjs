// 04 QR-W independent P0 L2: actual Steam626 local Amount workflow receipt boundary.
// Synthetic result booleans do not constitute genuine OS-process verification.
// Test only the newly changed proof-mode acceptance and its epoch/alias closure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {
  createLocalAmountDevWorkflow,STEAM626_FULL_VERSION
} from '../src/lib/dev/local-amount-workflow.mjs';

const sha='a'.repeat(64), edited='b'.repeat(64),original='owner-original.p1g';
const source={file:{name:original,size:4096},originalSha256:sha,
 fullVersion:STEAM626_FULL_VERSION,buildConfirmed:true};
const r=k=>({kind:k,ok:true,writerAuthorized:false,
 nativeV3Verified:false,originalOverwriteAuthorized:false});
const target=()=>({kind:'ChestExistingSlotAmountDecrease',
 targetId:12,itemId:40000048,slotIndex:0,compatibleItemType:null,
 oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
const exportReceipt=(proof,overrides={})=>({
 ...r('EXPORTED'),editedCopyName:'encrypted-edited.p1g',
 editedSha256:edited,editedSizeBytes:4096,backupName:'immutable-backup.p1g',
 editedCiphertextVerified:true,freshWorkerReopenVerified:true,
 independentProcessReopenVerified:proof,originalUnchanged:true,...overrides
});
function mock(proof,overrides={},deferExport=false){
 let done=null,calls={close:0,download:0,export:0};
 const port={
  async open(){return r('OPEN')},
  async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,
   shaMatched:true,sizeMatched:true,separateName:true,
   originalName:original,originalSha256:sha,originalSizeBytes:4096,
   backupName:'immutable-backup.p1g'}},
  async listVerifiedTargets(){return {targets:[target()],rawDocumentExposed:false}},
  async stageTyped(){return r('STAGED')},
  async undo(){return r('UNDONE')},
  async redo(){return r('REDONE')},
  async exportEditedCopy(){
   calls.export++;
   if(deferExport) return new Promise(resolve=>{done=()=>resolve(exportReceipt(proof,overrides))});
   return exportReceipt(proof,overrides);
  },
  async downloadVerifiedCopy(){calls.download++;throw Error('DOWNLOAD_FORBIDDEN')},
  async close(){calls.close++;return r('CLOSED')}
 };
 return {port,calls,release:()=>done?.()};
}
async function stage({proof=false,requireProof=true,overrides={},deferExport=false}={}){
 const m=mock(proof,overrides,deferExport);
 const w=createLocalAmountDevWorkflow(m.port,{
  trustedLocalHarness:true,steam626Chest:true,exactOneDecrease:true,
  requireIndependentProcessReopen:requireProof
 });
 await w.open(source);await w.backupAndRead();await w.stage(0,49);
 assert.equal(w.snapshot().phase,'staged');
 return {w,...m};
}
async function rejectsClosed(v){
 await assert.rejects(v.w.exportEditedCopy(),/DEV_AMOUNT_UI_EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 assert.equal(v.w.snapshot().backupVerified,false);
 assert.equal(v.w.snapshot().targets.length,0);
 assert.equal(v.calls.export,1);
 assert.equal(v.calls.download,0);
 assert.equal(v.calls.close>=2,true);
 await assert.rejects(v.w.downloadVerifiedCopy('edited'),/DOWNLOAD_SCOPE_DENIED/);
 assert.equal(v.calls.download,0);
}
test('current authentic scoped-product adapter false receipt cannot display or download an edited copy',async()=>{
 await rejectsClosed(await stage({proof:false}));
});
test('product output proof rejects absent, null, number, truthy string and Boolean-object impersonations',async()=>{
 for(const proof of [undefined,null,0,1,'true','false',new Boolean(true),[],{},'']){
  await rejectsClosed(await stage({proof}));
 }
});
test('product true-only receipt still denies mismatched encrypted alias, source SHA, backup name, and unapproved writer',async()=>{
 const attacks=[
  {editedCopyName:original},
  {editedCopyName:'immutable-backup.p1g'},
  {editedSha256:sha},
  {editedSha256:'A'.repeat(64)},
  {editedSizeBytes:0},
  {backupName:'changed-backup.p1g'},
  {writerAuthorized:true},
  {nativeV3Verified:true},
  {originalOverwriteAuthorized:true},
  {originalUnchanged:false},
  {freshWorkerReopenVerified:false},
  {editedCiphertextVerified:false},
  {receipt:'signed'},
  {kind:'APPROVED'}
 ];
 for(const overrides of attacks){
  await rejectsClosed(await stage({proof:true,overrides}));
 }
});
test('product true receipt cannot resurrect export if Close revokes epoch before late Worker result',async()=>{
 const v=await stage({proof:true,deferExport:true});
 const inflight=v.w.exportEditedCopy();
 await Promise.resolve();
 assert.equal(v.calls.export,1);
 await v.w.close();
 assert.equal(v.w.snapshot().phase,'closed');
 v.release();
 await assert.rejects(inflight,/STALE_FILE_OR_CLOSE/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 assert.equal(v.calls.download,0);
 await assert.rejects(v.w.downloadVerifiedCopy('edited'),/DOWNLOAD_SCOPE_DENIED/);
});
test('DEV codec Worker false receipt remains false, and DEV forged true receipt fails closed',async()=>{
 const accepted=await stage({proof:false,requireProof:false});
 const state=await accepted.w.exportEditedCopy();
 assert.equal(state.phase,'exported');
 assert.equal(state.editedCopy.independentProcessReopenVerified,false);
 assert.equal(accepted.calls.download,0);
 const forged=await stage({proof:true,requireProof:false});
 await rejectsClosed(forged);
});
test('a synthetic true product receipt changes UI state only; does not imply physical new process or Writer ON',async()=>{
 const accepted=await stage({proof:true});
 const state=await accepted.w.exportEditedCopy();
 assert.equal(state.phase,'exported');
 assert.equal(state.editedCopy.independentProcessReopenVerified,true);
 assert.equal(state.editedCopy.name,'encrypted-edited.p1g');
 assert.equal(accepted.calls.download,0);
 assert.equal(accepted.calls.close,1,'opening closes previous logical session exactly once');
 assert.equal(Object.hasOwn(state,'writerAuthorized'),false);
});
test('proof requirement must be an exact boolean and may not inherit authority from caller strings or extra modes',()=>{
 for(const bad of [undefined===null?'bad':null,'true',1,0,[],{},new Boolean(true),NaN]){
  assert.throws(()=>createLocalAmountDevWorkflow(mock(false).port,{
   trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
   requireIndependentProcessReopen:bad
  }),/DEV_AMOUNT_UI_LOCAL_HARNESS_GATE_OFF/);
 }
});
test('actual compiled Svelte uses immutable branded productPort scope rather than public DEV gate or user-provided flag',()=>{
 const originalSource=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 const compiled=compile(originalSource,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert(compiled.js.code.length>1000);
 assert.match(originalSource,/const productScope=switchScope\|\|steamScope\|\|catalogScope/);
 assert.match(originalSource,/if\(!productScope&&\(!import\.meta\.env\.DEV\|\|verifiedLocalDevGate!==true\|\|!trustedWorkerAdapter\)\)return/);
 assert.match(originalSource,/requireIndependentProcessReopen:!!productScope/);
 assert.match(originalSource,/data-product-writer="off"/);
 assert.match(originalSource,/data-cloud="off"/);
 assert.match(originalSource,/data-original-overwrite="off"/);
 assert.match(originalSource,/\{#if phase==='exported' && state\.editedCopy\}/);
});
