// 08 WEB / W-WEB-007 / W-LOCAL-019 — opt-in typed Steam DiffGrids Worker.
// This imports the ACCEPTED 01A Loader, not unverified network JavaScript.
// Only a fixed independently accepted protected-main, signed Pages release
// is a trust anchor. NEVER take pins, URL, Build, Session or flags from UI.
import {installLocalSteamP1gSavedDiffGridsWorker}
  from '$lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs';
import {loadSourcePinnedRustWasmCandidate}
  from '$lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs';
import {validateOwnerLocalSteamAttestation}
  from '../../../tools/owner-local-steam-v1/attestation.mjs';

// Source: protected-main ef0372a5 and actual HTTPS Pages run42980529332;
// release same-Pages-build OIDC Sigstore attestation 66174683.
// All three independent bytes/sizes were accepted by 05 QR-C PR909,
// 09 INT PR910 and the managed HTTPS deploy verification. These are NOT
// fetched from the manifest, UI, query, storage, CDN, or an untrusted route.
// Pin to the full source commit AND manifest (which embeds that commit).
export const ACCEPTED_PUBLIC_READONLY_RUST_RELEASE_PINS=Object.freeze({
  contract:'wand.r22.candidate-pinned-digests@1',
  sourceHead:'ef0372a58b9619a442c65b31cecbb88c3cca0029',
  manifestSha256:'9a0515d259163ab80ba070f15918dcba1e59c3d5726c8efaeb8934ec5e5f6b50',
  manifestSizeBytes:1915,
  jsSha256:'4704a19c6e2962583d03a0bf8e7d5bf5ad2a802fd664259117eff4b2bbcbac0d',
  jsSizeBytes:16904,
  wasmSha256:'5383f76a7228493d720e1e2734a26738d1165f92cbcfae48f3e1df5c38b10207',
  wasmSizeBytes:258719,
  sourceProvenanceOnly:true,
  verifiedSignature:false
});

// Explicit Owner PRODUCT-operation Gate is separate from permission to
// host three inert read-only files. No product Reader is enabled by this PR.
// Focused CI may replace this SINGLE constant in the temporary test working
// tree only, never commit the enabled value or put private P1G into CI.
const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;

function basePathForWorker(){
  const pathname=self.location.pathname;
  if(pathname.startsWith('/web/_app/'))return '/web';
  if(pathname.startsWith('/_app/'))return '';
  throw Error('DIFFGRIDS_WORKER_BASE_ORIGIN_DENIED');
}
async function loadAcceptedReadOnlyRustModule(){
  const pinned=ACCEPTED_PUBLIC_READONLY_RUST_RELEASE_PINS;
  // 01A Loader is itself Worker-only and strictly verifies all three
  // independent pins, each exact size, Source/Build/ABI/Origin, MIME, no
  // redirect, no cache; compiles verified WASM in memory, then imports the
  // VERIFIED JS bytes as a one-shot Blob URL. Never dynamic import(url).
  // Its "qaCandidate" is the only currently accepted loader operation;
  // because it is a QA-only API, this product Worker must stay disabled
  // until a *separate* Owner product gate/production loader acceptance.
  const result=await loadSourcePinnedRustWasmCandidate({
    basePath:basePathForWorker(),trustedPins:pinned,qaCandidate:true
  });
  if(result?.sourceHead!==pinned.sourceHead||
     result.checkedBothJsAndWasm!==true||
     result.sameOriginFetchOnly!==true||
     result.productConsumerEnabled!==false||
     result.writerAuthorized!==false||
     result.nativeV3Verified!==false||
     typeof result.WorkerWasmSource!=='function')
    throw Error('DIFFGRIDS_PRODUCT_LOADER_RECEIPT_DENIED');
  return Object.freeze({WorkerWasmSource:result.WorkerWasmSource});
}
const publishUnavailable=()=>self.postMessage({
  kind:'DIFFGRIDS_RUNTIME_READY',ready:false,writerAuthorized:false
});
void (async()=>{
  if(!PRODUCT_READONLY_CONSUMER_OWNER_ENABLED){
    publishUnavailable();
    return;
  }
  // Refuse to register the File handler until verified JS + WASM have
  // actually been fetched/checked/compiled on THIS isolated Worker.
  // This also fails closed on CSP Blob restrictions at live origin.
  let module;
  try{
    module=await loadAcceptedReadOnlyRustModule();
    const wasmFactory=async()=>module;
    const bound=installLocalSteamP1gSavedDiffGridsWorker({
      wasmFactory,validateExternalAttestation:validateOwnerLocalSteamAttestation,
      allowSyntheticFixture:false
    });
    if(!bound)throw Error('DIFFGRIDS_WORKER_INSTALL_FAILED');
    self.postMessage({kind:'DIFFGRIDS_RUNTIME_READY',ready:true,
      writerAuthorized:false});
  }catch{
    // No file selection, alternate JS Decoder, remote fetch, log or Writer
    // when signature/pin/source/ABI/CSP/Origin/HTTPS/TOCTOU is unverifiable.
    publishUnavailable();
  }
})();
