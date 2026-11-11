// 05 QR-C changed-only independent Rust/WASM/official P1G Codec adversarial Chrome.
// PUBLIC SYNTHETIC ONLY; no private P1G, no page postMessage payloads, no Writer.
import init,{WorkerWasmSource} from '../stage-e/pkg/ddv_save_core.js';
import {createP1gRustWorkerReadOnlyBridge as createBridge} from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec as codec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const BUILD={platform:'steam-windows',buildKind:'steam-full-version',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 schema:626,externallyConfirmed:true};
const ensure=(b,msg)=>{if(!b)throw Error('QA929_'+msg)};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
 indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
async function rejected(action){
 try{await action();return false}catch{return true}
}
const commands=[
 {kind:'InventoryExistingAmountDecrease',inventoryId:4,
  canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',
  expectedOldAmount:50,newAmount:49},
 {kind:'ChestExistingSlotAmountDecrease',containerId:5,
  slotIndex:0,expectedItemId:30000002,expectedOldAmount:12,newAmount:11}
];
const wasmFactory=async()=>({WorkerWasmSource});
const asyncNewBridge=cb=>createBridge(wasmFactory,{
 allowDevSemanticWriter:true,verifyDurableBackupDev:cb
});
const freshWorkerReopen=async(ciphertext,sha)=>new Promise((resolve,reject)=>{
 const w=new Worker('../stage-i/reopen-worker.mjs',{type:'module'});
 w.onerror=()=>{w.terminate();reject(Error('QA929_REOPEN_WORKER_EXCEPTION'))};
 w.onmessage=e=>{w.terminate();resolve(e.data?.ok===true)};
 w.postMessage({ciphertext,expectedSha256:sha});
});
async function run(){
 ensure(typeof document==='undefined','WORKER_ONLY');
 await init(new URL('../stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url));
 const [encryptedResponse,expectedResponse]=await Promise.all([
  fetch('../stage-i/fixtures/synthetic626-amount.p1g',{cache:'no-store'}),
  fetch('../stage-i/fixtures/expected.json',{cache:'no-store'})
 ]);
 ensure(encryptedResponse.ok&&expectedResponse.ok,'SYNTHETIC_ONLY_FIXTURE');
 const ciphertext=new Uint8Array(await encryptedResponse.arrayBuffer());
 const expected=await expectedResponse.json();
 ensure(expected.syntheticOnly===true&&await digest(ciphertext)===expected.originalSha256,
  'SYNTHETIC_SOURCE_SHA');
 const originalCopy=new Uint8Array(ciphertext);
 const decoded=await codec.loadProfile(ciphertext);
 const root=await navigator.storage.getDirectory();
 const getReceipt=async b=>b.openEncrypted({build:BUILD,encryptedBytes:ciphertext});
 // Constructor DEV is not present by default; no product Worker route.
 const readOnly=createBridge(wasmFactory);
 ensure(!('devStageTypedAmounts' in readOnly)&&
  !('devCreateEncodedEditedOnce' in readOnly)&&
  readOnly.getCapabilities().canExportEditedCopy===false,'PRODUCT_FLAG_OFF');
 ensure(await rejected(()=>readOnly.openEncrypted({
    build:{...BUILD,schema:624},encryptedBytes:ciphertext})),
  'SCHEMA624_DENIED');
 ensure(await rejected(()=>readOnly.openEncrypted({
    build:{...BUILD,buildId:'not-the-steam-fullversion'},encryptedBytes:ciphertext})),
  'FORGED_STEAM_BUILD_DENIED');
 ensure(await rejected(()=>readOnly.openEncrypted({
    build:{...BUILD,externallyConfirmed:false},encryptedBytes:ciphertext})),
  'UNATTESTED_BUILD_DENIED');
 // The accepted read-only ProductSession may read an attested Switch626
 // registry candidate; only new DEV SEMANTIC mutation must reject cross-build.
 const switchBridge=asyncNewBridge(async()=>{throw Error('NO_BACKUP')});
 const switchRead=await switchBridge.openEncrypted({
   build:{...BUILD,platform:'switch',buildKind:'switch-bid',
     buildId:'9A239D3DB569756D'},encryptedBytes:ciphertext});
 ensure(await rejected(()=>switchBridge.devStageTypedAmounts(
   scope(switchRead),commands)),'SWITCH_TYPED_EDIT_DENIED');
 switchBridge.close();
 readOnly.close();
 // Direct Rust WASM ABI raw typed JSON must reject escaped-equivalent duplicate keys.
 const rustSource=new WorkerWasmSource(
   'steam-windows','steam-full-version',BUILD.buildId,626,true,
   crypto.getRandomValues(new Uint8Array(32)));
 const jsonBytes=new TextEncoder().encode(decoded.jsonText);
 rustSource.append_chunk(jsonBytes);
 const rustReceipt=JSON.parse(rustSource.finish());
 const normalRaw=JSON.stringify([commands[0]]);
 const dupRaw=normalRaw.replace('"expectedOldAmount":50',
   '"expectedOldAmount":50,"expectedOld\\u0041mount":50');
 ensure(dupRaw!==normalRaw&&dupRaw.includes('\\\\u0041mount')===false,
  'ESCAPED_DUPLICATE_FIXTURE'); // actual raw payload has one literal \u escape
 ensure(await rejected(()=>rustSource.dev_stage_typed_amounts(
    dupRaw,rustReceipt.sessionId,0n,1n,rustReceipt.decodedSha256)),
  'RUST_ESCAPED_DUPLICATE_DENIED');
 const tamperedSha=(rustReceipt.decodedSha256[0]==='a'?'b':'a')+
    rustReceipt.decodedSha256.slice(1);
 ensure(await rejected(()=>rustSource.dev_stage_typed_amounts(
    normalRaw,rustReceipt.sessionId,0n,1n,tamperedSha)),
  'RUST_SOURCE_HASH_CAS_DENIED');
 rustSource.close();
 // False OPFS readback is not a trusted backup. NO edited ciphertext returned.
 let badBackupCalls=0;
 const bad=asyncNewBridge(async()=>{badBackupCalls++;
   return {backupReadbackVerified:false,sha256:expected.originalSha256,
     sizeBytes:ciphertext.length,editedCopyWillUseDifferentName:true}});
 const badRead=await getReceipt(bad);
 const badStage=bad.devStageTypedAmounts(scope(badRead),commands);
 ensure(badStage.revision===1&&badStage.writerAuthorized===false,'BAD_PREPARE');
 ensure(await rejected(()=>bad.devCreateEncodedEditedOnce(scope(badStage)))&&
    badBackupCalls===1,'NO_EXPORT_UNVERIFIED_BACKUP');
 bad.close();
 // Synthetic traversal string cannot become OPFS file handle path; failure must abort.
 let pathFailed=false;
 const pathSpoof=asyncNewBridge(async()=>{
   try{await root.getFileHandle('../original.p1g',{create:true})}
   catch{pathFailed=true;throw Error('INVALID_OPFS_NAME')}
   throw Error('PATH_UNEXPECTEDLY_ACCEPTED');
 });
 const pathRead=await getReceipt(pathSpoof);
 const pathStage=pathSpoof.devStageTypedAmounts(scope(pathRead),commands);
 ensure(await rejected(()=>pathSpoof.devCreateEncodedEditedOnce(scope(pathStage)))&&
   pathFailed,'PATH_SPOOF_BACKUP_NOT_CONFIRMED');
 pathSpoof.close();
 // In-flight Worker reentry, even a later valid receipt from A must not export
 // A or close B's independent session. This probes epoch cancellation.
 let releaseBackup=null;
 const racing=asyncNewBridge(()=>new Promise(resolve=>{releaseBackup=resolve}));
 const raceRead=await getReceipt(racing);
 const raceStage=racing.devStageTypedAmounts(scope(raceRead),commands);
 const pendingExport=racing.devCreateEncodedEditedOnce(scope(raceStage));
 ensure(typeof releaseBackup==='function','REENTRY_CALLBACK_PENDING');
 const newRead=await getReceipt(racing);
 releaseBackup({backupReadbackVerified:true,sha256:expected.originalSha256,
   sizeBytes:ciphertext.length,editedCopyWillUseDifferentName:true});
 ensure(await rejected(()=>pendingExport),'OLD_BACKUP_RESPONSE_REENTRY_REJECTED');
 ensure(racing.getReceipt()?.sessionId===newRead.sessionId,'NEW_SESSION_SURVIVES_REENTRY');
 racing.close();
 // New trusted Worker-local OPFS backup: create separate name, readback actual
 // durable bytes and SHA/size before the Rust one-time export is requested.
 const nonce=crypto.randomUUID();
 const backupName='qac929-original-backup-'+nonce+'.p1g';
 const editedName='qac929-separate-edited-'+nonce+'.p1g';
 let readbackVerified=false,backups=0;
 const good=asyncNewBridge(async({originalBytes,originalEncryptedSha256,
   originalEncryptedSizeBytes})=>{
   backups++;
   ensure(backups===1,'BACKUP_ONCE');
   ensure(await digest(originalBytes)===expected.originalSha256,'BACKUP_INPUT_SHA');
   ensure(backupName!==editedName,'DISTINCT_NAMES');
   ensure(await rejected(()=>root.getFileHandle(backupName)),'BACKUP_NEW_NAME');
   const file=await root.getFileHandle(backupName,{create:true});
   const writable=await file.createWritable();await writable.write(originalBytes);
   await writable.close();
   const persisted=new Uint8Array(await (await file.getFile()).arrayBuffer());
   readbackVerified=persisted.length===originalEncryptedSizeBytes&&
      await digest(persisted)===originalEncryptedSha256;
   persisted.fill(0);
   return {backupReadbackVerified:readbackVerified,
     sha256:originalEncryptedSha256,sizeBytes:originalEncryptedSizeBytes,
     editedCopyWillUseDifferentName:backupName!==editedName};
 });
 const initial=await getReceipt(good);
 ensure(initial.fullDocumentJsonValidated===true&&
   initial.writerAuthorized===false&&initial.allDomainReferencesVerified===false,
   'RUST_SINGLE_SOURCE_RECEIPT');
 const start=scope(initial);
 // New JS glue negatives (do not re-test previously accepted Rust source semantics).
 const forgedScope={...start,decodedSha256:
    (start.decodedSha256[0]==='a'?'b':'a')+start.decodedSha256.slice(1)};
 ensure(await rejected(()=>good.devStageTypedAmounts(forgedScope,commands)),
   'FORGED_HASH_SESSION_DENIED');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,[commands[0],commands[0]])),
   'DUPLICATE_TYPED_COMMAND_DENIED');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,[
    {...commands[0],canonicalItemId:30000099}])),
   'FOREIGN_ITEM_ID_DENIED');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,[
    {...commands[0],expectedOldAmount:51}])),
   'OLD_VALUE_DENIED');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,[
    {...commands[0],newAmount:51}])),
   'INCREASE_DENIED');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,[
    {...commands[0],compatibleItemType:'ItemType_Premium'}])),
   'FOREIGN_RIGHTS_TYPE_DENIED');
 const staged=good.devStageTypedAmounts(start,commands);
 ensure(staged.revision===1&&staged.indexGeneration===2&&
  staged.operationCount===2&&staged.writerAuthorized===false,'ATOMIC_TWO_LEAVES');
 ensure(await rejected(()=>good.devStageTypedAmounts(start,commands)),
  'OLD_SCOPE_REPLAY_DENIED');
 const undone=good.devUndoTypedAmounts(scope(staged));
 ensure(undone.revision===2&&undone.indexGeneration===3&&
  undone.applied===false,'UNDO');
 // Undone-export refusal was already accepted at the Source Stage I
 // ancestor: it invokes backup preflight before Rust rejects the export.
 // Do not repeat it here or miscount a legitimate backup preflight.
 const redone=good.devRedoTypedAmounts(scope(undone));
 ensure(redone.revision===3&&redone.indexGeneration===4&&
  redone.applied===true,'REDO');
 ensure(readbackVerified===false&&backups===0,'BACKUP_MUST_PRECEDE_EXPORT');
 const edited=await good.devCreateEncodedEditedOnce(scope(redone));
 ensure(backups===1&&readbackVerified===true,'OPFS_BACKUP_SHA_BEFORE_EXPORT');
 ensure(edited.writerAuthorized===false&&edited.nativeV3Verified===false&&
  edited.originalOverwriteAuthorized===false&&
  edited.independentProcessReopenVerified===false,'NO_NATIVE_WRITER_PROMOTION');
 const editedHandle=await root.getFileHandle(editedName,{create:true});
 const target=await editedHandle.createWritable();
 await target.write(edited.editedCiphertext);await target.close();
 const persistedEdited=new Uint8Array(
   await (await editedHandle.getFile()).arrayBuffer());
 ensure(await digest(persistedEdited)===edited.editedSha256&&
  persistedEdited.length===edited.editedSizeBytes,'OPFS_EDITED_READBACK_SHA');
 const reopened=await codec.loadProfile(persistedEdited);
 ensure(reopened.jsonText===decoded.jsonText.replace('"Amount":50','"Amount":49')
   .replace('"Amount":12','"Amount":11'),'EXACT_ONLY_TWO_AMOUNT_TOKENS');
 ensure(await freshWorkerReopen(persistedEdited,edited.stagedDecodedSha256),
  'FRESH_CHROME_WORKER_REOPEN');
 const backupHandle=await root.getFileHandle(backupName);
 const persistedBackup=new Uint8Array(
  await (await backupHandle.getFile()).arrayBuffer());
 ensure(persistedBackup.length===ciphertext.length&&
  await digest(persistedBackup)===expected.originalSha256,
  'BACKUP_UNMODIFIED_AFTER_EDIT');
 ensure(await digest(ciphertext)===expected.originalSha256&&
  await digest(originalCopy)===expected.originalSha256,'ORIGINAL_ENCRYPTED_UNTOUCHED');
 ensure(await rejected(()=>good.devCreateEncodedEditedOnce(scope(redone))),
  'ONE_TIME_SESSION_EXPORT_CLOSED');
 return {result:'QA929_INDEPENDENT_DEV_REAL_RUST_WASM_CODEC_CHROME_PASS',
  realGeneratedWasm:true,strictTypedRust:true,officialP1gCodec:true,
  forgedBuildDenied:true,rawDuplicateKeyDenied:true,shaCASDenied:true,
  backupFalseDenied:true,pathSpoofDenied:true,workerReentryDenied:true,
  atomicTwoLeafCAS:true,undoRedo:true,opfsBackupVerifiedBeforeExport:true,
  encryptedOriginalAndBackupUnchanged:true,distinctEditedCopy:true,
  separateChromeWorkerReopen:true,publicSyntheticOnly:true,
  nativeV3Verified:false,writerAuthorized:false,productWriterEnabled:false,
  realPrivateSteamP1g:false,independentOSProcessReopen:false};
}
self.onmessage=async event=>{
 if(event.data?.kind!=='RUN_QA929')return;
 try{self.postMessage({status:'PASS',summary:await run()})}
 catch(e){self.postMessage({status:'FAIL',error:String(e?.stack||e).slice(0,1600)})}
};
