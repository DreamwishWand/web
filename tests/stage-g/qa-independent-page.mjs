// 05 QR-C independent actual Chrome Stage G: all fixtures PUBLIC SYNTHETIC.
// CI temporarily uses this at the existing allowlisted tests/stage-g/page.mjs route.
// This QA-only file never enters product paths or the sole 09 INT source merge.
import {
  OWNER_LOCAL_V1_ATTESTATION_CONTRACT,OWNER_LOCAL_STEAM_FULL_VERSION
} from '../../tools/owner-local-steam-v1/attestation.mjs';

const pass=(x,name)=>{if(!x)throw Error('05QRC_STAGEG_'+name)};
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(n=>n.toString(16).padStart(2,'0')).join('');
const run=async()=>{
  pass(typeof crypto.subtle.digest==='function','WEBCRYPTO_REQUIRED');
  const [sourceRes,expectedRes]=await Promise.all([
    fetch('/tests/stage-f/fixtures/synthetic626.p1g',{cache:'no-store'}),
    fetch('/tests/stage-f/fixtures/expected.json',{cache:'no-store'})
  ]);
  pass(sourceRes.ok&&expectedRes.ok,'CI_SOURCE_MISSING');
  const sourceBytes=await sourceRes.arrayBuffer();
  const expected=await expectedRes.json();
  pass(expected.syntheticOnly&&sourceBytes.byteLength===expected.sourceBytes,
    'SOURCE_SYNTHETIC_ONLY');
  pass(sourceBytes.byteLength>0&&sourceBytes.byteLength<1024*1024&&
    expected.decodedBytes>1024*1024,'NEED_UNICODE_MULTICHUNK_FIXTURE');
  const originalSha=await sha(sourceBytes);
  const f=new File([sourceBytes],'synthetic-only.p1g',
    {type:'application/octet-stream'});
  const att=Object.freeze({
    contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,platform:'steam-windows',
    buildKind:'steam-full-version',fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,
    schema:626,originalSha256:originalSha,
    evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false
  });
  const worker=new Worker('./worker.mjs',{type:'module'});
  let id=0;const pending=new Map();
  worker.addEventListener('message',({data})=>{
    const r=pending.get(data?.requestId);
    if(r){pending.delete(data.requestId);r(data)}
  });
  const msg=(kind,extra={})=>new Promise(resolve=>{
    const requestId=++id;pending.set(requestId,resolve);
    worker.postMessage({requestId,kind,...extra});
  });
  const rejected=async attestation=> {
    const a=await msg('OPEN_LOCAL_V1',{file:f,attestation});
    pass(a.ok===false&&
      /^OWNER_LOCAL_[A-Z0-9_]+$/.test(a.error||''),'FAIL_CLOSED_CLAIM');
    pass(!('summary' in a),'DENIAL_NO_DATA');
  };
  try{
    // Owner-real Worker MUST reject test fixture even on local same-origin.
    const prod=new Worker('../../tools/owner-local-steam-v1/worker.mjs',
      {type:'module'});
    const prodResponse=await new Promise((resolve,reject)=>{
      prod.addEventListener('message',e=>resolve(e.data),{once:true});
      prod.addEventListener('error',reject,{once:true});
      prod.postMessage({requestId:1,kind:'OPEN_LOCAL_V1',file:f,attestation:att});
    });
    prod.terminate();
    pass(prodResponse.ok===false &&
      prodResponse.error==='OWNER_LOCAL_WAIT_BUILD_SYNTHETIC_NOT_AUTHORIZED',
      'PROD_SYNTHETIC_REJECT');

    await rejected(null);
    for(const c of [
      {schema:624},{schema:'626'},{fullVersion:'1.25.3'},
      {fullVersion:'unknown'},{fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION+' '},
      {platform:'switch'},{buildKind:'switch-bid'},
      {originalSha256:'0'.repeat(64)},
      {originalSha256:originalSha.toUpperCase()},
      {evidenceKind:'from-save-device'},{observedOutsideSave:true},
      {lastSaveDevice:'DeviceType_Switch'},
      {newUiCursor:'please-trust-me'},{physicalBuildVerified:true}
    ])await rejected({...att,...c});
    for(const invalid of [
      {kind:'OPEN_LOCAL_V1',file:{size:f.size},attestation:att},
      {kind:'OPEN_LOCAL_V1',file:new Blob(),attestation:att},
      {kind:'OPEN_LOCAL_V1',file:new File([sourceBytes.slice(0,-1)],'broken.p1g'),attestation:att},
      {kind:'OPEN_LOCAL_V1',file:new File([new Uint8Array(16)],'bad.p1g'),attestation:att}
    ]){
      const result=await msg(invalid.kind,{file:invalid.file,attestation:invalid.attestation});
      pass(result.ok===false,'INVALID_FILE_DENIED');
    }
    const altered=new Uint8Array(sourceBytes);altered[0]^=0x25;
    const alteredFile=new File([altered],'altered.p1g');
    const alteredReply=await msg('OPEN_LOCAL_V1',{
      file:alteredFile,attestation:{...att,originalSha256:await sha(altered.buffer)}
    });
    pass(alteredReply.ok===false,'CORRUPT_AES_ZIP_DENIED');

    const start=performance.now();
    const first=await msg('OPEN_LOCAL_V1',{file:f,attestation:att});
    const ms=Math.round(performance.now()-start);
    pass(first.ok===true,'FIRST_OPEN_FAILED_'+first.error);
    const a=first.summary;
    pass(a.contract==='wand.owner.local.steam-p1g-rust-v1.receipt@1' &&
      a.schema===626 && a.originalSourceSha256===originalSha &&
      a.decodedSha256===expected.decodedSha256 && a.fullDocumentJsonValidated===true,
      'RUST_SHA_V1_RECEIPT');
    pass(a.originalSizeBytes===expected.sourceBytes &&
      a.sourceShaMatched===true && a.syntheticFixture===true &&
      a.physicalBuildCryptographicallyVerified===false &&
      a.externallyAttestedBuildClaim===true,'FALSE_PHYSICAL_PROOF');
    for(const k of [
      'productReadAccepted','writerAuthorized','editedCopyAuthorized',
      'applyAuthorized','cloudUploadPerformed','originalFileModified',
      'nativeReferenceClosureVerified'
    ])pass(a[k]===false,'UNAUTHORIZED_FLAG_'+k);
    pass(!('profile' in a)&&!('jsonText' in a)&&!('decodedBytes' in a)&&
      JSON.stringify(a).length<1500,'RECEIPT_PAYLOAD_LEAK');
    pass(await sha(await f.arrayBuffer())===originalSha,'ORIGINAL_FILE_MUTATED');

    const b=await msg('OPEN_LOCAL_V1',{file:f,attestation:att});
    pass(b.ok===true && b.summary.priorSessionRotated===true &&
      b.summary.sessionId!==a.sessionId &&
      b.summary.decodedSha256===a.decodedSha256,'SESSION_REOPEN_NOT_ROTATED');

    // Two OPEN messages in same event loop: the second MUST invalidate first.
    const raceA=msg('OPEN_LOCAL_V1',{file:f,attestation:att});
    const raceB=msg('OPEN_LOCAL_V1',{file:f,attestation:att});
    const [resA,resB]=await Promise.all([raceA,raceB]);
    pass(resA.ok===false && resA.error==='OWNER_LOCAL_OPEN_SUPERSEDED' &&
      resB.ok===true && resB.summary.sessionId!==b.summary.sessionId,
      'CONCURRENT_AB_WINNER');

    const last=msg('OPEN_LOCAL_V1',{file:f,attestation:att});
    const closed=msg('CLOSE_LOCAL_V1');
    const [old,close]=await Promise.all([last,closed]);
    pass(old.ok===false&&old.error==='OWNER_LOCAL_OPEN_SUPERSEDED' &&
      close.ok===true&&close.summary.closed===true,
      'CLOSE_RACE_FAILURE');
    const repeat=await msg('CLOSE_LOCAL_V1');
    pass(repeat.ok===true&&repeat.summary.closed===true,'CLOSE_IDEMPOTENT');
    pass(await sha(await f.arrayBuffer())===originalSha,'SOURCE_SHA_AFTER_RACE');

    const noPost=await fetch('/tools/owner-local-steam-v1/index.html',
      {method:'POST',body:'NO_SAVE_SEND'});
    pass(noPost.status===405,'NO_LOCAL_UPLOAD');
    const noRead=await fetch('/package.json');
    pass(noRead.status===403,'PATH_DENY');
    return Object.freeze({
      source:'CI_SYNTHETIC_ONLY',liveChromeWorker:true,actualGeneratedRustWasm:true,
      originalShaMatch:true,decodedRustShaMatch:true,externalBuildClaimOnly:true,
      sessionRotated:true,negativeClaimsDenied:true,noPostEndpoint:true,
      noDecodedJsonPosted:true,buildCryptographicallyProven:false,
      genuineOwnerSteamSave:false,realSaveV1Accepted:false,rustV2:false,
      nativeV3:false,writerAuthorized:false,schema:626,
      encryptedBytes:expected.sourceBytes,decodedBytes:expected.decodedBytes,
      workerOpenMs:ms,independent05QRC:true,caseGroups:8
    });
  }finally{worker.terminate()}
};
window.__stageG=run();
