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
 const log=[];let selected=null;const ad={
  async open(args){selected=args;log.push(['open',args]);return{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async backupOriginal(){log.push(['backup']);return{backupReadbackVerified:true,originalUnchanged:true,
    shaMatched:true,sizeMatched:true,separateName:true,originalName:selected.file.name,
    originalSha256:selected.originalSha256,originalSizeBytes:selected.file.size,backupName:'original-backup.p1g'}},
  async listVerifiedTargets(){log.push(['list']);return{targets:[inventory(),chest()],rawDocumentExposed:false}},
  async stageTyped(cmd){log.push(['stage',cmd]);return{kind:'STAGED',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async undo(){log.push(['undo']);return{kind:'UNDONE',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async redo(){log.push(['redo']);return{kind:'REDONE',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async exportEditedCopy(){log.push(['export']);return{kind:'EXPORTED',ok:true,
    editedCopyName:'edited-copy-different.p1g',backupName:'original-backup.p1g',
    editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true,
    writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async close(){selected=null;log.push(['close'])}
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
  {backupOriginal:async()=>({...boundBackup(),backupReadbackVerified:false})},
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

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{resolve,promise}};
const boundBackup=(patch={})=>({backupReadbackVerified:true,originalUnchanged:true,
 shaMatched:true,sizeMatched:true,separateName:true,originalName:args.file.name,
 originalSha256:args.originalSha256,originalSizeBytes:args.file.size,
 backupName:'original-backup.p1g',...patch});
const closed=w=>{const s=w.snapshot();assert.equal(s.phase,'closed');
 assert.equal(s.fileName,'');assert.equal(s.backupVerified,false);
 assert.equal(s.targets.length,0);assert.equal(s.preview,null);assert.equal(s.editedCopy,null)};
test('QA941 regression: already-dispatched OPEN cannot commit after Close or B selection',async()=>{
 for(const replacement of [false,true]){
  const entered=deferred(),done=deferred();
  const {adapter}=fake({open:async()=>{entered.resolve();await done.promise;
   return{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}}});
  const w=createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true});
  const pending=w.open(args),denied=assert.rejects(pending,/STALE_FILE_OR_CLOSE/);
  await entered.promise;
  if(replacement)await assert.rejects(w.open({...args,file:{name:'B.p1g',size:4096}}),/PENDING_OPERATION/);
  else await w.close();
  done.resolve();await denied;closed(w);
 }
});
test('QA941 regression: stale backup receipt does not start target read or revive state',async()=>{
 const entered=deferred(),done=deferred();let reads=0;
 const {adapter}=fake({backupOriginal:async()=>{entered.resolve();await done.promise;return boundBackup()},
  listVerifiedTargets:async()=>{reads++;return{targets:[inventory()],rawDocumentExposed:false}}});
 const w=createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true});
 await w.open(args);const a=w.backupAndRead(),denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);
 await entered.promise;await w.close();done.resolve();await denied;closed(w);assert.equal(reads,0);
});
test('QA941 regression: stale target, stage, undo, redo, and export receipts never commit',async()=>{
 for(const method of ['listVerifiedTargets','stageTyped','undo','redo','exportEditedCopy']){
  const entered=deferred(),done=deferred();const base=fake().adapter;
  const f=fake({[method]:async(...v)=>{entered.resolve();await done.promise;return base[method](...v)}});
  const w=createLocalAmountDevWorkflow(f.adapter,{trustedLocalHarness:true});
  await w.open(args);
  let operation;
  if(method==='listVerifiedTargets')operation=w.backupAndRead();
  else{
   await w.backupAndRead();
   if(method==='stageTyped')operation=w.stage(0,49);
   else{
    await w.stage(0,49);
    if(method==='undo')operation=w.undo();
    else if(method==='redo'){await w.undo();operation=w.redo()}
    else operation=w.exportEditedCopy();
   }
  }
  const denied=assert.rejects(operation,/STALE_FILE_OR_CLOSE/);
  await entered.promise;await w.close();done.resolve();await denied;closed(w);
 }
});
test('QA941 regression: Backup must bind selected encrypted source name SHA size and unique name',async()=>{
 for(const patch of [{originalName:'B.p1g'},{originalSha256:'b'.repeat(64)},
  {originalSizeBytes:4097},{backupName:'steam-original.p1g'},
  {backupName:'STEAM-ORIGINAL.p1g'},{backupName:'../backup.p1g'}]){
  const w=createLocalAmountDevWorkflow(fake({backupOriginal:async()=>boundBackup(patch)}).adapter,
   {trustedLocalHarness:true});await w.open(args);
  await assert.rejects(w.backupAndRead(),/ORIGINAL_BACKUP_NOT_DURABLE/);closed(w);
 }
 for(const patch of [{backupName:'steam-original.p1g'},{backupName:'other-backup.p1g'},
  {editedCopyName:'STEAM-ORIGINAL.p1g'},{editedCopyName:'ORIGINAL-BACKUP.p1g'}]){
  const base=fake().adapter;
  const w=createLocalAmountDevWorkflow(fake({exportEditedCopy:async()=>({...await base.exportEditedCopy(),...patch})}).adapter,
   {trustedLocalHarness:true});
  await w.open(args);await w.backupAndRead();await w.stage(0,49);
  await assert.rejects(w.exportEditedCopy(),/EDITED_COPY_REOPEN_AND_NAME_DENIED/);closed(w);
 }
});
test('QA941 regression: Rust DEV amount bound 9999 and exact protected enum substrings',()=>{
 for(const suffix of ['Premium','DLC','Entitlement','Receipt','Auth','Currency','Moonstone','Quest']){
  assert.throws(()=>createExistingAmountDecrease({...inventory(),compatibleItemType:'ItemType_Protected'+suffix},49));
 }
 for(const base of [inventory(),chest()]){
  assert.throws(()=>createExistingAmountDecrease({...base,oldAmount:10000},49));
  assert.throws(()=>createExistingAmountDecrease({...base,oldAmount:9999},9999));
  assert.equal(createExistingAmountDecrease({...base,oldAmount:9999},9998).newAmount,9998);
 }
});

test('Steam626 Furniture inventory zero matches PR1034 only; positive IDs and rights gates unchanged',()=>{
 const target={...inventory(),targetId:0,itemId:40000001,compatibleItemType:'ItemType_Furniture',oldAmount:7};
 assert.deepEqual(createExistingAmountDecrease(target,6),{kind:'InventoryExistingAmountDecrease',inventoryId:0,
  canonicalItemId:40000001,compatibleItemType:'ItemType_Furniture',expectedOldAmount:7,newAmount:6});
 for(const bad of [
  {...inventory(),targetId:0},{...chest(),targetId:0},
  {...target,targetId:'0'},{...target,targetId:-1},{...target,targetId:0.5},
  {...target,compatibleItemType:'ItemType_FurnitureExtra'},
  {...target,compatibleItemType:'ItemType_furniture'},
  {...target,rightsAllowed:false},{...target,registryVerified:false},{...target,sourceVerified:false},
  {...target,itemId:0},{...target,oldAmount:1},{...target,slotIndex:-1},
  {...target,unexpectedWriter:true}
 ])assert.throws(()=>createExistingAmountDecrease(bad,6));
 for(const n of [0,7,8,-1,1.5])assert.throws(()=>createExistingAmountDecrease(target,n));
});
test('verified Furniture zero descriptor survives backup, typed CAS, undo/redo and distinct export receipt',async()=>{
 const target={...inventory(),targetId:0,itemId:40000001,compatibleItemType:'ItemType_Furniture',oldAmount:7};
 const f=fake({listVerifiedTargets:async()=>({targets:[target],rawDocumentExposed:false})});
 const w=createLocalAmountDevWorkflow(f.adapter,{trustedLocalHarness:true});
 await w.open(args);await w.backupAndRead();assert.equal(w.snapshot().targets[0].targetId,0);
 await w.stage(0,6);assert.deepEqual(f.log.find(x=>x[0]==='stage')[1],[createExistingAmountDecrease(target,6)]);
 await w.undo();await w.redo();await w.exportEditedCopy();
 assert.equal(w.snapshot().phase,'exported');assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,false);
 await w.close();closed(w);
 for(const invalid of [{...inventory(),targetId:0},{...chest(),targetId:0},{...target,rightsAllowed:false}]){
  const x=fake({listVerifiedTargets:async()=>({targets:[invalid],rawDocumentExposed:false})});
  const v=createLocalAmountDevWorkflow(x.adapter,{trustedLocalHarness:true});
  await v.open(args);await assert.rejects(v.backupAndRead(),/UNVERIFIED_ITEM_OR_RIGHTS_TARGET/);closed(v);
  assert.equal(x.log.some(z=>z[0]==='stage'),false);
 }
});
