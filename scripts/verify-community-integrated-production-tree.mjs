import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requireReady = process.argv.includes('--require-ready');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'ops/community-production-operations.json'), 'utf8')
);

const errors = [];
const notes = [];
const fail = (condition, message) => {
  if (!condition) errors.push(message);
};
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const migrationDir = path.join(root, 'supabase/migrations');
const migrationNames = fs
  .readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const versions = new Map();
for (const name of migrationNames) {
  const match = name.match(/^(\d+)_/);
  fail(Boolean(match), `Migration filename lacks numeric version: ${name}`);
  if (!match) continue;
  const peers = versions.get(match[1]) ?? [];
  peers.push(name);
  versions.set(match[1], peers);

  fail(
    !/_staging_|community_staging/i.test(name),
    `Staging-only SQL is present in production migration chain: ${name}`
  );
}
for (const [version, peers] of versions) {
  fail(
    peers.length === 1,
    `Duplicate production migration version ${version}: ${peers.join(', ')}`
  );
}

const canonicalSupportRecovery =
  'supabase/migrations/20260930081600_community_core_v0_support_recovery_verification.sql';
const obsoleteSupportRecovery =
  'supabase/migrations/20260930081500_community_core_v0_support_recovery_verification.sql';
const stagingPgNet = [
  'supabase/staging/20260930035820_community_staging_pg_net.sql',
  'supabase/staging/20260930040500_community_staging_remove_pg_net.sql'
];

fail(
  exists(canonicalSupportRecovery),
  'Canonical support-recovery migration 20260930081600 is missing.'
);
fail(
  !exists(obsoleteSupportRecovery),
  'Obsolete duplicate-prefix support-recovery migration 20260930081500 must not survive final integration.'
);
for (const relative of stagingPgNet) {
  fail(exists(relative), `Expected staging-only SQL is missing from supabase/staging: ${relative}`);
}

const wepRequired = {
  migrations: [
    'supabase/migrations/20260930124055_wep_preset_artifact_storage_v0.sql',
    'supabase/migrations/20260930124357_wep_preset_artifact_access_v0.sql',
    'supabase/migrations/20260930125310_wep_preset_retention_claim_v0.sql'
  ],
  functions: [
    'supabase/functions/wep-preset-artifact/index.ts',
    'supabase/functions/wep-preset-retention/index.ts'
  ],
  resolver: 'supabase/functions/_shared/wep-preset-artifact-bucket.ts'
};
const wepPaths = [
  ...wepRequired.migrations,
  ...wepRequired.functions,
  wepRequired.resolver
];
const presentWepPaths = wepPaths.filter(exists);
const missingWepPaths = wepPaths.filter((relative) => !exists(relative));

let integratedReady = false;
if (presentWepPaths.length === 0) {
  notes.push(
    'WEP production Preset files are not yet integrated into this branch; this is expected on the Community workstream branch.'
  );
  fail(
    manifest.integration?.communityBranchAloneIsNotProductionComplete === true,
    'Community-only tree must explicitly declare itself not production-complete.'
  );
} else if (presentWepPaths.length !== wepPaths.length) {
  errors.push(
    `Partial WEP production integration is unsafe. Present: ${presentWepPaths.join(', ')}; missing: ${missingWepPaths.join(', ')}`
  );
} else {
  const artifact = read(wepRequired.functions[0]);
  const retention = read(wepRequired.functions[1]);
  const resolver = read(wepRequired.resolver);
  const storageMigration = read(wepRequired.migrations[0]);

  for (const [label, source] of [
    ['wep-preset-artifact', artifact],
    ['wep-preset-retention', retention]
  ]) {
    fail(
      /resolveRuntimeWepPresetArtifactBucket/.test(source),
      `${label} must use the shared WEP Preset bucket resolver.`
    );
    fail(
      !/const\s+BUCKET\s*=\s*['"]wand-preset-artifacts-staging['"]/.test(source),
      `${label} must not hardcode wand-preset-artifacts-staging.`
    );
  }

  fail(
    /WEP_PRESET_ARTIFACT_BUCKET/.test(resolver),
    'WEP Preset bucket resolver must require WEP_PRESET_ARTIFACT_BUCKET outside known staging.'
  );
  fail(
    /WEP_PRESET_ARTIFACT_BUCKET_REQUIRED_OUTSIDE_KNOWN_STAGING/.test(resolver),
    'WEP Preset bucket resolver must fail closed when non-staging configuration is missing.'
  );
  fail(
    /WEP_PRESET_ARTIFACT_BUCKET_STAGING_FORBIDDEN_OUTSIDE_KNOWN_STAGING/.test(resolver),
    'WEP Preset bucket resolver must reject the staging bucket outside known staging.'
  );
  fail(
    !/wand-preset-artifacts-staging/.test(storageMigration),
    'WEP Preset storage migration must not create the staging bucket in the production migration chain.'
  );

  const blocker = (manifest.crossStreamBlockers ?? []).find(
    (item) => item?.id === 'WEP_PRESET_ARTIFACT_BUCKET_EXTERNALIZATION'
  );
  fail(blocker?.state === 'CLOSED', 'WEP Preset bucket function externalization blocker must be CLOSED.');
  const provisioningBlocker = (manifest.crossStreamBlockers ?? []).find(
    (item) => item?.id === 'WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION'
  );
  fail(
    provisioningBlocker?.state === 'CLOSED',
    'WEP Preset production migration provisioning blocker must be CLOSED.'
  );
  fail(
    (manifest.production?.requiredEnvironmentConfig ?? []).includes(
      'WEP_PRESET_ARTIFACT_BUCKET'
    ),
    'Production manifest must require WEP_PRESET_ARTIFACT_BUCKET.'
  );

  integratedReady = errors.length === 0;
}

fail(
  manifest.migrationPolicy?.productionReplayRequiresIntegratedTree === true,
  'Production replay must remain bound to the final integrated tree.'
);
fail(
  manifest.integration?.productionReplaySource === 'final-integrated-main',
  'Production replay source must remain final-integrated-main.'
);

if (requireReady) {
  fail(
    integratedReady,
    `Final integrated production tree is not ready; missing WEP paths: ${missingWepPaths.join(', ') || 'none'}`
  );
}

if (errors.length) {
  for (const error of errors) console.error(`COMM INTEGRATED TREE ERROR: ${error}`);
  process.exit(1);
}

for (const note of notes) console.log(`COMM INTEGRATED TREE NOTE: ${note}`);
console.log(
  `Community integrated-tree preflight valid; integratedReady=${String(
    integratedReady
  )}; requireReady=${String(requireReady)}; migrations=${migrationNames.length}`
);
