import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'ops/community-production-operations.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const retentionReviewPath = path.join(root, 'ops/community-retention-launch-review.json');
const retentionReview = JSON.parse(fs.readFileSync(retentionReviewPath, 'utf8'));
const retentionApprovalPath = path.join(root, 'ops/community-retention-approval-state.json');
const retentionApproval = JSON.parse(fs.readFileSync(retentionApprovalPath, 'utf8'));
const authReviewPath = path.join(root, 'ops/community-auth-launch-review.json');
const authReview = JSON.parse(fs.readFileSync(authReviewPath, 'utf8'));
const releaseEvidencePath = path.join(root, 'ops/community-production-release-evidence.json');
const releaseEvidence = JSON.parse(fs.readFileSync(releaseEvidencePath, 'utf8'));
const migrationDir = path.join(root, 'supabase/migrations');

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

assert(manifest.schema === 'dreamwish-community-production-ops@1', 'Unexpected operations manifest schema.');
assert(Boolean(manifest.staging?.projectRef), 'Staging project ref is required.');
assert(manifest.production?.mustDifferFromStaging === true, 'Production must be isolated from staging.');
assert(manifest.backupPolicy?.database?.restoreDrillRequired === true, 'Database restore drill must be required.');
assert(manifest.backupPolicy?.storageObjects?.separateBackupRequired === true, 'Storage object backup must be independent from DB backup.');
assert(manifest.backupPolicy?.storageObjects?.restoreDrillRequired === true, 'Storage restore drill must be required.');
assert(manifest.migrationPolicy?.directProductionDdlForbidden === true, 'Direct production DDL must remain forbidden.');
assert(manifest.vault?.secretValuesMustNeverAppearInRepository === true, 'Repository secret-value ban must remain enabled.');
assert(manifest.vault?.rotationDrillRequired === true, 'Secret rotation drill must be required.');
assert(manifest.releaseGate?.requireStagingOnlyFunctionAbsence === true, 'Production must verify staging-only functions are absent.');
assert(manifest.migrationPolicy?.productionReplayRequiresIntegratedTree === true, 'Production replay must use the integrated source tree.');
assert(manifest.integration?.productionReplaySource === 'final-integrated-main', 'Production replay source must be final-integrated-main.');
assert(manifest.releaseGate?.requireRetentionPolicyApproval === true, 'Retention policy approval must remain a production release gate.');
assert(manifest.privacyRetentionReview?.contract === 'ops/community-retention-launch-review.json', 'Production manifest must reference the retention review contract.');
assert(retentionReview.schema === 'dreamwish-community-retention-launch-review@1', 'Unexpected retention review schema.');
assert(retentionReview.engineeringDefaults?.contentPayloadDays === 7, 'Retention review must record the current 7-day content default.');
assert(retentionReview.engineeringDefaults?.operationalDetailDays === 90, 'Retention review must record the current 90-day operational default.');
assert(retentionReview.engineeringDefaults?.contentPayloadDaysIsRecoveryWindow === false, '7-day content retention must not be mislabeled as an account recovery window.');
assert(retentionApproval.schema === 'dreamwish-community-retention-approval-state@1', 'Unexpected retention approval state schema.');
assert(retentionApproval.engineering?.decisionBoundaryStatus === 'CLOSED', 'Retention engineering decision boundary must remain closed.');
assert(retentionApproval.engineering?.defaultsAreLegalConclusion === false, 'Retention engineering defaults must not be represented as legal conclusions.');
assert(retentionApproval.approvals?.product?.status === 'PENDING' || retentionApproval.approvals?.product?.status === 'APPROVED', 'Unexpected Product retention approval state.');
assert(retentionApproval.approvals?.privacy?.status === 'PENDING' || retentionApproval.approvals?.privacy?.status === 'APPROVED', 'Unexpected Privacy retention approval state.');
assert(retentionApproval.approvals?.legal?.status === 'PENDING' || retentionApproval.approvals?.legal?.status === 'APPROVED', 'Unexpected Legal retention approval state.');
assert(manifest.releaseGate?.requireAuthLaunchAcceptance === true, 'Final Auth acceptance must remain a production release gate.');
assert(manifest.authLaunchReview?.contract === 'ops/community-auth-launch-review.json', 'Production manifest must reference the Auth launch review contract.');
assert(authReview.schema === 'dreamwish-community-auth-launch-review@1', 'Unexpected Auth launch review schema.');
assert(authReview.passwordPolicy?.providerBoundary?.status === 'CONFIRMED_RUNTIME', 'Provider 14/15 password boundary must remain runtime-confirmed.');
assert(authReview.passwordPolicy?.providerBoundary?.password14Accepted === false, 'Provider must reject 14-character password fixture.');
assert(authReview.passwordPolicy?.providerBoundary?.password15Accepted === true, 'Provider must accept 15-character password fixture.');
assert(authReview.revocation?.status === 'CONFIRMED_RUNTIME', 'Provider + Wand revocation must remain runtime-confirmed.');
assert(authReview.emailTrafficGeneratedByThisAcceptance === false, 'Auth boundary acceptance must not be mislabeled as synthetic email traffic.');
assert(manifest.releaseEvidence?.contract === 'ops/community-production-release-evidence.json', 'Production manifest must reference the release evidence index.');
assert(releaseEvidence.schema === 'dreamwish-community-production-release-evidence@1', 'Unexpected production release evidence schema.');
assert(releaseEvidence.productionEvidenceMustComeFromDistinctProductionEnvironment === true, 'Production release evidence must come from a distinct production environment.');
assert(releaseEvidence.stagingProjectRef === manifest.staging.projectRef, 'Release evidence staging ref must match the operations manifest.');
assert(releaseEvidence.productionProjectRef !== manifest.staging.projectRef, 'Release evidence production ref cannot equal staging.');
const releaseGates = new Map((releaseEvidence.gates ?? []).map((gate) => [gate.id, gate]));
for (const id of [
  'COMMUNITY_PRIMARY_BROWSER_CLOSURE',
  'PRESET_SCENE_REUSE_VERTICAL',
  'PRESET_ARTIFACT_RETENTION_E2E',
  'WEP_PRESET_ARTIFACT_BUCKET_EXTERNALIZATION',
  'WEP_COMM_MIGRATION_BASELINE_CONSISTENCY',
  'WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION',
  'AUTH_PROVIDER_14_15_BOUNDARY',
  'AUTH_PROVIDER_WAND_REVOCATION',
  'AUTH_SIGNED_IN_REAUTH_MAILBOX',
  'RETENTION_ENGINEERING_IMPLEMENTATION',
  'RETENTION_PRODUCT_PRIVACY_LEGAL_APPROVAL',
  'DISTINCT_PRODUCTION_SUPABASE_PROJECT',
  'FINAL_INTEGRATED_SOURCE_TREE',
  'FINAL_INTEGRATED_MIGRATION_REPLAY',
  'DATABASE_RESTORE_DRILL',
  'STORAGE_RESTORE_DRILL',
  'CONTROLLED_SECRET_ROTATION',
  'PRODUCTION_FUNCTION_INVENTORY',
  'PRODUCTION_CRON_VAULT_INVENTORY',
  'PRODUCTION_SMOKE',
  'PRODUCTION_SECURITY_ADVISOR',
  'TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY',
  'TRANSACTIONAL_EMAIL_HUMAN_MAILBOX_PLACEMENT'
]) {
  assert(releaseGates.has(id), `Missing production release evidence gate: ${id}`);
}
const allowedReleaseClassifications = new Set([
  'already_closed',
  'staging_only',
  'production_only_pending',
  'approval_pending',
  'operator_manual_pending',
  'cross_stream_pending'
]);
for (const gate of releaseEvidence.gates ?? []) {
  assert(typeof gate.required === 'boolean', `Release evidence gate ${gate.id} must declare required.`);
  assert(allowedReleaseClassifications.has(gate.classification), `Release evidence gate ${gate.id} has invalid classification: ${gate.classification}`);
  assert(typeof gate.satisfied === 'boolean', `Release evidence gate ${gate.id} must declare satisfied.`);
  assert(Array.isArray(gate.evidence), `Release evidence gate ${gate.id} must carry an evidence array.`);
  if (gate.satisfied === true) {
    assert(gate.evidence.length > 0, `Satisfied release evidence gate ${gate.id} must have evidence.`);
  }
}

const requiredEnvironmentConfig = new Set(manifest.production?.requiredEnvironmentConfig ?? []);
for (const name of ['DREAMWISH_ENVIRONMENT', 'COMMUNITY_MEDIA_BUCKET', 'WEP_PRESET_ARTIFACT_BUCKET']) {
  assert(requiredEnvironmentConfig.has(name), `Missing required production environment config: ${name}`);
}

const allow = new Set(manifest.edgeFunctions?.productionAllowlist ?? []);
const deny = new Set(manifest.edgeFunctions?.stagingOnlyDenylist ?? []);
for (const name of deny) {
  assert(!allow.has(name), `Edge Function cannot be both production and staging-only: ${name}`);
}

for (const required of [
  'community-command',
  'community-query',
  'community-media',
  'community-admin',
  'community-account',
  'community-retention',
  'community-ops-escalation',
  'community-ops-email',
  'community-email-resend'
]) {
  assert(allow.has(required), `Missing production Community Edge Function: ${required}`);
}

for (const testOnly of [
  'community-auth-acceptance',
  'community-auth-e2e',
  'community-e2e-once',
  'community-wep-retention-e2e',
  'wep-preset-flow-e2e',
  'wep-retention-e2e'
]) {
  assert(deny.has(testOnly), `Missing staging-only denylist entry: ${testOnly}`);
}

const productionRef = manifest.production?.projectRef;
if (productionRef !== null && productionRef !== '') {
  assert(productionRef !== manifest.staging.projectRef, 'Production project ref must not equal staging.');
}
if (manifest.production?.launchReady === true) {
  assert(Boolean(productionRef), 'launchReady=true requires a production project ref.');
  assert(productionRef !== manifest.staging.projectRef, 'launchReady=true cannot target staging.');
}

assert(Number(manifest.backupPolicy?.database?.maximumRpoHours) <= 24, 'Database RPO must be <= 24 hours.');
assert(Number(manifest.backupPolicy?.storageObjects?.maximumRpoHours) <= 24, 'Storage RPO must be <= 24 hours.');
assert(Number(manifest.backupPolicy?.restore?.targetRtoHours) <= 4, 'Target RTO must be <= 4 hours.');

const requiredVault = new Set(manifest.vault?.requiredSecretNames ?? []);
for (const name of [
  'community_operations_email_relay_url',
  'community_operations_escalation_worker_token',
  'community_operations_escalation_worker_url',
  'community_provider_cleanup_worker_token',
  'community_provider_cleanup_worker_url',
  'community_retention_worker_token',
  'community_retention_worker_url'
]) {
  assert(requiredVault.has(name), `Missing required Vault secret name: ${name}`);
}

const requiredJobs = new Set(manifest.scheduledJobs?.required ?? []);
for (const name of [
  'community-outbox-every-minute',
  'community-provider-cleanup-every-minute',
  'community-retention-hourly',
  'community-operations-escalation-every-minute'
]) {
  assert(requiredJobs.has(name), `Missing required scheduled job: ${name}`);
}

const migrationFiles = fs
  .readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrationVersions = new Map();
for (const name of migrationFiles) {
  const match = name.match(/^(\d+)_/);
  assert(Boolean(match), `Migration filename must begin with a numeric version: ${name}`);
  if (!match) continue;
  const peers = migrationVersions.get(match[1]) ?? [];
  peers.push(name);
  migrationVersions.set(match[1], peers);
  assert(!/_staging_|community_staging/i.test(name), `Staging-only migration found in production chain: ${name}`);
}
for (const [version, names] of migrationVersions) {
  assert(names.length === 1, `Duplicate migration version ${version}: ${names.join(', ')}`);
}

if (process.argv.includes('--require-ready')) {
  assert(manifest.production?.launchReady === true, 'Production operations manifest is not launch-ready.');
  assert(manifest.privacyRetentionReview?.launchApproved === true, 'Production manifest retention approval is not complete.');
  assert(retentionReview.launchApproved === true, 'Retention launch review is not approved.');
  assert(retentionApproval.launchApproved === true, 'Retention approval state is not launch-approved.');
  for (const [name, approval] of Object.entries(retentionApproval.approvals ?? {})) {
    assert(approval?.status === 'APPROVED', `Retention ${name} approval is not approved.`);
  }
  assert(manifest.authLaunchReview?.launchApproved === true, 'Production manifest Auth launch approval is not complete.');
  assert(authReview.launchApproved === true, 'Auth launch review is not approved.');
  const pendingAuthItems = (authReview.remaining ?? []).filter((item) => item?.status !== 'CLOSED');
  assert(pendingAuthItems.length === 0, `Auth launch items remain open: ${pendingAuthItems.map((item) => item.id).join(', ')}`);
  const pendingRetentionDecisions = (retentionReview.decisions ?? []).filter((decision) => decision?.status !== 'APPROVED');
  assert(pendingRetentionDecisions.length === 0, `Retention policy decisions remain unapproved: ${pendingRetentionDecisions.map((item) => item.id).join(', ')}`);
  assert(releaseEvidence.launchReady === true, 'Production release evidence index is not launch-ready.');
  assert(Boolean(releaseEvidence.productionProjectRef), 'Release evidence requires a production project ref.');
  const unsatisfiedReleaseGates = (releaseEvidence.gates ?? []).filter(
    (gate) => gate?.required === true && gate?.satisfied !== true
  );
  assert(
    unsatisfiedReleaseGates.length === 0,
    `Production release evidence gates remain unsatisfied: ${unsatisfiedReleaseGates.map((gate) => gate.id).join(', ')}`
  );
  const openBlockers = (manifest.crossStreamBlockers ?? []).filter(
    (blocker) => blocker?.state !== 'CLOSED'
  );
  assert(
    openBlockers.length === 0,
    `Cross-stream production blockers remain open: ${openBlockers.map((item) => item.id).join(', ')}`
  );
}

if (errors.length) {
  for (const error of errors) console.error(`COMM OPS ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Community production operations manifest valid; launchReady=${String(manifest.production.launchReady)}`
);
