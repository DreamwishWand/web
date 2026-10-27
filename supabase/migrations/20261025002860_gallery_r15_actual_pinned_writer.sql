-- 03 COMM R15: one parser-safe actual pinned Writer function.
-- Existing REAL PUBLIC RPC body, same signature and downstream validation.
create or replace function public.community_publish_gallery_pinned_r15(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_title text,
  p_description text,
  p_media_ids uuid[],
  p_preset_revision_ids uuid[] default array[]::uuid[],
  p_used_item_ids bigint[] default array[]::bigint[],
  p_featured_item_ids bigint[] default array[]::bigint[],
  p_moodboard_snapshot_ref text default null,
  p_idempotency_key text default null,
  p_expected_graph_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_gallery_kind text;
  v_revision_id uuid;
  v_revision_number integer;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_media_id uuid;
  v_preset_revision_id uuid;
  v_item_id bigint;
  v_ordinal integer:=0;
  v_media_count integer;
  v_preset_count integer;
  v_used_count integer;
  v_featured_count integer;
begin
  -- Account root remains the first lock; replays only read committed result.
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if v_account_id is null then raise exception 'R15_ACTOR_NOT_ACTIVE';end if;
  if p_expected_graph_sha256 is null or p_expected_graph_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'R15_EXPECTED_GRAPH_PIN_REQUIRED';end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';end if;
  perform 1 from public.wand_accounts
    where account_id=v_account_id and status='active' and deleted_at is null
    for share;
  if not found or private.resolve_active_account(p_auth_subject) is distinct from v_account_id
    then raise exception 'R15_ACTOR_OR_PRIVACY_STALE';end if;
  v_request_hash:=encode(digest(concat_ws('|',
    'publish_gallery_r15',p_work_id::text,p_expected_version::text,
    btrim(p_title),coalesce(p_description,''),
    array_to_string(p_media_ids,','),
    array_to_string(coalesce(p_preset_revision_ids,array[]::uuid[]),','),
    array_to_string(coalesce(p_used_item_ids,array[]::bigint[]),','),
    array_to_string(coalesce(p_featured_item_ids,array[]::bigint[]),','),
    coalesce(p_moodboard_snapshot_ref,''),p_expected_graph_sha256
  ),'sha256'),'hex');
  -- Check completed same-key/same-pin response before reading the new graph.
  -- Do not acquire an advisory lock ahead of the ordered R14 graph locks.
  select request_hash,response into v_existing_hash,v_response
    from public.idempotency_keys
    where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash or v_response is null
    then raise exception 'R15_IDEMPOTENCY_REQUEST_CONFLICT';end if;
    return v_response;
  end if;
  perform private.gallery_v4_atomic_lock_scoped_r14(
    p_auth_subject,v_account_id,p_work_id,
    coalesce(p_preset_revision_ids,array[]::uuid[])
  );
  if encode(digest(convert_to(private.gallery_r15_canonical_snapshot(
      p_auth_subject,p_work_id,coalesce(p_preset_revision_ids,array[]::uuid[]))::text,
      'UTF8'),'sha256'),'hex')<>p_expected_graph_sha256
  then raise exception 'R15_STALE_GRAPH_TERMINAL';end if;
  v_media_count:=coalesce(cardinality(p_media_ids),0);
  v_preset_count:=coalesce(cardinality(p_preset_revision_ids),0);
  v_used_count:=coalesce(cardinality(p_used_item_ids),0);
  v_featured_count:=coalesce(cardinality(p_featured_item_ids),0);

  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Gallery title must be 1-240 characters';
  end if;
  if p_description is not null and char_length(p_description)>20000 then
    raise exception 'Gallery description exceeds 20000 characters';
  end if;
  if v_media_count not between 1 and 10 then
    raise exception 'Gallery publication requires 1-10 media assets';
  end if;
  if v_preset_count>1 then
    raise exception 'Gallery publication supports at most one Wand Preset';
  end if;
  if v_used_count>200 then
    raise exception 'Gallery publication supports at most 200 Used Items';
  end if;
  if v_featured_count>20 then
    raise exception 'Gallery publication supports at most 20 Featured Items';
  end if;
  if p_moodboard_snapshot_ref is not null
     and char_length(btrim(p_moodboard_snapshot_ref)) not between 1 and 512 then
    raise exception 'Moodboard snapshot reference must be 1-512 characters';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  if (select count(*) from unnest(p_media_ids) x)
     <> (select count(distinct x) from unnest(p_media_ids) x) then
    raise exception 'Gallery media IDs must be unique';
  end if;
  if v_preset_count>0 and
     (select count(*) from unnest(p_preset_revision_ids) x)
     <> (select count(distinct x) from unnest(p_preset_revision_ids) x) then
    raise exception 'Gallery Preset revision IDs must be unique';
  end if;
  if v_used_count>0 and
     (select count(*) from unnest(p_used_item_ids) x)
     <> (select count(distinct x) from unnest(p_used_item_ids) x) then
    raise exception 'Used Item IDs must be unique';
  end if;
  if v_featured_count>0 and
     (select count(*) from unnest(p_featured_item_ids) x)
     <> (select count(distinct x) from unnest(p_featured_item_ids) x) then
    raise exception 'Featured Item IDs must be unique';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_featured_item_ids,array[]::bigint[])) f
    where not (f=any(coalesce(p_used_item_ids,array[]::bigint[])))
  ) then
    raise exception 'Featured Items must be a subset of Used Items';
  end if;
  if exists(select 1 from unnest(coalesce(p_used_item_ids,array[]::bigint[])) x where x<=0) then
    raise exception 'Used Item IDs must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  -- Must exactly match the committed replay hash above.
  v_request_hash:=encode(digest(concat_ws('|',
    'publish_gallery_r15',p_work_id::text,p_expected_version::text,
    btrim(p_title),coalesce(p_description,''),
    array_to_string(p_media_ids,','),
    array_to_string(coalesce(p_preset_revision_ids,array[]::uuid[]),','),
    array_to_string(coalesce(p_used_item_ids,array[]::bigint[]),','),
    array_to_string(coalesce(p_featured_item_ids,array[]::bigint[]),','),
    coalesce(p_moodboard_snapshot_ref,''),p_expected_graph_sha256
  ),'sha256'),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works where work_id=p_work_id for update;
  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.work_type<>'gallery' then raise exception 'Work is not Gallery'; end if;
  if v_work.visibility<>'public' then raise exception 'Gallery launch publication must be PUBLIC'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.moderation_state<>'clear' then raise exception 'Work is moderation-blocked'; end if;
  if v_work.lifecycle_state not in ('draft','unpublished') then
    raise exception 'Work cannot be published from current lifecycle';
  end if;

  select gallery_kind into v_gallery_kind
  from public.gallery_works where work_id=p_work_id;
  if v_gallery_kind is null or v_gallery_kind='dreamsnap' then
    raise exception 'Gallery Golden Vertical excludes DreamSnaps';
  end if;

  foreach v_media_id in array p_media_ids loop
    if not exists(
      select 1 from public.media_assets m
      where m.media_id=v_media_id
        and m.owner_account_id=v_account_id
        and m.processing_state='ready'
        and m.moderation_state='clear'
        and m.purged_at is null
    ) then
      raise exception 'Media asset is not owner-controlled and READY';
    end if;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    if not exists(
      select 1
      from public.preset_revisions pr
      join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
      join public.community_works pw on pw.work_id=pa.community_work_id
      where pr.preset_revision_id=v_preset_revision_id
        and pa.owner_account_id=v_account_id
        and pw.lifecycle_state='published'
        and pw.visibility in ('public','unlisted')
        and pw.moderation_state='clear'
    ) then raise exception 'Preset revision is not an accessible published owner Preset'; end if;
  end loop;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'publish_gallery_v4',v_request_hash);

  select coalesce(max(revision_number),0)+1 into v_revision_number
  from public.community_work_revisions where work_id=p_work_id;

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_revision_id,p_work_id,v_revision_number,v_account_id,
    jsonb_build_object('origin','gallery-golden-v1')
  );

  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(
    v_revision_id,btrim(p_title),p_description,
    jsonb_strip_nulls(jsonb_build_object(
      'moodboardSnapshotRef',nullif(btrim(coalesce(p_moodboard_snapshot_ref,'')),''),
      'usedItemCount',v_used_count,
      'featuredItemCount',v_featured_count
    ))
  );

  foreach v_media_id in array p_media_ids loop
    insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(v_revision_id,v_media_id,v_ordinal,'gallery');
    v_ordinal:=v_ordinal+1;
  end loop;

  foreach v_preset_revision_id in array coalesce(p_preset_revision_ids,array[]::uuid[]) loop
    insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
    values(v_revision_id,v_preset_revision_id);
  end loop;

  foreach v_item_id in array coalesce(p_used_item_ids,array[]::bigint[]) loop
    insert into public.gallery_revision_items(gallery_revision_id,item_id,featured)
    values(
      v_revision_id,v_item_id,
      v_item_id=any(coalesce(p_featured_item_ids,array[]::bigint[]))
    );
  end loop;

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      current_published_revision_id=v_revision_id,
      published_at=now(),
      updated_at=now()
  where work_id=p_work_id
  returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    p_work_id,p_work_id,'gallery',v_work.creator_profile_id,btrim(p_title),coalesce(p_description,''),
    array[]::text[],
    jsonb_build_object('galleryKind',v_gallery_kind,'commentsEnabled',true),
    v_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,
    title=excluded.title,text_content=excluded.text_content,
    tags=excluded.tags,facets=excluded.facets,
    published_at=excluded.published_at,updated_at=now();

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',p_work_id,'work.published',
    jsonb_build_object(
      'workId',p_work_id,'revisionId',v_revision_id,
      'mediaIds',to_jsonb(p_media_ids),
      'presetRevisionIds',to_jsonb(coalesce(p_preset_revision_ids,array[]::uuid[])),
      'usedItemIds',to_jsonb(coalesce(p_used_item_ids,array[]::bigint[])),
      'featuredItemIds',to_jsonb(coalesce(p_featured_item_ids,array[]::bigint[]))
    ),
    'work.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object(
    'workId',p_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version,'visibility','public'
  );
  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;
