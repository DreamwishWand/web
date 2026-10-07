-- 09 INT Scene Wand Preset product vertical.
-- Additive composition over existing Community PresetArtifact/PresetRevision and Gallery revision primitives.
-- Community never interprets WEP payload bytes; WEP validates Scene bytes before this RPC is invoked.

alter table public.gallery_works
  drop constraint if exists gallery_works_gallery_kind_check;
alter table public.gallery_works
  add constraint gallery_works_gallery_kind_check
  check (gallery_kind in ('outdoor','indoor','dreamsnap','tom_furniture','tom_clothing','scene_preset'));

create table if not exists public.preset_gallery_work_links (
  preset_artifact_id uuid primary key references public.preset_artifacts(preset_artifact_id),
  gallery_work_id uuid not null unique references public.gallery_works(work_id),
  created_at timestamptz not null default now()
);

alter table public.preset_gallery_work_links enable row level security;

create or replace function public.community_publish_scene_preset_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_preset_artifact_id uuid,
  p_expected_preset_revision_id uuid,
  p_title text,
  p_description text,
  p_media_ids uuid[],
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
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_existing_hash text;
  v_request_hash text;
  v_response jsonb;
  v_preset_id uuid;
  v_preset_work_id uuid;
  v_gallery_work_id uuid;
  v_blob_id uuid;
  v_preset_revision_id uuid;
  v_preset_work_revision_id uuid;
  v_gallery_revision_id uuid;
  v_preset_revision_number integer;
  v_preset_work_revision_number integer;
  v_gallery_revision_number integer;
  v_current_preset_revision_id uuid;
  v_media_id uuid;
  v_ordinal integer:=0;
  v_preset_work public.community_works%rowtype;
  v_gallery_work public.community_works%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Scene Preset public title must be 1-240 characters';
  end if;
  if p_description is not null and char_length(p_description)>20000 then
    raise exception 'Scene Preset description exceeds 20000 characters';
  end if;
  if coalesce(cardinality(p_media_ids),0) not between 1 and 10 then
    raise exception 'Scene Preset publication requires 1-10 public images';
  end if;
  if (select count(*) from unnest(p_media_ids) x)
     <> (select count(distinct x) from unnest(p_media_ids) x) then
    raise exception 'Scene Preset media IDs must be unique';
  end if;
  if p_schema_version<>1 then
    raise exception 'Unsupported Scene Preset schema version';
  end if;
  if p_content_type<>'application/json' then
    raise exception 'Scene Preset content type must be application/json';
  end if;
  if p_byte_size<=0 then raise exception 'Scene Preset artifact byte size must be positive'; end if;
  if coalesce(length(btrim(p_artifact_storage_key)),0)=0 then
    raise exception 'Scene Preset artifact storage key is required';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid Scene Preset SHA-256 checksum';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;
  if (p_preset_artifact_id is null) <> (p_expected_preset_revision_id is null) then
    raise exception 'Publish Update requires both PresetArtifact and expected revision IDs';
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
  ) then raise exception 'CreatorProfile is not owned by actor or is unavailable'; end if;

  foreach v_media_id in array p_media_ids loop
    if not exists(
      select 1 from public.media_assets m
      where m.media_id=v_media_id
        and m.owner_account_id=v_account_id
        and m.processing_state='ready'
        and m.moderation_state='clear'
        and m.purged_at is null
    ) then raise exception 'Scene Preset public media is not owner-controlled and READY'; end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|',
      'publish_scene_preset_v1',
      p_creator_profile_id::text,
      coalesce(p_preset_artifact_id::text,''),
      coalesce(p_expected_preset_revision_id::text,''),
      btrim(p_title),coalesce(p_description,''),
      array_to_string(p_media_ids,','),
      p_artifact_storage_key,p_schema_version::text,p_content_type,p_byte_size::text,
      lower(p_checksum_sha256),coalesce(p_metadata,'{}'::jsonb)::text
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

  if p_preset_artifact_id is null then
    v_preset_id:=gen_random_uuid();
    v_preset_work_id:=gen_random_uuid();
    v_gallery_work_id:=gen_random_uuid();

    insert into public.community_entities(entity_id,entity_type) values
      (v_preset_id,'preset_artifact'),
      (v_preset_work_id,'community_work'),
      (v_gallery_work_id,'community_work');

    insert into public.community_works(
      work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
    ) values(
      v_preset_work_id,v_account_id,p_creator_profile_id,'preset','draft','public'
    );

    insert into public.preset_artifacts(
      preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type
    ) values(
      v_preset_id,v_account_id,p_creator_profile_id,v_preset_work_id,'scene'
    );

    insert into public.community_works(
      work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
    ) values(
      v_gallery_work_id,v_account_id,p_creator_profile_id,'gallery','draft','public'
    );
    insert into public.gallery_works(work_id,gallery_kind)
    values(v_gallery_work_id,'scene_preset');
    insert into public.gallery_work_settings(work_id,comments_enabled)
    values(v_gallery_work_id,true);
    insert into public.preset_gallery_work_links(preset_artifact_id,gallery_work_id)
    values(v_preset_id,v_gallery_work_id);

    insert into public.community_entity_origins(entity_id,origin_kind) values
      (v_preset_id,private.community_origin_kind_for_account(v_account_id)),
      (v_preset_work_id,private.community_origin_kind_for_account(v_account_id)),
      (v_gallery_work_id,private.community_origin_kind_for_account(v_account_id));

    v_preset_revision_number:=1;
    v_preset_work_revision_number:=1;
    v_gallery_revision_number:=1;
  else
    select pa.preset_artifact_id,pa.community_work_id,l.gallery_work_id
      into v_preset_id,v_preset_work_id,v_gallery_work_id
    from public.preset_artifacts pa
    join public.preset_gallery_work_links l
      on l.preset_artifact_id=pa.preset_artifact_id
    where pa.preset_artifact_id=p_preset_artifact_id
      and pa.owner_account_id=v_account_id
      and pa.creator_profile_id=p_creator_profile_id
      and pa.preset_type='scene';

    if v_preset_id is null then raise exception 'Scene Preset is not owned by actor'; end if;

    select * into v_preset_work
    from public.community_works where work_id=v_preset_work_id for update;
    select * into v_gallery_work
    from public.community_works where work_id=v_gallery_work_id for update;

    if v_preset_work.work_id is null or v_gallery_work.work_id is null then
      raise exception 'Scene Preset publication relationship is incomplete';
    end if;
    if v_preset_work.owner_account_id<>v_account_id or v_gallery_work.owner_account_id<>v_account_id
       or v_preset_work.creator_profile_id<>p_creator_profile_id
       or v_gallery_work.creator_profile_id<>p_creator_profile_id then
      raise exception 'Scene Preset publication relationship ownership mismatch';
    end if;
    if v_preset_work.work_type<>'preset' or v_gallery_work.work_type<>'gallery' then
      raise exception 'Scene Preset publication relationship type mismatch';
    end if;
    if v_preset_work.lifecycle_state='deleted' or v_gallery_work.lifecycle_state='deleted' then
      raise exception 'Deleted Scene Preset cannot be republished';
    end if;
    if v_preset_work.moderation_state<>'clear' or v_gallery_work.moderation_state<>'clear' then
      raise exception 'Scene Preset publication is moderation-blocked';
    end if;

    select pp.preset_revision_id into v_current_preset_revision_id
    from public.preset_revision_publications pp
    where pp.work_revision_id=v_preset_work.current_published_revision_id;

    if v_current_preset_revision_id is distinct from p_expected_preset_revision_id then
      raise exception 'Scene Preset published revision changed';
    end if;

    select coalesce(max(revision_number),0)+1 into v_preset_revision_number
    from public.preset_revisions where preset_artifact_id=v_preset_id;
    select coalesce(max(revision_number),0)+1 into v_preset_work_revision_number
    from public.community_work_revisions where work_id=v_preset_work_id;
    select coalesce(max(revision_number),0)+1 into v_gallery_revision_number
    from public.community_work_revisions where work_id=v_gallery_work_id;
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'publish_scene_preset_v1',v_request_hash);

  v_blob_id:=gen_random_uuid();
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256
  ) values(
    v_blob_id,v_account_id,p_artifact_storage_key,p_schema_version,p_content_type,p_byte_size,
    lower(p_checksum_sha256)
  );

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
      'galleryWorkId',v_gallery_work_id,
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
      'origin','scene-preset-publication',
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id
    )
  );
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(
    v_gallery_revision_id,btrim(p_title),p_description,
    jsonb_build_object(
      'origin','scene-preset-publication',
      'presetArtifactId',v_preset_id,
      'presetRevisionId',v_preset_revision_id
    )
  );

  v_ordinal:=0;
  foreach v_media_id in array p_media_ids loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_gallery_revision_id,v_media_id,v_ordinal,'gallery');
    v_ordinal:=v_ordinal+1;
  end loop;
  insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  values(v_gallery_revision_id,v_preset_revision_id);

  update public.community_works
  set lifecycle_state='published',visibility='public',
      current_published_revision_id=v_preset_work_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_preset_work_id
  returning * into v_preset_work;

  update public.community_works
  set lifecycle_state='published',visibility='public',
      current_published_revision_id=v_gallery_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_gallery_work_id
  returning * into v_gallery_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_preset_work_id,v_preset_work_id,'preset',p_creator_profile_id,btrim(p_title),coalesce(p_description,''),
    array[]::text[],
    jsonb_build_object('presetType','scene','presetArtifactId',v_preset_id,'galleryWorkId',v_gallery_work_id),
    v_preset_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,title=excluded.title,
    text_content=excluded.text_content,tags=excluded.tags,facets=excluded.facets,
    published_at=excluded.published_at,updated_at=now();

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_gallery_work_id,v_gallery_work_id,'gallery',p_creator_profile_id,btrim(p_title),coalesce(p_description,''),
    array[]::text[],
    jsonb_build_object('galleryKind','scene_preset','presetArtifactId',v_preset_id,'presetWorkId',v_preset_work_id,'commentsEnabled',true),
    v_gallery_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,title=excluded.title,
    text_content=excluded.text_content,tags=excluded.tags,facets=excluded.facets,
    published_at=excluded.published_at,updated_at=now();

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_preset_work_id,
    case when p_preset_artifact_id is null then 'work.published' else 'work.publish_updated' end,
    jsonb_build_object(
      'workId',v_preset_work_id,'revisionId',v_preset_work_revision_id,
      'presetArtifactId',v_preset_id,'presetRevisionId',v_preset_revision_id,
      'galleryWorkId',v_gallery_work_id,'galleryRevisionId',v_gallery_revision_id
    ),
    'scene-preset.published:' || v_preset_work_revision_id::text
  );
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_gallery_work_id,'work.published',
    jsonb_build_object(
      'workId',v_gallery_work_id,'revisionId',v_gallery_revision_id,
      'presetArtifactId',v_preset_id,'presetRevisionId',v_preset_revision_id
    ),
    'scene-preset.gallery-published:' || v_gallery_revision_id::text
  );

  v_response:=jsonb_build_object(
    'presetArtifactId',v_preset_id,
    'presetRevisionId',v_preset_revision_id,
    'presetWorkId',v_preset_work_id,
    'presetWorkRevisionId',v_preset_work_revision_id,
    'galleryWorkId',v_gallery_work_id,
    'galleryRevisionId',v_gallery_revision_id,
    'revisionNumber',v_preset_revision_number
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
  v_preset_revision public.preset_revisions%rowtype;
  v_gallery_work public.community_works%rowtype;
  v_gallery_revision_id uuid;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_work_id
    and work_type='preset'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';
  if v_work.work_id is null then raise exception 'Scene Preset is not publicly accessible'; end if;

  select * into v_preset
  from public.preset_artifacts
  where community_work_id=v_work.work_id and preset_type='scene';
  if v_preset.preset_artifact_id is null then raise exception 'Scene Preset identity is unavailable'; end if;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id;
  if v_preset_revision.preset_revision_id is null then
    raise exception 'Scene Preset published revision is unavailable';
  end if;

  select gw.* into v_gallery_work
  from public.preset_gallery_work_links l
  join public.community_works gw on gw.work_id=l.gallery_work_id
  where l.preset_artifact_id=v_preset.preset_artifact_id
    and gw.work_type='gallery'
    and gw.lifecycle_state='published'
    and gw.visibility='public'
    and gw.moderation_state='clear';
  if v_gallery_work.work_id is null then
    raise exception 'Associated Gallery Work is not publicly accessible';
  end if;

  v_gallery_revision_id:=v_gallery_work.current_published_revision_id;
  if not exists(
    select 1 from public.gallery_revision_presets gp
    where gp.gallery_revision_id=v_gallery_revision_id
      and gp.preset_revision_id=v_preset_revision.preset_revision_id
  ) then raise exception 'Associated Gallery Work does not reference current Scene Preset revision'; end if;

  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','preset',
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetType','scene',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',cwr.shared_metadata->>'title',
    'description',cwr.shared_metadata->>'description',
    'metadata',v_preset_revision.metadata,
    'publishedAt',v_work.published_at,
    'galleryWorkId',v_gallery_work.work_id,
    'galleryRevisionId',v_gallery_revision_id,
    'mediaIds',coalesce((
      select jsonb_agg(m.media_id order by m.ordinal)
      from public.work_revision_media m
      where m.work_revision_id=v_gallery_revision_id
    ),'[]'::jsonb)
  ) into v_result
  from public.community_work_revisions cwr
  where cwr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

create or replace function public.community_get_preset(
  p_auth_subject uuid,
  p_preset_artifact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_preset public.preset_artifacts%rowtype;
  v_work public.community_works%rowtype;
  v_preset_revision public.preset_revisions%rowtype;
  v_blob public.artifact_blobs%rowtype;
  v_title text;
  v_description text;
  v_gallery_work_id uuid;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_entity(p_preset_artifact_id,v_account_id) then
    raise exception 'Preset is not accessible';
  end if;

  select * into v_preset from public.preset_artifacts
  where preset_artifact_id=p_preset_artifact_id;
  select * into v_work from public.community_works
  where work_id=v_preset.community_work_id;
  if v_work.current_published_revision_id is null then
    raise exception 'Preset has no published revision';
  end if;

  select pr.* into v_preset_revision
  from public.preset_revision_publications pp
  join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
  where pp.work_revision_id=v_work.current_published_revision_id;
  select * into v_blob from public.artifact_blobs
  where blob_id=v_preset_revision.artifact_blob_id and purged_at is null;
  if v_blob.blob_id is null then raise exception 'Preset artifact blob is unavailable'; end if;

  select cwr.shared_metadata->>'title',cwr.shared_metadata->>'description'
    into v_title,v_description
  from public.community_work_revisions cwr
  where cwr.revision_id=v_work.current_published_revision_id;

  select gallery_work_id into v_gallery_work_id
  from public.preset_gallery_work_links
  where preset_artifact_id=v_preset.preset_artifact_id;

  return jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',v_preset_revision.preset_revision_id,
    'presetType',v_preset.preset_type,
    'workId',v_work.work_id,
    'workRevisionId',v_work.current_published_revision_id,
    'galleryWorkId',v_gallery_work_id,
    'title',v_title,
    'description',v_description,
    'blobId',v_blob.blob_id,
    'storageKey',v_blob.storage_key,
    'schemaVersion',v_blob.schema_version,
    'contentType',v_blob.content_type,
    'byteSize',v_blob.byte_size,
    'checksumSha256',v_blob.checksum_sha256,
    'metadata',v_preset_revision.metadata
  );
end
$$;

create or replace function public.community_scene_preset_lifecycle_v1(
  p_auth_subject uuid,
  p_preset_artifact_id uuid,
  p_expected_preset_revision_id uuid,
  p_action text,
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
  v_current_revision_id uuid;
  v_existing_hash text;
  v_request_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if p_action not in ('unpublish','delete') then raise exception 'Unsupported Scene Preset lifecycle action'; end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','scene_preset_lifecycle_v1',p_preset_artifact_id::text,p_expected_preset_revision_id::text,p_action),
    'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select pa.* into v_preset
  from public.preset_artifacts pa
  where pa.preset_artifact_id=p_preset_artifact_id
    and pa.owner_account_id=v_account_id
    and pa.preset_type='scene';
  if v_preset.preset_artifact_id is null then raise exception 'Scene Preset is not owned by actor'; end if;

  select * into v_preset_work
  from public.community_works where work_id=v_preset.community_work_id for update;
  select gw.* into v_gallery_work
  from public.preset_gallery_work_links l
  join public.community_works gw on gw.work_id=l.gallery_work_id
  where l.preset_artifact_id=v_preset.preset_artifact_id
  for update;
  if v_gallery_work.work_id is null then raise exception 'Associated Gallery Work is unavailable'; end if;

  select pp.preset_revision_id into v_current_revision_id
  from public.preset_revision_publications pp
  where pp.work_revision_id=v_preset_work.current_published_revision_id;
  if v_current_revision_id is distinct from p_expected_preset_revision_id then
    raise exception 'Scene Preset published revision changed';
  end if;

  if p_action='unpublish' then
    if v_preset_work.lifecycle_state<>'published' or v_gallery_work.lifecycle_state<>'published' then
      raise exception 'Scene Preset and associated Gallery Work must both be published';
    end if;
  else
    if v_preset_work.lifecycle_state='deleted' or v_gallery_work.lifecycle_state='deleted' then
      raise exception 'Scene Preset is already deleted';
    end if;
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'scene_preset_lifecycle_v1',v_request_hash);

  if p_action='unpublish' then
    update public.community_works set lifecycle_state='unpublished',updated_at=now()
    where work_id in (v_preset_work.work_id,v_gallery_work.work_id);
  else
    update public.community_works set lifecycle_state='deleted',updated_at=now()
    where work_id in (v_preset_work.work_id,v_gallery_work.work_id);
    update public.community_entities set deleted_at=coalesce(deleted_at,now())
    where entity_id in (v_preset.preset_artifact_id,v_preset_work.work_id,v_gallery_work.work_id);
  end if;

  delete from public.search_documents
  where entity_id in (v_preset_work.work_id,v_gallery_work.work_id);

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_preset_work.work_id,
    case when p_action='unpublish' then 'work.unpublished' else 'work.deleted' end,
    jsonb_build_object(
      'workId',v_preset_work.work_id,'presetArtifactId',v_preset.preset_artifact_id,
      'galleryWorkId',v_gallery_work.work_id
    ),
    'scene-preset.' || p_action || ':' || v_preset_work.work_id::text || ':' || p_expected_preset_revision_id::text
  );

  v_response:=jsonb_build_object(
    'presetArtifactId',v_preset.preset_artifact_id,
    'presetRevisionId',p_expected_preset_revision_id,
    'presetWorkId',v_preset_work.work_id,
    'galleryWorkId',v_gallery_work.work_id,
    'lifecycleState',case when p_action='unpublish' then 'unpublished' else 'deleted' end
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

revoke all on public.preset_gallery_work_links from public,anon,authenticated;
revoke execute on function public.community_publish_scene_preset_v1(
  uuid,uuid,uuid,uuid,text,text,uuid[],text,integer,text,bigint,text,jsonb,text
) from public,anon,authenticated;
revoke execute on function public.community_get_scene_preset_public_v1(uuid)
from public,anon,authenticated;
revoke execute on function public.community_get_preset(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_scene_preset_lifecycle_v1(uuid,uuid,uuid,text,text)
from public,anon,authenticated;

grant select on public.preset_gallery_work_links to service_role;
grant execute on function public.community_publish_scene_preset_v1(
  uuid,uuid,uuid,uuid,text,text,uuid[],text,integer,text,bigint,text,jsonb,text
) to service_role;
grant execute on function public.community_get_scene_preset_public_v1(uuid)
to service_role;
grant execute on function public.community_get_preset(uuid,uuid)
to service_role;
grant execute on function public.community_scene_preset_lifecycle_v1(uuid,uuid,uuid,text,text)
to service_role;
