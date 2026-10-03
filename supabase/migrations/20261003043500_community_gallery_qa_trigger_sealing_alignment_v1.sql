-- Final revision-sealing integration: compose unsealed child rows, then let the existing
-- community_works current_published_revision trigger seal the revision atomically.

create or replace function public.community_publish_gallery_v4(
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
  p_idempotency_key text default null
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
  v_account_id:=private.resolve_active_account(p_auth_subject);
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
  v_request_hash:=encode(digest(
    concat_ws('|',
      'publish_gallery_v4',p_work_id::text,p_expected_version::text,btrim(p_title),coalesce(p_description,''),
      array_to_string(p_media_ids,','),
      array_to_string(coalesce(p_preset_revision_ids,array[]::uuid[]),','),
      array_to_string(coalesce(p_used_item_ids,array[]::bigint[]),','),
      array_to_string(coalesce(p_featured_item_ids,array[]::bigint[]),','),
      coalesce(p_moodboard_snapshot_ref,'')
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
end
$$;

create or replace function public.community_ask_question_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_title text,
  p_body text,
  p_context_tags text[],
  p_platform text default null,
  p_game_version text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_revision_id uuid;
  v_work public.community_works%rowtype;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Question title must be 1-240 characters';
  end if;
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 20000 then
    raise exception 'Question body must be 1-20000 characters';
  end if;
  if p_context_tags is null or cardinality(p_context_tags) not between 1 and 20 then
    raise exception 'Question requires 1-20 structured Context Tags';
  end if;
  if exists(select 1 from unnest(p_context_tags) t where t is null or btrim(t)='') then
    raise exception 'Context Tags cannot be empty';
  end if;
  if (select count(*) from unnest(p_context_tags) t)
     <> (select count(distinct t) from unnest(p_context_tags) t) then
    raise exception 'Context Tags must be unique';
  end if;
  if p_platform is not null and char_length(btrim(p_platform))>80 then
    raise exception 'Platform value exceeds 80 characters';
  end if;
  if p_game_version is not null and char_length(btrim(p_game_version))>80 then
    raise exception 'Game version value exceeds 80 characters';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
  ) then raise exception 'CreatorProfile is not owned by actor or is unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','ask_question_v1',p_creator_profile_id::text,btrim(p_title),btrim(p_body),
      array_to_string(p_context_tags,','),coalesce(p_platform,''),coalesce(p_game_version,'')
    ),'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'ask_question_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values(v_work_id,'community_work');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(v_work_id,v_account_id,p_creator_profile_id,'question','draft','public');
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,private.community_origin_kind_for_account(v_account_id));

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_revision_id,v_work_id,1,v_account_id,
    jsonb_build_object('origin','qa-golden-v1')
  );
  insert into public.qa_question_revisions(
    revision_id,title,body,context_tags,platform,game_version
  ) values(
    v_revision_id,btrim(p_title),btrim(p_body),p_context_tags,
    nullif(btrim(coalesce(p_platform,'')),''),
    nullif(btrim(coalesce(p_game_version,'')),'')
  );
  insert into public.qa_question_state(work_id) values(v_work_id);

  update public.community_works
  set lifecycle_state='published',
      current_published_revision_id=v_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_work_id returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_work_id,v_work_id,'question',p_creator_profile_id,btrim(p_title),btrim(p_body),p_context_tags,
    jsonb_strip_nulls(jsonb_build_object(
      'freshness','current','resolutionState','unresolved',
      'platform',nullif(btrim(coalesce(p_platform,'')),''),
      'gameVersion',nullif(btrim(coalesce(p_game_version,'')),'')
    )),
    v_work.published_at,now()
  );

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_work_id,'question.published',
    jsonb_build_object('questionId',v_work_id,'revisionId',v_revision_id,'contextTags',to_jsonb(p_context_tags)),
    'question.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object(
    'questionId',v_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_create_tip_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_title text,
  p_body text,
  p_context_tags text[] default null,
  p_platform text default null,
  p_game_version text default null,
  p_source_question_id uuid default null,
  p_source_answer_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_revision_id uuid;
  v_work public.community_works%rowtype;
  v_tags text[];
  v_platform text;
  v_game_version text;
  v_source_question uuid;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Tip title must be 1-240 characters';
  end if;
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 20000 then
    raise exception 'Tip body must be 1-20000 characters';
  end if;
  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;

  v_tags:=p_context_tags;
  v_platform:=nullif(btrim(coalesce(p_platform,'')),'');
  v_game_version:=nullif(btrim(coalesce(p_game_version,'')),'');
  v_source_question:=p_source_question_id;

  if p_source_answer_id is not null then
    select a.question_id,qr.context_tags,qr.platform,qr.game_version
    into v_source_question,v_tags,v_platform,v_game_version
    from public.qa_answers a
    join public.comments c on c.comment_id=a.answer_id
    join public.community_works qw on qw.work_id=a.question_id
    join public.qa_question_revisions qr on qr.revision_id=qw.current_published_revision_id
    where a.answer_id=p_source_answer_id
      and c.author_account_id=v_account_id
      and c.lifecycle_state<>'deleted';
    if v_source_question is null then
      raise exception 'Only the Answer author may Create Tip from this Answer';
    end if;
    if p_source_question_id is not null and p_source_question_id<>v_source_question then
      raise exception 'Source Question does not match Answer';
    end if;
  end if;

  if v_tags is null or cardinality(v_tags) not between 1 and 20 then
    raise exception 'Tip requires 1-20 structured Context Tags';
  end if;
  if exists(select 1 from unnest(v_tags) t where t is null or btrim(t)='') then
    raise exception 'Context Tags cannot be empty';
  end if;
  if (select count(*) from unnest(v_tags) t)
     <> (select count(distinct t) from unnest(v_tags) t) then
    raise exception 'Context Tags must be unique';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','create_tip_v1',p_creator_profile_id::text,btrim(p_title),btrim(p_body),
      array_to_string(v_tags,','),coalesce(v_platform,''),coalesce(v_game_version,''),
      coalesce(v_source_question::text,''),coalesce(p_source_answer_id::text,'')
    ),'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'create_tip_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values(v_work_id,'community_work');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(v_work_id,v_account_id,p_creator_profile_id,'tip','draft','public');
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,private.community_origin_kind_for_account(v_account_id));

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_revision_id,v_work_id,1,v_account_id,jsonb_build_object('origin','qa-golden-v1')
  );
  insert into public.qa_tip_revisions(
    revision_id,title,body,context_tags,platform,game_version,source_question_id,source_answer_id
  ) values(
    v_revision_id,btrim(p_title),btrim(p_body),v_tags,v_platform,v_game_version,
    v_source_question,p_source_answer_id
  );
  insert into public.qa_tip_state(work_id) values(v_work_id);

  update public.community_works
  set lifecycle_state='published',current_published_revision_id=v_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_work_id returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_work_id,v_work_id,'tip',p_creator_profile_id,btrim(p_title),btrim(p_body),v_tags,
    jsonb_strip_nulls(jsonb_build_object(
      'freshness','current','platform',v_platform,'gameVersion',v_game_version,
      'sourceQuestionId',v_source_question,'sourceAnswerId',p_source_answer_id
    )),v_work.published_at,now()
  );

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_work_id,'tip.published',
    jsonb_build_object(
      'tipId',v_work_id,'revisionId',v_revision_id,
      'sourceQuestionId',v_source_question,'sourceAnswerId',p_source_answer_id
    ),
    'tip.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object('tipId',v_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;
