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
    'supabase/functions/community-media/index.ts'
  ]) {
    const source = read(path);
    assert.match(source, /withSupabase\(\{ auth: 'user' \}/);
    assert.match(source, /ctx\.userClaims\?\.id/);
    assert.doesNotMatch(source, /payload\.actorAccountId|payload\.accountId/);
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
  const removal = read('supabase/migrations/20260930040500_community_staging_remove_pg_net.sql');
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


test('authenticated command adapter exposes moderation without accepting a client actor', () => {
  const source = read('supabase/functions/community-command/index.ts');
  assert.match(source, /moderateWork: 'community_moderate_work'/);
  assert.match(source, /params\.p_case_id = payload\.caseId/);
  assert.match(source, /params\.p_action = payload\.action/);
  assert.match(source, /params\.p_reason = payload\.reason/);
  assert.match(source, /p_auth_subject: subject/);
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


test('Community browser client exposes only the derived SearchDocument projection for public discovery', () => {
  const client = read('src/lib/community/staging-http-client.ts');
  const page = read('src/routes/community-lab/+page.svelte');
  assert.match(client, /\/rest\/v1\/search_documents/);
  assert.match(client, /discoverPublicWorks/);
  assert.match(client, /apikey: this\.config\.publishableKey/);
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

test('all authenticated Community Edge adapters enforce the Wand session cutoff', () => {
  for (const path of [
    'supabase/functions/community-command/index.ts',
    'supabase/functions/community-query/index.ts',
    'supabase/functions/community-media/index.ts'
  ]) {
    const source = read(path);
    assert.match(source, /ctx\.jwtClaims\?\.iat/);
    assert.match(source, /community_authorize_session/);
    assert.match(source, /SESSION_REVOKED_OR_INVALID/);
    assert.match(source, /p_max_age_seconds: null/);
  }
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
