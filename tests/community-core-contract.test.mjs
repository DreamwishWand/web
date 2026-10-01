import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';

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


test('Supabase helper functions live outside the exposed public schema', () => {
  assert.match(schema, /create schema if not exists private/i);
  assert.doesNotMatch(
    schema,
    /create or replace function public\.(current_wand_account_id|is_staff|entity_owner_account_id|is_discoverable_work|can_access_work|can_access_entity)/i
  );
  for (const helper of [
    'current_wand_account_id',
    'is_staff',
    'entity_owner_account_id',
    'is_discoverable_work',
    'can_access_work',
    'can_access_entity'
  ]) {
    assert.match(schema, new RegExp(`create or replace function private\\.${helper}`, 'i'));
  }
});

test('Data API grants are explicit and direct community writes are revoked', () => {
  assert.match(schema, /grant select on[\s\S]*search_documents[\s\S]*to anon, authenticated;/i);
  assert.match(schema, /grant select on[\s\S]*wand_accounts[\s\S]*to authenticated;/i);
  assert.match(
    schema,
    /revoke insert, update, delete on all tables in schema public from anon, authenticated;/i
  );
});

test('RLS policies specify intended Postgres roles and SQL contains no escaped newlines', () => {
  assert.match(schema, /create policy community_works_accessible_read[\s\S]*to anon, authenticated\s+using \(/i);
  assert.match(schema, /create policy saved_items_self_read[\s\S]*to authenticated\s+using \(/i);
  assert.doesNotMatch(schema, /\\nusing \(/);
});


test('canonical Community tables are not directly enumerable through the client Data API', () => {
  const boundary = read('supabase/migrations/20260930025040_community_core_v0_query_boundary.sql');
  assert.match(boundary, /revoke select on all tables in schema public from anon, authenticated/i);
  assert.match(boundary, /grant select on public\.search_documents to anon, authenticated/i);
});

test('first real Supabase advisor hardening is tracked as a migration', () => {
  const hardening = read(
    'supabase/migrations/20260930024950_community_core_v0_advisor_hardening.sql'
  );
  assert.match(hardening, /set search_path = pg_catalog, public, private/i);
  assert.match(hardening, /revoke execute on function public\.enforce_ddv_profile_limit/i);
  assert.match(hardening, /create index if not exists auth_identities_account_idx/i);
});


test('published Community revisions seal composition as well as row data', () => {
  const sealing = read('supabase/migrations/20260930034330_community_core_v0_revision_sealing.sql');
  assert.match(sealing, /add column if not exists sealed_at/i);
  assert.match(sealing, /community_works_seal_revision/i);
  assert.match(sealing, /Published revision composition is sealed/i);
  assert.match(sealing, /work_revision_media_immutable/i);
  assert.match(sealing, /gallery_revision_presets_immutable/i);
  assert.match(sealing, /preset_revision_publications_immutable/i);
});

test('Gallery publication requires validated media and supports immutable Preset revision links', () => {
  const media = read('supabase/migrations/20260930033110_community_core_v0_media_publish_v2.sql');
  const preset = read('supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql');
  assert.match(media, /community_register_validated_media/i);
  assert.match(media, /requires at least one media asset/i);
  assert.match(preset, /community_publish_gallery_v3/i);
  assert.match(preset, /gallery_revision_presets/i);
  assert.match(preset, /PresetArtifact identity is immutable after first revision/i);
  assert.match(preset, /community_publish_preset_envelope/i);
});

test('Community Edge adapters trust the verified Supabase user ID, never a client actor ID', () => {
  for (const path of [
    'supabase/functions/community-command/index.ts',
    'supabase/functions/community-query/index.ts',
    'supabase/functions/community-media/index.ts',
    'supabase/functions/community-admin/index.ts'
  ]) {
    const source = read(path);
    assert.match(source, /withSupabase\(\{ auth: 'user' \}/);
    assert.match(source, /ctx\.userClaims\?\.id/);
    assert.doesNotMatch(source, /payload\.actorAccountId|payload\.actor_account_id/);

    if (path !== 'supabase/functions/community-admin/index.ts') {
      assert.doesNotMatch(source, /payload\.accountId/);
    } else {
      assert.match(source, /params\.p_account_id = payload\.accountId/);
    }
  }
});

test('active Gallery command path is media-backed v3 and the old media-less RPC is revoked', () => {
  const source = read('supabase/functions/community-command/index.ts');
  const preset = read('supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql');
  assert.match(source, /publishGallery: 'community_publish_gallery_v3'/);
  assert.match(source, /mediaIds required/);
  assert.match(source, /p_preset_revision_ids/);
  assert.match(preset, /revoke execute on function public\.community_publish_gallery_v2/i);
});

test('staging media adapter validates bytes server-side before READY registration', () => {
  const source = read('supabase/functions/community-media/index.ts');
  assert.match(source, /createSignedUploadUrl/);
  assert.match(source, /\.download\(storageKey\)/);
  assert.match(source, /detectImage\(bytes\)/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source, /community_register_validated_media/);
  assert.match(source, /createSignedUrl\(media\.storageKey, 300\)/);
});

test('notification delivery is scheduled in-database and does not require a server secret', () => {
  const cron = read('supabase/migrations/20260930032010_community_core_v0_outbox_cron.sql');
  assert.match(cron, /community-outbox-every-minute/);
  assert.match(cron, /\* \* \* \* \*/);
  assert.match(cron, /community_process_outbox_batch\(100\)/);
  assert.doesNotMatch(cron, /service_role|secret|apikey/i);
});

test('query adapter exposes authorized Preset detail without direct canonical table scans', () => {
  const source = read('supabase/functions/community-query/index.ts');
  const bridge = read('supabase/migrations/20260930035240_community_core_v0_preset_bridge.sql');
  assert.match(source, /preset: 'community_get_preset'/);
  assert.match(bridge, /community_get_preset/i);
  assert.match(bridge, /private\.can_access_entity/i);
});


test('author lifecycle commands preserve privacy and tombstone semantics', () => {
  const lifecycle = read('supabase/migrations/20260930041000_community_core_v0_author_lifecycle.sql');
  const command = read('supabase/functions/community-command/index.ts');
  assert.match(lifecycle, /community_change_work_visibility/i);
  assert.match(lifecycle, /community_unpublish_work/i);
  assert.match(lifecycle, /community_delete_work/i);
  assert.match(lifecycle, /set deleted_at=coalesce\(deleted_at,now\(\)\)/i);
  assert.match(command, /changeVisibility: 'community_change_work_visibility'/);
  assert.match(command, /unpublishWork: 'community_unpublish_work'/);
  assert.match(command, /deleteWork: 'community_delete_work'/);
});

test('outbox processing isolates poison events and has bounded retry/dead-letter state', () => {
  const resilience = read('supabase/migrations/20260930041800_community_core_v0_outbox_resilience.sql');
  assert.match(resilience, /last_error text null/i);
  assert.match(resilience, /next_attempt_at timestamptz not null default now\(\)/i);
  assert.match(resilience, /failed_at timestamptz null/i);
  assert.match(resilience, /exception when others/i);
  assert.match(resilience, /v_next_attempt_count >= 5/i);
  assert.match(resilience, /deadLettered/i);
  assert.match(resilience, /for update skip locked/i);
});

test('temporary pg_net staging dependency is explicitly removed after Auth E2E', () => {
  const removal = read('supabase/staging/20260930040500_community_staging_remove_pg_net.sql');
  assert.match(removal, /drop extension if exists pg_net/i);
});

test('generated database types include sealed revisions and current server RPCs', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /sealed_at: string \| null/);
  assert.match(generated, /community_publish_gallery_v3/);
  assert.match(generated, /community_change_work_visibility/);
  assert.match(generated, /community_unpublish_work/);
  assert.match(generated, /community_delete_work/);
  assert.match(generated, /next_attempt_at: string/);
  assert.match(generated, /failed_at: string \| null/);
});


test('browser-facing Community Edge adapters handle CORS before authenticated work', () => {
  for (const path of [
    'supabase/functions/community-command/index.ts',
    'supabase/functions/community-query/index.ts',
    'supabase/functions/community-media/index.ts'
  ]) {
    const source = read(path);
    assert.match(source, /supabase-js@2\/cors/);
    assert.match(source, /req\.method === 'OPTIONS'/);
    assert.match(source, /headers: \{ \.\.\.corsHeaders,/);
    assert.match(source, /const authenticatedFetch = withSupabase\(\{ auth: 'user' \}/);
  }
});

test('only Gallery publish v3 remains in generated callable schema', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_publish_gallery_v3/);
  assert.doesNotMatch(generated, /community_publish_gallery_v2/);
  assert.doesNotMatch(generated, /community_publish_gallery: \{/);
});


test('provider-neutral command envelopes never carry a client-supplied actor identity', () => {
  const commands = read('src/lib/community/commands.ts');
  assert.doesNotMatch(commands, /actorAccountId:/);
  assert.match(commands, /Actor identity is intentionally absent from the command envelope/);
});

test('internal Community Lab uses browser-safe Auth and Edge credentials only', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const page = read('src/routes/community-lab/+page.svelte');

  assert.match(client, /sessionStorage/);
  assert.match(client, /grant_type=password/);
  assert.match(client, /grant_type=refresh_token/);
  assert.match(client, /authorization: `Bearer \${session\.accessToken}`/);
  assert.match(client, /apikey: this\.config\.publishableKey/);
  assert.match(client, /community-command/);
  assert.match(client, /community-query/);
  assert.match(client, /community-media/);

  assert.doesNotMatch(client, /service_role|SUPABASE_SECRET|sb_secret_/i);
  assert.doesNotMatch(page, /service_role|SUPABASE_SECRET|sb_secret_/i);
  assert.doesNotMatch(page, /actorAccountId|actor_account_id/);
});

test('Community Lab reproduces Supabase signed-upload HTTP semantics without a new npm dependency', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  assert.match(client, /signedUpload\?\.signedUrl/);
  assert.match(client, /method: 'PUT'/);
  assert.match(client, /form\.append\('cacheControl', '3600'\)/);
  assert.match(client, /form\.append\('', file\)/);
  assert.match(client, /'x-upsert': 'false'/);
  assert.match(client, /this\.media\('finalize'/);
  assert.match(client, /this\.media\('read'/);
});

test('Community Lab remains an internal route and is not linked from the public shell', () => {
  const header = read('src/lib/SiteHeader.svelte');
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(page, /INTERNAL · STAGING ONLY/);
  assert.doesNotMatch(header, /community-lab/i);
});


test('authenticated command adapter exposes session-bound moderation without accepting a client actor', () => {
  const source = read('supabase/functions/community-command/index.ts');
  assert.match(source, /moderateWork: 'community_moderate_work_v2'/);
  assert.match(source, /params\.p_session_id = sessionId/);
  assert.match(source, /params\.p_issued_at_epoch = issuedAt/);
  assert.match(source, /params\.p_case_id = payload\.caseId/);
  assert.match(source, /params\.p_action = payload\.action/);
  assert.match(source, /params\.p_reason = payload\.reason/);
  assert.match(source, /p_auth_subject: subject/);
  assert.match(source, /RECENT_AUTH_REQUIRED/);
  assert.doesNotMatch(source, /payload\.actorAccountId|payload\.actor_account_id/);
});

test('Community Lab includes User B interactions, negative authorization and moderator flow', () => {
  const page = read('src/routes/community-lab/+page.svelte');
  for (const marker of [
    'User B interactions + authorization',
    "client!.command('saveEntity'",
    "client!.command('followCreator'",
    "client!.command('addReaction'",
    "'addComment'",
    "'reportEntity'",
    'negativeAuthorizationProbe',
    "name: 'changeVisibility'",
    "name: 'unpublishWork'",
    "name: 'deleteWork'",
    'Moderator restrict / restore',
    "client!.command('moderateWork'"
  ]) {
    assert.ok(page.includes(marker), marker);
  }
});

test('Community Lab preserves target IDs across actor switches without persisting passwords', () => {
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(page, /dreamwishwand-community-lab-target-v1/);
  assert.match(page, /targetWorkId/);
  assert.match(page, /targetCreatorProfileId/);
  assert.match(page, /reportCaseId/);
  assert.doesNotMatch(page, /sessionStorage\.setItem\([^\n]*password/i);
});


test('CreatorProfile updates preserve stable identity and use optimistic/idempotent server commands', () => {
  const migration = read('supabase/migrations/20260930044500_community_core_v0_creator_profile_update.sql');
  const command = read('supabase/functions/community-command/index.ts');
  const shared = read('src/lib/community/commands.ts');

  assert.match(migration, /add column if not exists row_version bigint not null default 1/i);
  assert.match(migration, /community_update_creator_profile/i);
  assert.match(migration, /Row version conflict/i);
  assert.match(migration, /creator\.profile_updated/i);
  assert.match(migration, /creatorProfileId/i);
  assert.match(command, /updateCreatorProfile: 'community_update_creator_profile'/);
  assert.match(command, /params\.p_expected_version = payload\.expectedVersion/);
  assert.match(command, /params\.p_profile_visibility = payload\.profileVisibility/);
  assert.match(shared, /interface UpdateCreatorProfile/);
  assert.match(shared, /updateCreatorProfile\(/);
});

test('Community Lab can edit CreatorProfile and explicitly prove stable CreatorProfile ID', () => {
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(page, /CreatorProfile stable-ID edit/);
  assert.match(page, /Edit profile \+ prove stable ID/);
  assert.match(page, /afterCreatorProfileId !== beforeCreatorProfileId/);
  assert.match(page, /stableId: true/);
});

test('generated schema includes CreatorProfile rowVersion and update RPC', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_update_creator_profile/);
  assert.match(generated, /creator_profiles:[\s\S]*row_version: number/i);
});


test('Community Lab includes owner visibility, unpublish and soft-delete acceptance path', () => {
  const page = read('src/routes/community-lab/+page.svelte');
  for (const marker of [
    'Owner privacy / unpublish / tombstone',
    'ownerChangeVisibility',
    "'changeVisibility'",
    'ownerUnpublish',
    "'unpublishWork'",
    'ownerDelete',
    "'deleteWork'",
    'SavedItem may remain'
  ]) {
    assert.ok(page.includes(marker), marker);
  }
  assert.match(page, /targetRowVersion = Number\(result\?\.data\?\.rowVersion/);
});


test('Community Lab includes actor-switch reply path for reply notification acceptance', () => {
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(page, /parentCommentId/);
  assert.match(page, /replyToStoredComment/);
  assert.match(page, /Reply to stored comment/);
  assert.match(page, /Reply as current actor/);
  assert.match(page, /parentCommentId = String\(result\?\.data\?\.commentId/);
});


test('Community browser client exposes only the RLS-bound public SearchDocument RPC for discovery', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(client, /\/rest\/v1\/rpc\/community_search_public/);
  assert.match(client, /searchPublicWorks/);
  assert.match(client, /discoverPublicWorks/);
  assert.match(client, /apikey: this\.config\.publishableKey/);
  assert.doesNotMatch(client, /\/rest\/v1\/search_documents/);
  assert.doesNotMatch(client, /\/rest\/v1\/(community_works|creator_profiles|media_assets)/);
  assert.match(page, /Public SearchDocument discovery/);
  assert.match(page, /Public discovery \(no user JWT\)/);
});


test('support-assisted account recovery preserves Wand ownership and retires old identities', () => {
  const recovery = read('supabase/migrations/20260930063000_community_core_v0_account_recovery.sql');
  assert.match(recovery, /identity_state text not null default 'active'/i);
  assert.match(recovery, /replaced_by_auth_identity_id/i);
  assert.match(recovery, /account_recovery_cases/i);
  assert.match(recovery, /community_open_recovery_case/i);
  assert.match(recovery, /community_complete_recovery/i);
  assert.match(recovery, /identity_state='retired'/i);
  assert.match(recovery, /replaced_by_auth_identity_id=v_new_identity_id/i);
  assert.match(recovery, /i\.identity_state='active'/i);
  assert.match(recovery, /Admin role required/i);
  assert.match(recovery, /account\.recovery_opened/i);
  assert.match(recovery, /account\.recovery_completed/i);
});

test('account recovery RPCs remain service-only and outside the normal Community command bus', () => {
  const recovery = read('supabase/migrations/20260930063000_community_core_v0_account_recovery.sql');
  const commands = read('src/lib/community/commands.ts');

  assert.match(recovery, /revoke execute on function public\.community_open_recovery_case/i);
  assert.match(recovery, /revoke execute on function public\.community_complete_recovery/i);
  assert.match(recovery, /grant execute on function public\.community_open_recovery_case[\s\S]*to service_role/i);
  assert.match(recovery, /grant execute on function public\.community_complete_recovery[\s\S]*to service_role/i);

  assert.match(commands, /interface CommunityAdminCommandBus/);
  assert.match(commands, /openAccountRecoveryCase/);
  assert.match(commands, /completeAccountRecovery/);
  assert.match(commands, /High-risk support\/admin operations are intentionally separated/);

  const normalBus = commands.split('export interface CommunityAdminCommandBus')[0];
  assert.doesNotMatch(normalBus, /openAccountRecoveryCase|completeAccountRecovery/);
});

test('generated schema includes recovery state and server RPCs', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /account_recovery_cases/);
  assert.match(generated, /identity_state: string/);
  assert.match(generated, /retired_at: string \| null/);
  assert.match(generated, /replaced_by_auth_identity_id: string \| null/);
  assert.match(generated, /community_open_recovery_case/);
  assert.match(generated, /community_complete_recovery/);
});


test('Community session cutoff invalidates old access JWTs independently of provider expiry', () => {
  const migration = read('supabase/migrations/20260930070000_community_core_v0_session_cutoff.sql');
  assert.match(migration, /sessions_valid_after timestamptz/i);
  assert.match(migration, /community_authorize_session/i);
  assert.match(migration, /community_revoke_wand_sessions/i);
  assert.match(migration, /Wand session has been revoked/i);
  assert.match(migration, /Recent authentication required/i);
  assert.match(migration, /auth\.sessions_revoked/i);
});

test('authenticated Community Edge adapters enforce Wand session cutoff with one safe bootstrap exception', () => {
  for (const path of [
    'supabase/functions/community-query/index.ts',
    'supabase/functions/community-media/index.ts'
  ]) {
    const source = read(path);
    assert.match(source, /ctx\.jwtClaims\?\.iat/);
    assert.match(source, /community_authorize_session/);
    assert.match(source, /SESSION_REVOKED_OR_INVALID/);
    assert.match(source, /p_max_age_seconds: null/);
  }

  const command = read('supabase/functions/community-command/index.ts');
  assert.match(command, /ctx\.jwtClaims\?\.iat/);
  assert.match(command, /community_authorize_identity_bootstrap/);
  assert.match(command, /community_authorize_session/);
  assert.match(command, /command === 'ensureAccountCreator'/);
  assert.match(command, /if \(command !== 'ensureAccountCreator'\)/);
  assert.match(command, /authorizationParams\.p_max_age_seconds = null/);
  assert.match(command, /SESSION_REVOKED_OR_INVALID/);
});

test('browser session UX separates local sign-out from global revoke plus Wand cutoff', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const page = read('src/routes/community-lab/+page.svelte');

  assert.match(client, /logout\?scope=local/);
  assert.match(client, /logout\?scope=global/);
  assert.match(client, /this\.command\('revokeSessions', \{\}\)/);

  const globalIndex = client.indexOf('/auth/v1/logout?scope=global');
  const cutoffIndex = client.indexOf("this.command('revokeSessions', {})");
  assert.ok(globalIndex >= 0 && cutoffIndex > globalIndex);

  assert.match(page, /Revoke all sessions/);
  assert.match(page, /Auth global revoke \+ Wand cutoff/);
  assert.match(page, /already-issued access JWTs are rejected immediately/);
});

test('generated schema exposes session cutoff state and service-only auth RPCs', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /sessions_valid_after: string/);
  assert.match(generated, /community_authorize_session/);
  assert.match(generated, /community_revoke_wand_sessions/);
});


test('Community Lab recovery flow uses PKCE and stays outside public navigation', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const callback = read('src/routes/community-lab/recovery/+page.svelte');
  const header = read('src/lib/SiteHeader.svelte');

  assert.match(client, /dreamwishwand-community-recovery-pkce-v1/);
  assert.match(client, /code_challenge_method: 's256'/);
  assert.match(client, /grant_type=pkce/);
  assert.match(client, /auth_code: authCode/);
  assert.match(client, /code_verifier: state\.verifier/);
  assert.match(callback, /exchangePasswordRecoveryCode/);
  assert.match(callback, /noindex,nofollow/);
  assert.doesNotMatch(header, /community-lab\/recovery/i);
});


test('recovery state is short-lived while Auth session tokens remain tab-scoped', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  assert.match(client, /RECOVERY_MAX_AGE_MS = 60 \* 60 \* 1000/);
  assert.match(client, /localStorage\.setItem\(\s*RECOVERY_KEY/);
  assert.match(client, /sessionStorage\.setItem\(SESSION_KEY/);
  assert.doesNotMatch(client, /localStorage\.setItem\(SESSION_KEY/);
});

test('reauthenticated credential change revokes provider sessions and advances Wand cutoff', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  assert.match(client, /\/auth\/v1\/reauthenticate/);
  assert.match(client, /nonce: nonce\.trim\(\)/);
  assert.match(client, /return this\.revokeAllSessions\(\)/);
});


test('provider cleanup queue is concurrency-safe and retryable', () => {
  const migration = read('supabase/migrations/20260930074500_community_core_v0_provider_cleanup_worker_queue.sql');

  assert.match(migration, /state in \('pending','processing','completed','dead_letter'\)/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /locked_at < now\(\) - interval '5 minutes'/i);
  assert.match(migration, /community_claim_provider_cleanup_jobs/i);
  assert.match(migration, /community_complete_provider_cleanup/i);
  assert.match(migration, /community_fail_provider_cleanup/i);
  assert.match(migration, /attempts\+1 >= 5/);
  assert.match(migration, /dead_lettered_at/);
});

test('provider cleanup worker requires dedicated worker auth and never exposes provider subjects', () => {
  const worker = read('supabase/functions/community-auth/index.ts');

  assert.match(worker, /withSupabase\(\{ auth: 'none' \}/);
  assert.match(worker, /x-community-worker-token/);
  assert.match(worker, /community_verify_worker_token/);
  assert.match(worker, /WORKER_AUTH_REQUIRED/);
  assert.match(worker, /WORKER_AUTH_INVALID/);
  assert.match(worker, /community_claim_provider_cleanup_jobs/);
  assert.match(worker, /auth\.admin\.getUserById/);
  assert.match(worker, /auth\.admin\.deleteUser/);
  assert.match(worker, /community_complete_provider_cleanup/);
  assert.match(worker, /community_fail_provider_cleanup/);

  assert.ok(
    worker.indexOf('community_verify_worker_token') <
      worker.indexOf('community_claim_provider_cleanup_jobs')
  );
  assert.doesNotMatch(worker, /providerSubject:\s*job\.providerSubject/);
});

test('generated schema exposes provider cleanup worker RPCs', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_claim_provider_cleanup_jobs/);
  assert.match(generated, /community_complete_provider_cleanup/);
  assert.match(generated, /community_fail_provider_cleanup/);
});


test('recent-auth is bound to provider session creation time rather than refreshed JWT iat', () => {
  const migration = read('supabase/migrations/20260930075500_community_core_v0_session_bound_recent_auth.sql');

  assert.match(migration, /from auth\.sessions s/i);
  assert.match(migration, /s\.id=p_session_id/i);
  assert.match(migration, /s\.user_id=p_auth_subject/i);
  assert.match(migration, /clock_timestamp\(\) - v_created_at/i);
  assert.match(migration, /Session-bound recent authentication required/i);
  assert.match(migration, /Authenticated session not found/i);
  assert.match(migration, /Recent authentication required/i);
});

test('high-risk account and support operations require session-bound recent auth', () => {
  const migration = read('supabase/migrations/20260930075500_community_core_v0_session_bound_recent_auth.sql');

  assert.match(migration, /community_tombstone_account\([\s\S]*p_session_id uuid/i);
  assert.match(migration, /community_admin_open_recovery_case\([\s\S]*p_session_id uuid/i);
  assert.match(migration, /community_admin_complete_recovery\([\s\S]*p_session_id uuid/i);
  assert.match(migration, /community_admin_retry_provider_cleanup\([\s\S]*p_session_id uuid/i);
  assert.match(migration, /private\.require_recent_session/i);
  assert.match(migration, /private\.require_recent_admin/i);
});

test('Community admin Edge forwards verified session_id only to recent-auth writes', () => {
  const admin = read('supabase/functions/community-admin/index.ts');

  assert.match(admin, /ctx\.jwtClaims\?\.session_id/);
  assert.match(admin, /JWT session-id claim missing/);
  assert.match(admin, /params\.p_session_id = sessionId/);
  assert.match(admin, /community_admin_open_recovery_case/);
  assert.match(admin, /community_admin_complete_recovery/);
  assert.match(admin, /community_admin_retry_provider_cleanup/);
});

test('Community Ops console is internal, admin-only in intent, and omits secrets from source', () => {
  const page = read('src/routes/community-ops/+page.svelte');
  const header = read('src/lib/SiteHeader.svelte');

  assert.match(page, /INTERNAL · STAGING ONLY/);
  assert.match(page, /listRecoveryCases/);
  assert.match(page, /listProviderCleanupJobs/);
  assert.match(page, /openRecoveryCase/);
  assert.match(page, /completeRecoveryCase/);
  assert.match(page, /retryProviderCleanup/);
  assert.match(page, /Refresh/);
  assert.match(page, /provider session created within[\s\S]*configured[\s\S]*recent-auth window/);
  assert.doesNotMatch(page, /service_role|SUPABASE_SECRET|sb_secret_/i);
  assert.doesNotMatch(header, /community-ops/i);
});

test('Community command session authorization is single-source and uses verified jwtClaims', () => {
  const command = read('supabase/functions/community-command/index.ts');
  assert.equal((command.match(/community_authorize_session/g) ?? []).length, 1);
  assert.equal((command.match(/const issuedAt/g) ?? []).length, 1);
  assert.doesNotMatch(command, /function jwtIssuedAt/);
  assert.match(command, /ctx\.jwtClaims\?\.iat/);
});

test('CI type-checks all Supabase Edge Functions with Deno', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.match(workflow, /denoland\/setup-deno@v2/);
  assert.match(workflow, /deno-version: v2\.1\.4/);
  assert.match(workflow, /deno check --node-modules-dir=auto supabase\/functions\/\*\/index\.ts/);
});

test('generated schema exposes session-bound high-risk RPC signatures', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_tombstone_account/);
  assert.match(generated, /p_session_id: string/);
  assert.match(generated, /community_admin_open_recovery_case/);
  assert.match(generated, /community_admin_complete_recovery/);
  assert.match(generated, /community_admin_retry_provider_cleanup/);
});


test('self-service account deletion Edge is JWT-bound, session-bound and explicitly confirmed', () => {
  const account = read('supabase/functions/community-account/index.ts');

  assert.match(account, /withSupabase\(\{ auth: 'user' \}/);
  assert.match(account, /ctx\.userClaims\?\.id/);
  assert.match(account, /ctx\.jwtClaims\?\.session_id/);
  assert.match(account, /body\.confirmation !== 'DELETE'/);
  assert.match(account, /community_tombstone_account/);
  assert.match(account, /p_session_id: sessionId/);
  assert.match(account, /RECENT_AUTH_REQUIRED/);
  assert.doesNotMatch(account, /payload\.actorAccountId|payload\.actor_account_id/);
});

test('self-service deletion client globally signs out only after Wand tombstone succeeds', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const start = client.indexOf('async deleteWandAccount');
  assert.ok(start >= 0);

  const block = client.slice(start, start + 1800);
  const tombstoneIndex = block.indexOf("'community-account'");
  const globalLogoutIndex = block.indexOf('/auth/v1/logout?scope=global');

  assert.ok(tombstoneIndex >= 0 && globalLogoutIndex > tombstoneIndex);
  assert.match(block, /saveSession\(null\)/);
});

test('account deletion acceptance route is internal and describes current deletion retention', () => {
  const page = read('src/routes/community-lab/account/+page.svelte');
  const header = read('src/lib/SiteHeader.svelte');

  assert.match(page, /INTERNAL · STAGING ONLY/);
  assert.match(page, /Type <strong>DELETE<\/strong> to confirm/);
  assert.match(page, /Refreshing an old JWT does not reset that window/);
  assert.match(page, /physically purged within 7 days/i);
  assert.match(page, /normally deleted or minimized at 90 days/i);
  assert.match(page, /7-day period is not a recovery window/i);
  assert.match(page, /queue[s]? provider-account cleanup/i);
  assert.match(page, /noindex,nofollow/);
  assert.doesNotMatch(header, /community-lab\/account/i);
});


test('provider cleanup scheduler uses Vault-backed dedicated worker authentication', () => {
  const authMigration = read(
    'supabase/migrations/20260930080000_community_core_v0_provider_cleanup_scheduler_auth.sql'
  );
  const setupMigration = read(
    'supabase/migrations/20260930080500_community_core_v0_provider_cleanup_scheduler_setup.sql'
  );
  const worker = read('supabase/functions/community-auth/index.ts');

  assert.match(authMigration, /create extension if not exists pg_net/i);
  assert.match(authMigration, /private\.community_worker_auth/i);
  assert.match(authMigration, /community_verify_worker_token/i);
  assert.match(authMigration, /digest\(p_token,'sha256'\)/i);
  assert.match(authMigration, /community_invoke_provider_cleanup_worker/i);
  assert.match(authMigration, /vault\.decrypted_secrets/i);
  assert.match(authMigration, /x-community-worker-token/i);

  assert.match(setupMigration, /gen_random_bytes\(32\)/i);
  assert.match(setupMigration, /vault\.create_secret/i);
  assert.match(setupMigration, /vault\.update_secret/i);
  assert.match(setupMigration, /community-provider-cleanup-every-minute/i);
  assert.match(setupMigration, /cron\.schedule/i);

  assert.match(worker, /withSupabase\(\{ auth: 'none' \}/);
  assert.match(worker, /x-community-worker-token/);
  assert.match(worker, /community_verify_worker_token/);
  assert.match(worker, /WORKER_AUTH_REQUIRED/);
  assert.match(worker, /WORKER_AUTH_INVALID/);
  assert.ok(
    worker.indexOf('community_verify_worker_token') <
      worker.indexOf('community_claim_provider_cleanup_jobs')
  );
});

test('provider cleanup worker token never appears as a repository literal', () => {
  const authMigration = read(
    'supabase/migrations/20260930080000_community_core_v0_provider_cleanup_scheduler_auth.sql'
  );
  const setupMigration = read(
    'supabase/migrations/20260930080500_community_core_v0_provider_cleanup_scheduler_setup.sql'
  );
  const worker = read('supabase/functions/community-auth/index.ts');

  for (const source of [authMigration, setupMigration, worker]) {
    assert.doesNotMatch(source, /community_provider_cleanup_worker_token\s*=\s*['"][A-Fa-f0-9]{32,}/);
    assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9_-]+/);
  }

  assert.doesNotMatch(worker, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i);
});

test('generated schema exposes only the worker-token verification RPC, not private Vault helpers', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_verify_worker_token/);
  assert.doesNotMatch(generated, /community_invoke_provider_cleanup_worker/);
  assert.doesNotMatch(generated, /community_configure_provider_cleanup_scheduler/);
});


test('operations alerts persist dead letters and scheduler health without sensitive provider data', () => {
  const migration = read(
    'supabase/migrations/20260930081000_community_core_v0_operations_alerts.sql'
  );

  assert.match(migration, /provider_cleanup_dead_letter/);
  assert.match(migration, /outbox_dead_letter/);
  assert.match(migration, /provider_cleanup_scheduler_stale/);
  assert.match(migration, /community-provider-cleanup-every-minute/);
  assert.match(migration, /last_verified_at >= now\(\) - interval '3 minutes'/i);
  assert.match(migration, /state='resolved'/);
  assert.match(migration, /operations_alert\.acknowledged/);
  assert.doesNotMatch(migration, /provider_subject.*metadata/i);
});

test('operations alert admin API separates listing from recent-auth acknowledgment', () => {
  const migration = read(
    'supabase/migrations/20260930081000_community_core_v0_operations_alerts.sql'
  );
  const admin = read('supabase/functions/community-admin/index.ts');

  assert.match(migration, /community_get_operations_alerts/);
  assert.match(migration, /community_admin_ack_operations_alert/);
  assert.match(migration, /private\.require_recent_admin/);

  assert.match(admin, /listOperationsAlerts: 'community_get_operations_alerts'/);
  assert.match(admin, /acknowledgeOperationsAlert: 'community_admin_ack_operations_alert'/);
  assert.match(admin, /params\.p_alert_id = payload\.alertId/);
  assert.match(admin, /params\.p_note = payload\.note/);
  assert.match(admin, /params\.p_session_id = sessionId/);
});

test('Community Ops exposes persistent operations alerts but remains hidden from public navigation', () => {
  const page = read('src/routes/community-ops/+page.svelte');
  const header = read('src/lib/SiteHeader.svelte');

  assert.match(page, /Operations alerts/);
  assert.match(page, /listOperationsAlerts/);
  assert.match(page, /acknowledgeOperationsAlert/);
  assert.match(page, /Acknowledge alert/);
  assert.match(page, /resolve automatically when/);
  assert.doesNotMatch(header, /community-ops/i);
});

test('generated schema exposes operations-alert RPCs but not private alert storage', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_get_operations_alerts/);
  assert.match(generated, /community_admin_ack_operations_alert/);
  assert.doesNotMatch(generated, /community_operations_alerts/);
});


test('first-time identity bootstrap is explicit and fail-closed for retired or reserved provider subjects', () => {
  const migration = read(
    'supabase/migrations/20260930081500_community_core_v0_safe_identity_bootstrap.sql'
  );

  assert.match(migration, /community_authorize_identity_bootstrap/);
  assert.match(migration, /identity_state='active'/);
  assert.match(migration, /Retired AuthIdentity cannot bootstrap/);
  assert.match(migration, /Provider identity is pending deletion/);
  assert.match(migration, /reserved by an open recovery case/);
  assert.match(migration, /community_authorize_session/);
  assert.match(migration, /WandAccount is not active/);
});

test('Community command uses bootstrap authorization only for ensureAccountCreator', () => {
  const command = read('supabase/functions/community-command/index.ts');

  assert.match(command, /command === 'ensureAccountCreator'/);
  assert.match(command, /community_authorize_identity_bootstrap/);
  assert.match(command, /community_authorize_session/);
  assert.match(command, /if \(command !== 'ensureAccountCreator'\)/);
  assert.match(command, /authorizationParams\.p_max_age_seconds = null/);
});

test('safe bootstrap keeps privileged RPCs service-only', () => {
  const migration = read(
    'supabase/migrations/20260930081500_community_core_v0_safe_identity_bootstrap.sql'
  );

  assert.match(
    migration,
    /revoke execute on function public\.community_authorize_identity_bootstrap\(uuid,bigint\)[\s\S]*from public,anon,authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.community_authorize_identity_bootstrap\(uuid,bigint\)[\s\S]*to service_role/i
  );
  assert.match(
    migration,
    /revoke execute on function public\.community_ensure_account_creator\(uuid,text,text\)[\s\S]*from public,anon,authenticated/i
  );
});

test('generated schema exposes the safe bootstrap RPC', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_authorize_identity_bootstrap/);
});


test('support-assisted recovery is fail-closed Open -> Verify -> Complete', () => {
  const migration = read(
    'supabase/migrations/20260930081600_community_core_v0_support_recovery_verification.sql'
  );

  assert.match(migration, /verification_method text/);
  assert.match(migration, /verification_state text not null default 'pending'/);
  assert.match(migration, /community_admin_open_recovery_case_v2/);
  assert.match(migration, /community_admin_verify_recovery_case/);
  assert.match(migration, /community_admin_complete_recovery_v2/);
  assert.match(migration, /Recovery case is not verified and ready/);
  assert.match(migration, /account\.recovery_verified/);
  assert.match(migration, /requested_provider_subject='completed:' \|\| recovery_case_id::text/);
  assert.match(migration, /verification_ref=null/);
});

test('support recovery currently permits provider recovery only and disables DDV-profile proof', () => {
  const migration = read(
    'supabase/migrations/20260930081600_community_core_v0_support_recovery_verification.sql'
  );

  assert.match(migration, /p_verification_method='linked_ddv_profile'/);
  assert.match(migration, /not enabled until a stable claim contract is confirmed/);
  assert.match(migration, /v_case\.verification_method<>'provider_recovery'/);
  assert.match(migration, /Strong recovery verification evidence is required/);
});

test('Community admin Edge exposes explicit recovery verify step and v2 RPCs', () => {
  const admin = read('supabase/functions/community-admin/index.ts');

  assert.match(admin, /openRecoveryCase: 'community_admin_open_recovery_case_v2'/);
  assert.match(admin, /verifyRecoveryCase: 'community_admin_verify_recovery_case'/);
  assert.match(admin, /completeRecoveryCase: 'community_admin_complete_recovery_v2'/);
  assert.match(admin, /params\.p_verification_method = payload\.verificationMethod/);
  assert.match(admin, /params\.p_verification_note = payload\.verificationNote/);
});

test('Community Ops enforces Open -> Verify -> Complete and hides unsupported DDV recovery', () => {
  const page = read('src/routes/community-ops/+page.svelte');

  assert.match(page, /Open → Verify → Complete/);
  assert.match(page, /provider_recovery/);
  assert.match(page, /Verify recovery evidence/);
  assert.match(page, /Complete verified recovery/);
  assert.match(page, /Linked DDV Profile recovery remains\s+disabled/);
  assert.doesNotMatch(page, /<option value="linked_ddv_profile">/);
});

test('generated schema exposes verified recovery RPCs and state columns', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /verification_method: string \| null/);
  assert.match(generated, /verification_state: string/);
  assert.match(generated, /verified_at: string \| null/);
  assert.match(generated, /ready_at: string \| null/);
  assert.match(generated, /community_admin_open_recovery_case_v2/);
  assert.match(generated, /community_admin_verify_recovery_case/);
  assert.match(generated, /community_admin_complete_recovery_v2/);
});


test('account retention uses configurable staged purge with explicit holds', () => {
  const migration = read(
    'supabase/migrations/20260930082000_community_core_v0_retention_policy.sql'
  );

  assert.match(migration, /deleted_account_content_days',30/);
  assert.match(migration, /deleted_account_operational_days',365/);
  assert.match(migration, /account_retention_holds/);
  assert.match(migration, /account_retention_jobs/);
  assert.match(migration, /content_payload/);
  assert.match(migration, /operational_detail/);
  assert.match(migration, /community_account_has_retention_hold/);
  assert.match(migration, /open','triaged/);
  assert.match(migration, /open','reviewing/);
  assert.match(migration, /provider_cleanup_jobs/);
});

test('retention redaction preserves revision identity without weakening normal immutability', () => {
  const contentBypass = read(
    'supabase/migrations/20260930082100_community_core_v0_retention_redaction_bypass.sql'
  );
  const operationalBypass = read(
    'supabase/migrations/20260930082200_community_core_v0_retention_operational_redaction.sql'
  );

  assert.match(contentBypass, /app\.community_retention_redaction/);
  assert.match(contentBypass, /tg_op='DELETE'/);
  assert.match(contentBypass, /Published\/revision records are immutable/);
  assert.match(contentBypass, /shared_metadata='\{\}'::jsonb/);
  assert.match(contentBypass, /title='\[deleted\]'/);
  assert.match(contentBypass, /Preset artifact storage purge adapter is not available/);
  assert.match(operationalBypass, /app\.community_retention_redaction/);
  assert.match(operationalBypass, /request_correlation_id=null/);
  assert.match(operationalBypass, /metadata='\{\}'::jsonb/);
});

test('purged media is unreadable and cannot be linked into new revisions', () => {
  const migration = read(
    'supabase/migrations/20260930082000_community_core_v0_retention_policy.sql'
  );

  assert.match(migration, /add column if not exists purged_at/);
  assert.match(migration, /guard_unpurged_media_link/);
  assert.match(migration, /purged_at is null/);
  assert.match(migration, /Purged media cannot be linked to a revision/);
});

test('retention worker physically removes media before finalizing database purge', () => {
  const worker = read('supabase/functions/community-retention/index.ts');

  assert.match(worker, /withSupabase\(\{ auth: 'none' \}/);
  assert.match(worker, /x-community-worker-token/);
  assert.match(worker, /retention_cleanup/);
  assert.match(worker, /community_claim_account_retention_jobs/);
  assert.match(worker, /community_complete_account_retention_job/);
  assert.match(worker, /community_fail_account_retention_job/);
  assert.match(worker, /community-media-staging/);
  assert.match(worker, /storage\.from\(MEDIA_BUCKET\)\.remove/);

  const storageIndex = worker.indexOf('.remove(batch)');
  const completeCallIndex = worker.indexOf('const completed = await complete();');
  assert.ok(storageIndex >= 0 && completeCallIndex > storageIndex);
});

test('Preset ArtifactBlob purge fails closed until WEP storage adapter exists', () => {
  const worker = read('supabase/functions/community-retention/index.ts');
  const policy = read(
    'supabase/migrations/20260930082000_community_core_v0_retention_policy.sql'
  );

  assert.match(worker, /job\.artifactBlobCount > 0/);
  assert.match(worker, /Preset artifact storage purge adapter is not available/);
  assert.match(policy, /Preset artifact storage purge adapter is not available/);
});

test('retention scheduler uses Vault-backed worker auth and hourly Cron', () => {
  const scheduler = read(
    'supabase/migrations/20260930082300_community_core_v0_retention_scheduler.sql'
  );

  assert.match(scheduler, /community_retention_worker_token/);
  assert.match(scheduler, /community_retention_worker_url/);
  assert.match(scheduler, /gen_random_bytes\(32\)/);
  assert.match(scheduler, /digest\(v_token,'sha256'\)/);
  assert.match(scheduler, /community-retention-hourly/);
  assert.match(scheduler, /17 \* \* \* \*/);
  assert.match(scheduler, /x-community-worker-token/);
  assert.doesNotMatch(scheduler, /sb_secret_[A-Za-z0-9_-]+/);
});

test('retention dead letters and worker heartbeat share the Operations Alert substrate', () => {
  const migration = read(
    'supabase/migrations/20260930082400_community_core_v0_retention_operations.sql'
  );

  assert.match(migration, /retention_dead_letter/);
  assert.match(migration, /retention_scheduler_stale/);
  assert.match(migration, /community-retention-hourly/);
  assert.match(migration, /last_verified_at >= now\(\)-interval '2 hours'/i);
  assert.match(migration, /community-retention-alerts-every-minute/);
  assert.match(migration, /community_admin_retry_retention_job/);
  assert.match(migration, /community_get_retention_holds/);
});

test('Community admin and Ops expose retention review controls with recent-auth writes', () => {
  const admin = read('supabase/functions/community-admin/index.ts');
  const page = read('src/routes/community-ops/+page.svelte');

  assert.match(admin, /listRetentionJobs: 'community_get_retention_jobs'/);
  assert.match(admin, /retryRetentionJob: 'community_admin_retry_retention_job'/);
  assert.match(admin, /listRetentionHolds: 'community_get_retention_holds'/);
  assert.match(admin, /addRetentionHold: 'community_admin_add_retention_hold'/);
  assert.match(admin, /releaseRetentionHold: 'community_admin_release_retention_hold'/);
  assert.match(admin, /params\.p_session_id = sessionId/);

  assert.match(page, /Account retention/);
  assert.match(page, /Requeue retention job/);
  assert.match(page, /Add retention hold/);
  assert.match(page, /Release retention hold/);
  assert.match(page, /content-payload purge after 7 days/);
  assert.match(page, /operational-detail scrub after 90 days/);
  assert.match(page, /explicit retention holds rather than a second fixed-duration tier/);
});

test('generated schema exposes retention service and admin RPCs without private queues', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_claim_account_retention_jobs/);
  assert.match(generated, /community_complete_account_retention_job/);
  assert.match(generated, /community_fail_account_retention_job/);
  assert.match(generated, /community_get_retention_jobs/);
  assert.match(generated, /community_admin_retry_retention_job/);
  assert.match(generated, /community_admin_add_retention_hold/);
  assert.match(generated, /community_admin_release_retention_hold/);

  const tablesStart = generated.indexOf('Tables: {');
  const viewsStart = generated.indexOf('Views: {', tablesStart);
  const tableSection = generated.slice(tablesStart, viewsStart);
  assert.doesNotMatch(tableSection, /account_retention_jobs:/);
  assert.doesNotMatch(tableSection, /account_retention_holds:/);
});


test('external critical operations escalation uses an occurrence queue and fail-closed worker auth', () => {
  const migration = read(
    'supabase/migrations/20260930104856_community_core_v0_external_operations_escalation.sql'
  );
  const worker = read('supabase/functions/community-ops-email/index.ts');

  assert.match(migration, /community_operations_escalation_deliveries/);
  assert.match(migration, /unique\(alert_id,alert_occurrence,channel\)/);
  assert.match(migration, /old\.state='resolved' and new\.state='open'/);
  assert.match(migration, /for update of d skip locked/i);
  assert.match(migration, /attempts\+1>=5/);
  assert.match(migration, /community_operations_escalation_worker_token/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.doesNotMatch(migration, /sb_secret_[A-Za-z0-9_-]+/);

  assert.match(worker, /withSupabase\(\{ auth: 'none' \}/);
  assert.match(worker, /x-community-worker-token/);
  assert.match(worker, /operations_escalation/);
  assert.match(worker, /community_claim_operations_escalations/);
  assert.match(worker, /community_complete_operations_escalation/);
  assert.match(worker, /community_fail_operations_escalation/);
});

test('operator email payload is deliberately data-minimal', () => {
  const worker = read('supabase/functions/community-ops-email/index.ts');

  assert.match(worker, /dreamwishwand\.transactional-email\.operator-critical\.v1/);
  assert.match(worker, /purpose: 'operator_critical_operations_alert'/);
  assert.match(worker, /operationsPath: '\/community-ops\/'/);
  assert.match(worker, /alertId: job\.alertId/);
  assert.match(worker, /alertType: job\.alertType/);
  assert.match(worker, /occurrence: job\.occurrence/);

  const payloadStart = worker.indexOf(
    "schema: 'dreamwishwand.transactional-email.operator-critical.v1'"
  );
  const payloadEnd = worker.indexOf('})', payloadStart);
  const payload = worker.slice(payloadStart, payloadEnd);
  assert.doesNotMatch(
    payload,
    /providerSubject|provider_subject|report|signed|media|password|ddv/i
  );
  assert.doesNotMatch(payload, /to:|recipientEmail|emailAddress/i);
});

test('generated schema exposes only service escalation RPCs and keeps private queues private', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_claim_operations_escalations/);
  assert.match(generated, /community_complete_operations_escalation/);
  assert.match(generated, /community_fail_operations_escalation/);
  assert.match(generated, /community_get_operations_escalation_destination/);

  const tablesStart = generated.indexOf('Tables: {');
  const viewsStart = generated.indexOf('Views: {', tablesStart);
  const tableSection = generated.slice(tablesStart, viewsStart);
  assert.doesNotMatch(tableSection, /community_operations_escalation_deliveries:/);
  assert.doesNotMatch(tableSection, /community_operations_escalation_config:/);
});


test('external escalation failures stay visible in Operations without recursive self-delivery', () => {
  const migration = read(
    'supabase/migrations/20260930105934_community_core_v0_external_operations_escalation_ops.sql'
  );

  assert.match(migration, /operations_escalation_dead_letter/);
  assert.match(migration, /operations_escalation_scheduler_stale/);
  assert.match(migration, /community_refresh_operations_escalation_alerts/);
  assert.match(migration, /community-operations-escalation-alerts-every-minute/);
  assert.match(migration, /alert_type not in \([\s\S]*operations_escalation_dead_letter[\s\S]*operations_escalation_scheduler_stale/);
});

test('external escalation review and retry are admin-only and recent-auth protected', () => {
  const migration = read(
    'supabase/migrations/20260930105934_community_core_v0_external_operations_escalation_ops.sql'
  );
  const admin = read('supabase/functions/community-admin/index.ts');

  assert.match(migration, /community_get_operations_escalation_deliveries/);
  assert.match(migration, /community_admin_retry_operations_escalation/);
  assert.match(migration, /private\.require_recent_admin/);
  assert.match(migration, /Underlying operations alert is no longer open\/current/);
  assert.match(migration, /operations_escalation\.requeued/);
  assert.match(migration, /grant execute on function public\.community_get_operations_escalation_deliveries/);
  assert.match(migration, /grant execute on function public\.community_admin_retry_operations_escalation/);

  assert.match(admin, /listOperationsEscalations: 'community_get_operations_escalation_deliveries'/);
  assert.match(admin, /retryOperationsEscalation: 'community_admin_retry_operations_escalation'/);
  assert.match(admin, /params\.p_delivery_id = payload\.deliveryId/);
  assert.match(admin, /params\.p_session_id = sessionId/);
});

test('Community Ops exposes external delivery review without exposing provider credentials', () => {
  const page = read('src/routes/community-ops/+page.svelte');

  assert.match(page, /External alert deliveries/);
  assert.match(page, /listOperationsEscalations/);
  assert.match(page, /retryOperationsEscalation/);
  assert.match(page, /Requeue external alert delivery/);
  assert.match(page, /never recursively delivered through the same worker/);
  assert.doesNotMatch(page, /community_operations_escalation_auth_token|Bearer token|Vault secret value/);
});

test('generated schema exposes escalation admin RPCs but keeps escalation queue private', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_get_operations_escalation_deliveries/);
  assert.match(generated, /community_admin_retry_operations_escalation/);

  const tablesStart = generated.indexOf('Tables: {');
  const viewsStart = generated.indexOf('Views: {', tablesStart);
  const tableSection = generated.slice(tablesStart, viewsStart);
  assert.doesNotMatch(tableSection, /community_operations_escalation_deliveries:/);
  assert.doesNotMatch(tableSection, /community_operations_escalation_config:/);
});


test('operator critical escalation is email-only and remains separate from Community activity', () => {
  const channelMigration = read(
    'supabase/migrations/20260930112155_community_core_v0_operator_email_channel.sql'
  );
  const workerMigration = read(
    'supabase/migrations/20260930112416_community_core_v0_operator_email_worker.sql'
  );
  const worker = read('supabase/functions/community-ops-email/index.ts');

  assert.match(channelMigration, /channel='operator_email'/);
  assert.match(channelMigration, /check\(channel in\('operator_email'\)\)/);
  assert.match(channelMigration, /community_operations_email_relay_url/);
  assert.match(channelMigration, /community_operations_email_relay_token/);
  assert.match(workerMigration, /community-ops-email/);
  assert.match(workerMigration, /'transport','operator_email'/);

  assert.match(worker, /channel !== 'operator_email'/);
  assert.match(worker, /operator_critical_operations_alert/);
  assert.match(worker, /transactional-email\.operator-critical\.v1/);
  assert.match(worker, /idempotencyKey/);
  assert.match(worker, /Dreamwish Wand operations alert/);
  assert.match(worker, /operatorSubject/);
});

test('operator email is separate from Wizard activity email policy', () => {
  const policy = read('src/lib/community/email-policy.ts');

  assert.match(policy, /email_verification/);
  assert.match(policy, /password_recovery/);
  assert.match(policy, /security_critical/);
  assert.match(policy, /moderation_critical/);
  assert.match(policy, /wand_cloud_purchase/);
  assert.match(policy, /gift/);
  assert.match(policy, /operator_critical_operations_alert/);

  for (const kind of ['comment','reply','reaction','follow','save','work_published']) {
    assert.match(policy, new RegExp(`'${kind}'`));
  }
});

test('normal Community notification fanout does not create email delivery', () => {
  const notifications = read(
    'supabase/migrations/20260930030220_community_core_v0_notification_counter_fix.sql'
  );

  assert.match(notifications, /notification_deliveries/);
  assert.doesNotMatch(notifications, /operator_email|transactional_email|smtp|email_provider/i);
});


test('recent-auth launch defaults stay session-bound at 15 minutes', () => {
  const migration = read(
    'supabase/migrations/20260930113435_community_core_v0_recent_auth_launch_defaults.sql'
  );
  const recentAuth = read(
    'supabase/migrations/20260930075500_community_core_v0_session_bound_recent_auth.sql'
  );
  const moderation = read(
    'supabase/migrations/20260930120042_community_core_v0_moderation_operations.sql'
  );

  assert.match(migration, /account_delete_recent_auth_seconds',900/);
  assert.match(migration, /support_admin_recent_auth_seconds',900/);
  assert.match(moderation, /moderation_staff_recent_auth_seconds',900/);
  assert.match(migration, /community_get_security_policy_summary/);
  assert.match(migration, /auth\.sessions\.created_at/);

  assert.match(recentAuth, /from auth\.sessions s/);
  assert.match(recentAuth, /v_session_age_seconds > p_max_age_seconds/);
  assert.match(recentAuth, /Session-bound recent authentication required/);
});

test('Community Ops exposes configured recent-auth launch policy', () => {
  const admin = read('supabase/functions/community-admin/index.ts');
  const page = read('src/routes/community-ops/+page.svelte');
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(admin, /getSecurityPolicy: 'community_get_security_policy_summary'/);
  assert.match(page, /Load security policy/);
  assert.match(page, /15 minutes for account deletion/);
  assert.match(page, /support\/admin high-risk writes/);
  assert.match(page, /moderation staff actions/);
  assert.match(generated, /community_get_security_policy_summary/);
});


test('browser/operator runbook preserves the production-shaped acceptance boundary', () => {
  const runbook = read(
    'docs/community/browser-operator-acceptance-runbook-20260930.md'
  );

  assert.match(runbook, /Phase A — normal signup \/ verification \/ PKCE recovery/);
  assert.match(runbook, /Phase B — A -> B -> Moderator vertical slice/);
  assert.match(runbook, /Phase C — operator \/ support acceptance/);
  assert.match(runbook, /Phase D — self-service deletion/);
  assert.match(runbook, /Phase E — operator critical email acceptance/);
  assert.match(runbook, /900 seconds \/ 15 minutes/);
  assert.match(runbook, /auth\.sessions\.created_at/);
  assert.match(runbook, /Comment\/Reply\/Reaction\/Follow\/Save activity must remain \*\*in-app only\*\*/);
  assert.match(runbook, /second independent notification channel is not launch-required/);
  assert.match(runbook, /Never record:/);
});


test('public Community search stays RLS-bound and provider-free at launch', () => {
  const migration = read(
    'supabase/migrations/20260930114310_community_core_v0_public_search.sql'
  );
  const client = read('src/lib/community/staging-http-client.ts');
  const policy = read('docs/community/search-launch-policy-20260930.md');

  assert.match(migration, /create extension if not exists pg_trgm/);
  assert.match(migration, /gin_trgm_ops/);
  assert.match(migration, /community_search_public/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /char_length\(v_query\)>100/);
  assert.match(migration, /cardinality\(p_tags\)>20/);
  assert.match(migration, /\(d\.published_at,d\.work_id\) < \(p_before_published_at,p_before_work_id\)/);
  assert.match(migration, /grant execute on function public\.community_search_public[\s\S]*to anon,authenticated/);

  assert.match(client, /searchPublicWorks/);
  assert.match(client, /\/rest\/v1\/rpc\/community_search_public/);
  assert.match(client, /discoverPublicWorks[\s\S]*return this\.searchPublicWorks/);

  assert.match(policy, /No external search provider/);
  assert.match(policy, /UNLISTED and PRIVATE content are not searchable/);
  assert.match(policy, /keyword `夜空` result count = 1/);
});

test('generated schema exposes public search RPC', () => {
  const generated = read('src/lib/generated/database.types.ts');
  assert.match(generated, /community_search_public/);
});


test('Auth abuse policy keeps provider capacity separate from security invariants', () => {
  const policy = read('docs/community/auth-abuse-launch-policy-20260930.md');
  const authPolicy = read('docs/community/auth-launch-policy-20260930.md');

  assert.match(policy, /Anonymous sign-in is not part of the Community v1 launch surface/);
  assert.match(policy, /Email confirmation is required/);
  assert.match(policy, /900-second recent-auth/);
  assert.match(policy, /must remain enabled at least at the effective Supabase baseline/);
  assert.match(policy, /aggregate Auth email sends per hour/);
  assert.match(policy, /deliberately not canonical numbers yet/);
  assert.match(policy, /CAPTCHA integration available as a deployment control/);
  assert.match(policy, /No provider API key, SMTP password, CAPTCHA secret/);

  assert.match(authPolicy, /without weakening Supabase endpoint\/IP protections/);
  assert.match(authPolicy, /size aggregate Auth-email quota only after/);
  assert.match(authPolicy, /auth-abuse-launch-policy-20260930\.md/);
});


test('launch notification channel mix keeps normal Community activity in-app only', () => {
  const policy = read('docs/community/notification-channel-policy-20260930.md');
  const emailPolicy = read('src/lib/community/email-policy.ts');

  assert.match(policy, /Primary channel for normal Community activity/);
  assert.match(policy, /Normal Community activity does \*\*not\*\* fan out to email/);
  assert.match(policy, /Save itself does not generate a notification at launch/);
  assert.match(policy, /Auth-provider transactional email/);
  assert.match(policy, /Wizard transactional email/);
  assert.match(policy, /Operator-only Operations email/);
  assert.match(policy, /Discord/);
  assert.match(policy, /SMS/);
  assert.match(policy, /mobile push/);
  assert.match(policy, /browser push/);

  for (const kind of ['comment','reply','reaction','follow','save','work_published']) {
    assert.match(emailPolicy, new RegExp(`'${kind}'`));
  }
});


test('operational foreign keys have covering indexes', () => {
  const migration = read(
    'supabase/migrations/20260930115623_community_core_v0_fk_index_hardening.sql'
  );

  for (const indexName of [
    'account_retention_holds_created_by_idx',
    'account_retention_holds_released_by_idx',
    'account_retention_jobs_deletion_event_idx',
    'community_operations_alerts_ack_by_idx',
    'provider_cleanup_jobs_account_idx',
    'provider_identity_cleanup_jobs_account_idx',
    'account_recovery_cases_verified_by_idx'
  ]) {
    assert.match(migration, new RegExp(indexName));
  }
});


test('production-shaped moderation queue is role-gated, privacy-minimized and recent-auth protected', () => {
  const migration = read(
    'supabase/migrations/20260930120042_community_core_v0_moderation_operations.sql'
  );
  const admin = read('supabase/functions/community-admin/index.ts');
  const page = read('src/routes/community-ops/+page.svelte');

  assert.match(migration, /moderation_staff_recent_auth_seconds',900/);
  assert.match(migration, /require_recent_moderation_staff/);
  assert.match(migration, /role in \('moderator','admin'\)/);
  assert.match(migration, /community_get_moderation_cases/);
  assert.match(migration, /community_moderate_work_v2/);
  assert.match(migration, /r\.status in \('open','triaged'\)/);
  assert.doesNotMatch(migration, /'reporterAccountId'/);

  assert.match(admin, /listModerationCases: 'community_get_moderation_cases'/);
  assert.match(admin, /moderateCase: 'community_moderate_work_v2'/);
  assert.match(admin, /operation === 'moderateCase'[\s\S]*p_auth_subject: subject/);

  assert.match(page, /Moderation queue/);
  assert.match(page, /reporter account identity is intentionally omitted/i);
  assert.match(page, /15-minute moderation recent-auth/);
  assert.match(page, /Apply moderation action/);
});

test('moderation launch policy keeps automated providers optional and canonical state local', () => {
  const policy = read(
    'docs/community/moderation-operations-launch-policy-20260930.md'
  );

  assert.match(policy, /third-party automated moderation provider is \*\*not a first-launch dependency\*\*/);
  assert.match(policy, /Report/);
  assert.match(policy, /ModerationCase/);
  assert.match(policy, /ModerationAction/);
  assert.match(policy, /AuditEvent/);
  assert.match(policy, /reporter identity exposed by queue = false/);
  assert.match(policy, /Recent authentication required/);
});

test('generated schema exposes production moderation operations', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_get_moderation_cases/);
  assert.match(generated, /community_moderate_work_v2/);
  assert.match(generated, /moderationStaffRecentAuthSeconds|community_get_security_policy_summary/);
});


test('moderation operations require session-bound recent-auth and close linked reports', () => {
  const migration = read(
    'supabase/migrations/20260930120042_community_core_v0_moderation_operations.sql'
  );
  const command = read('supabase/functions/community-command/index.ts');
  const admin = read('supabase/functions/community-admin/index.ts');
  const page = read('src/routes/community-ops/+page.svelte');
  const runtime = read('docs/community/moderation-operations-runtime-20260930.md');

  assert.match(migration, /moderation_staff_recent_auth_seconds',900/);
  assert.match(migration, /require_recent_moderation_staff/);
  assert.match(migration, /community_moderate_work_v2/);
  assert.match(migration, /role in \('moderator','admin'\)/);
  assert.match(migration, /set status='closed'/);
  assert.match(migration, /r\.status in \('open','triaged'\)/);
  assert.match(migration, /community_get_moderation_cases/);
  assert.doesNotMatch(migration, /reporterAccountId/);

  assert.match(command, /moderateWork: 'community_moderate_work_v2'/);
  assert.match(command, /p_session_id = sessionId/);
  assert.match(command, /RECENT_AUTH_REQUIRED/);

  assert.match(admin, /listModerationCases: 'community_get_moderation_cases'/);
  assert.match(admin, /moderateCase: 'community_moderate_work_v2'/);
  assert.match(admin, /Moderator or admin role required/);

  assert.match(page, /Moderation cases/);
  assert.match(page, /restrict/);
  assert.match(page, /remove/);
  assert.match(page, /restore/);

  assert.match(runtime, /stale 20-minute session rejected/);
  assert.match(runtime, /SearchDocument count after restrict: \*\*0\*\*/);
  assert.match(runtime, /SearchDocument count after restore: \*\*1\*\*/);
  assert.match(runtime, /reporter-account identity: \*\*false\*\*/);
});

test('generated schema exposes moderation operations without private helpers', () => {
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(generated, /community_get_moderation_cases/);
  assert.match(generated, /community_moderate_work_v2/);
  assert.doesNotMatch(generated, /require_recent_moderation_staff/);
});


test('Community action limits are account-scoped and fail closed', () => {
  const migration = read(
    'supabase/migrations/20260930122716_community_core_v0_action_rate_limits.sql'
  );
  const runtime = read('docs/community/action-rate-limit-runtime-20260930.md');

  assert.match(migration, /private\.community_action_rate_policies/);
  assert.match(migration, /private\.community_action_rate_windows/);
  assert.match(migration, /community_consume_action_rate_limit/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /Unknown Community rate-limit bucket/);
  assert.match(migration, /'report',3600,12,true/);
  assert.match(migration, /'media_prepare',3600,30,true/);
  assert.match(migration, /grant execute on function public\.community_consume_action_rate_limit[\s\S]*to service_role/);
  assert.match(runtime, /Account A third consume: allowed = false/);
  assert.match(runtime, /unknown bucket rejected fail-closed = true/);

  const fkIndex = read(
    'supabase/migrations/20260930123148_community_core_v0_action_rate_limit_fk_index.sql'
  );
  assert.match(fkIndex, /community_action_rate_windows_bucket_idx/);
});


test('browser Community mutations enforce shared action rate limits', () => {
  const command = read('supabase/functions/community-command/index.ts');
  const media = read('supabase/functions/community-media/index.ts');

  assert.match(command, /commandToRateBucket/);
  assert.match(command, /reportEntity: 'report'/);
  assert.match(command, /addComment: 'comment'/);
  assert.match(command, /moderateWork: 'moderation_write'/);
  assert.match(command, /community_consume_action_rate_limit/);
  assert.match(command, /RATE_LIMITED/);
  assert.match(command, /429/);

  assert.match(media, /p_bucket: 'media_prepare'/);
  assert.match(media, /community_consume_action_rate_limit/);
  assert.match(media, /RATE_LIMITED/);
  assert.match(media, /429/);
});

test('Community Ops can inspect rate policies without exposing private counters', () => {
  const admin = read('supabase/functions/community-admin/index.ts');
  const page = read('src/routes/community-ops/+page.svelte');
  const generated = read('src/lib/generated/database.types.ts');

  assert.match(admin, /listActionRatePolicies: 'community_get_action_rate_policies'/);
  assert.match(page, /Load action rate policies/);
  assert.match(page, /per-account counters are not exposed/i);
  assert.match(generated, /community_get_action_rate_policies/);
  assert.match(generated, /community_consume_action_rate_limit/);
  assert.doesNotMatch(generated, /community_action_rate_windows/);
  assert.doesNotMatch(generated, /community_action_rate_policies/);
});


test('browser rate-limit errors carry actionable retry metadata', () => {
  const client = read('src/lib/community/staging-http-client.ts');

  assert.match(client, /class CommunityHttpError extends Error/);
  assert.match(client, /retryAfterSeconds/);
  assert.match(client, /resetAt/);
  assert.match(client, /response\.status === 429/);
  assert.match(client, /code === 'RATE_LIMITED'/);
  assert.match(client, /Too many actions in/);
  assert.match(client, /Retry in about/);
});


test('Resend operator relay is fixed-purpose, idempotent and fail-closed', () => {
  const relay = read('supabase/functions/community-email-resend/index.ts');
  const provider = read(
    'docs/community/transactional-email-provider-resend-20260930.md'
  );

  assert.doesNotMatch(relay, /COMMUNITY_EMAIL_RELAY_TOKEN/);
  assert.match(relay, /operations_escalation/);
  assert.match(relay, /x-community-worker-token/);
  assert.match(relay, /RESEND_API_KEY/);
  assert.doesNotMatch(relay, /DREAMWISH_EMAIL_FROM/);
  assert.match(relay, /Dreamwish Wand Ops <ops@dreamwishwand\.com>/);
  assert.match(relay, /DREAMWISH_OPERATOR_EMAIL/);
  assert.match(relay, /EMAIL_RELAY_NOT_CONFIGURED/);
  assert.match(relay, /WORKER_AUTH_REQUIRED/);
  assert.match(relay, /WORKER_AUTH_INVALID/);
  assert.match(relay, /dreamwishwand\.transactional-email\.operator-critical\.v1/);
  assert.match(relay, /operator_critical_operations_alert/);
  assert.match(relay, /https:\/\/api\.resend\.com\/emails/);
  assert.match(relay, /'Idempotency-Key': idempotencyKey/);
  assert.doesNotMatch(relay, /@gmail\.com|@outlook\.com|@icloud\.com/);
  assert.doesNotMatch(relay, /re_[A-Za-z0-9]{12,}/);

  assert.match(provider, /Dreamwish Wand uses \*\*Resend\*\*/);
  assert.match(provider, /Auth SMTP credential/);
  assert.match(provider, /Operator\/API credential/);
  assert.match(provider, /verified Resend domain: `dreamwishwand\.com`/);
  assert.match(provider, /No second independent alert channel is required for first launch/);
});

test('transactional email policies select Resend without merging email semantics', () => {
  const policy = read('docs/community/transactional-email-policy-20260930.md');
  const escalation = read(
    'docs/community/operations-escalation-policy-20260930.md'
  );
  const auth = read('docs/community/auth-launch-policy-20260930.md');

  assert.match(policy, /first-launch provider default is now \*\*Resend\*\*/);
  assert.match(policy, /provider-neutral/);
  assert.match(escalation, /first-launch email-delivery provider is \*\*Resend\*\*/);
  assert.match(escalation, /community-email-resend/);
  assert.match(auth, /selected Resend transactional email provider/);
  assert.match(auth, /Supabase custom SMTP is the initial Auth delivery boundary/);
});


test('dreamwishwand.com is the canonical transactional sender domain', () => {
  const provider = read(
    'docs/community/transactional-email-provider-resend-20260930.md'
  );
  const policy = read('docs/community/transactional-email-policy-20260930.md');
  const auth = read('docs/community/auth-launch-policy-20260930.md');
  const escalation = read(
    'docs/community/operations-escalation-policy-20260930.md'
  );

  assert.match(provider, /verified Resend domain: `dreamwishwand\.com`/);
  assert.match(provider, /no-reply@dreamwishwand\.com/);
  assert.match(provider, /ops@dreamwishwand\.com/);
  assert.match(provider, /smtp\.resend\.com/);
  assert.match(provider, /separate from the Auth SMTP credential/);
  assert.match(policy, /verify `dreamwishwand\.com` in Resend/);
  assert.match(auth, /no-reply@dreamwishwand\.com/);
  assert.match(escalation, /ops@dreamwishwand\.com/);
});


test('dreamwishwand.com activation runbook preserves email boundaries', () => {
  const runbook = read(
    'docs/community/transactional-email-activation-dreamwishwand-com-20260930.md'
  );

  assert.match(runbook, /dreamwishwand\.com/);
  assert.match(runbook, /no-reply@dreamwishwand\.com/);
  assert.match(runbook, /ops@dreamwishwand\.com/);
  assert.match(runbook, /smtp\.resend\.com/);
  assert.match(runbook, /Dreamwish Wand Auth SMTP/);
  assert.match(runbook, /Dreamwish Wand Ops Edge/);
  assert.doesNotMatch(runbook, /COMMUNITY_EMAIL_RELAY_TOKEN/);
  assert.match(runbook, /No new relay secret is required/);
  assert.match(runbook, /Comment \/ Reply -> no email/);
  assert.match(runbook, /Reaction -> no email/);
  assert.match(runbook, /Follow -> no email/);
  assert.match(runbook, /Save -> no email/);
  assert.match(runbook, /No second independent alert channel is required for first launch/);
});


test('operator email relay reuses existing Operations worker auth', () => {
  const worker = read('supabase/functions/community-ops-email/index.ts');
  const relay = read('supabase/functions/community-email-resend/index.ts');
  const activation = read(
    'docs/community/transactional-email-activation-dreamwishwand-com-20260930.md'
  );

  assert.match(worker, /'x-community-worker-token': workerToken/);
  assert.doesNotMatch(worker, /headers\.Authorization/);
  assert.match(relay, /community_verify_worker_token/);
  assert.match(relay, /p_worker_name: 'operations_escalation'/);
  assert.match(relay, /x-community-worker-token/);
  assert.doesNotMatch(relay, /COMMUNITY_EMAIL_RELAY_TOKEN/);
  assert.match(activation, /No new relay secret is required/);
  assert.match(activation, /RESEND_API_KEY/);
  assert.match(activation, /DREAMWISH_OPERATOR_EMAIL/);
});


test('Community password baseline is passphrase-friendly single-factor 15+', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  assert.match(client, /COMMUNITY_PASSWORD_MIN_LENGTH = 15/);
  assert.match(client, /Array\.from\(password\)\.length < COMMUNITY_PASSWORD_MIN_LENGTH/);
  assert.match(client, /assertPasswordPolicy\(newPassword, 'New password'\)/);
  assert.match(client, /assertPasswordPolicy\(password\)/);
  assert.doesNotMatch(client, /special character|uppercase|lowercase|must contain|digit/i);
});


test('Community production operations contract fails closed until a distinct production environment exists', () => {
  const manifest = JSON.parse(read('ops/community-production-operations.json'));
  const runbook = read('docs/community/production-operations-backup-recovery-20261001.md');
  const verifier = read('scripts/verify-community-ops-readiness.mjs');

  assert.equal(manifest.schema, 'dreamwish-community-production-ops@1');
  assert.equal(manifest.staging.projectRef, 'ptpdoxhrqopvczpclcij');
  assert.equal(manifest.staging.planObserved, 'free');
  assert.equal(manifest.production.projectRef, null);
  assert.equal(manifest.production.launchReady, false);
  assert.equal(manifest.production.mustDifferFromStaging, true);

  assert.equal(manifest.backupPolicy.database.restoreDrillRequired, true);
  assert.equal(manifest.backupPolicy.storageObjects.separateBackupRequired, true);
  assert.equal(manifest.backupPolicy.storageObjects.restoreDrillRequired, true);
  assert.ok(manifest.backupPolicy.database.maximumRpoHours <= 24);
  assert.ok(manifest.backupPolicy.storageObjects.maximumRpoHours <= 24);
  assert.ok(manifest.backupPolicy.restore.targetRtoHours <= 4);

  for (const stagingOnly of [
    'community-auth-acceptance',
    'community-auth-e2e',
    'community-e2e-once',
    'community-wep-retention-e2e',
    'wep-preset-flow-e2e',
    'wep-retention-e2e'
  ]) {
    assert.ok(manifest.edgeFunctions.stagingOnlyDenylist.includes(stagingOnly));
    assert.ok(!manifest.edgeFunctions.productionAllowlist.includes(stagingOnly));
  }

  assert.match(runbook, /database backup contains Storage metadata, not the Storage object bytes themselves/i);
  assert.match(runbook, /production Supabase project that is distinct from staging/i);
  assert.match(runbook, /No production environment, paid plan, Supabase branch, backup add-on or PITR add-on was created/i);
  assert.match(verifier, /--require-ready/);
  assert.match(verifier, /Production project ref must not equal staging/);
});


test('Community production migration versions are unique and staging-only SQL is excluded', () => {
  const migrationDir = path.join(process.cwd(), 'supabase/migrations');
  const names = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'));
  const seen = new Map();

  for (const name of names) {
    assert.doesNotMatch(name, /_staging_|community_staging/i);
    const match = name.match(/^(\d+)_/);
    assert.ok(match, name);
    const peers = seen.get(match[1]) ?? [];
    peers.push(name);
    seen.set(match[1], peers);
  }

  for (const [version, peers] of seen) {
    assert.equal(peers.length, 1, `duplicate migration version ${version}: ${peers.join(', ')}`);
  }

  assert.ok(
    names.includes('20260930081600_community_core_v0_support_recovery_verification.sql')
  );
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        'supabase/staging/20260930035820_community_staging_pg_net.sql'
      )
    )
  );
});


test('Community Edge production resources are environment-aware and fail closed outside known staging', () => {
  const media = read('supabase/functions/community-media/index.ts');
  const retention = read('supabase/functions/community-retention/index.ts');
  const opsEmail = read('supabase/functions/community-ops-email/index.ts');
  const escalation = read('supabase/functions/community-ops-escalation/index.ts');

  for (const source of [media, retention]) {
    assert.match(source, /COMMUNITY_MEDIA_BUCKET/);
    assert.match(source, /KNOWN_STAGING_PROJECT_REF/);
    assert.match(source, /required outside the known staging project/);
  }

  for (const source of [opsEmail, escalation]) {
    assert.match(source, /DREAMWISH_ENVIRONMENT/);
    assert.match(source, /ENVIRONMENT_LABEL/);
    assert.doesNotMatch(source, /environment:\s*'staging'/);
    assert.match(source, /required outside the known staging project/);
  }

  assert.doesNotMatch(media, /Invalid staging image size/);
});

test('Community production manifest separates WEP function externalization from production bucket migration provisioning', () => {
  const manifest = JSON.parse(read('ops/community-production-operations.json'));
  assert.equal(manifest.migrationPolicy.productionReplayRequiresIntegratedTree, true);
  assert.equal(manifest.integration.productionReplaySource, 'final-integrated-main');
  assert.equal(manifest.integration.communityBranchAloneIsNotProductionComplete, true);
  assert.ok(manifest.production.requiredEnvironmentConfig.includes('DREAMWISH_ENVIRONMENT'));
  assert.ok(manifest.production.requiredEnvironmentConfig.includes('COMMUNITY_MEDIA_BUCKET'));
  assert.ok(manifest.production.requiredEnvironmentConfig.includes('WEP_PRESET_ARTIFACT_BUCKET'));

  const blocker = manifest.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_EXTERNALIZATION'
  );
  assert.ok(blocker);
  assert.equal(blocker.owner, '02 WEP');
  assert.equal(blocker.state, 'CLOSED');
  assert.match(blocker.detail, /environment-aware/i);
  assert.match(blocker.detail, /known staging/i);

  const provisioning = manifest.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION'
  );
  assert.ok(provisioning);
  assert.equal(provisioning.owner, '02 WEP');
  assert.equal(provisioning.state, 'CLOSED');
  assert.match(provisioning.detail, /no longer creates\/names the staging bucket/i);
  assert.match(provisioning.detail, /Final fresh-target replay remains Release Operations work/i);
});


test('Community retention launch review separates technical facts from policy approval', () => {
  const review = JSON.parse(read('ops/community-retention-launch-review.json'));
  const approval = JSON.parse(read('ops/community-retention-approval-state.json'));
  const packet = read('docs/community/privacy-retention-launch-review-20261001.md');
  const finalPacket = read('docs/community/retention-final-approval-packet-20261001.md');
  const operations = JSON.parse(read('ops/community-production-operations.json'));
  const verifier = read('scripts/verify-community-ops-readiness.mjs');

  assert.equal(review.schema, 'dreamwish-community-retention-launch-review@1');
  assert.equal(review.engineeringDefaults.contentPayloadDays, 7);
  assert.equal(review.engineeringDefaults.operationalDetailDays, 90);
  assert.equal(review.engineeringDefaults.contentPayloadDaysIsRecoveryWindow, false);
  assert.equal(review.launchApproved, false);
  assert.equal(review.decisions.length, 8);
  assert.ok(review.decisions.every((decision) => decision.status === 'PENDING_APPROVAL'));
  assert.equal(review.engineeringClosure.decisionBoundary, 'CLOSED');
  assert.equal(review.approvals.product, 'PENDING');
  assert.equal(review.approvals.privacy, 'PENDING');
  assert.equal(review.approvals.legal, 'PENDING');
  assert.equal(approval.engineering.decisionBoundaryStatus, 'CLOSED');
  assert.equal(approval.engineering.defaultsAreLegalConclusion, false);
  assert.equal(approval.approvals.product.status, 'PENDING');
  assert.equal(approval.approvals.privacy.status, 'PENDING');
  assert.equal(approval.approvals.legal.status, 'PENDING');
  assert.equal(approval.launchApproved, false);
  assert.equal(operations.releaseGate.requireRetentionPolicyApproval, true);
  assert.equal(operations.privacyRetentionReview.launchApproved, false);
  assert.match(packet, /7 days is currently a retention-delay parameter/i);
  assert.match(packet, /does not currently establish a\s+7-day self-service recovery entitlement/i);
  assert.match(packet, /backup-copy retention/i);
  assert.match(finalPacket, /ENGINEERING CLOSED/i);
  assert.match(finalPacket, /Product approval — PENDING/i);
  assert.match(finalPacket, /Privacy approval — PENDING/i);
  assert.match(finalPacket, /Legal approval — PENDING/i);
  assert.match(verifier, /Retention launch review is not approved/);
  assert.match(verifier, /Retention approval state is not launch-approved/);
});


test('staging operations observation aligns with production allow and deny policy', () => {
  const observed = JSON.parse(read('ops/community-staging-operations-observed-20261001.json'));
  const production = JSON.parse(read('ops/community-production-operations.json'));

  assert.equal(observed.schema, 'dreamwish-community-staging-operations-observation@1');
  assert.equal(observed.project.ref, production.staging.projectRef);
  assert.equal(observed.project.developmentBranches, 0);
  assert.equal(observed.conclusions.secretsValuesCaptured, false);
  assert.equal(observed.conclusions.stagingAcceptanceHarnessesExecutable, false);
  assert.equal(observed.conclusions.stagingMigrationHistoryIsProductionReplaySource, false);

  const observedProduction = new Set(observed.edgeFunctions.productionShaped.map((item) => item.slug));
  const expectedProduction = new Set(production.edgeFunctions.productionAllowlist);
  assert.deepEqual([...observedProduction].sort(), [...expectedProduction].sort());

  const observedStagingOnly = new Set(observed.edgeFunctions.stagingOnly.map((item) => item.slug));
  const expectedStagingOnly = new Set(production.edgeFunctions.stagingOnlyDenylist);
  assert.deepEqual([...observedStagingOnly].sort(), [...expectedStagingOnly].sort());
  assert.ok(observed.edgeFunctions.stagingOnly.every((item) => item.disabledStub === true && item.httpStatus === 410));

  const observedCron = new Set(observed.cronJobs.filter((job) => job.active).map((job) => job.name));
  assert.deepEqual([...observedCron].sort(), [...production.scheduledJobs.required].sort());

  const observedVault = new Set(observed.vaultSecretNames);
  assert.deepEqual([...observedVault].sort(), [...production.vault.requiredSecretNames].sort());

  assert.equal(observed.securityAdvisor.warns.length, 1);
  assert.equal(observed.securityAdvisor.warns[0].name, production.security.knownAcceptedAdvisorWarning);
  assert.equal(observed.appliedMigrationHistory.authoritativeForProductionReplay, false);
});


test('Road-inclusive Scene acceptance preserves Community reuse and Apply boundary', () => {
  const acceptance = JSON.parse(read('ops/community-wep-road-integration-acceptance-20261001.json'));
  const staging = JSON.parse(read('ops/community-staging-operations-observed-20261001.json'));
  const production = JSON.parse(read('ops/community-production-operations.json'));

  assert.equal(acceptance.schema, 'dreamwish-community-wep-road-integration-acceptance@1');
  assert.equal(acceptance.liveStaging.temporaryFunction.requestHttpStatus, 200);
  assert.equal(acceptance.liveStaging.assertions.publicPresetPublication, true);
  assert.equal(acceptance.liveStaging.assertions.publicDiscovery, true);
  assert.equal(acceptance.liveStaging.assertions.librarySave, true);
  assert.equal(acceptance.liveStaging.assertions.signedRead, true);
  assert.equal(acceptance.liveStaging.assertions.checksumVerified, true);
  assert.equal(acceptance.liveStaging.assertions.byteSizeVerified, true);
  assert.equal(acceptance.liveStaging.assertions.roadEnvelopeRoundTrip, true);
  assert.equal(acceptance.liveStaging.assertions.roadNetworkId, 'r0');
  assert.equal(acceptance.liveStaging.assertions.persistentWriteAuthorized, false);
  assert.equal(acceptance.classification.persistentApply, 'BLOCKED');
  assert.equal(
    acceptance.wep.delta.expectedApplyBlock,
    'ROAD_TOPOLOGY_APPLY_UNAVAILABLE'
  );
  assert.equal(acceptance.wep.delta.writeReady, false);

  const restored = staging.edgeFunctions.stagingOnly.find(
    (item) => item.slug === 'wep-preset-flow-e2e'
  );
  assert.equal(restored.disabledStub, true);
  assert.equal(restored.httpStatus, 410);
  assert.equal(restored.verifyJwt, true);
  assert.equal(restored.version, 6);

  const bucketBlocker = production.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_EXTERNALIZATION'
  );
  assert.equal(bucketBlocker?.owner, '02 WEP');
  assert.equal(bucketBlocker?.state, 'CLOSED');

  const provisioningBlocker = production.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION'
  );
  assert.equal(provisioningBlocker?.owner, '02 WEP');
  assert.equal(provisioningBlocker?.state, 'CLOSED');
});


test('Auth launch review closes provider boundary, revocation, and real-mailbox reauthentication', () => {
  const review = JSON.parse(read('ops/community-auth-launch-review.json'));
  const operations = JSON.parse(read('ops/community-production-operations.json'));
  const evidence = read(
    'docs/community/auth-provider-boundary-revocation-runtime-20261001.md'
  );
  const mailboxEvidence = read(
    'docs/community/auth-final-mailbox-reauth-runtime-20261001.md'
  );

  assert.equal(review.schema, 'dreamwish-community-auth-launch-review@1');
  assert.equal(review.emailTrafficGeneratedByThisAcceptance, false);
  assert.equal(review.passwordPolicy.configuredMinimumCodePoints, 15);
  assert.equal(review.passwordPolicy.providerBoundary.password14Accepted, false);
  assert.equal(review.passwordPolicy.providerBoundary.password15Accepted, true);
  assert.equal(
    review.passwordPolicy.providerBoundary.status,
    'CONFIRMED_RUNTIME'
  );
  assert.equal(review.revocation.providerGlobalLogout, true);
  assert.equal(
    review.revocation.secondSessionRefreshRejectedAfterGlobalLogout,
    true
  );
  assert.equal(review.revocation.wandSessionCutoffRejectedOldJwt, true);
  assert.equal(review.revocation.status, 'CONFIRMED_RUNTIME');
  assert.equal(review.reauthentication.signedInNonceFlowRerun, true);
  assert.equal(
    review.reauthentication.finalStatus,
    'CLOSED_CONFIRMED_RUNTIME'
  );
  assert.equal(review.reauthentication.runtime.oldSessionWandError, 'SESSION_REVOKED_OR_INVALID');
  assert.equal(review.reauthentication.runtime.oldRefreshErrorCode, 'refresh_token_not_found');
  assert.equal(review.reauthentication.runtime.freshPasswordSigninSucceeded, true);
  assert.equal(review.reauthentication.runtime.freshCommunityQuerySucceeded, true);
  assert.equal(review.launchApproved, true);
  assert.equal(review.remaining.length, 1);
  assert.equal(review.remaining[0].status, 'CLOSED');

  assert.equal(operations.releaseGate.requireAuthLaunchAcceptance, true);
  assert.equal(
    operations.authLaunchReview.providerPasswordBoundary,
    'CONFIRMED'
  );
  assert.equal(
    operations.authLaunchReview.providerAndWandRevocation,
    'CONFIRMED'
  );
  assert.equal(
    operations.authLaunchReview.signedInReauthentication,
    'CONFIRMED'
  );
  assert.equal(operations.authLaunchReview.launchApproved, true);
  assert.match(evidence, /14-character ASCII password: \*\*rejected\*\*/);
  assert.match(evidence, /15-character ASCII password: \*\*accepted\*\*/);
  assert.match(evidence, /No signup confirmation email was generated/i);
  assert.match(evidence, /signed-in reauthentication/i);
  assert.match(mailboxEvidence, /CONFIRMED PASS/i);
  assert.match(mailboxEvidence, /SESSION_REVOKED_OR_INVALID/);
  assert.match(mailboxEvidence, /refresh_token_not_found/);
});


test('WEP Preset bucket externalization is production-safe and staging-compatible', () => {
  const manifest = JSON.parse(read('ops/community-production-operations.json'));

  assert.ok(
    manifest.production.requiredEnvironmentConfig.includes(
      'WEP_PRESET_ARTIFACT_BUCKET'
    )
  );
  const blocker = manifest.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_EXTERNALIZATION'
  );
  assert.equal(blocker?.state, 'CLOSED');
  assert.match(blocker?.evidence ?? '', /c396413dc349829bc91f89b397321de38b55a3ba/);
  assert.match(blocker?.evidence ?? '', /wep-preset-artifact v14/);
  assert.match(blocker?.evidence ?? '', /wep-preset-retention v6/);

  const provisioning = manifest.crossStreamBlockers.find(
    (item) => item.id === 'WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION'
  );
  assert.equal(provisioning?.state, 'CLOSED');
  assert.match(provisioning?.detail ?? '', /Final fresh-target replay remains Release Operations work/i);
});


test('final integrated production-tree guard preserves Community replay fixes', () => {
  const evidence = JSON.parse(
    read('ops/community-integration-merge-risk-20261001.json')
  );
  const script = read(
    'scripts/verify-community-integrated-production-tree.mjs'
  );
  const pkg = JSON.parse(read('package.json'));

  assert.equal(evidence.schema, 'dreamwish-community-integration-merge-risk@1');
  assert.equal(evidence.branchRelationship.status, 'diverged');
  assert.equal(
    evidence.branchRelationship.mergeBase,
    'cfda06eb904544bbfa5286c4eb61b5856dd3ea51'
  );

  const obsolete = evidence.confirmedIntegrationHazards.find(
    (item) => item.id === 'OBSOLETE_SUPPORT_RECOVERY_PREFIX'
  );
  assert.match(obsolete.wepPath, /20260930081500_/);
  assert.match(obsolete.canonicalPath, /20260930081600_/);

  const stagingSql = evidence.confirmedIntegrationHazards.find(
    (item) => item.id === 'STAGING_PG_NET_IN_PRODUCTION_CHAIN'
  );
  assert.equal(stagingSql.obsoletePaths.length, 2);
  assert.equal(stagingSql.canonicalDirectory, 'supabase/staging');

  const wepDelta = evidence.confirmedIntegrationHazards.find(
    (item) => item.id === 'WEP_PRESET_PRODUCTION_DELTA'
  );
  assert.equal(wepDelta.requiredPaths.length, 6);

  const stagingBucketMigration = evidence.confirmedIntegrationHazards.find(
    (item) => item.id === 'WEP_PRESET_STAGING_BUCKET_IN_PRODUCTION_MIGRATION'
  );
  assert.equal(stagingBucketMigration.state, 'RESOLVED_IN_CURRENT_WEP_BRANCH');
  assert.match(stagingBucketMigration.path, /20260930124055_/);
  assert.match(stagingBucketMigration.resolution, /no longer contains the staging bucket literal/i);

  assert.match(script, /Partial WEP production integration is unsafe/);
  assert.match(script, /20260930081600_community_core_v0_support_recovery_verification/);
  assert.match(script, /20260930081500_community_core_v0_support_recovery_verification/);
  assert.match(script, /WEP_PRESET_ARTIFACT_BUCKET_REQUIRED_OUTSIDE_KNOWN_STAGING/);
  assert.match(script, /WEP_PRESET_ARTIFACT_BUCKET_STAGING_FORBIDDEN_OUTSIDE_KNOWN_STAGING/);
  assert.match(script, /WEP Preset storage migration must not create the staging bucket/);
  assert.match(script, /WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION/);
  assert.match(script, /final-integrated-main/);
  assert.match(script, /--require-ready/);

  assert.equal(
    pkg.scripts['verify:community-integrated-tree'],
    'node scripts/verify-community-integrated-production-tree.mjs'
  );
});


test('production release evidence index keeps closed and pending gates explicit', () => {
  const release = JSON.parse(
    read('ops/community-production-release-evidence.json')
  );
  const operations = JSON.parse(read('ops/community-production-operations.json'));
  const verifier = read('scripts/verify-community-ops-readiness.mjs');

  assert.equal(
    release.schema,
    'dreamwish-community-production-release-evidence@1'
  );
  assert.equal(
    release.productionEvidenceMustComeFromDistinctProductionEnvironment,
    true
  );
  assert.equal(release.stagingProjectRef, operations.staging.projectRef);
  assert.equal(release.productionProjectRef, null);
  assert.equal(release.launchReady, false);

  const byId = new Map(release.gates.map((gate) => [gate.id, gate]));
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
    'TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY',
    'TRANSACTIONAL_EMAIL_HUMAN_MAILBOX_PLACEMENT'
  ]) {
    assert.equal(byId.get(id)?.satisfied, true, id);
    assert.ok((byId.get(id)?.evidence ?? []).length > 0, id);
  }

  for (const id of [
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
    'PRODUCTION_SECURITY_ADVISOR'
  ]) {
    assert.equal(byId.get(id)?.satisfied, false, id);
  }

  assert.equal(byId.get('STAGING_OPERATIONS_INVENTORY')?.classification, 'staging_only');
  assert.equal(byId.get('AUTH_SIGNED_IN_REAUTH_MAILBOX')?.classification, 'already_closed');
  assert.equal(byId.get('RETENTION_PRODUCT_PRIVACY_LEGAL_APPROVAL')?.classification, 'approval_pending');
  assert.equal(byId.get('DISTINCT_PRODUCTION_SUPABASE_PROJECT')?.classification, 'production_only_pending');
  assert.equal(byId.get('WEP_PRESET_ARTIFACT_BUCKET_PRODUCTION_MIGRATION')?.classification, 'already_closed');
  assert.equal(byId.get('COMMUNITY_PRIMARY_BROWSER_CLOSURE')?.classification, 'already_closed');
  assert.equal(byId.get('RETENTION_ENGINEERING_IMPLEMENTATION')?.classification, 'already_closed');
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.classification, 'already_closed');
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.providerMetrics.sent, 8);
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.providerMetrics.delivered, 8);
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.providerMetrics.bounced, 0);
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.providerMetrics.failed, 0);
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_PROVIDER_DELIVERY')?.providerMetrics.complained, 0);
  assert.equal(byId.get('TRANSACTIONAL_EMAIL_HUMAN_MAILBOX_PLACEMENT')?.classification, 'already_closed');
  assert.equal(
    byId.get('TRANSACTIONAL_EMAIL_HUMAN_MAILBOX_PLACEMENT')?.humanMailboxPlacement,
    'CONFIRMED_REPRESENTATIVE_QA_MAILBOX'
  );

  assert.equal(
    operations.releaseEvidence.contract,
    'ops/community-production-release-evidence.json'
  );
  assert.match(verifier, /Production release evidence index is not launch-ready/);
  assert.match(verifier, /Production release evidence gates remain unsatisfied/);
});


test('retention D1-D8 approval matrix is explicit', () => {
  const review = JSON.parse(read('ops/community-retention-launch-review.json'));
  const byId = new Map(review.decisions.map((decision) => [decision.id, decision]));

  const expected = {
    D1_CONTENT_PAYLOAD_DURATION: ['product', 'privacy', 'legal'],
    D2_OPERATIONAL_DETAIL_DURATION: ['product', 'privacy', 'legal'],
    D3_USER_FACING_DELETION_PROMISE: ['product'],
    D4_RETENTION_HOLD_POLICY: ['product', 'privacy', 'legal'],
    D5_STRUCTURAL_TOMBSTONE_POLICY: ['product', 'privacy', 'legal'],
    D6_BACKUP_COPY_RETENTION: ['product', 'privacy', 'legal'],
    D7_PROCESSOR_PROVIDER_RETENTION: ['privacy', 'legal'],
    D8_POLICY_DISCLOSURE_AND_ACCEPTANCE: ['product', 'privacy', 'legal']
  };

  for (const [id, approvals] of Object.entries(expected)) {
    const decision = byId.get(id);
    assert.ok(decision, id);
    assert.equal(decision.engineeringStatus, 'CLOSED');
    assert.equal(decision.status, 'PENDING_APPROVAL');
    assert.deepEqual(decision.requiredApprovals, approvals);
    for (const approval of approvals) {
      assert.equal(decision.approvalStatus[approval], 'PENDING');
    }
  }

  assert.equal(review.launchApproved, false);
  assert.match(
    review.approvalMatrixRule,
    /every required approval.*APPROVED/i
  );
});

test('final Auth gate preserves the real-mailbox-only evidence boundary after closure', () => {
  const review = JSON.parse(read('ops/community-auth-launch-review.json'));

  assert.equal(review.reauthentication.executionMode, 'REAL_MAILBOX_OPERATOR_QA');
  assert.equal(review.reauthentication.operatorManualRequired, true);
  assert.equal(review.reauthentication.syntheticSubstituteAllowed, false);
  assert.deepEqual(review.reauthentication.completedFlow, [
    'real signed-in session',
    'reauthentication nonce',
    'password change',
    'provider global revoke',
    'Wand session cutoff',
    'old session rejected',
    'fresh sign-in succeeds'
  ]);
  assert.deepEqual(review.reauthentication.remainingFlow, []);
  assert.equal(review.reauthentication.finalStatus, 'CLOSED_CONFIRMED_RUNTIME');
  assert.equal(review.launchApproved, true);
});

test('current release evidence treats leaked-password warning as nonblocking plan limitation', () => {
  const release = JSON.parse(read('ops/community-production-release-evidence.json'));
  const operations = JSON.parse(read('ops/community-production-operations.json'));

  assert.equal(
    release.currentObservations.stagingSecurityAdvisor.knownPlanUnavailableWarning,
    'auth_leaked_password_protection'
  );
  assert.equal(
    release.currentObservations.stagingSecurityAdvisor.knownPlanUnavailableWarningIsEngineeringBlocker,
    false
  );
  assert.equal(operations.security.planUnavailableFindingIsEngineeringBlocker, false);
  assert.ok(
    operations.security.knownPlanUnavailableNonBlockingFindings.includes(
      'auth_leaked_password_protection'
    )
  );

  const productionAdvisor = release.gates.find(
    (gate) => gate.id === 'PRODUCTION_SECURITY_ADVISOR'
  );
  assert.equal(productionAdvisor.satisfied, false);
  assert.equal(
    productionAdvisor.knownNonBlockingCurrentPlanFinding,
    'auth_leaked_password_protection'
  );
});

test('latest WEP delta does not reopen Community Preset vertical', () => {
  const release = JSON.parse(read('ops/community-production-release-evidence.json'));
  const preset = release.gates.find(
    (gate) => gate.id === 'PRESET_SCENE_REUSE_VERTICAL'
  );

  assert.equal(
    release.currentObservations.wep.latestObservedHead,
    'ba55070f3c48df3bef9d1b12aaf056ed4978791a'
  );
  assert.equal(
    release.currentObservations.wep.communityTransportContractChangedSinceConfirmedVertical,
    false
  );
  assert.equal(
    release.currentObservations.wep.communityPresetEdgeFunctionChangedSinceConfirmedVertical,
    false
  );
  assert.equal(release.currentObservations.wep.integrationSensitiveRerunRequired, false);
  assert.equal(preset.satisfied, true);
  assert.equal(preset.integrationSensitiveRerunRequired, false);
});


test('retention launch policy proposal is concrete but never self-approves', () => {
  const proposal = JSON.parse(read('ops/community-retention-policy-proposal.json'));
  const review = JSON.parse(read('ops/community-retention-launch-review.json'));
  const approval = JSON.parse(read('ops/community-retention-approval-state.json'));
  const release = JSON.parse(read('ops/community-production-release-evidence.json'));

  assert.equal(proposal.schema, 'dreamwish-community-retention-policy-proposal@1');
  assert.equal(proposal.status, 'READY_FOR_EXPLICIT_APPROVAL');
  assert.equal(proposal.notAnApproval, true);
  assert.equal(proposal.engineeringBoundary.contentPayloadDaysDefault, 7);
  assert.equal(proposal.engineeringBoundary.operationalDetailDaysDefault, 90);

  const byId = new Map(proposal.decisions.map((item) => [item.id, item]));
  assert.equal(byId.get('D1_CONTENT_PAYLOAD_DURATION').valueDays, 7);
  assert.equal(byId.get('D1_CONTENT_PAYLOAD_DURATION').isRecoveryWindow, false);
  assert.equal(byId.get('D2_OPERATIONAL_DETAIL_DURATION').valueDays, 90);
  assert.equal(
    byId.get('D3_USER_FACING_DELETION_PROMISE').proposal,
    'IMMEDIATE_REMOVAL_THEN_SCHEDULED_BACKEND_PURGE'
  );
  assert.deepEqual(
    byId.get('D4_RETENTION_HOLD_POLICY').currentRuntimeEnforcement.allowedTypes,
    ['moderation', 'security', 'legal']
  );
  assert.equal(
    proposal.providerFacts.supabase.storageObjectsIncludedInDatabaseBackup,
    false
  );
  assert.equal(
    proposal.providerFacts.resend.emailAndLogRetentionDaysForFreeProScale,
    30
  );

  assert.equal(review.policyProposal.status, 'READY_FOR_EXPLICIT_APPROVAL');
  assert.equal(review.policyProposal.notAnApproval, true);
  assert.equal(review.launchApproved, false);
  assert.equal(approval.policyProposal.approvalsInferred, false);
  assert.equal(approval.launchApproved, false);

  const gate = release.gates.find(
    (item) => item.id === 'RETENTION_PRODUCT_PRIVACY_LEGAL_APPROVAL'
  );
  assert.equal(gate.satisfied, false);
  assert.equal(gate.classification, 'approval_pending');
});


test('current D1 content retention is seven days and not a recovery window', () => {
  const migration = read(
    'supabase/migrations/20261001115028_community_retention_content_purge_7d.sql'
  );
  const proposal = JSON.parse(read('ops/community-retention-policy-proposal.json'));

  assert.match(migration, /deleted_account_content_days',7/);
  assert.match(migration, /requested_at \+ interval '7 days'/);
  assert.equal(proposal.engineeringBoundary.contentPayloadDaysDefault, 7);

  const d1 = proposal.decisions.find(
    (item) => item.id === 'D1_CONTENT_PAYLOAD_DURATION'
  );
  assert.equal(d1.valueDays, 7);
  assert.equal(d1.isRecoveryWindow, false);
});


test('current D2 operational retention is a single ninety-day stage with D4 holds', () => {
  const migration = read(
    'supabase/migrations/20261001122209_community_retention_operational_90d_single_stage.sql'
  );
  const worker = read('supabase/functions/community-retention/index.ts');
  const proposal = JSON.parse(read('ops/community-retention-policy-proposal.json'));

  assert.match(migration, /deleted_account_operational_days',90/);
  assert.match(migration, /delete from private\.account_retention_jobs\s+where stage='elevated_operational_detail'/);
  assert.match(migration, /delete from private\.community_retention_policy\s+where policy_key='deleted_account_elevated_operational_days'/);
  assert.match(migration, /check \(stage in \('content_payload','operational_detail'\)\)/);
  assert.match(migration, /drop column if exists elevated_operational_scrub_after/);
  assert.match(migration, /community_account_has_retention_hold/);
  assert.match(migration, /\[scrubbed retention hold\]/);
  assert.doesNotMatch(worker, /elevated_operational_detail/);

  assert.equal(proposal.engineeringBoundary.operationalDetailDaysDefault, 90);
  const d2 = proposal.decisions.find((item) => item.id === 'D2_OPERATIONAL_DETAIL_DURATION');
  assert.equal(d2.valueDays, 90);
  assert.equal(d2.proposal, '90_DAYS_SINGLE_STAGE_WITH_D4_HOLDS');
});


test('backup privacy contract prevents restore-time resurrection without requiring PITR', () => {
  const backup = JSON.parse(read('ops/community-backup-privacy-contract.json'));
  const operations = JSON.parse(read('ops/community-production-operations.json'));
  const proposal = JSON.parse(read('ops/community-retention-policy-proposal.json'));

  assert.equal(backup.schema, 'dreamwish-community-backup-privacy-contract@1');
  assert.equal(backup.status, 'DESIGN_CLOSED_PRODUCTION_RUNTIME_PENDING');
  assert.equal(backup.recoveryTargets.restoreToNonProductionFirst, true);
  assert.equal(backup.database.pitrRequiredAtLaunch, false);
  assert.equal(backup.storage.independentRecoveryCopyRequired, true);
  assert.equal(backup.storage.mustBeOutsidePrimarySupabaseProjectRollbackDomain, true);
  assert.equal(backup.storage.privateOnly, true);
  assert.equal(backup.storage.targetRetentionDays, 7);
  assert.equal(backup.recoveryDeletionLedger.required, true);
  assert.equal(backup.recoveryDeletionLedger.mustBeOutsidePrimaryRollbackDomain, true);
  assert.equal(backup.recoveryDeletionLedger.retentionDays, 90);
  assert.deepEqual(
    backup.recoveryDeletionLedger.fields,
    ['deletionEventId', 'accountId', 'requestedAt']
  );
  assert.ok(backup.recoveryDeletionLedger.forbiddenFields.includes('email'));
  assert.ok(backup.recoveryDeletionLedger.forbiddenFields.includes('contentPayload'));
  assert.equal(
    backup.restoreAcceptance.deletionLedgerReconciliationRequired,
    true
  );
  assert.equal(backup.restoreAcceptance.sessionRevalidationRequired, true);

  assert.equal(operations.backupPolicy.database.pitrRequiredAtLaunch, false);
  assert.equal(operations.backupPolicy.storageObjects.targetCopyRetentionDays, 7);
  assert.equal(operations.backupPolicy.recoveryDeletionLedger.retentionDays, 90);

  const d6 = proposal.decisions.find((item) => item.id === 'D6_BACKUP_COPY_RETENTION');
  assert.equal(
    d6.proposal,
    'QUARANTINED_DB_STORAGE_RECOVERY_WITH_EXTERNAL_DELETION_LEDGER'
  );
  assert.equal(d6.implementationChangeRequired, 'PRODUCTION_MECHANISM_PENDING');
});


test('deletion disclosure maps each user data category without overpromising deletion', () => {
  const disclosure = JSON.parse(read('ops/community-deletion-disclosure-contract.json'));
  const proposal = JSON.parse(read('ops/community-retention-policy-proposal.json'));

  assert.equal(disclosure.schema, 'dreamwish-community-deletion-disclosure-contract@1');
  assert.equal(disclosure.status, 'READY_FOR_PRODUCT_PRIVACY_LEGAL_REVIEW');
  assert.equal(disclosure.notLegalApproval, true);

  const byId = new Map(disclosure.categories.map((item) => [item.id, item]));
  assert.equal(byId.get('ACCOUNT_CREATOR').timing, 'IMMEDIATE');
  assert.equal(
    byId.get('PUBLISHED_PRIVATE_WORKS').timing,
    'IMMEDIATE_ACCESS_REMOVAL_THEN_WITHIN_7_DAYS_PAYLOAD_PURGE'
  );
  assert.equal(byId.get('PUBLISHED_PRIVATE_WORKS').recoveryWindow, false);
  assert.equal(byId.get('PRIVATE_INTERACTIONS').timing, 'IMMEDIATE');
  assert.equal(byId.get('OPERATIONAL_RECORDS').timing, '90_DAYS');
  assert.match(byId.get('OPERATIONAL_RECORDS').exception, /moderation, security or legal/i);
  assert.equal(byId.get('BACKUP_RECOVERY_COPIES').timing, 'SEPARATE_RECOVERY_POLICY');
  assert.equal(byId.get('PROVIDER_COPIES_LOGS').timing, 'PROVIDER_CONTROLLED');

  assert.ok(
    disclosure.surfaces.deleteAccountConfirmation.mustNotState.includes(
      'all copies are physically deleted immediately'
    )
  );
  assert.ok(
    disclosure.surfaces.deleteAccountConfirmation.mustNotState.includes(
      'the 7-day period is a recovery window'
    )
  );

  const d7 = proposal.decisions.find((item) => item.id === 'D7_PROCESSOR_PROVIDER_RETENTION');
  const d8 = proposal.decisions.find((item) => item.id === 'D8_POLICY_DISCLOSURE_AND_ACCEPTANCE');
  assert.match(d7.implementationChangeRequired, /PROVIDER_BINDING_PENDING/);
  assert.match(d8.implementationChangeRequired, /USER_FACING_COPY_AND_APPROVAL_PENDING/);
});


test('Community Lab account deletion copy matches current retention contract', () => {
  const page = read('src/routes/community-lab/account/+page.svelte');
  const copy = read('docs/community/delete-account-user-copy-review-20261001.md');

  assert.match(page, /Deleting this Wand Account is irreversible/);
  assert.match(page, /physically purged within 7 days/);
  assert.match(page, /normally deleted or minimized at 90 days/);
  assert.match(page, /7-day period is not a recovery window/);
  assert.match(page, /Backup\/recovery copies and service-provider copies\/logs/);

  assert.match(copy, /permanent and cannot be undone/);
  assert.match(copy, /physically purged within 7 days/);
  assert.match(copy, /normally deleted or minimized within 90 days/);
  assert.match(copy, /moderation, security, or legal hold/);
  assert.match(copy, /deletion records are reapplied/);
  assert.match(copy, /production service providers/);
});
