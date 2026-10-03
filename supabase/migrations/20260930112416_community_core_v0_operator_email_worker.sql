create or replace function private.community_configure_operations_escalation_scheduler(
  p_worker_url text,
  p_schedule text default '* * * * *'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,vault,extensions,cron
as $$
declare
  v_token text;
  v_id uuid;
  v_job bigint;
  v_old bigint;
begin
  if p_worker_url is null
     or p_worker_url !~ '^https://[A-Za-z0-9.-]+/functions/v1/community-ops-email$' then
    raise exception 'Valid HTTPS community-ops-email worker URL is required';
  end if;

  if p_schedule is null or length(btrim(p_schedule))<1 then
    raise exception 'Cron schedule is required';
  end if;

  v_token:=encode(extensions.gen_random_bytes(32),'hex');

  select id into v_id
  from vault.secrets
  where name='community_operations_escalation_worker_token'
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      v_token,
      'community_operations_escalation_worker_token',
      'Dreamwish Wand operator critical email worker token'
    );
  else
    perform vault.update_secret(
      v_id,
      v_token,
      'community_operations_escalation_worker_token',
      'Dreamwish Wand operator critical email worker token'
    );
  end if;

  v_id:=null;
  select id into v_id
  from vault.secrets
  where name='community_operations_escalation_worker_url'
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      p_worker_url,
      'community_operations_escalation_worker_url',
      'Dreamwish Wand operator critical email Edge URL'
    );
  else
    perform vault.update_secret(
      v_id,
      p_worker_url,
      'community_operations_escalation_worker_url',
      'Dreamwish Wand operator critical email Edge URL'
    );
  end if;

  insert into private.community_worker_auth(
    worker_name,token_hash,rotated_at,last_verified_at
  )
  values(
    'operations_escalation',
    extensions.digest(v_token,'sha256'),
    now(),
    null
  )
  on conflict(worker_name) do update
  set token_hash=excluded.token_hash,
      rotated_at=excluded.rotated_at,
      last_verified_at=null;

  for v_old in
    select jobid
    from cron.job
    where jobname='community-operations-escalation-every-minute'
  loop
    perform cron.unschedule(v_old);
  end loop;

  select cron.schedule(
    'community-operations-escalation-every-minute',
    p_schedule,
    'select private.community_invoke_operations_escalation_worker();'
  )
  into v_job;

  return jsonb_build_object(
    'worker','operations_escalation',
    'transport','operator_email',
    'jobId',v_job,
    'schedule',p_schedule,
    'configured',true
  );
end;
$$;

revoke execute on function private.community_configure_operations_escalation_scheduler(text,text)
from public,anon,authenticated,service_role;
