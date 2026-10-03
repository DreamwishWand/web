-- Community Core v0 staging hardening after first real Supabase advisor pass.

-- Fix mutable search_path warnings on all public trigger functions.
alter function public.enforce_ddv_profile_limit() set search_path = pg_catalog, public, private;
alter function public.prevent_immutable_revision_mutation() set search_path = pg_catalog, public, private;
alter function public.validate_current_published_revision() set search_path = pg_catalog, public, private;
alter function public.validate_comment_parent_target() set search_path = pg_catalog, public, private;
alter function public.validate_work_creator_owner() set search_path = pg_catalog, public, private;
alter function public.validate_preset_creator_owner() set search_path = pg_catalog, public, private;
alter function public.prevent_self_follow() set search_path = pg_catalog, public, private;
alter function public.validate_comment_target_type() set search_path = pg_catalog, public, private;
alter function public.validate_work_revision_media_owner() set search_path = pg_catalog, public, private;
alter function public.validate_preset_revision_blob_owner() set search_path = pg_catalog, public, private;
alter function public.validate_gallery_revision_type() set search_path = pg_catalog, public, private;
alter function public.validate_preset_publication_mapping() set search_path = pg_catalog, public, private;
alter function public.increment_work_row_version() set search_path = pg_catalog, public, private;
alter function public.increment_comment_row_version() set search_path = pg_catalog, public, private;
alter function public.validate_work_lifecycle_transition() set search_path = pg_catalog, public, private;
alter function public.validate_gallery_work_type() set search_path = pg_catalog, public, private;

-- Trigger functions are internal DB implementation details, not client RPCs.
revoke execute on function public.enforce_ddv_profile_limit() from public, anon, authenticated;
revoke execute on function public.prevent_immutable_revision_mutation() from public, anon, authenticated;
revoke execute on function public.validate_current_published_revision() from public, anon, authenticated;
revoke execute on function public.validate_comment_parent_target() from public, anon, authenticated;
revoke execute on function public.validate_work_creator_owner() from public, anon, authenticated;
revoke execute on function public.validate_preset_creator_owner() from public, anon, authenticated;
revoke execute on function public.prevent_self_follow() from public, anon, authenticated;
revoke execute on function public.validate_comment_target_type() from public, anon, authenticated;
revoke execute on function public.validate_work_revision_media_owner() from public, anon, authenticated;
revoke execute on function public.validate_preset_revision_blob_owner() from public, anon, authenticated;
revoke execute on function public.validate_gallery_revision_type() from public, anon, authenticated;
revoke execute on function public.validate_preset_publication_mapping() from public, anon, authenticated;
revoke execute on function public.increment_work_row_version() from public, anon, authenticated;
revoke execute on function public.increment_comment_row_version() from public, anon, authenticated;
revoke execute on function public.validate_work_lifecycle_transition() from public, anon, authenticated;
revoke execute on function public.validate_gallery_work_type() from public, anon, authenticated;

-- Cover FK columns used by joins, deletes, moderation, notification and ownership lookups.
create index if not exists artifact_blobs_owner_idx on public.artifact_blobs(owner_account_id);
create index if not exists audit_events_actor_idx on public.audit_events(actor_account_id);
create index if not exists audit_events_target_idx on public.audit_events(target_entity_id);
create index if not exists auth_identities_account_idx on public.auth_identities(account_id);
create index if not exists comments_author_idx on public.comments(author_account_id);
create index if not exists comments_creator_idx on public.comments(creator_profile_id);
create index if not exists comments_parent_idx on public.comments(parent_comment_id);
create index if not exists community_work_revisions_creator_idx on public.community_work_revisions(created_by_account_id);
create index if not exists community_works_current_revision_idx on public.community_works(current_published_revision_id);
create index if not exists community_works_owner_idx on public.community_works(owner_account_id);
create index if not exists creator_profiles_avatar_media_idx on public.creator_profiles(avatar_media_id);
create index if not exists follows_creator_idx on public.follows(creator_profile_id);
create index if not exists gallery_revision_presets_preset_idx on public.gallery_revision_presets(preset_revision_id);
create index if not exists moderation_actions_actor_idx on public.moderation_actions(actor_account_id);
create index if not exists moderation_actions_case_idx on public.moderation_actions(case_id);
create index if not exists moderation_cases_target_idx on public.moderation_cases(target_entity_id);
create index if not exists notification_events_actor_idx on public.notification_events(actor_account_id);
create index if not exists notification_events_target_idx on public.notification_events(target_entity_id);
create index if not exists preset_artifacts_creator_idx on public.preset_artifacts(creator_profile_id);
create index if not exists preset_artifacts_owner_idx on public.preset_artifacts(owner_account_id);
create index if not exists preset_revision_publications_preset_idx on public.preset_revision_publications(preset_revision_id);
create index if not exists preset_revisions_blob_idx on public.preset_revisions(artifact_blob_id);
create index if not exists preset_revisions_creator_idx on public.preset_revisions(created_by_account_id);
create index if not exists reactions_target_idx on public.reactions(target_entity_id);
create index if not exists reports_reporter_idx on public.reports(reporter_account_id);
create index if not exists reports_revision_idx on public.reports(target_revision_id);
create index if not exists saved_items_target_idx on public.saved_items(target_entity_id);
create index if not exists work_revision_media_media_idx on public.work_revision_media(media_id);
