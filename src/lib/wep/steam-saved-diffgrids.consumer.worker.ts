// 08 WEB / W-WEB-007 / W-LOCAL-019 — opt-in typed Steam DiffGrids Worker.
// This imports the ACCEPTED 01A Loader, not unverified network JavaScript.
// Only a fixed independently accepted protected-main, signed Pages release
// is a trust anchor. NEVER take pins, URL, Build, Session or flags from UI.
import {installLocalSteamP1gSavedDiffGridsWorker}
  from '$lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs';
import {loadProtectedReadonlyRustWasm}
  from '$lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
import {validateOwnerLocalSteamAttestation}
  from '../../../tools/owner-local-steam-v1/attestation.mjs';

// PR957/PR960: the protected Pages build seals the exact signed three assets
// into the trusted Worker bundle. No fixed historical commit/digest or caller pins.
// Formal product authority remains OFF. Owner Policy61–66 grants only the
// Steam626 stored-DiffGrids preformal test route, not a general Reader or Writer.
// The signed anchor and exact typed facade remain mandatory. No UI message
// can grant either flag. Rollback: set PREFORMAL_STEAM_READER_ENABLED=false.
const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;
const PREFORMAL_STEAM_READER_ENABLED=true;

async function loadAcceptedReadOnlyRustModule(){
  // Accepted 01A production provenance boundary: no caller arguments.
  // Build-sealed release identity is validated by the loader, not by the UI.
  const result=await loadProtectedReadonlyRustWasm();
  if(result?.contract!=='wand.r22.protected-readonly-loader-receipt@1'||
     !/^[a-f0-9]{64}$/.test(result.releaseId)||
     !/^[a-f0-9]{40}$/.test(result.sourceHead)||
     result.attestationVerifiedAtBuild!==true||
     result.runtimeSignatureVerified!==false||
     result.checkedBothJsAndWasm!==true||
     result.sameOriginFetchOnly!==true||
     result.qaCandidate!==false||
     result.productConsumerEnabled!==false||
     result.writerAuthorized!==false||
     result.nativeV3Verified!==false||
     result.applyAuthorized!==false||
     typeof result.WorkerWasmSource!=='function')
    throw Error('DIFFGRIDS_PRODUCT_LOADER_RECEIPT_DENIED');
  return Object.freeze({WorkerWasmSource:result.WorkerWasmSource});
}
const publishUnavailable=()=>self.postMessage({
  kind:'DIFFGRIDS_RUNTIME_READY',ready:false,writerAuthorized:false
});
void (async()=>{
  if(PRODUCT_READONLY_CONSUMER_OWNER_ENABLED||!PREFORMAL_STEAM_READER_ENABLED){
    publishUnavailable();
    return;
  }
  // Refuse to register the File handler until verified JS + WASM have
  // actually been fetched/checked/compiled on THIS isolated Worker.
  // This also fails closed on CSP Blob restrictions at live origin.
  try{
    const module=await loadAcceptedReadOnlyRustModule();
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
