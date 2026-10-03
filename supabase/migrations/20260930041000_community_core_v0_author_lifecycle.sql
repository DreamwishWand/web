
create or replace function public.community_change_work_visibility(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_visibility text,
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
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','change_work_visibility',p_work_id::text,p_expected_version::text,p_visibility),
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
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state='deleted' then raise exception 'Deleted work cannot change visibility'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'change_work_visibility',v_request_hash);

  update public.community_works
  set visibility=p_visibility::visibility_state
  where work_id=p_work_id
  returning * into v_work;

  if v_work.lifecycle_state='published'
     and v_work.visibility='public'
     and v_work.moderation_state='clear' then
    if v_work.work_type='gallery' then
      select title,description into v_title,v_description
      from public.gallery_work_revisions
      where revision_id=v_work.current_published_revision_id;
    else
      select
        shared_metadata->>'title',
        shared_metadata->>'description'
      into v_title,v_description
      from public.community_work_revisions
      where revision_id=v_work.current_published_revision_id;
    end if;

    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at
    ) values (
      v_work.work_id,v_work.work_id,v_work.work_type,v_work.creator_profile_id,
      coalesce(v_title,''),coalesce(v_description,''),coalesce(v_work.published_at,now()),now()
    )
    on conflict (entity_id) do update set
      work_type=excluded.work_type,
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
    'community_work',p_work_id,'work.visibility_changed',
    jsonb_build_object('workId',p_work_id,'visibility',v_work.visibility),
    'work.visibility_changed:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'visibility',v_work.visibility,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;

create or replace function public.community_unpublish_work(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
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
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','unpublish_work',p_work_id::text,p_expected_version::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state<>'published' then raise exception 'Only published work can be unpublished'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'unpublish_work',v_request_hash);

  update public.community_works
  set lifecycle_state='unpublished'
  where work_id=p_work_id
  returning * into v_work;

  delete from public.search_documents where entity_id=p_work_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.unpublished',
    jsonb_build_object('workId',p_work_id),
    'work.unpublished:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'lifecycleState',v_work.lifecycle_state,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;

create or replace function public.community_delete_work(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
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
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','delete_work',p_work_id::text,p_expected_version::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state='deleted' then raise exception 'Work is already deleted'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'delete_work',v_request_hash);

  update public.community_works
  set lifecycle_state='deleted'
  where work_id=p_work_id
  returning * into v_work;

  update public.community_entities
  set deleted_at=coalesce(deleted_at,now())
  where entity_id=p_work_id;

  delete from public.search_documents where entity_id=p_work_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.deleted',
    jsonb_build_object('workId',p_work_id),
    'work.deleted:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'lifecycleState',v_work.lifecycle_state,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$$;

revoke execute on function public.community_change_work_visibility(uuid,uuid,bigint,text,text)
from public, anon, authenticated;
revoke execute on function public.community_unpublish_work(uuid,uuid,bigint,text)
from public, anon, authenticated;
revoke execute on function public.community_delete_work(uuid,uuid,bigint,text)
from public, anon, authenticated;

grant execute on function public.community_change_work_visibility(uuid,uuid,bigint,text,text)
to service_role;
grant execute on function public.community_unpublish_work(uuid,uuid,bigint,text)
to service_role;
grant execute on function public.community_delete_work(uuid,uuid,bigint,text)
to service_role;
