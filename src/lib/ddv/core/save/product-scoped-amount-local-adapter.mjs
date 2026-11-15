// ACT951 product-source adapter. Same UI contract as accepted DEV workflow;
// no new Reader/Executor, no route, no product authorization. Discovery is a
// trusted Worker-local Core provider, NOT a caller/UI plan or private fixture.
import {createP1gRustWorkerReadOnlyBridge} from './p1g-rust-worker-readonly-bridge.mjs';
import {createLocalEncryptedCopyStore} from './local-encrypted-copy-store.mjs';
const fail=()=>{throw Error('PRODUCT_SCOPED_LOCAL_DENIED')};
const keys=(r,k)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const kind=k=>({kind:k,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
export function createProductScopedAmountLocalAdapter({wasmFactory,discoverScopedTargets=async()=>[],freshCodecReopen,getDirectory}={}){
 if(typeof document!=='undefined'||typeof wasmFactory!=='function'||typeof discoverScopedTargets!=='function')fail();
 const store=createLocalEncryptedCopyStore(getDirectory?{getDirectory}:{});
 const bridge=createP1gRustWorkerReadOnlyBridge(wasmFactory,{allowScopedAmountSource:true,readDurableOriginalBackup:b=>store.durable(b)});
 let epoch=0,source=null,backup=null,targets=[],phase='closed',busy=false;
 const revoke=()=>{epoch++;bridge.close();store.close();source=null;backup=null;targets=[];phase='closed';busy=false};
 const check=t=>{if(t!==epoch)fail()};
 const run=async fn=>{
  if(busy)fail();const t=epoch;busy=true;
  try{const r=await fn(t);check(t);return r}catch(e){if(t===epoch)revoke();throw e}
  finally{if(t===epoch)busy=false}
 };
 const requirePhase=p=>{if(phase!==p)fail()};
 const close=async()=>{revoke();return kind('CLOSED')};
 const cleanTarget=r=>{
  if(!keys(r,'profile,id,selector,itemId,oldAmount')||!uint(r.id)||!uint(r.selector)||!uint(r.itemId)||!r.itemId||
   !uint(r.oldAmount)||r.oldAmount<2||r.oldAmount>9999||
   !((r.profile==='linked-crop-chest48'&&r.id>1&&r.selector<48)||(r.profile==='catalog0-furniture'&&r.id===0&&r.selector===r.itemId)))fail();
  const chest=r.profile==='linked-crop-chest48';
  return {kind:chest?'ChestExistingSlotAmountDecrease':'InventoryExistingAmountDecrease',targetId:r.id,itemId:r.itemId,
   slotIndex:chest?r.selector:0,compatibleItemType:chest?null:'ItemType_Furniture',oldAmount:r.oldAmount,
   registryVerified:true,sourceVerified:true,rightsAllowed:true};
 };
 return Object.freeze({
  async open(args){
   revoke();return run(async t=>{
    if(!keys(args,'file,originalSha256,build')||!keys(args.build,'platform,buildKind,buildId,schema,externallyConfirmed')||
     args.build.platform!=='steam-windows'||args.build.buildKind!=='steam-full-version'||args.build.buildId!==STEAM||
     args.build.schema!==626||args.build.externallyConfirmed!==true)fail();
    const r=await bridge.openScopedEncrypted(args);check(t);
    if(r.sourceShaMatched!==true||r.originalSizeMatched!==true||r.fullDocumentValidated!==true||r.writerAuthorized!==false)fail();
    await store.open(args.file,args.originalSha256);check(t);
    source={file:args.file,name:args.file.name,sha:args.originalSha256,size:args.file.size};phase='opened';return kind('OPEN');
   })
  },
  backupOriginal(){requirePhase('opened');return run(async t=>{
   const b=await store.backupOriginal();check(t);
   const f=await store.durable({originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size});check(t);
   const r=await bridge.verifyScopedOriginalBackup(f);check(t);if(r.candidateBytesMatchOriginal!==true)fail();
   backup=b;phase='backed';return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
    originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size,backupName:b.name};
  })},
  listVerifiedTargets(){requirePhase('backed');return run(async t=>{
   // Provider may only use this active Worker-owned session. No UI selectors.
   const rows=await discoverScopedTargets(Object.freeze({bridge,receipt:bridge.getReceipt()}));check(t);
   if(!Array.isArray(rows)||rows.length>256)fail();
   const seen=new Set();targets=rows.map(r=>{
    const ui=cleanTarget(r),key=r.profile+':'+r.id+':'+r.selector;
    if(seen.has(key))fail();seen.add(key);return {raw:Object.freeze({...r}),ui:Object.freeze(ui)};
   });
   phase='ready';return {targets:targets.map(t=>t.ui),rawDocumentExposed:false};
  })},
  stageTyped(commands){requirePhase('ready');return run(async t=>{
   if(!Array.isArray(commands)||commands.length!==1)fail();
   const c=commands[0],match=targets.find(({raw:r,ui:u})=>{
    const common=c?.kind===u.kind&&c.expectedOldAmount===r.oldAmount&&c.newAmount===r.oldAmount-1;
    return common&&(r.profile==='linked-crop-chest48'?
     keys(c,'kind,containerId,slotIndex,expectedItemId,expectedOldAmount,newAmount')&&c.containerId===r.id&&c.slotIndex===r.selector&&c.expectedItemId===r.itemId:
     keys(c,'kind,inventoryId,canonicalItemId,compatibleItemType,expectedOldAmount,newAmount')&&c.inventoryId===0&&c.canonicalItemId===r.itemId&&c.compatibleItemType==='ItemType_Furniture');
   });
   if(!match)fail();
   const r=match.raw,p=bridge.previewScopedAmount({profile:r.profile,id:r.id,selector:r.selector,newAmount:r.oldAmount-1});
   if(p.itemId!==r.itemId||p.oldAmount!==r.oldAmount||p.newAmount!==r.oldAmount-1||p.writerAuthorized!==false)fail();
   const staged=await bridge.stageScopedAmount();check(t);
   if(staged.applied!==true||staged.exactFieldChangedCount!==1||staged.writerAuthorized!==false)fail();
   phase='staged';return kind('STAGED');
  })},
  undo(){requirePhase('staged');return run(async()=>{const r=bridge.toggleScopedAmount(false);if(r.applied!==false)fail();phase='undone';return kind('UNDONE')})},
  redo(){requirePhase('undone');return run(async()=>{const r=bridge.toggleScopedAmount(true);if(r.applied!==true)fail();phase='staged';return kind('REDONE')})},
  exportEditedCopy(){requirePhase('staged');return run(async t=>{
   if(typeof freshCodecReopen!=='function')fail();
   const o=await bridge.exportScopedEditedCopy();check(t);
   try{
    if(o.codecReopenVerified!==true||o.writerAuthorized!==false||o.originalOverwriteAuthorized!==false||
      !/^[a-f0-9]{64}$/.test(o.decodedSha256)||o.sha256===source.sha)fail();
    // Fresh Worker is codec-only; no second Rust session. Before persistence,
    // require the exact decoded digest returned by the accepted Rust transport.
    if(await freshCodecReopen(o.encryptedBytes,o.decodedSha256)!==true)fail();check(t);
    const b=await store.writeEdited(o.encryptedBytes,o.sha256);check(t);
    const original=new Uint8Array(await Blob.prototype.arrayBuffer.call(source.file));check(t);
    try{if(await digest(original)!==source.sha)fail();check(t)}finally{original.fill(0)}
    phase='exported';return {...kind('EXPORTED'),backupName:backup.name,editedCopyName:b.name,editedSha256:b.sha,
     editedSizeBytes:b.size,editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true};
   }finally{o.encryptedBytes.fill(0)}
  })},
  downloadVerifiedCopy(which){if(!['backed','ready','staged','undone','exported'].includes(phase)||which==='edited'&&phase!=='exported')fail();return run(async()=>store.download(which))},
  close
 });
}
