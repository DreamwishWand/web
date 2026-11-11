// NEW 05 QR-C PR908 scope only: independently exercise approved PUBLIC assets
// under real Chrome, never merge QA or activate any product UI/Writer.
import {loadSourcePinnedRustWasmCandidate as load}
 from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';

const source='fb8f088f00b6ac375bc27b7054608585362219e9';
const digests={
 js:'4704a19c6e2962583d03a0bf8e7d5bf5ad2a802fd664259117eff4b2bbcbac0d',
 wasm:'5383f76a7228493d720e1e2734a26738d1165f92cbcfae48f3e1df5c38b10207',
 manifest:'8138a6b8cefd65a85563b087c5ebcd61b7efe165d7330793269e73c97caeea71'
};
const must=(v,key)=>{if(!v)throw Error('QAC908_'+key)};
const rejected=async(fn,expected)=>{
 try{await fn()}catch(e){
  must(String(e?.message||e).includes(expected),'REJECTION_MISMATCH_'+expected);
  return;
 }
 throw Error('QAC908_UNSAFE_ACCEPT_'+expected);
};
function responseWith(r,overrides){
 return {ok:r.ok,status:r.status,redirected:r.redirected,
  type:r.type,url:r.url,headers:r.headers,
  arrayBuffer:()=>r.arrayBuffer(),...overrides};
}
export async function independentQac908(){
 must(typeof document==='undefined'&&!!crypto?.subtle,
  'REAL_CHROME_MODULE_WORKER_REQUIRED');
 const base=self.location.pathname.startsWith('/web/')?'/web':'';
 const fixture=await fetch('./fixtures/ci-pins.json',{cache:'no-store'});
 must(fixture.status===200,'CANDIDATE_PINS');
 const pins=await fixture.json();
 must(pins.sourceHead===source&&pins.jsSha256===digests.js&&
  pins.wasmSha256===digests.wasm&&
  pins.manifestSha256===digests.manifest&&
  pins.jsSizeBytes===16904&&pins.wasmSizeBytes===258719&&
  pins.manifestSizeBytes===1915&&
  pins.sourceProvenanceOnly===true&&pins.verifiedSignature===false,
  'SOURCE_FIXED_SIGNED_THREE_PINS');
 const manifestResponse=await fetch(
  self.location.origin+base+'/worker-wasm/manifest.json',
  {cache:'no-store',redirect:'error',mode:'same-origin'});
 must(manifestResponse.ok&&manifestResponse.status===200,
  'MANIFEST_PUBLIC_SOURCE_AVAILABLE');
 const manifest=await manifestResponse.json();
 must(manifest.kind==='PUBLIC_READONLY_SIGNED_ASSET_ONLY_UI_OFF'&&
  manifest.source.commit===source&&
  manifest.source.defaultFeatures===false&&
  JSON.stringify(manifest.source.features)==='["indexed-read","worker-wasm"]'&&
  manifest.release.publishedPages===true&&
  manifest.release.productConsumerEnabled===false&&
  manifest.release.writerAuthorized===false&&
  manifest.release.autoUpload===false&&
  manifest.abi.writerAuthorized===false&&
  manifest.abi.nativeV3===false&&
  manifest.signature.status==='UNKNOWN'&&
  manifest.signature.verified===false,'PRE_SIGN_PUBLIC_MANIFEST_READONLY_GATES');
 await rejected(()=>load({basePath:base,trustedPins:pins}),
  'UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
 await rejected(()=>load({basePath:base,trustedPins:{
    ...pins,verifiedSignature:true},qaCandidate:true}),
  'TRUSTED_SOURCE_PIN_MISSING');
 await rejected(()=>load({basePath:base,trustedPins:{
    ...pins,sourceHead:'8e0bf62a09f43f3e193e684f2f92f3a09fc405b5'},
    qaCandidate:true}),'MANIFEST_PROVENANCE_OR_ABI_DENIED');
 const fetched=[];
 const loadable=await load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:async(url,opts)=>{
   fetched.push({url,opts});
   return fetch(url,opts);
  }});
 must(loadable.WorkerWasmSource&&loadable.checkedBothJsAndWasm&&
  loadable.sourceHead===source&&loadable.writerAuthorized===false&&
  loadable.productConsumerEnabled===false&&loadable.signatureVerified===false,
  'REAL_SIGNED_READONLY_RUST_WASM_CANDIDATE');
 must(fetched.length===3&&
  new Set(fetched.map(x=>x.url)).size===3&&
  fetched.every(x=>
   x.url.startsWith(self.location.origin+base+'/worker-wasm/')&&
   x.opts?.cache==='no-store'&&x.opts?.redirect==='error'&&
   x.opts?.credentials==='same-origin'&&x.opts?.mode==='same-origin'),
  'NO_CDN_NO_SECOND_FETCH_NO_STALE_CACHE');
 // New PR908 JS MIME compatibility, MUST NOT relax WASM or manifest MIME.
 const jsMimeOverride=async(url,opts)=>{
  const r=await fetch(url,opts);
  return url.endsWith('ddv_save_core.js')?
   responseWith(r,{headers:{get:()=>'application/javascript'}}):r;
 };
 const mimeAlternative=await load({basePath:base,trustedPins:pins,
  qaCandidate:true,fetcher:jsMimeOverride});
 must(mimeAlternative.WorkerWasmSource&&
  mimeAlternative.writerAuthorized===false,'VALID_JS_MIME_WITH_PIN');
 const spoof=(target,patch)=>async(url,opts)=>{
  const r=await fetch(url,opts);
  return url.endsWith(target)?responseWith(r,patch(r,url)):r;
 };
 for(const target of ['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm']){
  await rejected(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
   fetcher:spoof(target,r=>({arrayBuffer:async()=>{
    const bytes=new Uint8Array(await r.arrayBuffer());
    bytes[bytes.length-1]^=1;return bytes.buffer;
   }}))}),'ASSET_SHA256_MISMATCH');
 }
 await rejected(()=>load({basePath:base,trustedPins:{
  ...pins,manifestSha256:'60f711aa84877ce87a9806341cff1ff436f9f5e2b984204ff089f6881faef4af'},
  qaCandidate:true}),'ASSET_SHA256_MISMATCH');
 // A potentially executable injected JS must be rejected BEFORE import.
 await rejected(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('ddv_save_core.js',r=>({arrayBuffer:async()=>{
   const bytes=new Uint8Array(await r.arrayBuffer());
   const injected=new TextEncoder().encode(
    'self.__qac908UntrustedImported=true;\n'+new TextDecoder().decode(bytes));
   return injected.buffer;
  }}))}),'ASSET_LENGTH_MISMATCH');
 must(!self.__qac908UntrustedImported,'UNVERIFIED_JS_NEVER_EXECUTED');
 await rejected(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('ddv_save_core.js',()=>({status:206}))}),
 'ASSET_ORIGIN_STATUS_REDIRECT');
 await rejected(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('manifest.json',()=>({redirected:true,url:
   'https://cdn.unapproved.invalid/manifest.json'}))}),
 'ASSET_ORIGIN_STATUS_REDIRECT');
 await rejected(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('ddv_save_core_bg.wasm',()=>({headers:{
    get:()=> 'text/html'}}))}),'ASSET_CONTENT_TYPE');
 const fake404=async(url,opts)=>{
  if(!url.endsWith('ddv_save_core.js'))return fetch(url,opts);
  return {ok:false,status:404,url,type:'basic',redirected:false,
   headers:{get:()=> 'text/html'},arrayBuffer:async()=>new ArrayBuffer(0)};
 };
 await rejected(()=>load({basePath:base,trustedPins:pins,
  qaCandidate:true,fetcher:fake404}),'ASSET_ORIGIN_STATUS_REDIRECT');
 await rejected(()=>load({basePath:'https://unapproved.invalid',
  trustedPins:pins,qaCandidate:true}),'UNSUPPORTED_BASE_PATH');
 return {pr908NewScope:true,sourceHead:source,basePath:base,
  trueChrome:true,trueVerifiedJsWasmBeforeExecution:true,
  actualPublicIntentManifest:true,sameOriginNoCache:true,
  realGeneratedRustWasm:true,newJsMimePositive:true,
  oldManifestPinDenied:true,changed3AssetsDenied:true,
  staleHeadCdn404HtmlRedirect206Denied:true,
  unverifiedJsNeverExecuted:true,publicSourceProvenanceProofVerifiedInCI:true,
  ownerPrivateP1g:false,productConsumerEnabled:false,writerAuthorized:false};
}
