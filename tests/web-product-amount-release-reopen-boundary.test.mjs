import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {acceptedProductAmountReleaseV2Evidence} from '../src/lib/dev/product-amount-release-v2-evidence.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION,SWITCH626_CHEST_BID} from '../src/lib/dev/local-amount-workflow.mjs';

const sha='a'.repeat(64);
const cases=[
 ['steam-chest','steam626.chest.exact1','steam-windows',STEAM626_FULL_VERSION],
 ['switch-chest','switch626.chest.exact1','switch',SWITCH626_CHEST_BID],
 ['switch-catalog0','switch626.catalog0.exact1','switch',SWITCH626_CHEST_BID]
];
const scope=(c,{mode='public-accepted',evidence='b'.repeat(64),releaseId=sha,operation=c[1],platform=c[2],buildId=c[3]}={})=>
 Object.freeze({releaseId,operation,mode,builds:Object.freeze([Object.freeze({platform,buildId,productV2EvidenceSha256:evidence})])});

test('only exact signed public-accepted three fixed Build and Op scopes yield release evidence',()=>{
 for(const c of cases){
  const good=acceptedProductAmountReleaseV2Evidence(scope(c),c[0]);
  assert.equal(good?.contract,'wand.product.amount.release-v2-evidence@1');
  assert.equal(good?.productV2EvidenceSha256,'b'.repeat(64));
  assert.ok(Object.isFrozen(good));
  assert.equal(acceptedProductAmountReleaseV2Evidence(scope(c,{mode:'private-product-v2',evidence:null}),c[0]),null);
  for(const bad of [{releaseId:'bad'},{evidence:null},{evidence:'0'},{operation:'inventory.any'},
                    {platform:'switch-invalid'},{buildId:'unknown'}])
   assert.equal(acceptedProductAmountReleaseV2Evidence(scope(c,bad),c[0]),null);
 }
});
test('reject unbranded mutable and extra-key release scopes',()=>{
 const c=cases[0];
 assert.equal(acceptedProductAmountReleaseV2Evidence({...scope(c)},c[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(c),approved:true}),c[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(c),builds:[scope(c).builds[0]]}),c[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(scope(c),'unregistered'),null);
});
const flags={writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false};
const file={name:'original.p1g',size:4096},input={file,fullVersion:STEAM626_FULL_VERSION,originalSha256:sha,buildConfirmed:true};
const receipt=kind=>({kind,ok:true,...flags});
const adapter=(independent)=>{
 const a={
 async open(){return receipt('OPEN')},
 async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,
  separateName:true,originalName:file.name,originalSha256:sha,originalSizeBytes:file.size,backupName:'original-backup.p1g'}},
 async listVerifiedTargets(){return {targets:[{kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:40000048,
  slotIndex:0,compatibleItemType:null,oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true}],rawDocumentExposed:false}},
 async stageTyped(){return receipt('STAGED')},async undo(){return receipt('UNDONE')},async redo(){return receipt('REDONE')},
 async exportEditedCopy(){return {...receipt('EXPORTED'),editedCopyName:'edited-copy.p1g',editedSha256:'b'.repeat(64),
  editedSizeBytes:4096,backupName:'original-backup.p1g',editedCiphertextVerified:true,
  freshWorkerReopenVerified:true,independentProcessReopenVerified:independent,originalUnchanged:true}},
 async downloadVerifiedCopy(){throw Error('UNEXPECTED_DOWNLOAD')},async close(){return receipt('CLOSED')}
 };return a;
};
const withStage=async(independent,proof)=>{
 const w=createLocalAmountDevWorkflow(adapter(independent),{trustedLocalHarness:true,exactOneDecrease:true,
  steam626Chest:true,requireIndependentProcessReopen:true,publicSignedV2Evidence:proof});
 await w.open(input);await w.backupAndRead();await w.stage(0,49);return w;
};
test('signed per-Op release evidence permits only truthful fresh browser Worker false OS signal',async()=>{
 const proof=acceptedProductAmountReleaseV2Evidence(scope(cases[0]),'steam-chest');
 const w=await withStage(false,proof);await w.exportEditedCopy();
 assert.equal(w.snapshot().phase,'exported');
 assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,false);
 assert.equal(w.snapshot().editedCopy.freshWorkerReopenVerified,true);
});
test('without signed evidence previous PR2294 strict runtime true gate remains active',async()=>{
 const w=await withStage(false,null);
 await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(w.snapshot().phase,'closed');
});
test('signed release must not accept a forged per-browser OS process success',async()=>{
 const proof=acceptedProductAmountReleaseV2Evidence(scope(cases[0]),'steam-chest');
 const w=await withStage(true,proof);
 await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(w.snapshot().phase,'closed');
});
test('invalid release proof and DEV claim are refused before opening a file',()=>{
 const proof=acceptedProductAmountReleaseV2Evidence(scope(cases[0]),'steam-chest');
 for(const bad of [{...proof,operation:'switch626.chest.exact1'},{...proof,releaseId:'a'},
   {...proof,productV2EvidenceSha256:'not-a-digest'},{...proof,extra:true}]){
   assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{trustedLocalHarness:true,exactOneDecrease:true,
     steam626Chest:true,requireIndependentProcessReopen:true,publicSignedV2Evidence:bad}),/RELEASE_V2_EVIDENCE_DENIED/);
 }
 assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{trustedLocalHarness:true,publicSignedV2Evidence:proof}),
   /RELEASE_V2_EVIDENCE_DENIED/);
});
test('original Svelte only derives evidence after WeakMap port branding; no auth flag enabled',()=>{
 const s=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 compile(s,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert.match(s,/const productScope=switchScope\|\|steamScope\|\|catalogScope/);
 assert.match(s,/const signedEvidence=productScope\?acceptedProductAmountReleaseV2Evidence\(productScope/);
 assert.match(s,/if\(productScope\?\.mode==='public-accepted'&&!signedEvidence\)return/);
 assert.match(s,/publicSignedV2Evidence:signedEvidence/);
 for(const v of ['data-product-writer="off"','data-cloud="off"','data-original-overwrite="off"'])assert.ok(s.includes(v));
});
