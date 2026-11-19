// QA-only, never product-delivered. Real Chromium isolated Worker + browser
// OPFS + generated *dedicated* Steam626 Rust/WASM + accepted P1G Codec.
// Synthetic owner-shaped fixture only; no user Save, keys or private data.
import init,{WorkerWasmSource} from './stage-e/pkg/ddv_save_core.js';
import {createProductSteam626ChestLocalAdapter} from '../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const fail=x=>{throw Error('01A_REAL_CHROME_OPFS_'+x)};
const need=(ok,why)=>{if(!ok)fail(why)};
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const build=Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true});
const deny=async (fn,reason)=>{let refused=false;try{await fn()}catch{refused=true}need(refused,reason)};
const make=()=>createProductSteam626ChestLocalAdapter({wasmFactory:async()=>({WorkerWasmSource})});
const fieldCheck=async (encrypted,expected)=>{
 const decoded=await p1gPackagedProfileCodec.loadProfile(encrypted);
 need(decoded.jsonText===JSON.stringify(expected),'EXACT_SAVED_DIFF_OR_UNKNOWN');
};
async function run(){
 need(typeof document==='undefined'&&typeof navigator.storage?.getDirectory==='function'&&
   typeof navigator.locks?.request==='function','REAL_WORKER_OPFS_AND_LOCKS_REQUIRED');
 await init(new URL('./stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url));
 need(typeof WorkerWasmSource.prototype.stage_scoped_amount==='function','GENERATED_RUST_ABI');
 const resp=await fetch('/fixture/chest.p1g',{cache:'no-store'});
 const expectedResp=await fetch('/fixture/expected.json',{cache:'no-store'});
 need(resp.ok&&expectedResp.ok,'FIXTURE_HTTP');
 const bytes=new Uint8Array(await resp.arrayBuffer());
 const expected=await expectedResp.json();
 const originalSha=await hash(bytes);
 need(originalSha===expected.originalSha256,'FIXTURE_SHA');
 const original=new File([bytes],'01a-chrome-synthetic-original.p1g');
 const root=await navigator.storage.getDirectory();
 const identities=new Set();
 const records=[];
 const remove=async name=>{if(name&&/^[A-Za-z0-9._-]+\.p1g$/.test(name)){
   try{await root.removeEntry(name)}catch{}}};
 const receiptNames=[];
 const a=make();
 try{
  const opened=await a.open({file:original,originalSha256:originalSha,build});
  need(opened.kind==='OPEN'&&opened.writerAuthorized===false,'OPENED_ONLY_OFF');
  await deny(()=>a.stageTyped([]),'STAGE_PREBACKUP_DENIED');
 }finally{await a.close()}
 const approved=make();
 try{
  const opened=await approved.open({file:original,originalSha256:originalSha,build});
  need(opened.kind==='OPEN'&&opened.writerAuthorized===false,'SECOND_OPEN');
  const backup=await approved.backupOriginal();
  receiptNames.push(backup.backupName);
  need(backup.backupReadbackVerified===true&&backup.originalUnchanged===true,'BACKUP_BOUND');
  const targets=await approved.listVerifiedTargets();
  need(targets.rawDocumentExposed===false,'NO_DOCUMENT_EXPOSURE');
  const target=targets.targets.find(t=>t.kind==='ChestExistingSlotAmountDecrease'&&
    t.targetId===12&&t.slotIndex===0&&t.itemId===30200000&&t.oldAmount===50);
  need(target&&target.registryVerified&&target.rightsAllowed,'RUST_CORE_MINTED_CHEST48');
  const command={kind:target.kind,containerId:target.targetId,slotIndex:target.slotIndex,
   expectedItemId:target.itemId,expectedOldAmount:50,newAmount:49};
  need((await approved.stageTyped([command])).kind==='STAGED','RUST_STAGE');
  need((await approved.undo()).kind==='UNDONE','RUST_UNDO');
  need((await approved.redo()).kind==='REDONE','RUST_REDO');
  const exported=await approved.exportEditedCopy();
  receiptNames.push(exported.editedCopyName);
  need(exported.kind==='EXPORTED'&&exported.editedCiphertextVerified===true&&
    exported.freshWorkerReopenVerified===true&&
    exported.independentProcessReopenVerified===false&&
    exported.originalUnchanged===true,'BROWSER_WORKER_REOPEN_BUT_NOT_OS_PROCESS');
  need(exported.editedCopyName!==backup.backupName&&
    exported.editedCopyName!==original.name,'ALIAS_DISTINCT');
  const [edited,old]=await Promise.all([
    approved.downloadVerifiedCopy('edited'),approved.downloadVerifiedCopy('backup')]);
  try{
   need(edited.name===exported.editedCopyName&&
     await hash(edited.encryptedBytes)===exported.editedSha256,'EDITED_SHA');
   need(old.name===backup.backupName&&await hash(old.encryptedBytes)===originalSha,'BACKUP_SHA');
   await fieldCheck(edited.encryptedBytes,expected.edited);
   need(await hash(await original.arrayBuffer())===originalSha,'ORIGINAL_IMMUTABLE');
  }finally{edited.encryptedBytes.fill(0);old.encryptedBytes.fill(0)}
  await approved.close();
  for(const name of receiptNames){
   const saved=await (await root.getFileHandle(name)).getFile();
   need(saved.name===name,'OPFS_PERSISTED_FILE_NAME');
   const local=await saved.arrayBuffer();
   need(local.byteLength>16,'OPFS_PERSISTED_NONEMPTY');
   need(await hash(local)===(name===backup.backupName?originalSha:exported.editedSha256),
     'OPFS_PERSISTED_SHA');
   identities.add(name);
  }
  need(identities.size===2,'EXACT2_OPFS_COPIES');
  await deny(()=>root.getFileHandle(original.name),'ORIGINAL_OPFS_NEVER_WRITTEN');
  records.push('ALIAS_PERSISTENCE');
 }finally{
  await approved.close();
  for(const name of receiptNames)await remove(name);
 }
 const attack=make(), names=[];
 try{
  await attack.open({file:original,originalSha256:originalSha,build});
  const b=await attack.backupOriginal();names.push(b.backupName);
  await attack.listVerifiedTargets();
  const handle=await root.getFileHandle(b.backupName);
  const writer=await handle.createWritable();
  const altered=Uint8Array.from(bytes);altered[0]^=0x80;
  try{await writer.write(altered);await writer.close()}finally{altered.fill(0)}
  await deny(()=>attack.stageTyped([{kind:'ChestExistingSlotAmountDecrease',
    containerId:12,slotIndex:0,expectedItemId:30200000,
    expectedOldAmount:50,newAmount:49}]),'BACKUP_TAMPER_DENIED');
  records.push('BACKUP_TAMPER_DENIED');
 }finally{await attack.close();for(const name of names)await remove(name)}
 need(await hash(await original.arrayBuffer())===originalSha,'ORIGINAL_FINAL_UNCHANGED');
 bytes.fill(0);
 return {realChromeDedicatedWorker:true,generatedRustWasm:true,realOpfs:true,
  browserWorkerCodecReopen:true,independentOsProcessReopenVerified:false,
  scopedNativeChest48Exact1:true,opfsEncryptedAliases:2,denials:2,
  noOriginalOverwrite:true,noRawSaveToPage:true,writerAuthorized:false,checks:records.length};
}
self.onmessage=async e=>{
 if(e.data?.kind!=='01A_CHROME_DEDICATED_CHEST_OPFS_RUN')return;
 try{self.postMessage({status:'PASS',summary:await run()})}
 catch(err){self.postMessage({status:'FAIL',error:String(err?.stack||err).slice(0,350)})}
};
