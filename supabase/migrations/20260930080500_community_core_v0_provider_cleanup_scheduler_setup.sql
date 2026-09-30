
create or replace function private.community_configure_provider_cleanup_scheduler(
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
  v_token_secret_id uuid;
  v_url_secret_id uuid;
  v_job_id bigint;
begin
  if p_worker_url is null
     or p_worker_url !~ '^https://[A-Za-z0-9.-]+/functions/v1/community-auth$' then
    raise exception 'Valid HTTPS community-auth worker URL is required';
  end if;

  if p_schedule is null or length(btrim(p_schedule)) < 1 then
    raise exception 'Cron schedule is required';
  end if;

  v_token := encode(extensions.gen_random_bytes(32),'hex');

  select id into v_token_secret_id
  from vault.secrets
  where name='community_provider_cleanup_worker_token'
  limit 1;

  if v_token_secret_id is null then
    perform vault.create_secret(
      v_token,
      'community_provider_cleanup_worker_token',
      'Dreamwish Wand provider cleanup Cron worker token'
    );
  else
    perform vault.update_secret(
      v_token_secret_id,
      v_token,
      'community_provider_cleanup_worker_token',
      'Dreamwish Wand provider cleanup Cron worker token'
    );
  end if;

  select id into v_url_secret_id
  from vault.secrets
  where name='community_provider_cleanup_worker_url'
  limit 1;

  if v_url_secret_id is null then
    perform vault.create_secret(
      p_worker_url,
      'community_provider_cleanup_worker_url',
      'Dreamwish Wand provider cleanup Edge URL'
    );
  else
    perform vault.update_secret(
      v_url_secret_id,
      p_worker_url,
      'community_provider_cleanup_worker_url',
      'Dreamwish Wand provider cleanup Edge URL'
    );
  end if;

  insert into private.community_worker_auth(
    worker_name,token_hash,rotated_at,last_verified_at
  ) values (
    'provider_cleanup',
    extensions.digest(v_token,'sha256'),
    now(),
    null
  )
  on conflict (worker_name) do update
  set token_hash=excluded.token_hash,
      rotated_at=excluded.rotated_at,
      last_verified_at=null;

  select cron.schedule(
    'community-provider-cleanup-every-minute',
    p_schedule,
    'select private.community_invoke_provider_cleanup_worker();'
  )
  into v_job_id;

  return jsonb_build_object(
    'worker','provider_cleanup',
    'jobId',v_job_id,
    'schedule',p_schedule,
    'configured',true
  );
end;
$$;

revoke execute on function private.community_configure_provider_cleanup_scheduler(text,text)
from public,anon,authenticated,service_role;
