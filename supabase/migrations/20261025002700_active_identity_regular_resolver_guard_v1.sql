-- DDVRE / 03 COMM R13 P0 Identity Authorization Repair.
-- NEW additive migration; do not mutate the prior 114 applied source files.
-- Regular owner RPCs resolving only a provider subject MUST NOT accept a
-- historical/retired identity belonging to an otherwise still ACTIVE account.
-- This does not replace signed Edge JWT, iat cutoff or session freshness checks.
create or replace function private.resolve_active_account(p_auth_subject uuid)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $r13_active_identity$
declare
  v_account_id uuid;
  v_status public.account_status;
  v_deleted_at timestamptz;
begin
  if p_auth_subject is null then
    raise exception 'Active AuthIdentity not found';
  end if;

  select a.account_id,a.status,a.deleted_at
    into v_account_id,v_status,v_deleted_at
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
    and i.identity_state='active'
    and i.retired_at is null
  limit 1;

  if v_account_id is null then
    raise exception 'Active AuthIdentity not found';
  end if;
  if v_status <> 'active' or v_deleted_at is not null then
    raise exception 'WandAccount is not active';
  end if;
  if private.is_account_privacy_suppressed(v_account_id) then
    raise exception 'ACCOUNT_PRIVACY_SUPPRESSED';
  end if;
  return v_account_id;
end
$r13_active_identity$;

-- Preserve original RPC execute envelope, and never expose direct identity
-- mutation, Graph writer or a new public/service-role Scene Save candidate.
revoke all on function private.resolve_active_account(uuid)
  from public,anon,authenticated;
grant execute on function private.resolve_active_account(uuid)
  to service_role;
