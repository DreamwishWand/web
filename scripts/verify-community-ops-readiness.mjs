import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'ops/community-production-operations.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const retentionReviewPath = path.join(root, 'ops/community-retention-launch-review.json');
const retentionReview = JSON.parse(fs.readFileSync(retentionReviewPath, 'utf8'));
const authReviewPath = path.join(root, 'ops/community-auth-launch-review.json');
const authReview = JSON.parse(fs.readFileSync(authReviewPath, 'utf8'));
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
assert(retentionReview.engineeringDefaults?.contentPayloadDays === 30, 'Retention review must record the current 30-day content default.');
assert(retentionReview.engineeringDefaults?.operationalDetailDays === 365, 'Retention review must record the current 365-day operational default.');
assert(retentionReview.engineeringDefaults?.contentPayloadDaysIsRecoveryWindow === false, '30-day content retention must not be mislabeled as an account recovery window.');
assert(manifest.releaseGate?.requireAuthLaunchAcceptance === true, 'Final Auth acceptance must remain a production release gate.');
assert(manifest.authLaunchReview?.contract === 'ops/community-auth-launch-review.json', 'Production manifest must reference the Auth launch review contract.');
assert(authReview.schema === 'dreamwish-community-auth-launch-review@1', 'Unexpected Auth launch review schema.');
assert(authReview.passwordPolicy?.providerBoundary?.status === 'CONFIRMED_RUNTIME', 'Provider 14/15 password boundary must remain runtime-confirmed.');
assert(authReview.passwordPolicy?.providerBoundary?.password14Accepted === false, 'Provider must reject 14-character password fixture.');
assert(authReview.passwordPolicy?.providerBoundary?.password15Accepted === true, 'Provider must accept 15-character password fixture.');
assert(authReview.revocation?.status === 'CONFIRMED_RUNTIME', 'Provider + Wand revocation must remain runtime-confirmed.');
assert(authReview.emailTrafficGeneratedByThisAcceptance === false, 'Auth boundary acceptance must not be mislabeled as synthetic email traffic.');

const requiredEnvironmentConfig = new Set(manifest.production?.requiredEnvironmentConfig ?? []);
for (const name of ['DREAMWISH_ENVIRONMENT', 'COMMUNITY_MEDIA_BUCKET']) {
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
  assert(manifest.authLaunchReview?.launchApproved === true, 'Production manifest Auth launch approval is not complete.');
  assert(authReview.launchApproved === true, 'Auth launch review is not approved.');
  const pendingAuthItems = (authReview.remaining ?? []).filter((item) => item?.status !== 'CLOSED');
  assert(pendingAuthItems.length === 0, `Auth launch items remain open: ${pendingAuthItems.map((item) => item.id).join(', ')}`);
  const pendingRetentionDecisions = (retentionReview.decisions ?? []).filter((decision) => decision?.status !== 'APPROVED');
  assert(pendingRetentionDecisions.length === 0, `Retention policy decisions remain unapproved: ${pendingRetentionDecisions.map((item) => item.id).join(', ')}`);
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
