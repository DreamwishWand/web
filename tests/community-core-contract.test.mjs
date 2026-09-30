import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const schema = read('supabase/migrations/202609300001_community_core_v0.sql');
const domain = read('src/lib/community/domain.ts');
const commands = read('src/lib/community/commands.ts');
const vertical = read('docs/community/vertical-slice-v0.md');

test('community contract has one shared entity root and publication aggregate', () => {
  assert.match(schema, /create table if not exists community_entities/i);
  assert.match(schema, /create table if not exists community_works/i);
  assert.match(schema, /create table if not exists community_work_revisions/i);
  assert.match(schema, /creator_profiles/i);
  assert.match(schema, /preset_artifacts/i);
  assert.match(schema, /gallery_works/i);
});

test('publication revisions and artifact payloads are immutable', () => {
  for (const table of [
    'community_work_revisions',
    'gallery_work_revisions',
    'preset_revisions',
    'artifact_blobs'
  ]) {
    assert.match(schema, new RegExp(`trigger ${table}_immutable`, 'i'));
  }
  assert.match(schema, /create a new revision instead/i);
});

test('discoverability requires published public clear content', () => {
  assert.match(domain, /lifecycleState === 'published'/);
  assert.match(domain, /visibility === 'public'/);
  assert.match(domain, /moderationState === 'clear'/);
  assert.match(domain, /currentPublishedRevisionId !== null/);
  assert.match(schema, /is_discoverable_work/i);
});

test('saved items are references and RLS does not turn them into access grants', () => {
  assert.match(schema, /create table if not exists saved_items/i);
  assert.match(schema, /can_access_entity/i);
  assert.match(vertical, /SavedItem never becomes an access grant/i);
});

test('shared interactions do not create product-local creator or save models', () => {
  for (const table of ['saved_items', 'follows', 'reactions', 'comments']) {
    assert.match(schema, new RegExp(`create table if not exists ${table}`, 'i'));
  }
  assert.doesNotMatch(schema, /gallery_creators|preset_creators|gallery_saves|preset_saves/i);
});

test('DDV profile link limit is enforced transactionally', () => {
  assert.match(schema, /enforce_ddv_profile_limit/i);
  assert.match(schema, />= 3/);
  assert.match(schema, /at most three DDV Profiles/i);
});

test('notifications, moderation, audit and transactional outbox are first-class', () => {
  for (const table of [
    'outbox_events',
    'notification_events',
    'notification_deliveries',
    'reports',
    'moderation_cases',
    'moderation_actions',
    'audit_events'
  ]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}`, 'i'));
  }
});

test('client writes are intentionally routed through the server command boundary', () => {
  assert.match(schema, /No direct client INSERT\/UPDATE\/DELETE policies/i);
  assert.match(commands, /interface CommunityCommandBus/);
  assert.match(commands, /idempotencyKey: string/);
  assert.match(commands, /expectedVersion\?: number/);
});

test('vertical slice covers publish through moderation and negative authorization', () => {
  for (const phrase of [
    'creates a Gallery draft',
    'discovers the same stable work/entity IDs',
    'saves the work',
    'follows A',
    'reacts',
    'comments and replies',
    'Preset revision',
    'reports the work/comment',
    'moderator reviews the case',
    "B cannot mutate A's work"
  ]) {
    assert.ok(vertical.includes(phrase), phrase);
  }
});


test('ownership integrity is enforced below product adapters', () => {
  for (const guard of [
    'community_works_creator_owner_guard',
    'preset_artifacts_creator_owner_guard',
    'work_revision_media_owner_guard',
    'preset_revisions_blob_owner_guard',
    'gallery_work_revisions_type_guard',
    'preset_revision_publications_mapping_guard',
    'follows_no_self_follow',
    'comments_target_type_guard'
  ]) {
    assert.match(schema, new RegExp(guard, 'i'));
  }
});

test('linked DDV profiles are private owner/staff data', () => {
  assert.match(schema, /ddv_profiles_owner_read/i);
  assert.match(schema, /wand_account_ddv_profiles_owner_read/i);
  assert.doesNotMatch(schema, /ddv_profiles_public_read/i);
});

test('mutable aggregates have monotonic row versions', () => {
  assert.match(schema, /community_works_row_version/i);
  assert.match(schema, /comments_row_version/i);
  assert.match(schema, /old\.row_version \+ 1/i);
});

test('privileged moderation and audit records are append-only', () => {
  assert.match(schema, /moderation_actions_immutable/i);
  assert.match(schema, /audit_events_immutable/i);
});


test('DDV profile link cap is safe under concurrent transactions', () => {
  assert.match(schema, /pg_advisory_xact_lock/i);
  assert.match(schema, /hashtextextended\(new\.account_id::text/i);
});

test('work lifecycle transitions are fail-closed in PostgreSQL', () => {
  assert.match(schema, /validate_work_lifecycle_transition/i);
  assert.match(schema, /draft'[\s\S]*published'[\s\S]*deleted/i);
  assert.match(schema, /published'[\s\S]*unpublished'[\s\S]*deleted/i);
  assert.match(schema, /Invalid CommunityWork lifecycle transition/i);
});

test('Gallery subtype rows cannot attach to a non-Gallery CommunityWork', () => {
  assert.match(schema, /gallery_works_type_guard/i);
  assert.match(schema, /GalleryWork must reference a Gallery CommunityWork/i);
});
