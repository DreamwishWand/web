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
export function createP1gRustWorkerReadOnlyBridge(wasmFactory){
  // Constructor itself enforces Worker-only (document must be absent).
  const rust=createProductWasmReadOwner(wasmFactory);
  let epoch=0;
  const close=()=>{
    epoch++;
    return rust.close();
  };
  const openEncrypted=async args=>{
    // A is synchronously invalidated before validating/decoding B.
    const token=++epoch;
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
  return Object.freeze({
    openEncrypted,close,
    readCoreVersion:scope=>rust.readCoreVersion(scope),
    issueTypedCursor:(scope,domain)=>rust.issueTypedCursor(scope,domain),
    readTypedPage:(scope,cursor)=>rust.readTypedPage(scope,cursor),
    getReceipt:()=>rust.getReceipt(),
    getCapabilities:()=>Object.freeze({
      ...rust.getCapabilities(),
      p1gWorkerReadOnlyBridge:true,
      productReadAccepted:false,writerAuthorized:false,
      canReadTypedMetadataInProduct:false,
      canExportEditedCopy:false,canApply:false
    })
  });
}
