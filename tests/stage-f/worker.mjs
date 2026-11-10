// Genuine generated WASM + EXISTING P1G Codec, all inside Chrome Worker.
// Only summary leaves Worker; no decoded Save/P1G bytes cross to parent.
import init,{WorkerWasmSource} from '../stage-e/pkg/ddv_save_core.js';
import {createP1gRustWorkerReadOnlyBridge} from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {testRealEncryptedSavedDiffGridsFacade} from './saved-diffgrids-facade-real-worker.mjs';
const BUILD={platform:'steam-windows',buildKind:'steam-full-version',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626,externallyConfirmed:true};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,
  indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const ensure=(ok,code)=>{if(!ok)throw Error('STAGE_F_'+code)};
const expectReject=async(fn,name)=>{
  try{await fn()}catch{return}
  throw Error('STAGE_F_ACCEPTED_'+name);
};
async function run(){
  ensure(typeof document==='undefined','WORKER_NOT_ISOLATED');
  ensure(crypto?.getRandomValues&&crypto?.subtle,'WEBCRYPTO_MISSING');
  const [encryptedResp,expectedResp]=await Promise.all([
    fetch('./fixtures/synthetic626.p1g',{cache:'no-store'}),
    fetch('./fixtures/expected.json',{cache:'no-store'})]);
  ensure(encryptedResp.ok&&expectedResp.ok,'SYNTHETIC_FIXTURE_MISSING');
  const encrypted=new Uint8Array(await encryptedResp.arrayBuffer());
  const expected=await expectedResp.json();
  ensure(expected.syntheticOnly===true&&encrypted.byteLength===expected.sourceBytes,'FIXTURE_IDENTITY');
  const initMs=performance.now();
  await init(new URL('../stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url));
  const wasmMs=Math.round(performance.now()-initMs);
  const bridge=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource}));
  const start=performance.now();
  const receipt=await bridge.openEncrypted({build:BUILD,encryptedBytes:encrypted});
  const openMs=Math.round(performance.now()-start);
  ensure(receipt.decodedSha256===expected.decodedSha256,'DECODED_JSON_SHA');
  ensure(receipt.fullDocumentJsonValidated===true&&receipt.decodedByExistingP1gCodec===true,
    'CODEC_RUST_SESSION_NOT_CONNECTED');
  ensure(receipt.externalPhysicalBuildVerified===false&&receipt.productReadAccepted===false&&
    receipt.writerAuthorized===false&&receipt.editedCopyAuthorized===false&&
    receipt.applyAuthorized===false,'OPERATION_GATE_PROMOTED');
  ensure(!('jsonText' in receipt)&&!('rawSource' in receipt),'JSON_EXPOSED');
  const s=scope(receipt);
  const witness=bridge.readCoreVersion(s);
  ensure(witness.coreOwnedReadset==='/GameInfo/Version','CORE_WITNESS');
  let cursor=bridge.issueTypedCursor(s,'player').cursor;
  const fields=[];
  const begin=performance.now();
  for(let i=0;i<3;i++){
    ensure(!/^0+$/.test(cursor),'ZERO_CURSOR');
    const p=bridge.readTypedPage(s,cursor);
    ensure(p.fields.length===(i===2?1:16),'PLAYER_PAGE_LEN');
    ensure(p.productReadAccepted===false&&p.writerAuthorized===false,'PAGE_WRITER_GATE');
    fields.push(...p.fields.map(f=>f.key));
    const old=cursor;cursor=p.nextCursor;
    await expectReject(()=>bridge.readTypedPage(s,old),'CURSOR_REPLAY');
    if(i<2)ensure(typeof cursor==='string'&&!/^0+$/.test(cursor),'TOKEN_ROTATION');
    else ensure(cursor===null,'PAGE_END');
  }
  const pageMs=Math.round(performance.now()-begin);
  ensure(fields.length===expected.playerFields&&fields[0]==='field_000'&&
    fields.at(-1)==='field_032','PLAYER_FIELDS');
  const world=bridge.issueTypedCursor(s,'world');
  const wp=bridge.readTypedPage(s,world.cursor);
  ensure(wp.fields.length===expected.worldFields&&wp.nextCursor===null,'WORLD_FIELDS');
  await expectReject(()=>bridge.readCoreVersion({...s,revision:1}),'STALE_REVISION');
  await expectReject(()=>bridge.issueTypedCursor(s,'../../Private'),'FORGED_READSET');
  const previousId=receipt.sessionId;
  const newReceipt=await bridge.openEncrypted({build:BUILD,encryptedBytes:encrypted});
  ensure(newReceipt.sessionId!==previousId,'SESSION_REUSE');
  await expectReject(()=>bridge.readCoreVersion(s),'STALE_SESSION');
  ensure(newReceipt.writerAuthorized===false,'SECOND_OPEN_WRITER');
  bridge.close();await expectReject(()=>bridge.issueTypedCursor(scope(newReceipt),'player'),'CLOSED');
  ensure(bridge.close().closed===true,'DOUBLE_CLOSE');

  const deny=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource}));
  await expectReject(()=>deny.openEncrypted({build:{...BUILD,buildId:'unknown'},encryptedBytes:encrypted}),
    'UNKNOWN_STEAM_BUILD');
  await expectReject(()=>deny.openEncrypted({build:{...BUILD,schema:624},encryptedBytes:encrypted}),
    'SCHEMA624');
  await expectReject(()=>deny.openEncrypted({build:{...BUILD,platform:'switch'},encryptedBytes:encrypted}),
    'PLATFORM_BUILD_MISMATCH');
  await expectReject(()=>deny.openEncrypted({build:BUILD,encryptedBytes:encrypted.slice(0,-1)}),
    'CORRUPT_CIPHERTEXT');
  await expectReject(()=>deny.openEncrypted({build:BUILD,encryptedBytes:encrypted,entropy:'ui'}),
    'UI_ENTROPY');
  ensure(deny.getReceipt()===null,'NEGATIVE_SESSION_RESURRECTED');
  const savedDiffGrids=await testRealEncryptedSavedDiffGridsFacade(WorkerWasmSource);
  ensure(savedDiffGrids.records===17&&savedDiffGrids.pages.join(',')==='8,8,1'&&
     savedDiffGrids.existingP1gCodec&&savedDiffGrids.sameProductSession&&
     savedDiffGrids.sourceShaAndSizeChecked&&savedDiffGrids.metadataOnlyToUI&&
     savedDiffGrids.replayAndClosedDenied&&!savedDiffGrids.productReadAccepted,
     'SAVED_DIFFGRIDS_P1G_FACADE_REAL_WASM');
  return {
    result:'SYNTHETIC_P1G_TO_REAL_RUST_WORKER_PASS',chromeModuleWorker:true,
    realGeneratedWasm:true,existingP1gCodec:true,singleRustSession:true,
    wasmMs,openMs,pageMs,encryptedBytes:encrypted.length,decodedBytes:expected.decodedBytes,
    playerFields:fields.length,worldFields:wp.fields.length,
    decodedSHACompared:true,staleScopeDenied:true,ABRevocation:true,
    malformedCiphertextDenied:true,badBuildDenied:true,extraEntropyDenied:true,
    savedDiffGridsSameWorkerFacade:true,savedDiffGridsRecords:savedDiffGrids.records,
    savedDiffGridsTypedPages:savedDiffGrids.pages.join(','),
    savedDiffGridsABAndReplayDenied:true,
    noDecodedJsonPostedToParent:true,writerAuthorized:false,productReadAccepted:false,
    realOwnerPrivateSave:false,nativeV3:false,deviceV4:false
  };
}
self.onmessage=async e=>{
  if(e.data?.kind!=='RUN_STAGE_F')return;
  try{self.postMessage({status:'PASS',summary:await run()})}
  catch(err){self.postMessage({status:'FAIL',error:String(err?.stack||err).slice(0,650)})}
};
