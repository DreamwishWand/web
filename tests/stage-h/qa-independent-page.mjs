// 05 QR-C Stage H independent real generated Rust/WASM Chrome negative suite.
// Only a public synthetic encrypted P1G is used; actual Owner Save never in CI.
import {OWNER_LOCAL_V1_ATTESTATION_CONTRACT, OWNER_LOCAL_STEAM_FULL_VERSION}
  from '../../tools/owner-local-steam-v1/attestation.mjs';
const require=(v,why)=>{if(!v)throw Error('QRC_H_'+why)};
const hash=async buf=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))]
  .map(v=>v.toString(16).padStart(2,'0')).join('');
const start=async()=>{
  require(crypto?.subtle?.digest,'NO_CRYPTO');
  const [fileResp,expectedResp]=await Promise.all([
    fetch('/tests/stage-f/fixtures/synthetic626.p1g',{cache:'no-store'}),
    fetch('/tests/stage-f/fixtures/expected.json',{cache:'no-store'})
  ]);
  require(fileResp.ok&&expectedResp.ok,'SYNTHETIC_FILE_MISSING');
  const source=await fileResp.arrayBuffer();
  const expected=await expectedResp.json();
  require(expected.syntheticOnly===true&&source.byteLength===expected.sourceBytes&&
    source.byteLength>0&&source.byteLength<1024*1024&&expected.decodedBytes>1048576,
    'PUBLIC_SYNTHETIC_MULTI_CHUNK');
  const sourceSha=await hash(source);
  const file=new File([source],'public-ci-synthetic.p1g');
  const attestation={contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
    platform:'steam-windows',buildKind:'steam-full-version',
    fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,
    originalSha256:sourceSha,evidenceKind:'ci-synthetic-fixture',
    observedOutsideSave:false
  };
  const worker=new Worker('./worker.mjs',{type:'module'});
  let counter=0;
  const messages=new Map();
  worker.addEventListener('message',({data})=>{
    const handler=messages.get(data?.requestId);
    if(handler){messages.delete(data.requestId);handler(data)}
  });
  const request=(kind,args={})=>new Promise(resolve=>{
    const requestId=++counter;
    messages.set(requestId,resolve);
    worker.postMessage({kind,requestId,...args});
  });
  const refused=(v,label)=>require(v?.ok===false&&!('summary' in v) &&
    /^OWNER_LOCAL_[A-Z0-9_]+$/.test(v.error||''),'DENY_'+label+'_'+v?.error);
  const checkPage=(r,domain,index,count,next)=>{
    require(r?.ok===true,'MISSING_PAGE_'+domain+'_'+index+'_'+r?.error);
    const s=r.summary;
    require(s.contract==='wand.owner.local.dev-read-metadata@1'&&
      s.domain===(domain==='player'?'/Player':'/World')&&
      s.pageIndex===index&&s.nextPageIndex===next,'BAD_PAGE_HEADER');
    require(s.fields.length===count&&count<=16,'NOT_BOUNDED_16');
    require(s.fields.every(f=>Object.keys(f).sort().join(',')==='key,kind,valueBytes'&&
      typeof f.key==='string'&&typeof f.kind==='string'&&
      Number.isSafeInteger(f.valueBytes)&&f.valueBytes>=0),'INVALID_FIELD_TRIPLE');
    const allowed=['contract','domain','pageIndex','fields','nextPageIndex',
      'coreOwnedSession','fullDocumentJsonValidated',
      'physicalBuildCryptographicallyVerified','productReadAccepted','writerAuthorized',
      'editedCopyAuthorized','applyAuthorized'].sort().join(',');
    require(Object.keys(s).sort().join(',')===allowed,'LEAKED_ADDITIONAL_RECEIPT_FIELDS');
    require(s.coreOwnedSession===true&&s.fullDocumentJsonValidated===true&&
      s.physicalBuildCryptographicallyVerified===false&&
      s.productReadAccepted===false&&s.writerAuthorized===false&&
      s.editedCopyAuthorized===false&&s.applyAuthorized===false,'UNAUTHORIZED_GRANT');
    require(!JSON.stringify(s).includes(sourceSha)&&
      !JSON.stringify(s).includes(expected.decodedSha256)&&
      JSON.stringify(s).length<6000,'JSON_VALUE_OR_SHA_LEAK');
    return s.fields.map(f=>f.key);
  };
  try{
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:0}),'BEFORE_OPEN');
    refused(await request('OPEN_LOCAL_V1',{file,
      attestation:{...attestation,fullVersion:'1.25.3'}}),'UNKNOWN_BUILD');
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:0}),'AFTER_BAD_OPEN');
    const begin=performance.now();
    const opened=await request('OPEN_LOCAL_V1',{file,attestation});
    const openMs=Math.round(performance.now()-begin);
    require(opened.ok===true,'RUST_OPEN_'+opened.error);
    const receipt=opened.summary;
    require(receipt.schema===626&&receipt.fullDocumentJsonValidated===true&&
      receipt.originalSourceSha256===sourceSha&&
      receipt.decodedSha256===expected.decodedSha256&&
      receipt.writerAuthorized===false&&receipt.productReadAccepted===false&&
      receipt.physicalBuildCryptographicallyVerified===false,'OPEN_RECEIPT');

    const badArgs=[
      {domain:'/Player',pageIndex:0}, {domain:'Quest',pageIndex:0},
      {domain:'world/Private',pageIndex:0}, {domain:'',pageIndex:0},
      {domain:'player',pageIndex:-1}, {domain:'player',pageIndex:128},
      {domain:'player',pageIndex:1}, {domain:'player',pageIndex:1.5},
      {domain:'player',pageIndex:'0'}, {domain:'player',pageIndex:NaN},
      {domain:'player'}, {pageIndex:0}, {domain:'player',pageIndex:0,cursor:'0'.repeat(32)},
      {domain:'player',pageIndex:0,cursor:'f'.repeat(32)},
      {domain:'player',pageIndex:0,revision:receipt.revision},
      {domain:'player',pageIndex:0,revision:receipt.revision+1},
      {domain:'player',pageIndex:0,indexGeneration:receipt.indexGeneration},
      {domain:'player',pageIndex:0,sessionId:receipt.sessionId},
      {domain:'player',pageIndex:0,readset:'/Player/Secrets'},
      {domain:'player',pageIndex:0,readSet:'/'},
      {domain:'player',pageIndex:0,decodedSha256:expected.decodedSha256},
      {domain:'player',pageIndex:0,sourceSha256:sourceSha},
      {domain:'player',pageIndex:0,fields:[{key:'private'}]},
      {domain:'player',pageIndex:0,writerAuthorized:true},
      {domain:'player',pageIndex:0,rawJSON:'{}'},
      {domain:'player',pageIndex:0,path:'/Player'}
    ];
    for(let i=0;i<badArgs.length;i++)
      refused(await request('DEV_READ_METADATA',badArgs[i]),'FORGED_'+i);
    // Two same-page requests: exactly one consumes the Rust one-use cursor.
    const [first,duplicate]=await Promise.all([
      request('DEV_READ_METADATA',{domain:'player',pageIndex:0}),
      request('DEV_READ_METADATA',{domain:'player',pageIndex:0})
    ]);
    let keys=checkPage(first,'player',0,16,1);
    refused(duplicate,'PARALLEL_REPLAY_0');
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:2}),'SKIP_PAGE_2');
    keys.push(...checkPage(await request('DEV_READ_METADATA',{domain:'player',pageIndex:1}),
      'player',1,16,2));
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:0}),'BACKTRACK_PAGE');
    keys.push(...checkPage(await request('DEV_READ_METADATA',{domain:'player',pageIndex:2}),
      'player',2,1,null));
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:3}),'PLAYER_EOF');
    require(keys.length===33&&keys[0]==='field_000'&&keys.at(-1)==='field_032'&&
      new Set(keys).size===33,'PLAYER_ENUMERATION');
    const world=checkPage(await request('DEV_READ_METADATA',{domain:'world',pageIndex:0}),
      'world',0,2,null);
    refused(await request('DEV_READ_METADATA',{domain:'world',pageIndex:0}),'WORLD_REPLAY');
    refused(await request('DEV_READ_METADATA',{domain:'world',pageIndex:1}),'WORLD_EOF');
    require(world.length===2,'WORLD_COUNT');
    // Accepted default owner-local Worker is NOT authorized for DEV dispatch.
    const normal=new Worker('../../tools/owner-local-steam-v1/worker.mjs',{type:'module'});
    const disabled=await new Promise((resolve,reject)=>{
      normal.addEventListener('message',e=>resolve(e.data),{once:true});
      normal.addEventListener('error',reject,{once:true});
      normal.postMessage({kind:'DEV_READ_METADATA',requestId:1,domain:'player',pageIndex:0});
    });
    normal.terminate();
    refused(disabled,'NORMAL_WORKER_OFF');
    require(disabled.error==='OWNER_LOCAL_DEV_READ_DISABLED','NORMAL_NOT_DISABLED');
    const nextOpen=await request('OPEN_LOCAL_V1',{file,attestation});
    require(nextOpen.ok===true&&nextOpen.summary.sessionId!==receipt.sessionId,
      'REOPEN_SESSION_REUSED');
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:2}),
      'STALENESS_AFTER_REOPEN');
    checkPage(await request('DEV_READ_METADATA',{domain:'player',pageIndex:0}),
      'player',0,16,1);
    const stop=await request('CLOSE_LOCAL_V1');
    require(stop.ok===true&&stop.summary.closed===true,'CLOSE_FAIL');
    refused(await request('DEV_READ_METADATA',{domain:'player',pageIndex:1}),'CLOSED_REPLAY');
    refused(await request('DEV_READ_METADATA',{domain:'world',pageIndex:0}),'CLOSED_WORLD');
    const newOpen=await request('OPEN_LOCAL_V1',{file,attestation});
    require(newOpen.ok===true&&newOpen.summary.sessionId!==nextOpen.summary.sessionId,
      'CLOSE_REOPEN_SESSION');
    checkPage(await request('DEV_READ_METADATA',{domain:'world',pageIndex:0}),
      'world',0,2,null);
    await request('CLOSE_LOCAL_V1');
    require(await hash(await file.arrayBuffer())===sourceSha,'ORIGINAL_ENCRYPTED_CHANGED');
    // Local server only; no POST/Upload endpoint and normal HTTP GET deny.
    const noPost=await fetch('/tools/owner-local-steam-v1/dev-read.html',
      {method:'POST',body:'not-a-save'});
    const noSecrets=await fetch('/package.json');
    require(noPost.status===405 && noSecrets.status===403,'LOCAL_HTTP_AUTH');
    return Object.freeze({
      operation:'DEV_LOCAL_TYPED_METADATA_ONLY',source:'PUBLIC_SYNTHETIC_P1G_ONLY',
      generatedRustWasmChromeWorker:true,existingSingleRustSession:true,
      decodedRustSHAValidated:true,originalSHAUnmodified:true,
      playerFields:33,worldFields:2,pageSizeMax:16,
      workerOwnedCursorNoUiToken:true,missingBuildDenied:true,
      forgedScopeDenied:true,pageReplayDenied:true,revokedOnReopenAndClose:true,
      normalOwnerWorkerMetadataDisabled:true,
      encryptedBytes:expected.sourceBytes,decodedBytes:expected.decodedBytes,
      rustOpenMs:openMs,typedPagesMs:0,
      productReadAccepted:false,writerAuthorized:false,applyAuthorized:false,
      realOwnerSteamSave:false,realSaveV1Accepted:false,
      nativeV3:false,cloudUploadPerformed:false
    });
  }finally{worker.terminate()}
};
window.__stageH=start();
