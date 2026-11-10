// W-CORE-004 / W-LOCAL-019 R04/R06/R22
// PRODUCT_LOCAL_ENCRYPTED_STEAM_P1G_SAME_RUST_WORKER_SAVED_DIFFGRIDS_READONLY_FACADE@1
// Worker-only message boundary, not a product UI route or another reader.
// The existing P1G Codec and existing single Rust ProductSession do ALL
// source decoding, Full-Document Validation, typed indexing and CAS.
import {createP1gRustWorkerReadOnlyBridge}
  from './p1g-rust-worker-readonly-bridge.mjs';

export const LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT =
  'wand.local.encrypted-steam-p1g.stored-diffgrids-readonly@1';
const MAX_ENCRYPTED_BYTES=128*1024*1024;
const shaRegex=/^[a-f0-9]{64}$/;
const nativeSize=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get;
const nativeArrayBuffer=Blob.prototype.arrayBuffer;
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>isPlain(x)&&
  Object.keys(x).sort().join(',')===fields.split(',').sort().join(',');
const denied=code=>{throw Error(code)};
const hex=a=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('');
const requestIdOk=x=>Number.isSafeInteger(x)&&x>=1;
const pageOk=x=>Number.isSafeInteger(x)&&x>=0&&x<=50000;
const selectionOk=x=>Number.isSafeInteger(x)&&x>=1;

/** Must be instantiated inside an isolated Worker with a statically imported
 * wasmFactory and external attestation validator, NEVER from a page message.
 * The validator is the accepted owner-local Steam FullVersion+original SHA
 * observer; its claim is NOT cryptographic proof of installed game Build.
 *
 * handleMessage(data,post) accepts ONLY local File/Blob OPEN, sequential
 * READ_NEXT, and CLOSE. No arbitrary UI token, Rust Session ID/Revision/SHA,
 * Rust cursor, readset, path, raw plaintext or full ObjectID arrays pass out.
 */
export function createLocalSteamP1gSavedDiffGridsFacade({
  wasmFactory,validateExternalAttestation,allowSyntheticFixture=false
}={}){
  if(typeof document!=='undefined')
    denied('LOCAL_DIFFGRIDS_WORKER_ISOLATION_REQUIRED');
  if(typeof wasmFactory!=='function'||typeof validateExternalAttestation!=='function'||
     typeof allowSyntheticFixture!=='boolean')
    denied('LOCAL_DIFFGRIDS_TRUSTED_DEPENDENCY_REQUIRED');
  const bridge=createP1gRustWorkerReadOnlyBridge(wasmFactory);
  let epoch=0,active=null,pendingOpenRequestId=null;
  const revoke=()=>{
    if(epoch===Number.MAX_SAFE_INTEGER)denied('LOCAL_DIFFGRIDS_EPOCH_BOUNDS');
    epoch++;
    active=null;
    pendingOpenRequestId=null;
    bridge.close();
  };
  const respond=(post,requestId,ok,body)=>{
    // Do not emit internal Rust receipts, SHA, paths, ciphertext, or error stack.
    if(ok)post({requestId,ok:true,summary:body});
    else post({requestId,ok:false,error:body});
  };
  const handleMessage=async(data,post)=>{
    if(!isPlain(data)||!requestIdOk(data.requestId)||typeof post!=='function')
      denied('LOCAL_DIFFGRIDS_MESSAGE_BOUNDS');
    const id=data.requestId;
    if(data.kind==='CLOSE_LOCAL_STORED_DIFFGRIDS'){
      // CLOSE during an in-flight OPEN has no issued selection yet. Require
      // the exact requestId of that pending OPEN so A's delayed CLOSE cannot
      // revoke a distinct newer B. No file/SessionID/Cursor enters the UI.
      const abortPending=exact(data,'kind,openRequestId,requestId,selection')&&
        data.selection===null&&!active&&
        pendingOpenRequestId!==null&&
        data.openRequestId===pendingOpenRequestId;
      const closeSelected=exact(data,'kind,requestId,selection')&&
        !!active&&data.selection===active.selection;
      if(!abortPending&&!closeSelected){
        respond(post,id,false,'LOCAL_DIFFGRIDS_STALE_SELECTION');
      }else{
        revoke();
        respond(post,id,true,Object.freeze({closed:true,writerAuthorized:false}));
      }
      return;
    }
    if(data.kind==='READ_LOCAL_STORED_DIFFGRIDS_NEXT'){
      if(!exact(data,'kind,pageIndex,requestId,selection')||
         !active||!selectionOk(data.selection)||
         active.selection!==data.selection||
         !pageOk(data.pageIndex)||data.pageIndex!==active.pageIndex||
         active.nextCursor===null){
        respond(post,id,false,'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
        return;
      }
      try{
        const page=bridge.readSavedDiffGridsPage(active.scope,active.nextCursor);
        if(page.records.length>8||page.externalLayoutStatus!=='UNRESOLVED_EXTERNAL_LAYOUT'||
           page.allNativeReferencesVerified!==false||
           page.productReadAccepted!==false||page.writerAuthorized!==false)
           denied('LOCAL_DIFFGRIDS_RUST_PAGE_AUTHORITY_DENIED');
        if(active.recordsRead+page.records.length>active.indexedRecords)
          denied('LOCAL_DIFFGRIDS_INDEX_COUNT_BOUNDS');
        const records=page.records.map(g=>Object.freeze({
          gridId:g.gridId,defaultLayoutGridId:g.defaultLayoutGridId,
          defaultGridHashCode:g.defaultGridHashCode,
          defaultGridDataHashCode:g.defaultGridDataHashCode,
          modifiedObjectCount:g.modifiedObjectCount,
          removedObjectCount:g.removedObjectCount,
          modifiedRemovedSameIdPairs:g.modifiedRemovedSameIdPairs,
          externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
          nativeEffectiveGridVerified:false
        }));
        active.recordsRead+=records.length;
        const nextPageIndex=page.nextCursor===null?null:active.pageIndex+1;
        if(nextPageIndex===null&&active.recordsRead!==active.indexedRecords)
          denied('LOCAL_DIFFGRIDS_INDEX_COUNT_MISMATCH');
        if(nextPageIndex!==null&&
           (page.records.length!==8||active.recordsRead>=active.indexedRecords))
          denied('LOCAL_DIFFGRIDS_NEXT_PAGE_BOUNDS');
        active.pageIndex++;
        active.nextCursor=page.nextCursor;
        respond(post,id,true,Object.freeze({
          contract:LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT,
          selection:data.selection,pageIndex:data.pageIndex,
          records:Object.freeze(records),nextPageIndex,
          externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
          allNativeReferencesVerified:false,productReadAccepted:false,
          nativeV3Verified:false,writerAuthorized:false,applyAuthorized:false,
          cloudUploadPerformed:false
        }));
      }catch{
        revoke();
        respond(post,id,false,'LOCAL_DIFFGRIDS_READ_FAILED_CLOSED');
      }
      return;
    }
    if(data.kind!=='OPEN_LOCAL_STORED_DIFFGRIDS'){
      respond(post,id,false,'LOCAL_DIFFGRIDS_OPERATION_DISABLED');
      return;
    }
    // A is invalidated SYNCHRONOUSLY before awaiting File/SHA/Codec/Rust B.
    revoke();
    const mine=epoch;
    pendingOpenRequestId=id;
    let bytes;
    try{
      if(!exact(data,'attestation,expectedEncryptedSizeBytes,file,kind,requestId'))
        denied('LOCAL_DIFFGRIDS_OPEN_ARGS_DENIED');
      const a=validateExternalAttestation(data.attestation,{allowSyntheticFixture});
      if(!a||a.build?.platform!=='steam-windows'||
         a.build?.buildKind!=='steam-full-version'||
         a.build?.schema!==626||a.build?.externallyConfirmed!==true||
         a.build?.buildId!=='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'||
         !shaRegex.test(a.expectedOriginalSha256))
         denied('LOCAL_DIFFGRIDS_EXACT_STEAM_BUILD_REQUIRED');
      if(!(data.file instanceof Blob))
        denied('LOCAL_DIFFGRIDS_EXPLICIT_LOCAL_FILE_REQUIRED');
      const size=nativeSize.call(data.file);
      if(!Number.isSafeInteger(size)||size<16||size>MAX_ENCRYPTED_BYTES||
         size%16!==0||data.expectedEncryptedSizeBytes!==size)
         denied('LOCAL_DIFFGRIDS_ORIGINAL_SIZE_MISMATCH');
      if(!globalThis.crypto?.subtle)
        denied('LOCAL_DIFFGRIDS_WEBCRYPTO_REQUIRED');
      bytes=new Uint8Array(await nativeArrayBuffer.call(data.file));
      if(epoch!==mine)denied('LOCAL_DIFFGRIDS_OPEN_SUPERSEDED');
      if(bytes.length!==size)denied('LOCAL_DIFFGRIDS_ORIGINAL_SIZE_CHANGED');
      const sourceSha=hex(await crypto.subtle.digest('SHA-256',bytes));
      if(epoch!==mine)denied('LOCAL_DIFFGRIDS_OPEN_SUPERSEDED');
      if(sourceSha!==a.expectedOriginalSha256)
        denied('LOCAL_DIFFGRIDS_ORIGINAL_SHA_MISMATCH');
      const receipt=await bridge.openEncrypted({build:a.build,encryptedBytes:bytes});
      if(epoch!==mine)denied('LOCAL_DIFFGRIDS_OPEN_SUPERSEDED');
      if(receipt.fullDocumentJsonValidated!==true||receipt.schema!==626||
         receipt.productWorkerBound!==true||
         receipt.productReadAccepted!==false||
         receipt.allDomainReferencesVerified!==false||
         receipt.writerAuthorized!==false||receipt.applyAuthorized!==false||
         receipt.editedCopyAuthorized!==false)
        denied('LOCAL_DIFFGRIDS_RUST_RECEIPT_DENIED');
      const scope={sessionId:receipt.sessionId,revision:receipt.revision,
        indexGeneration:receipt.indexGeneration,
        decodedSha256:receipt.decodedSha256};
      const issued=bridge.issueSavedDiffGridsCursor(scope);
      if(epoch!==mine)denied('LOCAL_DIFFGRIDS_OPEN_SUPERSEDED');
      if(!Number.isSafeInteger(issued.indexedRecords)||
         issued.indexedRecords<0||issued.indexedRecords>50000||
         issued.maxRecordsPerPage!==8||issued.productReadAccepted!==false||
         issued.writerAuthorized!==false)
        denied('LOCAL_DIFFGRIDS_INDEX_RECEIPT_DENIED');
      active={selection:mine,scope,nextCursor:issued.cursor,
        pageIndex:0,indexedRecords:issued.indexedRecords,recordsRead:0};
      pendingOpenRequestId=null;
      // This opaque local selection is only a UI response epoch fence, NOT
      // Rust SessionID, Reader Cursor, CAS token, SHA or permission grant.
      respond(post,id,true,Object.freeze({
        contract:LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT,
        selection:mine,recordCount:issued.indexedRecords,maxRecordsPerPage:8,
        nextPageIndex:0,sourceShaMatched:true,originalSizeMatched:true,
        externallyObservedSteamFullVersion:true,
        physicalBuildCryptographicallyVerified:false,
        fullDocumentValidated:true,
        externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
        allNativeReferencesVerified:false,productReadAccepted:false,
        nativeV3Verified:false,writerAuthorized:false,
        applyAuthorized:false,cloudUploadPerformed:false,
        originalFileModified:false
      }));
    }catch(e){
      if(mine===epoch)revoke();
      const code=e instanceof Error?e.message:'';
      // No exception stack or private Codec/ZIP details on the page.
      respond(post,id,false,code==='LOCAL_DIFFGRIDS_OPEN_SUPERSEDED'?
        'LOCAL_DIFFGRIDS_OPEN_SUPERSEDED':'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
    }finally{
      if(bytes)bytes.fill(0);
    }
  };
  return Object.freeze({handleMessage,
    close:()=>{revoke();return Object.freeze({closed:true,writerAuthorized:false})}});
}


/** Explicit Worker-side opt-in registration. No production route/UI imports
 * this automatically. A future read-only consumer can install it in the
 * EXISTING isolated Worker, rather than creating a second executor.
 * The only public wire messages are OPEN/READ_NEXT/CLOSE, with bounded replies.
 */
export function installLocalSteamP1gSavedDiffGridsWorker(options){
  if(typeof document!=='undefined'||typeof self?.addEventListener!=='function'||
     typeof self?.postMessage!=='function')
    denied('LOCAL_DIFFGRIDS_WORKER_ISOLATION_REQUIRED');
  const facade=createLocalSteamP1gSavedDiffGridsFacade(options);
  const kinds=new Set(['OPEN_LOCAL_STORED_DIFFGRIDS',
    'READ_LOCAL_STORED_DIFFGRIDS_NEXT','CLOSE_LOCAL_STORED_DIFFGRIDS']);
  const listener=event=>{
    const data=event?.data;
    if(!data||!kinds.has(data.kind))return;
    void facade.handleMessage(data,reply=>self.postMessage(reply)).catch(()=>{
      // Generic code only; never leak file path, crypto/ZIP error, Save bytes,
      // Rust SessionID/Cursor/readset or JavaScript exception stack.
      if(requestIdOk(data?.requestId))self.postMessage({
        requestId:data.requestId,ok:false,
        error:'LOCAL_DIFFGRIDS_MESSAGE_DENIED'
      });
    });
  };
  self.addEventListener('message',listener);
  return Object.freeze({close:()=>{
    self.removeEventListener('message',listener);
    facade.close();
    return Object.freeze({closed:true,writerAuthorized:false});
  }});
}
