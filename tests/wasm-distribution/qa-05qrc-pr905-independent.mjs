// 05 QR-C PR905 changed-release-path ONLY: independent real Chrome Worker.
// Authenticated original Source release proof and candidate bytes are checked
// separately in the QA CI workflow. Never load Owner private P1G or enable UI.
import {loadSourcePinnedRustWasmCandidate as load}
  from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';
const SOURCE='f20cf85211ede97b3837e7abb1e8bc75cd1bc73b';
const SHA_JS='4704a19c6e2962583d03a0bf8e7d5bf5ad2a802fd664259117eff4b2bbcbac0d';
const SHA_WASM='5383f76a7228493d720e1e2734a26738d1165f92cbcfae48f3e1df5c38b10207';
const SHA_MANIFEST='60f711aa84877ce87a9806341cff1ff436f9f5e2b984204ff089f6881faef4af';
const must=(v,name)=>{if(!v)throw Error('QAC905_'+name)};
const deny=async(fn,expected)=>{
 try{await fn()}catch(e){
  must(String(e?.message||e).includes(expected),'UNEXPECTED_REJECT_'+expected);return;
 }throw Error('QAC905_FALSE_ACCEPT_'+expected);
};
function replacement(r,change){
 return {ok:r.ok,status:r.status,redirected:r.redirected,
   url:r.url,type:r.type,headers:r.headers,
   arrayBuffer:()=>r.arrayBuffer(),...change};
}
export async function independentQac905(){
 must(typeof document==='undefined'&&typeof crypto?.subtle==='object',
   'GENUINE_ISOLATED_CHROME_WORKER');
 const base=self.location.pathname.startsWith('/web/')?'/web':'';
 const url='./fixtures/ci-pins.json';
 const pinsResponse=await fetch(url,{cache:'no-store'});
 must(pinsResponse.ok&&pinsResponse.status===200,'PIN_FIXTURE_PRESENT');
 const pins=await pinsResponse.json();
 must(pins?.sourceHead===SOURCE&&pins.jsSha256===SHA_JS&&
   pins.wasmSha256===SHA_WASM&&pins.manifestSha256===SHA_MANIFEST&&
   pins.jsSizeBytes===16904&&pins.wasmSizeBytes===258719&&
   pins.manifestSizeBytes===1921&&pins.sourceProvenanceOnly===true&&
   pins.verifiedSignature===false,'IMMUTABLE_THREE_SIGNED_SUBJECT_PINS');
 // External OIDC proof is checked in CI; never call hash-only trust signed.
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:false}),
  'UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
 await deny(()=>load({basePath:base,trustedPins:{...pins,verifiedSignature:true},
  qaCandidate:true}),'TRUSTED_SOURCE_PIN_MISSING');
 await deny(()=>load({basePath:base,trustedPins:{...pins,sourceHead:
  '12c4072b99a1aa70204d941dc20283fac41ded98'},qaCandidate:true}),
  'MANIFEST_PROVENANCE_OR_ABI_DENIED');
 await deny(()=>load({basePath:base,trustedPins:{...pins,manifestSha256:
  'f69abcbabc4e38e49fe55deb278f764a17e3b01d769637d42d3853dd3e6a9c5a'},
  qaCandidate:true}),'ASSET_SHA256_MISMATCH');
 const actual=[];
 const loaded=await load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:async(url,opts)=>{actual.push({url,opts});return fetch(url,opts)}});
 must(loaded.checkedBothJsAndWasm&&loaded.sameOriginFetchOnly&&
  loaded.sourceHead===SOURCE&&loaded.signatureVerified===false&&
  loaded.productConsumerEnabled===false&&loaded.writerAuthorized===false&&
  loaded.nativeV3Verified===false&&
  typeof loaded.WorkerWasmSource==='function','REAL_READONLY_SIGNED_CANDIDATE');
 must(actual.length===3&&new Set(actual.map(x=>x.url)).size===3&&
  actual.every(x=>x.url.startsWith(self.location.origin+base+'/worker-wasm/')&&
   x.opts?.cache==='no-store'&&x.opts?.redirect==='error'&&
   x.opts?.credentials==='same-origin'&&x.opts?.mode==='same-origin'),
   'NO_CACHE_REDIRECT_OR_IMPORT_REFETCH');
 const tamper=(match)=>async(url,opts)=>{
  const r=await fetch(url,opts);
  if(!url.endsWith(match))return r;
  return replacement(r,{arrayBuffer:async()=>{
   const bytes=new Uint8Array(await r.arrayBuffer());
   bytes[bytes.length-1]^=1;return bytes.buffer;
  }});
 };
 for(const name of ['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm']){
  await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
   fetcher:tamper(name)}),'ASSET_SHA256_MISMATCH');
 }
 // The forged JS deliberately contains an observable side-effect: hash
 // rejection must occur BEFORE any imported code can run.
 const sideEffectJs=async(url,opts)=>{
  const r=await fetch(url,opts);
  if(!url.endsWith('ddv_save_core.js'))return r;
  return replacement(r,{arrayBuffer:async()=>{
   const original=await r.text();
   return new TextEncoder().encode(
    'self.__qac905UnverifiedScriptExecuted=true;\n'+original).buffer;
  }});
 };
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:sideEffectJs}),'ASSET_LENGTH_MISMATCH');
 must(!self.__qac905UnverifiedScriptExecuted,'JS_NEVER_EXECUTED_UNVERIFIED');
 await deny(()=>load({basePath:base,trustedPins:{
  ...pins,wasmSizeBytes:pins.wasmSizeBytes-1},qaCandidate:true}),
  'MANIFEST_PROVENANCE_OR_ABI_DENIED');
 const spoof=(target,modify)=>async(url,opts)=>{
  const response=await fetch(url,opts);
  return url.endsWith(target)?replacement(response,modify(response,url)):response;
 };
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('manifest.json',(_,url)=>({url:'https://unapproved.invalid/manifest.json'}))
 }),'ASSET_ORIGIN_STATUS_REDIRECT');
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('ddv_save_core.js',()=>({status:206}))
 }),'ASSET_ORIGIN_STATUS_REDIRECT');
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:spoof('ddv_save_core_bg.wasm',()=>({headers:{get:()=> 'text/html'}}))
 }),'ASSET_CONTENT_TYPE');
 const error404=async(url,opts)=>{
  if(url.endsWith('ddv_save_core.js'))return{
    ok:false,status:404,redirected:false,type:'basic',url,
    headers:{get:()=> 'text/html'},arrayBuffer:async()=>new ArrayBuffer(0)
  };
  return fetch(url,opts);
 };
 await deny(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
  fetcher:error404}),'ASSET_ORIGIN_STATUS_REDIRECT');
 await deny(()=>load({basePath:'https://cdn.invalid',trustedPins:pins,
  qaCandidate:true}),'UNSUPPORTED_BASE_PATH');
 return Object.freeze({sourceHead:SOURCE,basePath:base,realChrome:true,
  realRustWasm:true,signerVerifiedExternallyInCI:true,
  threeImmutablePins:true,readOnly:true,strictCspExpected:true,
  unverifiedJsNotExecuted:true,originCache404CdnTamperDenied:true,
  runtimeSignatureVerified:false,publicExecutablePublished:false,
  productEnabled:false,writerAuthorized:false,ownerPrivateP1gInCi:false});
}
