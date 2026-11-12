// W-WEB-007 / W-LOCAL-019: Worker-local, DEV/OFF adapter for the EXISTING
// PR929 bridge. No second Rust Reader/Codec/Session/Executor, no product route.
// Never instantiate in signed public Pages WASM: it lacks semantic-writer-dev.
// Dependency: PR929 05 QR-C & 05 QR-L; 01D verified target read/rights proof.
import {createP1gRustWorkerReadOnlyBridge}
 from '../ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {createExistingAmountDecrease}
 from './local-amount-workflow.mjs';
const fail=()=>{throw Error('LOCAL_DEV_WORKER_DENIED')};
const h=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),
 x=>x.toString(16).padStart(2,'0')).join('');
const validSha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const filename=s=>typeof s==='string'&&/^[A-Za-z0-9._-]+\.p1g$/.test(s);
const sameName=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.normalize('NFC').toLowerCase()===b.normalize('NFC').toLowerCase();
const kind=r=>({kind:r,ok:true,writerAuthorized:false,
 nativeV3Verified:false,originalOverwriteAuthorized:false});
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const safeKeys=(o,n)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join(',')===n.split(',').sort().join(',');
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
 indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),
 b=>b.toString(16).padStart(2,'0')).join('');
async function freshReopen(ciphertext,expectedDecodedSha256){
 return new Promise((resolve,reject)=>{
  const w=new Worker(new URL('./local-amount-codec-reopen.worker.mjs',import.meta.url),
   {type:'module',name:'wand-dev-p1g-codec-reopen'});
  const destroy=()=>{try{w.terminate()}catch{}};
  w.onerror=()=>{destroy();reject(Error('REOPEN_DENIED'))};
  w.onmessage=e=>{const r=e.data;destroy();
   resolve(r?.freshWorkerReopenVerified===true&&r?.privatePayloadPosted===false)};
  w.postMessage({ciphertext:new Uint8Array(ciphertext),expectedDecodedSha256});
 });
}
async function getNewFile(root,tag,excluded,check){
 for(let i=0;i<3;i++){
  check();
  const name=tag+'-'+nonce()+'.p1g';
  if(!filename(name)||excluded.some(n=>sameName(n,name)))continue;
  try{await root.getFileHandle(name);check();continue}
  catch(e){if(e?.name!=='NotFoundError')fail()}
  check();
  const handle=await root.getFileHandle(name,{create:true});
  try{check()}catch(e){try{await root.removeEntry(name)}catch{};throw e}
  return {name,handle};
 }
 fail();
}
async function writeChecked(root,tag,bytes,expectedSha,excluded,check){
 check();
 const {name,handle}=await getNewFile(root,tag,excluded,check);
 let write;
 try{
  check();write=await handle.createWritable();check();
  await write.write(bytes);check();await write.close();write=null;check();
  const file=await handle.getFile();check();
  const read=new Uint8Array(await file.arrayBuffer());check();
  const digest=await h(read);check();
  if(read.length!==bytes.length||digest!==expectedSha)fail();
  return {name,bytes:read};
 }catch(e){
  if(write)try{await write.abort()}catch{}
  try{await root.removeEntry(name)}catch{};fail()
 }
}
/**
 * verifyTargets is a trusted Worker-LOCAL provider of 01D/01E verified
 * existing-item descriptors. It cannot read UI-submitted item IDs. No
 * verified provider => zero allowed choices, never guess Native IDs.
 */
export function createPr929LocalDevAmountAdapter({wasmFactory,verifyTargets=async()=>[]}){
 if(typeof wasmFactory!=='function'||typeof verifyTargets!=='function')fail();
 let root=null,original=null,backup=null,receipt=null,targets=[],applied=false;
 let generation=0;
 const check=token=>{if(token!==generation)fail()};
 const bridge=createP1gRustWorkerReadOnlyBridge(wasmFactory,{
  allowDevSemanticWriter:true,
  verifyDurableBackupDev:async source=>{
   if(!original||!backup||!root||!receipt)fail();
   const token=generation,o=original,b=backup,r=root;
   if(b.source!==o||sameName(b.name,o.name))fail();
   const handle=await r.getFileHandle(b.name);check(token);
   const file=await handle.getFile();check(token);
   const bytes=new Uint8Array(await file.arrayBuffer());check(token);
   const digest=await h(bytes);check(token);
   if(source.originalEncryptedSizeBytes!==bytes.length||
    source.originalEncryptedSha256!==o.sha||digest!==o.sha||
    bytes.length!==o.size)fail();
   return {backupReadbackVerified:true,sha256:o.sha,
    sizeBytes:o.size,editedCopyWillUseDifferentName:true};
  }
 });
 // Important: on main before PR929 integration these APIs DO NOT EXIST;
 // refuse immediately instead of falling back to JS editing.
 for(const method of ['devStageTypedAmounts','devUndoTypedAmounts',
  'devRedoTypedAmounts','devCreateEncodedEditedOnce'])
  if(typeof bridge[method]!=='function')fail();
 function revoke(){
  generation++;try{bridge.close()}catch{}
  if(original?.bytes)original.bytes.fill(0);
  root=null;original=null;backup=null;receipt=null;targets=[];applied=false;
 }
 async function close(){revoke();return kind('CLOSED')}
 return Object.freeze({
  async open({file,originalSha256,build}){
   revoke();const token=generation;
   if(!(file instanceof File)||file.size<1||file.size>128*1024*1024||
    !file.name.toLowerCase().endsWith('.p1g')||!validSha(originalSha256)||
    !safeKeys(build,'platform,buildKind,buildId,schema,externallyConfirmed')||
    build.platform!=='steam-windows'||build.buildKind!=='steam-full-version'||
    build.buildId!==STEAM||build.schema!==626||build.externallyConfirmed!==true)fail();
   let bytes;
   try{
    bytes=new Uint8Array(await file.arrayBuffer());check(token);
    const digest=await h(bytes);check(token);
    if(bytes.length!==file.size||digest!==originalSha256)fail();
    const r=await bridge.openEncrypted({build,encryptedBytes:bytes});check(token);
    if(r.writerAuthorized!==false||r.schema!==626)fail();
    const directory=await navigator.storage.getDirectory();check(token);
    receipt=scope(r);root=directory;
    original={bytes,sha:originalSha256,name:file.name,size:bytes.length};
    bytes=null;
    return kind('OPEN');
   }catch{if(token===generation)revoke();fail()}
   finally{if(bytes)bytes.fill(0)}
  },
  async backupOriginal(){
   if(!original||!root||!receipt||backup)fail();
   const token=generation,o=original,r=root;
   const saved=await writeChecked(r,'wand-original-backup',new Uint8Array(o.bytes),o.sha,
    [o.name],()=>check(token));
   check(token);
   if(sameName(saved.name,o.name))fail();
   backup={name:saved.name,source:o};
   return {backupReadbackVerified:true,originalUnchanged:true,
    shaMatched:true,sizeMatched:true,separateName:true,originalName:o.name,
    originalSha256:o.sha,originalSizeBytes:o.size,backupName:saved.name};
  },
  async listVerifiedTargets(){
   if(!backup||!receipt||backup.source!==original)fail();
   const token=generation;
   // Provider runs Worker-side only, never supplied by UI or Save JSON guess.
   const list=await verifyTargets(Object.freeze({bridge,scope:receipt}));
   check(token);
   if(!Array.isArray(list)||list.length>256)fail();
   // Validate identity + rights/registry before letting the UI see them.
   const checked=list.map(t=>{
    createExistingAmountDecrease(t,t.oldAmount-1);
    return Object.freeze({...t});
   });
   check(token);targets=checked;return {targets:checked,rawDocumentExposed:false};
  },
  async stageTyped(commands){
   if(!receipt||!backup||backup.source!==original||applied||!Array.isArray(commands)||commands.length!==1)fail();
   const command=commands[0];
   const accepted=targets.some(t=>{
    try{const derived=createExistingAmountDecrease(t,command.newAmount);
      return safeKeys(command,Object.keys(derived).join(','))&&
       Object.keys(derived).every(k=>derived[k]===command[k]);
    }catch{return false}
   });
   if(!accepted)fail();
   const r=bridge.devStageTypedAmounts(receipt,[command]);
   receipt={...receipt,revision:r.revision,indexGeneration:r.indexGeneration};
   applied=true;return kind('STAGED');
  },
  async undo(){
   if(!receipt||!applied)fail();
   const r=bridge.devUndoTypedAmounts(receipt);
   receipt={...receipt,revision:r.revision,indexGeneration:r.indexGeneration};
   applied=false;return kind('UNDONE');
  },
  async redo(){
   if(!receipt||applied)fail();
   const r=bridge.devRedoTypedAmounts(receipt);
   receipt={...receipt,revision:r.revision,indexGeneration:r.indexGeneration};
   applied=true;return kind('REDONE');
  },
  async exportEditedCopy(){
   if(!receipt||!applied||!backup||!original||!root)fail();
   const token=generation,o=original,b=backup,r=root;
   if(b.source!==o||sameName(b.name,o.name))fail();
   let saved;
   try{
    const edited=await bridge.devCreateEncodedEditedOnce(receipt);check(token);
    if(edited.writerAuthorized!==false||
     edited.originalOverwriteAuthorized!==false||edited.nativeV3Verified!==false||
     !(edited.editedCiphertext instanceof Uint8Array)||!validSha(edited.editedSha256)||
     edited.editedSha256===o.sha)fail();
    saved=await writeChecked(r,'wand-edited-copy',edited.editedCiphertext,
     edited.editedSha256,[o.name,b.name],()=>check(token));check(token);
    const reopened=await freshReopen(saved.bytes,edited.stagedDecodedSha256);check(token);
    const sourceUnchanged=await h(o.bytes)===o.sha;check(token);
    if(!reopened||!sourceUnchanged||sameName(saved.name,b.name)||
     sameName(saved.name,o.name))fail();
    const result={kind:'EXPORTED',ok:true,backupName:b.name,
     editedCopyName:saved.name,editedCiphertextVerified:true,
     freshWorkerReopenVerified:true,independentProcessReopenVerified:false,
     originalUnchanged:true,writerAuthorized:false,nativeV3Verified:false,
     originalOverwriteAuthorized:false};
    revoke();return result;
   }catch{
    // Remove ONLY this operation's newly allocated edited copy; never a
    // previous backup or newer selection. No late error closes B.
    if(saved)try{await r.removeEntry(saved.name)}catch{}
    if(token===generation)revoke();
    fail();
   }
  },
  close
 });
}
// Exactly one trusted dev-local Worker receives this message protocol.
// The browser UI only sees fixed bounded receipts; errors are generic.
export function installLocalDevAmountWorker(port,adapter){
 if(!port||typeof port.postMessage!=='function'||!adapter)fail();
 const methods=new Set(['open','backupOriginal','listVerifiedTargets',
  'stageTyped','undo','redo','exportEditedCopy','close']);
 // IDs are consumed BEFORE invoking an adapter, including denied/busy
 // requests. A Close revokes the operation, not the per-port high-water mark.
 let lastId=0,active=null,epoch=0;
 port.onmessage=async e=>{
  const v=e.data;
  if(!safeKeys(v,'id,method,args')||!Number.isSafeInteger(v.id)||
    v.id<1||v.id<=lastId||!methods.has(v.method)||!Array.isArray(v.args)||
    v.args.length!==(['open','stageTyped'].includes(v.method)?1:0)){
    port.postMessage({id:v?.id??0,ok:false,error:'DENIED'});return;
  }
  lastId=v.id;
  const deny=()=>port.postMessage({id:v.id,ok:false,error:'DENIED'});
  if(v.method==='close'){
   const token=++epoch;
   try{const data=await adapter.close();if(token!==epoch){deny();return}
    port.postMessage({id:v.id,ok:true,data});
   }catch{deny()}
   return;
  }
  if(active!==null){deny();return}
  const token=epoch;active=v.id;
  try{
   const data=await adapter[v.method](...v.args);
   if(token!==epoch){deny();return}
   port.postMessage({id:v.id,ok:true,data});
  }catch{deny()}
  finally{if(active===v.id)active=null}
 };
}
export function createLocalAmountDevPort(worker){
 if(!worker||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function')fail();
 let serial=0;const pending=new Map();
 worker.onmessage=e=>{
  const v=e.data,p=pending.get(v?.id);if(!p)return;
  pending.delete(v.id);
  if(!safeKeys(v,v.ok===true?'id,ok,data':'id,ok,error')||
     v.ok!==true){p.reject(Error('DEV_WORKER_DENIED'));return}
  p.resolve(v.data);
 };
 worker.onerror=()=>{for(const p of pending.values())p.reject(Error('DEV_WORKER_ERROR'));pending.clear()};
 const rpc=(method,...args)=>new Promise((resolve,reject)=>{
  const id=++serial;pending.set(id,{resolve,reject});
  try{worker.postMessage({id,method,args})}catch(e){pending.delete(id);reject(Error('DEV_WORKER_POST_DENIED'))}
 });
 return Object.freeze({
  open:args=>rpc('open',args),backupOriginal:()=>rpc('backupOriginal'),
  listVerifiedTargets:()=>rpc('listVerifiedTargets'),
  stageTyped:commands=>rpc('stageTyped',commands),
  undo:()=>rpc('undo'),redo:()=>rpc('redo'),
  exportEditedCopy:()=>rpc('exportEditedCopy'),
  close:()=>rpc('close'),
  dispose:()=>{for(const p of pending.values())p.reject(Error('DEV_WORKER_CLOSED'));
   pending.clear();worker.terminate()}
 });
}
