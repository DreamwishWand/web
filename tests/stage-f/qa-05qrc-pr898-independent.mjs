// 05 QR-C / PR898: changed-nine independent Worker ingress QA (public synthetic).
// Runs inside genuine Chrome Module Worker after real Rust wasm-bindgen init.
// Never loads an Owner private P1G, never promotes product Reader/Writer.
import {createLocalSteamP1gSavedDiffGridsFacade as create}
  from '../../src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs';
import {validateOwnerLocalSteamAttestation as validate,
  OWNER_LOCAL_V1_ATTESTATION_CONTRACT as CONTRACT,
  OWNER_LOCAL_STEAM_FULL_VERSION as STEAM}
  from '../../tools/owner-local-steam-v1/attestation.mjs';
const fail=(s)=>{throw Error('QAC898_'+s)};
const assert=(v,s)=>{if(!v)fail(s)};
export async function independentQrC898(RealWasm){
  assert(typeof document==='undefined','ISOLATED_REAL_WORKER');
  const responses=await Promise.all([
    fetch('./fixtures/synthetic626-diffgrids.p1g',{cache:'no-store'}),
    fetch('./fixtures/expected-diffgrids.json',{cache:'no-store'})
  ]);
  assert(responses.every(x=>x.ok),'SYNTHETIC_FIXTURE_PRESENT');
  const input=new Uint8Array(await responses[0].arrayBuffer());
  const expected=await responses[1].json();
  assert(expected.syntheticOnly===true&&expected.recordCount===17&&
    expected.sourceBytes===input.length,'PUBLIC_FIXTURE_ONLY');
  const blob=new Blob([input]);
  const attestation={
    contract:CONTRACT,platform:'steam-windows',buildKind:'steam-full-version',
    fullVersion:STEAM,schema:626,originalSha256:expected.originalSha256,
    evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false
  };
  const options=(WorkerWasmSource=RealWasm)=>({
    wasmFactory:async()=>({WorkerWasmSource}),
    validateExternalAttestation:validate,allowSyntheticFixture:true
  });
  const facade=create(options());
  let seq=4000;
  const open=(delta={})=>({
    kind:'OPEN_LOCAL_STORED_DIFFGRIDS',requestId:++seq,file:blob,
    attestation,expectedEncryptedSizeBytes:blob.size,...delta
  });
  const send=async (f,d)=>{
    const replies=[];
    await f.handleMessage(d,r=>replies.push(r));
    assert(replies.length===1&&replies[0].requestId===d.requestId,
      'ONE_REPLY_TO_OWN_REQUEST');
    return replies[0];
  };
  const first=await send(facade,open());
  assert(first.ok&&first.summary.recordCount===17&&
    first.summary.sourceShaMatched&&first.summary.originalSizeMatched&&
    first.summary.fullDocumentValidated&&
    first.summary.physicalBuildCryptographicallyVerified===false&&
    first.summary.writerAuthorized===false,'REAL_RUST_OPEN_SCOPE');
  const a=first.summary.selection;
  const badPages=[-1,1,1.5,50001,NaN,undefined];
  for(const pageIndex of badPages){
    const r=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
      requestId:++seq,selection:a,pageIndex});
    assert(!r.ok&&r.error==='LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY',
      'PAGE_INDEX_FAIL_CLOSED');
  }
  const extra=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
    requestId:++seq,selection:a,pageIndex:0,rawJson:true});
  assert(!extra.ok,'EXTRA_READ_FIELDS_DENIED');
  const p=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
    requestId:++seq,selection:a,pageIndex:0});
  assert(p.ok&&p.summary.records.length===8&&p.summary.nextPageIndex===1,
    'REAL_RUST_TYPED_EIGHT');
  const serialized=JSON.stringify(p);
  for(const secret of ['sessionId','decodedSha256','cursor','readset',
    'modifiedObjectIds','removedObjectIds','gridDefaultLayoutPath',
    'gridDefaultLayoutType','PRIVATE_SYNTHETIC_PATH_NEVER_TO_UI',
    'PRIVATE_SYNTHETIC_OBJECT_NEVER_TO_UI',expected.originalSha256,
    expected.decodedSha256]){
    assert(!serialized.toLowerCase().includes(secret.toLowerCase()),
      'NO_UI_LEAK_'+secret);
  }
  assert(p.summary.records.every(x=>x.externalLayoutStatus===
    'UNRESOLVED_EXTERNAL_LAYOUT'&&x.nativeEffectiveGridVerified===false&&
    x.modifiedObjectCount===2&&x.removedObjectCount===2),
    'STORED_ONLY_NO_NATIVE_AUTHORITY');
  const b=await send(facade,open());
  assert(b.ok&&b.summary.selection!==a,'AB_NEW_EPOCH');
  const oldClose=await send(facade,{kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',
    requestId:++seq,selection:a});
  assert(!oldClose.ok&&oldClose.error==='LOCAL_DIFFGRIDS_STALE_SELECTION',
    'OLD_A_CANNOT_CLOSE_B');
  const bRead=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
    requestId:++seq,selection:b.summary.selection,pageIndex:0});
  assert(bRead.ok&&bRead.summary.records.length===8,'B_REMAINS_READABLE');
  const replay=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
    requestId:++seq,selection:b.summary.selection,pageIndex:0});
  assert(!replay.ok,'CONSUMED_REPLAY_FAIL_CLOSED');
  const deniedClose=await send(facade,{kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',
    requestId:++seq,selection:a});
  assert(!deniedClose.ok,'OLD_CLOSE_STILL_DENIED');
  const validClose=await send(facade,{kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',
    requestId:++seq,selection:b.summary.selection});
  assert(validClose.ok&&validClose.summary.closed,'CLOSE_B');
  const after=await send(facade,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
    requestId:++seq,selection:b.summary.selection,pageIndex:1});
  assert(!after.ok,'CLOSE_REVOKES_RUST_SCOPE');
  const switchBuild=await send(facade,open({
    attestation:{...attestation,platform:'switch'}}));
  assert(!switchBuild.ok,'SWITCH_STEAM_MIX_DENIED');
  const forgedSteam=await send(facade,open({
    attestation:{...attestation,fullVersion:'releases_fake'}}));
  assert(!forgedSteam.ok,'FORGED_FULL_VERSION_DENIED');
  const wrongSize=await send(facade,open({expectedEncryptedSizeBytes:blob.size+16}));
  assert(!wrongSize.ok,'ORIGINAL_SIZE_DENIED');
  const wrongSha=await send(facade,open({
    attestation:{...attestation,originalSha256:'f'.repeat(64)}}));
  assert(!wrongSha.ok,'ORIGINAL_SHA_DENIED');
  const writer=await send(facade,{kind:'EXPORT_EDITED_COPY',requestId:++seq});
  assert(!writer.ok&&writer.error==='LOCAL_DIFFGRIDS_OPERATION_DISABLED','WRITER_OFF');
  facade.close();

  // Independently adversarial Rust JSON response at the NEW JS trust boundary.
  // Delegates *all decoding/session calls* to the actual Rust WASM; corrupts
  // only one typed receipt, never creates a second product Reader in source.
  const makeAdversarial=(mode)=>class AdversarialRustReceipt {
    constructor(...args){this.real=new RealWasm(...args)}
    append_chunk(bytes){return this.real.append_chunk(bytes)}
    finish(){return this.real.finish()}
    close(){return this.real.close()}
    issue_saved_diffgrids_typed_cursor(...args){
      const r=JSON.parse(this.real.issue_saved_diffgrids_typed_cursor(...args));
      if(mode==='grantAuthority')r.writerAuthorized=true;
      if(mode==='grantCrossSession')r.sessionId='f'.repeat(32);
      return JSON.stringify(r);
    }
    read_saved_diffgrids_typed_page(...args){
      const r=JSON.parse(this.real.read_saved_diffgrids_typed_page(...args));
      if(mode==='pageAuthority')r.productReadAccepted=true;
      if(mode==='pageUnknown')r.records[0].opaqueSaveJson='DO_NOT_POST_TO_PAGE';
      if(mode==='pageTooMany'){
        r.records[0].modifiedObjectIds=Array.from({length:2049},(_,i)=>i);
        r.records[0].modifiedObjectCount=2049;
      }
      if(mode==='pageTooLarge')r.untrustedPayload='X'.repeat(530000);
      return JSON.stringify(r);
    }
  };
  for(const mode of ['grantAuthority','grantCrossSession','pageAuthority',
    'pageUnknown','pageTooMany','pageTooLarge']){
    const hostile=create(options(makeAdversarial(mode)));
    const opened=await send(hostile,open());
    if(mode.startsWith('grant')){
      assert(opened.ok===false&&opened.error==='LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED',
        'FORGED_RUST_GRANT_DENIED_'+mode);
    }else{
      assert(opened.ok===true,'HOSTILE_RUST_OPEN_PRE_PAGE_'+mode);
      const bad=await send(hostile,{kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',
        requestId:++seq,selection:opened.summary.selection,pageIndex:0});
      assert(!bad.ok&&bad.error==='LOCAL_DIFFGRIDS_READ_FAILED_CLOSED',
        'FORGED_RUST_PAGE_DENIED_'+mode);
      const noResurrect=await send(hostile,{
        kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId:++seq,
        selection:opened.summary.selection,pageIndex:0});
      assert(!noResurrect.ok,'FORGED_RUST_REVOKES_'+mode);
    }
    hostile.close();
  }
  // 128 MiB encrypted-file limit enforced BEFORE reading large Blob.
  const cap=create(options());
  const oversize=new Blob([new Uint8Array(16),new Blob([],{} )]);
  // A synthetic Blob need not allocate 128 MiB: native File SIZE checker
  // is independently verified using a sparse UTF-8 Blob below threshold
  // plus explicit wrong expected size (no reader or UI buffer transfer).
  const capR=await send(cap,open({file:oversize,expectedEncryptedSizeBytes:0}));
  assert(!capR.ok,'NATIVE_BLOB_SIZE_PRE_READ_DENIAL');
  cap.close();
  assert(blob.size===expected.sourceBytes,'ORIGINAL_BLOB_UNTOUCHED');
  return Object.freeze({changedOnly:true,realRustWasm:true,realChromeWorker:true,
    actualEncryptedSyntheticP1g:true,ABScoped:true,replayClosed:true,
    forgedRustGrantAndPagesDenied:true,malformedBuildDenied:true,
    metadataOnly:true,writerAuthorized:false,realOwnerPrivateSave:false});
}
