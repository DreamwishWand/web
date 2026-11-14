// Production read-only release provenance boundary, separate from QA candidate.
// The trusted site/Worker bundle embeds one release identity after the protected
// Pages job verifies actual Sigstore attestations. Not a runtime Sigstore client,
// not a product permission, and not a Save reader or Writer.
import {PROTECTED_READONLY_RELEASE_ANCHOR as anchor} from './product-rust-wasm-release-anchor.mjs';
import {loadPinnedReadOnlyRustBytes} from './product-rust-wasm-candidate-loader.mjs';

import {matchReleaseTuple} from './product-rust-wasm-release-trust.mjs';

const fail=code=>{throw Error('R22_PROTECTED_READONLY_'+code)};
const hex64=/^[a-f0-9]{64}$/;
const hex40=/^[a-f0-9]{40}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const size=(v,max)=>Number.isSafeInteger(v)&&v>0&&v<=max;
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest(
 'SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
// Canonical identity of the already verified signed subjects + delivery scope.
// It is NOT a signature or an independently chosen trust root.
export function readonlyReleaseIdentityText(a){
 const p=a.pins;
 return JSON.stringify(['wand.r22.protected-readonly-release@1',a.repository,
  a.signerWorkflow,a.sourceRef,a.origin,a.basePath,p.sourceHead,
  p.manifestSha256,p.manifestSizeBytes,p.jsSha256,p.jsSizeBytes,
  p.wasmSha256,p.wasmSizeBytes]);
}
async function validateBuildAnchor(a){
 if(!exact(a,'contract,repository,signerWorkflow,sourceRef,origin,basePath,pins,releaseId,attestationVerifiedAtBuild')||
   a.contract!=='wand.r22.protected-readonly-release@1'||
   !matchReleaseTuple(a)||a.attestationVerifiedAtBuild!==true||
   !hex64.test(a.releaseId??''))
   fail('BUILD_ANCHOR_MISSING_OR_INVALID');
 let u;
 try{u=new URL(a.origin)}catch{fail('BUILD_ORIGIN_INVALID')}
 if(u.protocol!=='https:'||u.origin!==a.origin||u.username||u.password)
   fail('BUILD_ORIGIN_INVALID');
 const p=a.pins;
 if(!exact(p,'contract,sourceHead,manifestSha256,manifestSizeBytes,jsSha256,jsSizeBytes,wasmSha256,wasmSizeBytes,sourceProvenanceOnly,verifiedSignature')||
   p.contract!=='wand.r22.candidate-pinned-digests@1'||!hex40.test(p.sourceHead??'')||
   ![p.manifestSha256,p.jsSha256,p.wasmSha256].every(x=>hex64.test(x??''))||
   !size(p.manifestSizeBytes,64*1024)||!size(p.jsSizeBytes,2*1024*1024)||
   !size(p.wasmSizeBytes,20*1024*1024)||p.sourceProvenanceOnly!==true||p.verifiedSignature!==false)
   fail('BUILD_PINS_INVALID');
 if(await digest(readonlyReleaseIdentityText(a))!==a.releaseId)
   fail('BUILD_IDENTITY_MISMATCH');
}
let attempted=false;
export async function loadProtectedReadonlyRustWasm(){
 // No options, fetcher, URL, origin, pin, flag, proof or callback from a
 // caller. Only a dedicated Worker built with the protected release anchor.
 if(arguments.length!==0)fail('CALLER_AUTHORITY_DENIED');
 if(typeof document!=='undefined'||typeof globalThis.self?.location==='undefined')
   fail('WORKER_ONLY');
 if(attempted)fail('LOAD_REPLAY_DENIED');
 attempted=true; // even failures require a fresh Worker; no fallback.
 await validateBuildAnchor(anchor);
 const where=self.location;
 if(where.protocol!=='https:'||where.origin!==anchor.origin||
   !where.pathname.startsWith(anchor.basePath+'/_app/'))
   fail('WORKER_DELIVERY_SCOPE_DENIED');
 const loaded=await loadPinnedReadOnlyRustBytes({
   basePath:anchor.basePath,trustedPins:anchor.pins,releaseTuple:anchor
 });
 if(loaded.sourceHead!==anchor.pins.sourceHead||loaded.checkedBothJsAndWasm!==true||
   loaded.sameOriginFetchOnly!==true||loaded.writerAuthorized!==false||
   loaded.productConsumerEnabled!==false||loaded.nativeV3Verified!==false||
   typeof loaded.WorkerWasmSource!=='function')
   fail('BYTE_RECEIPT_DENIED');
 return Object.freeze({
   contract:'wand.r22.protected-readonly-loader-receipt@1',
   releaseId:anchor.releaseId,sourceHead:anchor.pins.sourceHead,
   WorkerWasmSource:loaded.WorkerWasmSource,
   checkedBothJsAndWasm:true,sameOriginFetchOnly:true,
   attestationVerifiedAtBuild:true,runtimeSignatureVerified:false,
   qaCandidate:false,productConsumerEnabled:false,
   writerAuthorized:false,nativeV3Verified:false,applyAuthorized:false
 });
}
