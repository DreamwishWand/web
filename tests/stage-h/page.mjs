// Stage H: ACTUAL Chrome Module Worker + generated Rust WASM, synthetic only.
// This CI page creates only a publicly generated test P1G File. No real Save.
import {OWNER_LOCAL_V1_ATTESTATION_CONTRACT,OWNER_LOCAL_STEAM_FULL_VERSION}
 from '../../tools/owner-local-steam-v1/attestation.mjs';
const assert=(value,message)=>{if(!value)throw Error('STAGE_H_'+message)};
const worker=new Worker('./worker.mjs',{type:'module'});
let requestId=0;
const listeners=new Map();
worker.addEventListener('message',({data})=>{
 const pending=listeners.get(data?.requestId);
 if(pending){listeners.delete(data.requestId);pending(data)}
});
const send=(kind,rest={})=>new Promise(resolve=>{
 const id=++requestId;
 listeners.set(id,resolve);
 worker.postMessage({kind,requestId:id,...rest});
});
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(v=>v.toString(16).padStart(2,'0')).join('');
const denied=(r,reason)=>assert(r?.ok===false,reason);
async function run(){
 assert(typeof crypto?.subtle?.digest==='function','NO_BROWSER_WEBCRYPTO');
 const p=await fetch('/tests/stage-f/fixtures/synthetic626.p1g');
 const expectedResp=await fetch('/tests/stage-f/fixtures/expected.json');
 assert(p.ok&&expectedResp.ok,'NO_SYNTHETIC_P1G');
 const encrypted=await p.arrayBuffer();
 const expected=await expectedResp.json();
 const originalSha=await digest(encrypted);
 const file=new File([encrypted],'ci-public-synthetic-only.p1g');
 const attestation={
   contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
   platform:'steam-windows',buildKind:'steam-full-version',
   fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,
   schema:626,originalSha256:originalSha,
   evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false
 };
 denied(await send('DEV_READ_METADATA',{domain:'player',pageIndex:0}),
   'READ_WITHOUT_RUST_SESSION');
 denied(await send('OPEN_LOCAL_V1',{file,attestation:{
   ...attestation,fullVersion:'unknown'}}),'NO_UNKNOWN_BUILD');
 const openStart=performance.now();
 const initial=await send('OPEN_LOCAL_V1',{file,attestation});
 const openMs=Math.round(performance.now()-openStart);
 assert(initial?.ok===true,'OPEN_FAIL_'+initial?.error);
 const receipt=initial.summary;
 assert(receipt.fullDocumentJsonValidated===true&&receipt.schema===626,
   'RUST_DOCUMENT_VALIDATION');
 assert(receipt.decodedSha256===expected.decodedSha256&&
   receipt.originalSourceSha256===originalSha,'ORIGINAL_AND_DECODED_SHA');
 assert(receipt.productReadAccepted===false&&receipt.writerAuthorized===false&&
   receipt.applyAuthorized===false&&
   receipt.physicalBuildCryptographicallyVerified===false,'OWNER_PRODUCT_GATE');
 const bad=[
   {domain:'/Player',pageIndex:0},{domain:'world/Secrets',pageIndex:0},
   {domain:'player',pageIndex:-1},{domain:'player',pageIndex:128},
   {domain:'player',pageIndex:1},
   {domain:'player',pageIndex:0,cursor:'0'.repeat(32)},
   {domain:'player',pageIndex:0,sessionId:receipt.sessionId},
   {domain:'player',pageIndex:0,revision:receipt.revision},
   {domain:'player',pageIndex:0,readset:'/Player/Private'}
 ];
 for(const v of bad)denied(await send('DEV_READ_METADATA',v),'FORGED_DEV_METADATA');
 const keys=[];
 const begin=performance.now();
 for(let pageIndex=0;pageIndex<3;pageIndex++){
   const r=await send('DEV_READ_METADATA',{domain:'player',pageIndex});
   assert(r?.ok===true,'PLAYER_PAGE_'+pageIndex+'_'+r?.error);
   const s=r.summary;
   assert(s.contract==='wand.owner.local.dev-read-metadata@1'&&s.domain==='/Player'&&
     s.pageIndex===pageIndex,'INVALID_DEV_RECEIPT');
   assert(s.productReadAccepted===false&&s.writerAuthorized===false&&
     s.editedCopyAuthorized===false&&s.applyAuthorized===false&&
     s.physicalBuildCryptographicallyVerified===false,'PRODUCT_AUTHORITY_PROMOTED');
   assert(s.fields.length===(pageIndex===2?1:16),'BAD_PAGE_COUNT');
   assert(s.fields.every(f=>Object.keys(f).sort().join(',')==='key,kind,valueBytes'&&
     Number.isSafeInteger(f.valueBytes)&&f.valueBytes>=0),'UNSAFE_FIELD_METADATA');
   assert(!('cursor' in s)&&!('jsonText' in s)&&!('rawValue' in s)&&
     !('profile' in s)&&!('originalSourceSha256' in s),'PRIVATE_BODY_EXPOSED');
   keys.push(...s.fields.map(f=>f.key));
   assert(s.nextPageIndex===(pageIndex===2?null:pageIndex+1),
     'CURSOR_NOT_WORKER_OWNED');
   denied(await send('DEV_READ_METADATA',{domain:'player',pageIndex}),
     'REPLAY_PAGE_ACCEPTED');
 }
 const pagesMs=Math.round(performance.now()-begin);
 assert(keys.length===33&&keys[0]==='field_000'&&
   keys.at(-1)==='field_032','MISSING_TYPED_PLAYER');
 const w=await send('DEV_READ_METADATA',{domain:'world',pageIndex:0});
 assert(w?.ok===true&&w.summary.fields.length===2&&
   w.summary.nextPageIndex===null,'WORLD_METADATA');
 denied(await send('DEV_READ_METADATA',{domain:'world',pageIndex:1}),
   'WORLD_EOF_REPLAY');
 // Accepted StageG owner Worker must never activate this opt-in dispatch.
 const owner=new Worker('../../tools/owner-local-steam-v1/worker.mjs',
   {type:'module'});
 const ownerDenied=await new Promise((resolve,reject)=>{
   owner.addEventListener('message',e=>resolve(e.data),{once:true});
   owner.addEventListener('error',reject,{once:true});
   owner.postMessage({
     kind:'DEV_READ_METADATA',requestId:1,domain:'player',pageIndex:0
   });
 });
 owner.terminate();
 assert(ownerDenied.ok===false&&
   ownerDenied.error==='OWNER_LOCAL_DEV_READ_DISABLED','NORMAL_OWNER_DISPATCH_ON');
 const second=await send('OPEN_LOCAL_V1',{file,attestation});
 assert(second?.ok===true&&second.summary.sessionId!==receipt.sessionId,
   'NEW_RUST_SESSION_REUSED');
 denied(await send('DEV_READ_METADATA',{domain:'player',pageIndex:2}),
   'STALE_PAGE_RESTORED_AFTER_REOPEN');
 const start=await send('DEV_READ_METADATA',{domain:'player',pageIndex:0});
 assert(start.ok===true,'NEW_SESSION_NOT_READABLE');
 const closed=await send('CLOSE_LOCAL_V1');
 assert(closed.ok===true&&closed.summary.closed===true,'RUST_CLOSE');
 denied(await send('DEV_READ_METADATA',{domain:'player',pageIndex:1}),
   'READ_AFTER_CLOSE');
 assert(await digest(await file.arrayBuffer())===originalSha,
   'ORIGINAL_CIPHERTEXT_MODIFIED');
 worker.terminate();
 return Object.freeze({
   operation:'DEV_LOCAL_TYPED_METADATA_ONLY',
   source:'PUBLIC_SYNTHETIC_P1G_ONLY',
   generatedRustWasmChromeWorker:true,existingSingleRustSession:true,
   decodedRustSHAValidated:true,originalSHAUnmodified:true,
   playerFields:keys.length,worldFields:w.summary.fields.length,
   pageSizeMax:16,workerOwnedCursorNoUiToken:true,
   missingBuildDenied:true,forgedScopeDenied:true,pageReplayDenied:true,
   revokedOnReopenAndClose:true,
   normalOwnerWorkerMetadataDisabled:true,
   encryptedBytes:expected.sourceBytes,decodedBytes:expected.decodedBytes,
   rustOpenMs:openMs,typedPagesMs:pagesMs,
   productReadAccepted:false,writerAuthorized:false,
   applyAuthorized:false,realOwnerSteamSave:false,realSaveV1Accepted:false,
   nativeV3:false,cloudUploadPerformed:false
 });
}
window.__stageH=run();
