
-- Community / WEP bridge: publish an opaque, WEP-validated Preset artifact
-- without interpreting or duplicating Preset payload semantics.

create or replace function public.validate_preset_work_binding()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.community_work_id is not null and not exists (
    select 1
    from public.community_works w
    where w.work_id=new.community_work_id
      and w.work_type='preset'
      and w.owner_account_id=new.owner_account_id
      and w.creator_profile_id=new.creator_profile_id
  ) then
    raise exception 'PresetArtifact CommunityWork must be a same-owner Preset work';
  end if;
  return new;
end;
$$;

drop trigger if exists preset_artifacts_work_binding_guard on public.preset_artifacts;
create trigger preset_artifacts_work_binding_guard
before insert or update of community_work_id,owner_account_id,creator_profile_id
on public.preset_artifacts
for each row execute function public.validate_preset_work_binding();

create or replace function public.guard_preset_artifact_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.preset_revisions pr
    where pr.preset_artifact_id=old.preset_artifact_id
  ) and (
    new.owner_account_id is distinct from old.owner_account_id
    or new.creator_profile_id is distinct from old.creator_profile_id
    or new.community_work_id is distinct from old.community_work_id
    or new.preset_type is distinct from old.preset_type
  ) then
    raise exception 'PresetArtifact identity is immutable after first revision';
  end if;
  return new;
end;
$$;

drop trigger if exists preset_artifacts_identity_guard on public.preset_artifacts;
create trigger preset_artifacts_identity_guard
before update on public.preset_artifacts
for each row execute function public.guard_preset_artifact_identity();

create or replace function public.community_publish_preset_envelope(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_visibility text,
  p_preset_type text,
  p_title text,
  p_description text,
  p_artifact_storage_key text,
  p_schema_version integer,
  p_content_type text,
  p_byte_size bigint,
  p_checksum_sha256 text,
  p_metadata jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_blob_id uuid;
  v_preset_id uuid;
  v_preset_revision_id uuid;
  v_work_id uuid;
  v_work_revision_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));

  v_request_hash := encode(digest(
    concat_ws('|',
      'publish_preset_envelope',
      p_creator_profile_id::text,p_visibility,p_preset_type,p_title,coalesce(p_description,''),
      p_artifact_storage_key,p_schema_version::text,p_content_type,p_byte_size::text,
      lower(p_checksum_sha256),coalesce(p_metadata,'{}'::jsonb)::text
    ),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  if not exists (
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;

  if p_schema_version <= 0 then raise exception 'Preset schema version must be positive'; end if;
  if p_byte_size <= 0 then raise exception 'Preset artifact byte size must be positive'; end if;
  if coalesce(length(btrim(p_artifact_storage_key)),0)=0 then
    raise exception 'Preset artifact storage key is required';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid SHA-256 checksum';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'publish_preset_envelope',v_request_hash);

  v_blob_id := gen_random_uuid();
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256
  ) values (
    v_blob_id,v_account_id,p_artifact_storage_key,p_schema_version,p_content_type,p_byte_size,
    lower(p_checksum_sha256)
  );

  v_preset_id := gen_random_uuid();
  v_work_id := gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values
    (v_preset_id,'preset_artifact'),
    (v_work_id,'community_work');

  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,visibility
  ) values (
    v_work_id,v_account_id,p_creator_profile_id,'preset',p_visibility::visibility_state
  );

  insert into public.preset_artifacts(
    preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type
  ) values (
    v_preset_id,v_account_id,p_creator_profile_id,v_work_id,p_preset_type
  );

  v_preset_revision_id := gen_random_uuid();
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id
  ) values (
    v_preset_revision_id,v_preset_id,1,v_blob_id,coalesce(p_metadata,'{}'::jsonb),v_account_id
  );

  v_work_revision_id := gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values (
    v_work_revision_id,v_work_id,1,v_account_id,
    jsonb_build_object('title',p_title,'description',p_description)
  );

  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
  values (v_work_revision_id,v_preset_revision_id);

  update public.community_works
  set lifecycle_state='published',
      current_published_revision_id=v_work_revision_id,
      published_at=now()
  where work_id=v_work_id;

  if p_visibility::visibility_state='public' then
    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
    )
    select
      v_work_id,v_work_id,'preset',p_creator_profile_id,p_title,coalesce(p_description,''),
      w.published_at,now()
    from public.community_works w
    where w.work_id=v_work_id;
  end if;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',v_work_id,'work.published',
    jsonb_build_object(
      'workId',v_work_id,
      'revisionId',v_work_revision_id,
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id
    ),
    'work.published:' || v_work_revision_id::text
  );

  v_response := jsonb_build_object(
    'presetArtifactId',v_preset_id,
    'presetRevisionId',v_preset_revision_id,
    'workId',v_work_id,
    'workRevisionId',v_work_revision_id
  );

  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.community_publish_gallery_v3(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_title text,
  p_description text,
  p_media_ids uuid[],
  p_preset_revision_ids uuid[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_revision_id uuid;
  v_revision_number integer;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_media_id uuid;
  v_preset_revision_id uuid;
  v_ordinal integer := 0;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));

  if p_media_ids is null or coalesce(array_length(p_media_ids,1),0)=0 then
    raise exception 'Gallery publication requires at least one media asset';
  end if;
  if array_length(p_media_ids,1)>20 then
    raise exception 'Gallery publication media count exceeds staging limit';
  end if;
  if coalesce(array_length(p_preset_revision_ids,1),0)>5 then
    raise exception 'Gallery publication Preset link count exceeds staging limit';
  end if;

  v_request_hash := encode(digest(
    concat_ws('|',
      'publish_gallery_v3',p_work_id::text,p_expected_version::text,p_title,coalesce(p_description,''),
      array_to_string(p_media_ids,','),array_to_string(coalesce(p_preset_revision_ids,array[]::uuid[]),',')
    ),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.work_type<>'gallery' then raise exception 'Work is not Gallery'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.moderation_state<>'clear' then raise exception 'Work is moderation-blocked'; end if;
  if v_work.lifecycle_state not in ('draft','unpublished') then
    raise exception 'Work cannot be published from current lifecycle';
  end if;

  foreach v_media_id in array p_media_ids loop
    if not exists (
      select 1 from public.media_assets m
      where m.media_id=v_media_id
        and m.owner_account_id=v_account_id
        and m.processing_state='ready'
        and m.moderation_state='clear'
    ) then
      raise exception 'Media asset is not owner-controlled and READY';
    end if;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    if not exists (
      select 1
      from public.preset_revisions pr
      join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
      join public.community_works pw on pw.work_id=pa.community_work_id
      where pr.preset_revision_id=v_preset_revision_id
        and pa.owner_account_id=v_account_id
        and pw.lifecycle_state='published'
        and pw.visibility in ('public','unlisted')
        and pw.moderation_state='clear'
    ) then
      raise exception 'Preset revision is not an accessible published owner Preset';
    end if;
  end loop;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'publish_gallery_v3',v_request_hash);

  select coalesce(max(revision_number),0)+1 into v_revision_number
  from public.community_work_revisions
  where work_id=p_work_id;

  v_revision_id := gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values (
    v_revision_id,p_work_id,v_revision_number,v_account_id,'{}'::jsonb
  );

  insert into public.gallery_work_revisions(revision_id,title,description)
  values (v_revision_id,p_title,p_description);

  foreach v_media_id in array p_media_ids loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values (v_revision_id,v_media_id,v_ordinal,'gallery');
    v_ordinal := v_ordinal+1;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
    values (v_revision_id,v_preset_revision_id);
  end loop;

  update public.community_works
  set lifecycle_state='published',
      current_published_revision_id=v_revision_id,
      published_at=now()
  where work_id=p_work_id
  returning * into v_work;

  if v_work.visibility='public' and v_work.moderation_state='clear' then
    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
    ) values (
      p_work_id,p_work_id,'gallery',v_work.creator_profile_id,p_title,coalesce(p_description,''),
      v_work.published_at,now()
    )
    on conflict (entity_id) do update set
      creator_profile_id=excluded.creator_profile_id,
      title=excluded.title,
      text_content=excluded.text_content,
      published_at=excluded.published_at,
      updated_at=now();
  else
    delete from public.search_documents where entity_id=p_work_id;
  end if;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.published',
    jsonb_build_object(
      'workId',p_work_id,
      'revisionId',v_revision_id,
      'mediaIds',to_jsonb(p_media_ids),
      'presetRevisionIds',to_jsonb(coalesce(p_preset_revision_ids,array[]::uuid[]))
    ),
    'work.published:' || v_revision_id::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,
    'revisionId',v_revision_id,
    'rowVersion',v_work.row_version
  );
  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.community_get_preset(
  p_auth_subject uuid,
  p_preset_artifact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_work public.community_works%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_entity(p_preset_artifact_id,v_account_id) then
    raise exception 'Preset is not accessible';
  end if;

  select * into v_preset
  from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id;

  select * into v_work
  from public.community_works
  where work_id=v_preset.community_work_id;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id;

  select * into v_blob
  from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id;

  select
    cwr.shared_metadata->>'title',
    cwr.shared_metadata->>'description'
  into v_title,v_description
  from public.community_work_revisions cwr
  where cwr.revision_id=v_work.current_published_revision_id;

  return jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetType',v_preset.preset_type,
    'workId',v_work.work_id,
    'workRevisionId',v_work.current_published_revision_id,
    'title',v_title,
    'description',v_description,
    'schemaVersion',v_blob.schema_version,
    'contentType',v_blob.content_type,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256,
    'metadata',v_preset_revision.metadata
  );
end;
$$;

revoke execute on function public.community_publish_gallery_v2(
  uuid,uuid,bigint,text,text,uuid[],text
) from service_role, public, anon, authenticated;

revoke execute on function public.validate_preset_work_binding()
from public, anon, authenticated;
revoke execute on function public.guard_preset_artifact_identity()
from public, anon, authenticated;
revoke execute on function public.community_publish_preset_envelope(
  uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text
) from public, anon, authenticated;
revoke execute on function public.community_publish_gallery_v3(
  uuid,uuid,bigint,text,text,uuid[],uuid[],text
) from public, anon, authenticated;
revoke execute on function public.community_get_preset(uuid,uuid)
from public, anon, authenticated;

grant execute on function public.community_publish_preset_envelope(
  uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text
) to service_role;
grant execute on function public.community_publish_gallery_v3(
  uuid,uuid,bigint,text,text,uuid[],uuid[],text
) to service_role;
grant execute on function public.community_get_preset(uuid,uuid)
to service_role;
