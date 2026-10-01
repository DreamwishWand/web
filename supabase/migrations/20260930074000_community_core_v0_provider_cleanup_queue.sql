create table if not exists private.provider_cleanup_jobs (
  cleanup_job_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wand_accounts(account_id),
  provider text not null,
  provider_subject text not null,
  state text not null default 'pending'
    check (state in ('pending','completed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz null
);

create unique index if not exists provider_cleanup_pending_unique
  on private.provider_cleanup_jobs(provider,provider_subject)
  where state='pending';

create or replace function public.community_complete_provider_cleanup(p_cleanup_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_job private.provider_cleanup_jobs%rowtype;
begin
  update private.provider_cleanup_jobs
  set state='completed',
      attempts=attempts+1,
      last_error=null,
      completed_at=now(),
      provider_subject='deleted:' || cleanup_job_id::text
  where cleanup_job_id=p_cleanup_job_id and state='pending'
  returning * into v_job;

  if v_job.cleanup_job_id is null then
    raise exception 'Pending provider cleanup job not found';
  end if;

  return jsonb_build_object('cleanupJobId',v_job.cleanup_job_id,'state',v_job.state,'attempts',v_job.attempts);
end;
$$;

create or replace function public.community_fail_provider_cleanup(p_cleanup_job_id uuid,p_error text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_job private.provider_cleanup_jobs%rowtype;
begin
  update private.provider_cleanup_jobs
  set attempts=attempts+1,
      last_error=left(coalesce(p_error,'provider cleanup failed'),2000)
  where cleanup_job_id=p_cleanup_job_id and state='pending'
  returning * into v_job;

  if v_job.cleanup_job_id is null then
    raise exception 'Pending provider cleanup job not found';
  end if;

  return jsonb_build_object('cleanupJobId',v_job.cleanup_job_id,'state',v_job.state,'attempts',v_job.attempts);
end;
$$;

revoke execute on function public.community_complete_provider_cleanup(uuid)
from public,anon,authenticated;
revoke execute on function public.community_fail_provider_cleanup(uuid,text)
from public,anon,authenticated;
grant execute on function public.community_complete_provider_cleanup(uuid) to service_role;
grant execute on function public.community_fail_provider_cleanup(uuid,text) to service_role;
