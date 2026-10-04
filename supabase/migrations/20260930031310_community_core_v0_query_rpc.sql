
-- Community Core v0 server-only query RPCs.

create or replace function public.community_get_me(p_auth_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_creator_id uuid;
  v_handle text;
  v_display_name text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  select creator_profile_id,handle,display_name
    into v_creator_id,v_handle,v_display_name
  from public.creator_profiles
  where owner_account_id=v_account_id;

  return jsonb_build_object(
    'accountId',v_account_id,
    'creatorProfileId',v_creator_id,
    'handle',v_handle,
    'displayName',v_display_name
  );
end;
$$;

create or replace function public.community_get_work(
  p_auth_subject uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_title text;
  v_description text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_work(p_work_id,v_account_id) then
    raise exception 'Work is not accessible';
  end if;

  select * into v_work from public.community_works where work_id=p_work_id;
  if v_work.current_published_revision_id is not null then
    select title,description into v_title,v_description
    from public.gallery_work_revisions
    where revision_id=v_work.current_published_revision_id;
  end if;

  return jsonb_build_object(
    'workId',v_work.work_id,
    'workType',v_work.work_type,
    'creatorProfileId',v_work.creator_profile_id,
    'lifecycleState',v_work.lifecycle_state,
    'visibility',v_work.visibility,
    'moderationState',v_work.moderation_state,
    'currentPublishedRevisionId',v_work.current_published_revision_id,
    'rowVersion',v_work.row_version,
    'title',v_title,
    'description',v_description
  );
end;
$$;

create or replace function public.community_get_saved(
  p_auth_subject uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'p_limit must be between 1 and 100'; end if;
  v_account_id := private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'targetEntityId',s.target_entity_id,
      'savedAt',s.created_at,
      'accessible',private.can_access_entity(s.target_entity_id,v_account_id)
    )
    order by s.created_at desc
  ),'[]'::jsonb)
  into v_result
  from (
    select * from public.saved_items
    where account_id=v_account_id
    order by created_at desc
    limit p_limit
  ) s;

  return v_result;
end;
$$;

create or replace function public.community_get_notifications(
  p_auth_subject uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'p_limit must be between 1 and 100'; end if;
  v_account_id := private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'notificationEventId',x.notification_event_id,
      'eventType',x.event_type,
      'actorAccountId',x.actor_account_id,
      'targetEntityId',x.target_entity_id,
      'deliveryState',x.delivery_state,
      'createdAt',x.created_at,
      'readAt',x.read_at
    )
    order by x.created_at desc
  ),'[]'::jsonb)
  into v_result
  from (
    select ne.notification_event_id,ne.event_type,ne.actor_account_id,ne.target_entity_id,
           nd.delivery_state,nd.created_at,nd.read_at
    from public.notification_deliveries nd
    join public.notification_events ne using(notification_event_id)
    where nd.recipient_account_id=v_account_id
    order by nd.created_at desc
    limit p_limit
  ) x;

  return v_result;
end;
$$;

revoke execute on function public.community_get_me(uuid) from public, anon, authenticated;
revoke execute on function public.community_get_work(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.community_get_saved(uuid,integer) from public, anon, authenticated;
revoke execute on function public.community_get_notifications(uuid,integer) from public, anon, authenticated;

grant execute on function public.community_get_me(uuid) to service_role;
grant execute on function public.community_get_work(uuid,uuid) to service_role;
grant execute on function public.community_get_saved(uuid,integer) to service_role;
grant execute on function public.community_get_notifications(uuid,integer) to service_role;
