// 04 QR-W independent changed-only L2: signed Private Product V2
// loopback scope must not fabricate browser independent OS process proof.
// All receipts are synthetic; this is NOT an Owner genuine Product V2 acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {
 acceptedProductAmountPrivateV2Scope,
 acceptedProductAmountReleaseV2Evidence
} from '../src/lib/dev/product-amount-release-v2-evidence.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION,SWITCH626_CHEST_BID}
 from '../src/lib/dev/local-amount-workflow.mjs';

const P=[
 ['steam-chest','steam626.chest.exact1','steam-windows',STEAM626_FULL_VERSION],
 ['switch-chest','switch626.chest.exact1','switch',SWITCH626_CHEST_BID],
 ['switch-catalog0','switch626.catalog0.exact1','switch',SWITCH626_CHEST_BID]
];
const sha='a'.repeat(64),resultSha='b'.repeat(64),release='c'.repeat(64);
const scope=(p,{mode='private-product-v2',builds,operation=p[1],releaseId=release,...extra}={})=>
 Object.freeze({releaseId,operation,mode,builds:builds??Object.freeze([
 Object.freeze({platform:p[2],buildId:p[3],productV2EvidenceSha256:null})
 ]),...extra});
const privateEvidence=(p,options)=>acceptedProductAmountPrivateV2Scope(scope(p,options),p[0]);
test('all three immutable exact private Build and Op scopes return null OS evidence, never a public-accepted product receipt',()=>{
 for(const p of P){
  const a=privateEvidence(p);
  assert.equal(a?.contract,'wand.product.amount.private-v2-scope@1');
  assert.equal(a?.operation,p[1]);
  assert.equal(a?.platform,p[2]);
  assert.equal(a?.buildId,p[3]);
  assert.equal(a?.productV2EvidenceSha256,null);
  assert.equal(a?.releaseId,release);
  assert(Object.isFrozen(a));
  assert.equal(Object.hasOwn(a,'writerAuthorized'),false);
  assert.equal(Object.hasOwn(a,'osProcessAttested'),false);
  assert.equal(acceptedProductAmountReleaseV2Evidence(scope(p),p[0]),null);
 }
});
test('private pre-V2 scope refuses wrong mode, Build, cross-profile, two builds, extra/release SHA forgery and non-null alleged OS evidence',()=>{
 for(const p of P){
  const b=scope(p).builds[0];
  const candidates=[
   {mode:'public-accepted'}, {mode:'private-v2'},{mode:'dev'},
   {operation:'steam626.inventory.any'},
   {releaseId:'0'}, {releaseId:'Z'.repeat(64)},
   {builds:Object.freeze([])},
   {builds:Object.freeze([b,b])},
   {builds:[b]},
   {builds:Object.freeze([Object.freeze({...b,productV2EvidenceSha256:sha})])},
   {builds:Object.freeze([Object.freeze({...b,productV2EvidenceSha256:'false'})])},
   {builds:Object.freeze([Object.freeze({...b,productV2EvidenceSha256:undefined})])},
   {builds:Object.freeze([Object.freeze({...b,platform:'unknown'})])},
   {builds:Object.freeze([Object.freeze({...b,buildId:'1.26.1'})])},
   {builds:Object.freeze([Object.freeze({...b,writerAuthorized:true})])},
   {builds:Object.freeze([{...b}])},
   {writerAuthorized:true},
   {osProcessAttested:true}
  ];
  for(const c of candidates){
   assert.equal(privateEvidence(p,c),null,JSON.stringify({p:p[0],c}));
  }
  for(const q of P.filter(x=>x[0]!==p[0]))
   assert.equal(acceptedProductAmountPrivateV2Scope(scope(p),q[0]),null);
  for(const name of ['__proto__','constructor','toString','unregistered'])
   assert.equal(acceptedProductAmountPrivateV2Scope(scope(p),name),null);
 }
});
test('helper cannot promote mutable/cross-prototype/forged unbranded values into authority',()=>{
 const p=P[0],g=scope(p);
 assert.equal(acceptedProductAmountPrivateV2Scope({...g},p[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(Object.freeze({...g,builds:[g.builds[0]]}),p[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(Object.freeze({...g,builds:Object.freeze([{...g.builds[0]}])}),p[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(Object.freeze(Object.assign(Object.create(null),g)),p[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope(null,p[0]),null);
 assert.equal(acceptedProductAmountPrivateV2Scope([],p[0]),null);
});
const file={name:'synthetic-owner.p1g',size:4096};
const flags={writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false};
const receipt=kind=>({kind,ok:true,...flags});
const target={kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:40000048,slotIndex:0,
 compatibleItemType:null,oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true};
function port(osProcess=false,patch={},delay=false){
 const calls={close:0,download:0,export:0};let complete;
 const adapter={
  async open(){return receipt('OPEN')},
  async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,
   shaMatched:true,sizeMatched:true,separateName:true,originalName:file.name,
   originalSha256:sha,originalSizeBytes:file.size,backupName:'original-backup.p1g'}},
  async listVerifiedTargets(){return {targets:[target],rawDocumentExposed:false}},
  async stageTyped(){return receipt('STAGED')},
  async undo(){return receipt('UNDONE')},
  async redo(){return receipt('REDONE')},
  async exportEditedCopy(){
   calls.export++;
   const r={...receipt('EXPORTED'),editedCopyName:'edited-copy.p1g',editedSha256:resultSha,
    editedSizeBytes:4096,backupName:'original-backup.p1g',
    editedCiphertextVerified:true,freshWorkerReopenVerified:true,
    independentProcessReopenVerified:osProcess,originalUnchanged:true,...patch};
   if(delay)return new Promise(resolve=>{complete=()=>resolve(r)});
   return r;
  },
  async downloadVerifiedCopy(){calls.download++;throw Error('UNEXPECTED_DOWNLOAD')},
  async close(){calls.close++;return receipt('CLOSED')}
 };
 return {adapter,calls,release:()=>complete?.()};
}
async function stage({osProcess=false,privateProof=privateEvidence(P[0]),publicProof=null,
 patch={},delay=false,requireReopen=true}={}){
 const m=port(osProcess,patch,delay);
 const w=createLocalAmountDevWorkflow(m.adapter,{
  trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
  requireIndependentProcessReopen:requireReopen,
  privateSignedV2Scope:privateProof,publicSignedV2Evidence:publicProof
 });
 await w.open({file,fullVersion:STEAM626_FULL_VERSION,
  originalSha256:sha,buildConfirmed:true});
 await w.backupAndRead();
 await w.stage(0,49);
 return {w,...m};
}
test('private signed exact V2 synthetic receipt accepts truthful browser Worker false WITHOUT inventing OS process true',async()=>{
 const v=await stage();
 await v.w.exportEditedCopy();
 const s=v.w.snapshot();
 assert.equal(s.phase,'exported');
 assert.equal(s.editedCopy.independentProcessReopenVerified,false);
 assert.equal(s.editedCopy.freshWorkerReopenVerified,true);
 assert.equal(s.editedCopy.name,'edited-copy.p1g');
 assert.equal(v.calls.download,0);
 assert.equal(Object.hasOwn(s.editedCopy,'writerAuthorized'),false);
});
test('private scope absent preserves strict PR2294 product false denial before edited copy becomes downloadable',async()=>{
 const v=await stage({privateProof:null});
 await assert.rejects(v.w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 await assert.rejects(v.w.downloadVerifiedCopy('edited'),/DOWNLOAD_SCOPE_DENIED/);
 assert.equal(v.calls.download,0);
});
test('private signed scope refuses forged per-edit OS true, unauthorized writer, invalid output aliases and false fresh Worker',async()=>{
 const attempts=[
  {osProcess:true},
  {patch:{freshWorkerReopenVerified:false}},
  {patch:{editedCiphertextVerified:false}},
  {patch:{writerAuthorized:true}},
  {patch:{nativeV3Verified:true}},
  {patch:{originalOverwriteAuthorized:true}},
  {patch:{originalUnchanged:false}},
  {patch:{editedCopyName:file.name}},
  {patch:{editedCopyName:'original-backup.p1g'}},
  {patch:{backupName:'edited-copy.p1g'}},
  {patch:{editedSha256:sha}},
  {patch:{editedSizeBytes:0}},
  {patch:{extraReceipt:true}}
 ];
 for(const v of attempts){
  const m=await stage(v);
  await assert.rejects(m.w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);
  assert.equal(m.w.snapshot().phase,'closed');
  assert.equal(m.w.snapshot().editedCopy,null);
  assert.equal(m.calls.download,0);
 }
});
test('independent close revokes private Session and denies late synthetic edited-copy Worker success',async()=>{
 const v=await stage({delay:true});
 const promise=v.w.exportEditedCopy();
 await Promise.resolve();
 assert.equal(v.calls.export,1);
 await v.w.close();
 v.release();
 await assert.rejects(promise,/STALE_FILE_OR_CLOSE/);
 assert.equal(v.w.snapshot().phase,'closed');
 assert.equal(v.w.snapshot().editedCopy,null);
 await assert.rejects(v.w.downloadVerifiedCopy('edited'),/DOWNLOAD_SCOPE_DENIED/);
 assert.equal(v.calls.download,0);
});
test('private contract excludes simultaneous public evidence, wrong Build/Op and bare DEV proof claims before opening any File',()=>{
 const good=privateEvidence(P[0]);
 const publicProof=acceptedProductAmountReleaseV2Evidence(
  scope(P[0],{mode:'public-accepted',
   builds:Object.freeze([Object.freeze({platform:P[0][2],buildId:P[0][3],productV2EvidenceSha256:resultSha})])}),P[0][0]);
 assert(publicProof);
 for(const opts of [
  {privateSignedV2Scope:good,publicSignedV2Evidence:publicProof},
  {privateSignedV2Scope:{...good,operation:'switch626.chest.exact1'}},
  {privateSignedV2Scope:{...good,buildId:SWITCH626_CHEST_BID}},
  {privateSignedV2Scope:{...good,releaseId:'bad'}},
  {privateSignedV2Scope:{...good,productV2EvidenceSha256:resultSha}},
  {privateSignedV2Scope:{...good,auth:true}},
  {privateSignedV2Scope:good,requireIndependentProcessReopen:false},
  {privateSignedV2Scope:good,steam626Chest:false,exactOneDecrease:false}
 ]){
  const p=port();
  assert.throws(()=>createLocalAmountDevWorkflow(p.adapter,{
   trustedLocalHarness:true,exactOneDecrease:true,steam626Chest:true,
   requireIndependentProcessReopen:true,...opts
  }),/RELEASE_V2_EVIDENCE_DENIED|PRIVATE_V2_SCOPE_DENIED|LOCAL_HARNESS_GATE_OFF/);
  assert.equal(p.calls.close,0);
 }
});
test('actual original Svelte compiles with accepted private proof after three protected WeakMap-branded Port lookups and no flags enabled',()=>{
 const s=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
 const result=compile(s,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert(result.js.code.length>2000);
 const brand=s.indexOf('const productScope=switchScope||steamScope||catalogScope;');
 const helper=s.indexOf('const privateV2Scope=productScope?acceptedProductAmountPrivateV2Scope(productScope,profile)');
 const strict=s.indexOf("if(productScope?.mode==='private-product-v2'&&!privateV2Scope)return;");
 const bind=s.indexOf('privateSignedV2Scope:privateV2Scope');
 assert(brand>=0&&helper>brand&&strict>helper&&bind>strict);
 for(const k of ['data-product-writer="off"','data-cloud="off"','data-original-overwrite="off"'])
  assert(s.includes(k));
 assert(s.includes('productSteamChestPortScope(trustedWorkerAdapter)'));
 assert(s.includes('productSwitchCatalog0PortScope(trustedWorkerAdapter)'));
 assert(s.includes('productSwitchChestPortScope(trustedWorkerAdapter)'));
});
