// 01A REAL Rust wasm-bindgen DEV Worker, official P1G Codec and OPFS backup.
// All artifacts PUBLIC SYNTHETIC. No decoded payload, Save or key leaves Workers.
import init,{WorkerWasmSource} from '../stage-e/pkg/ddv_save_core.js';
import {createP1gRustWorkerReadOnlyBridge}
 from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec}
 from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const BUILD={platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const ensure=(c,n)=>{if(!c)throw Error('STAGE_I_'+n)};
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(b=>b.toString(16).padStart(2,'0')).join('');
async function deny(fn){
 try{await fn()}catch{return true}
 return false;
}
const checkReopen=async(bytes,expectedSha256)=>new Promise((resolve,reject)=>{
 const worker=new Worker('./reopen-worker.mjs',{type:'module'});
 worker.onerror=()=>{worker.terminate();reject(Error('INDEPENDENT_REOPEN_WORKER_ERROR'))};
 worker.onmessage=e=>{worker.terminate();resolve(e.data?.ok===true)};
 worker.postMessage({ciphertext:bytes,expectedSha256});
});
async function run(){
 ensure(typeof document==='undefined','MUST_BE_WORKER');
 await init(new URL('../stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url));
 const r=await fetch('./fixtures/synthetic626-amount.p1g',{cache:'no-store'});
 const e=await fetch('./fixtures/expected.json',{cache:'no-store'});
 ensure(r.ok&&e.ok,'SYNTHETIC_MISSING');
 const encrypted=new Uint8Array(await r.arrayBuffer());
 const expected=await e.json();
 ensure(expected.syntheticOnly===true&&
   expected.originalSha256===await hash(encrypted),'ORIGINAL_FIXTURE_SHA');
 const originalDecoded=await p1gPackagedProfileCodec.loadProfile(encrypted);
 const originalBytes=new Uint8Array(encrypted);
 const root=await navigator.storage.getDirectory();
 const nonce=crypto.randomUUID();
 let backupName='';
 const bridge=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource}),{
   allowDevSemanticWriter:true,
   verifyDurableBackupDev:async({originalBytes:bytes,originalEncryptedSha256,originalEncryptedSizeBytes})=>{
     ensure(await hash(bytes)===expected.originalSha256,'BACKUP_INPUT_SHA');
     backupName='stage-i-backup-'+nonce+'.p1g';
     const handle=await root.getFileHandle(backupName,{create:true});
     const write=await handle.createWritable();
     await write.write(bytes);await write.close();
     const persisted=new Uint8Array(await (await handle.getFile()).arrayBuffer());
     const same=persisted.length===originalEncryptedSizeBytes&&
       await hash(persisted)===originalEncryptedSha256;
     persisted.fill(0);
     return {backupReadbackVerified:same,sha256:originalEncryptedSha256,
       sizeBytes:originalEncryptedSizeBytes,
       editedCopyWillUseDifferentName:true};
   }
 });
 const read=await bridge.openEncrypted({build:BUILD,encryptedBytes:encrypted});
 ensure(read.decodedSha256===expected.decodedSha256&&
   read.writerAuthorized===false,'RUST_INITIAL_READ');
 const s=scope(read);
 const badBuild=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource}));
 ensure(await deny(()=>badBuild.openEncrypted({
   build:{...BUILD,schema:624},encryptedBytes:encrypted})),'BAD_BUILD_DENIED');
 const commands=[
   {kind:'InventoryExistingAmountDecrease',inventoryId:4,
    canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',
    expectedOldAmount:50,newAmount:49},
   {kind:'ChestExistingSlotAmountDecrease',containerId:5,
    slotIndex:0,expectedItemId:30000002,expectedOldAmount:12,newAmount:11}
 ];
 ensure(await deny(()=>bridge.devStageTypedAmounts(s,[
   {...commands[0],newAmount:51}])), 'INCREASE_DENIED');
 ensure(await deny(()=>bridge.devStageTypedAmounts(s,[
   {...commands[0],compatibleItemType:7}])), 'NUMERIC_NATIVE_ENUM_DENIED');
 const first=bridge.devStageTypedAmounts(s,commands);
 ensure(first.revision===1&&first.indexGeneration===2&&
   first.writerAuthorized===false&&first.operationCount===2,'RUST_STAGE');
 ensure(await deny(()=>bridge.devStageTypedAmounts(s,commands)),'OLD_SCOPE_REPLAY_DENIED');
 const undone=bridge.devUndoTypedAmounts(scope(first));
 ensure(undone.revision===2&&undone.applied===false,'RUST_UNDO');
 ensure(await deny(()=>bridge.devCreateEncodedEditedOnce(scope(undone))),'UNDONE_EXPORT_DENIED');
 const redone=bridge.devRedoTypedAmounts(scope(undone));
 ensure(redone.revision===3&&redone.indexGeneration===4&&
   redone.applied===true,'RUST_REDO');
 const encoded=await bridge.devCreateEncodedEditedOnce(scope(redone));
 ensure(encoded.contract==='wand.dev.p1g.typed-edited-copy@1'&&
   encoded.writerAuthorized===false&&encoded.nativeV3Verified===false&&
   encoded.independentProcessReopenVerified===false,'DEV_ONLY_CODEC_RECEIPT');
 ensure(backupName.length>0,'BACKUP_CREATED');
 const editedName='stage-i-edited-copy-'+nonce+'.p1g';
 ensure(editedName!==backupName,'SEPARATE_NAME');
 const editedHandle=await root.getFileHandle(editedName,{create:true});
 const editedWrite=await editedHandle.createWritable();
 await editedWrite.write(encoded.editedCiphertext);await editedWrite.close();
 const disk=new Uint8Array(await (await editedHandle.getFile()).arrayBuffer());
 ensure(disk.length===encoded.editedSizeBytes&&
   await hash(disk)===encoded.editedSha256,'EDITED_DISK_SHA');
 const reopened=await p1gPackagedProfileCodec.loadProfile(disk);
 const expectedText=originalDecoded.jsonText
   .replace('"Amount":50','"Amount":49').replace('"Amount":12','"Amount":11');
 ensure(reopened.jsonText===expectedText,'EXACT_TWO_TOKENS_ONLY');
 ensure(await checkReopen(disk,encoded.stagedDecodedSha256),
   'FRESH_CHROME_WORKER_REOPEN');
 ensure(await hash(encrypted)===expected.originalSha256&&
   await hash(originalBytes)===expected.originalSha256,'ORIGINAL_UNTOUCHED');
 const backupHandle=await root.getFileHandle(backupName);
 const backupBytes=new Uint8Array(await (await backupHandle.getFile()).arrayBuffer());
 ensure(await hash(backupBytes)===expected.originalSha256,'BACKUP_STILL_UNTOUCHED');
 ensure(await deny(()=>bridge.devCreateEncodedEditedOnce(scope(redone))),
   'ONE_TIME_EXPORT_REPLAY_DENIED');
 // Synthetic OPFS proof, not an independent OS process or real Steam V2 proof.
 return {result:'DEV_ONLY_REAL_RUST_CODEC_EDIT_PASS',
   realGeneratedWasm:true,realChromeWorker:true,
   officialP1gCodec:true,sameRustProductSession:true,
   twoAtomicAmountTokens:true,staleCASDenied:true,
   nativeEnumStringChecked:true,undoRedo:true,
   originalAndBackupShaInvariant:true,separateNamedEditedCopy:true,
   separateChromeWorkerReopen:true,publicSyntheticOnly:true,
   writerAuthorized:false,nativeV3:false,deviceV4:false,
   realPrivateSteamP1g:false,independentProcessReopen:false,
   productWriterEnabled:false};
}
self.onmessage=async event=>{
 if(event.data?.kind!=='RUN_STAGE_I')return;
 try{self.postMessage({status:'PASS',summary:await run()})}
 catch(err){self.postMessage({status:'FAIL',error:String(err?.stack||err).slice(0,1000)})}
};
