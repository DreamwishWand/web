// PUBLIC SYNTHETIC Chrome module Worker. Test only verified same-origin
// candidate JS/WASM bytes from generated static Pages build; NO real Owner P1G.
import {loadSourcePinnedRustWasmCandidate}
 from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';
import {testRealEncryptedSavedDiffGridsFacade}
 from '../stage-f/saved-diffgrids-facade-real-worker.mjs';
const check=(v,s)=>{if(!v)throw Error('R22_DIST_CHROME_'+s)};
const reject=async(fn,pattern)=>{
 try{await fn()}catch(e){
  check(String(e?.message||e).includes(pattern),'UNEXPECTED_NEGATIVE_'+pattern);
  return;
 }throw Error('R22_DIST_CHROME_FALSE_ACCEPT_'+pattern);
};
const makeBadFetch=(target,mutate)=>async(url,opts)=>{
 const r=await fetch(url,opts);
 if(!url.endsWith(target))return r;
 const bytes=new Uint8Array(await r.arrayBuffer());
 const bad=mutate(bytes);
 return {ok:r.ok,status:r.status,redirected:r.redirected,
  type:r.type,url:r.url,headers:r.headers,
  arrayBuffer:async()=>bad.buffer.slice(bad.byteOffset,bad.byteOffset+bad.byteLength)};
};
async function run(){
 check(typeof document==='undefined'&&globalThis.crypto?.subtle,
   'REAL_ISOLATED_WORKER_CRYPTO');
 const expectedResponse=await fetch('./fixtures/ci-pins.json',{cache:'no-store'});
 check(expectedResponse.ok,'TRUSTED_CI_TEST_PINS_NOT_GENERATED');
 const pins=await expectedResponse.json();
 check(pins?.contract==='wand.r22.candidate-pinned-digests@1'&&
  pins.sourceProvenanceOnly===true&&pins.verifiedSignature===false,
  'PRODUCT_SIGNATURE_MUST_REMAIN_UNKNOWN');
 const base=self.location.pathname.startsWith('/web/')?'/web':'';
 const observed=[];
 const countedFetch=async(url,opts)=>{
  observed.push({url,cache:opts?.cache,redirect:opts?.redirect,
    credentials:opts?.credentials,mode:opts?.mode});
  return fetch(url,opts);
 };
 // SOURCE_ONLY test opt-in; real production mode must remain OFF.
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:pins,qaCandidate:false}),
   'UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
 const loaded=await loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:pins,qaCandidate:true,fetcher:countedFetch
 });
 check(loaded.checkedBothJsAndWasm===true&&
  loaded.sameOriginFetchOnly===true&&
  loaded.sourceHead===pins.sourceHead&&
  loaded.signatureVerified===false&&loaded.productConsumerEnabled===false&&
  loaded.nativeV3Verified===false&&loaded.writerAuthorized===false,
  'CANDIDATE_ONLY_GATES');
 check(observed.length===3&&
  observed.every(r=>r.url.startsWith(self.location.origin+base+'/worker-wasm/')&&
    r.cache==='no-store'&&r.redirect==='error'&&
    r.credentials==='same-origin'&&r.mode==='same-origin'),
   'ONE_FETCH_EACH_SAME_ORIGIN_NO_CACHE');
 const typed=await testRealEncryptedSavedDiffGridsFacade(loaded.WorkerWasmSource);
 check(typed.records===17&&typed.pages.join(',')==='8,8,1'&&
   typed.realGeneratedRustWasm&&typed.sameProductSession&&
   typed.ABStaleReadAndCloseDenied&&
   typed.metadataOnlyToUI&&!typed.productReadAccepted,
  'ENCRYPTED_STEAM_P1G_TYPED_RUST_WORKER_REAL_CHROME');
 const badChecksum=(bytes)=>{bytes[bytes.length-1]^=1;return bytes};
 for(const name of ['manifest.json','ddv_save_core.js',
                      'ddv_save_core_bg.wasm']){
   await reject(()=>loadSourcePinnedRustWasmCandidate({
     basePath:base,trustedPins:pins,qaCandidate:true,
     fetcher:makeBadFetch(name,badChecksum)
   }),name==='manifest.json'?'ASSET_SHA256_MISMATCH':'ASSET_SHA256_MISMATCH');
 }
 // Tamper BOTH JS+WASM and manifest in flight: a matching remote SHA text
 // cannot override independent pinned digests.
 const both=async (url,opts)=>{
  const r=await fetch(url,opts);
  if(!/ddv_save_core/.test(url))return r;
  const b=new Uint8Array(await r.arrayBuffer());b[b.length-1]^=1;
  return {ok:r.ok,status:r.status,redirected:r.redirected,
    type:r.type,url:r.url,headers:r.headers,
    arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};
 };
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:pins,qaCandidate:true,fetcher:both}),
  'ASSET_SHA256_MISMATCH');
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:{...pins,sourceHead:'f'.repeat(40)},
   qaCandidate:true}),'MANIFEST_PROVENANCE_OR_ABI_DENIED');
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:{...pins,wasmSha256:'f'.repeat(64)},
   qaCandidate:true}),'MANIFEST_PROVENANCE_OR_ABI_DENIED');
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:'/external',trustedPins:pins,qaCandidate:true}),
  'UNSUPPORTED_BASE_PATH');
 if(base==='/web')await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:'',trustedPins:pins,qaCandidate:true}),
  'ASSET_ORIGIN_STATUS_REDIRECT');
 // Even if a malicious server returns 200/HTML for a missing WASM/JS,
 // strict MIME+size+hash (and no SPA fallback) fail-closed.
 const fake404=async(url,opts)=>{
  if(url.endsWith('ddv_save_core.js'))
   return {ok:false,status:404,redirected:false,
     url,type:'basic',headers:{get:()=> 'text/html'},
     arrayBuffer:async()=>new ArrayBuffer(0)};
  return fetch(url,opts);
 };
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:pins,qaCandidate:true,fetcher:fake404}),
  'ASSET_ORIGIN_STATUS_REDIRECT');
 const remoteRedirect=async(url,opts)=>{
  if(url.endsWith('ddv_save_core.js')){
   const r=await fetch(url,opts);
   return {ok:r.ok,status:r.status,redirected:true,
     url:'https://unapproved.invalid/cdn.js',type:'cors',headers:r.headers,
     arrayBuffer:()=>r.arrayBuffer()};
  }
  return fetch(url,opts);
 };
 await reject(()=>loadSourcePinnedRustWasmCandidate({
   basePath:base,trustedPins:pins,qaCandidate:true,fetcher:remoteRedirect}),
  'ASSET_ORIGIN_STATUS_REDIRECT');
 return {result:'R22_TRUE_GENERATED_BOTH_JS_AND_WASM_SAME_ORIGIN_CHROME_PASS',
  sourceHead:pins.sourceHead,basePath:base,dualSourcePins:true,
  singleNetworkFetchPerAsset:true,inMemoryVerifiedJsAndWasm:true,
  realChromeModuleWorker:true,realGeneratedRustWasm:true,
  syntheticEncryptedSteamP1g:true,diffgrids:typed.records,
  pages:typed.pages.join(','),tamperDenied:true,badBaseDenied:true,
  forgedRemoteDenied:true,signatureVerified:false,
  productEnabled:false,writerAuthorized:false,realPrivateP1g:false};
}
self.addEventListener('message',async({data})=>{
 if(data?.kind!=='R22_CANDIDATE_TEST')return;
 try{self.postMessage({ok:true,result:await run()})}
 catch(e){self.postMessage({ok:false,error:String(e?.stack||e).slice(0,850)})}
});
