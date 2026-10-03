import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CommitFaultStage,CommitState,PERSISTENT_COMMIT_VERIFICATION_BINDING,
  executePersistentCommit,recoverPersistentCommit,recoverPreJournalStaleLock,simulatedCrash,verifyJournalIntegrity,MIN_TRANSFORM_RUNTIME_BINDING
} from '../src/lib/ddv/core/save/persistent-commit-engine.js';
import { createNodePosixFilesystemAdapter,createPromotedCandidateVerificationBinding } from '../src/lib/ddv/core/save/node-posix-persistent-commit.js';
import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { createVerifiedWriteCandidate,verifyWriteCandidate } from '../src/lib/ddv/core/save/transaction-foundation.js';
import { PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import { classifyMinimumPersistentTransform,buildMinimumTransformTransactionPlan,minimumPersistentTransformAdapter } from '../src/lib/ddv/core/world/min-transform-write-v125.js';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';

const enc=new TextEncoder();
async function sha(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonical(v[k]);return o;}return v;}
async function rehashJournal(j){const core=structuredClone(j);delete core.integrity;const h=await sha(enc.encode(JSON.stringify(canonical(core))));return {...core,integrity:{algorithm:'SHA-256',sha256:h}};}
async function makeWorkspace(){
  const root=await mkdtemp(path.join(tmpdir(),'ddv-commit-proof-'));await writeFile(path.join(root,'.dreamwish-wand-commit-proof-root'),'DREAMWISH_WAND_COMMIT_PROOF_ROOT_V1\n');
  const target=path.join(root,'profile.json'),backup=path.join(root,'backups');await mkdir(backup);const source=enc.encode(JSON.stringify({GameInfo:{Version:624},Player:{},World:{value:'original'}}));const edited=enc.encode(JSON.stringify({GameInfo:{Version:624},Player:{},World:{value:'candidate'}}));await writeFile(target,source);
  const candidate=await makeCandidate(source,edited);return {root,target,backup,source,edited,candidate};
}
async function makeCandidate(source,edited){
  const sourceHash=await sha(source),candidateHash=await sha(edited);return {
    manifest:{
      contract:'dreamwish.ddv.save-transaction-candidate@1',planSha256:'1'.repeat(64),candidateManifestSha256:'2'.repeat(64),semanticOwner:'01B CORE - World / Grid / Buildings',mutationAdapter:{contract:'dreamwish.ddv.save-mutation-adapter@1',id:'01b-minimum-root-furniture-transform-v125-v1',owner:'01B CORE - World / Grid / Buildings'},
      capability:{required:'WRITE_CANDIDATE',writeCandidate:true,persistentWrite:false},persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,
      input:{platform:'switch',gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:source.length,originalSha256:sourceHash,codecContract:'p1g-v0',targetBuild:{platform:'switch',kind:'switch-bid',value:'52BD625D9B4E0053'},exactBuildContractId:'ddv-switch-v1.25.0-52BD625D9B4E0053-v624'},
      output:{format:'plain',candidateFileLength:edited.length,candidateSha256:candidateHash,noOp:false},
      operation:{id:'WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125',owner:'01B CORE - World / Grid / Buildings',kind:'MOVE',runtimeGate:'PENDING'}
    },plan:{contract:'dreamwish.ddv.save-transaction-plan@1',planId:'test',semanticOwner:'01B CORE - World / Grid / Buildings',operation:{id:'WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125',owner:'01B CORE - World / Grid / Buildings',kind:'MOVE',runtimeGate:'PENDING'},mutationAdapter:{contract:'dreamwish.ddv.save-mutation-adapter@1',id:'01b-minimum-root-furniture-transform-v125-v1',owner:'01B CORE - World / Grid / Buildings'},allowedChanges:[{path:'/World/GridCollection/Grids/3/Objects/5800/X',classification:'INTENTIONAL'},{path:'/World/GridCollection/Grids/3/Objects/5800/Y',classification:'INTENTIONAL'}],intent:{semanticContract:'ddv.minimum-persistent-transform-semantics@1',persistentWriteAuthorized:false}},backupOriginalBytes:source,candidateBytes:edited
  };
}
function runtimeEvidence(){return {contract:MIN_TRANSFORM_RUNTIME_BINDING,status:'CONFIRMED_PASS',moveReturnedSha256:'d2cf6d75329eee852d6c52adda68207696084827813839be8127ead356725508',rotateReturnedSha256:'19a4d88220da359f26d43e49507c56f5613be5e9fbc28b74d22cf2cdc831a0c7',coldPersistence:true,serializedCompanionFieldsObserved:false,transformNormalizationObserved:false};}
function verification({failCandidateAt=null}={}){let n=0;return {contract:PERSISTENT_COMMIT_VERIFICATION_BINDING,async verifyCandidate(c){n++;if(failCandidateAt===n){const e=new Error('parse fail');e.code='PC_TEST_PARSE_FAILURE';throw e;}const sh=await sha(c.backupOriginalBytes),ch=await sha(c.candidateBytes);if(sh!==c.manifest.input.originalSha256||ch!==c.manifest.output.candidateSha256)throw Object.assign(new Error('hash'),{code:'PC_TEST_VERIFY_HASH'});JSON.parse(new TextDecoder().decode(c.backupOriginalBytes));JSON.parse(new TextDecoder().decode(c.candidateBytes));return {status:'PASS'};},async verifyOriginal(bytes,c){if(await sha(bytes)!==c.manifest.input.originalSha256)throw Object.assign(new Error('original'),{code:'PC_TEST_ORIGINAL_HASH'});JSON.parse(new TextDecoder().decode(bytes));return {status:'PASS'};}};}
async function run(ws,{faultInjector=null,adapter=null,verificationBinding=null,id='tx1'}={}){return executePersistentCommit({candidate:ws.candidate,targetPath:ws.target,backupDirectory:ws.backup,transactionId:id,adapter:adapter??createNodePosixFilesystemAdapter(),verification:verificationBinding??verification(),runtimeEvidence:runtimeEvidence(),mode:'PROOF_ONLY',proofRoot:ws.root,faultInjector});}
async function exists(p){try{await access(p);return true;}catch{return false;}}

async function makePromotedMinimumTransformCandidate(){
  const root={
    GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{Level:50},
    World:{GridCollection:{Grids:{'3':{ID:3,GridDataPath:'synthetic',TessellationFactor:1,NextGridObjectID:7169,Objects:{'5800':{ID:5800,ItemID:40002049,X:195,Y:201,Orientation:4,State:null}}}}}}
  };
  const source=makeSyntheticP1gProfile(root);
  const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
  const admissibility=classifyMinimumPersistentTransform({
    source:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'},profile:root,
    target:{gridId:3,gridObjectId:5800,itemId:40002049,objectMapKey:'5800'},
    scopeRecord:{itemID:40002049,concreteType:'FurnitureItemData',scopeTier:'CORE_STATELESS_FURNITURE',interaction:'None',isMissionItem:false,forPuzzleOnly:false,explicitGridEditRestriction:null,nativePresetKnownRejectReasons:[],isSyncOnlineItem:false},
    coreClassification:{concreteType:'FurnitureItemData',stateKind:'NONE',layer:'furniture',editability:'editable',reasons:[]},
    rootEvidence:{relation:'ROOT',gridId:3,gridObjectId:5800,objectMapKey:'5800',parentAddress:null},
    progressionRecord:{schema:'ddv.progression-destination-veto-record@1',gridObjectAddress:{gridId:3,gridObjectId:5800},itemID:40002049,negativeVetoFound:false,destinationProtected:false,activeReferenceDisposition:'NONE_OBSERVED',references:{active:[],unknown:[]},operationVetoes:{MOVE:[],ROTATE:[]}},
    placementEvidence:{revision:'V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2',sameRootGrid:true,clearArea:false,automaticSpawning:false,result:{status:'VALID',valid:true,verdict:'VALID'}},
    operation:'MOVE',finalTransform:{x:199,y:213,orientation:4}
  });
  assert.equal(admissibility.status,'ADMISSIBLE');
  const ctx=session.getPreflightContext();
  const plan=buildMinimumTransformTransactionPlan({
    admissibility,nextGridObjectId:7169,planId:'integration-promoted-minimum-move',
    transactionInput:{platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,codecContract:ctx.codecContract,targetBuild:{platform:PlatformFamily.Switch,kind:'switch-bid',value:'52BD625D9B4E0053'}}
  });
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter});
  assert.deepEqual(candidate.manifest.semanticDiff.intentionalChangedPaths,[
    '/World/GridCollection/Grids/3/Objects/5800/X','/World/GridCollection/Grids/3/Objects/5800/Y'
  ]);
  return candidate;
}

test('real promoted 01A+01B candidate verifier binds to Linux/POSIX proof commit without widening scope',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'ddv-promoted-commit-proof-'));await writeFile(path.join(root,'.dreamwish-wand-commit-proof-root'),'DREAMWISH_WAND_COMMIT_PROOF_ROOT_V1\n');
  const backup=path.join(root,'backups');await mkdir(backup);const target=path.join(root,'profile.json');
  const candidate=await makePromotedMinimumTransformCandidate();await writeFile(target,candidate.backupOriginalBytes);
  const binding=createPromotedCandidateVerificationBinding({verifyWriteCandidate,SafeProfileEditSession,codec:p1gPackagedProfileCodec});
  const r=await executePersistentCommit({candidate,targetPath:target,backupDirectory:backup,transactionId:'promoted-real-binding',adapter:createNodePosixFilesystemAdapter(),verification:binding,runtimeEvidence:runtimeEvidence(),mode:'PROOF_ONLY',proofRoot:root});
  assert.equal(r.status,'COMMITTED');assert.deepEqual(new Uint8Array(await readFile(target)),candidate.candidateBytes);
  const reopened=await SafeProfileEditSession.open({sourceBytes:new Uint8Array(await readFile(target)),codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
  const o=reopened.getSnapshot().World.GridCollection.Grids['3'].Objects['5800'];assert.equal(o.X,199);assert.equal(o.Y,213);assert.equal(o.Orientation,4);assert.equal(o.ID,5800);assert.equal(o.ItemID,40002049);assert.equal(o.State,null);
  assert.equal(r.persistentWriteAuthorized,false);assert.equal(r.WORLD_PERSISTENT_WRITE_V125,false);
});

// Real filesystem happy path.
test('real Linux/POSIX proof commit: backup + durable journal + atomic sibling replace + post verify',async()=>{
  const ws=await makeWorkspace();const r=await run(ws);assert.equal(r.status,CommitState.COMMITTED);assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.edited);assert.deepEqual(new Uint8Array(await readFile(r.paths.backupPath)),ws.source);assert.equal(await exists(r.paths.lockPath),false);const j=JSON.parse(await readFile(r.paths.journalPath,'utf8'));assert.equal(j.state,'COMMITTED');assert.equal(await verifyJournalIntegrity(j),true);assert.equal(j.persistentWriteAuthorized,false);
});

const preReplaceStages=[
  CommitFaultStage.BEFORE_LOCK,CommitFaultStage.AFTER_LOCK,CommitFaultStage.AFTER_SOURCE_RECHECK,
  CommitFaultStage.BEFORE_BACKUP_CREATE,CommitFaultStage.BEFORE_BACKUP_FSYNC,CommitFaultStage.AFTER_BACKUP_FSYNC,
  CommitFaultStage.BEFORE_TEMP_WRITE,CommitFaultStage.BEFORE_TEMP_FSYNC,CommitFaultStage.AFTER_TEMP_FSYNC,
  CommitFaultStage.BEFORE_TEMP_VERIFY,CommitFaultStage.AFTER_TEMP_VERIFY,CommitFaultStage.BEFORE_JOURNAL_PREPARE,
  CommitFaultStage.AFTER_JOURNAL_PREPARE,CommitFaultStage.AFTER_REPLACE_READY,CommitFaultStage.BEFORE_FINAL_SOURCE_RECHECK,
  CommitFaultStage.BEFORE_ATOMIC_REPLACE
];
for(const stage of preReplaceStages)test(`pre-replace injected failure leaves exact original: ${stage}`,async()=>{
  const ws=await makeWorkspace();await assert.rejects(run(ws,{id:`x-${preReplaceStages.indexOf(stage)}`,faultInjector(s){if(s===stage)throw Object.assign(new Error(stage),{code:'PC_TEST_INJECTED'});}}));assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);
});

test('source hash mismatch fails before backup/replace',async()=>{const ws=await makeWorkspace();await writeFile(ws.target,'changed externally');await assert.rejects(run(ws),e=>e.code==='PC_SOURCE_LENGTH_MISMATCH'||e.code==='PC_SOURCE_HASH_MISMATCH');assert.equal((await readFile(ws.target,'utf8')),'changed externally');});

test('journal write failure leaves original untouched',async()=>{const ws=await makeWorkspace();const base=createNodePosixFilesystemAdapter();const a={...base,async writeJournalDurable(){throw Object.assign(new Error('journal'),{code:'PC_TEST_JOURNAL_FAILURE'});}};await assert.rejects(run(ws,{adapter:a}));assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});

test('replace failure leaves original and records ABORTED when journal exists',async()=>{const ws=await makeWorkspace();const base=createNodePosixFilesystemAdapter();const a={...base,async atomicReplace(){throw Object.assign(new Error('rename'),{code:'PC_TEST_REPLACE_FAILURE'});}};await assert.rejects(run(ws,{adapter:a}));assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const j=JSON.parse(await readFile(jp,'utf8'));assert.equal(j.state,'ABORTED');});

test('post-replace hash mismatch triggers exact-backup rollback',async()=>{const ws=await makeWorkspace();await assert.rejects(run(ws,{faultInjector:async(s)=>{if(s===CommitFaultStage.BEFORE_POST_COMMIT_VERIFY)await writeFile(ws.target,'corrupt');}}),e=>e.code==='PC_COMMIT_FAILED_ROLLED_BACK');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});

test('post-replace parse verification failure triggers exact-backup rollback',async()=>{const ws=await makeWorkspace();await assert.rejects(run(ws,{verificationBinding:verification({failCandidateAt:3})}),e=>e.code==='PC_COMMIT_FAILED_ROLLED_BACK');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});

test('rollback failure leaves RECOVERY_REQUIRED and stale lock for explicit recovery',async()=>{const ws=await makeWorkspace();await assert.rejects(run(ws,{faultInjector:async(s)=>{if(s===CommitFaultStage.BEFORE_POST_COMMIT_VERIFY)await writeFile(ws.target,'corrupt');if(s===CommitFaultStage.BEFORE_ROLLBACK)throw Object.assign(new Error('rollback'),{code:'PC_TEST_ROLLBACK_FAILURE'});}}),e=>e.code==='PC_RECOVERY_REQUIRED');const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const j=JSON.parse(await readFile(jp,'utf8'));assert.equal(j.state,'RECOVERY_REQUIRED');assert.equal(await exists(j.paths.lockPath),true);});

async function crashAt(stage,id){const ws=await makeWorkspace();await assert.rejects(run(ws,{id,faultInjector(s){if(s===stage)throw simulatedCrash(stage);}}),e=>e.code==='PC_SIMULATED_CRASH');const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));return {ws,jp};}
function restartAdapter(){const a=createNodePosixFilesystemAdapter();return {...a,async isProcessAlive(){return false;}};}

test('restart from PREPARE deterministically aborts to exact original',async()=>{const {ws,jp}=await crashAt(CommitFaultStage.AFTER_JOURNAL_PREPARE,'s-prep');const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});assert.equal(r.status,'ABORTED');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});
test('restart from REPLACE_READY before replace deterministically aborts to exact original',async()=>{const {ws,jp}=await crashAt(CommitFaultStage.AFTER_REPLACE_READY,'s-ready');const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});assert.equal(r.status,'ABORTED');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});
test('interruption immediately after atomic replace recovers exact candidate and commits',async()=>{const {ws,jp}=await crashAt(CommitFaultStage.AFTER_ATOMIC_REPLACE,'s-after-rename');const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});assert.equal(r.status,'COMMITTED');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.edited);});
test('restart from REPLACED verifies exact candidate and commits',async()=>{const {ws,jp}=await crashAt(CommitFaultStage.AFTER_REPLACED_JOURNAL,'s-replaced');const j0=JSON.parse(await readFile(jp,'utf8'));assert.equal(j0.state,'REPLACED');const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});assert.equal(r.status,'COMMITTED');});
test('restart from COMMITTED is idempotent',async()=>{const ws=await makeWorkspace();const c=await run(ws,{id:'s-committed'});const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:c.paths.journalPath,adapter:createNodePosixFilesystemAdapter(),verification:verification()});assert.equal(r.status,'COMMITTED');});
test('restart from ABORTED is idempotent',async()=>{const ws=await makeWorkspace();const base=createNodePosixFilesystemAdapter();const a={...base,async atomicReplace(){throw Object.assign(new Error('rename'),{code:'PC_TEST_REPLACE_FAILURE'});}};await assert.rejects(run(ws,{adapter:a,id:'s-aborted'}));const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:createNodePosixFilesystemAdapter(),verification:verification()});assert.equal(r.status,'ABORTED');});
test('restart from RECOVERY_REQUIRED rolls back exact backup deterministically',async()=>{const ws=await makeWorkspace();await assert.rejects(run(ws,{id:'s-recovery',faultInjector:async(s)=>{if(s===CommitFaultStage.BEFORE_POST_COMMIT_VERIFY)await writeFile(ws.target,'corrupt');if(s===CommitFaultStage.BEFORE_ROLLBACK)throw Object.assign(new Error('rollback'),{code:'PC_TEST_ROLLBACK_FAILURE'});}}));const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});assert.equal(r.status,'ROLLED_BACK');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);});
test('restart from ROLLED_BACK is idempotent',async()=>{const ws=await makeWorkspace();await assert.rejects(run(ws,{id:'s-rolled',faultInjector:async(s)=>{if(s===CommitFaultStage.BEFORE_POST_COMMIT_VERIFY)await writeFile(ws.target,'corrupt');}}));const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const j=JSON.parse(await readFile(jp,'utf8'));assert.equal(j.state,'ROLLED_BACK');const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:createNodePosixFilesystemAdapter(),verification:verification()});assert.equal(r.status,'ROLLED_BACK');});

test('journal tamper is rejected',async()=>{const ws=await makeWorkspace();const c=await run(ws,{id:'tamper'});const j=JSON.parse(await readFile(c.paths.journalPath,'utf8'));j.state='ABORTED';await writeFile(c.paths.journalPath,JSON.stringify(j));await assert.rejects(recoverPersistentCommit({targetPath:ws.target,journalPath:c.paths.journalPath,adapter:createNodePosixFilesystemAdapter(),verification:verification()}),e=>e.code==='PC_JOURNAL_INTEGRITY_MISMATCH');});

test('proof-only execution refuses paths outside marked proof root and AUTHORIZED mode remains off',async()=>{const ws=await makeWorkspace();const other=await mkdtemp(path.join(tmpdir(),'outside-'));const outside=path.join(other,'profile');await writeFile(outside,ws.source);await assert.rejects(executePersistentCommit({candidate:ws.candidate,targetPath:outside,backupDirectory:ws.backup,transactionId:'outside',adapter:createNodePosixFilesystemAdapter(),verification:verification(),runtimeEvidence:runtimeEvidence(),mode:'PROOF_ONLY',proofRoot:ws.root}),e=>e.code==='PC_PROOF_PATH_OUTSIDE_ROOT');await assert.rejects(executePersistentCommit({candidate:ws.candidate,targetPath:ws.target,backupDirectory:ws.backup,transactionId:'auth',adapter:createNodePosixFilesystemAdapter(),verification:verification(),runtimeEvidence:runtimeEvidence(),mode:'AUTHORIZED',proofRoot:ws.root}),e=>e.code==='PC_PERSISTENT_WRITE_NOT_AUTHORIZED');});


test('adapter failures: backup create/flush, temp write/flush and temp verification all fail before replacement',async()=>{
  const cases=[
    ['backup-create',base=>({...base,async writeFileExclusive(p,b){if(p.endsWith('.backup'))throw Object.assign(new Error('backup create'),{code:'PC_TEST_BACKUP_CREATE'});return base.writeFileExclusive(p,b);}}),null],
    ['backup-flush',base=>({...base,async syncFile(p){if(p.endsWith('.backup'))throw Object.assign(new Error('backup fsync'),{code:'PC_TEST_BACKUP_FSYNC'});return base.syncFile(p);}}),null],
    ['temp-write',base=>({...base,async writeFileExclusive(p,b){if(p.includes('.candidate.tmp'))throw Object.assign(new Error('temp write'),{code:'PC_TEST_TEMP_WRITE'});return base.writeFileExclusive(p,b);}}),null],
    ['temp-flush',base=>({...base,async syncFile(p){if(p.includes('.candidate.tmp'))throw Object.assign(new Error('temp fsync'),{code:'PC_TEST_TEMP_FSYNC'});return base.syncFile(p);}}),null],
    ['temp-verify',base=>base,verification({failCandidateAt:2})]
  ];
  for(const [name,wrap,v] of cases){const ws=await makeWorkspace();const base=createNodePosixFilesystemAdapter();await assert.rejects(run(ws,{id:`adapter-${name}`,adapter:wrap(base),verificationBinding:v??verification()}));assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source,name);}
});



test('pre-journal stale lock after temp fsync is deterministically reclaimed without touching exact original',async()=>{
  const ws=await makeWorkspace();
  await assert.rejects(run(ws,{id:'prejournal-crash',faultInjector(s){if(s===CommitFaultStage.AFTER_TEMP_FSYNC)throw simulatedCrash(s);}}),e=>e.code==='PC_SIMULATED_CRASH');
  const lockPath=path.join(path.dirname(ws.target),`.${path.basename(ws.target)}.wand.lock`);
  assert.equal(await exists(lockPath),true);
  const a=restartAdapter();
  const r=await recoverPreJournalStaleLock({targetPath:ws.target,backupDirectory:ws.backup,lockPath,adapter:a});
  assert.equal(r.status,'ABORTED');assert.equal(r.preJournalRecovery,true);
  assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);assert.equal(await exists(lockPath),false);
});

test('missing target from REPLACE_READY recovers exact backup instead of getting stuck',async()=>{
  const {ws,jp}=await crashAt(CommitFaultStage.AFTER_REPLACE_READY,'missing-target');
  await import('node:fs/promises').then(m=>m.unlink(ws.target));
  const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});
  assert.equal(r.status,'ROLLED_BACK');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);
});

for(const stage of [
  CommitFaultStage.AFTER_ATOMIC_REPLACE,
  CommitFaultStage.BEFORE_PARENT_FSYNC,
  CommitFaultStage.AFTER_PARENT_FSYNC,
  CommitFaultStage.AFTER_REPLACED_JOURNAL,
  CommitFaultStage.AFTER_POST_COMMIT_VERIFY,
  CommitFaultStage.BEFORE_COMMITTED_JOURNAL,
  CommitFaultStage.AFTER_COMMITTED_JOURNAL
]) test(`post-replace interruption recovers deterministically: ${stage}`,async()=>{
  const {ws,jp}=await crashAt(stage,`post-${stage.toLowerCase()}`);
  const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});
  assert.equal(r.status,'COMMITTED');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.edited);
});

for(const stage of [CommitFaultStage.BEFORE_ROLLBACK_FSYNC,CommitFaultStage.AFTER_ROLLBACK_REPLACE,CommitFaultStage.AFTER_ROLLBACK_VERIFY]) test(`rollback interruption becomes recoverable and converges to exact original: ${stage}`,async()=>{
  const ws=await makeWorkspace();
  await assert.rejects(run(ws,{id:`rb-${stage.toLowerCase()}`,faultInjector:async(s)=>{
    if(s===CommitFaultStage.BEFORE_POST_COMMIT_VERIFY)await writeFile(ws.target,'corrupt');
    if(s===stage)throw Object.assign(new Error(stage),{code:'PC_TEST_ROLLBACK_STAGE_FAILURE'});
  }}),e=>e.code==='PC_RECOVERY_REQUIRED');
  const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));
  const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:restartAdapter(),verification:verification()});
  assert.equal(r.status,'ROLLED_BACK');assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.source);
});

test('self-rehashed journal path tamper is rejected by deterministic path binding',async()=>{
  const ws=await makeWorkspace();const c=await run(ws,{id:'journal-path-bind'});let j=JSON.parse(await readFile(c.paths.journalPath,'utf8'));
  j.paths.backupPath=path.join(ws.backup,'other.backup');j=await rehashJournal(j);await writeFile(c.paths.journalPath,JSON.stringify(j));
  await assert.rejects(recoverPersistentCommit({targetPath:ws.target,journalPath:c.paths.journalPath,adapter:createNodePosixFilesystemAdapter(),verification:verification()}),e=>e.code==='PC_JOURNAL_PATH_BINDING_MISMATCH');
});

test('real child-process hard crash immediately after rename leaves stale lock and REPLACE_READY; restart recovers COMMITTED',async()=>{
  const ws=await makeWorkspace(),candidatePath=path.join(ws.root,'candidate-bytes.json');await writeFile(candidatePath,ws.edited);const helper=fileURLToPath(new URL('./helpers/ddv-persistent-commit-hard-crash-child.mjs',import.meta.url));
  const code=await new Promise((resolve,reject)=>{const cp=spawn(process.execPath,[helper,ws.root,ws.target,ws.backup,candidatePath,'hard-crash'],{stdio:'ignore'});cp.on('error',reject);cp.on('exit',resolve);});assert.equal(code,91);
  const files=await import('node:fs/promises').then(m=>m.readdir(ws.backup));const jp=path.join(ws.backup,files.find(x=>x.endsWith('.journal.json')));const j=JSON.parse(await readFile(jp,'utf8'));assert.equal(j.state,'REPLACE_READY');assert.equal(await exists(j.paths.lockPath),true);assert.deepEqual(new Uint8Array(await readFile(ws.target)),ws.edited);
  const r=await recoverPersistentCommit({targetPath:ws.target,journalPath:jp,adapter:createNodePosixFilesystemAdapter(),verification:verification()});assert.equal(r.status,'COMMITTED');assert.equal(await exists(j.paths.lockPath),false);
});