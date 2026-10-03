
insert into private.community_security_config(policy_key,integer_value)
values ('support_admin_recent_auth_seconds',900)
on conflict (policy_key) do nothing;

create or replace function private.require_recent_admin(
  p_auth_subject uuid,
  p_issued_at_epoch bigint
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_window integer;
  v_auth jsonb;
  v_account_id uuid;
begin
  select integer_value into v_window
  from private.community_security_config
  where policy_key='support_admin_recent_auth_seconds';

  if v_window is null then
    raise exception 'Support admin recent-auth policy is not configured';
  end if;

  v_auth := public.community_authorize_session(
    p_auth_subject,
    p_issued_at_epoch,
    v_window
  );

  v_account_id := (v_auth->>'accountId')::uuid;

  if not exists (
    select 1
    from public.account_roles
    where account_id=v_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  return v_account_id;
end;
$$;

create or replace function public.community_get_recovery_cases(
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

  if p_state is not null and p_state not in ('open','completed','rejected','cancelled') then
    raise exception 'Unsupported recovery state';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recoveryCaseId',r.recovery_case_id,
        'accountId',r.account_id,
        'state',r.state,
        'requestedProvider',r.requested_provider,
        'verificationRefPresent',r.verification_ref is not null,
        'reason',r.reason,
        'openedByAccountId',r.opened_by_account_id,
        'completedByAccountId',r.completed_by_account_id,
        'createdAt',r.created_at,
        'updatedAt',r.updated_at,
        'completedAt',r.completed_at
      )
      order by r.created_at desc,r.recovery_case_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.account_recovery_cases
    where p_state is null or state=p_state
    order by created_at desc,recovery_case_id
    limit p_limit
  ) r;

  return v_result;
end;
$$;

create or replace function public.community_get_provider_cleanup_jobs(
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
    raise exception 'Unsupported provider cleanup state';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cleanupJobId',j.cleanup_job_id,
        'accountId',j.account_id,
        'provider',j.provider,
        'state',j.state,
        'attempts',j.attempts,
        'lastError',j.last_error,
        'requestedAt',j.requested_at,
        'nextAttemptAt',j.next_attempt_at,
        'lockedAt',j.locked_at,
        'completedAt',j.completed_at,
        'deadLetteredAt',j.dead_lettered_at
      )
      order by j.requested_at desc,j.cleanup_job_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      cleanup_job_id,account_id,provider,state,attempts,last_error,
      requested_at,next_attempt_at,locked_at,completed_at,dead_lettered_at
    from private.provider_cleanup_jobs
    where p_state is null or state=p_state
    order by requested_at desc,cleanup_job_id
    limit p_limit
  ) j;

  return v_result;
end;
$$;

create or replace function public.community_admin_open_recovery_case(
  p_admin_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_account_id uuid,
  p_new_provider text,
  p_new_provider_subject text,
  p_reason text,
  p_verification_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.require_recent_admin(p_admin_auth_subject,p_issued_at_epoch);

  return public.community_open_recovery_case(
    p_admin_auth_subject,
    p_account_id,
    p_new_provider,
    p_new_provider_subject,
    p_reason,
    p_verification_ref
  );
end;
$$;

create or replace function public.community_admin_complete_recovery(
  p_admin_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_recovery_case_id uuid,
  p_completion_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.require_recent_admin(p_admin_auth_subject,p_issued_at_epoch);

  return public.community_complete_recovery(
    p_admin_auth_subject,
    p_recovery_case_id,
    p_completion_reason
  );
end;
$$;

create or replace function public.community_admin_retry_provider_cleanup(
  p_admin_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_cleanup_job_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_job private.provider_cleanup_jobs%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0) < 8
     or length(btrim(p_reason)) > 500 then
    raise exception 'Retry reason must be 8-500 characters';
  end if;

  select * into v_job
  from private.provider_cleanup_jobs
  where cleanup_job_id=p_cleanup_job_id
  for update;

  if v_job.cleanup_job_id is null then
    raise exception 'Provider cleanup job not found';
  end if;

  if v_job.state <> 'dead_letter' then
    raise exception 'Provider cleanup job is not dead-lettered';
  end if;

  update private.provider_cleanup_jobs
  set state='pending',
      attempts=0,
      last_error=null,
      next_attempt_at=now(),
      locked_at=null,
      lock_token=null,
      dead_lettered_at=null
  where cleanup_job_id=p_cleanup_job_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,
    'provider_cleanup.dead_letter_requeued',
    null,
    jsonb_build_object(
      'cleanupJobId',v_job.cleanup_job_id,
      'accountId',v_job.account_id,
      'provider',v_job.provider,
      'priorAttempts',v_job.attempts,
      'priorLastError',v_job.last_error,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'cleanupJobId',v_job.cleanup_job_id,
    'state','pending',
    'attempts',0,
    'nextAttemptAt',now()
  );
end;
$$;

revoke execute on function private.require_recent_admin(uuid,bigint)
from public,anon,authenticated;

revoke execute on function public.community_get_recovery_cases(uuid,text,integer)
from public,anon,authenticated;
revoke execute on function public.community_get_provider_cleanup_jobs(uuid,text,integer)
from public,anon,authenticated;
revoke execute on function public.community_admin_open_recovery_case(
  uuid,bigint,uuid,text,text,text,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_complete_recovery(
  uuid,bigint,uuid,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_retry_provider_cleanup(
  uuid,bigint,uuid,text
) from public,anon,authenticated;

grant execute on function private.require_recent_admin(uuid,bigint)
to service_role;
grant execute on function public.community_get_recovery_cases(uuid,text,integer)
to service_role;
grant execute on function public.community_get_provider_cleanup_jobs(uuid,text,integer)
to service_role;
grant execute on function public.community_admin_open_recovery_case(
  uuid,bigint,uuid,text,text,text,text
) to service_role;
grant execute on function public.community_admin_complete_recovery(
  uuid,bigint,uuid,text
) to service_role;
grant execute on function public.community_admin_retry_provider_cleanup(
  uuid,bigint,uuid,text
) to service_role;
