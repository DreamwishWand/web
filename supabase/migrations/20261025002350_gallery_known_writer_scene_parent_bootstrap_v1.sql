-- 03 COMM / 09 INT: create the Scene Preset association parent before
-- 20261025002400 Gallery known-reference Writer Fence trigger creation.
-- Historically added to Staging by an out-of-tree Scene Preset migration;
-- confirmed current staging contract: nullable UUID, no default, FK to
-- public.gallery_works(work_id), name specified below.
-- Only DDL parity: no positive Gallery retirement/Cloud/public writer enable.
alter table public.preset_artifacts
 add column if not exists associated_gallery_work_id uuid;

do $bootstrap_fk$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.preset_artifacts'::regclass
      and conname='preset_artifacts_associated_gallery_work_id_fkey'
  ) then
    alter table public.preset_artifacts
      add constraint preset_artifacts_associated_gallery_work_id_fkey
      foreign key (associated_gallery_work_id)
      references public.gallery_works(work_id);
  end if;
end
$bootstrap_fk$;

-- Restore the ACTIVE Staging immutability invariant lost with the historical
-- Scene product migration. Adding the column/FK alone is NOT sufficient:
-- after the first PresetRevision, its Gallery association is identity data.
-- Keep this trigger ordinary SECURITY INVOKER (same as Staging), NOT an
-- authorization route for Gallery retirement / Cloud / native save writes.
create or replace function public.guard_preset_artifact_identity()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $preset_identity$
begin
  if exists (
    select 1 from public.preset_revisions pr
    where pr.preset_artifact_id=old.preset_artifact_id
  ) and (
    new.owner_account_id is distinct from old.owner_account_id
    or new.creator_profile_id is distinct from old.creator_profile_id
    or new.community_work_id is distinct from old.community_work_id
    or new.associated_gallery_work_id is distinct from old.associated_gallery_work_id
    or new.preset_type is distinct from old.preset_type
  ) then
    raise exception 'PresetArtifact identity is immutable after first revision';
  end if;
  return new;
end
$preset_identity$;

-- The original preset_artifacts_identity_guard trigger remains installed.
-- Preserve the existing trigger-function privileges: not a client RPC.
revoke execute on function public.guard_preset_artifact_identity()
  from public,anon,authenticated;


-- Functional parity: service-only read of PUBLIC Scene Preset current revision.
-- This is NOT the legacy paired-Gallery publisher or any lifecycle writer.
-- Canonical generic Presets may have no associated Gallery Work; historic Scene
-- products must validate their current Gallery revision and exact Preset link.
-- Never expose ArtifactBlob.storage_key, raw Media Storage paths, private Work,
-- draft/historical revisions, or stale Gallery cover/media to this projection.
create or replace function public.community_get_scene_preset_public_v1(
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $scene_read$
declare
  v_work public.community_works%rowtype;
  v_preset public.preset_artifacts%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_gallery public.community_works%rowtype;
  v_title text;
  v_description text;
  v_media_ids jsonb:='[]'::jsonb;
  v_cover uuid;
begin
  if p_work_id is null or not private.is_discoverable_work(p_work_id) then
    raise exception 'Scene Preset is not publicly accessible';
  end if;

  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='preset';
  if v_work.work_id is null then
    raise exception 'Scene Preset is not publicly accessible';
  end if;

  select * into v_preset from public.preset_artifacts
  where community_work_id=v_work.work_id and preset_type='scene'
    and owner_account_id=v_work.owner_account_id
    and creator_profile_id=v_work.creator_profile_id;
  if v_preset.preset_artifact_id is null then
    raise exception 'Scene Preset publication relationship is unavailable';
  end if;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id
    and pr.preset_artifact_id=v_preset.preset_artifact_id;
  if v_preset_revision.preset_revision_id is null then
    raise exception 'Published Scene Preset revision is unavailable';
  end if;

  select * into v_blob from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id and purged_at is null;
  if v_blob.blob_id is null then
    raise exception 'Published Scene Preset ArtifactBlob is unavailable';
  end if;

  select r.shared_metadata->>'title',r.shared_metadata->>'description'
  into v_title,v_description
  from public.community_work_revisions r
  where r.revision_id=v_work.current_published_revision_id
    and r.work_id=v_work.work_id;
  if not found then
    raise exception 'Published Scene Preset WorkRevision is unavailable';
  end if;

  if v_preset.associated_gallery_work_id is not null then
    if not private.is_discoverable_work(v_preset.associated_gallery_work_id) then
      raise exception 'Associated Gallery Work is not publicly accessible';
    end if;
    select * into v_gallery from public.community_works
    where work_id=v_preset.associated_gallery_work_id and work_type='gallery'
      and owner_account_id=v_preset.owner_account_id
      and creator_profile_id=v_preset.creator_profile_id;
    if v_gallery.work_id is null or not exists (
      select 1 from public.gallery_revision_presets gp
      where gp.gallery_revision_id=v_gallery.current_published_revision_id
        and gp.preset_revision_id=v_preset_revision.preset_revision_id
    ) then
      raise exception 'Associated Gallery current revision is not linked to Scene Preset';
    end if;

    -- Reject incomplete READY/CLEAR Gallery media rather than exposing mixed
    -- revision data or a stale/historical cover reference.
    if exists (
      select 1 from public.work_revision_media wrm
      left join public.media_assets m on m.media_id=wrm.media_id
      where wrm.work_revision_id=v_gallery.current_published_revision_id
        and (m.media_id is null or m.processing_state<>'ready'
          or m.moderation_state<>'clear' or m.purged_at is not null)
    ) then raise exception 'Associated Gallery media is not publicly ready'; end if;

    select coalesce(jsonb_agg(wrm.media_id order by wrm.ordinal),'[]'::jsonb)
    into v_media_ids from public.work_revision_media wrm
    where wrm.work_revision_id=v_gallery.current_published_revision_id;

    select f.cover_media_id into v_cover
    from public.gallery_photo_revision_fields f
    join public.media_assets m on m.media_id=f.cover_media_id
    where f.revision_id=v_gallery.current_published_revision_id
      and m.processing_state='ready' and m.moderation_state='clear' and m.purged_at is null;

    if exists (
      select 1 from public.gallery_photo_revision_fields f
      where f.revision_id=v_gallery.current_published_revision_id
    ) and v_cover is null then
      raise exception 'Associated Gallery current cover is not publicly ready';
    end if;
  end if;

  return jsonb_build_object(
    'workId',v_work.work_id,
    'workRevisionId',v_work.current_published_revision_id,
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetRevisionNumber',v_preset_revision.revision_number,
    'presetType','scene',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',v_title,
    'description',v_description,
    'metadata',v_preset_revision.metadata,
    'schemaVersion',v_blob.schema_version,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256,
    'galleryWorkId',v_gallery.work_id,
    'galleryWorkRevisionId',v_gallery.current_published_revision_id,
    'mediaIds',v_media_ids,
    'coverMediaId',v_cover,
    'publishedAt',v_work.published_at
  );
end
$scene_read$;

revoke all on function public.community_get_scene_preset_public_v1(uuid)
  from public,anon,authenticated;
grant execute on function public.community_get_scene_preset_public_v1(uuid)
  to service_role;
