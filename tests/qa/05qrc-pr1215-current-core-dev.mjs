// Independent current-Core DEV/OFF transport, synthetic only. No grant/target authority.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,open,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createP1gRustWorkerReadOnlyBridge as makeBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const pkg=resolve(process.argv[2]),glue=await import(pathToFileURL(join(pkg,'ddv_save_core.js')).href);
glue.initSync({module:new WebAssembly.Module(await readFile(join(pkg,'ddv_save_core_bg.wasm')))});
const sha=b=>createHash('sha256').update(b).digest('hex');
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const metadata={codecVersion:'p1g-packaged-profile-codec@1',profileVersion:626,zip:{entryCount:1,profileEntryCount:1,archiveComment:new Uint8Array(),profileEntry:{compressType:0,extra:new Uint8Array(),comment:new Uint8Array(),flagBits:0,dosTime:0,dosDate:33,extractVersion:20,createSystem:0,createVersion:20,internalAttr:0,externalAttr:0}}};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const c={kind:'ChestExistingSlotAmountDecrease',containerId:31,slotIndex:1,expectedItemId:30000002,expectedOldAmount:19,newAmount:18};
const i={kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:40000001,compatibleItemType:'ItemType_Furniture',expectedOldAmount:29,newAmount:28};
const document=(state=null)=>({World:{Ambient:{keep:'🌿雪'}},Player:{ContainerInventories:{'31':{Size:3,ExtraSize:0,ParentItemID:40000047,ID:31,BelongsToPlayer:true,BlockMoveTo:false,Inventory:[{ItemID:0,Amount:0},{Unknown:{keep:[null,'🌿']},State:state,Amount:19,ItemID:30000002},{ItemID:30000003,Amount:4,State:{}}]}},ListInventories:{'0':{ID:0,CompatibleItemType:'ItemType_Furniture',CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},Inventory:{'40000001':{Amount:29,Unknown:'雪'},'40700001':{Amount:3}}}}},GameInfo:{Version:626},Unknown:{keep:[19,29,'Amount:19']}});
const d=await mkdtemp(join(tmpdir(),'qa1215-'));let pos=0,neg=0;
const writeNew=async(p,b)=>{const f=await open(p,'wx',0o600);try{await f.writeFile(b);await f.sync()}finally{await f.close()}};
const factory=async()=>({WorkerWasmSource:glue.WorkerWasmSource});
try{
 for(const [label,state,commands] of [['null',null,[c]],['empty-object',{},[c]],['mixed',null,[i,c]]]){
  const text=JSON.stringify(document(state),null,2),input=await codec.createEncodedProfile(text,metadata),h=sha(input);
  const original=join(d,label+'-original.p1g'),backup=join(d,label+'-backup.p1g'),edited=join(d,label+'-edited.p1g');
  await writeNew(original,input);let badBackup=true;
  const b=makeBridge(factory,{allowDevSemanticWriter:true,verifyDurableBackupDev:async args=>{
   assert.equal(sha(args.originalBytes),h);assert.equal(args.originalEncryptedSha256,h);
   if(badBackup)return {backupReadbackVerified:true,sha256:'0'.repeat(64),sizeBytes:input.length,editedCopyWillUseDifferentName:true};
   try{await writeNew(backup,args.originalBytes)}catch(e){if(e.code!=='EEXIST')throw e}
   const bytes=await readFile(backup);return {backupReadbackVerified:sha(bytes)===h,sha256:sha(bytes),sizeBytes:bytes.length,editedCopyWillUseDifferentName:true};
  }});
  const r=await b.openEncrypted({build,encryptedBytes:input});assert.equal(r.decodedSha256,sha(text));assert.equal(r.writerAuthorized,false);
  for(const commands of [[{...c,expectedOldAmount:20}],[{...c,slotIndex:0}],[{...c,expectedItemId:30000003}],[{...c,newAmount:0}],[{...c,newAmount:19}],[{...c,newAmount:20}],[c,c],[i,{...c,expectedOldAmount:20}],[{...i,canonicalItemId:40700001,expectedOldAmount:3,newAmount:2}],[{...c,grant:true}]]){
   assert.throws(()=>b.devStageTypedAmounts(scope(r),commands));assert.equal(b.getReceipt().revision,r.revision);neg++;
  }
  assert.throws(()=>b.devStageTypedAmounts({...scope(r),revision:r.revision+1},[c]));neg++;
  assert.throws(()=>b.devStageTypedAmounts({...scope(r),sessionId:'0'.repeat(r.sessionId.length)},[c]));neg++;
  const s=b.devStageTypedAmounts(scope(r),commands);assert.equal(s.operationCount,commands.length);assert.equal(s.writerAuthorized,false);
  const u=b.devUndoTypedAmounts(scope(s));assert.equal(u.applied,false);
  await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(u)));neg++;
  const redo=b.devRedoTypedAmounts(scope(u));assert.equal(redo.applied,true);
  await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(redo)),/BACKUP_NOT_CONFIRMED/);neg++;
  badBackup=false;
  const out=await b.devCreateEncodedEditedOnce(scope(redo));assert.equal(out.originalSha256,h);
  assert.equal(out.writerAuthorized,false);assert.equal(out.originalOverwriteAuthorized,false);assert.equal(out.independentProcessReopenVerified,false);
  await writeNew(edited,out.editedCiphertext);
  let expect=text.replace('"Amount": 19','"Amount": 18');if(label==='mixed')expect=expect.replace('"Amount": 29','"Amount": 28');
  const child=spawnSync(process.execPath,['--input-type=module','-e',
   "import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';const {p1gPackagedProfileCodec:c}=await import(process.argv[1]);const d=await c.loadProfile(await readFile(process.argv[2]));if(createHash('sha256').update(d.jsonText).digest('hex')!==process.argv[3])process.exit(3);process.stdout.write('INDEPENDENT_REOPEN_EXACT');",
   new URL('../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url).href,edited,sha(expect)],{encoding:'utf8',timeout:15000});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'INDEPENDENT_REOPEN_EXACT');
  assert.equal((await codec.loadProfile(await readFile(edited))).jsonText,expect);assert.equal(sha(await readFile(edited)),out.editedSha256);
  assert.equal(sha(await readFile(original)),h);assert.equal(sha(await readFile(backup)),h);assert.equal(sha(input),h);
  assert.notEqual((await stat(original)).ino,(await stat(backup)).ino);assert.notEqual((await stat(original)).ino,(await stat(edited)).ino);
  await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(redo)));neg++;b.close();pos++;
 }
 // Changed composition must preserve legacy direct stage's explicit limited scope.
 // These are physical structure cases that the raw legacy DEV route DOES reject.
 for(const mutate of [v=>v.Player.ContainerInventories[31].BelongsToPlayer=false,v=>v.Player.ContainerInventories[31].ParentItemID=0,v=>v.Player.ContainerInventories[31].Size=4,v=>v.Player.ContainerInventories[31].ID=32]){
  const v=document();mutate(v);const input=await codec.createEncodedProfile(JSON.stringify(v),metadata);
  const b=makeBridge(factory,{allowDevSemanticWriter:true,verifyDurableBackupDev:async()=>{throw Error('NO_EXPORT')}});const r=await b.openEncrypted({build,encryptedBytes:input});assert.throws(()=>b.devStageTypedAmounts(scope(r),[c]));assert.equal(b.getReceipt().revision,r.revision);neg++;b.close();
 }
 const off=makeBridge(factory);assert.equal(off.devStageTypedAmounts,undefined);assert.equal(off.getCapabilities().writerAuthorized,false);
 const limits=[];
 // Deliberately characterize pre-existing DEV transport, not a grant. The
 // core-minted selector is stricter; these cases must never become eligible for real edit.
 for(const [label,mutate] of [
  ['unknown-state',v=>v.Player.ContainerInventories[31].Inventory[1].State={Future:7}],
  ['missing-state',v=>delete v.Player.ContainerInventories[31].Inventory[1].State],
  ['blocked-container',v=>v.Player.ContainerInventories[31].BlockMoveTo=true],
  ['overflow-slot',v=>v.Player.ContainerInventories[31].ExtraSize=2]
 ]){
  const v=document();mutate(v);const input=await codec.createEncodedProfile(JSON.stringify(v),metadata);
  const b=makeBridge(factory,{allowDevSemanticWriter:true,verifyDurableBackupDev:async()=>{throw Error('NO_EXPORT')}});const r=await b.openEncrypted({build,encryptedBytes:input});
  try{const s=b.devStageTypedAmounts(scope(r),[c]);assert.equal(s.writerAuthorized,false);limits.push(label)}catch(e){console.log('QA1215_LEGACY_DENIED',label,e.message)}
  b.close();
 }
 console.log('QA1215_LEGACY_RAW_SCOPE_ONLY',JSON.stringify(limits),'NO_AUTHORITY_NO_EXPORT');
 assert.equal(pos,3);assert.equal(neg,49);
 console.log('QA1215_CURRENT_CORE',pos,'POS',neg,'NEG_EXACT_BACKUP_INDEPENDENT_REOPEN');
}finally{await rm(d,{recursive:true,force:true})}
