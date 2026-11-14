// Wand-owned LOCAL Single SaveSession owner: one Worker, one active source,
// shared by routes in the SAME browser tab. No cloud, decoded save or key in UI.
// The Worker alone mints Session IDs, cursor HMACs and read provenance.
// This is not the Rust product Writer, and has no edit/encode/export commands.
export const SINGLE_SAVESESSION_CONTRACT = 'wand.local.save-session.read@1';
export const LOCAL_MAX_P1G_BYTES = 128 * 1024 * 1024;
export const LOCAL_SWITCH_BID = '9A239D3DB569756D';
export const LOCAL_SWITCH_FULL_VERSION = '1.25.3';
export const LOCAL_SWITCH_SCHEMA = 626;
const freeze = value => Object.freeze(value);
import {requestOriginalByteBackup,compareOriginalBackupBytes} from './local-original-backup.mjs';
const READ_CAPABILITIES = freeze({
  contract:SINGLE_SAVESESSION_CONTRACT,
  sessionOwner:'worker-singleton',
  readW1RecurringEvents:true,
  readInventory:false,readOwnership:false,readGrid:false,
  readCompleteAllDomains:false,
  uiW1IntentPreview:false, // separate UI proposal, not a trusted edit
  nativeSemanticsW1Verified:false,
  sourceCoreWriterAccepted:false,
  canCommit:false,canEncodeEditedCopy:false,
  canApply:false,canReplaceOriginal:false,
  maxCiphertextBytes:LOCAL_MAX_P1G_BYTES,
  maximumExpandedBytes:LOCAL_MAX_P1G_BYTES,
  supportedPlatform:'switch',
  supportedFullVersion:LOCAL_SWITCH_FULL_VERSION,
  supportedBID:LOCAL_SWITCH_BID,
  supportedSchema:LOCAL_SWITCH_SCHEMA
});
const safeResult=(result,expected) => {
  if(!result||typeof result!=='object'||result.writerAuthorized!==false||
     result.productRustWorkerAccepted!==false||result.sourceSchema!==626||
     result.sourcePlatform!=='switch'||result.externalFullVersion!==LOCAL_SWITCH_FULL_VERSION||
     result.externalBID!==LOCAL_SWITCH_BID||
     !/^[a-f0-9]{32}$/.test(result.sessionId) ||
     !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
     !/^[a-f0-9]{64}$/.test(result.registrySha256) ||
     !Number.isSafeInteger(result.revision)||result.revision!==0||
     !Number.isSafeInteger(result.indexGeneration)||result.indexGeneration<1)
    throw Error('LOCAL_SESSION_WORKER_RECEIPT_INVALID');
  // A verified external BID must not be inferred from schema or P1G bytes.
  return freeze({
    contract:SINGLE_SAVESESSION_CONTRACT,
    platform:expected.platform,fullVersion:expected.fullVersion,
    buildKind:expected.buildKind,buildId:expected.buildId,schema:626,
    sourceIdentity:'externally-attested-switch-bid',
    sourceFileName:expected.fileName,
    sessionId:result.sessionId,revision:result.revision,
    indexGeneration:result.indexGeneration,
    sourceSha256:result.sourceSha256,
    registrySha256:result.registrySha256,
    savedContainerCount:result.savedContainerCount,
    unsupportedContainerCount:result.unsupportedContainerCount,
    indexedRoots:freeze(['World.RecurringEvents']),
    completeStructuralRead:true, // established strict JSON codec full source parse
    completeAllDomainIndexes:false,
    completeNativeReferenceClosure:false,
    writerAuthorized:false,productRustWorkerAccepted:false
  });
};
const validateBuild=att => {
  if(!att||att.platform!=='switch'||att.fullVersion!==LOCAL_SWITCH_FULL_VERSION||
     att.buildKind!=='switch-bid'||att.buildId!==LOCAL_SWITCH_BID||
     att.schema!==LOCAL_SWITCH_SCHEMA||att.externallyConfirmed!==true)
    throw Error('LOCAL_BUILD_VERSION_BID_SCHEMA_DENIED');
};
export function createLocalSaveSessionBridge(workerFactory){
  if(typeof workerFactory!=='function')throw Error('LOCAL_WORKER_FACTORY_MISSING');
  let worker=null,readyPromise=null,readyResolve,readyReject,ready=false;
  let id=0,epoch=0,receipt=null,originalSelectedFile=null;
  const pending=new Map(),subscribers=new Set();
  const notify=()=>{for(const listener of subscribers){
    try{listener(freeze({ready,receipt,capabilities:READ_CAPABILITIES}));}catch{}
  }};
  const cancelPending=code=>{
    for(const p of pending.values())p.reject(Error(code));
    pending.clear();
  };
  const handleMessage=e=>{
    const m=e.data;
    if(!m||!Number.isSafeInteger(m.id))return;
    if(m.id===0) {
      if(m.ready===true&&m.writerAuthorized===false&&m.productRustWorkerAccepted!==true){
        ready=true;readyResolve?.();notify();
      } else {readyReject?.(Error('LOCAL_WORKER_HANDSHAKE_INVALID')); }
      return;
    }
    const p=pending.get(m.id);if(!p)return;
    pending.delete(m.id);
    if(m.ok===true)p.resolve(m.result);
    else p.reject(Error(typeof m.error==='string'&&/^READ_[A-Z0-9_]+$/.test(m.error)
      ?m.error:'LOCAL_WORKER_REJECTED'));
  };
  const workerError=()=>{
    ready=false;receipt=null;originalSelectedFile=null;++epoch;
    cancelPending('LOCAL_WORKER_RUNTIME_ERROR');
    readyReject?.(Error('LOCAL_WORKER_RUNTIME_ERROR'));
    notify();
  };
  const ensureReady=()=>{
    if(!worker){
      try {
        worker=workerFactory();
        readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
        worker.addEventListener('message',handleMessage);
        worker.addEventListener('error',workerError);
        worker.addEventListener('messageerror',workerError);
      }catch{workerError();return Promise.reject(Error('LOCAL_WORKER_UNAVAILABLE'));}
    }
    return ready?Promise.resolve():readyPromise;
  };
  const request=async(type,payload={})=>{
    await ensureReady();
    if(!ready||!worker)throw Error('LOCAL_WORKER_NOT_READY');
    const requestId=++id;
    return new Promise((resolve,reject)=>{
      pending.set(requestId,{resolve,reject});
      try{worker.postMessage({id:requestId,type,...payload});}
      catch{pending.delete(requestId);reject(Error('LOCAL_WORKER_MESSAGE_FAILED'));}
    });
  };
  const close=async()=>{
    const token=++epoch;
    receipt=null;originalSelectedFile=null;notify();
    const response=await request('CLOSE');
    if(token!==epoch)throw Error('LOCAL_SESSION_STALE_CLOSE');
    if(response?.writerAuthorized!==false||response?.closed!==true)
      throw Error('LOCAL_WORKER_CLOSE_REJECTED');
    return freeze({closed:true,writerAuthorized:false});
  };
  const openLocalFile=async(file,attestation)=>{
    // IMPORTANT: release A before any validation, await, or B decode.
    const token=++epoch;
    receipt=null;originalSelectedFile=null;notify();
    await request('CLOSE');
    if(token!==epoch)throw Error('LOCAL_SESSION_STALE_OPEN');
    validateBuild(attestation);
    if(!(file instanceof Blob)||file.size===0||file.size>LOCAL_MAX_P1G_BYTES)
      throw Error('LOCAL_FILE_BOUNDS');
    const workerResult=await request('OPEN_FILE',{
      file,buildId:attestation.buildId,sourceConfirmed:true,
      platform:attestation.platform,fullVersion:attestation.fullVersion,
      buildKind:attestation.buildKind,sourceSchema:attestation.schema
    });
    if(token!==epoch)throw Error('LOCAL_SESSION_STALE_OPEN');
    const safe=safeResult(workerResult,{...attestation,fileName:file.name||'profile'});
    originalSelectedFile=file;receipt=safe;notify();
    return safe;
  };
  const queryW1Page=async({search='',cursor=null,limit=64}={})=>{
    const active=receipt;
    if(!active)throw Error('LOCAL_SESSION_NOT_OPEN');
    if(typeof search!=='string'||search.length>120||
       (cursor!==null&&(typeof cursor!=='string'||cursor.length>160))||
       !Number.isSafeInteger(limit)||limit<1||limit>64)
      throw Error('LOCAL_QUERY_BOUNDS');
    const result=await request('QUERY',{search,cursor,limit});
    if(receipt!==active)throw Error('LOCAL_QUERY_STALE_SESSION');
    if(result?.sessionId!==active.sessionId||
       result?.sourceSha256!==active.sourceSha256||
       result?.revision!==active.revision||
       result?.indexGeneration!==active.indexGeneration||
       result?.writerAuthorized!==false||result?.productRustWorkerAccepted!==false||
       !Array.isArray(result.rows)||result.rows.length>limit||
       !Number.isSafeInteger(result.total)||result.total<result.rows.length ||
       typeof result.complete!=='boolean')
      throw Error('LOCAL_WORKER_PAGE_SCOPE_INVALID');
    return freeze({...result,rows:freeze(result.rows.map(x=>freeze({...x})))});
  };
  // Domain-scoped read facade for Collection/Item Detail/Spatial consumers.
  // W1 is the ONLY accepted domain; every other source-backed domain fails
  // closed without asking the Worker for raw Save or a speculative projection.
  // Caller metadata is a stale-response scope fence, never authorization.
  const readDomainPage=async query=>{
    const s=receipt;
    if(!s)throw Error('LOCAL_SESSION_NOT_OPEN');
    if(!query||typeof query!=='object'||query.sessionId!==s.sessionId||
       query.sourceSha256!==s.sourceSha256||
       query.revision!==s.revision||
       query.indexGeneration!==s.indexGeneration)
      throw Error('LOCAL_READ_STALE_SOURCE_SCOPE');
    if(query.domain!=='RecurringEvents')
      throw Error('LOCAL_READ_CAPABILITY_NOT_ACCEPTED');
    return queryW1Page({search:query.search??'',cursor:query.cursor??null,
      limit:query.limit??64});
  };
  // Retain only the original user-selected File handle, not a decoded JSON
  // copy or a transferable raw P1G. Explicit user click may request a local
  // download even after a SPA route change. This is NOT persistence proof.
  const diagnoseW1Dependencies=async scope=>{
    const s=receipt;
    if(!s)throw Error('LOCAL_SESSION_NOT_OPEN');
    // No caller-supplied read-set, flags, registry, or native assertion may
    // enter the Worker. Only the currently active immutable scope is accepted.
    const keys=['sessionId','sourceSha256','revision','indexGeneration'];
    if(!scope||typeof scope!=='object'||Object.keys(scope).some(k=>!keys.includes(k))||
       scope.sessionId!==s.sessionId||scope.sourceSha256!==s.sourceSha256||
       scope.revision!==s.revision||scope.indexGeneration!==s.indexGeneration)
      throw Error('LOCAL_W1_DIAGNOSTIC_STALE_OR_FORGED_SCOPE');
    const result=await request('DIAGNOSE_W1');
    if(receipt!==s||result?.sessionId!==s.sessionId||
       result?.sourceSha256!==s.sourceSha256||result?.revision!==s.revision||
       result?.indexGeneration!==s.indexGeneration||
       result?.contract!=='wand.local.w1-core-source-readset@1'||
       result?.operation!=='W1_ITEMSPAWNING_NEXT_OCCURRENCE_DIAGNOSTIC'||
       result?.referenceCount!==8||!Number.isInteger(result?.presentCount)||
       result.presentCount<0||result.presentCount>8||
       !Array.isArray(result?.missingReferences)||
       result.missingReferences.length+result.presentCount!==8||
       result.allSourceReferencesPresent!==(result.missingReferences.length===0)||
       result.missingReferences.some(x=>typeof x!=='string'||x.length>120)||
       result.sameBuildNativeRegistryAccepted!==false||
       result.effectiveWorldDependenciesVerified!==false||
       result.clockActualizeVerified!==false||
       result.completeNativeDependencyClosureVerified!==false||
       result.operationWriterAuthorized!==false||
       result.writerAuthorized!==false||result.productRustWorkerAccepted!==false)
      throw Error('LOCAL_W1_DIAGNOSTIC_INVALID_OR_STALE');
    return freeze({...result,missingReferences:freeze([...result.missingReferences])});
  };
  const hasUntouchedOriginalBackupSource=scope=>
    Boolean(originalSelectedFile&&receipt&&scope?.sessionId===receipt.sessionId
      &&scope?.sourceSha256===receipt.sourceSha256);
  const requestUntouchedOriginalBackup=scope=>{
    if(!hasUntouchedOriginalBackupSource(scope))
      throw Error('LOCAL_ORIGINAL_BACKUP_STALE_OR_UNAVAILABLE');
    requestOriginalByteBackup(originalSelectedFile);
    return freeze({downloadRequested:true,persistedVerified:false,
      sourceSha256:receipt.sourceSha256,writerAuthorized:false});
  };
  // Explicit user-reimported backup CANDIDATE comparison. Reads two
  // small independent chunks at a time: never posts P1G or decoded Save,
  // never hashes/loads another 128MiB full-buffer copy in the UI.
  // This proves the chosen Blob's BYTES equal the trusted Worker-opened
  // original; it CANNOT prove the OS persisted a distinct backup path.
  const verifyUserSelectedOriginalBackupCandidate=async (candidate,scope)=>{
    const active=receipt,original=originalSelectedFile,activeEpoch=epoch;
    const keys=['sessionId','sourceSha256','revision','indexGeneration'];
    if(!active||!(original instanceof Blob)||!scope||
       typeof scope!=='object'||Object.keys(scope).some(k=>!keys.includes(k))||
       scope.sessionId!==active.sessionId||
       scope.sourceSha256!==active.sourceSha256||
       scope.revision!==active.revision||
       scope.indexGeneration!==active.indexGeneration)
      throw Error('LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE');
    const current=()=>receipt===active&&originalSelectedFile===original&&epoch===activeEpoch;
    const originalBytes=await compareOriginalBackupBytes(original,candidate,current,LOCAL_MAX_P1G_BYTES);
    if(!current())throw Error('LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED');
    return freeze({
      candidateBytesMatchOriginal:true,
      sourceSha256:active.sourceSha256,comparedByteCount:originalBytes,
      sourceRevision:active.revision,indexGeneration:active.indexGeneration,
      persistedVerified:false,distinctDiskPathVerified:false,
      originalOverwriteProtectionVerified:false,writerAuthorized:false
    });
  };
  const getSession=()=>receipt;
  const getCapabilities=()=>READ_CAPABILITIES;
  const subscribe=listener=>{
    if(typeof listener!=='function')throw Error('LOCAL_SUBSCRIBER_INVALID');
    subscribers.add(listener);
    listener(freeze({ready,receipt,capabilities:READ_CAPABILITIES}));
    return ()=>subscribers.delete(listener);
  };
  const submitOperation=async command=>{
    // Explicitly deny ALL typed edit commands until Rust Core V0–V3, independent
    // QA, immutable original-first verified export and 00 CTRL operation gate.
    if(!command||typeof command!=='object'||typeof command.kind!=='string')
      throw Error('LOCAL_COMMAND_INVALID');
    throw Error('LOCAL_OPERATION_WRITER_NOT_ACCEPTED');
  };
  const destroy=()=>{
    ++epoch;receipt=null;originalSelectedFile=null;ready=false;
    cancelPending('LOCAL_SESSION_DESTROYED');
    readyReject?.(Error('LOCAL_SESSION_DESTROYED'));
    worker?.terminate();
    worker=null;readyPromise=null;readyResolve=null;readyReject=null;
    notify();
  };
  return freeze({ensureReady,openLocalFile,queryW1Page,readDomainPage,
    diagnoseW1Dependencies,
    hasUntouchedOriginalBackupSource,requestUntouchedOriginalBackup,
    verifyUserSelectedOriginalBackupCandidate,close,getSession,
    getCapabilities,subscribe,submitOperation,destroy});
}
// One shared owner per JS module instance/tab; deliberately no localStorage or
// Cloud backup. SvelteKit route changes must never terminate this Worker.
let shared=null;
export const getSingleSaveSessionBridge=factory=>{
  if(!shared)shared=createLocalSaveSessionBridge(factory);
  return shared;
};
