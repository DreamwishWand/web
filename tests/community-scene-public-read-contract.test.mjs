import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sql = readFileSync(
  join(root, 'supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql'),
  'utf8'
);
const publicQuery = readFileSync(
  join(root, 'supabase/functions/community-public-query/index.ts'),
  'utf8'
);

test('Scene public read is a strictly guarded current-Revision, read-only function', () => {
  assert.match(sql, /create or replace function public\.community_get_scene_preset_public_v1\s*\(\s*p_work_id uuid/i);
  assert.match(sql, /stable\s+security definer/i);
  assert.match(sql, /private\.is_discoverable_work\(p_work_id\)/);
  assert.match(sql, /private\.is_discoverable_work\(v_preset\.associated_gallery_work_id\)/);
  assert.match(sql, /v_preset\.associated_gallery_work_id is not null/);
  assert.match(sql, /pr\.preset_artifact_id=v_preset\.preset_artifact_id/);
  assert.match(sql, /pp\.work_revision_id=v_work\.current_published_revision_id/);
  assert.match(sql, /gp\.gallery_revision_id=v_gallery\.current_published_revision_id/);
  assert.match(sql, /gp\.preset_revision_id=v_preset_revision\.preset_revision_id/);
  assert.match(sql, /v_blob\.blob_id is null/);
  assert.match(sql, /blob_id=v_preset_revision\.artifact_blob_id and purged_at is null/);
  assert.match(sql, /m\.processing_state<>'ready'/);
  assert.match(sql, /m\.moderation_state<>'clear'/);
  assert.match(sql, /m\.purged_at is not null/);
  assert.match(sql, /m\.purged_at is null/);
  assert.match(sql, /'mediaIds',v_media_ids/);
  assert.match(sql, /'coverMediaId',v_cover/);
  const projection = sql.split('return jsonb_build_object(').at(-1).split('end\n$scene_read$')[0];
  assert.doesNotMatch(projection, /'storageKey'|'rawUrl'|'signedUrl'|'blobId'/);
  assert.match(sql, /revoke all on function public\.community_get_scene_preset_public_v1\(uuid\)[\s\S]*from public,anon,authenticated/i);
  assert.match(sql, /grant execute on function public\.community_get_scene_preset_public_v1\(uuid\)[\s\S]*to service_role/i);
});

test('public Edge allows only validated UUID and no-store Scene current projection', () => {
  assert.match(publicQuery, /'community_get_scene_preset_public_v1'/);
  assert.match(
    publicQuery,
    /rpc === 'community_get_scene_preset_public_v1'[^\n]*\? 'p_work_id'/
  );
  assert.match(publicQuery, /UUID_RE\.test\(value\)/);
  assert.match(publicQuery, /const noStore = rpc === 'community_get_scene_preset_public_v1'/);
  assert.match(publicQuery, /Cache-Control': noStore \? 'private, no-store'/);
});

test('unsafe legacy Scene lifecycle writers are NOT restored', () => {
  const migrationDirectory = join(root, 'supabase/migrations');
  const combined = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join(migrationDirectory, file), 'utf8'))
    .join('\n');
  assert.doesNotMatch(
    combined,
    /create\s+(?:or\s+replace\s+)?function\s+public\.community_(?:unpublish|delete)_scene_preset_v1\s*\(/i
  );
  assert.doesNotMatch(
    combined,
    /create\s+(?:or\s+replace\s+)?function\s+public\.community_(?:prepare|finalize)_unattached_media_discard_v1\s*\(/i
  );
});


test('three owner RPCs fail-closed on every Preset Work until all-writer graph contract', () => {
  const parts = sql.split(/create or replace function public\.(community_change_work_visibility|community_unpublish_work|community_delete_work)\s*\(/i);
  for (const name of [
    'community_change_work_visibility',
    'community_unpublish_work',
    'community_delete_work'
  ]) {
    const index = parts.findIndex((part) => part.toLowerCase() === name);
    assert.ok(index >= 0, 'owner RPC missing: ' + name);
    const fn = parts[index + 1].split(/\n\$\$;/)[0];
    assert.match(fn, /if v_work\.work_type='preset' then\s+raise exception 'PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED'/);
    assert.ok(
      fn.indexOf('PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED') <
      fn.indexOf('insert into public.idempotency_keys'),
      'owner gate must precede idempotency and mutation: ' + name
    );
    assert.match(fn, /v_work\.owner_account_id<>v_account_id/);
    assert.match(fn, /v_work\.row_version<>p_expected_version/);
  }
  // These are NOT the emergency moderation / privacy erasure RPCs.
  const ownerGateTail = sql.split('-- 03 COMM #119 R5 fail-closed OWNER-ONLY gap containment.')[1];
  assert.doesNotMatch(ownerGateTail, /create or replace function public\.community_(moderate_work|tombstone_account)\s*\(/);
});


test('Scene Revision owner preflight is read-only and cannot unlock R6 lifecycle', () => {
  const edge = readFileSync(
    join(root, 'supabase/functions/wep-preset-artifact/index.ts'), 'utf8'
  );
  const block = sql.split(
    /create or replace function public\.community_scene_revision_readiness_v1\s*\(/i
  )[1];
  assert.ok(block, 'Scene revision readiness not installed');
  assert.match(block, /stable\s+security definer/i);
  assert.match(block, /private\.resolve_active_account\(p_auth_subject\)/);
  assert.match(block, /owner_account_id=v_owner/);
  assert.match(block, /join public\.preset_revisions pr/);
  assert.match(block, /join public\.community_work_revisions cwr/);
  assert.match(block, /associated_gallery_work_id/);
  assert.match(block, /'graphComplete',false/);
  assert.match(block, /'saveRevisionAuthorized',false/);
  assert.match(block, /'pairedGalleryPublishAuthorized',false/);
  assert.match(block, /'unpublishAuthorized',false/);
  assert.match(block, /'deleteAuthorized',false/);
  assert.match(block, /'restoreAuthorized',false/);
  assert.match(block, /'dependencyFingerprintIsAtomicFence',false/);
  assert.match(sql, /revoke all on function public\.community_scene_revision_readiness_v1\(uuid,uuid\)[\s\S]*?from public,anon,authenticated/i);
  assert.match(sql, /grant execute on function public\.community_scene_revision_readiness_v1\(uuid,uuid\)[\s\S]*?to service_role/i);
  assert.match(edge, /if \(action === 'revisionReadiness'\)/);
  assert.match(edge, /community_scene_revision_readiness_v1/);
  assert.match(edge, /SCENE_REVISION_READINESS_FORBIDDEN_OR_UNAVAILABLE/);
  assert.doesNotMatch(block.split('$scene_readiness$')[0], /\b(insert into|update public\.|delete from public\.)/i);
});
