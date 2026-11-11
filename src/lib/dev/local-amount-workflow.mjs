// W-WEB-007 / W-LOCAL-019: local DEV/OFF UI state machine over ONE 01A
// ProductSession Worker adapter. No Save, decoded JSON, SessionID, Cursor or
// internal SHA may be returned to the caller/UI. No route/public Writer.
// PR929 adapter acceptance by QAC/QRL is a separate deployment prerequisite.
export const STEAM626_FULL_VERSION=
  'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
export const DEV_AMOUNT_CONTRACT='wand.local.dev-off.typed-amount-ui@1';
const fail=code=>{throw Error('DEV_AMOUNT_UI_'+code)};
const only=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype&&
  Object.keys(o).sort().join(',')===keys.split(',').sort().join(',');
const uint=(v,positive=false)=>Number.isSafeInteger(v)&&v>=(positive?1:0)&&v<=0xffffffff;
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const same=(a,b)=>a===b;
function trustedTarget(t){
  if(!only(t,'kind,targetId,itemId,slotIndex,compatibleItemType,oldAmount,registryVerified,sourceVerified,rightsAllowed')||
     !['InventoryExistingAmountDecrease','ChestExistingSlotAmountDecrease'].includes(t.kind)||
     !uint(t.targetId,true)||!uint(t.itemId,true)||!uint(t.slotIndex)||
     !uint(t.oldAmount,true)||t.oldAmount<=1||
     t.registryVerified!==true||t.sourceVerified!==true||t.rightsAllowed!==true||
     (t.kind==='InventoryExistingAmountDecrease'&&
      (typeof t.compatibleItemType!=='string'||
        !/^ItemType_[A-Za-z]{1,48}$/.test(t.compatibleItemType)))||
     (t.kind==='ChestExistingSlotAmountDecrease'&&t.compatibleItemType!==null))
    fail('UNVERIFIED_ITEM_OR_RIGHTS_TARGET');
  return Object.freeze({...t});
}
export function createExistingAmountDecrease(target,newAmount){
  const t=trustedTarget(target);
  if(!uint(newAmount,true)||newAmount>=t.oldAmount)fail('ONLY_POSITIVE_EXISTING_DECREASE');
  if(t.kind==='InventoryExistingAmountDecrease')
    return Object.freeze({kind:t.kind,inventoryId:t.targetId,
      canonicalItemId:t.itemId,compatibleItemType:t.compatibleItemType,
      expectedOldAmount:t.oldAmount,newAmount});
  return Object.freeze({kind:t.kind,containerId:t.targetId,slotIndex:t.slotIndex,
    expectedItemId:t.itemId,expectedOldAmount:t.oldAmount,newAmount});
}
const safeReceipt=(r,kind)=>only(r,'kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized')&&
  r.kind===kind&&r.ok===true&&r.writerAuthorized===false&&
  r.nativeV3Verified===false&&r.originalOverwriteAuthorized===false;
const cleanState=()=>({
  phase:'closed',fileName:'',backupVerified:false,targets:[],
  choice:-1,newAmount:'',preview:null,editedCopy:null,error:''
});
export function createLocalAmountDevWorkflow(adapter,{trustedLocalHarness=false}={}){
  if(trustedLocalHarness!==true||!adapter||typeof adapter!=='object')
    fail('LOCAL_HARNESS_GATE_OFF');
  for(const method of ['open','backupOriginal','listVerifiedTargets','stageTyped',
    'undo','redo','exportEditedCopy','close'])
    if(typeof adapter[method]!=='function')fail('TRUSTED_WORKER_API_MISSING');
  let epoch=0,busy=false,state=cleanState();
  const snapshot=()=>Object.freeze({...state,targets:Object.freeze([...state.targets]),
    preview:state.preview?Object.freeze({...state.preview}):null,
    editedCopy:state.editedCopy?Object.freeze({...state.editedCopy}):null});
  const set=patch=>{state={...state,...patch};return snapshot()};
  const ensureReady=phase=>{if(state.phase!==phase||busy)fail('INVALID_STATE_OR_BUSY')};
  const execute=async work=>{
    if(busy)fail('PENDING_OPERATION');
    const token=epoch;busy=true;
    try{
      const value=await work();
      if(token!==epoch)fail('STALE_FILE_OR_CLOSE');
      return value;
    }catch(error){
      if(token===epoch){
        epoch++;state=cleanState();
        try{await adapter.close()}catch{}
      }
      throw error;
    }finally{busy=false}
  };
  const close=async()=>{
    epoch++;state=cleanState();
    try{await adapter.close()}catch{}
    return snapshot();
  };
  const open=async({file,fullVersion,originalSha256,buildConfirmed})=>{
    // Increment the selection epoch synchronously BEFORE the first await.
    // A concurrent Close/B selection must not let A start a new Rust Session
    // after its stale Worker close resolves (A→B / Close during OPEN).
    const openingEpoch=++epoch;
    state=cleanState();
    try{await adapter.close()}catch{}
    if(openingEpoch!==epoch)fail('STALE_FILE_OR_CLOSE');
    if(!file||typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.p1g')||
       !Number.isSafeInteger(file.size)||file.size<1||
       file.size>128*1024*1024||fullVersion!==STEAM626_FULL_VERSION||
       buildConfirmed!==true||!sha(originalSha256))fail('EXTERNAL_BUILD_AND_FILE_DENIED');
    return execute(async()=>{
      const r=await adapter.open({file,originalSha256,
        build:{platform:'steam-windows',buildKind:'steam-full-version',
          buildId:STEAM626_FULL_VERSION,schema:626,externallyConfirmed:true}});
      if(!safeReceipt(r,'OPEN'))fail('WORKER_OPEN_SCOPE_DENIED');
      // UI never reads an old amount from JSON; only trusted Rust/Native
      // allowlisted descriptors may be selected. Unknown items stay OFF.
      return set({phase:'opened',fileName:file.name});
    });
  };
  const backupAndRead=async()=>{
    ensureReady('opened');
    return execute(async()=>{
      const backup=await adapter.backupOriginal();
      if(!only(backup,'backupReadbackVerified,originalUnchanged,shaMatched,sizeMatched,separateName')||
         backup.backupReadbackVerified!==true||backup.originalUnchanged!==true||
         backup.shaMatched!==true||backup.sizeMatched!==true||
         backup.separateName!==true)fail('ORIGINAL_BACKUP_NOT_DURABLE');
      const r=await adapter.listVerifiedTargets();
      if(!only(r,'targets,rawDocumentExposed')||r.rawDocumentExposed!==false||
         !Array.isArray(r.targets)||r.targets.length>256)fail('UNTRUSTED_TARGET_LIST');
      const targets=r.targets.map(trustedTarget);
      const ids=new Set(targets.map(t=>t.kind+':'+t.targetId+':'+t.itemId+':'+t.slotIndex));
      if(ids.size!==targets.length)fail('DUPLICATE_TARGET');
      return set({phase:'ready',backupVerified:true,targets});
    });
  };
  const stage=async(index,newAmount)=>{
    ensureReady('ready');
    if(state.backupVerified!==true||!Number.isSafeInteger(index)||
      index<0||index>=state.targets.length)fail('TARGET_SELECTION_DENIED');
    const command=createExistingAmountDecrease(state.targets[index],newAmount);
    return execute(async()=>{
      const r=await adapter.stageTyped([command]); // PR929 exact command, CAS in Rust
      if(!safeReceipt(r,'STAGED'))fail('DEV_CAS_STAGE_RECEIPT_DENIED');
      return set({phase:'staged',choice:index,newAmount:String(newAmount),
        preview:{kind:command.kind,oldAmount:command.expectedOldAmount,
          newAmount:command.newAmount},editedCopy:null});
    });
  };
  const undo=async()=>{ensureReady('staged');return execute(async()=>{
    if(!safeReceipt(await adapter.undo(),'UNDONE'))fail('UNDO_DENIED');
    return set({phase:'undone'});
  })};
  const redo=async()=>{ensureReady('undone');return execute(async()=>{
    if(!safeReceipt(await adapter.redo(),'REDONE'))fail('REDO_DENIED');
    return set({phase:'staged'});
  })};
  const exportEditedCopy=async()=>{ensureReady('staged');
    if(!state.backupVerified||!state.preview)fail('BACKUP_OR_DIFF_MISSING');
    return execute(async()=>{
      const r=await adapter.exportEditedCopy();
      if(!only(r,'kind,ok,editedCopyName,backupName,editedCiphertextVerified,freshWorkerReopenVerified,independentProcessReopenVerified,originalUnchanged,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized')||
        r.kind!=='EXPORTED'||r.ok!==true||r.editedCiphertextVerified!==true||
        r.freshWorkerReopenVerified!==true||r.independentProcessReopenVerified!==false||r.originalUnchanged!==true||
        r.writerAuthorized!==false||r.nativeV3Verified!==false||
        r.originalOverwriteAuthorized!==false||
        typeof r.backupName!=='string'||typeof r.editedCopyName!=='string'||
        !/^[A-Za-z0-9._-]+\.p1g$/.test(r.backupName)||
        !/^[A-Za-z0-9._-]+\.p1g$/.test(r.editedCopyName)||
        same(r.backupName,r.editedCopyName)||same(r.editedCopyName,state.fileName))
        fail('EDITED_COPY_REOPEN_AND_NAME_DENIED');
      return set({phase:'exported',editedCopy:{name:r.editedCopyName,
        backupName:r.backupName,freshWorkerReopenVerified:true,independentProcessReopenVerified:false}});
    });
  };
  return Object.freeze({snapshot,open,backupAndRead,stage,undo,redo,
    exportEditedCopy,close,contract:DEV_AMOUNT_CONTRACT});
}
