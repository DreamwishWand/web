// CI-only synthetic File-open through the very same Owner-local Worker core.
// Real Owner Save is NEVER loaded by Actions, and page never decodes P1G.
import {OWNER_LOCAL_V1_ATTESTATION_CONTRACT,OWNER_LOCAL_STEAM_FULL_VERSION}
 from '../../tools/owner-local-steam-v1/attestation.mjs';
const ensure=(ok,code)=>{if(!ok)throw Error('STAGE_G_'+code)};
const worker=new Worker('./worker.mjs',{type:'module'});
let sequence=0;const replies=new Map();
worker.addEventListener('message',({data})=>{
 const pending=replies.get(data?.requestId);
 if(pending){replies.delete(data.requestId);pending(data)}
});
const request=(kind,payload={})=>new Promise(resolve=>{
 const requestId=++sequence;replies.set(requestId,resolve);
 worker.postMessage({kind,requestId,...payload});
});
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const synthetic=async()=>{
 ensure(typeof crypto?.subtle?.digest==='function','WEBCRYPTO');
 const [p,expectedResponse]=await Promise.all([
  fetch('/tests/stage-f/fixtures/synthetic626.p1g'),
  fetch('/tests/stage-f/fixtures/expected.json')]);
 ensure(p.ok&&expectedResponse.ok,'FIXTURE_MISSING');
 const encrypted=await p.arrayBuffer();
 const expected=await expectedResponse.json();
 const file=new File([encrypted],'synthetic-ci-only.p1g',
  {type:'application/octet-stream'});
 const originalSha=await digest(encrypted);
 const att={
  contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,platform:'steam-windows',
  buildKind:'steam-full-version',fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,
  schema:626,originalSha256:originalSha,
  evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false
 };
 const noAtt=await request('OPEN_LOCAL_V1',{file,attestation:null});
 ensure(!noAtt.ok&&noAtt.error==='OWNER_LOCAL_WAIT_BUILD_ATTESTATION_REQUIRED','NO_ATTEST_DENY');
 for(const change of [
  {fullVersion:'unknown'},{fullVersion:'1.25.3'}, {platform:'switch'},
  {schema:624},{buildKind:'switch-bid'},
  {originalSha256:'0'.repeat(64)}, {lastSaveDevice:'DeviceType_Switch'},
  {observedOutsideSave:true},{extraCursor:'untrusted'}
 ]){
  const bad=await request('OPEN_LOCAL_V1',{file,attestation:{...att,...change}});
  ensure(!bad.ok,'BAD_CLAIM_DENIED');
 }
 const corruptFile=new File([encrypted.slice(0,-1)],'bad-ci.p1g');
 const invalidCipher=await request('OPEN_LOCAL_V1',{file:corruptFile,attestation:att});
 ensure(!invalidCipher.ok,'TRUNCATED_CIPHER_DENIED');
 const corrupt=new Uint8Array(encrypted);corrupt[0]^=0x31;
 const changedSha=await digest(corrupt.buffer);
 const invalidZip=await request('OPEN_LOCAL_V1',{
  file:new File([corrupt],'bad-ci.zip'),
  attestation:{...att,originalSha256:changedSha}
 });
 ensure(!invalidZip.ok,'BAD_AES_ZIP_DENIED');
 // Runtime Owner Worker MUST refuse synthetic-only attestation.
 const production=new Worker('../../tools/owner-local-steam-v1/worker.mjs',
  {type:'module'});
 const prodDenied=await new Promise((resolve,reject)=>{
  production.addEventListener('message',e=>resolve(e.data),{once:true});
  production.addEventListener('error',reject,{once:true});
  production.postMessage({kind:'OPEN_LOCAL_V1',requestId:1,file,attestation:att});
 });
 production.terminate();
 ensure(prodDenied.ok===false&&
  prodDenied.error==='OWNER_LOCAL_WAIT_BUILD_SYNTHETIC_NOT_AUTHORIZED',
  'PROD_WORKER_SYNTHETIC_REJECT');
 const started=performance.now();
 const pass=await request('OPEN_LOCAL_V1',{file,attestation:att});
 const elapsed=Math.round(performance.now()-started);
 ensure(pass.ok===true,'P1G_RUST_OPEN_'+pass.error);
 const a=pass.summary;
 ensure(a.schema===626&&a.revision===0&&a.indexGeneration===1&&
  a.fullDocumentJsonValidated===true&&a.sourceShaMatched===true&&
  a.originalSourceSha256===originalSha,'ORIGINAL_SHA_RUST_RECEIPT');
 ensure(a.decodedSha256===expected.decodedSha256,'DECODED_SHA_SOURCE');
 ensure(a.originalSizeBytes===expected.sourceBytes,'ORIGINAL_SIZE');
 ensure(a.physicalBuildCryptographicallyVerified===false&&
  a.externallyAttestedBuildClaim===true&&a.syntheticFixture===true,
  'NO_PHYSICAL_BUILD_PROOF');
 ensure(a.productReadAccepted===false&&a.writerAuthorized===false&&
  a.editedCopyAuthorized===false&&a.applyAuthorized===false&&
  a.cloudUploadPerformed===false&&a.originalFileModified===false,
  'NO_WRITER_OR_CLOUD');
 ensure(Object.keys(a).length<24&&!('jsonText' in a)&&
  !('rawValue' in a)&&!('profile' in a)&&!('decodedBytes' in a),
  'NO_DECODED_JSON_EGRESS');
 ensure(await digest(await file.arrayBuffer())===originalSha,
  'ORIGINAL_FILE_SHA_CHANGED');
 const second=await request('OPEN_LOCAL_V1',{file,attestation:att});
 ensure(second.ok&&second.summary.priorSessionRotated===true&&
  second.summary.sessionId!==a.sessionId,'SESSION_ID_ROTATED');
 const closed=await request('CLOSE_LOCAL_V1');
 ensure(closed.ok&&closed.summary.closed===true,'CLOSE_FAIL');
 const noPost=await fetch('/tools/owner-local-steam-v1/index.html',{method:'POST'});
 ensure(noPost.status===405,'NO_POST_ENDPOINT');
 const inaccessible=await fetch('/package.json');
 ensure(inaccessible.status===403,'ALLOWLIST_DENY');
 // Public CI no longer serves either Owner UI, even if a local copy exists.
 for(const name of ['index.html','page.mjs','dev-read.html','dev-read-page.mjs']){
   for(const method of ['GET','HEAD']){
     const response=await fetch('/tools/owner-local-steam-v1/'+name,{method});
     ensure(response.status===403,'OWNER_UI_NOT_SERVED');
   }
 }
 // Real Worker dependencies remain on the exact same localhost boundary.
 for(const name of ['attestation.mjs','worker-core.mjs','worker.mjs','dev-read.worker.mjs']){
   const response=await fetch('/tools/owner-local-steam-v1/'+name,{method:'HEAD'});
   ensure(response.status===200,'SHARED_WORKER_SOURCE');
   ensure(response.headers.get('x-content-type-options')==='nosniff'&&
     response.headers.get('cache-control')==='no-store'&&
     response.headers.get('content-security-policy')?.includes("connect-src 'self'")&&
     response.headers.get('content-security-policy')?.includes("form-action 'none'"),
     'SHARED_WORKER_SECURITY_HEADERS');
 }
 console.log('ACT559_PUBLIC_CI_OWNER_UI_8DENY_SHARED_4POS_PASS');
 worker.terminate();
 return Object.freeze({
  source:'CI_SYNTHETIC_ONLY',
  liveChromeWorker:true,actualGeneratedRustWasm:true,
  originalShaMatch:true,decodedRustShaMatch:true,externalBuildClaimOnly:true,
  buildCryptographicallyProven:false,schema:626,
  encryptedBytes:expected.sourceBytes,decodedBytes:expected.decodedBytes,
  workerOpenMs:elapsed,sessionRotated:true,negativeClaimsDenied:true,
  genuineOwnerSteamSave:false,realSaveV1Accepted:false,
  rustV2:false,nativeV3:false,
  noPostEndpoint:true,writerAuthorized:false,
  noDecodedJsonPosted:true
 });
};
window.__stageG=synthetic();
