-- 09 INT Scene Wand Preset product vertical.
-- Community owns publication/revision/visibility/media relationships.
-- WEP remains the owner of Preset payload bytes and validation.
-- Scene only. No whole-Scene persistent Apply authorization.

alter table public.gallery_works
  drop constraint if exists gallery_works_gallery_kind_check;
alter table public.gallery_works
  add constraint gallery_works_gallery_kind_check
  check (gallery_kind in (
    'outdoor','indoor','dreamsnap','tom_furniture','tom_clothing','preset_scene'
  ));

alter table public.preset_artifacts
  add column if not exists associated_gallery_work_id uuid null
  references public.gallery_works(work_id);

create unique index if not exists preset_artifacts_associated_gallery_work_uq
  on public.preset_artifacts(associated_gallery_work_id)
  where associated_gallery_work_id is not null;

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
    or new.associated_gallery_work_id is distinct from old.associated_gallery_work_id
    or new.preset_type is distinct from old.preset_type
  ) then
    raise exception 'PresetArtifact identity is immutable after first revision';
  end if;
  return new;
end;
$$;

create or replace function public.community_publish_scene_preset_product_v1(
  p_auth_subject uuid,
  p_existing_preset_artifact_id uuid,
  p_creator_profile_id uuid,
  p_title text,
  p_description text,
  p_artifact_storage_key text,
  p_schema_version integer,
  p_content_type text,
  p_byte_size bigint,
  p_checksum_sha256 text,
  p_metadata jsonb,
  p_media_ids uuid[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_preset_work public.community_works%rowtype;
  v_gallery_work public.community_works%rowtype;
  v_blob_id uuid;
  v_preset_id uuid;
  v_preset_revision_id uuid;
  v_preset_revision_number integer;
  v_preset_work_id uuid;
  v_preset_work_revision_id uuid;
  v_preset_work_revision_number integer;
  v_gallery_work_id uuid;
  v_gallery_revision_id uuid;
  v_gallery_revision_number integer;
  v_media_id uuid;
  v_ordinal integer:=0;
  v_media_ids uuid[];
  v_media_count integer;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Scene Preset public title must be 1-240 characters';
  end if;
  if p_description is not null and char_length(p_description)>20000 then
    raise exception 'Scene Preset description exceeds 20000 characters';
  end if;
  if p_schema_version<>1 then
    raise exception 'Unsupported Scene Preset schema version';
  end if;
  if p_content_type<>'application/json' then
    raise exception 'Scene Preset artifact content type must be application/json';
  end if;
  if p_byte_size<=0 or p_byte_size>25*1024*1024 then
    raise exception 'Scene Preset artifact byte size is invalid';
  end if;
  if coalesce(length(btrim(p_artifact_storage_key)),0)=0 then
    raise exception 'Scene Preset artifact storage key is required';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid Scene Preset SHA-256 checksum';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
      and c.profile_visibility='public'
  ) then
    raise exception 'CreatorProfile is not owned, public, and moderation-clear';
  end if;

  v_media_ids:=coalesce(p_media_ids,array[]::uuid[]);
  v_media_count:=cardinality(v_media_ids);
  if p_existing_preset_artifact_id is null then
    if v_media_count not between 1 and 10 then
      raise exception 'Initial Scene Preset publication requires 1-10 public images';
    end if;
  elsif v_media_count>10 then
    raise exception 'Scene Preset publication supports at most 10 public images';
  end if;

  if v_media_count>0 and
     (select count(*) from unnest(v_media_ids) x)
     <> (select count(distinct x) from unnest(v_media_ids) x) then
    raise exception 'Scene Preset media IDs must be unique';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_account_id::text || ':' || p_idempotency_key,0)
  );

  v_request_hash:=encode(digest(
    concat_ws('|',
      'scene_preset_product_v1',
      coalesce(p_existing_preset_artifact_id::text,'NEW'),
      p_creator_profile_id::text,
      btrim(p_title),
      coalesce(p_description,''),
      p_artifact_storage_key,
      p_schema_version::text,
      p_content_type,
      p_byte_size::text,
      lower(p_checksum_sha256),
      coalesce(p_metadata,'{}'::jsonb)::text,
      array_to_string(v_media_ids,',')
    ),'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  foreach v_media_id in array v_media_ids loop
    if not exists(
      select 1 from public.media_assets m
      where m.media_id=v_media_id
        and m.owner_account_id=v_account_id
        and m.processing_state='ready'
        and m.moderation_state='clear'
        and m.purged_at is null
    ) then
      raise exception 'Scene Preset public image is not owner-controlled and READY';
    end if;
  end loop;

  insert into public.idempotency_keys(
    account_id,idempotency_key,command_name,request_hash
  ) values(
    v_account_id,p_idempotency_key,'scene_preset_product_v1',v_request_hash
  );

  v_blob_id:=gen_random_uuid();
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256
  ) values(
    v_blob_id,v_account_id,p_artifact_storage_key,p_schema_version,p_content_type,p_byte_size,
    lower(p_checksum_sha256)
  );

  if p_existing_preset_artifact_id is null then
    v_preset_id:=gen_random_uuid();
    v_preset_work_id:=gen_random_uuid();
    v_gallery_work_id:=gen_random_uuid();

    insert into public.community_entities(entity_id,entity_type) values
      (v_preset_id,'preset_artifact'),
      (v_preset_work_id,'community_work'),
      (v_gallery_work_id,'community_work');

    insert into public.community_works(
      work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
    ) values
      (v_preset_work_id,v_account_id,p_creator_profile_id,'preset','draft','public'),
      (v_gallery_work_id,v_account_id,p_creator_profile_id,'gallery','draft','public');

    insert into public.gallery_works(work_id,gallery_kind)
    values(v_gallery_work_id,'preset_scene');
    insert into public.gallery_work_settings(work_id,comments_enabled)
    values(v_gallery_work_id,true);

    insert into public.preset_artifacts(
      preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
      associated_gallery_work_id,preset_type
    ) values(
      v_preset_id,v_account_id,p_creator_profile_id,v_preset_work_id,
      v_gallery_work_id,'scene'
    );

    insert into public.community_entity_origins(entity_id,origin_kind) values
      (v_preset_id,private.community_origin_kind_for_account(v_account_id)),
      (v_preset_work_id,private.community_origin_kind_for_account(v_account_id)),
      (v_gallery_work_id,private.community_origin_kind_for_account(v_account_id));

    v_preset_revision_number:=1;
    v_preset_work_revision_number:=1;
    v_gallery_revision_number:=1;
  else
    select * into v_preset
    from public.preset_artifacts
    where preset_artifact_id=p_existing_preset_artifact_id
    for update;

    if v_preset.preset_artifact_id is null then
      raise exception 'Scene Preset master not found';
    end if;
    if v_preset.owner_account_id<>v_account_id
       or v_preset.creator_profile_id<>p_creator_profile_id then
      raise exception 'Actor does not own Scene Preset master';
    end if;
    if v_preset.preset_type<>'scene' then
      raise exception 'Only Scene Presets are supported by this vertical';
    end if;
    if v_preset.community_work_id is null
       or v_preset.associated_gallery_work_id is null then
      raise exception 'Scene Preset publication relationship is incomplete';
    end if;

    v_preset_id:=v_preset.preset_artifact_id;
    v_preset_work_id:=v_preset.community_work_id;
    v_gallery_work_id:=v_preset.associated_gallery_work_id;

    select * into v_preset_work
    from public.community_works where work_id=v_preset_work_id for update;
    select * into v_gallery_work
    from public.community_works where work_id=v_gallery_work_id for update;

    if v_preset_work.owner_account_id<>v_account_id
       or v_preset_work.work_type<>'preset'
       or v_preset_work.moderation_state<>'clear'
       or v_preset_work.lifecycle_state not in ('published','unpublished') then
      raise exception 'Scene Preset publication is not updateable';
    end if;
    if v_gallery_work.owner_account_id<>v_account_id
       or v_gallery_work.work_type<>'gallery'
       or v_gallery_work.moderation_state<>'clear'
       or v_gallery_work.lifecycle_state not in ('published','unpublished') then
      raise exception 'Associated Gallery Work is not updateable';
    end if;

    if v_media_count=0 then
      select coalesce(array_agg(wrm.media_id order by wrm.ordinal),array[]::uuid[])
      into v_media_ids
      from public.work_revision_media wrm
      where wrm.work_revision_id=v_gallery_work.current_published_revision_id;
      v_media_count:=cardinality(v_media_ids);
      if v_media_count not between 1 and 10 then
        raise exception 'Publish Update requires existing or replacement public image';
      end if;
    end if;

    select coalesce(max(revision_number),0)+1 into v_preset_revision_number
    from public.preset_revisions where preset_artifact_id=v_preset_id;
    select coalesce(max(revision_number),0)+1 into v_preset_work_revision_number
    from public.community_work_revisions where work_id=v_preset_work_id;
    select coalesce(max(revision_number),0)+1 into v_gallery_revision_number
    from public.community_work_revisions where work_id=v_gallery_work_id;
  end if;

  v_preset_revision_id:=gen_random_uuid();
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id
  ) values(
    v_preset_revision_id,v_preset_id,v_preset_revision_number,v_blob_id,
    coalesce(p_metadata,'{}'::jsonb),v_account_id
  );

  v_preset_work_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_preset_work_revision_id,v_preset_work_id,v_preset_work_revision_number,v_account_id,
    jsonb_build_object(
      'title',btrim(p_title),
      'description',p_description,
      'associatedGalleryWorkId',v_gallery_work_id,
      'presetType','scene'
    )
  );
  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
  values(v_preset_work_revision_id,v_preset_revision_id);

  v_gallery_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_gallery_revision_id,v_gallery_work_id,v_gallery_revision_number,v_account_id,
    jsonb_build_object(
      'origin','wand-preset-publication',
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id
    )
  );
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(
    v_gallery_revision_id,btrim(p_title),p_description,
    jsonb_build_object(
      'publicationSource','wand_preset',
      'presetType','scene',
      'presetArtifactId',v_preset_id
    )
  );

  v_ordinal:=0;
  foreach v_media_id in array v_media_ids loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_gallery_revision_id,v_media_id,v_ordinal,'gallery');
    v_ordinal:=v_ordinal+1;
  end loop;

  insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  values(v_gallery_revision_id,v_preset_revision_id);

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      current_published_revision_id=v_preset_work_revision_id,
      published_at=coalesce(published_at,now()),
      updated_at=now()
  where work_id=v_preset_work_id
  returning * into v_preset_work;

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      current_published_revision_id=v_gallery_revision_id,
      published_at=coalesce(published_at,now()),
      updated_at=now()
  where work_id=v_gallery_work_id
  returning * into v_gallery_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_preset_work_id,v_preset_work_id,'preset',p_creator_profile_id,btrim(p_title),
    coalesce(p_description,''),array[]::text[],
    jsonb_build_object(
      'presetType','scene',
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id,
      'galleryWorkId',v_gallery_work_id
    ),
    v_preset_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,
    title=excluded.title,
    text_content=excluded.text_content,
    tags=excluded.tags,
    facets=excluded.facets,
    published_at=excluded.published_at,
    updated_at=now();

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_gallery_work_id,v_gallery_work_id,'gallery',p_creator_profile_id,btrim(p_title),
    coalesce(p_description,''),array[]::text[],
    jsonb_build_object(
      'galleryKind','preset_scene',
      'commentsEnabled',true,
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id
    ),
    v_gallery_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,
    title=excluded.title,
    text_content=excluded.text_content,
    tags=excluded.tags,
    facets=excluded.facets,
    published_at=excluded.published_at,
    updated_at=now();

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_preset_work_id,'work.published',
    jsonb_build_object(
      'workId',v_preset_work_id,
      'revisionId',v_preset_work_revision_id,
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id,
      'galleryWorkId',v_gallery_work_id,
      'galleryRevisionId',v_gallery_revision_id
    ),
    'scene_preset_product.published:' || v_preset_revision_id::text
  );

  v_response:=jsonb_build_object(
    'presetArtifactId',v_preset_id,
    'presetRevisionId',v_preset_revision_id,
    'presetRevisionNumber',v_preset_revision_number,
    'workId',v_preset_work_id,
    'workRevisionId',v_preset_work_revision_id,
    'galleryWorkId',v_gallery_work_id,
    'galleryWorkRevisionId',v_gallery_revision_id,
    'galleryRevisionNumber',v_gallery_revision_number,
    'title',btrim(p_title),
    'mediaIds',to_jsonb(v_media_ids)
  );

  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  return v_response;
end
$$;

create or replace function public.community_get_scene_preset_public_v1(
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_preset public.preset_artifacts%rowtype;
  v_gallery_work public.community_works%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_title text;
  v_description text;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_work_id
    and work_type='preset'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';

  if v_work.work_id is null then
    raise exception 'Scene Preset is not publicly accessible';
  end if;

  select * into v_preset
  from public.preset_artifacts
  where community_work_id=v_work.work_id
    and preset_type='scene';

  if v_preset.preset_artifact_id is null
     or v_preset.associated_gallery_work_id is null then
    raise exception 'Scene Preset publication relationship is unavailable';
  end if;

  select * into v_gallery_work
  from public.community_works
  where work_id=v_preset.associated_gallery_work_id
    and work_type='gallery'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';

  if v_gallery_work.work_id is null then
    raise exception 'Associated Gallery Work is not publicly accessible';
  end if;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id;

  if v_preset_revision.preset_revision_id is null then
    raise exception 'Published Scene Preset revision is unavailable';
  end if;

  select * into v_blob
  from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id
    and purged_at is null;

  if v_blob.blob_id is null then
    raise exception 'Published Scene Preset ArtifactBlob is unavailable';
  end if;

  select
    r.shared_metadata->>'title',
    r.shared_metadata->>'description'
  into v_title,v_description
  from public.community_work_revisions r
  where r.revision_id=v_work.current_published_revision_id;

  select jsonb_build_object(
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
    'galleryWorkId',v_gallery_work.work_id,
    'galleryWorkRevisionId',v_gallery_work.current_published_revision_id,
    'mediaIds',coalesce((
      select jsonb_agg(wrm.media_id order by wrm.ordinal)
      from public.work_revision_media wrm
      where wrm.work_revision_id=v_gallery_work.current_published_revision_id
    ),'[]'::jsonb),
    'publishedAt',v_work.published_at
  ) into v_result;

  return v_result;
end
$$;

create or replace function public.community_unpublish_scene_preset_v1(
  p_auth_subject uuid,
  p_preset_artifact_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(
    hashtextextended(v_account_id::text || ':' || p_idempotency_key,0)
  );
  v_request_hash:=encode(digest(
    concat_ws('|','unpublish_scene_preset_v1',p_preset_artifact_id::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_preset
  from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id
  for update;

  if v_preset.preset_artifact_id is null
     or v_preset.owner_account_id<>v_account_id
     or v_preset.preset_type<>'scene' then
    raise exception 'Owned Scene Preset not found';
  end if;

  if not exists(
    select 1 from public.community_works
    where work_id=v_preset.community_work_id and lifecycle_state='published'
  ) then raise exception 'Scene Preset is not published'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'unpublish_scene_preset_v1',v_request_hash);

  update public.community_works
  set lifecycle_state='unpublished',updated_at=now()
  where work_id in (v_preset.community_work_id,v_preset.associated_gallery_work_id);

  delete from public.search_documents
  where entity_id in (v_preset.community_work_id,v_preset.associated_gallery_work_id);

  v_response:=jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'workId',v_preset.community_work_id,
    'galleryWorkId',v_preset.associated_gallery_work_id,
    'lifecycleState','unpublished'
  );

  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_delete_scene_preset_v1(
  p_auth_subject uuid,
  p_preset_artifact_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(
    hashtextextended(v_account_id::text || ':' || p_idempotency_key,0)
  );
  v_request_hash:=encode(digest(
    concat_ws('|','delete_scene_preset_v1',p_preset_artifact_id::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_preset
  from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id
  for update;

  if v_preset.preset_artifact_id is null
     or v_preset.owner_account_id<>v_account_id
     or v_preset.preset_type<>'scene' then
    raise exception 'Owned Scene Preset not found';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'delete_scene_preset_v1',v_request_hash);

  update public.community_works
  set lifecycle_state='deleted',updated_at=now()
  where work_id in (v_preset.community_work_id,v_preset.associated_gallery_work_id);

  update public.community_entities
  set deleted_at=coalesce(deleted_at,now())
  where entity_id in (
    v_preset.preset_artifact_id,
    v_preset.community_work_id,
    v_preset.associated_gallery_work_id
  );

  delete from public.search_documents
  where entity_id in (v_preset.community_work_id,v_preset.associated_gallery_work_id);

  v_response:=jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'workId',v_preset.community_work_id,
    'galleryWorkId',v_preset.associated_gallery_work_id,
    'lifecycleState','deleted'
  );

  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

revoke execute on function public.guard_preset_artifact_identity()
from public,anon,authenticated;
revoke execute on function public.community_publish_scene_preset_product_v1(
  uuid,uuid,uuid,text,text,text,integer,text,bigint,text,jsonb,uuid[],text
) from public,anon,authenticated;
revoke execute on function public.community_unpublish_scene_preset_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_delete_scene_preset_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_get_scene_preset_public_v1(uuid)
from public,anon,authenticated;

grant execute on function public.community_publish_scene_preset_product_v1(
  uuid,uuid,uuid,text,text,text,integer,text,bigint,text,jsonb,uuid[],text
) to service_role;
grant execute on function public.community_unpublish_scene_preset_v1(uuid,uuid,text)
to service_role;
grant execute on function public.community_delete_scene_preset_v1(uuid,uuid,text)
to service_role;
grant execute on function public.community_get_scene_preset_public_v1(uuid)
to service_role;
