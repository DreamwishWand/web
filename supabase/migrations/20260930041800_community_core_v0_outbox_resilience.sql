
alter table public.outbox_events
  add column if not exists last_error text null,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists failed_at timestamptz null;

drop index if exists public.outbox_pending_idx;
create index if not exists outbox_pending_idx
  on public.outbox_events(next_attempt_at,created_at)
  where dispatched_at is null and failed_at is null;

create or replace function public.community_process_outbox_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  ev record;
  v_notification_event_id uuid;
  v_actor uuid;
  v_recipient uuid;
  v_target uuid;
  v_deliveries integer := 0;
  v_added integer := 0;
  v_processed integer := 0;
  v_failed integer := 0;
  v_dead_lettered integer := 0;
  v_next_attempt_count integer;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'p_limit must be between 1 and 500';
  end if;

  for ev in
    select *
    from public.outbox_events
    where dispatched_at is null
      and failed_at is null
      and next_attempt_at <= now()
    order by next_attempt_at,created_at,outbox_id
    for update skip locked
    limit p_limit
  loop
    begin
      v_actor := null;
      v_recipient := null;
      v_target := ev.aggregate_id;
      v_notification_event_id := null;

      if ev.event_type = 'creator.followed' then
        v_actor := nullif(ev.payload->>'actorAccountId','')::uuid;
        select owner_account_id into v_recipient
        from public.creator_profiles
        where creator_profile_id=ev.aggregate_id;

      elsif ev.event_type = 'reaction.added' then
        v_actor := nullif(ev.payload->>'actorAccountId','')::uuid;
        v_target := nullif(ev.payload->>'targetEntityId','')::uuid;
        v_recipient := private.entity_owner_account_id(v_target);

      elsif ev.event_type = 'comment.created' then
        v_actor := nullif(ev.payload->>'actorAccountId','')::uuid;
        v_target := nullif(ev.payload->>'targetEntityId','')::uuid;
        v_recipient := private.entity_owner_account_id(v_target);

      elsif ev.event_type = 'comment.replied' then
        v_actor := nullif(ev.payload->>'actorAccountId','')::uuid;
        v_target := nullif(ev.payload->>'commentId','')::uuid;
        select author_account_id into v_recipient
        from public.comments
        where comment_id=nullif(ev.payload->>'parentCommentId','')::uuid;

      elsif ev.event_type = 'work.published' then
        v_actor := private.entity_owner_account_id(ev.aggregate_id);

        insert into public.notification_events(
          event_type,actor_account_id,target_entity_id,source_outbox_id
        ) values (
          ev.event_type,v_actor,ev.aggregate_id,ev.outbox_id
        )
        on conflict (source_outbox_id) do update
          set event_type=excluded.event_type
        returning notification_event_id into v_notification_event_id;

        insert into public.notification_deliveries(
          notification_event_id,recipient_account_id
        )
        select v_notification_event_id,f.follower_account_id
        from public.community_works w
        join public.follows f on f.creator_profile_id=w.creator_profile_id
        where w.work_id=ev.aggregate_id
          and f.follower_account_id <> w.owner_account_id
        on conflict do nothing;

        get diagnostics v_added = row_count;
        v_deliveries := v_deliveries + v_added;

        update public.outbox_events
        set dispatched_at=now(),
            attempt_count=attempt_count+1,
            last_error=null,
            next_attempt_at=now()
        where outbox_id=ev.outbox_id;

        v_processed := v_processed + 1;
        continue;

      elsif ev.event_type like 'moderation.%' then
        v_recipient := private.entity_owner_account_id(ev.aggregate_id);
        v_target := ev.aggregate_id;
        v_actor := null;

      else
        update public.outbox_events
        set dispatched_at=now(),
            attempt_count=attempt_count+1,
            last_error=null,
            next_attempt_at=now()
        where outbox_id=ev.outbox_id;

        v_processed := v_processed + 1;
        continue;
      end if;

      if v_recipient is not null and (v_actor is null or v_recipient <> v_actor) then
        insert into public.notification_events(
          event_type,actor_account_id,target_entity_id,source_outbox_id
        ) values (
          ev.event_type,v_actor,v_target,ev.outbox_id
        )
        on conflict (source_outbox_id) do update
          set event_type=excluded.event_type
        returning notification_event_id into v_notification_event_id;

        insert into public.notification_deliveries(
          notification_event_id,recipient_account_id
        ) values (
          v_notification_event_id,v_recipient
        )
        on conflict do nothing;

        get diagnostics v_added = row_count;
        v_deliveries := v_deliveries + v_added;
      end if;

      update public.outbox_events
      set dispatched_at=now(),
          attempt_count=attempt_count+1,
          last_error=null,
          next_attempt_at=now()
      where outbox_id=ev.outbox_id;

      v_processed := v_processed + 1;

    exception when others then
      v_next_attempt_count := ev.attempt_count + 1;

      update public.outbox_events
      set attempt_count=v_next_attempt_count,
          last_error=left(sqlerrm,2000),
          next_attempt_at=now() + make_interval(
            secs => least(3600,60 * power(2,least(ev.attempt_count,10))::integer)
          ),
          failed_at=case when v_next_attempt_count >= 5 then now() else null end
      where outbox_id=ev.outbox_id;

      v_failed := v_failed + 1;
      if v_next_attempt_count >= 5 then
        v_dead_lettered := v_dead_lettered + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'processed',v_processed,
    'deliveries',v_deliveries,
    'failed',v_failed,
    'deadLettered',v_dead_lettered
  );
end;
$$;

revoke execute on function public.community_process_outbox_batch(integer)
from public, anon, authenticated;
grant execute on function public.community_process_outbox_batch(integer)
to service_role;
