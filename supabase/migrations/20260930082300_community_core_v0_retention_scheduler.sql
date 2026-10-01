
create or replace function private.community_invoke_retention_worker()
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,public,private,vault,net
as $$
declare
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name='community_retention_worker_url'
  limit 1;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='community_retention_worker_token'
  limit 1;

  if v_url is null or v_token is null then
    raise exception 'Retention worker Vault configuration is incomplete';
  end if;

  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-community-worker-token',v_token
    ),
    body:=jsonb_build_object('limit',20),
    timeout_milliseconds:=30000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

create or replace function private.community_configure_retention_scheduler(
  p_worker_url text,
  p_schedule text default '17 * * * *'
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
     or p_worker_url !~ '^https://[A-Za-z0-9.-]+/functions/v1/community-retention$' then
    raise exception 'Valid HTTPS community-retention worker URL is required';
  end if;

  if p_schedule is null or length(btrim(p_schedule)) < 1 then
    raise exception 'Cron schedule is required';
  end if;

  v_token := encode(extensions.gen_random_bytes(32),'hex');

  select id into v_token_secret_id
  from vault.secrets
  where name='community_retention_worker_token'
  limit 1;

  if v_token_secret_id is null then
    perform vault.create_secret(
      v_token,
      'community_retention_worker_token',
      'Dreamwish Wand account retention worker token'
    );
  else
    perform vault.update_secret(
      v_token_secret_id,
      v_token,
      'community_retention_worker_token',
      'Dreamwish Wand account retention worker token'
    );
  end if;

  select id into v_url_secret_id
  from vault.secrets
  where name='community_retention_worker_url'
  limit 1;

  if v_url_secret_id is null then
    perform vault.create_secret(
      p_worker_url,
      'community_retention_worker_url',
      'Dreamwish Wand account retention Edge URL'
    );
  else
    perform vault.update_secret(
      v_url_secret_id,
      p_worker_url,
      'community_retention_worker_url',
      'Dreamwish Wand account retention Edge URL'
    );
  end if;

  insert into private.community_worker_auth(
    worker_name,token_hash,rotated_at,last_verified_at
  ) values (
    'retention_cleanup',
    extensions.digest(v_token,'sha256'),
    now(),
    null
  )
  on conflict (worker_name) do update
  set token_hash=excluded.token_hash,
      rotated_at=excluded.rotated_at,
      last_verified_at=null;

  select cron.schedule(
    'community-retention-hourly',
    p_schedule,
    'select private.community_invoke_retention_worker();'
  )
  into v_job_id;

  return jsonb_build_object(
    'worker','retention_cleanup',
    'jobId',v_job_id,
    'schedule',p_schedule,
    'configured',true
  );
end;
$$;

revoke execute on function private.community_invoke_retention_worker()
from public,anon,authenticated,service_role;
revoke execute on function private.community_configure_retention_scheduler(text,text)
from public,anon,authenticated,service_role;
