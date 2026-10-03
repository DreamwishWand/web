
-- Register media only after the server-side storage adapter has validated the uploaded object.
create or replace function public.community_register_validated_media(
  p_auth_subject uuid,
  p_storage_key text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_checksum_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_media_id uuid;
  v_existing public.media_assets%rowtype;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if p_byte_size <= 0 then raise exception 'Media byte size must be positive'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Unsupported image MIME type';
  end if;
  if p_width is null or p_width <= 0 or p_height is null or p_height <= 0 then
    raise exception 'Image dimensions must be positive';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid SHA-256 checksum';
  end if;

  select * into v_existing
  from public.media_assets
  where storage_key=p_storage_key;

  if v_existing.media_id is not null then
    if v_existing.owner_account_id <> v_account_id
       or v_existing.mime_type <> p_mime_type
       or v_existing.byte_size <> p_byte_size
       or lower(v_existing.checksum_sha256) <> lower(p_checksum_sha256) then
      raise exception 'Storage key already registered with different media metadata';
    end if;
    return jsonb_build_object('mediaId',v_existing.media_id,'replayed',true);
  end if;

  v_media_id := gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type)
  values (v_media_id,'media_asset');

  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
    checksum_sha256,processing_state,moderation_state
  ) values (
    v_media_id,v_account_id,p_storage_key,p_mime_type,p_byte_size,p_width,p_height,
    lower(p_checksum_sha256),'ready','clear'
  );

  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key
  ) values (
    'media_asset',v_media_id,'media.ready',
    jsonb_build_object('mediaId',v_media_id),
    'media.ready:' || v_media_id::text
  );

  return jsonb_build_object('mediaId',v_media_id,'replayed',false);
end;
$$;

create or replace function public.community_publish_gallery_v2(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_title text,
  p_description text,
  p_media_ids uuid[],
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
  v_ordinal integer := 0;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0));

  if p_media_ids is null or coalesce(array_length(p_media_ids,1),0)=0 then
    raise exception 'Gallery publication requires at least one media asset';
  end if;
  if array_length(p_media_ids,1) > 20 then
    raise exception 'Gallery publication media count exceeds staging limit';
  end if;

  v_request_hash := encode(digest(
    concat_ws('|','publish_gallery_v2',p_work_id::text,p_expected_version::text,p_title,
      coalesce(p_description,''),array_to_string(p_media_ids,',')),
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
  if v_work.owner_account_id <> v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.work_type <> 'gallery' then raise exception 'Work is not Gallery'; end if;
  if v_work.row_version <> p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.moderation_state <> 'clear' then raise exception 'Work is moderation-blocked'; end if;
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

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'publish_gallery_v2',v_request_hash);

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
    v_ordinal := v_ordinal + 1;
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
      'mediaIds',to_jsonb(p_media_ids)
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

-- Keep the old RPC in migration history for reproducibility but remove it from the active server path.
revoke execute on function public.community_publish_gallery(uuid,uuid,bigint,text,text,text)
from service_role, public, anon, authenticated;

revoke execute on function public.community_register_validated_media(uuid,text,text,bigint,integer,integer,text)
from public, anon, authenticated;
revoke execute on function public.community_publish_gallery_v2(uuid,uuid,bigint,text,text,uuid[],text)
from public, anon, authenticated;

grant execute on function public.community_register_validated_media(uuid,text,text,bigint,integer,integer,text)
to service_role;
grant execute on function public.community_publish_gallery_v2(uuid,uuid,bigint,text,text,uuid[],text)
to service_role;
