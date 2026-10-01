import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'ops/community-production-operations.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

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

if (process.argv.includes('--require-ready')) {
  assert(manifest.production?.launchReady === true, 'Production operations manifest is not launch-ready.');
}

if (errors.length) {
  for (const error of errors) console.error(`COMM OPS ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Community production operations manifest valid; launchReady=${String(manifest.production.launchReady)}`
);
