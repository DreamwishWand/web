// W-CORE-004 / W-LOCAL-019: optional Worker-ONLY P1G -> existing single
// Rust ProductSession READ_METADATA bridge. No second codec, session, reader,
// Writer, filesystem path, network, Cloud or UI Save payload response.
// DEV_READY synthetic testing only. Not imported by production Worker/UI.
import {p1gPackagedProfileCodec} from './p1g-packaged-profile-codec.js';
import {
  createProductWasmReadOwner,
  PRODUCT_WASM_CHUNK_MAX_BYTES,
  PRODUCT_WASM_WORKER_MAX_BYTES
} from './product-wasm-read-owner.mjs';

const MAX_ENCRYPTED_BYTES=128*1024*1024;
const MAX_TEXT_CODE_UNITS=Math.floor(PRODUCT_WASM_CHUNK_MAX_BYTES/3)-1;
const utf8=new TextEncoder();
const fail=code=>{throw Error(code)};
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&
  !Array.isArray(obj)&&Object.keys(obj).sort().join(',')===keys.split(',').sort().join(',');

// TextEncoder.encode on <=349,524 UTF-16 code units yields <=1MiB bytes,
// even for unknown multibyte text. Do not split a surrogate pair across chunks.
// No full UTF-8 re-encoding/JSON object clone or postMessage to UI.
async function* decodedUtf8Chunks(text){
  if(typeof text!=='string'||text.length===0)fail('P1G_WORKER_DECODED_TEXT_REQUIRED');
  let offset=0,total=0;
  while(offset<text.length){
    let end=Math.min(text.length,offset+MAX_TEXT_CODE_UNITS);
    if(end<text.length){
      const last=text.charCodeAt(end-1);
      if(last>=0xD800&&last<=0xDBFF)end--;
    }
    if(end<=offset)fail('P1G_WORKER_UTF8_BOUNDARY');
    const chunk=utf8.encode(text.slice(offset,end));
    if(chunk.length===0||chunk.length>PRODUCT_WASM_CHUNK_MAX_BYTES)
      fail('P1G_WORKER_UTF8_CHUNK_BOUNDS');
    total+=chunk.length;
    if(total>PRODUCT_WASM_WORKER_MAX_BYTES)
      fail('P1G_WORKER_DECODED_SIZE_DENIED');
    yield chunk;
    offset=end;
  }
}
export function createP1gRustWorkerReadOnlyBridge(wasmFactory,{
  allowDevSemanticWriter=false,verifyDurableBackupDev=null
}={}){
  // Constructor itself enforces Worker-only (document must be absent).
  if(typeof allowDevSemanticWriter!=='boolean'||
    (allowDevSemanticWriter&&typeof verifyDurableBackupDev!=='function'))
    fail('P1G_WORKER_DEV_TRUSTED_BACKUP_REQUIRED');
  const rust=createProductWasmReadOwner(wasmFactory,{allowDevSemanticWriter});
  let devOriginal=null;
  const clearDev=()=>{
    if(devOriginal?.bytes)devOriginal.bytes.fill(0);
    devOriginal=null;
  };
  const hex=bytes=>[...new Uint8Array(bytes)]
    .map(v=>v.toString(16).padStart(2,'0')).join('');
  const hash=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
  let epoch=0;
  const close=()=>{
    epoch++;
    clearDev();
    return rust.close();
  };
  const openEncrypted=async args=>{
    // A is synchronously invalidated before validating/decoding B.
    const token=++epoch;
    clearDev();
    rust.close();
    if(!exact(args,'build,encryptedBytes')||
       !(args.encryptedBytes instanceof Uint8Array)||
       args.encryptedBytes.byteLength===0||
       args.encryptedBytes.byteLength>MAX_ENCRYPTED_BYTES)
       fail('P1G_WORKER_INPUT_DENIED');
    const {build,encryptedBytes}=args;
    // This is an EXTERNAL candidate claim, never inferred from P1G schema.
    if(!build||build.externallyConfirmed!==true||build.schema!==626)
      fail('P1G_WORKER_EXTERNAL_BUILD_REQUIRED');
    const isolated=new Uint8Array(encryptedBytes);
    try{
      const decoded=await p1gPackagedProfileCodec.loadProfile(isolated);
      if(token!==epoch)fail('P1G_WORKER_OPEN_REVOKED');
      if(decoded.metadata?.profileVersion!==626)
        fail('P1G_WORKER_PROFILE_SCHEMA_MISMATCH');
      // Only the existing Rust owner creates/mints the authoritative
      // ProductSession and performs strict whole-document validation.
      const receipt=await rust.openDecoded({
        build,decodedChunks:decodedUtf8Chunks(decoded.jsonText)
      });
      if(token!==epoch)fail('P1G_WORKER_OPEN_REVOKED');
      if(receipt.schema!==626||
         receipt.fullDocumentJsonValidated!==true||
         receipt.allDomainReferencesVerified!==false||
         receipt.productReadAccepted!==false||
         receipt.writerAuthorized!==false||
         receipt.editedCopyAuthorized!==false||
         receipt.applyAuthorized!==false){
         close();
         fail('P1G_WORKER_RUST_GATE_VIOLATION');
      }
      if(allowDevSemanticWriter){
        const initialDecodedSha=await hash(new TextEncoder().encode(decoded.jsonText));
        if(initialDecodedSha!==receipt.decodedSha256)
          fail('P1G_WORKER_DEV_INITIAL_DECODED_HASH_MISMATCH');
        devOriginal={
          bytes:new Uint8Array(isolated),
          encryptedSha256:await hash(isolated),
          encryptedSizeBytes:isolated.length,
          codecMetadata:decoded.metadata,
          originalDecodedSha256:receipt.decodedSha256,
          token
        };
        if(token!==epoch){clearDev();fail('P1G_WORKER_DEV_OPEN_REVOKED');}
      }
      return Object.freeze({
        ...receipt,
        decodedByExistingP1gCodec:true,
        sourceOperation:'DEV_READY_READ_ONLY',
        externalPhysicalBuildVerified:false
      });
    }catch(e){
      // A's stale rejection must never kill newer B.
      if(token===epoch)rust.close();
      if(e instanceof Error&&(/^P1G_WORKER_|^PRODUCT_WORKER_/).test(e.message))
        throw e;
      fail('P1G_WORKER_CODEC_OR_RUST_REJECTED');
    }finally{
      isolated.fill(0); // never zero the caller's original bytes
    }
  };

  // The trusted local DEV executor binds durable original backup verification.
  // UI postMessage never reaches these methods. Export produces ONLY bytes
  // for a separately named file; it cannot replace the original.
  const devSource=()=>{
    if(!allowDevSemanticWriter||!devOriginal||devOriginal.token!==epoch)
      fail('P1G_WORKER_DEV_SESSION_OFF');
    return devOriginal;
  };
  const devStageTypedAmounts=(scope,commands)=>{
    devSource();return rust.devStageTypedAmounts(scope,commands);
  };
  const devUndoTypedAmounts=scope=>{
    devSource();return rust.devUndoTypedAmounts(scope);
  };
  const devRedoTypedAmounts=scope=>{
    devSource();return rust.devRedoTypedAmounts(scope);
  };
  const devCreateEncodedEditedOnce=async scope=>{
    const original=devSource();
    const token=epoch;
    // The caller must provide a trusted Worker-local backup persister which
    // uses create-new, fsync/readback and cryptographic SHA+Size. Merely
    // supplying a UI boolean or pathname is not accepted here.
    let receipt;
    try{
      receipt=await verifyDurableBackupDev({
        originalBytes:new Uint8Array(original.bytes),
        originalEncryptedSha256:original.encryptedSha256,
        originalEncryptedSizeBytes:original.encryptedSizeBytes
      });
    }catch{fail('P1G_WORKER_DEV_BACKUP_REJECTED')}
    if(epoch!==token)fail('P1G_WORKER_DEV_BACKUP_STALE');
    if(!receipt||receipt.backupReadbackVerified!==true||
       receipt.sha256!==original.encryptedSha256||
       receipt.sizeBytes!==original.encryptedSizeBytes||
       receipt.editedCopyWillUseDifferentName!==true)
      fail('P1G_WORKER_DEV_BACKUP_NOT_CONFIRMED');
    const edited=rust.devTakeDecodedEditedOnce(scope);
    if(epoch!==token)fail('P1G_WORKER_DEV_EXPORT_STALE');
    const decodedHash=await hash(new TextEncoder().encode(edited.jsonText));
    if(decodedHash!==edited.stagedDecodedSha256||
       decodedHash===original.originalDecodedSha256)
      fail('P1G_WORKER_DEV_RUST_SHA_MISMATCH');
    const ciphertext=await p1gPackagedProfileCodec.createEncodedProfile(
      edited.jsonText,original.codecMetadata);
    const reopened=await p1gPackagedProfileCodec.loadProfile(ciphertext);
    if(reopened.jsonText!==edited.jsonText||
       await hash(new TextEncoder().encode(reopened.jsonText))!==decodedHash)
      fail('P1G_WORKER_DEV_CODEC_EXACT_REOPEN_FAILED');
    if(epoch!==token)fail('P1G_WORKER_DEV_EXPORT_STALE');
    const result=Object.freeze({
      contract:'wand.dev.p1g.typed-edited-copy@1',
      editedCiphertext:ciphertext,
      editedSha256:await hash(ciphertext),
      editedSizeBytes:ciphertext.length,
      originalSha256:original.encryptedSha256,
      stagedDecodedSha256:decodedHash,
      writerAuthorized:false,nativeV3Verified:false,
      originalOverwriteAuthorized:false,
      // Same-Worker Codec self-check only. Independent PROCESS evidence
      // remains a separate 05 QR-L operation-specific acceptance gate.
      independentProcessReopenVerified:false
    });
    clearDev();
    return result;
  };
  return Object.freeze({
    openEncrypted,close,
    readCoreVersion:scope=>rust.readCoreVersion(scope),
    issueTypedCursor:(scope,domain)=>rust.issueTypedCursor(scope,domain),
    readTypedPage:(scope,cursor)=>rust.readTypedPage(scope,cursor),
    // Internal Worker-only, sanitized Rust-sourced stored metadata; no raw body.
    issueSavedDiffGridsCursor:scope=>rust.issueSavedDiffGridsCursor(scope),
    readSavedDiffGridsPage:(scope,cursor)=>rust.readSavedDiffGridsPage(scope,cursor),
    getReceipt:()=>rust.getReceipt(),
    ...(allowDevSemanticWriter?{
      devStageTypedAmounts,devUndoTypedAmounts,devRedoTypedAmounts,
      devCreateEncodedEditedOnce
    }:{}),
    getCapabilities:()=>Object.freeze({
      ...rust.getCapabilities(),
      p1gWorkerReadOnlyBridge:true,
      productReadAccepted:false,writerAuthorized:false,
      canReadTypedMetadataInProduct:false,
      canExportEditedCopy:false,canApply:false
    })
  });
}
