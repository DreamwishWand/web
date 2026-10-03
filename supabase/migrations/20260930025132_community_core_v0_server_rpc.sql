-- Community Core v0 server-only RPC transaction layer.
-- Reconstructed from the applied staging definitions after runtime validation.

CREATE OR REPLACE FUNCTION private.resolve_active_account(p_auth_subject uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_status account_status;
begin
  select a.account_id, a.status
    into v_account_id, v_status
  from public.auth_identities i
  join public.wand_accounts a on a.account_id = i.account_id
  where i.provider = 'supabase'
    and i.provider_subject = p_auth_subject::text
  limit 1;

  if v_account_id is null then
    raise exception 'WandAccount mapping not found for Supabase subject';
  end if;
  if v_status <> 'active' then
    raise exception 'WandAccount is not active';
  end if;
  return v_account_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.community_add_comment(p_auth_subject uuid, p_creator_profile_id uuid, p_target_entity_id uuid, p_parent_comment_id uuid, p_body text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_comment_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0));
  v_request_hash := encode(digest(
    concat_ws('|','add_comment',p_creator_profile_id::text,p_target_entity_id::text,coalesce(p_parent_comment_id::text,''),p_body),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  if not exists (
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;
  if not private.can_access_entity(p_target_entity_id,v_account_id) then raise exception 'Target is not accessible'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'add_comment',v_request_hash);

  v_comment_id := gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values (v_comment_id,'comment');
  insert into public.comments(
    comment_id,target_entity_id,author_account_id,creator_profile_id,parent_comment_id,body
  ) values (
    v_comment_id,p_target_entity_id,v_account_id,p_creator_profile_id,p_parent_comment_id,p_body
  );

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'comment',v_comment_id,
    case when p_parent_comment_id is null then 'comment.created' else 'comment.replied' end,
    jsonb_build_object('commentId',v_comment_id,'targetEntityId',p_target_entity_id,'actorAccountId',v_account_id,'parentCommentId',p_parent_comment_id),
    'comment.created:' || v_comment_id::text
  );

  v_response := jsonb_build_object('commentId',v_comment_id);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$function$


CREATE OR REPLACE FUNCTION public.community_add_reaction(p_auth_subject uuid, p_target_entity_id uuid, p_reaction_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_inserted boolean;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  if not private.can_access_entity(p_target_entity_id,v_account_id) then
    raise exception 'Target is not accessible';
  end if;
  insert into public.reactions(account_id,target_entity_id,reaction_kind)
  values (v_account_id,p_target_entity_id,p_reaction_kind)
  on conflict do nothing
  returning true into v_inserted;

  if coalesce(v_inserted,false) then
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
    values (
      'community_entity',p_target_entity_id,'reaction.added',
      jsonb_build_object('targetEntityId',p_target_entity_id,'actorAccountId',v_account_id,'reactionKind',p_reaction_kind),
      'reaction.added:' || v_account_id::text || ':' || p_target_entity_id::text || ':' || p_reaction_kind
    ) on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('targetEntityId',p_target_entity_id,'reactionKind',p_reaction_kind);
end;
$function$


CREATE OR REPLACE FUNCTION public.community_create_gallery_draft(p_auth_subject uuid, p_creator_profile_id uuid, p_visibility text, p_gallery_kind text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0));
  v_request_hash := encode(digest(
    concat_ws('|','create_gallery_draft',p_creator_profile_id::text,p_visibility,p_gallery_kind),
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
  ) then
    raise exception 'CreatorProfile is not owned by actor';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'create_gallery_draft',v_request_hash);

  v_work_id := gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type)
  values (v_work_id,'community_work');

  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,visibility
  ) values (
    v_work_id,v_account_id,p_creator_profile_id,'gallery',p_visibility::visibility_state
  );

  insert into public.gallery_works(work_id,gallery_kind)
  values (v_work_id,p_gallery_kind);

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',v_work_id,'work.draft_created',
    jsonb_build_object('workId',v_work_id,'workType','gallery'),
    'work.draft_created:' || v_work_id::text
  );

  v_response := jsonb_build_object('workId',v_work_id,'rowVersion',1);
  update public.idempotency_keys
    set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$function$


CREATE OR REPLACE FUNCTION public.community_ensure_account_creator(p_auth_subject uuid, p_handle text, p_display_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_creator_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('identity:' || p_auth_subject::text, 0));

  select i.account_id into v_account_id
  from public.auth_identities i
  where i.provider='supabase' and i.provider_subject=p_auth_subject::text
  limit 1;

  if v_account_id is null then
    insert into public.wand_accounts default values returning account_id into v_account_id;
    insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at)
    values (v_account_id,'supabase',p_auth_subject::text,now());
  end if;

  select creator_profile_id into v_creator_id
  from public.creator_profiles
  where owner_account_id=v_account_id;

  if v_creator_id is null then
    v_creator_id := gen_random_uuid();
    insert into public.community_entities(entity_id,entity_type)
    values (v_creator_id,'creator_profile');
    insert into public.creator_profiles(
      creator_profile_id,owner_account_id,handle,display_name
    ) values (
      v_creator_id,v_account_id,p_handle,p_display_name
    );
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
    values (
      'creator_profile',v_creator_id,'creator.created',
      jsonb_build_object('creatorProfileId',v_creator_id),
      'creator.created:' || v_creator_id::text
    );
  end if;

  return jsonb_build_object(
    'accountId',v_account_id,
    'creatorProfileId',v_creator_id
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.community_follow_creator(p_auth_subject uuid, p_creator_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_owner uuid;
  v_inserted boolean;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  select owner_account_id into v_owner from public.creator_profiles
  where creator_profile_id=p_creator_profile_id;
  if v_owner is null then raise exception 'Creator not found'; end if;

  insert into public.follows(follower_account_id,creator_profile_id)
  values (v_account_id,p_creator_profile_id)
  on conflict do nothing
  returning true into v_inserted;

  if coalesce(v_inserted,false) then
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
    values (
      'creator_profile',p_creator_profile_id,'creator.followed',
      jsonb_build_object('creatorProfileId',p_creator_profile_id,'actorAccountId',v_account_id),
      'creator.followed:' || v_account_id::text || ':' || p_creator_profile_id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('creatorProfileId',p_creator_profile_id,'following',true);
end;
$function$


CREATE OR REPLACE FUNCTION public.community_moderate_work(p_auth_subject uuid, p_case_id uuid, p_action text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_target uuid;
  v_work public.community_works%rowtype;
  v_prior moderation_state;
  v_next moderation_state;
  v_action_id uuid;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  if not exists (
    select 1 from public.account_roles
    where account_id=v_account_id and role in ('moderator','admin')
  ) then raise exception 'Moderator role required'; end if;

  select target_entity_id into v_target from public.moderation_cases
  where case_id=p_case_id for update;
  if v_target is null then raise exception 'Moderation case not found'; end if;

  select * into v_work from public.community_works where work_id=v_target for update;
  if v_work.work_id is null then raise exception 'Initial moderation RPC supports CommunityWork targets only'; end if;

  v_prior := v_work.moderation_state;
  if p_action='restrict' then v_next := 'restricted';
  elsif p_action='remove' then v_next := 'removed';
  elsif p_action='restore' then v_next := 'clear';
  else raise exception 'Unsupported moderation action'; end if;

  update public.community_works set moderation_state=v_next where work_id=v_target returning * into v_work;

  insert into public.moderation_actions(
    case_id,actor_account_id,action_type,reason,prior_state,resulting_state
  ) values (
    p_case_id,v_account_id,p_action,p_reason,
    jsonb_build_object('moderationState',v_prior),
    jsonb_build_object('moderationState',v_next)
  ) returning action_id into v_action_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values (
    v_account_id,'moderation.' || p_action,v_target,
    jsonb_build_object('caseId',p_case_id,'actionId',v_action_id)
  );

  if v_next='clear' and v_work.lifecycle_state='published' and v_work.visibility='public' then
    select g.title,g.description into v_title,v_description
    from public.gallery_work_revisions g
    where g.revision_id=v_work.current_published_revision_id;
    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
    ) values (
      v_target,v_target,v_work.work_type,v_work.creator_profile_id,coalesce(v_title,''),coalesce(v_description,''),v_work.published_at,now()
    ) on conflict (entity_id) do update set
      title=excluded.title,text_content=excluded.text_content,published_at=excluded.published_at,updated_at=now();
  else
    delete from public.search_documents where entity_id=v_target;
  end if;

  update public.moderation_cases set status='resolved',updated_at=now() where case_id=p_case_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',v_target,'moderation.' || p_action,
    jsonb_build_object('workId',v_target,'caseId',p_case_id,'actionId',v_action_id),
    'moderation:' || v_action_id::text
  );

  return jsonb_build_object('workId',v_target,'actionId',v_action_id,'moderationState',v_next);
end;
$function$


CREATE OR REPLACE FUNCTION public.community_publish_gallery(p_auth_subject uuid, p_work_id uuid, p_expected_version bigint, p_title text, p_description text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_revision_id uuid;
  v_revision_number integer;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0));
  v_request_hash := encode(digest(
    concat_ws('|','publish_gallery',p_work_id::text,p_expected_version::text,p_title,coalesce(p_description,'')),
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
  if v_work.lifecycle_state not in ('draft','unpublished') then raise exception 'Work cannot be published from current lifecycle'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'publish_gallery',v_request_hash);

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
      p_work_id,p_work_id,'gallery',v_work.creator_profile_id,p_title,coalesce(p_description,''),v_work.published_at,now()
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
    jsonb_build_object('workId',p_work_id,'revisionId',v_revision_id),
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
$function$


CREATE OR REPLACE FUNCTION public.community_report_entity(p_auth_subject uuid, p_target_entity_id uuid, p_reason_code text, p_detail text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_report_id uuid;
  v_case_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0));
  v_request_hash := encode(digest(
    concat_ws('|','report_entity',p_target_entity_id::text,p_reason_code,coalesce(p_detail,'')),
    'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  if not private.can_access_entity(p_target_entity_id,v_account_id) then raise exception 'Target is not accessible'; end if;
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'report_entity',v_request_hash);

  insert into public.reports(reporter_account_id,target_entity_id,reason_code,detail)
  values (v_account_id,p_target_entity_id,p_reason_code,p_detail)
  returning report_id into v_report_id;

  select case_id into v_case_id
  from public.moderation_cases
  where target_entity_id=p_target_entity_id and status in ('open','reviewing')
  order by created_at limit 1;

  if v_case_id is null then
    insert into public.moderation_cases(target_entity_id) values (p_target_entity_id)
    returning case_id into v_case_id;
  end if;

  insert into public.moderation_case_reports(case_id,report_id) values (v_case_id,v_report_id);

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'moderation_case',v_case_id,'report.created',
    jsonb_build_object('caseId',v_case_id,'reportId',v_report_id,'targetEntityId',p_target_entity_id),
    'report.created:' || v_report_id::text
  );

  v_response := jsonb_build_object('reportId',v_report_id,'caseId',v_case_id);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$function$


CREATE OR REPLACE FUNCTION public.community_save_entity(p_auth_subject uuid, p_target_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  if not private.can_access_entity(p_target_entity_id,v_account_id) then
    raise exception 'Target is not accessible';
  end if;
  insert into public.saved_items(account_id,target_entity_id)
  values (v_account_id,p_target_entity_id)
  on conflict do nothing;
  return jsonb_build_object('targetEntityId',p_target_entity_id,'saved',true);
end;
$function$



revoke execute on function private.resolve_active_account(uuid) from public, anon, authenticated;

revoke execute on function public.community_ensure_account_creator(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.community_create_gallery_draft(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.community_publish_gallery(uuid,uuid,bigint,text,text,text) from public, anon, authenticated;
revoke execute on function public.community_save_entity(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.community_follow_creator(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.community_add_reaction(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.community_add_comment(uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.community_report_entity(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.community_moderate_work(uuid,uuid,text,text) from public, anon, authenticated;

grant execute on function public.community_ensure_account_creator(uuid,text,text) to service_role;
grant execute on function public.community_create_gallery_draft(uuid,uuid,text,text,text) to service_role;
grant execute on function public.community_publish_gallery(uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function public.community_save_entity(uuid,uuid) to service_role;
grant execute on function public.community_follow_creator(uuid,uuid) to service_role;
grant execute on function public.community_add_reaction(uuid,uuid,text) to service_role;
grant execute on function public.community_add_comment(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.community_report_entity(uuid,uuid,text,text,text) to service_role;
grant execute on function public.community_moderate_work(uuid,uuid,text,text) to service_role;
