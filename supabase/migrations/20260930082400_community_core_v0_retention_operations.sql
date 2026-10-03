
alter table private.community_operations_alerts
  drop constraint if exists community_operations_alerts_alert_type_check;

alter table private.community_operations_alerts
  add constraint community_operations_alerts_alert_type_check
  check (alert_type in (
    'provider_cleanup_dead_letter',
    'outbox_dead_letter',
    'provider_cleanup_scheduler_stale',
    'retention_dead_letter',
    'retention_scheduler_stale'
  ));

create or replace function private.community_refresh_retention_operations_alerts()
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
    'retention_dead_letter:' || j.retention_job_id::text,
    'retention_dead_letter',
    'critical',
    j.retention_job_id,
    'open',
    'Account retention job reached dead-letter state.',
    jsonb_build_object(
      'stage',j.stage,
      'attempts',j.attempts,
      'deadLetteredAt',j.dead_lettered_at
    ),
    now(),
    now(),
    null
  from private.account_retention_jobs j
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

  select coalesce(bool_or(active),false)
  into v_cron_active
  from cron.job
  where jobname='community-retention-hourly';

  select last_verified_at
  into v_last_verified_at
  from private.community_worker_auth
  where worker_name='retention_cleanup';

  v_worker_healthy :=
    v_cron_active
    and v_last_verified_at is not null
    and v_last_verified_at >= now()-interval '2 hours';

  if not v_worker_healthy then
    insert into private.community_operations_alerts(
      dedupe_key,alert_type,severity,source_id,state,message,metadata,
      first_seen_at,last_seen_at,resolved_at
    ) values (
      'retention_scheduler_stale',
      'retention_scheduler_stale',
      'critical',
      null,
      'open',
      'Account retention scheduler/worker heartbeat is stale or inactive.',
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
  where a.alert_type='retention_dead_letter'
    and a.state<>'resolved'
    and not exists (
      select 1
      from private.account_retention_jobs j
      where j.retention_job_id=a.source_id
        and j.state='dead_letter'
    );

  if v_worker_healthy then
    update private.community_operations_alerts
    set state='resolved',
        resolved_at=now(),
        last_seen_at=now()
    where dedupe_key='retention_scheduler_stale'
      and state<>'resolved';
  end if;

  select count(*)
  into v_open_count
  from private.community_operations_alerts
  where alert_type in ('retention_dead_letter','retention_scheduler_stale')
    and state<>'resolved';

  return jsonb_build_object(
    'openOrAcknowledgedRetentionAlerts',v_open_count,
    'retentionWorkerHealthy',v_worker_healthy,
    'lastVerifiedAt',v_last_verified_at
  );
end;
$$;

create or replace function public.community_get_retention_jobs(
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
    select 1 from public.account_roles
    where account_id=v_admin_account_id and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if p_state is not null
     and p_state not in ('pending','processing','completed','dead_letter') then
    raise exception 'Unsupported retention-job state';
  end if;

  if p_limit<1 or p_limit>200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'retentionJobId',j.retention_job_id,
        'accountId',j.account_id,
        'stage',j.stage,
        'state',j.state,
        'dueAt',j.due_at,
        'nextAttemptAt',j.next_attempt_at,
        'attempts',j.attempts,
        'lastError',j.last_error,
        'completedAt',j.completed_at,
        'deadLetteredAt',j.dead_lettered_at
      )
      order by j.due_at,j.retention_job_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from private.account_retention_jobs
    where p_state is null or state=p_state
    order by due_at,retention_job_id
    limit p_limit
  ) j;

  return v_result;
end;
$$;

create or replace function public.community_admin_retry_retention_job(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_retention_job_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_job private.account_retention_jobs%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,p_session_id,p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Retry reason must be 8-500 characters';
  end if;

  select * into v_job
  from private.account_retention_jobs
  where retention_job_id=p_retention_job_id
  for update;

  if v_job.retention_job_id is null then
    raise exception 'Retention job not found';
  end if;

  if v_job.state<>'dead_letter' then
    raise exception 'Retention job is not dead-lettered';
  end if;

  update private.account_retention_jobs
  set state='pending',
      attempts=0,
      last_error=null,
      next_attempt_at=greatest(now(),due_at),
      locked_at=null,
      lock_token=null,
      dead_lettered_at=null
  where retention_job_id=p_retention_job_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'retention.dead_letter_requeued',null,
    jsonb_build_object(
      'retentionJobId',v_job.retention_job_id,
      'accountId',v_job.account_id,
      'stage',v_job.stage,
      'priorAttempts',v_job.attempts,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'retentionJobId',v_job.retention_job_id,
    'stage',v_job.stage,
    'state','pending',
    'attempts',0
  );
end;
$$;

create or replace function public.community_get_retention_holds(
  p_admin_auth_subject uuid,
  p_account_id uuid default null,
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
    select 1 from public.account_roles
    where account_id=v_admin_account_id and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if p_limit<1 or p_limit>200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'holdId',h.hold_id,
        'accountId',h.account_id,
        'holdType',h.hold_type,
        'reason',h.reason,
        'createdByAccountId',h.created_by_account_id,
        'createdAt',h.created_at,
        'expiresAt',h.expires_at,
        'releasedAt',h.released_at,
        'releasedByAccountId',h.released_by_account_id
      )
      order by h.created_at desc,h.hold_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from private.account_retention_holds
    where p_account_id is null or account_id=p_account_id
    order by created_at desc,hold_id
    limit p_limit
  ) h;

  return v_result;
end;
$$;

revoke execute on function private.community_refresh_retention_operations_alerts()
from public,anon,authenticated,service_role;
revoke execute on function public.community_get_retention_jobs(uuid,text,integer)
from public,anon,authenticated;
revoke execute on function public.community_admin_retry_retention_job(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;
revoke execute on function public.community_get_retention_holds(uuid,uuid,integer)
from public,anon,authenticated;

grant execute on function public.community_get_retention_jobs(uuid,text,integer)
to service_role;
grant execute on function public.community_admin_retry_retention_job(
  uuid,uuid,bigint,uuid,text
) to service_role;
grant execute on function public.community_get_retention_holds(uuid,uuid,integer)
to service_role;

select cron.schedule(
  'community-retention-alerts-every-minute',
  '* * * * *',
  'select private.community_refresh_retention_operations_alerts();'
);
