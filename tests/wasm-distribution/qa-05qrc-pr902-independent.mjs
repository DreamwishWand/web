// 05 QR-C / PR902: independently exercise ONLY new source-pinned JS+WASM distribution.
 // Public synthetic generated build, no private Steam P1G, no product Writer.
import {loadSourcePinnedRustWasmCandidate as load}
  from '../../src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';
const sourceHead='12c4072b99a1aa70204d941dc20283fac41ded98';
const immutable={
  contract:'wand.r22.candidate-pinned-digests@1',
  sourceHead,
  manifestSha256:'f69abcbabc4e38e49fe55deb278f764a17e3b01d769637d42d3853dd3e6a9c5a',
  manifestSizeBytes:0, // The QA verifier substitutes the TRUE independently measured size.
  jsSha256:'4704a19c6e2962583d03a0bf8e7d5bf5ad2a802fd664259117eff4b2bbcbac0d',
  wasmSha256:'5383f76a7228493d720e1e2734a26738d1165f92cbcfae48f3e1df5c38b10207',
  jsSizeBytes:16904,wasmSizeBytes:258719,
  sourceProvenanceOnly:true,verifiedSignature:false
};
const assert=(v,reason)=>{if(!v)throw Error('QAC902_'+reason)};
const denied=async(fn,expected)=>{
  try{await fn()}catch(e){assert(String(e?.message||e).includes(expected),'WRONG_DENIAL_'+expected);return}
  throw Error('QAC902_FALSE_ACCEPT_'+expected);
};
function alteredReply(response,overrides={}){
  return {
    ok:response.ok,status:response.status,
    redirected:response.redirected,url:response.url,type:response.type,
    headers:response.headers,
    arrayBuffer:()=>response.arrayBuffer(),...overrides
  };
}
export async function independentQrC902(){
  assert(typeof document==='undefined'&&crypto?.subtle,'REAL_ISOLATED_BROWSER_WORKER');
  const base=self.location.pathname.startsWith('/web/')?'/web':'';
  // QA-hardcoded digest immutable; CI separately verifies Sigstore subject bytes.
  const pins=await fetch('./fixtures/ci-pins.json',{cache:'no-store'}).then(r=>r.json());
  const expected={...immutable,manifestSizeBytes:pins.manifestSizeBytes};
  assert(Object.entries(expected).every(([k,v])=>pins[k]===v)&&
    Object.keys(pins).length===Object.keys(expected).length,
    'INDEPENDENTLY_PINNED_ALL_THREE_CANDIDATE_DIGESTS');
  await denied(()=>load({basePath:base,trustedPins:pins}),
    'UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:false}),
    'UNSIGNED_PRODUCT_DISTRIBUTION_OFF');
  await denied(()=>load({basePath:base,trustedPins:null,qaCandidate:true}),
    'TRUSTED_SOURCE_PIN_MISSING');
  await denied(()=>load({basePath:base,trustedPins:{...pins,verifiedSignature:true},
    qaCandidate:true}),'TRUSTED_SOURCE_PIN_MISSING');
  await denied(()=>load({basePath:'https://cdn.invalid/worker-wasm',
    trustedPins:pins,qaCandidate:true}),'UNSUPPORTED_BASE_PATH');
  const requests=[];
  const verified=await load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:async (url,options)=>{
      requests.push({url,options});
      return fetch(url,options);
    }});
  assert(verified.checkedBothJsAndWasm&&verified.sameOriginFetchOnly&&
    verified.WorkerWasmSource&&verified.sourceHead===sourceHead&&
    verified.writerAuthorized===false&&verified.signatureVerified===false&&
    verified.productConsumerEnabled===false,'REAL_BOTH_BYTES_LOAD_READONLY');
  assert(requests.length===3&&
    new Set(requests.map(r=>r.url)).size===3&&
    requests.every(r=>r.url.startsWith(self.location.origin+base+'/worker-wasm/')&&
      r.options?.cache==='no-store'&&r.options?.redirect==='error'&&
      r.options?.mode==='same-origin'&&r.options?.credentials==='same-origin'),
    'SINGLE_FETCH_NO_STALE_CACHE_OR_CDN');
  assert(typeof verified.WorkerWasmSource.prototype.issue_saved_diffgrids_typed_cursor==='function'&&
    typeof verified.WorkerWasmSource.prototype.read_saved_diffgrids_typed_page==='function',
    'EXACT_TYPED_RUST_WASM_ABI');
  const mutated=(match,modify)=>async(url,options)=>{
    const r=await fetch(url,options);
    return url.endsWith(match)?alteredReply(r,modify(r,url)):r;
  };
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:mutated('ddv_save_core_bg.wasm',()=>({
      headers:{get:()=> 'text/html;charset=utf-8'}
    }))}),'ASSET_CONTENT_TYPE');
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:mutated('ddv_save_core.js',()=>({
      status:206
    }))}),'ASSET_ORIGIN_STATUS_REDIRECT');
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:mutated('manifest.json',(_,url)=>({
      redirected:true,url:'https://unapproved.example/assets/manifest.json'
    }))}),'ASSET_ORIGIN_STATUS_REDIRECT');
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:mutated('ddv_save_core.js',r=>({
      arrayBuffer:async()=>{
        const b=new Uint8Array(await r.arrayBuffer());
        b[b.length-1]^=1;return b.buffer;
      }
    }))}),'ASSET_SHA256_MISMATCH');
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:mutated('ddv_save_core_bg.wasm',r=>({
      arrayBuffer:async()=>{
        const b=new Uint8Array(await r.arrayBuffer());
        b[b.length-1]^=1;return b.buffer;
      }
    }))}),'ASSET_SHA256_MISMATCH');
  await denied(()=>load({basePath:base,trustedPins:{
      ...pins,jsSha256:pins.wasmSha256
    },qaCandidate:true}),'MANIFEST_PROVENANCE_OR_ABI_DENIED');
  await denied(()=>load({basePath:base,trustedPins:{
      ...pins,manifestSizeBytes:pins.manifestSizeBytes+1
    },qaCandidate:true}),'ASSET_LENGTH_MISMATCH');
  const missing=async(url,opts)=>{
    if(url.endsWith('/ddv_save_core_bg.wasm'))return {
      ok:false,status:404,redirected:false,type:'basic',url,
      headers:{get:()=> 'text/html'},arrayBuffer:async()=>new ArrayBuffer(0)
    };
    return fetch(url,opts);
  };
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:missing}),'ASSET_ORIGIN_STATUS_REDIRECT');
  const fallback=async(url,opts)=>{
    const r=await fetch(url,opts);
    return url.endsWith('ddv_save_core.js')?alteredReply(r,{
      headers:{get:()=> 'text/html'}
    }):r;
  };
  await denied(()=>load({basePath:base,trustedPins:pins,qaCandidate:true,
    fetcher:fallback}),'ASSET_CONTENT_TYPE');
  return {
    independent:true,readOnly:true,trueGeneratedRustWasm:true,ChromeWorker:true,
    checkedJsWasmManifestDigest:true,sourceHead,
    basePath:base,signedArtifactVerifiedInCI:true,
    htmlFallback404Denied:true,staleCacheAndCdnDenied:true,
    alteredJsAndWasmDenied:true,signatureRuntimeVerified:false,
    productEnabled:false,writerAuthorized:false,realOwnerPrivateSave:false
  };
}
