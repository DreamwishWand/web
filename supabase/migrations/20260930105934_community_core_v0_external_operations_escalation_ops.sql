alter table private.community_operations_alerts
  drop constraint if exists community_operations_alerts_alert_type_check;

alter table private.community_operations_alerts
  add constraint community_operations_alerts_alert_type_check
  check (alert_type in (
    'provider_cleanup_dead_letter',
    'outbox_dead_letter',
    'provider_cleanup_scheduler_stale',
    'retention_dead_letter',
    'retention_scheduler_stale',
    'operations_escalation_dead_letter',
    'operations_escalation_scheduler_stale'
  ));

create or replace function private.community_enqueue_operations_escalations()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_inserted integer := 0;
  v_cancelled integer := 0;
  v_enabled boolean;
  v_channel text;
begin
  select enabled,channel
    into v_enabled,v_channel
  from private.community_operations_escalation_config
  where config_id=true;

  if coalesce(v_enabled,false) is not true then
    return jsonb_build_object(
      'enabled',false,
      'inserted',0,
      'cancelled',0
    );
  end if;

  insert into private.community_operations_escalation_deliveries(
    alert_id,alert_occurrence,channel,state,next_attempt_at
  )
  select
    a.alert_id,a.occurrence,v_channel,'pending',now()
  from private.community_operations_alerts a
  where a.severity='critical'
    and a.state='open'
    and a.alert_type not in (
      'operations_escalation_dead_letter',
      'operations_escalation_scheduler_stale'
    )
  on conflict(alert_id,alert_occurrence,channel) do nothing;

  get diagnostics v_inserted=row_count;

  update private.community_operations_escalation_deliveries d
  set state='cancelled',
      locked_at=null,
      lock_token=null,
      updated_at=now()
  where d.state='pending'
    and exists(
      select 1
      from private.community_operations_alerts a
      where a.alert_id=d.alert_id
        and (
          a.state<>'open'
          or a.occurrence<>d.alert_occurrence
          or a.alert_type in (
            'operations_escalation_dead_letter',
            'operations_escalation_scheduler_stale'
          )
        )
    );

  get diagnostics v_cancelled=row_count;

  return jsonb_build_object(
    'enabled',true,
    'inserted',v_inserted,
    'cancelled',v_cancelled
  );
end;
$$;

create or replace function private.community_refresh_operations_escalation_alerts()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,cron
as $$
declare
  v_enabled boolean;
  v_cron_active boolean := false;
  v_last_verified_at timestamptz;
  v_worker_healthy boolean := false;
  v_open_count integer := 0;
begin
  select coalesce(enabled,false)
    into v_enabled
  from private.community_operations_escalation_config
  where config_id=true;

  insert into private.community_operations_alerts(
    dedupe_key,alert_type,severity,source_id,state,message,metadata,
    first_seen_at,last_seen_at,resolved_at
  )
  select
    'operations_escalation_dead_letter:' || d.delivery_id::text,
    'operations_escalation_dead_letter',
    'critical',
    d.delivery_id,
    'open',
    'External critical-alert delivery reached dead-letter state.',
    jsonb_build_object(
      'channel',d.channel,
      'attempts',d.attempts,
      'lastHttpStatus',d.last_http_status,
      'deadLetteredAt',d.dead_lettered_at
    ),
    now(),
    now(),
    null
  from private.community_operations_escalation_deliveries d
  where d.state='dead_letter'
  on conflict(dedupe_key) do update
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

  update private.community_operations_alerts a
  set state='resolved',
      resolved_at=now(),
      last_seen_at=now()
  where a.alert_type='operations_escalation_dead_letter'
    and a.state<>'resolved'
    and not exists(
      select 1
      from private.community_operations_escalation_deliveries d
      where d.delivery_id=a.source_id
        and d.state='dead_letter'
    );

  if coalesce(v_enabled,false) then
    select coalesce(bool_or(active),false)
      into v_cron_active
    from cron.job
    where jobname='community-operations-escalation-every-minute';

    select last_verified_at
      into v_last_verified_at
    from private.community_worker_auth
    where worker_name='operations_escalation';

    v_worker_healthy :=
      v_cron_active
      and v_last_verified_at is not null
      and v_last_verified_at >= now()-interval '3 minutes';

    if not v_worker_healthy then
      insert into private.community_operations_alerts(
        dedupe_key,alert_type,severity,source_id,state,message,metadata,
        first_seen_at,last_seen_at,resolved_at
      ) values (
        'operations_escalation_scheduler_stale',
        'operations_escalation_scheduler_stale',
        'critical',
        null,
        'open',
        'External critical-alert scheduler/worker heartbeat is stale or inactive.',
        jsonb_build_object(
          'cronActive',v_cron_active,
          'lastVerifiedAt',v_last_verified_at
        ),
        now(),
        now(),
        null
      )
      on conflict(dedupe_key) do update
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
    else
      update private.community_operations_alerts
      set state='resolved',
          resolved_at=now(),
          last_seen_at=now()
      where dedupe_key='operations_escalation_scheduler_stale'
        and state<>'resolved';
    end if;
  else
    update private.community_operations_alerts
    set state='resolved',
        resolved_at=now(),
        last_seen_at=now()
    where dedupe_key='operations_escalation_scheduler_stale'
      and state<>'resolved';
  end if;

  select count(*)
    into v_open_count
  from private.community_operations_alerts
  where alert_type in (
      'operations_escalation_dead_letter',
      'operations_escalation_scheduler_stale'
    )
    and state<>'resolved';

  return jsonb_build_object(
    'enabled',coalesce(v_enabled,false),
    'openOrAcknowledgedEscalationAlerts',v_open_count,
    'workerHealthy',v_worker_healthy,
    'lastVerifiedAt',v_last_verified_at
  );
end;
$$;

create or replace function public.community_get_operations_escalation_deliveries(
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

  if not exists(
    select 1
    from public.account_roles
    where account_id=v_admin_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if p_state is not null
     and p_state not in ('pending','processing','delivered','cancelled','dead_letter') then
    raise exception 'Unsupported operations-escalation delivery state';
  end if;

  if p_limit<1 or p_limit>200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deliveryId',d.delivery_id,
        'alertId',d.alert_id,
        'alertOccurrence',d.alert_occurrence,
        'alertType',a.alert_type,
        'severity',a.severity,
        'channel',d.channel,
        'state',d.state,
        'attempts',d.attempts,
        'nextAttemptAt',d.next_attempt_at,
        'deliveredAt',d.delivered_at,
        'lastHttpStatus',d.last_http_status,
        'lastError',d.last_error,
        'deadLetteredAt',d.dead_lettered_at,
        'createdAt',d.created_at,
        'updatedAt',d.updated_at
      )
      order by d.created_at desc,d.delivery_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from private.community_operations_escalation_deliveries
    where p_state is null or state=p_state
    order by created_at desc,delivery_id
    limit p_limit
  ) d
  join private.community_operations_alerts a
    on a.alert_id=d.alert_id;

  return v_result;
end;
$$;

create or replace function public.community_admin_retry_operations_escalation(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_delivery_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_delivery private.community_operations_escalation_deliveries%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Retry reason must be 8-500 characters';
  end if;

  select *
    into v_delivery
  from private.community_operations_escalation_deliveries
  where delivery_id=p_delivery_id
  for update;

  if v_delivery.delivery_id is null then
    raise exception 'Operations escalation delivery not found';
  end if;

  if v_delivery.state<>'dead_letter' then
    raise exception 'Operations escalation delivery is not dead-lettered';
  end if;

  if not exists(
    select 1
    from private.community_operations_alerts a
    where a.alert_id=v_delivery.alert_id
      and a.state='open'
      and a.severity='critical'
      and a.occurrence=v_delivery.alert_occurrence
      and a.alert_type not in (
        'operations_escalation_dead_letter',
        'operations_escalation_scheduler_stale'
      )
  ) then
    raise exception 'Underlying operations alert is no longer open/current';
  end if;

  update private.community_operations_escalation_deliveries
  set state='pending',
      attempts=0,
      next_attempt_at=now(),
      locked_at=null,
      lock_token=null,
      delivered_at=null,
      last_http_status=null,
      last_error=null,
      dead_lettered_at=null,
      updated_at=now()
  where delivery_id=p_delivery_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,
    'operations_escalation.requeued',
    null,
    jsonb_build_object(
      'deliveryId',p_delivery_id,
      'alertId',v_delivery.alert_id,
      'alertOccurrence',v_delivery.alert_occurrence,
      'reason',btrim(p_reason)
    )
  );

  perform private.community_refresh_operations_escalation_alerts();

  return jsonb_build_object(
    'deliveryId',p_delivery_id,
    'state','pending'
  );
end;
$$;

revoke execute on function private.community_refresh_operations_escalation_alerts()
from public,anon,authenticated,service_role;

revoke execute on function public.community_get_operations_escalation_deliveries(uuid,text,integer)
from public,anon,authenticated;

revoke execute on function public.community_admin_retry_operations_escalation(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;

grant execute on function public.community_get_operations_escalation_deliveries(uuid,text,integer)
to service_role;

grant execute on function public.community_admin_retry_operations_escalation(
  uuid,uuid,bigint,uuid,text
) to service_role;

do $$
begin
  if not exists(
    select 1
    from cron.job
    where jobname='community-operations-escalation-alerts-every-minute'
  ) then
    perform cron.schedule(
      'community-operations-escalation-alerts-every-minute',
      '* * * * *',
      'select private.community_refresh_operations_escalation_alerts();'
    );
  end if;
end;
$$;
