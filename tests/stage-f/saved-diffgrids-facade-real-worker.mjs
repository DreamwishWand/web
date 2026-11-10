// PUBLIC SYNTHETIC ONLY. This test executes in the EXISTING real Chrome
// Module Worker with ACTUAL generated Rust WASM + existing P1G Codec.
import {createLocalSteamP1gSavedDiffGridsFacade,
  LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT}
 from '../../src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs';
import {validateOwnerLocalSteamAttestation,OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
  OWNER_LOCAL_STEAM_FULL_VERSION}
 from '../../tools/owner-local-steam-v1/attestation.mjs';

export async function testRealEncryptedSavedDiffGridsFacade(WorkerWasmSource){
 const check=(yes,code)=>{if(!yes)throw Error('STAGEF_DIFFGRIDS_'+code)};
 const response=await Promise.all([
   fetch('./fixtures/synthetic626-diffgrids.p1g',{cache:'no-store'}),
   fetch('./fixtures/expected-diffgrids.json',{cache:'no-store'})
 ]);
 check(response.every(x=>x.ok),'SYNTHETIC_FIXTURE_MISSING');
 const fileBytes=new Uint8Array(await response[0].arrayBuffer());
 const expected=await response[1].json();
 check(expected.syntheticOnly===true&&expected.recordCount===17&&
   fileBytes.length===expected.sourceBytes,'FIXTURE_IDENTITY');
 const blob=new Blob([fileBytes],{type:'application/octet-stream'});
 const wasmFactory=async()=>({WorkerWasmSource});
 const facade=createLocalSteamP1gSavedDiffGridsFacade({
   wasmFactory,validateExternalAttestation:validateOwnerLocalSteamAttestation,
   allowSyntheticFixture:true // ONLY in synthetic CI Worker, never product
 });
 let id=200;
 const attestation={
   contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
   platform:'steam-windows',buildKind:'steam-full-version',
   fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,
   originalSha256:expected.originalSha256,evidenceKind:'ci-synthetic-fixture',
   observedOutsideSave:false
 };
 const open=(changed={})=>({
   kind:'OPEN_LOCAL_STORED_DIFFGRIDS',requestId:++id,
   file:blob,attestation,expectedEncryptedSizeBytes:blob.size,...changed
 });
 const call=async data=>{
   let result=null,replyCount=0;
   await facade.handleMessage(data,x=>{result=x;replyCount++});
   check(replyCount===1,'ONE_WORKER_MESSAGE_REPLY');
   check(result.requestId===data.requestId,'REQUEST_ID_RETAINED');
   return result;
 };
 const first=await call(open());
 check(first.ok===true,'OPEN_FIRST');
 const a=first.summary;
 check(a.contract===LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT&&
   a.recordCount===17&&a.maxRecordsPerPage===8&&
   a.sourceShaMatched===true&&a.originalSizeMatched===true&&
   a.fullDocumentValidated===true,'OPEN_PROVENANCE');
 check(a.physicalBuildCryptographicallyVerified===false&&
   a.productReadAccepted===false&&a.writerAuthorized===false,'OPEN_GATE');
 const oldSelection=a.selection;
 // After A→B, A's opaque UI selection epoch is stale. Neither replay READ
 // nor a late CLOSE from A can read/revoke B's Rust ProductSession.
 const second=await call(open());
 check(second.ok===true&&second.summary.selection!==oldSelection,'AB_REOPEN_NEW_SELECTION');
 const b=second.summary;
 const staleRead=await call({
   kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId:++id,
   selection:oldSelection,pageIndex:0
 });
 check(staleRead.ok===false&&staleRead.error==='LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY',
   'AB_OLD_READ_REJECTED');
 const staleClose=await call({
   kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId:++id,selection:oldSelection
 });
 check(staleClose.ok===false&&staleClose.error==='LOCAL_DIFFGRIDS_STALE_SELECTION',
   'AB_OLD_CLOSE_REJECTED');
 let pageIndex=0;
 const pageCounts=[];
 let overlaps=0;
 let firstGridZero=false;
 for(let n=0;n<3;n++){
   const r=await call({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
     requestId:++id,selection:b.selection,pageIndex});
   check(r.ok===true,'PAGE_'+n);
   const p=r.summary;
   check(p.contract===LOCAL_STEAM_DIFFGRIDS_FACADE_CONTRACT&&
     p.pageIndex===n&&p.selection===b.selection&&
     p.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&
     !p.allNativeReferencesVerified&&!p.productReadAccepted&&
     !p.nativeV3Verified&&!p.writerAuthorized&&!p.applyAuthorized&&
     !p.cloudUploadPerformed,'PAGE_SCOPE_AND_GATE');
   const expectedCount=n===2?1:8;
   check(p.records.length===expectedCount,'PAGE_8_8_1');
   for(const row of p.records){
     check(Object.keys(row).sort().join(',')===
       'defaultGridDataHashCode,defaultGridHashCode,defaultLayoutGridId,externalLayoutStatus,gridId,modifiedObjectCount,modifiedRemovedSameIdPairs,nativeEffectiveGridVerified,removedObjectCount',
       'STRICT_WHITELIST_PROJECTION');
     check(row.defaultGridHashCode===-37&&row.defaultGridDataHashCode===624&&
       row.modifiedObjectCount===2&&row.removedObjectCount===2&&
       row.modifiedRemovedSameIdPairs===1&&
       row.externalLayoutStatus==='UNRESOLVED_EXTERNAL_LAYOUT'&&
       row.nativeEffectiveGridVerified===false,'SAVED_TYPED_METADATA');
     overlaps+=row.modifiedRemovedSameIdPairs;
   }
   if(n===0)firstGridZero=p.records[0].gridId===0&&
     p.records[0].defaultLayoutGridId===0;
   const serialized=JSON.stringify(r);
   for(const prohibited of ['PRIVATE_SYNTHETIC_PATH_NEVER_TO_UI',
     'PRIVATE_SYNTHETIC_OBJECT_NEVER_TO_UI',
     'OPAQUE_SYNTHETIC_NEVER_TO_UI',
     'Synth.NativeType','SynthAssembly','modifiedObjectIds',
     'removedObjectIds','nextCursor','decodedSha256','sessionId',
     'gridDefaultLayoutPath','gridDefaultLayoutType','readset',
     expected.originalSha256,expected.decodedSha256]){
     check(!serialized.includes(prohibited),'NO_PRIVATE_WORKER_BOUNDARY_LEAK');
   }
   pageCounts.push(p.records.length);
   check(p.nextPageIndex===(n===2?null:n+1),'NEXT_PAGE_ONLY');
   const replay=await call({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
     requestId:++id,selection:b.selection,pageIndex});
   check(replay.ok===false&&replay.error==='LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY',
     'PAGE_REPLAY_DENIED');
   pageIndex=n+1;
 }
 check(firstGridZero,'GRID_ZERO_LITERAL_NOT_LEGALIZED');
 check(pageCounts.join(',')==='8,8,1'&&overlaps===17,'TOTAL_COUNTS');
 const afterEnd=await call({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
   requestId:++id,selection:b.selection,pageIndex:3});
 check(afterEnd.ok===false,'EOF_DENIED');
 const closed=await call({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',
   requestId:++id,selection:b.selection});
 check(closed.ok&&closed.summary.closed===true,'CLOSE_REVOKES');
 const afterClose=await call({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
   requestId:++id,selection:b.selection,pageIndex:3});
 check(afterClose.ok===false,'READ_AFTER_CLOSE_DENIED');
 // Any invalid new OPEN revokes prior receipt; no misread through an old scope.
 const invalid=[
   {attestation:{...attestation,fullVersion:'unknown'}},
   {attestation:{...attestation,platform:'switch'}},
   {attestation:{...attestation,schema:624}},
   {attestation:{...attestation,originalSha256:'0'.repeat(64)}},
   {attestation:{...attestation,observedOutsideSave:true}},
   {expectedEncryptedSizeBytes:blob.size+16},
   {file:new Blob([fileBytes.subarray(0,fileBytes.length-1)])},
   {unexpectedWriter:true},
 ];
 for(const bad of invalid){
   const denied=await call(open(bad));
   check(denied.ok===false&&denied.error==='LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED',
     'INVALID_OPEN_FAIL_CLOSED');
 }
 const noWrites=await call({kind:'WRITE',requestId:++id});
 check(noWrites.ok===false&&noWrites.error==='LOCAL_DIFFGRIDS_OPERATION_DISABLED',
   'WRITE_DISABLED');
 // Concurrent A/B OPEN should not deliver stale A as a successful receipt.
 const promises=[];
 for(let i=0;i<2;i++){
   const req=open();
   promises.push(call(req));
 }
 const [raceA,raceB]=await Promise.all(promises);
 check(raceA.ok===false&&raceB.ok===true,'CONCURRENT_AB_STALE_OPEN_DENIED');
 const finalClose=await call({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',
   requestId:++id,selection:raceB.summary.selection});
 check(finalClose.ok,'CONCURRENT_SESSION_CLOSED');
 facade.close();
 return Object.freeze({
   source:'public-synthetic-generated-p1g',
   sameChromeModuleWorker:true,realGeneratedRustWasm:true,
   existingP1gCodec:true,sameProductSession:true,
   pages:pageCounts,records:17,gridId0LiteralUnresolved:firstGridZero,
   ABStaleReadAndCloseDenied:true,concurrentStaleOpenDenied:true,
   replayAndClosedDenied:true,sourceShaAndSizeChecked:true,
   metadataOnlyToUI:true,allNativeReferencesVerified:false,
   productReadAccepted:false,writerAuthorized:false,
   realSteamOwnerP1gTested:false
 });
}
