
create index if not exists outbox_dead_letter_idx
  on public.outbox_events(failed_at desc, created_at desc)
  where dispatched_at is null and failed_at is not null;

create or replace function public.community_get_dead_letter_outbox(
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
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.is_staff(v_account_id) then
    raise exception 'Moderator or admin role required';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'outboxId',e.outbox_id,
        'aggregateType',e.aggregate_type,
        'aggregateId',e.aggregate_id,
        'eventType',e.event_type,
        'attemptCount',e.attempt_count,
        'lastError',e.last_error,
        'failedAt',e.failed_at,
        'createdAt',e.created_at
      )
      order by e.failed_at desc,e.created_at desc,e.outbox_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.outbox_events
    where dispatched_at is null
      and failed_at is not null
    order by failed_at desc,created_at desc,outbox_id
    limit p_limit
  ) e;

  return v_result;
end;
$$;

create or replace function public.community_retry_dead_letter_outbox(
  p_auth_subject uuid,
  p_outbox_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  ev public.outbox_events%rowtype;
  v_target_entity_id uuid;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.is_staff(v_account_id) then
    raise exception 'Moderator or admin role required';
  end if;

  if coalesce(length(btrim(p_reason)),0) < 3
     or length(btrim(p_reason)) > 500 then
    raise exception 'Retry reason must be 3-500 characters';
  end if;

  select *
  into ev
  from public.outbox_events
  where outbox_id=p_outbox_id
  for update;

  if ev.outbox_id is null then
    raise exception 'Outbox event not found';
  end if;

  if ev.dispatched_at is not null then
    raise exception 'Outbox event already dispatched';
  end if;

  if ev.failed_at is null then
    raise exception 'Outbox event is not dead-lettered';
  end if;

  update public.outbox_events
  set attempt_count=0,
      last_error=null,
      next_attempt_at=now(),
      failed_at=null
  where outbox_id=ev.outbox_id;

  select entity_id
  into v_target_entity_id
  from public.community_entities
  where entity_id=ev.aggregate_id;

  insert into public.audit_events(
    actor_account_id,
    action_type,
    target_entity_id,
    metadata
  ) values (
    v_account_id,
    'outbox.dead_letter_requeued',
    v_target_entity_id,
    jsonb_build_object(
      'outboxId',ev.outbox_id,
      'eventType',ev.event_type,
      'aggregateType',ev.aggregate_type,
      'aggregateId',ev.aggregate_id,
      'priorAttemptCount',ev.attempt_count,
      'priorLastError',ev.last_error,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'outboxId',ev.outbox_id,
    'state','retry_pending',
    'attemptCount',0,
    'nextAttemptAt',now()
  );
end;
$$;

revoke execute on function public.community_get_dead_letter_outbox(uuid,integer)
from public, anon, authenticated;
revoke execute on function public.community_retry_dead_letter_outbox(uuid,uuid,text)
from public, anon, authenticated;

grant execute on function public.community_get_dead_letter_outbox(uuid,integer)
to service_role;
grant execute on function public.community_retry_dead_letter_outbox(uuid,uuid,text)
to service_role;
