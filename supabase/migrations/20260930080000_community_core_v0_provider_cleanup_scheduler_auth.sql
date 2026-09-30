
create extension if not exists pg_net;

create table if not exists private.community_worker_auth (
  worker_name text primary key,
  token_hash bytea not null,
  rotated_at timestamptz not null default now(),
  last_verified_at timestamptz null
);

revoke all on private.community_worker_auth from public, anon, authenticated;

create or replace function public.community_verify_worker_token(
  p_worker_name text,
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_expected bytea;
  v_actual bytea;
begin
  if p_worker_name is null or p_token is null or length(p_token) < 32 then
    return false;
  end if;

  select token_hash into v_expected
  from private.community_worker_auth
  where worker_name=p_worker_name;

  if v_expected is null then
    return false;
  end if;

  v_actual := digest(p_token,'sha256');

  if v_actual <> v_expected then
    return false;
  end if;

  update private.community_worker_auth
  set last_verified_at=now()
  where worker_name=p_worker_name;

  return true;
end;
$$;

create or replace function private.community_invoke_provider_cleanup_worker()
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
  where name='community_provider_cleanup_worker_url'
  limit 1;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='community_provider_cleanup_worker_token'
  limit 1;

  if v_url is null or v_token is null then
    raise exception 'Provider cleanup worker Vault configuration is incomplete';
  end if;

  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-community-worker-token',v_token
    ),
    body:=jsonb_build_object('limit',10),
    timeout_milliseconds:=10000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.community_verify_worker_token(text,text)
from public,anon,authenticated;
revoke execute on function private.community_invoke_provider_cleanup_worker()
from public,anon,authenticated;

grant execute on function public.community_verify_worker_token(text,text)
to service_role;
