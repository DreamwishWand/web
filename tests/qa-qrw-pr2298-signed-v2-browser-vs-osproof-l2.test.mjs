// Independent 04 QR-W HIGH changed-closure L2, original signed per-Build Amount proof.
// These are SYNTHETIC evidence *shapes*, not authenticated R22 issuer receipts.
// Production Svelte uses an existing WeakMap-branded Port, no public Writer/Op.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {acceptedProductAmountReleaseV2Evidence} from '../src/lib/dev/product-amount-release-v2-evidence.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION,SWITCH626_CHEST_BID} from '../src/lib/dev/local-amount-workflow.mjs';
const profiles=[
 ['steam-chest','steam626.chest.exact1','steam-windows',STEAM626_FULL_VERSION],
 ['switch-chest','switch626.chest.exact1','switch',SWITCH626_CHEST_BID],
 ['switch-catalog0','switch626.catalog0.exact1','switch',SWITCH626_CHEST_BID]
];
const digest='d'.repeat(64),release='f'.repeat(64),originalHash='a'.repeat(64);
const freezeBuild=(p,over={})=>Object.freeze({platform:p[2],buildId:p[3],productV2EvidenceSha256:digest,...over});
const scope=(p,{mode='public-accepted',builds,releaseId=release,operation=p[1],...rest}={})=>
 Object.freeze({releaseId,operation,mode,builds:builds??Object.freeze([freezeBuild(p)]),...rest});
const select=(p,options)=>acceptedProductAmountReleaseV2Evidence(scope(p,options),p[0]);
test('3 distinct approved Build/Op exact source-shape outputs stay immutable and do NOT assert actual OS-process runtime',()=>{
 for(const p of profiles){
  const r=select(p);
  assert.equal(r.contract,'wand.product.amount.release-v2-evidence@1');
  assert.equal(r.releaseId,release);
  assert.equal(r.operation,p[1]);
  assert.equal(r.platform,p[2]);
  assert.equal(r.buildId,p[3]);
  assert.equal(r.productV2EvidenceSha256,digest);
  assert.ok(Object.isFrozen(r));
  assert.equal(Object.hasOwn(r,'independentProcessReopenVerified'),false);
  assert.equal(Object.hasOwn(r,'writerAuthorized'),false);
  assert.equal(Object.hasOwn(r,'operationOn'),false);
 }
});
test('signed build evidence fails closed for any cross-Op, cross-platform, wrong Build, extra profile, or missing exact SHA',()=>{
 for(const p of profiles){
  for(const op of profiles.filter(x=>x[1]!==p[1]).map(x=>x[1]).concat(['Inventory.Add','steam626.chest.exact1-extra'])){
   assert.equal(select(p,{operation:op}),null);
  }
  for(const bad of [
   {releaseId:'X'.repeat(64)},{releaseId:''},{releaseId:'0'},
   {builds:Object.freeze([freezeBuild(p,{productV2EvidenceSha256:'x'.repeat(64)})])},
   {builds:Object.freeze([freezeBuild(p,{productV2EvidenceSha256:null})])},
   {builds:Object.freeze([freezeBuild(p,{buildId:'1.26.1'})])},
   {builds:Object.freeze([freezeBuild(p,{platform:'steam-other'})])},
   {builds:Object.freeze([freezeBuild(p,{productV2EvidenceSha256:'b'})])},
   {builds:Object.freeze([])},
   {builds:Object.freeze([freezeBuild(p),freezeBuild(p)])},
   {builds:[freezeBuild(p)]},
   {mode:'private-product-v2'},{mode:'draft'},{mode:'public-accepted',signed:true},
   {mode:'public-accepted',reopenStatus:'true'}
  ]) assert.equal(select(p,bad),null,JSON.stringify({p:p[0],bad}));
  for(const target of profiles.filter(x=>x[0]!==p[0])){
   assert.equal(acceptedProductAmountReleaseV2Evidence(scope(p),target[0]),null);
  }
 }
});
test('scope and nested build must be exact plain frozen data containers; release metadata is not a runtime authority',()=>{
 const p=profiles[0];
 assert.equal(acceptedProductAmountReleaseV2Evidence({...scope(p)},p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(p),builds:[freezeBuild(p)]}),p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(p),builds:Object.freeze([{...freezeBuild(p)}])}),p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(p),builds:Object.freeze([Object.freeze({...freezeBuild(p),privileged:true})])}),p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(Object.freeze({...scope(p),access:'approved'}),p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(null,p[0]),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(scope(p),'toString'),null);
 assert.equal(acceptedProductAmountReleaseV2Evidence(scope(p),'__proto__'),null);
});
const names={original:'genuine-original.p1g',backup:'different-backup.p1g',edited:'separate-edited.p1g'};
const file={name:names.original,size:4096};
const acceptedSource={file,originalSha256:originalHash,fullVersion:STEAM626_FULL_VERSION,buildConfirmed:true};
const receipt=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
function worker(browserOS,patch={},defer=false){
 let finish, exportCalls=0,closeCalls=0,downloadCalls=0;
 const adapter={
  async open(){return receipt('OPEN')},
  async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,
    shaMatched:true,sizeMatched:true,separateName:true,originalName:names.original,
    originalSha256:originalHash,originalSizeBytes:4096,backupName:names.backup}},
  async listVerifiedTargets(){return {targets:[{kind:'ChestExistingSlotAmountDecrease',
    targetId:12,itemId:40000048,slotIndex:0,compatibleItemType:null,
    oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true}],rawDocumentExposed:false}},
  async stageTyped(){return receipt('STAGED')},
  async undo(){return receipt('UNDONE')},async redo(){return receipt('REDONE')},
  async exportEditedCopy(){
   exportCalls++;
   const result={...receipt('EXPORTED'),editedCopyName:names.edited,
    editedSha256:'b'.repeat(64),editedSizeBytes:4096,backupName:names.backup,
    editedCiphertextVerified:true,freshWorkerReopenVerified:true,
    independentProcessReopenVerified:browserOS,originalUnchanged:true,...patch};
   if(defer)return new Promise(resolve=>{finish=()=>resolve(result)});
   return result;
  },
  async downloadVerifiedCopy(){downloadCalls++;throw Error('DOWNLOAD_DENIED')},
  async close(){closeCalls++;return receipt('CLOSED')}
 };
 return {adapter,release:()=>finish?.(),counters:()=>({exportCalls,closeCalls,downloadCalls})};
}
async function staged({browserOS=false,evidence=select(profiles[0]),patch={},defer=false}={}){
 const m=worker(browserOS,patch,defer);
 const w=createLocalAmountDevWorkflow(m.adapter,{
  trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
  requireIndependentProcessReopen:true,publicSignedV2Evidence:evidence
 });
 await w.open(acceptedSource);await w.backupAndRead();await w.stage(0,49);
 return {w,...m};
}
test('previous genuine Product runtime without accepted V2 release evidence continues to DENY current Worker false',async()=>{
 const v=await staged({evidence:null});
 await assert.rejects(v.w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 assert.equal(v.counters().downloadCalls,0);
});
test('exact synthetic signed release shape accepts truthful browser false without inventing OS process true or Writer authorization',async()=>{
 const v=await staged();
 await v.w.exportEditedCopy();
 const s=v.w.snapshot();
 assert.equal(s.phase,'exported');
 assert.equal(s.editedCopy.name,names.edited);
 assert.equal(s.editedCopy.independentProcessReopenVerified,false);
 assert.equal(s.editedCopy.freshWorkerReopenVerified,true);
 assert.equal(Object.hasOwn(s.editedCopy,'writerAuthorized'),false);
 assert.equal(v.counters().downloadCalls,0);
});
test('synthetic signed release evidence DENIES untruthful browser Worker true and incompatible result metadata',async()=>{
 for(const data of [
  {browserOS:true},
  {patch:{originalOverwriteAuthorized:true}},
  {patch:{nativeV3Verified:true}},
  {patch:{writerAuthorized:true}},
  {patch:{editedCopyName:names.original}},
  {patch:{editedCopyName:names.backup}},
  {patch:{backupName:names.edited}},
  {patch:{freshWorkerReopenVerified:false}},
  {patch:{editedCiphertextVerified:false}},
  {patch:{extraAuthority:true}}
 ]){
  const v=await staged(data);
  await assert.rejects(v.w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
  assert.equal(v.w.snapshot().editedCopy,null);
  assert.equal(v.w.snapshot().phase,'closed');
  assert.equal(v.counters().downloadCalls,0);
 }
});
test('late synthetic release-aligned Worker receipt cannot pass after original Session Close epoch ABA revocation',async()=>{
 const v=await staged({defer:true});
 const p=v.w.exportEditedCopy();
 await Promise.resolve();
 await v.w.close();
 v.release();
 await assert.rejects(p,/STALE_FILE_OR_CLOSE/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 await assert.rejects(v.w.downloadVerifiedCopy('edited'),/DOWNLOAD_SCOPE_DENIED/);
 assert.equal(v.counters().downloadCalls,0);
});
test('mismatched proof/Build contract rejected BEFORE any file open; DEV falsely supplied release cannot bypass exact UI constructor',()=>{
 const original=select(profiles[0]);
 for(const patch of [
  {operation:'switch626.chest.exact1'},
  {buildId:SWITCH626_CHEST_BID},{platform:'switch'},
  {productV2EvidenceSha256:'Z'.repeat(64)},
  {releaseId:null},{contract:'wand.no-auth@1'},{writerAuthorized:true}
 ]){
  const bad={...original,...patch};
  assert.throws(()=>createLocalAmountDevWorkflow(worker(false).adapter,{
   trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
   requireIndependentProcessReopen:true,publicSignedV2Evidence:bad
  }),/RELEASE_V2_EVIDENCE_DENIED/);
 }
 assert.throws(()=>createLocalAmountDevWorkflow(worker(false).adapter,{
  trustedLocalHarness:true,exactOneDecrease:true,
  requireIndependentProcessReopen:false,publicSignedV2Evidence:original
 }),/RELEASE_V2_EVIDENCE_DENIED/);
});
test('Svelte compiles and binds proof only after branded Port with all Writer/Cloud/Overwrite outputs OFF',()=>{
 const s=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 const js=compile(s,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert(js.js.code.length>2000);
 const extract=s.indexOf('const productScope=switchScope||steamScope||catalogScope');
 const evidence=s.indexOf('const signedEvidence=productScope?acceptedProductAmountReleaseV2Evidence');
 const guard=s.indexOf("if(productScope?.mode==='public-accepted'&&!signedEvidence)return");
 const bind=s.indexOf('publicSignedV2Evidence:signedEvidence');
 assert(extract>=0&&evidence>extract&&guard>evidence&&bind>guard);
 assert.match(s,/productSteamChestPortScope\(trustedWorkerAdapter\)/);
 assert.match(s,/productSwitchCatalog0PortScope\(trustedWorkerAdapter\)/);
 assert.match(s,/productSwitchChestPortScope\(trustedWorkerAdapter\)/);
 for(const flag of ['data-product-writer="off"','data-cloud="off"','data-original-overwrite="off"'])assert(s.includes(flag));
});
