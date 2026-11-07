// One OFF-by-default Owner-local module Worker; NEVER wired to production UI.
// Receives a File *handle* and a separate external-build claim, not decoded JSON.
// Fetches only locally generated Rust wasm-bindgen glue/WASM (no user data).
import init,{WorkerWasmSource} from '../../tests/stage-e/pkg/ddv_save_core.js';
import {createP1gRustWorkerReadOnlyBridge}
  from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {validateOwnerLocalSteamAttestation}
  from './attestation.mjs';
const maxEncryptedBytes=128*1024*1024;
const safeError=code=>Error(code);
const nativeBlobSize=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get;
const nativeBlobArrayBuffer=Blob.prototype.arrayBuffer;
const SHA_REGEX=/^[0-9a-f]{64}$/;
const hex=buffer=>[...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');
let generation=0;
let bridge=null;
let initPromise=null;
let lastSessionId=null;
const close=()=>{
  generation++;
  if(bridge)bridge.close();
};
async function ensureBridge(){
  if(!initPromise){
    initPromise=init(new URL('../../tests/stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url))
      .then(()=>{
        if(typeof WorkerWasmSource!=='function')
          throw safeError('OWNER_LOCAL_RUST_WASM_UNAVAILABLE');
        bridge=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource}));
        return bridge;
      }).catch(e=>{initPromise=null;throw e});
  }
  return initPromise;
}
export function installOwnerLocalSteamV1Worker({allowSyntheticFixture=false}={}){
  if(typeof document!=='undefined')
    throw safeError('OWNER_LOCAL_WORKER_ISOLATION_REQUIRED');
  self.addEventListener('message',async ({data})=>{
    if(!data||typeof data!=='object'||!Number.isSafeInteger(data.requestId)||
       data.requestId<1)return;
    const requestId=data.requestId;
    if(data.kind==='CLOSE_LOCAL_V1'){
      close();
      self.postMessage({requestId,ok:true,summary:{closed:true,writerAuthorized:false}});
      return;
    }
    if(data.kind!=='OPEN_LOCAL_V1')return;
    // Invalidate A synchronously BEFORE any awaits, even if B is invalid.
    const mine=++generation;
    if(bridge)bridge.close();
    let bytes;
    try{
      if(Object.keys(data).sort().join(',')!=='attestation,file,kind,requestId')
        throw safeError('OWNER_LOCAL_INPUT_FIELDS_DENIED');
      const attest=validateOwnerLocalSteamAttestation(data.attestation,
        {allowSyntheticFixture});
      if(!(data.file instanceof Blob))
        throw safeError('OWNER_LOCAL_FILE_SELECTION_REQUIRED');
      const size=nativeBlobSize.call(data.file);
      if(!Number.isSafeInteger(size)||size<=0||size>maxEncryptedBytes||
         size%16!==0)
        throw safeError('OWNER_LOCAL_ENCRYPTED_SIZE_DENIED');
      if(!globalThis.crypto?.subtle)
        throw safeError('OWNER_LOCAL_WEBCRYPTO_UNAVAILABLE');
      bytes=new Uint8Array(await nativeBlobArrayBuffer.call(data.file));
      if(mine!==generation)throw safeError('OWNER_LOCAL_OPEN_SUPERSEDED');
      if(bytes.byteLength!==size)
        throw safeError('OWNER_LOCAL_FILE_SIZE_CHANGED');
      const originalSha256=hex(await crypto.subtle.digest('SHA-256',bytes));
      if(mine!==generation)throw safeError('OWNER_LOCAL_OPEN_SUPERSEDED');
      if(!SHA_REGEX.test(originalSha256)||
         originalSha256!==attest.expectedOriginalSha256)
        throw safeError('OWNER_LOCAL_ORIGINAL_SHA_MISMATCH');
      const rust=await ensureBridge();
      if(mine!==generation)throw safeError('OWNER_LOCAL_OPEN_SUPERSEDED');
      const receipt=await rust.openEncrypted({
        build:attest.build,encryptedBytes:bytes
      });
      if(mine!==generation)throw safeError('OWNER_LOCAL_OPEN_SUPERSEDED');
      if(receipt.fullDocumentJsonValidated!==true||
         receipt.schema!==626||receipt.productReadAccepted!==false||
         receipt.writerAuthorized!==false||receipt.applyAuthorized!==false||
         receipt.editedCopyAuthorized!==false||
         receipt.allDomainReferencesVerified!==false||
         receipt.externalPhysicalBuildVerified!==false)
        throw safeError('OWNER_LOCAL_RUST_RECEIPT_DENIED');
      const rotated=lastSessionId!==null&&lastSessionId!==receipt.sessionId;
      lastSessionId=receipt.sessionId;
      // This bounded provenance receipt is displayed *locally only* and is
      // NEVER logged, persisted, POSTed, or sent to GitHub Actions.
      self.postMessage({
        requestId,ok:true,summary:Object.freeze({
          contract:'wand.owner.local.steam-p1g-rust-v1.receipt@1',
          sessionId:receipt.sessionId,revision:receipt.revision,
          indexGeneration:receipt.indexGeneration,schema:626,
          originalSourceSha256:originalSha256,
          decodedSha256:receipt.decodedSha256,
          originalSizeBytes:size,sourceShaMatched:true,
          fullDocumentJsonValidated:true,
          nativeReferenceClosureVerified:false,
          externallyAttestedBuildClaim:true,
          physicalBuildCryptographicallyVerified:false,
          evidenceKind:attest.evidenceKind,
          syntheticFixture:attest.synthetic,
          priorSessionRotated:rotated,
          productReadAccepted:false,writerAuthorized:false,
          editedCopyAuthorized:false,applyAuthorized:false,
          cloudUploadPerformed:false,originalFileModified:false
        })
      });
    }catch(e){
      // Never allow an older failed A to close successful B.
      if(mine===generation&&bridge)bridge.close();
      const msg=e instanceof Error?e.message:'';
      self.postMessage({requestId,ok:false,
        error:/^OWNER_LOCAL_[A-Z0-9_]+$/.test(msg)?msg:
          'OWNER_LOCAL_READ_ONLY_FAILED_CLOSED'});
    }finally{
      if(bytes)bytes.fill(0); // no save material written to disk by Worker
    }
  });
}
