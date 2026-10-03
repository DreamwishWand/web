create or replace function public.wep_get_accessible_preset_blob(
  p_auth_subject uuid,
  p_preset_artifact_id uuid default null,
  p_preset_revision_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_work public.community_works%rowtype;
begin
  if (p_preset_artifact_id is null) = (p_preset_revision_id is null) then
    raise exception 'Exactly one Preset artifact or revision id is required';
  end if;

  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_preset_revision_id is not null then
    select pa.* into v_preset
    from public.preset_revisions pr
    join public.preset_artifacts pa
      on pa.preset_artifact_id=pr.preset_artifact_id
    where pr.preset_revision_id=p_preset_revision_id;

    if v_preset.preset_artifact_id is null then
      raise exception 'Preset revision not found';
    end if;

    if not private.can_access_entity(v_preset.preset_artifact_id,v_account_id) then
      raise exception 'Preset is not accessible';
    end if;

    select * into v_revision
    from public.preset_revisions
    where preset_revision_id=p_preset_revision_id;
  else
    select * into v_preset
    from public.preset_artifacts
    where preset_artifact_id=p_preset_artifact_id;

    if v_preset.preset_artifact_id is null then
      raise exception 'Preset not found';
    end if;

    if not private.can_access_entity(v_preset.preset_artifact_id,v_account_id) then
      raise exception 'Preset is not accessible';
    end if;

    select * into v_work
    from public.community_works
    where work_id=v_preset.community_work_id;

    if v_work.current_published_revision_id is null then
      raise exception 'Preset has no published revision';
    end if;

    select pr.* into v_revision
    from public.preset_revision_publications pp
    join public.preset_revisions pr
      on pr.preset_revision_id=pp.preset_revision_id
    where pp.work_revision_id=v_work.current_published_revision_id;
  end if;

  if v_revision.preset_revision_id is null then
    raise exception 'Published Preset revision not found';
  end if;

  select * into v_blob
  from public.artifact_blobs
  where blob_id=v_revision.artifact_blob_id;

  if v_blob.blob_id is null or v_blob.purged_at is not null then
    raise exception 'Preset artifact blob is unavailable';
  end if;

  return jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_revision.preset_revision_id,
    'presetType',v_preset.preset_type,
    'blobId',v_blob.blob_id,
    'storageKey',v_blob.storage_key,
    'schemaVersion',v_blob.schema_version,
    'contentType',v_blob.content_type,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256
  );
end;
$$;

revoke execute on function public.wep_get_accessible_preset_blob(uuid,uuid,uuid)
from public,anon,authenticated;
grant execute on function public.wep_get_accessible_preset_blob(uuid,uuid,uuid)
to service_role;
