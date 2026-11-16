// ACT951 product-source adapter. Same UI contract as accepted DEV workflow;
// no new Reader/Executor, no route, no product authorization. Discovery is a
// trusted Worker-local Core provider, NOT a caller/UI plan or private fixture.
import {createP1gRustWorkerReadOnlyBridge} from './p1g-rust-worker-readonly-bridge.mjs';
import {createLocalEncryptedCopyStore} from './local-encrypted-copy-store.mjs';
import {FIXED_COLLECTION_SELECTOR} from './product-fixed-collection-transport.mjs';
const fail=()=>{throw Error('PRODUCT_SCOPED_LOCAL_DENIED')};
const keys=(r,k)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const kind=k=>({kind:k,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
// Exact existing DEV codec-only Reopen worker (PR1261 original blob).
function freshReopen(ciphertext,expectedDecodedSha256){
 return new Promise((resolve,reject)=>{
  const w=new Worker(new URL('../../../dev/local-amount-codec-reopen.worker.mjs',import.meta.url),{type:'module'});
  const timer=setTimeout(()=>{w.terminate();reject(Error('REOPEN_TIMEOUT'))},30000);
  const finish=(ok)=>{clearTimeout(timer);w.terminate();resolve(ok)};
  w.onerror=()=>finish(false);
  w.onmessage=e=>finish(e.data?.freshWorkerReopenVerified===true&&e.data?.privatePayloadPosted===false);
  try{w.postMessage({ciphertext:new Uint8Array(ciphertext),expectedDecodedSha256})}catch{finish(false)}
 });
}
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SWITCH='9A239D3DB569756D';
export function createProductScopedAmountLocalAdapter(options={}){return createScopedLocalAdapter(options,false)}
// Explicit trusted Switch626 scope; no caller/UI profile or alternate discovery.
export function createProductSwitch626ChestLocalAdapter(options={}){
 if(options.allowCoreDiscoverySource===false||(options.coreDiscoveryProfile!==undefined&&options.coreDiscoveryProfile!=='linked-crop-chest48')||options.discoverScopedTargets!==undefined)fail();
 return createScopedLocalAdapter({...options,allowCoreDiscoverySource:true,coreDiscoveryProfile:'linked-crop-chest48'},false,true);
}
export function createProductSteam626ChestLocalAdapter(options={}){
 if(options.allowCoreDiscoverySource===false||(options.coreDiscoveryProfile!==undefined&&options.coreDiscoveryProfile!=='linked-crop-chest48')||options.discoverScopedTargets!==undefined)fail();
 return createScopedLocalAdapter({...options,allowCoreDiscoverySource:true,coreDiscoveryProfile:'linked-crop-chest48'},false,false,true);
}
export function createProductSwitch626Catalog0LocalAdapter(options={}){
 if(options.allowCoreDiscoverySource===false||(options.coreDiscoveryProfile!==undefined&&options.coreDiscoveryProfile!=='catalog0-furniture')||options.discoverScopedTargets!==undefined)fail();
 return createScopedLocalAdapter({...options,allowCoreDiscoverySource:true,coreDiscoveryProfile:'catalog0-furniture'},false,false,false,true);
}
// Trusted Worker constructor only. Same local copy lifecycle, one bridge/Session;
// this is the existing Collection UI contract, not a public Writer grant.
export function createProductFixedCollectionLocalAdapter(options={}){return createScopedLocalAdapter(options,true)}
export function createProductSteam626Comp03LocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,'comp03')}
export function createProductSteam626Comp03SpatialLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,'comp03-spatial')}
export function createProductSteam626VaseAddLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,'vase')}
export function createProductSteam626Sr03LocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,'sr03')}
export function createProductSwitch626Rm01LocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,'rm01')}
export function createProductSteam626BackpackLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,'steam')}
export function createProductSwitch626BackpackLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,'switch')}
export function createProductSteam626WardrobeLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,null,'steam')}
export function createProductSwitch626WardrobeLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,null,'switch')}
export function createProductSteam626HairLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,null,null,'hair')}
export function createProductSteam626SkinLocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,null,null,'skin')}
export function createProductSteam626MakeupColor1LocalAdapter(options={}){return createScopedLocalAdapter(options,false,false,false,false,null,null,null,'makeup-color1')}
function createScopedLocalAdapter({wasmFactory,discoverScopedTargets,allowCoreDiscoverySource=false,coreDiscoveryProfile='linked-crop-chest48',freshCodecReopen=freshReopen,getDirectory}={},collection,switchChest=false,steamChest=false,catalog=false,placementScope=null,backpackScope=null,wardrobeScope=null,appearanceScope=null){
 const placement=placementScope!==null,backpack=backpackScope!==null,wardrobe=wardrobeScope!==null,appearance=appearanceScope!==null,previewEdit=placement||backpack||wardrobe||appearance,placementCount=(wardrobe||appearance)?1:(placementScope==='comp03'||placementScope==='comp03-spatial')?9:(placementScope==='sr03'||placementScope==='rm01')?8:3;
 if(typeof document!=='undefined'||typeof wasmFactory!=='function'||typeof allowCoreDiscoverySource!=='boolean'||
  (discoverScopedTargets!==undefined&&typeof discoverScopedTargets!=='function')||
  (allowCoreDiscoverySource&&discoverScopedTargets!==undefined)||
  ((collection||previewEdit)&&(allowCoreDiscoverySource||discoverScopedTargets!==undefined))||
  !['linked-crop-chest48','catalog0-furniture'].includes(coreDiscoveryProfile))fail();
 const store=createLocalEncryptedCopyStore(getDirectory?{getDirectory}:{});
 const bridge=createP1gRustWorkerReadOnlyBridge(wasmFactory,{allowScopedAmountSource:!collection&&!switchChest&&!steamChest&&!catalog&&!previewEdit,allowSwitch626Catalog0Source:catalog,allowSwitch626ChestSource:switchChest,allowSteam626ChestSource:steamChest,allowScopedCollectionSource:collection,placementScope,backpackScope,wardrobeScope,appearanceScope,readDurableOriginalBackup:b=>store.durable(b)});
 let epoch=0,source=null,backup=null,targets=[],phase='closed',busy=false,closeUnverified=false;
 const revoke=()=>{
  epoch++;store.close();source=null;backup=null;targets=[];phase='closed';busy=false;
  try{const r=bridge.close();if(!keys(r,'closed,writerAuthorized')||r.closed!==true||r.writerAuthorized!==false)fail();closeUnverified=false}
  catch(e){closeUnverified=true;phase='close-failed';throw e}
 };
 const check=t=>{if(t!==epoch)fail()};
 const run=async fn=>{
  if(busy)fail();const t=epoch;busy=true;
  try{const r=await fn(t);check(t);return r}catch(e){if(t===epoch)revoke();throw e}
  finally{if(t===epoch)busy=false}
 };
 const requirePhase=p=>{if(phase!==p)fail()};
 const close=async()=>{revoke();return kind('CLOSED')};
 const selectionCheck=selection=>{if(collection&&(!source||!uint(selection)||selection!==source.selection))fail()};
 const collectionSafety={writerAuthorized:false,originalOverwriteAuthorized:false};
 const cleanTarget=r=>{
  if(!keys(r,'profile,id,selector,itemId,oldAmount')||!uint(r.id)||!uint(r.selector)||!uint(r.itemId)||!r.itemId||
   !uint(r.oldAmount)||r.oldAmount<2||r.oldAmount>9999||((switchChest||steamChest)&&(r.profile!=='linked-crop-chest48'||r.oldAmount!==50))||
   (catalog&&(r.profile!=='catalog0-furniture'||r.id!==0||r.itemId!==40000076||r.selector!==40000076))||
   !((r.profile==='linked-crop-chest48'&&r.id>1&&r.selector<48)||(r.profile==='catalog0-furniture'&&r.id===0&&r.selector===r.itemId)))fail();
  const chest=r.profile==='linked-crop-chest48';
  return {kind:chest?'ChestExistingSlotAmountDecrease':'InventoryExistingAmountDecrease',targetId:r.id,itemId:r.itemId,
   slotIndex:chest?r.selector:0,compatibleItemType:chest?null:'ItemType_Furniture',oldAmount:r.oldAmount,
   registryVerified:true,sourceVerified:true,rightsAllowed:true};
 };
 const api={
  async open(args){
   if(closeUnverified)fail();revoke();return run(async t=>{
    if(!keys(args,'file,originalSha256,build')||!keys(args.build,'platform,buildKind,buildId,schema,externallyConfirmed')||
     !((!switchChest&&!catalog&&placementScope!=='rm01'&&backpackScope!=='switch'&&wardrobeScope!=='switch'&&args.build.platform==='steam-windows'&&args.build.buildKind==='steam-full-version'&&args.build.buildId===STEAM)||
       ((collection||switchChest||catalog||placementScope==='rm01'||backpackScope==='switch'||wardrobeScope==='switch')&&args.build.platform==='switch'&&args.build.buildKind==='switch-bid'&&args.build.buildId===SWITCH))||
     args.build.schema!==626||args.build.externallyConfirmed!==true||!uint(t)||t<1)fail();
    const input=Object.freeze({file:args.file,originalSha256:args.originalSha256,build:Object.freeze({...args.build})});
    const r=await bridge.openScopedEncrypted(input);check(t);
    if(r.sourceShaMatched!==true||r.originalSizeMatched!==true||r.fullDocumentValidated!==true||r.writerAuthorized!==false)fail();
    await store.open(input.file,input.originalSha256);check(t);
    source={file:input.file,name:input.file.name,sha:input.originalSha256,size:input.file.size,build:input.build,selection:t};phase='opened';return kind('OPEN');
   })
  },
  backupOriginal(selection){selectionCheck(selection);requirePhase('opened');if(collection&&targets.length!==1)fail();return run(async t=>{
   const b=await store.backupOriginal();check(t);
   const f=await store.durable({originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size});check(t);
   const r=await bridge.verifyScopedOriginalBackup(f);check(t);if(r.candidateBytesMatchOriginal!==true)fail();
   backup=b;phase='backed';return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
    originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size,backupName:b.name};
  })},
  listVerifiedTargets(){if(collection||previewEdit)fail();requirePhase('backed');return run(async t=>{
   // Provider may only use this active Worker-owned session. No UI selectors.
   const rows=allowCoreDiscoverySource?bridge.discoverScopedTargets(coreDiscoveryProfile):
    discoverScopedTargets?await discoverScopedTargets(Object.freeze({bridge,receipt:bridge.getReceipt()})):[];check(t);
   if(!Array.isArray(rows)||rows.length>256)fail();
   const seen=new Set();targets=rows.map(r=>{
    const ui=cleanTarget(r),key=r.profile+':'+r.id+':'+r.selector;
    const p=bridge.previewScopedAmount({profile:r.profile,id:r.id,selector:r.selector,newAmount:r.oldAmount-1});
    if(p.oldAmount!==r.oldAmount||p.itemId!==r.itemId||p.writerAuthorized!==false)fail();
    if(seen.has(key))fail();seen.add(key);return {raw:Object.freeze({...r}),ui:Object.freeze(ui)};
   });
   phase='ready';return {targets:targets.map(t=>t.ui),rawDocumentExposed:false};
  })},
  stageTyped(commands){if(collection||previewEdit)fail();requirePhase('ready');return run(async t=>{
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
  undo(selection){selectionCheck(selection);requirePhase('staged');return run(async()=>{const r=appearance?bridge.toggleScopedAppearance(false):wardrobe?bridge.toggleScopedWardrobe(false):backpack?bridge.toggleScopedBackpack(false):placement?bridge.toggleScopedPlacement(false):collection?bridge.toggleFixedCollection(false):bridge.toggleScopedAmount(false);if(r.applied!==false)fail();phase='undone';return collection?collectionMutation('UNDONE'):kind('UNDONE')})},
  redo(selection){selectionCheck(selection);requirePhase('undone');return run(async()=>{const r=appearance?bridge.toggleScopedAppearance(true):wardrobe?bridge.toggleScopedWardrobe(true):backpack?bridge.toggleScopedBackpack(true):placement?bridge.toggleScopedPlacement(true):collection?bridge.toggleFixedCollection(true):bridge.toggleScopedAmount(true);if(r.applied!==true)fail();phase='staged';return collection?collectionMutation('REDONE'):kind('REDONE')})},
  exportEditedCopy(selection){selectionCheck(selection);requirePhase('staged');return run(async t=>{
   if(typeof freshCodecReopen!=='function')fail();
   const o=await bridge.exportScopedEditedCopy();
   try{check(t);
    if(o.codecReopenVerified!==true||o.writerAuthorized!==false||o.originalOverwriteAuthorized!==false||
      !/^[a-f0-9]{64}$/.test(o.decodedSha256)||o.sha256===source.sha)fail();
    // Fresh Worker is codec-only; no second Rust session. Before persistence,
    // require the exact decoded digest returned by the accepted Rust transport.
    if(await freshCodecReopen(o.encryptedBytes,o.decodedSha256)!==true)fail();check(t);
    const b=await store.writeEdited(o.encryptedBytes,o.sha256);check(t);
    const original=new Uint8Array(await Blob.prototype.arrayBuffer.call(source.file));
    try{check(t);if(await digest(original)!==source.sha)fail();check(t)}finally{original.fill(0)}
    phase='exported';return {...(collection?{kind:'EXPORTED',selection:source.selection,...collectionSafety}:kind('EXPORTED')),backupName:backup.name,editedCopyName:b.name,editedSha256:b.sha,
     editedSizeBytes:b.size,editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true};
   }finally{o.encryptedBytes.fill(0)}
  })},
  downloadVerifiedCopy(selection,which){if(!collection){which=selection}else selectionCheck(selection);if(!['backed','ready','previewed','staged','undone','exported'].includes(phase)||!['backup','edited'].includes(which)||which==='edited'&&phase!=='exported')fail();return run(async t=>{const r=await store.download(which);try{check(t);return r}catch(e){r.encryptedBytes.fill(0);throw e}})},
  close
 };
 const collectionMutation=k=>({kind:k,selection:source.selection,choice:0,exactFieldChangedCount:1,...collectionSafety});
 const fixedPreview=(inspect=false)=>{
  const p=inspect?bridge.inspectFixedCollection(FIXED_COLLECTION_SELECTOR):bridge.previewFixedCollection(FIXED_COLLECTION_SELECTOR);
  if(!keys(p,'definitionId,groupIndex,itemId,oldValue,newValue,groupState,falseCount,remainingFalseCount,fixedDefinitionVerified,installedRuntimeParityVerified,writerAuthorized,editedCopyAuthorized,applyAuthorized')||
   p.definitionId!==FIXED_COLLECTION_SELECTOR.definitionId||p.groupIndex!==0||p.itemId!==FIXED_COLLECTION_SELECTOR.itemId||
   p.oldValue!==false||p.newValue!==true||p.groupState!=='NotComplete'||p.falseCount!==3||p.remainingFalseCount!==2||
   p.fixedDefinitionVerified!==true||p.installedRuntimeParityVerified!==false||p.writerAuthorized!==false||p.editedCopyAuthorized!==false||p.applyAuthorized!==false)fail();
  return p;
 };
 if(previewEdit)return Object.freeze({open:api.open,close,backupOriginal:api.backupOriginal,undo:api.undo,redo:api.redo,exportEditedCopy:api.exportEditedCopy,downloadVerifiedCopy:api.downloadVerifiedCopy,
  ...(placementScope==='comp03-spatial'?{spatialPreview(...args){requirePhase('previewed');return run(async()=>{if(args.length)fail();return bridge.spatialPreview()})}}:{}),
   [appearance?'previewAppearance':wardrobe?'previewWardrobe':backpack?'previewBackpack':'previewPlacement'](...args){if(!['backed','previewed'].includes(phase))fail();return run(async()=>{if(args.length!==((wardrobe||appearance)?0:1))fail();const p=appearance?bridge.previewScopedAppearance():wardrobe?bridge.previewScopedWardrobe():backpack?bridge.previewScopedBackpack(args[0]):bridge.previewScopedPlacement(args[0]);if(p.exactFieldChangedCount!==placementCount||p.writerAuthorized!==false||p.editedCopyAuthorized!==false)fail();phase='previewed';return p})},
  [appearance?'stageAppearance':wardrobe?'stageWardrobe':backpack?'stageBackpack':'stagePlacement'](...args){requirePhase('previewed');return run(async t=>{if(args.length)fail();const r=await (appearance?bridge.stageScopedAppearance():wardrobe?bridge.stageScopedWardrobe():backpack?bridge.stageScopedBackpack():bridge.stageScopedPlacement());check(t);if(r.applied!==true||r.exactFieldChangedCount!==placementCount||r.writerAuthorized!==false)fail();phase='staged';return {...kind('STAGED'),exactFieldChangedCount:placementCount}})}
 });
 if(!collection)return Object.freeze(api);
 // The fixed Core preview (not candidate-only read) is the only source of
 // this single UI target. Scope is the pinned normal-retail definition;
 // no installed-runtime parity or wider eligibility is asserted.
 return Object.freeze({open:api.open,close,backupOriginal:api.backupOriginal,undo:api.undo,redo:api.redo,exportEditedCopy:api.exportEditedCopy,downloadVerifiedCopy:api.downloadVerifiedCopy,
  inspectCollectionTargets(){requirePhase('opened');return run(async()=>{
   fixedPreview(true);
   const target=Object.freeze({...FIXED_COLLECTION_SELECTOR,oldValue:false,groupState:'NotComplete',falseCount:3,coreMinted:true,eligibilityVerified:true});targets=[target];
   return {selection:source.selection,build:source.build,originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size,targets:[target],...collectionSafety};
  })},
  previewCollectionTarget(selection,choice){selectionCheck(selection);if(!['backed','previewed'].includes(phase)||choice!==0||targets.length!==1)fail();return run(async()=>{
   const p=fixedPreview();phase='previewed';return {selection,choice:0,oldValue:false,newValue:true,groupState:p.groupState,remainingFalseCount:p.remainingFalseCount,exactFieldChangedCount:1,...collectionSafety};
  })},
  stageCollectionTarget(selection,choice){selectionCheck(selection);requirePhase('previewed');if(choice!==0||targets.length!==1)fail();return run(async t=>{
   fixedPreview();const r=await bridge.stageFixedCollection();check(t);
   if(r.applied!==true||r.exactFieldChangedCount!==1||r.writerAuthorized!==false)fail();phase='staged';return collectionMutation('STAGED');
  })}
 });
}
