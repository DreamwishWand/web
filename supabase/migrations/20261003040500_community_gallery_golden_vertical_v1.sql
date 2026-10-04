
create or replace function public.community_create_gallery_work_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_gallery_kind text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if p_gallery_kind not in ('outdoor','indoor','tom_furniture','tom_clothing') then
    raise exception 'Unsupported ordinary Gallery kind';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','create_gallery_work_v1',p_creator_profile_id::text,p_gallery_kind),
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

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
  ) then raise exception 'CreatorProfile is not owned by actor or is unavailable'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'create_gallery_work_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type)
  values(v_work_id,'community_work');

  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(
    v_work_id,v_account_id,p_creator_profile_id,'gallery','draft','public'
  );

  insert into public.gallery_works(work_id,gallery_kind)
  values(v_work_id,p_gallery_kind);

  insert into public.gallery_work_settings(work_id,comments_enabled)
  values(v_work_id,true);

  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,private.community_origin_kind_for_account(v_account_id));

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_work_id,'work.compose_created',
    jsonb_build_object('workId',v_work_id,'workType','gallery','visibility','public'),
    'work.compose_created:' || v_work_id::text
  );

  select jsonb_build_object('workId',v_work_id,'rowVersion',row_version)
  into v_response
  from public.community_works where work_id=v_work_id;

  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

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
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata,sealed_at
  ) values(
    v_revision_id,p_work_id,v_revision_number,v_account_id,
    jsonb_build_object('origin','gallery-golden-v1'),now()
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

create or replace function public.community_add_comment_v2(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_target_entity_id uuid,
  p_parent_comment_id uuid,
  p_body text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_comment_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 10000 then
    raise exception 'Comment body must be 1-10000 characters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','add_comment_v2',p_creator_profile_id::text,p_target_entity_id::text,
      coalesce(p_parent_comment_id::text,''),btrim(p_body)
    ),'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;
  if not private.can_access_entity(p_target_entity_id,v_account_id) then
    raise exception 'Target is not accessible';
  end if;

  if exists(
    select 1 from public.community_works w
    where w.work_id=p_target_entity_id and w.work_type='gallery'
  ) and not coalesce((
    select s.comments_enabled from public.gallery_work_settings s
    where s.work_id=p_target_entity_id
  ),true) then
    raise exception 'Comments are disabled for this Gallery Work';
  end if;

  if p_parent_comment_id is not null and not exists(
    select 1 from public.comments c
    where c.comment_id=p_parent_comment_id
      and c.target_entity_id=p_target_entity_id
      and c.lifecycle_state<>'deleted'
      and c.moderation_state='clear'
  ) then raise exception 'Parent comment is unavailable or belongs to a different target'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'add_comment_v2',v_request_hash);

  v_comment_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type)
  values(v_comment_id,'comment');
  insert into public.comments(
    comment_id,target_entity_id,author_account_id,creator_profile_id,parent_comment_id,body
  ) values(
    v_comment_id,p_target_entity_id,v_account_id,p_creator_profile_id,p_parent_comment_id,btrim(p_body)
  );
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_comment_id,private.community_origin_kind_for_account(v_account_id));

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'comment',v_comment_id,
    case when p_parent_comment_id is null then 'comment.created' else 'comment.replied' end,
    jsonb_build_object(
      'commentId',v_comment_id,'targetEntityId',p_target_entity_id,
      'actorAccountId',v_account_id,'parentCommentId',p_parent_comment_id
    ),
    'comment.created:' || v_comment_id::text
  );

  v_response:=jsonb_build_object('commentId',v_comment_id);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_set_gallery_comments_enabled_v1(
  p_auth_subject uuid,
  p_work_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not exists(
    select 1 from public.community_works
    where work_id=p_work_id and work_type='gallery' and owner_account_id=v_account_id
  ) then raise exception 'Actor does not own Gallery Work'; end if;

  insert into public.gallery_work_settings(work_id,comments_enabled,updated_at)
  values(p_work_id,p_enabled,now())
  on conflict(work_id) do update
  set comments_enabled=excluded.comments_enabled,updated_at=now();

  update public.search_documents
  set facets=facets || jsonb_build_object('commentsEnabled',p_enabled),updated_at=now()
  where work_id=p_work_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(v_account_id,'gallery.comments_enabled',p_work_id,jsonb_build_object('enabled',p_enabled));

  return jsonb_build_object('workId',p_work_id,'commentsEnabled',p_enabled);
end
$$;

create or replace function public.community_gallery_author_remove_comment_v1(
  p_auth_subject uuid,
  p_work_id uuid,
  p_comment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_changed boolean:=false;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not exists(
    select 1 from public.community_works
    where work_id=p_work_id and work_type='gallery' and owner_account_id=v_account_id
  ) then raise exception 'Actor does not own Gallery Work'; end if;
  if coalesce(char_length(btrim(p_reason)),0) not between 3 and 500 then
    raise exception 'Removal reason must be 3-500 characters';
  end if;

  update public.comments
  set lifecycle_state='deleted',updated_at=now(),row_version=row_version+1
  where comment_id=p_comment_id
    and target_entity_id=p_work_id
    and lifecycle_state<>'deleted'
  returning true into v_changed;

  if not coalesce(v_changed,false) then raise exception 'Comment not found or already removed'; end if;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'gallery.comment_author_removed',p_comment_id,
    jsonb_build_object('workId',p_work_id,'reason',btrim(p_reason))
  );
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'comment',p_comment_id,'comment.author_removed',
    jsonb_build_object('commentId',p_comment_id,'workId',p_work_id),
    'comment.author_removed:' || p_comment_id::text
  ) on conflict(dedupe_key) do nothing;

  return jsonb_build_object('commentId',p_comment_id,'removed',true);
end
$$;

create or replace function public.community_get_creator_public_v1(p_creator_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'creatorProfileId',c.creator_profile_id,
    'handle',c.handle,
    'displayName',c.display_name,
    'avatarMediaId',c.avatar_media_id,
    'bio',c.bio
  ) into v_result
  from public.creator_profiles c
  where c.creator_profile_id=p_creator_profile_id
    and c.profile_visibility='public'
    and c.moderation_state='clear';

  if v_result is null then raise exception 'Creator Profile is not publicly accessible'; end if;
  return v_result;
end
$$;

create or replace function public.community_get_gallery_public_v1(p_work_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  if not private.is_discoverable_work(p_work_id) then
    raise exception 'Gallery Work is not publicly accessible';
  end if;
  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='gallery';
  if v_work.work_id is null then raise exception 'Gallery Work not found'; end if;

  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','gallery',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'galleryKind',g.gallery_kind,
    'title',r.title,
    'description',r.description,
    'metadata',r.metadata,
    'publishedAt',v_work.published_at,
    'commentsEnabled',coalesce(s.comments_enabled,true),
    'mediaIds',coalesce((
      select jsonb_agg(m.media_id order by m.ordinal)
      from public.work_revision_media m
      where m.work_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'presetRevisionIds',coalesce((
      select jsonb_agg(p.preset_revision_id order by p.preset_revision_id)
      from public.gallery_revision_presets p
      where p.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'usedItems',coalesce((
      select jsonb_agg(
        jsonb_build_object('itemId',i.item_id,'featured',i.featured)
        order by i.featured desc,i.item_id
      )
      from public.gallery_revision_items i
      where i.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'reactionKinds',coalesce((
      select jsonb_agg(x.reaction_kind order by x.reaction_kind)
      from (
        select distinct reaction_kind
        from public.reactions
        where target_entity_id=p_work_id
      ) x
    ),'[]'::jsonb),
    'comments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'commentId',c.comment_id,
          'creatorProfileId',c.creator_profile_id,
          'parentCommentId',c.parent_comment_id,
          'body',c.body,
          'createdAt',c.created_at
        ) order by c.created_at,c.comment_id
      )
      from public.comments c
      where c.target_entity_id=p_work_id
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
    ),'[]'::jsonb)
  ) into v_result
  from public.gallery_works g
  join public.gallery_work_revisions r
    on r.revision_id=v_work.current_published_revision_id
  left join public.gallery_work_settings s on s.work_id=v_work.work_id
  where g.work_id=v_work.work_id;

  return v_result;
end
$$;

create or replace function public.community_get_gallery_v1(
  p_auth_subject uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_public jsonb;
  v_reaction_counts jsonb;
  v_own_reactions jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_work_id,v_account_id) then
    raise exception 'Work is not accessible';
  end if;
  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='gallery';
  if v_work.work_id is null then raise exception 'Gallery Work not found'; end if;

  if private.is_discoverable_work(p_work_id) then
    v_public:=public.community_get_gallery_public_v1(p_work_id);
  else
    select jsonb_build_object(
      'workId',v_work.work_id,
      'workType','gallery',
      'creatorProfileId',v_work.creator_profile_id,
      'lifecycleState',v_work.lifecycle_state,
      'visibility',v_work.visibility,
      'moderationState',v_work.moderation_state,
      'rowVersion',v_work.row_version,
      'commentsEnabled',coalesce(s.comments_enabled,true),
      'title',r.title,
      'description',r.description,
      'metadata',r.metadata
    ) into v_public
    from public.gallery_work_settings s
    left join public.gallery_work_revisions r
      on r.revision_id=v_work.current_published_revision_id
    where s.work_id=v_work.work_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('kind',x.reaction_kind,'count',x.n)
    order by x.reaction_kind
  ),'[]'::jsonb)
  into v_reaction_counts
  from (
    select reaction_kind,count(*)::integer n
    from public.reactions
    where target_entity_id=p_work_id
    group by reaction_kind
  ) x;

  select coalesce(jsonb_agg(reaction_kind order by reaction_kind),'[]'::jsonb)
  into v_own_reactions
  from public.reactions
  where target_entity_id=p_work_id and account_id=v_account_id;

  return v_public || jsonb_build_object(
    'isOwner',v_work.owner_account_id=v_account_id,
    'viewerReactionKinds',v_own_reactions,
    'reactionCounts',case when v_work.owner_account_id=v_account_id or private.is_staff(v_account_id)
      then v_reaction_counts else null end
  );
end
$$;

create or replace function public.community_get_my_gallery_v1(
  p_auth_subject uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_my_works jsonb;
  v_saved jsonb;
begin
  if p_limit not between 1 and 100 then raise exception 'p_limit must be between 1 and 100'; end if;
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(jsonb_build_object(
    'workId',w.work_id,
    'creatorProfileId',w.creator_profile_id,
    'galleryKind',g.gallery_kind,
    'lifecycleState',w.lifecycle_state,
    'visibility',w.visibility,
    'moderationState',w.moderation_state,
    'rowVersion',w.row_version,
    'title',r.title,
    'publishedAt',w.published_at
  ) order by coalesce(w.published_at,w.updated_at) desc,w.work_id),'[]'::jsonb)
  into v_my_works
  from (
    select * from public.community_works
    where owner_account_id=v_account_id and work_type='gallery'
      and lifecycle_state<>'deleted'
    order by coalesce(published_at,updated_at) desc,work_id
    limit p_limit
  ) w
  join public.gallery_works g on g.work_id=w.work_id
  left join public.gallery_work_revisions r on r.revision_id=w.current_published_revision_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'targetEntityId',s.target_entity_id,
    'savedAt',s.created_at,
    'accessible',private.can_access_entity(s.target_entity_id,v_account_id),
    'work',case when private.can_access_entity(s.target_entity_id,v_account_id) then (
      select jsonb_build_object(
        'workId',w.work_id,
        'creatorProfileId',w.creator_profile_id,
        'galleryKind',g.gallery_kind,
        'title',r.title,
        'moderationState',w.moderation_state,
        'lifecycleState',w.lifecycle_state
      )
      from public.community_works w
      join public.gallery_works g on g.work_id=w.work_id
      left join public.gallery_work_revisions r on r.revision_id=w.current_published_revision_id
      where w.work_id=s.target_entity_id and w.work_type='gallery'
    ) else null end
  ) order by s.created_at desc),'[]'::jsonb)
  into v_saved
  from (
    select * from public.saved_items
    where account_id=v_account_id
    order by created_at desc
    limit p_limit
  ) s;

  return jsonb_build_object('myWorks',v_my_works,'saved',v_saved);
end
$$;

revoke execute on function public.community_create_gallery_work_v1(uuid,uuid,text,text)
from public,anon,authenticated;
revoke execute on function public.community_publish_gallery_v4(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text)
from public,anon,authenticated;
revoke execute on function public.community_add_comment_v2(uuid,uuid,uuid,uuid,text,text)
from public,anon,authenticated;
revoke execute on function public.community_set_gallery_comments_enabled_v1(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_gallery_author_remove_comment_v1(uuid,uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_get_gallery_v1(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_get_my_gallery_v1(uuid,integer)
from public,anon,authenticated;

grant execute on function public.community_create_gallery_work_v1(uuid,uuid,text,text) to service_role;
grant execute on function public.community_publish_gallery_v4(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text) to service_role;
grant execute on function public.community_add_comment_v2(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.community_set_gallery_comments_enabled_v1(uuid,uuid,boolean) to service_role;
grant execute on function public.community_gallery_author_remove_comment_v1(uuid,uuid,uuid,text) to service_role;
grant execute on function public.community_get_gallery_v1(uuid,uuid) to service_role;
grant execute on function public.community_get_my_gallery_v1(uuid,integer) to service_role;

revoke execute on function public.community_get_creator_public_v1(uuid) from public;
revoke execute on function public.community_get_gallery_public_v1(uuid) from public;
grant execute on function public.community_get_creator_public_v1(uuid) to anon,authenticated,service_role;
grant execute on function public.community_get_gallery_public_v1(uuid) to anon,authenticated,service_role;
