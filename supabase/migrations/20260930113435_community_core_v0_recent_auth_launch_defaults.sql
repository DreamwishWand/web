insert into private.community_security_config(policy_key,integer_value,updated_at)
values
  ('account_delete_recent_auth_seconds',900,now()),
  ('support_admin_recent_auth_seconds',900,now())
on conflict(policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=excluded.updated_at;

create or replace function public.community_get_security_policy_summary(
  p_admin_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_account_delete integer;
  v_support_admin integer;
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

  select integer_value
    into v_account_delete
  from private.community_security_config
  where policy_key='account_delete_recent_auth_seconds';

  select integer_value
    into v_support_admin
  from private.community_security_config
  where policy_key='support_admin_recent_auth_seconds';

  if v_account_delete is null or v_support_admin is null then
    raise exception 'Recent-auth launch policy is incomplete';
  end if;

  return jsonb_build_object(
    'accountDeleteRecentAuthSeconds',v_account_delete,
    'supportAdminRecentAuthSeconds',v_support_admin,
    'sessionBound',true,
    'source','auth.sessions.created_at'
  );
end;
$$;

revoke execute on function public.community_get_security_policy_summary(uuid)
from public,anon,authenticated;

grant execute on function public.community_get_security_policy_summary(uuid)
to service_role;
