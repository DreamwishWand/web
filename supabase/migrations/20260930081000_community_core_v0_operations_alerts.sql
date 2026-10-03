
create table if not exists private.community_operations_alerts (
  alert_id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  alert_type text not null
    check (alert_type in (
      'provider_cleanup_dead_letter',
      'outbox_dead_letter',
      'provider_cleanup_scheduler_stale'
    )),
  severity text not null
    check (severity in ('warning','critical')),
  source_id uuid null,
  state text not null default 'open'
    check (state in ('open','acknowledged','resolved')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  acknowledged_by_account_id uuid null references public.wand_accounts(account_id),
  acknowledgment_note text null,
  resolved_at timestamptz null
);

create index if not exists community_operations_alerts_state_idx
  on private.community_operations_alerts(state,severity,last_seen_at desc);

revoke all on private.community_operations_alerts from public,anon,authenticated;

create or replace function private.community_refresh_operations_alerts()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,cron
as $$
declare
  v_cron_active boolean;
  v_last_verified_at timestamptz;
  v_worker_healthy boolean;
  v_open_count integer;
begin
  insert into private.community_operations_alerts(
    dedupe_key,alert_type,severity,source_id,state,message,metadata,
    first_seen_at,last_seen_at,resolved_at
  )
  select
    'provider_cleanup_dead_letter:' || j.cleanup_job_id::text,
    'provider_cleanup_dead_letter',
    'critical',
    j.cleanup_job_id,
    'open',
    'Provider cleanup job reached dead-letter state.',
    jsonb_build_object(
      'attempts',j.attempts,
      'deadLetteredAt',j.dead_lettered_at
    ),
    now(),
    now(),
    null
  from private.provider_cleanup_jobs j
  where j.state='dead_letter'
  on conflict (dedupe_key) do update
  set severity=excluded.severity,
      message=excluded.message,
      metadata=excluded.metadata,
      last_seen_at=now(),
      state=case
        when private.community_operations_alerts.state='resolved' then 'open'
        else private.community_operations_alerts.state
      end,
      acknowledged_at=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledged_at
      end,
      acknowledged_by_account_id=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledged_by_account_id
      end,
      acknowledgment_note=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledgment_note
      end,
      resolved_at=null;

  insert into private.community_operations_alerts(
    dedupe_key,alert_type,severity,source_id,state,message,metadata,
    first_seen_at,last_seen_at,resolved_at
  )
  select
    'outbox_dead_letter:' || e.outbox_id::text,
    'outbox_dead_letter',
    'warning',
    e.outbox_id,
    'open',
    'Community outbox event reached dead-letter state.',
    jsonb_build_object(
      'eventType',e.event_type,
      'aggregateType',e.aggregate_type,
      'attemptCount',e.attempt_count,
      'failedAt',e.failed_at
    ),
    now(),
    now(),
    null
  from public.outbox_events e
  where e.dispatched_at is null
    and e.failed_at is not null
  on conflict (dedupe_key) do update
  set severity=excluded.severity,
      message=excluded.message,
      metadata=excluded.metadata,
      last_seen_at=now(),
      state=case
        when private.community_operations_alerts.state='resolved' then 'open'
        else private.community_operations_alerts.state
      end,
      acknowledged_at=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledged_at
      end,
      acknowledged_by_account_id=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledged_by_account_id
      end,
      acknowledgment_note=case
        when private.community_operations_alerts.state='resolved' then null
        else private.community_operations_alerts.acknowledgment_note
      end,
      resolved_at=null;

  select coalesce(bool_or(active),false)
  into v_cron_active
  from cron.job
  where jobname='community-provider-cleanup-every-minute';

  select last_verified_at
  into v_last_verified_at
  from private.community_worker_auth
  where worker_name='provider_cleanup';

  v_worker_healthy :=
    v_cron_active
    and v_last_verified_at is not null
    and v_last_verified_at >= now() - interval '3 minutes';

  if not v_worker_healthy then
    insert into private.community_operations_alerts(
      dedupe_key,alert_type,severity,source_id,state,message,metadata,
      first_seen_at,last_seen_at,resolved_at
    ) values (
      'provider_cleanup_scheduler_stale',
      'provider_cleanup_scheduler_stale',
      'critical',
      null,
      'open',
      'Provider cleanup scheduler/worker heartbeat is stale or inactive.',
      jsonb_build_object(
        'cronActive',v_cron_active,
        'lastVerifiedAt',v_last_verified_at
      ),
      now(),
      now(),
      null
    )
    on conflict (dedupe_key) do update
    set severity=excluded.severity,
        message=excluded.message,
        metadata=excluded.metadata,
        last_seen_at=now(),
        state=case
          when private.community_operations_alerts.state='resolved' then 'open'
          else private.community_operations_alerts.state
        end,
        acknowledged_at=case
          when private.community_operations_alerts.state='resolved' then null
          else private.community_operations_alerts.acknowledged_at
        end,
        acknowledged_by_account_id=case
          when private.community_operations_alerts.state='resolved' then null
          else private.community_operations_alerts.acknowledged_by_account_id
        end,
        acknowledgment_note=case
          when private.community_operations_alerts.state='resolved' then null
          else private.community_operations_alerts.acknowledgment_note
        end,
        resolved_at=null;
  end if;

  update private.community_operations_alerts a
  set state='resolved',
      resolved_at=now(),
      last_seen_at=now()
  where a.alert_type='provider_cleanup_dead_letter'
    and a.state<>'resolved'
    and not exists (
      select 1
      from private.provider_cleanup_jobs j
      where j.cleanup_job_id=a.source_id
        and j.state='dead_letter'
    );

  update private.community_operations_alerts a
  set state='resolved',
      resolved_at=now(),
      last_seen_at=now()
  where a.alert_type='outbox_dead_letter'
    and a.state<>'resolved'
    and not exists (
      select 1
      from public.outbox_events e
      where e.outbox_id=a.source_id
        and e.dispatched_at is null
        and e.failed_at is not null
    );

  if v_worker_healthy then
    update private.community_operations_alerts
    set state='resolved',
        resolved_at=now(),
        last_seen_at=now()
    where dedupe_key='provider_cleanup_scheduler_stale'
      and state<>'resolved';
  end if;

  select count(*)
  into v_open_count
  from private.community_operations_alerts
  where state<>'resolved';

  return jsonb_build_object(
    'openOrAcknowledgedAlerts',v_open_count,
    'providerCleanupWorkerHealthy',v_worker_healthy,
    'lastVerifiedAt',v_last_verified_at
  );
end;
$$;

create or replace function public.community_get_operations_alerts(
  p_admin_auth_subject uuid,
  p_state text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_result jsonb;
begin
  v_admin_account_id := private.resolve_active_account(p_admin_auth_subject);

  if not exists (
    select 1
    from public.account_roles
    where account_id=v_admin_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if p_state is not null and p_state not in ('open','acknowledged','resolved') then
    raise exception 'Unsupported operations-alert state';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'alertId',a.alert_id,
        'alertType',a.alert_type,
        'severity',a.severity,
        'sourceId',a.source_id,
        'state',a.state,
        'message',a.message,
        'metadata',a.metadata,
        'firstSeenAt',a.first_seen_at,
        'lastSeenAt',a.last_seen_at,
        'acknowledgedAt',a.acknowledged_at,
        'acknowledgedByAccountId',a.acknowledged_by_account_id,
        'acknowledgmentNote',a.acknowledgment_note,
        'resolvedAt',a.resolved_at
      )
      order by
        case a.severity when 'critical' then 0 else 1 end,
        a.last_seen_at desc,
        a.alert_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from private.community_operations_alerts
    where p_state is null or state=p_state
    order by
      case severity when 'critical' then 0 else 1 end,
      last_seen_at desc,
      alert_id
    limit p_limit
  ) a;

  return v_result;
end;
$$;

create or replace function public.community_admin_ack_operations_alert(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_alert_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_alert private.community_operations_alerts%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_note)),0) < 3
     or length(btrim(p_note)) > 500 then
    raise exception 'Acknowledgment note must be 3-500 characters';
  end if;

  update private.community_operations_alerts
  set state='acknowledged',
      acknowledged_at=now(),
      acknowledged_by_account_id=v_admin_account_id,
      acknowledgment_note=btrim(p_note)
  where alert_id=p_alert_id
    and state='open'
  returning * into v_alert;

  if v_alert.alert_id is null then
    raise exception 'Open operations alert not found';
  end if;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,
    'operations_alert.acknowledged',
    null,
    jsonb_build_object(
      'alertId',v_alert.alert_id,
      'alertType',v_alert.alert_type,
      'severity',v_alert.severity,
      'sourceId',v_alert.source_id,
      'note',btrim(p_note)
    )
  );

  return jsonb_build_object(
    'alertId',v_alert.alert_id,
    'state','acknowledged',
    'acknowledgedAt',v_alert.acknowledged_at,
    'acknowledgedByAccountId',v_admin_account_id
  );
end;
$$;

revoke execute on function private.community_refresh_operations_alerts()
from public,anon,authenticated,service_role;
revoke execute on function public.community_get_operations_alerts(uuid,text,integer)
from public,anon,authenticated;
revoke execute on function public.community_admin_ack_operations_alert(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;

grant execute on function public.community_get_operations_alerts(uuid,text,integer)
to service_role;
grant execute on function public.community_admin_ack_operations_alert(
  uuid,uuid,bigint,uuid,text
) to service_role;

select cron.schedule(
  'community-operations-alerts-every-minute',
  '* * * * *',
  'select private.community_refresh_operations_alerts();'
);
