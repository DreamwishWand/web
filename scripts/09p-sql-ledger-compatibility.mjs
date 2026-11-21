// 09P-SQL: PURE read-only source/applied migration ledger compatibility preflight.
// No network/SQL/credentials, no DDL, no migration repair, no deploy authorization.
// Matching filenames are not proof of matching SQL bytes or effective DB authority.
const fileRe = /^(?<version>[0-9]{14})_(?<name>[a-z][a-z0-9_]*)\.sql$/;
const hexMd5 = /^[0-9a-f]{32}$/i;

export function normalizeSourceMigrationFiles(filenames) {
  if (!Array.isArray(filenames) || filenames.length === 0) {
    throw new Error('SOURCE_MIGRATION_LIST_REQUIRED');
  }
  const versions = new Set();
  return filenames.map((file) => {
    if (typeof file !== 'string') throw new Error('SOURCE_MIGRATION_FILENAME_INVALID');
    const match = fileRe.exec(file);
    if (!match) throw new Error('SOURCE_MIGRATION_FILENAME_INVALID');
    const { version, name } = match.groups;
    if (versions.has(version)) throw new Error('SOURCE_MIGRATION_VERSION_DUPLICATED');
    versions.add(version);
    return { version, name };
  });
}

export function normalizeAppliedMigrationRows(rows) {
  if (!Array.isArray(rows)) throw new Error('APPLIED_MIGRATION_LEDGER_NOT_READ');
  const versions = new Set();
  return rows.map((row) => {
    const version = row?.version;
    const name = row?.name;
    if (
      typeof version !== 'string' || !/^[0-9]{14}$/.test(version) ||
      typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)
    ) throw new Error('APPLIED_MIGRATION_ENTRY_INVALID');
    if (versions.has(version)) throw new Error('APPLIED_MIGRATION_VERSION_DUPLICATED');
    versions.add(version);
    return { version, name };
  });
}

function normalizedFingerprint(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !hexMd5.test(value)) {
    throw new Error('SCHEMA_FINGERPRINT_INVALID');
  }
  return value.toLowerCase();
}

export function auditMigrationLedger({
  sourceFiles,
  appliedRows,
  sourceSchemaFingerprint,
  appliedSchemaFingerprint
}) {
  const source = normalizeSourceMigrationFiles(sourceFiles);
  const applied = normalizeAppliedMigrationRows(appliedRows);
  const sourceByVersion = new Map(source.map((row) => [row.version, row]));
  const appliedByVersion = new Map(applied.map((row) => [row.version, row]));
  const appliedByName = new Map();
  for (const entry of applied) {
    const entries = appliedByName.get(entry.name) || [];
    entries.push(entry.version);
    appliedByName.set(entry.name, entries);
  }
  const mismatchedNamesForSameVersion = [];
  const sameNameDifferentVersion = [];
  const missingApplied = [];
  for (const entry of source) {
    const byVersion = appliedByVersion.get(entry.version);
    if (byVersion && byVersion.name !== entry.name) {
      mismatchedNamesForSameVersion.push({ version: entry.version, sourceName: entry.name, appliedName: byVersion.name });
    } else if (!byVersion) {
      const versions = appliedByName.get(entry.name) || [];
      if (versions.length) sameNameDifferentVersion.push({ name: entry.name, sourceVersion: entry.version, appliedVersions: versions });
      else missingApplied.push(entry.version);
    }
  }
  const extraApplied = applied
    .filter((row) => !sourceByVersion.has(row.version))
    .map((row) => row.version);
  const sourceFp = normalizedFingerprint(sourceSchemaFingerprint);
  const appliedFp = normalizedFingerprint(appliedSchemaFingerprint);
  const historyAligned = mismatchedNamesForSameVersion.length === 0 &&
    sameNameDifferentVersion.length === 0 &&
    missingApplied.length === 0 && extraApplied.length === 0 &&
    source.length === applied.length;
  const schemaAttested = sourceFp !== null && appliedFp !== null && sourceFp === appliedFp;
  const status = !historyAligned
    ? 'BLOCKED_HISTORY_DIVERGENCE'
    : !sourceFp || !appliedFp
      ? 'BLOCKED_SCHEMA_ATTESTATION_MISSING'
      : !schemaAttested
        ? 'BLOCKED_SCHEMA_FINGERPRINT_MISMATCH'
        : 'STRUCTURAL_MATCH_ONLY_RUNTIME_QA_REQUIRED';
  return {
    status,
    sourceCount: source.length,
    appliedCount: applied.length,
    mismatchedNamesForSameVersion,
    sameNameDifferentVersion,
    missingApplied,
    extraApplied,
    schemaAttested,
    sqlBytesAttested: false,
    original82BootstrapAttested: false,
    effectiveAclAndSignedTwoPgAttested: false,
    mergeReady: false,
    deployReady: false,
    communityWriterEnabled: false
  };
}
