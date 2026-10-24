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
  assert.match(sql, /v_blob\.purged_at is null/);
  assert.match(sql, /m\.processing_state<>'ready'/);
  assert.match(sql, /m\.moderation_state<>'clear'/);
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
