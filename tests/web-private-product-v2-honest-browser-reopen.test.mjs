import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {acceptedProductAmountReleaseV2Evidence,acceptedProductAmountPrivateV2Scope} from '../src/lib/dev/product-amount-release-v2-evidence.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION,SWITCH626_CHEST_BID} from '../src/lib/dev/local-amount-workflow.mjs';
const SHA='a'.repeat(64),EVID='b'.repeat(64);
const profiles=[
 ['steam-chest','steam626.chest.exact1','steam-windows',STEAM626_FULL_VERSION],
 ['switch-chest','switch626.chest.exact1','switch',SWITCH626_CHEST_BID],
 ['switch-catalog0','switch626.catalog0.exact1','switch',SWITCH626_CHEST_BID]
];
const privateScope=(c,overrides={})=>Object.freeze({
 releaseId:SHA,operation:c[1],mode:'private-product-v2',
 builds:Object.freeze([Object.freeze({platform:c[2],buildId:c[3],productV2EvidenceSha256:null})]),
 ...overrides
});
const evidence=c=>acceptedProductAmountPrivateV2Scope(privateScope(c),c[0]);
test('only exact signed private loopback Build scopes with NULL OS evidence are eligible for pre-V2 browser validation',()=>{
 for(const c of profiles){
  const proof=evidence(c);
  assert.equal(proof?.contract,'wand.product.amount.private-v2-scope@1');
  assert.equal(proof?.productV2EvidenceSha256,null);
  assert.equal(proof?.operation,c[1]);assert.ok(Object.isFrozen(proof));
  assert.equal(acceptedProductAmountReleaseV2Evidence(privateScope(c),c[0]),null);
  for(const invalid of [
    {mode:'public-accepted'},
    {mode:'untrusted'},
    {operation:'other'},
    {releaseId:'invalid'},
    {builds:Object.freeze([Object.freeze({platform:c[2],buildId:c[3],productV2EvidenceSha256:EVID})])},
    {builds:Object.freeze([Object.freeze({platform:c[2],buildId:'BAD',productV2EvidenceSha256:null})])},
    {builds:Object.freeze([])}, {builds:Object.freeze([privateScope(c).builds[0],privateScope(c).builds[0]])}
  ])assert.equal(acceptedProductAmountPrivateV2Scope(privateScope(c,invalid),c[0]),null);
 }
});
test('untrusted mutable, extra properties and mismatched profile cannot mint private scope',()=>{
 const c=profiles[0],p=privateScope(c);
 assert.equal(acceptedProductAmountPrivateV2Scope({...p},c[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(Object.freeze({...p,privileged:true}),c[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(Object.freeze({...p,builds:[p.builds[0]]}),c[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(p,'switch-chest'),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(p,'__proto__'),null);
});
const file={name:'owner-local.p1g',size:4096};
const flags={writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false};
const receipt=kind=>({kind,ok:true,...flags});
const adapter=(osProcess,patch={})=>({
 async open(){return receipt('OPEN')},
 async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,
  separateName:true,originalName:file.name,originalSha256:SHA,originalSizeBytes:file.size,backupName:'original-backup.p1g'}},
 async listVerifiedTargets(){return {targets:[{kind:'ChestExistingSlotAmountDecrease',
  targetId:12,itemId:40000048,slotIndex:0,compatibleItemType:null,oldAmount:50,
  registryVerified:true,sourceVerified:true,rightsAllowed:true}],rawDocumentExposed:false}},
 async stageTyped(){return receipt('STAGED')}, async undo(){return receipt('UNDONE')},
 async redo(){return receipt('REDONE')},
 async exportEditedCopy(){return {...receipt('EXPORTED'),editedCopyName:'edited-copy.p1g',
  editedSha256:EVID,editedSizeBytes:4096,backupName:'original-backup.p1g',
  editedCiphertextVerified:true,freshWorkerReopenVerified:true,
  independentProcessReopenVerified:osProcess,originalUnchanged:true,...patch}},
 async downloadVerifiedCopy(){throw Error('NO_DOWNLOAD_IN_SYNTHETIC_TEST')},
 async close(){return receipt('CLOSED')}
});
async function staged(osProcess,proof,patch={}){
 const w=createLocalAmountDevWorkflow(adapter(osProcess,patch),{
  trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
  requireIndependentProcessReopen:true,privateSignedV2Scope:proof
 });
 await w.open({file,fullVersion:STEAM626_FULL_VERSION,originalSha256:SHA,buildConfirmed:true});
 await w.backupAndRead();await w.stage(0,49);return w;
}
test('trusted signed private V2 same product workflow accepts only honest browser Worker reopen false, not fabricated OS true',async()=>{
 const p=evidence(profiles[0]);
 const w=await staged(false,p);
 await w.exportEditedCopy();
 assert.equal(w.snapshot().phase,'exported');
 assert.equal(w.snapshot().editedCopy.freshWorkerReopenVerified,true);
 assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,false);
 const bogus=await staged(true,p);
 await assert.rejects(bogus.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(bogus.snapshot().phase,'closed');
});
test('private product scope absent keeps PR2294 strict fail-closed runtime before Owner V2',async()=>{
 const w=await staged(false,null);
 await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(w.snapshot().phase,'closed');
});
test('private V2 never accepts forged public evidence, wrong build, extras, or DEV flag-only',()=>{
 const p=evidence(profiles[0]);
 for(const modified of [{...p,buildId:'BAD'},{...p,productV2EvidenceSha256:EVID},
   {...p,releaseId:'BAD'},{...p,extra:true}]){
  assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{trustedLocalHarness:true,
   exactOneDecrease:true,steam626Chest:true,requireIndependentProcessReopen:true,privateSignedV2Scope:modified}),
   /PRIVATE_V2_SCOPE_DENIED/);
 }
 assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{trustedLocalHarness:true,
   exactOneDecrease:true,steam626Chest:true,requireIndependentProcessReopen:true,
   privateSignedV2Scope:p,publicSignedV2Evidence:{}}),/RELEASE_V2_EVIDENCE_DENIED|PRIVATE_V2_SCOPE_DENIED/);
 assert.throws(()=>createLocalAmountDevWorkflow(adapter(false),{trustedLocalHarness:true,
   exactOneDecrease:true,steam626Chest:true,privateSignedV2Scope:p}),/PRIVATE_V2_SCOPE_DENIED/);
});
test('private signed product denies clone-reopen failure, writer forgery, overwrite and alias collision',async()=>{
 const p=evidence(profiles[0]);
 for(const patch of [{freshWorkerReopenVerified:false},{writerAuthorized:true},
  {nativeV3Verified:true},{originalOverwriteAuthorized:true},
  {editedCopyName:'owner-local.p1g'},{editedCopyName:'original-backup.p1g'}]){
  const w=await staged(false,p,patch);
  await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
  assert.equal(w.snapshot().phase,'closed');
 }
});
test('actual Svelte binds private sealed port, requires proper issuer mode and keeps public Writer OFF',()=>{
 const src=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 compile(src,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert.match(src,/const productScope=switchScope\|\|steamScope\|\|catalogScope/);
 assert.match(src,/const privateV2Scope=productScope\?acceptedProductAmountPrivateV2Scope\(productScope,profile\):null/);
 assert.match(src,/if\(productScope\?\.mode==='private-product-v2'&&!privateV2Scope\)return/);
 assert.match(src,/privateSignedV2Scope:privateV2Scope/);
 for(const line of ['data-product-writer="off"','data-cloud="off"','data-original-overwrite="off"'])
  assert.ok(src.includes(line));
});
