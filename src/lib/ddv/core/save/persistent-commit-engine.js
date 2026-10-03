export const PERSISTENT_COMMIT_ENGINE_CONTRACT='dreamwish.ddv.persistent-commit-engine@1';
export const PERSISTENT_COMMIT_JOURNAL_CONTRACT='dreamwish.ddv.persistent-commit-journal@1';
export const PERSISTENT_COMMIT_LOCK_CONTRACT='dreamwish.ddv.persistent-commit-lock@1';
export const PERSISTENT_COMMIT_VERIFICATION_BINDING='dreamwish.ddv.persistent-commit-verification-binding@1';
export const PERSISTENT_WRITE_CAPABILITY_CANDIDATE='dreamwish.ddv.persistent-write-capability-candidate@1';
export const MIN_TRANSFORM_RUNTIME_BINDING='ddv.minimum-persistent-transform-runtime-acceptance@1';
export const MIN_TRANSFORM_OPERATION_ID='WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125';
export const MIN_TRANSFORM_SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const MIN_TRANSFORM_ADAPTER_ID='01b-minimum-root-furniture-transform-v125-v1';
export const MIN_TRANSFORM_SEMANTIC_CONTRACT='ddv.minimum-persistent-transform-semantics@1';
export const SWITCH_V125_BID='52BD625D9B4E0053';
export const MOVE_RUNTIME_RETURNED_SHA256='d2cf6d75329eee852d6c52adda68207696084827813839be8127ead356725508';
export const ROTATE_RUNTIME_RETURNED_SHA256='19a4d88220da359f26d43e49507c56f5613be5e9fbc28b74d22cf2cdc831a0c7';

export const CommitState=Object.freeze({
  PREPARE:'PREPARE',
  REPLACE_READY:'REPLACE_READY',
  REPLACED:'REPLACED',
  COMMITTED:'COMMITTED',
  ABORTED:'ABORTED',
  RECOVERY_REQUIRED:'RECOVERY_REQUIRED',
  ROLLED_BACK:'ROLLED_BACK'
});

export const CommitFaultStage=Object.freeze({
  BEFORE_LOCK:'BEFORE_LOCK',
  AFTER_LOCK:'AFTER_LOCK',
  AFTER_SOURCE_RECHECK:'AFTER_SOURCE_RECHECK',
  BEFORE_BACKUP_CREATE:'BEFORE_BACKUP_CREATE',
  BEFORE_BACKUP_FSYNC:'BEFORE_BACKUP_FSYNC',
  AFTER_BACKUP_FSYNC:'AFTER_BACKUP_FSYNC',
  BEFORE_TEMP_WRITE:'BEFORE_TEMP_WRITE',
  BEFORE_TEMP_FSYNC:'BEFORE_TEMP_FSYNC',
  AFTER_TEMP_FSYNC:'AFTER_TEMP_FSYNC',
  BEFORE_TEMP_VERIFY:'BEFORE_TEMP_VERIFY',
  AFTER_TEMP_VERIFY:'AFTER_TEMP_VERIFY',
  BEFORE_JOURNAL_PREPARE:'BEFORE_JOURNAL_PREPARE',
  AFTER_JOURNAL_PREPARE:'AFTER_JOURNAL_PREPARE',
  AFTER_REPLACE_READY:'AFTER_REPLACE_READY',
  BEFORE_FINAL_SOURCE_RECHECK:'BEFORE_FINAL_SOURCE_RECHECK',
  BEFORE_ATOMIC_REPLACE:'BEFORE_ATOMIC_REPLACE',
  AFTER_ATOMIC_REPLACE:'AFTER_ATOMIC_REPLACE',
  BEFORE_PARENT_FSYNC:'BEFORE_PARENT_FSYNC',
  AFTER_PARENT_FSYNC:'AFTER_PARENT_FSYNC',
  AFTER_REPLACED_JOURNAL:'AFTER_REPLACED_JOURNAL',
  BEFORE_POST_COMMIT_VERIFY:'BEFORE_POST_COMMIT_VERIFY',
  AFTER_POST_COMMIT_VERIFY:'AFTER_POST_COMMIT_VERIFY',
  BEFORE_COMMITTED_JOURNAL:'BEFORE_COMMITTED_JOURNAL',
  AFTER_COMMITTED_JOURNAL:'AFTER_COMMITTED_JOURNAL',
  BEFORE_ROLLBACK:'BEFORE_ROLLBACK',
  BEFORE_ROLLBACK_FSYNC:'BEFORE_ROLLBACK_FSYNC',
  AFTER_ROLLBACK_REPLACE:'AFTER_ROLLBACK_REPLACE',
  AFTER_ROLLBACK_VERIFY:'AFTER_ROLLBACK_VERIFY'
});

const TERMINAL_STATES=new Set([CommitState.COMMITTED,CommitState.ABORTED,CommitState.ROLLED_BACK]);
const VALID_STATES=new Set(Object.values(CommitState));
const MAX_TRANSACTION_ID=96;

/**
 * Generic commit engine. It does not contain filesystem primitives and does not authorize
 * persistence. A concrete execution surface must supply durable/atomic primitives and a
 * verification binding to the already-promoted WRITE_CANDIDATE verifier.
 */
export async function executePersistentCommit({
  candidate, targetPath, backupDirectory, transactionId, adapter, verification, runtimeEvidence,
  mode='PROOF_ONLY', proofRoot=null, faultInjector=null, now=()=>new Date().toISOString()
}){
  validateInputs({candidate,targetPath,backupDirectory,transactionId,adapter,verification,runtimeEvidence,mode,proofRoot});
  validateMinimumPersistentTransformProofScope(candidate,runtimeEvidence);
  const inject=makeInjector(faultInjector);
  const verified=await verification.verifyCandidate(candidate);
  if(!verified||verified.status!=='PASS')throw pcError('PC_CANDIDATE_NOT_VERIFIED');
  const manifest=candidate.manifest;
  if(manifest?.persistentWriteAuthorized!==false||manifest?.WORLD_PERSISTENT_WRITE_V125!==false||manifest?.capability?.persistentWrite!==false)
    throw pcError('PC_INPUT_CANDIDATE_BOUNDARY_INVALID');

  const paths=await adapter.derivePaths({targetPath,backupDirectory,transactionId,sourceSha256:manifest.input.originalSha256});
  await adapter.assertEnvironment({targetPath,backupDirectory,paths,mode,proofRoot});
  const immutable=buildImmutableJournalFields({candidate,transactionId,targetPath,paths,adapter,mode,runtimeEvidence,now});
  let lockAcquired=false,journal=null,replaced=false,sourceMatchedAtInitialCheck=false;

  try{
    await inject(CommitFaultStage.BEFORE_LOCK,{paths});
    await adapter.acquireLock(paths.lockPath,await buildLockRecord(immutable,adapter,now));
    lockAcquired=true;
    await inject(CommitFaultStage.AFTER_LOCK,{paths});

    const sourceBytes=await adapter.readFile(targetPath);
    await assertExactBytes(sourceBytes,manifest.input.originalSha256,manifest.input.originalFileLength,'PC_SOURCE_HASH_MISMATCH','PC_SOURCE_LENGTH_MISMATCH');
    await verification.verifyOriginal(sourceBytes,candidate);
    sourceMatchedAtInitialCheck=true;
    await inject(CommitFaultStage.AFTER_SOURCE_RECHECK,{paths});

    await inject(CommitFaultStage.BEFORE_BACKUP_CREATE,{paths});
    await adapter.writeFileExclusive(paths.backupPath,sourceBytes);
    await inject(CommitFaultStage.BEFORE_BACKUP_FSYNC,{paths});
    await adapter.syncFile(paths.backupPath);
    await adapter.syncDirectory(adapter.dirname(paths.backupPath));
    const backupBytes=await adapter.readFile(paths.backupPath);
    await assertExactBytes(backupBytes,manifest.input.originalSha256,manifest.input.originalFileLength,'PC_BACKUP_HASH_MISMATCH','PC_BACKUP_LENGTH_MISMATCH');
    await verification.verifyOriginal(backupBytes,candidate);
    await inject(CommitFaultStage.AFTER_BACKUP_FSYNC,{paths});

    await inject(CommitFaultStage.BEFORE_TEMP_WRITE,{paths});
    await adapter.writeFileExclusive(paths.tempPath,candidate.candidateBytes);
    await inject(CommitFaultStage.BEFORE_TEMP_FSYNC,{paths});
    await adapter.syncFile(paths.tempPath);
    await adapter.syncDirectory(adapter.dirname(paths.tempPath));
    await inject(CommitFaultStage.AFTER_TEMP_FSYNC,{paths});

    await inject(CommitFaultStage.BEFORE_TEMP_VERIFY,{paths});
    const tempBytes=await adapter.readFile(paths.tempPath);
    await assertExactBytes(tempBytes,manifest.output.candidateSha256,manifest.output.candidateFileLength,'PC_TEMP_HASH_MISMATCH','PC_TEMP_LENGTH_MISMATCH');
    await verification.verifyCandidate({...candidate,backupOriginalBytes:backupBytes,candidateBytes:tempBytes});
    await inject(CommitFaultStage.AFTER_TEMP_VERIFY,{paths});

    journal=await createJournal({...immutable,state:CommitState.PREPARE,revision:1,updatedAt:now()});
    await inject(CommitFaultStage.BEFORE_JOURNAL_PREPARE,{paths,journal});
    await adapter.writeJournalDurable(paths.journalPath,journal);
    await inject(CommitFaultStage.AFTER_JOURNAL_PREPARE,{paths,journal});

    journal=await transitionJournal(journal,CommitState.REPLACE_READY,now);
    await adapter.writeJournalDurable(paths.journalPath,journal);
    await inject(CommitFaultStage.AFTER_REPLACE_READY,{paths,journal});

    await inject(CommitFaultStage.BEFORE_FINAL_SOURCE_RECHECK,{paths,journal});
    const immediatelyBeforeReplace=await adapter.readFile(targetPath);
    await assertExactBytes(immediatelyBeforeReplace,manifest.input.originalSha256,manifest.input.originalFileLength,'PC_SOURCE_CHANGED_BEFORE_REPLACE','PC_SOURCE_LENGTH_CHANGED_BEFORE_REPLACE');

    await inject(CommitFaultStage.BEFORE_ATOMIC_REPLACE,{paths,journal});
    await adapter.atomicReplace(paths.tempPath,targetPath);
    replaced=true;
    await inject(CommitFaultStage.AFTER_ATOMIC_REPLACE,{paths,journal});
    await inject(CommitFaultStage.BEFORE_PARENT_FSYNC,{paths,journal});
    await adapter.syncDirectory(adapter.dirname(targetPath));
    await inject(CommitFaultStage.AFTER_PARENT_FSYNC,{paths,journal});

    journal=await transitionJournal(journal,CommitState.REPLACED,now);
    await adapter.writeJournalDurable(paths.journalPath,journal);
    await inject(CommitFaultStage.AFTER_REPLACED_JOURNAL,{paths,journal});

    await inject(CommitFaultStage.BEFORE_POST_COMMIT_VERIFY,{paths,journal});
    const committedBytes=await adapter.readFile(targetPath);
    await assertExactBytes(committedBytes,manifest.output.candidateSha256,manifest.output.candidateFileLength,'PC_POST_REPLACE_HASH_MISMATCH','PC_POST_REPLACE_LENGTH_MISMATCH');
    await verification.verifyCandidate({...candidate,backupOriginalBytes:backupBytes,candidateBytes:committedBytes});
    await inject(CommitFaultStage.AFTER_POST_COMMIT_VERIFY,{paths,journal});

    await inject(CommitFaultStage.BEFORE_COMMITTED_JOURNAL,{paths,journal});
    journal=await transitionJournal(journal,CommitState.COMMITTED,now);
    await adapter.writeJournalDurable(paths.journalPath,journal);
    await inject(CommitFaultStage.AFTER_COMMITTED_JOURNAL,{paths,journal});
    await adapter.releaseLock(paths.lockPath);
    lockAcquired=false;
    return freezeResult(journal,paths,CommitState.COMMITTED);
  }catch(error){
    if(isSimulatedCrash(error))throw error;
    if(replaced){
      try{
        journal=journal??await safeReadJournal(adapter,paths.journalPath);
        if(journal){
          journal=await transitionJournal(journal,CommitState.RECOVERY_REQUIRED,now,{failureCode:error?.code??'PC_UNKNOWN_POST_REPLACE_FAILURE'});
          await adapter.writeJournalDurable(paths.journalPath,journal);
        }
        const rolled=await rollbackFromExactBackup({candidate,targetPath,paths,adapter,verification,journal,inject,now});
        if(lockAcquired){await adapter.releaseLock(paths.lockPath).catch(()=>{});lockAcquired=false;}
        const wrapped=pcError('PC_COMMIT_FAILED_ROLLED_BACK',error instanceof Error?error.message:String(error));
        wrapped.recovery=rolled;throw wrapped;
      }catch(rollbackError){
        if(rollbackError?.code==='PC_COMMIT_FAILED_ROLLED_BACK')throw rollbackError;
        if(journal){
          try{
            journal=await transitionJournal(journal,CommitState.RECOVERY_REQUIRED,now,{failureCode:error?.code??'PC_POST_REPLACE_FAILURE',rollbackFailureCode:rollbackError?.code??'PC_ROLLBACK_FAILURE'});
            await adapter.writeJournalDurable(paths.journalPath,journal);
          }catch{}
        }
        // Deliberately keep the lock marker on disk. Recovery must reclaim it explicitly.
        throw pcError('PC_RECOVERY_REQUIRED',`${error?.code??error}; rollback=${rollbackError?.code??rollbackError}`);
      }
    }

    // Before replacement, the engine never repairs or overwrites an externally changed source.
    // Initial/final source-hash mismatches are propagated as concurrency/input failures.
    const externalSourceMismatch=new Set(['PC_SOURCE_HASH_MISMATCH','PC_SOURCE_LENGTH_MISMATCH','PC_SOURCE_CHANGED_BEFORE_REPLACE','PC_SOURCE_LENGTH_CHANGED_BEFORE_REPLACE']).has(error?.code);
    try{
      if(externalSourceMismatch||!sourceMatchedAtInitialCheck){
        if(journal){
          journal=await transitionJournal(journal,CommitState.ABORTED,now,{failureCode:error?.code??'PC_SOURCE_IDENTITY_FAILURE',externalSourceChanged:true});
          await adapter.writeJournalDurable(paths.journalPath,journal);
        }
      }else{
        const current=await adapter.readFile(targetPath);
        await assertExactBytes(current,candidate.manifest.input.originalSha256,candidate.manifest.input.originalFileLength,'PC_PRE_REPLACE_ORIGINAL_LOST','PC_PRE_REPLACE_ORIGINAL_LENGTH_CHANGED');
        if(journal){
          journal=await transitionJournal(journal,CommitState.ABORTED,now,{failureCode:error?.code??'PC_PRE_REPLACE_FAILURE'});
          await adapter.writeJournalDurable(paths.journalPath,journal);
        }
      }
    }catch(checkError){
      if(journal){
        try{
          journal=await transitionJournal(journal,CommitState.RECOVERY_REQUIRED,now,{failureCode:checkError?.code??'PC_PRE_REPLACE_INVARIANT_FAILURE'});
          await adapter.writeJournalDurable(paths.journalPath,journal);
        }catch{}
      }
      throw pcError('PC_RECOVERY_REQUIRED',checkError instanceof Error?checkError.message:String(checkError));
    }finally{
      if(lockAcquired){await adapter.releaseLock(paths.lockPath).catch(()=>{});lockAcquired=false;}
      await adapter.removeFileIfExists(paths.tempPath).catch(()=>{});
      await cleanupInvalidPreReplaceBackup({adapter,path:paths.backupPath,expectedSha:candidate.manifest.input.originalSha256,expectedLength:candidate.manifest.input.originalFileLength});
    }
    throw error;
  }
}

export async function recoverPreJournalStaleLock({
  targetPath,backupDirectory,lockPath,adapter,now=()=>new Date().toISOString()
}){
  requireAdapter(adapter);
  if(typeof targetPath!=='string'||!targetPath)throw pcError('PC_TARGET_PATH_REQUIRED');
  if(typeof backupDirectory!=='string'||!backupDirectory)throw pcError('PC_BACKUP_DIRECTORY_REQUIRED');
  if(typeof lockPath!=='string'||!lockPath)throw pcError('PC_LOCK_PATH_REQUIRED');
  const stale=await adapter.readJson(lockPath);await verifyLock(stale);
  if(stale.host!==adapter.hostId)throw pcError('PC_LOCK_FOREIGN_HOST');
  if(await adapter.isProcessAlive(stale.pid))throw pcError('PC_LOCK_ACTIVE');
  if(stale.targetPath!==adapter.normalizePath(targetPath))throw pcError('PC_LOCK_TARGET_MISMATCH');
  if(typeof stale.sourceSha256!=='string'||typeof stale.candidateSha256!=='string'||!Number.isSafeInteger(stale.sourceLength)||!Number.isSafeInteger(stale.candidateLength))throw pcError('PC_LOCK_IDENTITY_INCOMPLETE');
  const expected=await adapter.derivePaths({targetPath,backupDirectory,transactionId:stale.transactionId,sourceSha256:stale.sourceSha256});
  if(!samePathRecord(expected,stale.paths)||adapter.normalizePath(lockPath)!==adapter.normalizePath(expected.lockPath)||adapter.normalizePath(stale.journalPath)!==adapter.normalizePath(expected.journalPath))throw pcError('PC_LOCK_PATH_BINDING_MISMATCH');
  await adapter.assertEnvironment({targetPath,backupDirectory,paths:expected,mode:stale.mode,proofRoot:stale.proofRoot??null,recovery:true});
  if(await adapter.exists(expected.journalPath))throw pcError('PC_JOURNAL_EXISTS_USE_JOURNAL_RECOVERY');

  // Atomically re-establish ownership of the stale lock before touching any transaction artifacts.
  await adapter.releaseLock(expected.lockPath);
  const recoveryLock=await withIntegrity({
    contract:PERSISTENT_COMMIT_LOCK_CONTRACT,transactionId:stale.transactionId,pid:adapter.processId,host:adapter.hostId,
    createdAt:now(),targetPath:adapter.normalizePath(targetPath),journalPath:expected.journalPath,
    sourceSha256:stale.sourceSha256,sourceLength:stale.sourceLength,candidateSha256:stale.candidateSha256,candidateLength:stale.candidateLength,
    paths:deepClone(expected),recovery:true,preJournal:true
  });
  await adapter.acquireLock(expected.lockPath,recoveryLock);
  try{
    const current=await adapter.readFile(targetPath);
    await assertExactBytes(current,stale.sourceSha256,stale.sourceLength,'PC_PREJOURNAL_SOURCE_HASH_MISMATCH','PC_PREJOURNAL_SOURCE_LENGTH_MISMATCH');
    // A pre-journal transaction never reached replacement. Temp/rollback-temp are non-authoritative.
    await adapter.removeFileIfExists(expected.tempPath).catch(()=>{});
    await adapter.removeFileIfExists(expected.rollbackTempPath).catch(()=>{});
    await adapter.syncDirectory(adapter.dirname(targetPath));
    // Preserve any byte-exact backup; remove only a corrupt/partial backup at this exact transaction path.
    await cleanupInvalidPreReplaceBackup({adapter,path:expected.backupPath,expectedSha:stale.sourceSha256,expectedLength:stale.sourceLength});
    return deepFreeze({contract:PERSISTENT_COMMIT_ENGINE_CONTRACT,status:CommitState.ABORTED,preJournalRecovery:true,paths:deepClone(expected),persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false});
  }finally{
    await adapter.releaseLock(expected.lockPath).catch(()=>{});
  }
}

export async function recoverPersistentCommit({
  targetPath, journalPath, adapter, verification, faultInjector=null, now=()=>new Date().toISOString()
}){
  requireAdapter(adapter);requireVerification(verification);
  const inject=makeInjector(faultInjector);
  let journal=await readAndVerifyJournal(adapter,journalPath);
  if(journal.target.path!==adapter.normalizePath(targetPath))throw pcError('PC_RECOVERY_TARGET_MISMATCH');
  const backupDirectory=adapter.dirname(journalPath);
  const expectedPaths=await adapter.derivePaths({targetPath,backupDirectory,transactionId:journal.transactionId,sourceSha256:journal.source.sha256});
  if(!samePathRecord(expectedPaths,journal.paths)||adapter.normalizePath(journalPath)!==adapter.normalizePath(expectedPaths.journalPath))throw pcError('PC_JOURNAL_PATH_BINDING_MISMATCH');
  const paths=journal.paths;
  await adapter.assertEnvironment({targetPath,backupDirectory,paths,mode:journal.execution.mode,proofRoot:journal.execution.proofRoot??null,recovery:true});

  await reclaimStaleLockForRecovery({adapter,lockPath:paths.lockPath,journal});
  let recoveryLock=false;
  try{
    await adapter.acquireLock(paths.lockPath,await buildRecoveryLockRecord(journal,adapter,now));
    recoveryLock=true;
    journal=await readAndVerifyJournal(adapter,journalPath);
    const backupBytes=await adapter.readFile(paths.backupPath).catch(()=>null);
    if(!(backupBytes instanceof Uint8Array))throw pcError('PC_BACKUP_MISSING_DURING_RECOVERY');
    await assertExactBytes(backupBytes,journal.source.sha256,journal.source.length,'PC_BACKUP_HASH_MISMATCH','PC_BACKUP_LENGTH_MISMATCH');
    await verification.verifyOriginal(backupBytes,journal.verificationEnvelope.candidate);

    if(TERMINAL_STATES.has(journal.state)){
      const current=await readFileOrNull(adapter,targetPath);
      if(journal.state===CommitState.COMMITTED){
        if(current&&await bytesMatch(current,journal.candidate.sha256,journal.candidate.length)){
          await verification.verifyCandidate({...journal.verificationEnvelope.candidate,backupOriginalBytes:backupBytes,candidateBytes:current});
          await adapter.releaseLock(paths.lockPath);recoveryLock=false;return freezeResult(journal,paths,journal.state);
        }
        if(current&&await bytesMatch(current,journal.source.sha256,journal.source.length)){
          journal=await transitionJournal(journal,CommitState.ROLLED_BACK,now,{recoveryReason:'TARGET_IS_EXACT_ORIGINAL'});
          await adapter.writeJournalDurable(journalPath,journal);
          await adapter.releaseLock(paths.lockPath);recoveryLock=false;return freezeResult(journal,paths,journal.state);
        }
        return await recoverByRollback({journal,backupBytes,targetPath,paths,adapter,verification,inject,now,recoveryLockRef:()=>{recoveryLock=false;}});
      }
      // ABORTED / ROLLED_BACK remain original-authoritative. Missing/corrupt target is repaired only from the exact retained backup.
      if(current&&await bytesMatch(current,journal.source.sha256,journal.source.length)){
        await verification.verifyOriginal(current,journal.verificationEnvelope.candidate);
        await adapter.releaseLock(paths.lockPath);recoveryLock=false;return freezeResult(journal,paths,journal.state);
      }
      return await recoverByRollback({journal,backupBytes,targetPath,paths,adapter,verification,inject,now,recoveryLockRef:()=>{recoveryLock=false;}});
    }

    const current=await readFileOrNull(adapter,targetPath);
    const targetIsCandidate=current?await bytesMatch(current,journal.candidate.sha256,journal.candidate.length):false;
    const targetIsOriginal=current?await bytesMatch(current,journal.source.sha256,journal.source.length):false;

    if(targetIsCandidate){
      try{
        await verification.verifyCandidate({...journal.verificationEnvelope.candidate,backupOriginalBytes:backupBytes,candidateBytes:current});
        await adapter.syncDirectory(adapter.dirname(targetPath));
        journal=await transitionJournal(journal,CommitState.COMMITTED,now,{recoveryReason:`RECOVERED_FROM_${journal.state}`});
        await adapter.writeJournalDurable(journalPath,journal);
        await adapter.releaseLock(paths.lockPath);recoveryLock=false;return freezeResult(journal,paths,journal.state);
      }catch{
        return await recoverByRollback({journal,backupBytes,targetPath,paths,adapter,verification,inject,now,recoveryLockRef:()=>{recoveryLock=false;}});
      }
    }

    if(targetIsOriginal){
      // Conservative deterministic policy: before a committed candidate is observed, recovery
      // chooses the exact original rather than attempting to replay a possibly interrupted replace.
      await verification.verifyOriginal(current,journal.verificationEnvelope.candidate);
      await adapter.removeFileIfExists(paths.tempPath).catch(()=>{});
      const terminal=journal.state===CommitState.REPLACED||journal.state===CommitState.RECOVERY_REQUIRED?CommitState.ROLLED_BACK:CommitState.ABORTED;
      journal=await transitionJournal(journal,terminal,now,{recoveryReason:`EXACT_ORIGINAL_FROM_${journal.state}`});
      await adapter.writeJournalDurable(journalPath,journal);
      await adapter.releaseLock(paths.lockPath);recoveryLock=false;return freezeResult(journal,paths,journal.state);
    }

    return await recoverByRollback({journal,backupBytes,targetPath,paths,adapter,verification,inject,now,recoveryLockRef:()=>{recoveryLock=false;}});
  }catch(error){
    if(recoveryLock){/* leave marker for explicit recovery retry */}
    throw error;
  }
}

async function recoverByRollback({journal,backupBytes,targetPath,paths,adapter,verification,inject,now,recoveryLockRef}){
  try{
    const rolled=await rollbackFromExactBackup({candidate:journal.verificationEnvelope.candidate,targetPath,paths,adapter,verification,journal,inject,now});
    await adapter.releaseLock(paths.lockPath);recoveryLockRef();return rolled;
  }catch(error){
    try{
      const next=await transitionJournal(journal,CommitState.RECOVERY_REQUIRED,now,{rollbackFailureCode:error?.code??'PC_ROLLBACK_FAILURE'});
      await adapter.writeJournalDurable(paths.journalPath,next);
    }catch{}
    throw pcError('PC_RECOVERY_REQUIRED',error instanceof Error?error.message:String(error));
  }
}

async function rollbackFromExactBackup({candidate,targetPath,paths,adapter,verification,journal,inject,now}){
  await inject(CommitFaultStage.BEFORE_ROLLBACK,{paths,journal});
  const backup=await adapter.readFile(paths.backupPath);
  await assertExactBytes(backup,candidate.manifest.input.originalSha256,candidate.manifest.input.originalFileLength,'PC_BACKUP_HASH_MISMATCH','PC_BACKUP_LENGTH_MISMATCH');
  await verification.verifyOriginal(backup,candidate);
  await adapter.removeFileIfExists(paths.rollbackTempPath).catch(()=>{});
  await adapter.writeFileExclusive(paths.rollbackTempPath,backup);
  await inject(CommitFaultStage.BEFORE_ROLLBACK_FSYNC,{paths,journal});
  await adapter.syncFile(paths.rollbackTempPath);
  await adapter.syncDirectory(adapter.dirname(paths.rollbackTempPath));
  const rollbackTemp=await adapter.readFile(paths.rollbackTempPath);
  await assertExactBytes(rollbackTemp,candidate.manifest.input.originalSha256,candidate.manifest.input.originalFileLength,'PC_ROLLBACK_TEMP_HASH_MISMATCH','PC_ROLLBACK_TEMP_LENGTH_MISMATCH');
  await adapter.atomicReplace(paths.rollbackTempPath,targetPath);
  await inject(CommitFaultStage.AFTER_ROLLBACK_REPLACE,{paths,journal});
  await adapter.syncDirectory(adapter.dirname(targetPath));
  const restored=await adapter.readFile(targetPath);
  await assertExactBytes(restored,candidate.manifest.input.originalSha256,candidate.manifest.input.originalFileLength,'PC_ROLLBACK_HASH_MISMATCH','PC_ROLLBACK_LENGTH_MISMATCH');
  await verification.verifyOriginal(restored,candidate);
  await inject(CommitFaultStage.AFTER_ROLLBACK_VERIFY,{paths,journal});
  let next=journal??await safeReadJournal(adapter,paths.journalPath);
  if(next){next=await transitionJournal(next,CommitState.ROLLED_BACK,now,{recoveryReason:'EXACT_BACKUP_RESTORED'});await adapter.writeJournalDurable(paths.journalPath,next);}
  return freezeResult(next,paths,CommitState.ROLLED_BACK);
}


async function cleanupInvalidPreReplaceBackup({adapter,path,expectedSha,expectedLength}){
  try{
    if(!(await adapter.exists(path)))return;
    const b=await adapter.readFile(path);
    if(await bytesMatch(b,expectedSha,expectedLength))return;
    await adapter.removeFileIfExists(path);
    await adapter.syncDirectory(adapter.dirname(path));
  }catch{}
}

async function createJournal(base){
  const core=deepClone(base);delete core.integrity;
  const sha256=await sha256Text(canonicalJson(core));
  return deepFreeze({...core,integrity:{algorithm:'SHA-256',sha256}});
}
async function transitionJournal(journal,state,now,extra={}){
  if(!VALID_STATES.has(state))throw pcError('PC_JOURNAL_STATE_INVALID');
  const core=deepClone(journal);delete core.integrity;
  core.state=state;core.revision=Number(core.revision||0)+1;core.updatedAt=now();Object.assign(core,deepClone(extra));
  return createJournal(core);
}
export async function verifyJournalIntegrity(journal){
  if(!journal||journal.contract!==PERSISTENT_COMMIT_JOURNAL_CONTRACT||!VALID_STATES.has(journal.state))throw pcError('PC_JOURNAL_INVALID');
  if(journal.persistentWriteAuthorized!==false||journal.WORLD_PERSISTENT_WRITE_V125!==false)throw pcError('PC_JOURNAL_AUTHORIZATION_INVALID');
  if(journal.integrity?.algorithm!=='SHA-256'||typeof journal.integrity.sha256!=='string')throw pcError('PC_JOURNAL_INTEGRITY_MISSING');
  const core=deepClone(journal);delete core.integrity;
  const actual=await sha256Text(canonicalJson(core));
  if(actual!==journal.integrity.sha256)throw pcError('PC_JOURNAL_INTEGRITY_MISMATCH');
  validateJournalSemanticBindings(journal);
  return true;
}
function validateJournalSemanticBindings(j){
  if(!Number.isSafeInteger(j.revision)||j.revision<1||typeof j.transactionId!=='string'||!j.transactionId)throw pcError('PC_JOURNAL_SHAPE_INVALID');
  if(j.execution?.mode!=='PROOF_ONLY'||j.execution?.environment?.contract!=='dreamwish.ddv.node-posix-local-commit-surface@1')throw pcError('PC_JOURNAL_EXECUTION_BINDING_INVALID');
  if(typeof j.target?.path!=='string'||!j.target.path)throw pcError('PC_JOURNAL_TARGET_INVALID');
  for(const k of ['targetPath','lockPath','tempPath','rollbackTempPath','backupPath','journalPath'])if(typeof j.paths?.[k]!=='string'||!j.paths[k])throw pcError('PC_JOURNAL_PATHS_INVALID');
  if(typeof j.source?.sha256!=='string'||!/^[0-9a-f]{64}$/.test(j.source.sha256)||!Number.isSafeInteger(j.source.length)||j.source.length<1)throw pcError('PC_JOURNAL_SOURCE_INVALID');
  if(typeof j.candidate?.sha256!=='string'||!/^[0-9a-f]{64}$/.test(j.candidate.sha256)||!Number.isSafeInteger(j.candidate.length)||j.candidate.length<1||typeof j.candidate.manifestSha256!=='string'||typeof j.candidate.planSha256!=='string')throw pcError('PC_JOURNAL_CANDIDATE_INVALID');
  if(j.build?.platform!=='switch'||j.build?.gameVersion!=='1.25.0'||j.build?.profileGameInfoVersion!==624||j.build?.targetBuild?.platform!=='switch'||j.build?.targetBuild?.kind!=='switch-bid'||j.build?.targetBuild?.value!==SWITCH_V125_BID)throw pcError('PC_JOURNAL_BUILD_BINDING_INVALID');
  if(j.backupRetention?.automaticDeletion!==false||j.backupRetention?.minimum!=='UNTIL_EXPLICIT_POST_RELOAD_ACK'||j.backupRetention?.lastKnownGoodBackupDeletionForbidden!==true)throw pcError('PC_JOURNAL_BACKUP_RETENTION_INVALID');
  const envelope=j.verificationEnvelope?.candidate;
  if(!envelope?.manifest||!envelope?.plan)throw pcError('PC_JOURNAL_VERIFICATION_ENVELOPE_INVALID');
  if(envelope.manifest.input?.originalSha256!==j.source.sha256||envelope.manifest.input?.originalFileLength!==j.source.length||envelope.manifest.output?.candidateSha256!==j.candidate.sha256||envelope.manifest.output?.candidateFileLength!==j.candidate.length||envelope.manifest.candidateManifestSha256!==j.candidate.manifestSha256||envelope.manifest.planSha256!==j.candidate.planSha256)throw pcError('PC_JOURNAL_CANDIDATE_BINDING_MISMATCH');
  validateMinimumPersistentTransformProofScope(envelope,j.runtimeEvidence);
}
async function readAndVerifyJournal(adapter,path){const j=await adapter.readJson(path);await verifyJournalIntegrity(j);return j;}
async function safeReadJournal(adapter,path){try{return await readAndVerifyJournal(adapter,path);}catch{return null;}}

function buildImmutableJournalFields({candidate,transactionId,targetPath,paths,adapter,mode,runtimeEvidence,now}){
  const m=candidate.manifest;
  return {
    contract:PERSISTENT_COMMIT_JOURNAL_CONTRACT,engineContract:PERSISTENT_COMMIT_ENGINE_CONTRACT,
    transactionId,createdAt:now(),execution:{mode,environment:deepClone(adapter.environmentDescriptor),proofRoot:mode==='PROOF_ONLY'?adapter.normalizePath(adapter.proofRoot??''):null},
    target:{path:adapter.normalizePath(targetPath)},paths:deepClone(paths),
    source:{sha256:m.input.originalSha256,length:m.input.originalFileLength},
    candidate:{sha256:m.output.candidateSha256,length:m.output.candidateFileLength,manifestSha256:m.candidateManifestSha256,planSha256:m.planSha256},
    operation:deepClone(m.operation),runtimeEvidence:deepClone(runtimeEvidence),build:{platform:m.input.platform,gameVersion:m.input.gameVersion,profileGameInfoVersion:m.input.profileGameInfoVersion,targetBuild:deepClone(m.input.targetBuild),exactBuildContractId:m.input.exactBuildContractId},
    verificationEnvelope:{candidate:{manifest:deepClone(candidate.manifest),plan:deepClone(candidate.plan)}},
    backupRetention:{automaticDeletion:false,minimum:'UNTIL_EXPLICIT_POST_RELOAD_ACK',lastKnownGoodBackupDeletionForbidden:true},
    persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false
  };
}
async function buildLockRecord(immutable,adapter,now){
  const core={contract:PERSISTENT_COMMIT_LOCK_CONTRACT,transactionId:immutable.transactionId,pid:adapter.processId,host:adapter.hostId,createdAt:now(),targetPath:immutable.target.path,journalPath:immutable.paths.journalPath,sourceSha256:immutable.source.sha256,sourceLength:immutable.source.length,candidateSha256:immutable.candidate.sha256,candidateLength:immutable.candidate.length,paths:deepClone(immutable.paths),mode:immutable.execution.mode,proofRoot:immutable.execution.proofRoot};
  return withIntegrity(core);
}
async function buildRecoveryLockRecord(journal,adapter,now){
  const core={contract:PERSISTENT_COMMIT_LOCK_CONTRACT,transactionId:journal.transactionId,pid:adapter.processId,host:adapter.hostId,createdAt:now(),targetPath:journal.target.path,journalPath:journal.paths.journalPath,sourceSha256:journal.source.sha256,sourceLength:journal.source.length,candidateSha256:journal.candidate.sha256,candidateLength:journal.candidate.length,paths:deepClone(journal.paths),recovery:true};
  return withIntegrity(core);
}
async function withIntegrity(core){return {...core,integrity:{algorithm:'SHA-256',sha256:await sha256Text(canonicalJson(core))}};}
async function verifyLock(lock){if(!lock||lock.contract!==PERSISTENT_COMMIT_LOCK_CONTRACT)throw pcError('PC_LOCK_INVALID');const core=deepClone(lock);delete core.integrity;const actual=await sha256Text(canonicalJson(core));if(lock.integrity?.sha256!==actual)throw pcError('PC_LOCK_INTEGRITY_MISMATCH');return true;}
async function reclaimStaleLockForRecovery({adapter,lockPath,journal}){
  if(!(await adapter.exists(lockPath)))return;
  const lock=await adapter.readJson(lockPath);await verifyLock(lock);
  if(lock.transactionId!==journal.transactionId)throw pcError('PC_LOCK_TRANSACTION_MISMATCH');
  if(lock.host!==adapter.hostId)throw pcError('PC_LOCK_FOREIGN_HOST');
  if(lock.targetPath!==journal.target.path||lock.journalPath!==journal.paths.journalPath||lock.sourceSha256!==journal.source.sha256||lock.candidateSha256!==journal.candidate.sha256)throw pcError('PC_LOCK_JOURNAL_BINDING_MISMATCH');
  if(await adapter.isProcessAlive(lock.pid))throw pcError('PC_LOCK_ACTIVE');
  await adapter.removeFileIfExists(lockPath);await adapter.syncDirectory(adapter.dirname(lockPath));
}


async function readFileOrNull(adapter,path){try{return await adapter.readFile(path);}catch{return null;}}
function samePathRecord(a,b){
  const keys=['targetPath','lockPath','tempPath','rollbackTempPath','backupPath','journalPath'];
  return Boolean(a&&b&&keys.every(k=>a[k]===b[k]));
}


function validateMinimumPersistentTransformProofScope(candidate,runtimeEvidence){
  const m=candidate.manifest,p=candidate.plan;
  if(runtimeEvidence.contract!==MIN_TRANSFORM_RUNTIME_BINDING||runtimeEvidence.status!=='CONFIRMED_PASS'||runtimeEvidence.moveReturnedSha256!==MOVE_RUNTIME_RETURNED_SHA256||runtimeEvidence.rotateReturnedSha256!==ROTATE_RUNTIME_RETURNED_SHA256||runtimeEvidence.coldPersistence!==true||runtimeEvidence.serializedCompanionFieldsObserved!==false||runtimeEvidence.transformNormalizationObserved!==false)throw pcError('PC_RUNTIME_EVIDENCE_BINDING_MISMATCH');
  if(m.input?.platform!=='switch'||m.input?.gameVersion!=='1.25.0'||m.input?.profileGameInfoVersion!==624||m.input?.targetBuild?.platform!=='switch'||m.input?.targetBuild?.kind!=='switch-bid'||m.input?.targetBuild?.value!==SWITCH_V125_BID)throw pcError('PC_MINIMUM_SCOPE_TARGET_BUILD_MISMATCH');
  if(!p||p.semanticOwner!==MIN_TRANSFORM_SEMANTIC_OWNER||p.operation?.owner!==MIN_TRANSFORM_SEMANTIC_OWNER||p.operation?.id!==MIN_TRANSFORM_OPERATION_ID||!['MOVE','ROTATE'].includes(p.operation?.kind))throw pcError('PC_MINIMUM_SCOPE_OPERATION_MISMATCH');
  if(p.mutationAdapter?.contract!=='dreamwish.ddv.save-mutation-adapter@1'||p.mutationAdapter?.id!==MIN_TRANSFORM_ADAPTER_ID||p.mutationAdapter?.owner!==MIN_TRANSFORM_SEMANTIC_OWNER)throw pcError('PC_MINIMUM_SCOPE_ADAPTER_MISMATCH');
  if(p.intent?.semanticContract!==MIN_TRANSFORM_SEMANTIC_CONTRACT||p.intent?.persistentWriteAuthorized!==false)throw pcError('PC_MINIMUM_SCOPE_SEMANTIC_CONTRACT_MISMATCH');
  const fields=(p.allowedChanges||[]).map(x=>String(x?.path||'').split('/').at(-1)).sort();
  const expected=p.operation.kind==='MOVE'?['X','Y']:['Orientation'];
  if(JSON.stringify(fields)!==JSON.stringify([...expected].sort()))throw pcError('PC_MINIMUM_SCOPE_ALLOWED_FIELDS_MISMATCH');
  if(m.operation?.id!==MIN_TRANSFORM_OPERATION_ID||m.operation?.kind!==p.operation.kind||m.operation?.owner!==MIN_TRANSFORM_SEMANTIC_OWNER)throw pcError('PC_MINIMUM_SCOPE_MANIFEST_OPERATION_MISMATCH');
  if(m.semanticOwner!==MIN_TRANSFORM_SEMANTIC_OWNER||m.mutationAdapter?.id!==MIN_TRANSFORM_ADAPTER_ID)throw pcError('PC_MINIMUM_SCOPE_MANIFEST_BINDING_MISMATCH');
}

function validateInputs({candidate,targetPath,backupDirectory,transactionId,adapter,verification,runtimeEvidence,mode,proofRoot}){
  if(!runtimeEvidence||typeof runtimeEvidence!=='object')throw pcError('PC_RUNTIME_EVIDENCE_REQUIRED');
  if(!candidate?.manifest||!(candidate.candidateBytes instanceof Uint8Array)||!(candidate.backupOriginalBytes instanceof Uint8Array))throw pcError('PC_WRITE_CANDIDATE_REQUIRED');
  if(typeof targetPath!=='string'||!targetPath)throw pcError('PC_TARGET_PATH_REQUIRED');
  if(typeof backupDirectory!=='string'||!backupDirectory)throw pcError('PC_BACKUP_DIRECTORY_REQUIRED');
  if(typeof transactionId!=='string'||transactionId.length<1||transactionId.length>MAX_TRANSACTION_ID||!/^[A-Za-z0-9._-]+$/.test(transactionId))throw pcError('PC_TRANSACTION_ID_INVALID');
  requireAdapter(adapter);requireVerification(verification);
  if(mode!=='PROOF_ONLY'&&mode!=='AUTHORIZED')throw pcError('PC_EXECUTION_MODE_INVALID');
  if(mode==='AUTHORIZED')throw pcError('PC_PERSISTENT_WRITE_NOT_AUTHORIZED');
  if(mode==='PROOF_ONLY'&&(typeof proofRoot!=='string'||!proofRoot))throw pcError('PC_PROOF_ROOT_REQUIRED');
  adapter.proofRoot=proofRoot;
}
function requireAdapter(a){const req=['derivePaths','assertEnvironment','acquireLock','releaseLock','readFile','writeFileExclusive','syncFile','syncDirectory','atomicReplace','removeFileIfExists','writeJournalDurable','readJson','exists','dirname','normalizePath','isProcessAlive'];if(!a||a.contract!=='dreamwish.ddv.persistent-commit-filesystem-adapter@1'||req.some(k=>typeof a[k]!=='function'))throw pcError('PC_FILESYSTEM_ADAPTER_INVALID');}
function requireVerification(v){if(!v||v.contract!==PERSISTENT_COMMIT_VERIFICATION_BINDING||typeof v.verifyCandidate!=='function'||typeof v.verifyOriginal!=='function')throw pcError('PC_VERIFICATION_BINDING_INVALID');}
function makeInjector(fn){return async(stage,context)=>{if(typeof fn==='function')await fn(stage,context);};}
function isSimulatedCrash(e){return e?.code==='PC_SIMULATED_CRASH';}
export function simulatedCrash(stage='UNKNOWN'){const e=pcError('PC_SIMULATED_CRASH',stage);return e;}
async function assertExactBytes(bytes,sha,len,hashCode,lenCode){if(!(bytes instanceof Uint8Array))throw pcError(hashCode);if(bytes.length!==len)throw pcError(lenCode);if(await sha256Hex(bytes)!==sha)throw pcError(hashCode);}
async function bytesMatch(bytes,sha,len){return bytes instanceof Uint8Array&&bytes.length===len&&await sha256Hex(bytes)===sha;}
function freezeResult(journal,paths,state){return deepFreeze({contract:PERSISTENT_COMMIT_ENGINE_CONTRACT,status:state,journal:journal?deepClone(journal):null,paths:deepClone(paths),persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false});}
function deepClone(v){return structuredClone(v);}
function deepFreeze(v){if(v&&typeof v==='object'&&!(v instanceof Uint8Array)&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);}return v;}
function canonicalJson(v){return JSON.stringify(canonicalize(v));}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonicalize(v[k]);return o;}return v;}
async function sha256Text(t){return sha256Hex(new TextEncoder().encode(t));}
async function sha256Hex(bytes){if(!globalThis.crypto?.subtle)throw pcError('PC_WEBCRYPTO_UNAVAILABLE');const d=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function pcError(code,detail=''){const e=new Error(detail?`${code}: ${detail}`:code);e.code=code;return e;}