import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const privacy = read('supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql');
const incident = read('supabase/migrations/20261025003020_r18_preset_integrity_incident_commit_veto.sql');
const presetBridge = read('supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql');
const presetAccess = read('supabase/migrations/20260930124357_wep_preset_artifact_access_v0.sql');
const publicQuery = read('supabase/functions/community-public-query/index.ts');
const communityQuery = read('supabase/functions/community-query/index.ts');
const wepReader = read('supabase/functions/wep-preset-artifact/index.ts');
const webSearch = read('src/lib/community/staging-http-client.ts');
const webPresets = read('src/lib/wep/preset-community-bridge.ts');
const publicMedia = read('supabase/functions/community-public-media/index.ts');

function body(source, name) {
  const escaped = name.replace(/[.*+?^$()|[\]{}]/g, '\\$&');
  const start = new RegExp('create or replace function\\s+' + escaped + '\\s*\\(', 'i').exec(source);
  assert.ok(start, 'Missing frozen function: ' + name);
  const rest = source.slice(start.index);
  const next = /\ncreate or replace function\s+/i.exec(rest.slice(1));
  return next ? rest.slice(0, next.index + 1) : rest;
}

test('09 INT Source138 snapshot: committed incident veto exists but discoverability is independent', () => {
  assert.match(incident, /preset_storage_assert_no_integrity_incident_r18/);
  assert.match(incident, /QUARANTINED_PENDING_OPERATOR/);
  const discoverable = body(privacy, 'private.is_discoverable_work');
  const search = body(privacy, 'public.community_search_public');
  assert.match(discoverable, /w\.lifecycle_state='published'/);
  assert.match(search, /private\.is_discoverable_work\(d\.work_id\)/);
  for (const source of [discoverable, search]) {
    assert.doesNotMatch(source, /preset_storage_integrity_incidents_r18|preset_storage_assert_no_integrity_incident_r18/i);
  }
  assert.match(webSearch, /rest\/v1\/rpc\/community_search_public/);
  assert.match(webPresets, /workType:\s*'preset'/);
});

test('09 INT Source138 snapshot: public Gallery and authorized Preset reads do not check postcommit incident', () => {
  const gallery = body(privacy, 'public.community_get_gallery_public_v1');
  const preset = body(presetBridge, 'public.community_get_preset');
  const blob = body(presetAccess, 'public.wep_get_accessible_preset_blob');
  assert.match(publicQuery, /community_get_gallery_public_v1/);
  assert.match(gallery, /lifecycle_state='published'/);
  assert.match(communityQuery, /preset:\s*'community_get_preset'/);
  assert.match(preset, /private\.can_access_entity/);
  assert.match(blob, /v_blob\.purged_at is not null/);
  for (const source of [gallery, preset, blob]) {
    assert.doesNotMatch(source, /preset_storage_integrity_incidents_r18|preset_storage_assert_no_integrity_incident_r18/i);
  }
  assert.match(wepReader, /createSignedUrl\(meta\.storageKey, 300\)/);
});

test('09 INT Source138 snapshot: Gallery proxy and non-Gallery bearer are distinct Reader classes', () => {
  assert.match(publicMedia, /community_gallery_media_gateway_v1/);
  assert.match(publicMedia, /rawStorageSignedUrlIssued:false/);
  assert.match(publicMedia, /actualSha256!==expectedSha256/);
  assert.match(publicMedia, /community_get_public_media_storage_v2/);
  assert.match(publicMedia, /createSignedUrl\(String\(media\.storageKey\),300\)/);
});
