import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalSaveSessionBridge,LOCAL_MAX_P1G_BYTES} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {inspectW1SceneAreaReferences} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

// Independent 05 QR-C: ONLY PR514 new-mainfabfd => PR521 new composition.
// Reuse old-main QA523 and WEP PR514 QR520; do NOT retest their scopes.
// Synthetic packaged profile/Worker stub ONLY, not a genuine private P1G,
// product Rust one-session, actual durable OS backup or native gameplay.
const BID='9A239D3DB569756D';
const att=Object.freeze({platform:'switch',fullVersion:'1.25.3',
  buildKind:'switch-bid',buildId:BID,schema:626,externallyConfirmed:true});
const wepAtt=Object.freeze({sourcePlatform:'switch',
  targetBuild:{platform:'switch',kind:'switch-bid',value:BID},
  sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE});
const candidateScope=r=>({sessionId:r.sessionId,sourceSha256:r.sourceSha256,
  revision:r.revision,indexGeneration:r.indexGeneration});
const fakeFile=bytes=>Object.assign(new Blob([bytes]),{name:'synthetic-not-private.p1g'});
const record=(kind='normal')=>{
  const grids={'10':{ID:10,Objects:{
    '42':{ID:42,ItemID:31700014,X:1,Y:2,State:{}},
    '43':{ID:43,ItemID:31700015,X:2,Y:4,State:{}}
  }}};
  if(kind==='missing')delete grids['10'].Objects;
  return {GameInfo:{Version:626,InitialVersion:518,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
    Player:{},World:{
      Villages:[{SceneItemId:1540000000,
        Areas:{'1':{GridIDs:[10],Unlocked:true}}}],
      GridCollection:{Grids:grids,DiffGrids:{}}
    }
  };
};
function worker(){
  const handlers=new Map();let epoch=0,active=null,off=false;
  const emit=(name,data)=>{for(const cb of handlers.get(name)??[])cb({data});};
  const out={
    addEventListener(kind,fn){if(!handlers.has(kind))handlers.set(kind,[]);handlers.get(kind).push(fn);},
    postMessage(req){
      queueMicrotask(async()=>{
        if(off)return;
        if(req.type==='CLOSE'){active=null;
          emit('message',{id:req.id,ok:true,result:{closed:true,writerAuthorized:false}});
          return;
        }
        if(req.type==='OPEN_FILE'){
          const raw=await Blob.prototype.arrayBuffer.call(req.file);
          const digest=createHash('sha256').update(new Uint8Array(raw)).digest('hex');
          const i=++epoch;
          active={sessionId:i.toString(16).padStart(32,'0'),sourceSha256:digest,
            revision:0,indexGeneration:i};
          emit('message',{id:req.id,ok:true,result:{
            ...active,registrySha256:'0'.repeat(64),sourceSchema:626,
            sourcePlatform:'switch',externalFullVersion:'1.25.3',externalBID:BID,
            savedContainerCount:1,unsupportedContainerCount:0,
            writerAuthorized:false,productRustWorkerAccepted:false
          }});
          return;
        }
        if(req.type==='QUERY'&&active){
          emit('message',{id:req.id,ok:true,result:{
            ...active,total:1,complete:true,rows:[{eventId:2010000021}],
            writerAuthorized:false,productRustWorkerAccepted:false
          }});
          return;
        }
        emit('message',{id:req.id,ok:false,error:'READ_WRITER_OPERATION_DISABLED'});
      });
    },
    terminate(){off=true;}
  };
  queueMicrotask(()=>emit('message',{id:0,ready:true,writerAuthorized:false}));
  return out;
}
const open=async(bytes)=>{
  const bridge=createLocalSaveSessionBridge(worker);
  await bridge.ensureReady();
  const receipt=await bridge.openLocalFile(fakeFile(bytes),att);
  return {bridge,receipt};
};
const requireOff=(bridge,receipt)=>{
  const caps=bridge.getCapabilities();
  for(const key of ['sourceCoreWriterAccepted','nativeSemanticsW1Verified',
    'readGrid','readInventory','canCommit','canEncodeEditedCopy',
    'canApply','canReplaceOriginal'])assert.equal(caps[key],false,key);
  assert.equal(caps.maxCiphertextBytes,LOCAL_MAX_P1G_BYTES);
  for(const key of ['writerAuthorized','persistedVerified',
    'distinctDiskPathVerified','originalOverwriteProtectionVerified'])
    assert.equal(receipt[key],false,key);
};
const inspect=(p,source)=>inspectW1SceneAreaReferences(p,{
  platform:'Nintendo Switch',gameVersion:'1.25.3',bid:BID,schema:626,
  sourceSha256:source.sourceSha256,sourceRevision:'qa-mainfabfd-readonly-1'
});

test('new PR514 raw GridObject count and original PR509 W1 Scene remain independent from local native Blob candidate equality',async()=>{
  const p=record(),bytes=makeSyntheticP1gProfile(p),before=bytes.slice();
  const w=await openWorldSaveBytes(bytes,wepAtt);
  assert.equal(w.profileSchemaVersion,626);
  assert.equal(w.structuralDiagnostics?.gridObjectEntryCount,2);
  assert.equal(w.compatibility.readOnly,true);
  assert.equal(w.compatibility.persistentWriteAuthorized,false);
  assert.equal(w.compatibility.productApplyAuthorized,false);
  const {bridge,receipt}=await open(bytes);
  const page=await bridge.readDomainPage({...candidateScope(receipt),domain:'RecurringEvents',limit:1});
  assert.equal(page.rows[0].eventId,2010000021);
  const scene=inspect(p,receipt);
  assert.equal(scene.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(scene.sourceCandidates[0].sourceGridRefs[0].gridId,10);
  assert.equal(scene.selectedNativeWetlandAreaKey,null);
  assert.equal(scene.inputAuthenticatedByThisReader,false);
  assert.equal(scene.productWriterAuthorized,false);
  const copy=await bridge.verifyUserSelectedOriginalBackupCandidate(
    new Blob([bytes]),candidateScope(receipt));
  assert.equal(copy.candidateBytesMatchOriginal,true);
  assert.equal(copy.comparedByteCount,bytes.length);
  requireOff(bridge,copy);
  assert.deepEqual(bytes,before);
  bridge.destroy();
});

test('PR514 raw Objects count cannot promote overlapping DiffGrid into effective Native Tree/Quota or product Writer even if bytes match',async()=>{
  const p=record();
  p.World.GridCollection.DiffGrids['10']={ID:10,
    Objects:{'99':{ID:99,ItemID:31700014,State:{}}},ModifiedObjects:{},RemovedObjects:{}};
  const bytes=makeSyntheticP1gProfile(p);
  const w=await openWorldSaveBytes(bytes,wepAtt);
  assert.equal(w.structuralDiagnostics?.gridObjectEntryCount,2,
    'raw Grids only, no invented default+DiffGrid effective layout');
  assert.equal(w.compatibility.persistentWriteAuthorized,false);
  const {bridge,receipt}=await open(bytes);
  const s=inspect(p,receipt);
  assert.equal(s.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(s.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(s.nativeEffectiveGridVerified,false);
  const copy=await bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([bytes]),candidateScope(receipt));
  requireOff(bridge,copy);
  assert.equal(s.productWriterAuthorized,false);
  bridge.destroy();
});

test('an original GridObjects field absent in new WEP layout remains UNKNOWN or blocked; a matching backup cannot imply a zero count',async()=>{
  const p=record('missing'),bytes=makeSyntheticP1gProfile(p);
  let unknownOrRefused=false;
  try{
    const w=await openWorldSaveBytes(bytes,wepAtt);
    assert.equal(w.structuralDiagnostics?.gridObjectEntryCount,null);
    assert.equal(w.compatibility.persistentWriteAuthorized,false);
    unknownOrRefused=true;
  }catch(e){
    assert.match(e.message,/STRUCTURAL|CONTRACT|INVALID|GRID|PROFILE/i);
    unknownOrRefused=true;
  }
  assert.equal(unknownOrRefused,true);
  const {bridge,receipt}=await open(bytes);
  const copy=await bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([bytes]),candidateScope(receipt));
  requireOff(bridge,copy);
  assert.equal(copy.candidateBytesMatchOriginal,true);
  bridge.destroy();
});

test('same BID 626 WEP counts and synthetic backup cannot cross Worker A/B sessions or allow mismatched build',async()=>{
  const a=makeSyntheticP1gProfile(record());
  const other=record();other.World.GridCollection.Grids['10'].Objects={};
  const b=makeSyntheticP1gProfile(other);
  const {bridge,receipt:old}=await open(a);
  const now=await bridge.openLocalFile(fakeFile(b),att);
  assert.notEqual(old.sourceSha256,now.sourceSha256);
  await assert.rejects(bridge.verifyUserSelectedOriginalBackupCandidate(
    new Blob([a]),candidateScope(old)),/LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(bridge.verifyUserSelectedOriginalBackupCandidate(
    new Blob([b]),{...candidateScope(now),productWriterAuthorized:true}),
    /LOCAL_BACKUP_CANDIDATE_STALE_SOURCE_SCOPE/);
  await assert.rejects(()=>openWorldSaveBytes(b,{...wepAtt,
    targetBuild:{...wepAtt.targetBuild,value:'0000000000000000'}}),/UNSUPPORTED_BUILD/);
  const w=await openWorldSaveBytes(b,wepAtt);
  assert.equal(w.structuralDiagnostics?.gridObjectEntryCount,0);
  const good=await bridge.verifyUserSelectedOriginalBackupCandidate(new Blob([b]),candidateScope(now));
  requireOff(bridge,good);
  await assert.rejects(bridge.submitOperation({kind:'W1_EDIT_NEXT',sessionId:now.sessionId}),
    /LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
  bridge.destroy();
});
