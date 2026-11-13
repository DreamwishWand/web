// 01A CORE R22 – candidate source-pinned JS + WASM loader.
// No product UI invokes this. This is NOT signature verification.
// Actual production enablement requires separate authentic provenance/Owner QA.
const fail=code=>{throw Error('R22_WASM_CANDIDATE_'+code)};
const hex64=/^[a-f0-9]{64}$/;
const hex40=/^[a-f0-9]{40}$/;
const exact=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join(',')===names.split(',').sort().join(',');
const sha256=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(x=>x.toString(16).padStart(2,'0')).join('');
const strictSize=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;
const version='wand.r22.rust-wasm-source-provenance-candidate@1';
// The protected release lock is the previously reviewed exact dependency set.
// Historical synthetic candidates retain their generated-lock contract.
const approvedCargoLockSha256='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
function validCargoLockProvenance(source){
 return source?.cargoLockOrigin==='cargo-generated-this-ci-job'||
  (source?.cargoLockOrigin==='approved-repository-lock'&&
   source.cargoLockSha256===approvedCargoLockSha256);
}

function baseRoute(basePath){
 if(basePath!==''&&basePath!=='/web')fail('UNSUPPORTED_BASE_PATH');
 const where=self.location;
 if(!where||!/^https?:$/.test(where.protocol)||
   (where.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(where.hostname)))
   fail('HTTPS_OR_LOCALHOST_REQUIRED');
 if(basePath&&!where.pathname.startsWith(basePath+'/'))
   fail('WORKER_OUTSIDE_BASE_PATH');
 return new URL(where.origin+basePath+'/worker-wasm/');
}

async function checkedFetch(url,length,digest,contentType,fetcher){
 if(!strictSize(length,contentType==='application/wasm'?20*1024*1024:2*1024*1024)||
    !hex64.test(digest))fail('PIN_BOUNDS');
 let reply;
 try{
  reply=await fetcher(url.href,{cache:'no-store',redirect:'error',
    credentials:'same-origin',mode:'same-origin'});
 }catch{fail('SAME_ORIGIN_ASSET_FETCH_DENIED')}
 if(!reply||!reply.ok||reply.status!==200||reply.redirected||
    reply.url!==url.href||reply.type!=='basic')
   fail('ASSET_ORIGIN_STATUS_REDIRECT');
 const mime=reply.headers?.get?.('content-type')?.split(';')[0]?.trim();
 const safeJsMime=contentType==='text/javascript'&&
   (mime==='text/javascript'||mime==='application/javascript');
 if(!safeJsMime&&mime!==contentType)fail('ASSET_CONTENT_TYPE');
 let bytes;
 try{bytes=new Uint8Array(await reply.arrayBuffer())}
 catch{fail('ASSET_READ_FAILED')}
 if(bytes.length!==length||!strictSize(bytes.length,
   contentType==='application/wasm'?20*1024*1024:2*1024*1024))
   fail('ASSET_LENGTH_MISMATCH');
 if(await sha256(bytes)!==digest)fail('ASSET_SHA256_MISMATCH');
 return bytes;
}

/** QA candidate only. trustedPins MUST be independently pinned into
 * a trusted Worker module, NEVER taken from a fetched manifest, message,
 * query string, localStorage or a user Save.
 *
 * Fetches all THREE same-Origin files with no-cache and no redirects.
 * Both JS and WASM are hash-checked BEFORE any JavaScript executes.
 * Verified JS bytes are executed from a Blob URL, not via a second network
 * import. Verified WASM bytes are compiled in-memory and passed to init.
 * This prevents fetch/import TOCTOU of the JS glue or WASM binary.
 *
 * Production (qaCandidate=false) intentionally FAILS CLOSED: unsigned
 * GitHub source/byte hashes alone are not an authenticated signature.
 */
export async function loadSourcePinnedRustWasmCandidate({
 basePath,trustedPins,qaCandidate=false,fetcher=fetch
}={}){
 if(typeof document!=='undefined'||typeof globalThis.self?.location==='undefined')
   fail('WORKER_ONLY');
 if(qaCandidate!==true)fail('UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
 const loaded=await loadPinnedReadOnlyRustBytes({basePath,trustedPins,fetcher});
 return Object.freeze({...loaded,signatureVerified:false,
   productConsumerEnabled:false,nativeV3Verified:false,writerAuthorized:false});
}

// Shared byte/ABI pipeline ONLY. This receipt does not authenticate the pin
// issuer and cannot authorize a product operation. The protected loader
// obtains pins from a separate build-sealed module, never from this API's caller.
export async function loadPinnedReadOnlyRustBytes({basePath,trustedPins,fetcher=fetch}={}){
 if(typeof document!=='undefined'||typeof globalThis.self?.location==='undefined')
   fail('WORKER_ONLY');
 if(!exact(trustedPins,
  'contract,sourceHead,manifestSha256,manifestSizeBytes,jsSha256,wasmSha256,jsSizeBytes,wasmSizeBytes,sourceProvenanceOnly,verifiedSignature')||
  trustedPins.contract!=='wand.r22.candidate-pinned-digests@1'||
  !hex40.test(trustedPins.sourceHead)||
  ![trustedPins.manifestSha256,trustedPins.jsSha256,trustedPins.wasmSha256]
    .every(x=>hex64.test(x))||
  !strictSize(trustedPins.manifestSizeBytes,64*1024)||
  !strictSize(trustedPins.jsSizeBytes,2*1024*1024)||
  !strictSize(trustedPins.wasmSizeBytes,20*1024*1024)||
  trustedPins.sourceProvenanceOnly!==true||
  trustedPins.verifiedSignature!==false)fail('TRUSTED_SOURCE_PIN_MISSING');
 const base=baseRoute(basePath);
 const urls=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm']
   .map(name=>new URL(name,base));
 if(urls.some(url=>url.origin!==self.location.origin||url.pathname.indexOf('..')>=0||
    url.search!==''||url.hash!==''||!url.href.startsWith(base.href)))
   fail('ASSET_URL_OUTSIDE_ORIGIN');
 // Manifest is an attestation CANDIDATE, not a signature. The external pin
 // protects it against tampering, but is trusted only as much as its caller.
 const mf=await checkedFetch(urls[0],trustedPins.manifestSizeBytes,
   trustedPins.manifestSha256,'application/json',fetcher);
 let manifest;
 try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf))}
 catch{fail('MANIFEST_INVALID_JSON')}
 if(!manifest||manifest.contract!==version||
   manifest.source?.repository!=='DreamwishWand/web'||
   manifest.source?.commit!==trustedPins.sourceHead||
   manifest.source?.wasmBindgen!=='0.2.105'||
   manifest.source?.wasmTarget!=='wasm32-unknown-unknown'||
   manifest.source?.profile!=='release'||
   manifest.source?.defaultFeatures!==false||
   JSON.stringify(manifest.source?.features)!=='["indexed-read","worker-wasm"]'||
   !validCargoLockProvenance(manifest.source)||
   !hex64.test(manifest.source?.cargoLockSha256??'')||
   !hex64.test(manifest.source?.cargoTomlSha256??'')||
   manifest.signature?.status!=='UNKNOWN'||manifest.signature?.verified!==false||
   (manifest.release?.publishedPages!==false &&
    manifest.release?.publishedPages!==true)||
   manifest.release?.autoUpload!==false||
   manifest.release?.productConsumerEnabled!==false||
   manifest.release?.writerAuthorized!==false||
   manifest.abi?.exportClass!=='WorkerWasmSource'||
   manifest.abi?.maxPageRecords!==8||
   manifest.abi?.writerAuthorized!==false||
   manifest.abi?.nativeV3!==false||
   JSON.stringify(manifest.abi.methods)!==
     '["append_chunk","finish","issue_saved_diffgrids_typed_cursor","read_saved_diffgrids_typed_page","close"]'||
   !manifest.assets||manifest.assets.js?.path!=='ddv_save_core.js'||
   manifest.assets.wasm?.path!=='ddv_save_core_bg.wasm'||
   manifest.assets.js.sha256!==trustedPins.jsSha256||
   manifest.assets.wasm.sha256!==trustedPins.wasmSha256||
   manifest.assets.js.sizeBytes!==trustedPins.jsSizeBytes||
   manifest.assets.wasm.sizeBytes!==trustedPins.wasmSizeBytes)
   fail('MANIFEST_PROVENANCE_OR_ABI_DENIED');
 const [js,wasm]=await Promise.all([
  checkedFetch(urls[1],trustedPins.jsSizeBytes,trustedPins.jsSha256,'text/javascript',fetcher),
  checkedFetch(urls[2],trustedPins.wasmSizeBytes,trustedPins.wasmSha256,'application/wasm',fetcher)
 ]);
 if(wasm[0]!==0||wasm[1]!==97||wasm[2]!==115||wasm[3]!==109)
   fail('WASM_MAGIC');
 let compiled,blobUrl,mod;
 try{
   compiled=await WebAssembly.compile(wasm);
   const devSymbol=/(?:dev_(?:stage|undo|redo|begin|take)|semantic_writer|private_native)/i;
   if(WebAssembly.Module.exports(compiled).some(x=>devSymbol.test(x.name))||
      devSymbol.test(new TextDecoder('utf-8',{fatal:true}).decode(js)))
     fail('PUBLIC_DEV_SYMBOL_DENIED');
   blobUrl=URL.createObjectURL(new Blob([js],{type:'text/javascript'}));
   mod=await import(/* @vite-ignore */blobUrl);
 }catch{fail('VERIFIED_JS_OR_WASM_COMPILE_DENIED')}
 finally{if(blobUrl)URL.revokeObjectURL(blobUrl)}
 try{
  if(typeof mod?.default!=='function'||
     typeof mod.WorkerWasmSource!=='function'||
     !['append_chunk','finish','issue_saved_diffgrids_typed_cursor',
        'read_saved_diffgrids_typed_page','close'].every(
        n=>typeof mod.WorkerWasmSource.prototype[n]==='function'))
    fail('RUST_WORKER_ABI_MISMATCH');
  // In-memory WebAssembly.Module: no second fetch or wasm-bindgen URL fallback.
  await mod.default(compiled);
 }catch{fail('VERIFIED_WASM_INIT_OR_ABI_DENIED')}
 return Object.freeze({
  WorkerWasmSource:mod.WorkerWasmSource,
  checkedBothJsAndWasm:true,
  sameOriginFetchOnly:true,
  sourceHead:trustedPins.sourceHead,
  signatureVerified:false,
  productConsumerEnabled:false,
  nativeV3Verified:false,writerAuthorized:false
 });
}

