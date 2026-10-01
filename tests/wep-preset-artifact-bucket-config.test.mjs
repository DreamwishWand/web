import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WEP_PRESET_ARTIFACT_BUCKET_ENV,
  WEP_PRESET_ARTIFACT_STAGING_BUCKET,
  WEP_PRESET_KNOWN_STAGING_PROJECT_REF,
  resolveWepPresetArtifactBucket
} from '../supabase/functions/_shared/wep-preset-artifact-bucket.ts';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const stagingUrl =
  `https://${WEP_PRESET_KNOWN_STAGING_PROJECT_REF}.supabase.co`;

test('known staging retains the existing Preset bucket without configuration', () => {
  assert.equal(
    resolveWepPresetArtifactBucket({ supabaseUrl: stagingUrl }),
    'wand-preset-artifacts-staging'
  );
  assert.equal(
    WEP_PRESET_ARTIFACT_STAGING_BUCKET,
    'wand-preset-artifacts-staging'
  );
});

test('non-staging requires an explicit environment-specific Preset bucket', () => {
  assert.throws(
    () =>
      resolveWepPresetArtifactBucket({
        supabaseUrl: 'https://productionref.supabase.co'
      }),
    /WEP_PRESET_ARTIFACT_BUCKET_REQUIRED_OUTSIDE_KNOWN_STAGING/
  );

  assert.equal(
    resolveWepPresetArtifactBucket({
      explicitBucket: 'wand-preset-artifacts-production',
      supabaseUrl: 'https://productionref.supabase.co'
    }),
    'wand-preset-artifacts-production'
  );
});

test('non-staging cannot explicitly opt into the staging Preset bucket', () => {
  assert.throws(
    () =>
      resolveWepPresetArtifactBucket({
        explicitBucket: WEP_PRESET_ARTIFACT_STAGING_BUCKET,
        supabaseUrl: 'https://productionref.supabase.co'
      }),
    /WEP_PRESET_ARTIFACT_BUCKET_STAGING_FORBIDDEN_OUTSIDE_KNOWN_STAGING/
  );
  assert.throws(
    () =>
      resolveWepPresetArtifactBucket({
        explicitBucket: WEP_PRESET_ARTIFACT_STAGING_BUCKET,
        supabaseUrl: 'http://127.0.0.1:54321'
      }),
    /WEP_PRESET_ARTIFACT_BUCKET_STAGING_FORBIDDEN_OUTSIDE_KNOWN_STAGING/
  );
});

test('both WEP Preset Edge functions resolve one shared environment bucket contract', () => {
  const artifact = read('supabase/functions/wep-preset-artifact/index.ts');
  const retention = read('supabase/functions/wep-preset-retention/index.ts');

  for (const source of [artifact, retention]) {
    assert.match(source, /resolveRuntimeWepPresetArtifactBucket/);
    assert.match(
      source,
      /const BUCKET = resolveRuntimeWepPresetArtifactBucket\(\);/
    );
    assert.doesNotMatch(
      source,
      /const BUCKET = ['"]wand-preset-artifacts-staging['"]/
    );
  }

  const config = read(
    'supabase/functions/_shared/wep-preset-artifact-bucket.ts'
  );
  assert.match(config, new RegExp(WEP_PRESET_ARTIFACT_BUCKET_ENV));
});

test('publication keeps WandAccount namespaces and signed private reads', () => {
  const source = read('supabase/functions/wep-preset-artifact/index.ts');

  assert.match(source, /staging\/\$\{accountId\}\//);
  assert.match(source, /published\/\$\{accountId\}\//);
  assert.doesNotMatch(source, /staging\/\$\{subject\}\//);
  assert.doesNotMatch(source, /published\/\$\{subject\}\//);
  assert.match(
    source,
    /storage\.from\(BUCKET\)\.createSignedUrl\(meta\.storageKey, 300\)/
  );
});

test('retention preserves physical delete before Community finalizer ordering', () => {
  const source = read('supabase/functions/wep-preset-retention/index.ts');

  const remove = source.indexOf(
    'ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey])'
  );
  const finalize = source.indexOf(
    "ctx.supabaseAdmin.rpc('community_finalize_artifact_blob_purge'"
  );

  assert.ok(remove >= 0);
  assert.ok(finalize >= 0);
  assert.ok(remove < finalize);
  assert.match(source, /published\/\$\{accountId\}\//);
});

test('production migration does not provision the staging Preset bucket', () => {
  const migration = read(
    'supabase/migrations/20260930124055_wep_preset_artifact_storage_v0.sql'
  );

  assert.doesNotMatch(migration, /wand-preset-artifacts-staging/);
  assert.match(migration, /preset_artifact_prepare/);
});

test('known staging bucket bootstrap remains private and staging-only', () => {
  const staging = read(
    'supabase/staging/20260930124055_wep_preset_artifact_storage_bucket.sql'
  );

  assert.match(
    staging,
    /'wand-preset-artifacts-staging',[\s\S]*'wand-preset-artifacts-staging',[\s\S]*false/
  );
  assert.match(staging, /26214400/);
  assert.match(staging, /application\/json/);
});
