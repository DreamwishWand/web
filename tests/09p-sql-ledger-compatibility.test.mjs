import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditMigrationLedger, normalizeAppliedMigrationRows, normalizeSourceMigrationFiles
} from '../scripts/09p-sql-ledger-compatibility.mjs';

const filenames = [
  '20260930024846_community_core_v0.sql',
  '20260930025132_community_core_v0_server_rpc.sql'
];
const applied = [
  { version: '20260930024846', name: 'community_core_v0' },
  { version: '20260930025132', name: 'community_core_v0_server_rpc' }
];
const goodFp = 'd9fc0bf64c49ea39583a0734705269bc';

test('source and applied migration identities identical does not imply bootstrap or Writer PASS', () => {
  const result = auditMigrationLedger({ sourceFiles: filenames, appliedRows: applied });
  assert.equal(result.status, 'BLOCKED_SCHEMA_ATTESTATION_MISSING');
  assert.equal(result.sourceCount, 2);
  assert.equal(result.appliedCount, 2);
  assert.deepEqual(result.sameNameDifferentVersion, []);
  assert.equal(result.sqlBytesAttested, false);
  assert.equal(result.mergeReady, false);
  assert.equal(result.deployReady, false);
  assert.equal(result.communityWriterEnabled, false);
});

test('same migration name at a different managed version is NOT compatible', () => {
  const changed = applied.map((row) => row.name === 'community_core_v0_server_rpc'
    ? { ...row, version: '20260930025609' } : row);
  const result = auditMigrationLedger({
    sourceFiles: filenames,
    appliedRows: changed,
    sourceSchemaFingerprint: goodFp,
    appliedSchemaFingerprint: goodFp
  });
  assert.equal(result.status, 'BLOCKED_HISTORY_DIVERGENCE');
  assert.deepEqual(result.sameNameDifferentVersion, [{
    name: 'community_core_v0_server_rpc',
    sourceVersion: '20260930025132',
    appliedVersions: ['20260930025609']
  }]);
  assert.deepEqual(result.extraApplied, ['20260930025609']);
  assert.equal(result.mergeReady, false);
});

test('same migration version with another name is NOT compatible', () => {
  const result = auditMigrationLedger({
    sourceFiles: filenames,
    appliedRows: [
      applied[0],
      { version: '20260930025132', name: 'different_sql_migration' }
    ]
  });
  assert.equal(result.status, 'BLOCKED_HISTORY_DIVERGENCE');
  assert.equal(result.mismatchedNamesForSameVersion.length, 1);
});

test('extra applied migration and absent original prevent unsafe promotion', () => {
  const result = auditMigrationLedger({
    sourceFiles: filenames,
    appliedRows: [{ version: '20260930024846', name: 'community_core_v0' },
      { version: '20261001000000', name: 'stage_only_writer' }]
  });
  assert.equal(result.status, 'BLOCKED_HISTORY_DIVERGENCE');
  assert.deepEqual(result.missingApplied, ['20260930025132']);
  assert.deepEqual(result.extraApplied, ['20261001000000']);
});

test('matching metadata and explicit matching fingerprints are structural only', () => {
  const result = auditMigrationLedger({
    sourceFiles: filenames,
    appliedRows: applied,
    sourceSchemaFingerprint: goodFp.toUpperCase(),
    appliedSchemaFingerprint: goodFp
  });
  assert.equal(result.status, 'STRUCTURAL_MATCH_ONLY_RUNTIME_QA_REQUIRED');
  assert.equal(result.schemaAttested, true);
  assert.equal(result.original82BootstrapAttested, false);
  assert.equal(result.effectiveAclAndSignedTwoPgAttested, false);
  assert.equal(result.mergeReady, false);
});

test('different schema fingerprints reject even matching versions and names', () => {
  const result = auditMigrationLedger({
    sourceFiles: filenames,
    appliedRows: applied,
    sourceSchemaFingerprint: goodFp,
    appliedSchemaFingerprint: '1ea8f80872fca5d70c936247f9f6d7ba'
  });
  assert.equal(result.status, 'BLOCKED_SCHEMA_FINGERPRINT_MISMATCH');
  assert.equal(result.schemaAttested, false);
});

test('invalid and duplicate historical ledger data fail closed', () => {
  assert.throws(() => normalizeSourceMigrationFiles([]), /SOURCE_MIGRATION_LIST_REQUIRED/);
  assert.throws(() => normalizeSourceMigrationFiles([
    '20260930025132_test_one.sql', '20260930025132_test_two.sql'
  ]), /SOURCE_MIGRATION_VERSION_DUPLICATED/);
  assert.throws(() => normalizeSourceMigrationFiles(['../bad.sql']), /SOURCE_MIGRATION_FILENAME_INVALID/);
  assert.throws(() => normalizeAppliedMigrationRows(null), /APPLIED_MIGRATION_LEDGER_NOT_READ/);
  assert.throws(() => normalizeAppliedMigrationRows([
    applied[0], { ...applied[0] }
  ]), /APPLIED_MIGRATION_VERSION_DUPLICATED/);
  assert.throws(() => normalizeAppliedMigrationRows([
    { version: '20260930', name: 'x' }
  ]), /APPLIED_MIGRATION_ENTRY_INVALID/);
});

test('malformed fingerprints cannot become compatibility evidence', () => {
  assert.throws(() => auditMigrationLedger({
    sourceFiles: filenames, appliedRows: applied, sourceSchemaFingerprint: 'unverified'
  }), /SCHEMA_FINGERPRINT_INVALID/);
  assert.throws(() => auditMigrationLedger({
    sourceFiles: filenames, appliedRows: applied, appliedSchemaFingerprint: 42
  }), /SCHEMA_FINGERPRINT_INVALID/);
});
