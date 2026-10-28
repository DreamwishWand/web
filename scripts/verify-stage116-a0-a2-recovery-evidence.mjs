// Source-only Stage116 A0–A2 evidence SHAPE preflight.
// Reuses existing Community operations/backup-privacy contracts. NEVER performs I/O to Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const REQUIRED_A1 = Object.freeze([
  'managedMigrationLedger', 'appliedSqlBodiesAndStageOnlyEffects',
  'schemaRlsAclTriggers', 'authSessionsQueuesAndOutbox',
  'edgeCronPgNetDirectSqlIssuerInventory', 'workerDestinationAndTokenScope',
  'postgrestExposedSchemas', 'ctrl51ThirtySqlDifferences'
]);
export const REQUIRED_A2 = Object.freeze([
  'dbBackup', 'dbIsolatedRestore', 'dbDataAndMetadataParity',
  'storageOriginalBytesBackup', 'storageIsolatedRestoreAndSha256Parity',
  'storageObjectVersionsAndRetentionHolds', 'externalDeletionLedger',
  'deletionLedgerReconciliation', 'authSessionRevalidation',
  'independentDrillReview'
]);

const sha = (x) => typeof x === 'string' && /^sha256:[a-f0-9]{64}$/.test(x);
const nonempty = (x) => typeof x === 'string' && x.trim().length >= 3 && x.length <= 160;
const isClean = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function assessStage116A0A2(e, ops, privacy) {
  const errors = [];
  const need = (ok, id) => { if (!ok) errors.push(id); };
  const dbPolicy = ops?.backupPolicy?.database;
  const storePolicy = ops?.backupPolicy?.storageObjects;
  const restorePolicy = ops?.backupPolicy?.restore;
  const contract = privacy?.recoveryTargets;
  need(ops?.schema === 'dreamwish-community-production-ops@1', 'CANONICAL_OPS');
  need(privacy?.schema === 'dreamwish-community-backup-privacy-contract@1', 'CANONICAL_PRIVACY');
  need(ops?.staging?.projectRef === 'ptpdoxhrqopvczpclcij', 'PROJECT_REF');
  need(dbPolicy?.launchRequirement === 'managed-daily-or-verified-offsite-logical-backup'
    && dbPolicy?.restoreDrillRequired === true && dbPolicy?.pitrRequiredAtLaunch === false,
    'CANONICAL_FREE_BACKUP_ROUTE');
  need(storePolicy?.separateBackupRequired === true && storePolicy?.restoreDrillRequired === true
    && storePolicy?.independentRollbackDomainRequired === true, 'CANONICAL_STORAGE_SEPARATE');
  need(restorePolicy?.restoreToNonProductionTargetFirst === true
    && restorePolicy?.deletionLedgerReconciliationRequired === true, 'CANONICAL_QUARANTINE');
  need(privacy?.recoveryDeletionLedger?.mustBeOutsidePrimaryRollbackDomain === true,
    'CANONICAL_DELETION_LEDGER');
  need(dbPolicy?.maximumRpoHours <= 24 && storePolicy?.maximumRpoHours <= 24
    && restorePolicy?.targetRtoHours <= 4 && contract?.databaseRpoHoursMax <= 24
    && contract?.storageRpoHoursMax <= 24 && contract?.rtoHoursTarget <= 4,
    'CANONICAL_RPO_RTO');

  need(e?.schema === 'dreamwishwand-stage116-a0-a2-evidence@1', 'EVIDENCE_SCHEMA');
  need(e?.stageProjectRef === ops?.staging?.projectRef, 'STAGE_IDENTITY');
  need(e?.managedMigrationCount === 116, 'STAGE116_LEDGER');
  need(e?.sourceTarget === 'Source153', 'FROZEN_SOURCE_TARGET');
  need(e?.snapshotPlan === 'OFFSITE_LOGICAL_DB_AND_ORIGINAL_STORAGE', 'DB_AND_STORAGE_REQUIRED');
  need(e?.sourceOnly === true && e?.a2PassClaim !== true, 'NO_RUNTIME_PASS_CLAIM');

  const a0 = e?.a0 ?? {};
  need(nonempty(a0.ticketId) && nonempty(a0.operatorId) && nonempty(a0.independentReviewerId)
    && a0.operatorId !== a0.independentReviewerId, 'A0_DISTINCT_NAMED_REVIEW');
  need(sha(a0.scopedApprovalReceipt) && a0.onlyStaging116 === true
    && a0.isolatedRestoreOnly === true && a0.noStageMutationInPreflight === true,
    'A0_SCOPED_APPROVAL_RECEIPT');

  const a1 = e?.a1 ?? {};
  for (const id of REQUIRED_A1) need(sha(a1.receipts?.[id]), 'A1_' + id);
  need(a1.unknownProviderCleanupWorkerResolved === true,
    'A1_PROVIDER_CLEANUP_DESTINATION_UNKNOWN');
  need(a1.allSevenCronAndPendingPgNetReconciled === true, 'A1_CRON_PGNET_INFLIGHT_UNKNOWN');
  need(a1.writtenStageOnlyMigrationEffectsPreserved === true, 'A1_STAGE_ONLY_SEMANTICS');

  const a2 = e?.a2 ?? {};
  need(a2.backupMechanism === 'VERIFIED_OFFSITE_LOGICAL_DB'
    || a2.backupMechanism === 'MANAGED_DAILY_DB', 'A2_DB_BACKUP_MECHANISM');
  // A branch with only migration-created schema is NOT the protected Stage116 restored clone.
  need(a2.isolatedRestoreTargetRef !== ops?.staging?.projectRef
    && nonempty(a2.isolatedRestoreTargetRef) && a2.targetContainsRestoredStageData === true,
    'A2_REAL_ISOLATED_DATA_RESTORE_NOT_BRANCH_ONLY');
  need(a2.originalStorageBytesCopied === true && a2.storageOutsideRollbackDomain === true
    && a2.storagePrivateToRecoveryOperators === true && a2.storageRestoredIndependently === true,
    'A2_INDEPENDENT_ORIGINAL_STORAGE_BYTES');
  need(a2.dbAndStorageHashesComparedAfterRestore === true, 'A2_DB_STORAGE_RESTORED_PARITY');
  need(a2.deletionLedgerOutsideRollbackDomain === true
    && a2.deletionLedgerReplayedBeforePromotion === true
    && a2.restoredSessionsRevalidated === true, 'A2_DELETION_AND_SESSION_RECONCILIATION');
  need(a2.storageLegalHoldsAndVersionsAccounted === true, 'A2_STORAGE_VERSIONS_HOLDS');
  need(a2.dbRpoHours >= 0 && a2.dbRpoHours <= 24
    && a2.storageRpoHours >= 0 && a2.storageRpoHours <= 24
    && a2.drillRtoHours >= 0 && a2.drillRtoHours <= 4, 'A2_RPO_RTO_OBSERVED');
  for (const id of REQUIRED_A2) need(sha(a2.receipts?.[id]), 'A2_' + id);
  need(sha(a2.independentReviewerAttestation)
    && a2.independentReviewerId === a0.independentReviewerId, 'A2_INDEPENDENT_REVIEWER');

  // Reject raw secrets or user content in repository/CI evidence. Receipts are digests ONLY.
  const prohibited = /(?:secret|password|access.?token|refresh.?token|decrypted|signed.?url|raw.?bytes|user.?row|private.?key|provider.?subject)/i;
  const walk = (v, key = '') => {
    if (prohibited.test(key)) errors.push('SENSITIVE_FIELD:' + key);
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (isClean(v)) { Object.entries(v).forEach(([k, x]) => walk(x, k)); }
  };
  walk(e);
  // This checks only local JSON consistency, not archive authenticity or an actual restore.
  return { readyForOperatorReview: errors.length === 0,
    a2Accepted: false, status: 'NEED_OPERATOR / NEED_RUNTIME', errors };
}

function synthetic() {
  const h = 'sha256:' + 'a'.repeat(64);
  const receipts = (keys) => Object.fromEntries(keys.map((x) => [x, h]));
  return {
    schema: 'dreamwishwand-stage116-a0-a2-evidence@1', stageProjectRef: 'ptpdoxhrqopvczpclcij',
    managedMigrationCount: 116, sourceTarget: 'Source153',
    snapshotPlan: 'OFFSITE_LOGICAL_DB_AND_ORIGINAL_STORAGE', sourceOnly: true, a2PassClaim: false,
    a0: { ticketId: 'SYNTHETIC-TICKET', operatorId: 'SYNTHETIC-OP',
      independentReviewerId: 'SYNTHETIC-QR', scopedApprovalReceipt: h,
      onlyStaging116: true, isolatedRestoreOnly: true, noStageMutationInPreflight: true },
    a1: { receipts: receipts(REQUIRED_A1), unknownProviderCleanupWorkerResolved: true,
      allSevenCronAndPendingPgNetReconciled: true, writtenStageOnlyMigrationEffectsPreserved: true },
    a2: { backupMechanism: 'VERIFIED_OFFSITE_LOGICAL_DB',
      isolatedRestoreTargetRef: 'SYNTHETIC-QUARANTINE', targetContainsRestoredStageData: true,
      originalStorageBytesCopied: true, storageOutsideRollbackDomain: true,
      storagePrivateToRecoveryOperators: true, storageRestoredIndependently: true,
      dbAndStorageHashesComparedAfterRestore: true, deletionLedgerOutsideRollbackDomain: true,
      deletionLedgerReplayedBeforePromotion: true, restoredSessionsRevalidated: true,
      storageLegalHoldsAndVersionsAccounted: true, dbRpoHours: 12, storageRpoHours: 12,
      drillRtoHours: 3, receipts: receipts(REQUIRED_A2),
      independentReviewerAttestation: h, independentReviewerId: 'SYNTHETIC-QR' }
  };
}
function selfTest(ops, privacy) {
  const sample = synthetic();
  const run = (mutate) => {
    const v = structuredClone(sample); mutate?.(v);
    return assessStage116A0A2(v, ops, privacy);
  };
  assert.equal(run().readyForOperatorReview, true, 'synthetic complete SHAPE must be accepted');
  assert.equal(run().a2Accepted, false, 'synthetic shape must never yield A2 PASS');
  const mutants = [
    (x) => { x.a0.independentReviewerId = x.a0.operatorId; },
    (x) => { delete x.a0.scopedApprovalReceipt; },
    (x) => { x.a1.unknownProviderCleanupWorkerResolved = false; },
    (x) => { delete x.a1.receipts.ctrl51ThirtySqlDifferences; },
    (x) => { x.a1.allSevenCronAndPendingPgNetReconciled = false; },
    (x) => { x.a2.targetContainsRestoredStageData = false; },
    (x) => { x.a2.isolatedRestoreTargetRef = x.stageProjectRef; },
    (x) => { x.a2.originalStorageBytesCopied = false; },
    (x) => { delete x.a2.receipts.storageIsolatedRestoreAndSha256Parity; },
    (x) => { x.a2.deletionLedgerReplayedBeforePromotion = false; },
    (x) => { x.a2.storageLegalHoldsAndVersionsAccounted = false; },
    (x) => { x.a2.independentReviewerId = 'SYNTHETIC-OTHER'; },
    (x) => { x.a2.backupMechanism = 'DATALESS_SCHEMA_BRANCH'; },
    (x) => { x.a2.dbRpoHours = 30; },
    (x) => { x.a2PassClaim = true; },
    (x) => { x.credentials = { password: 'SYNTHETIC-NO-REAL-SECRET' }; }
  ];
  for (const [i, mutation] of mutants.entries()) {
    const v = run(mutation);
    assert.equal(v.readyForOperatorReview, false, 'fail-closed negative fixture ' + i);
    assert.equal(v.a2Accepted, false, 'negative fixture must never issue PASS ' + i);
  }
  console.log('STAGE116_A0_A2_SOURCE_ONLY_SYNTHETIC_16_NEGATIVES_PASS; A2 remains NEED_OPERATOR');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) {
  const ops = JSON.parse(fs.readFileSync('ops/community-production-operations.json', 'utf8'));
  const privacy = JSON.parse(fs.readFileSync('ops/community-backup-privacy-contract.json', 'utf8'));
  if (process.argv.includes('--self-test')) selfTest(ops, privacy);
  else {
    const at = process.argv.indexOf('--evidence');
    const f = at >= 0 ? process.argv[at + 1] : null;
    if (!f || !fs.existsSync(f)) {
      console.error('NEED_OPERATOR: supply metadata-only --evidence JSON; no live Stage data read');
      process.exitCode = 1;
    } else {
      const out = assessStage116A0A2(JSON.parse(fs.readFileSync(f, 'utf8')), ops, privacy);
      console.log(JSON.stringify(out, null, 2));
      if (!out.readyForOperatorReview) process.exitCode = 1;
    }
  }
}
