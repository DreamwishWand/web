
alter table private.provider_cleanup_jobs
  drop constraint if exists provider_cleanup_jobs_state_check;

alter table private.provider_cleanup_jobs
  add constraint provider_cleanup_jobs_state_check
  check (state in ('pending','processing','completed','dead_letter'));

alter table private.provider_cleanup_jobs
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz null,
  add column if not exists lock_token uuid null,
  add column if not exists dead_lettered_at timestamptz null;

create index if not exists provider_cleanup_due_idx
  on private.provider_cleanup_jobs(state,next_attempt_at,requested_at)
  where state in ('pending','processing');

drop function if exists public.community_complete_provider_cleanup(uuid);
drop function if exists public.community_fail_provider_cleanup(uuid,text);

create or replace function public.community_claim_provider_cleanup_jobs(
  p_limit integer,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_limit integer;
  v_jobs jsonb;
begin
  if p_lock_token is null then
    raise exception 'Provider cleanup lock token is required';
  end if;

  v_limit := least(greatest(coalesce(p_limit,10),1),50);

  with candidates as (
    select j.cleanup_job_id
    from private.provider_cleanup_jobs j
    where
      (j.state='pending' and j.next_attempt_at <= now())
      or
      (j.state='processing' and j.locked_at < now() - interval '5 minutes')
    order by j.requested_at,j.cleanup_job_id
    for update skip locked
    limit v_limit
  ),
  claimed as (
    update private.provider_cleanup_jobs j
    set state='processing',
        locked_at=now(),
        lock_token=p_lock_token
    where j.cleanup_job_id in (select cleanup_job_id from candidates)
    returning
      j.cleanup_job_id,
      j.account_id,
      j.provider,
      j.provider_subject,
      j.attempts
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cleanupJobId',cleanup_job_id,
        'accountId',account_id,
        'provider',provider,
        'providerSubject',provider_subject,
        'attempts',attempts
      )
      order by cleanup_job_id
    ),
    '[]'::jsonb
  )
  into v_jobs
  from claimed;

  return jsonb_build_object(
    'lockToken',p_lock_token,
    'jobs',v_jobs
  );
end;
$$;

create or replace function public.community_complete_provider_cleanup(
  p_cleanup_job_id uuid,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_job private.provider_cleanup_jobs%rowtype;
begin
  update private.provider_cleanup_jobs
  set state='completed',
      attempts=attempts+1,
      last_error=null,
      completed_at=now(),
      provider_subject='deleted:' || cleanup_job_id::text,
      locked_at=null,
      lock_token=null
  where cleanup_job_id=p_cleanup_job_id
    and state='processing'
    and lock_token=p_lock_token
  returning * into v_job;

  if v_job.cleanup_job_id is null then
    raise exception 'Claimed provider cleanup job not found';
  end if;

  return jsonb_build_object(
    'cleanupJobId',v_job.cleanup_job_id,
    'state',v_job.state,
    'attempts',v_job.attempts
  );
end;
$$;

create or replace function public.community_fail_provider_cleanup(
  p_cleanup_job_id uuid,
  p_lock_token uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_job private.provider_cleanup_jobs%rowtype;
begin
  update private.provider_cleanup_jobs
  set attempts=attempts+1,
      last_error=left(coalesce(p_error,'provider cleanup failed'),2000),
      state=case when attempts+1 >= 5 then 'dead_letter' else 'pending' end,
      next_attempt_at=case
        when attempts+1 >= 5 then next_attempt_at
        else now() + make_interval(
          secs => least(3600, (30 * power(2,least(attempts,6)))::integer)
        )
      end,
      dead_lettered_at=case when attempts+1 >= 5 then now() else null end,
      locked_at=null,
      lock_token=null
  where cleanup_job_id=p_cleanup_job_id
    and state='processing'
    and lock_token=p_lock_token
  returning * into v_job;

  if v_job.cleanup_job_id is null then
    raise exception 'Claimed provider cleanup job not found';
  end if;

  return jsonb_build_object(
    'cleanupJobId',v_job.cleanup_job_id,
    'state',v_job.state,
    'attempts',v_job.attempts,
    'nextAttemptAt',v_job.next_attempt_at,
    'deadLetteredAt',v_job.dead_lettered_at
  );
end;
$$;

revoke execute on function public.community_claim_provider_cleanup_jobs(integer,uuid)
from public,anon,authenticated;
revoke execute on function public.community_complete_provider_cleanup(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_fail_provider_cleanup(uuid,uuid,text)
from public,anon,authenticated;

grant execute on function public.community_claim_provider_cleanup_jobs(integer,uuid)
to service_role;
grant execute on function public.community_complete_provider_cleanup(uuid,uuid)
to service_role;
grant execute on function public.community_fail_provider_cleanup(uuid,uuid,text)
to service_role;
