import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExistingAmountDecrease,createLocalAmountDevWorkflow,
  DEV_AMOUNT_CONTRACT,STEAM626_FULL_VERSION}
  from '../src/lib/dev/local-amount-workflow.mjs';
import {DEV_AMOUNT_UI_LOCALES,localAmountCopy} from '../src/lib/dev/local-amount-copy.mjs';
const sha='a'.repeat(64);
const file=()=>({name:'steam-original.p1g',size:4096});
const inventory=()=>({kind:'InventoryExistingAmountDecrease',
  targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',
  oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
const chest=()=>({kind:'ChestExistingSlotAmountDecrease',
  targetId:5,itemId:30000002,slotIndex:0,compatibleItemType:null,
  oldAmount:12,registryVerified:true,sourceVerified:true,rightsAllowed:true});
function fake(overrides={}){
 const log=[],ad={
  async open(args){log.push(['open',args]);return{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async backupOriginal(){log.push(['backup']);return{backupReadbackVerified:true,originalUnchanged:true,
    shaMatched:true,sizeMatched:true,separateName:true}},
  async listVerifiedTargets(){log.push(['list']);return{targets:[inventory(),chest()],rawDocumentExposed:false}},
  async stageTyped(cmd){log.push(['stage',cmd]);return{kind:'STAGED',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async undo(){log.push(['undo']);return{kind:'UNDONE',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async redo(){log.push(['redo']);return{kind:'REDONE',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async exportEditedCopy(){log.push(['export']);return{kind:'EXPORTED',ok:true,
    editedCopyName:'edited-copy-different.p1g',backupName:'original-backup.p1g',
    editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true,
    writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async close(){log.push(['close'])}
 };
 return {adapter:Object.assign(ad,overrides),log};
}
const args={file:file(),fullVersion:STEAM626_FULL_VERSION,originalSha256:sha,buildConfirmed:true};
test('8 locale DEV/OFF copy exists and is non-empty, without public Writer claims',()=>{
 assert.equal(DEV_AMOUNT_UI_LOCALES.length,8);
 assert.deepEqual([...DEV_AMOUNT_UI_LOCALES].sort(),
   ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
 for(const l of DEV_AMOUNT_UI_LOCALES){
  const r=localAmountCopy(l);
  for(const key of ['title','file','build','sha','confirm','open','backup',
    'target','newAmount','stage','undo','redo','export','close','empty','waiting'])
    assert.ok(typeof r[key]==='string'&&r[key].length>0,l+':'+key);
 }
});
test('canonical PR929 Inventory and Chest exact typed commands; unknown IDs and increase failclosed',()=>{
 const a=createExistingAmountDecrease(inventory(),49);
 assert.deepEqual(a,{kind:'InventoryExistingAmountDecrease',inventoryId:4,
   canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',
   expectedOldAmount:50,newAmount:49});
 const b=createExistingAmountDecrease(chest(),11);
 assert.deepEqual(b,{kind:'ChestExistingSlotAmountDecrease',containerId:5,
   slotIndex:0,expectedItemId:30000002,expectedOldAmount:12,newAmount:11});
 for(const v of [0,50,51,-1,1.5,4294967296])assert.throws(()=>createExistingAmountDecrease(inventory(),v));
 for(const changed of [{rightsAllowed:false},{registryVerified:false},{sourceVerified:false},
  {itemId:0},{compatibleItemType:7},{compatibleItemType:'ItemType_Unknown/../../'},
  {kind:'SkinChange'},{unexpectedWriter:true}]){
  assert.throws(()=>createExistingAmountDecrease({...inventory(),...changed},49));
 }
});
test('local DEV gate requires injected single trusted Worker, never defaults to public product',()=>{
 assert.throws(()=>createLocalAmountDevWorkflow(fake().adapter));
 assert.throws(()=>createLocalAmountDevWorkflow({}, {trustedLocalHarness:true}));
 assert.equal(DEV_AMOUNT_CONTRACT,'wand.local.dev-off.typed-amount-ui@1');
});
test('file→durable original backup→verified targets→CAS→Undo→Redo→separate Edited-copy→Close',async()=>{
 const {adapter,log}=fake(),w=createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true});
 assert.equal(w.snapshot().phase,'closed');
 await assert.rejects(w.backupAndRead());
 await assert.rejects(w.stage(0,49));
 await w.open(args);assert.equal(w.snapshot().phase,'opened');
 assert.deepEqual(log.find(x=>x[0]==='open')[1].build,
   {platform:'steam-windows',buildKind:'steam-full-version',
    buildId:STEAM626_FULL_VERSION,schema:626,externallyConfirmed:true});
 await assert.rejects(w.stage(0,49));
 await w.backupAndRead();assert.equal(w.snapshot().backupVerified,true);
 await w.stage(0,49);assert.deepEqual(w.snapshot().preview,
   {kind:'InventoryExistingAmountDecrease',oldAmount:50,newAmount:49});
 await w.undo();assert.equal(w.snapshot().phase,'undone');
 await assert.rejects(w.exportEditedCopy());
 await w.redo();await w.exportEditedCopy();
 assert.equal(w.snapshot().editedCopy.name,'edited-copy-different.p1g');
 assert.equal(w.snapshot().editedCopy.freshWorkerReopenVerified,true);
 assert.deepEqual(log.filter(x=>['backup','list','stage','undo','redo','export'].includes(x[0]))
  .map(x=>x[0]),['backup','list','stage','undo','redo','export']);
 await assert.rejects(w.exportEditedCopy());
 await w.close();assert.equal(w.snapshot().phase,'closed');
});
test('wrong Steam Build, source SHA, file type, rights, or fake receipts revoke; no in-memory output',async()=>{
 for(const invalid of [
  {...args,fullVersion:'releases_1.25-v1.25.0'}, {...args,originalSha256:'0'}, 
  {...args,buildConfirmed:false},{...args,file:{name:'save.json',size:128}},
  {...args,file:{name:'x.p1g',size:134217729}}
 ])await assert.rejects(createLocalAmountDevWorkflow(fake().adapter,
   {trustedLocalHarness:true}).open(invalid));
 for(const overrides of [
  {open:async()=>({...fake().adapter.open(),kind:'OPEN',ok:true,writerAuthorized:true})},
  {backupOriginal:async()=>({...await fake().adapter.backupOriginal(),backupReadbackVerified:false})},
  {listVerifiedTargets:async()=>({targets:[{...inventory(),rightsAllowed:false}],rawDocumentExposed:false})},
  {listVerifiedTargets:async()=>({targets:[inventory()],rawDocumentExposed:false,decodedJson:'private'})}
 ]){
  const w=createLocalAmountDevWorkflow(fake(overrides).adapter,{trustedLocalHarness:true});
  try{await w.open(args);await w.backupAndRead()}catch{}
  assert.equal(w.snapshot().phase,'closed');
 }
});
test('encoded export cannot overwrite original, coincide with backup or declare unverified reopen',async()=>{
 const failures=[
  {editedCopyName:'steam-original.p1g'},
  {editedCopyName:'original-backup.p1g'},
  {editedCopyName:'../../private.p1g'},
  {freshWorkerReopenVerified:false},
  {writerAuthorized:true},
  {originalUnchanged:false}
 ];
 for(const bad of failures){
  const original=fake().adapter;
  const w=createLocalAmountDevWorkflow(fake({
    exportEditedCopy:async()=>({...await original.exportEditedCopy(),...bad})
  }).adapter,{trustedLocalHarness:true});
  await w.open(args);await w.backupAndRead();await w.stage(0,49);
  await assert.rejects(w.exportEditedCopy());
  assert.equal(w.snapshot().phase,'closed');
 }
});
test('late OPEN cannot resurrect a closed or replaced local Rust Session',async()=>{
 let release;
 const promise=new Promise(r=>{release=r});
 const adapter=fake({open:async()=>{await promise;
   return{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,
     originalOverwriteAuthorized:false}}}).adapter;
 const w=createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true});
 const inFlight=w.open(args);await w.close();release();
 await assert.rejects(inFlight,/STALE_FILE_OR_CLOSE/);
 assert.equal(w.snapshot().phase,'closed');
});
