
alter table public.auth_identities
  add column if not exists identity_state text not null default 'active'
    check (identity_state in ('active','retired')),
  add column if not exists retired_at timestamptz null,
  add column if not exists replaced_by_auth_identity_id uuid null
    references public.auth_identities(auth_identity_id);

create index if not exists auth_identities_active_account_idx
  on public.auth_identities(account_id)
  where identity_state='active';

create table if not exists public.account_recovery_cases (
  recovery_case_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wand_accounts(account_id),
  state text not null default 'open'
    check (state in ('open','completed','rejected','cancelled')),
  requested_provider text not null,
  requested_provider_subject text not null,
  verification_ref text null,
  reason text not null,
  opened_by_account_id uuid not null references public.wand_accounts(account_id),
  completed_by_account_id uuid null references public.wand_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create unique index if not exists account_recovery_cases_one_open_per_account
  on public.account_recovery_cases(account_id)
  where state='open';

create index if not exists account_recovery_cases_state_created_idx
  on public.account_recovery_cases(state,created_at);

alter table public.account_recovery_cases enable row level security;
revoke all on public.account_recovery_cases from anon, authenticated;

create or replace function private.resolve_active_account(p_auth_subject uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_status account_status;
begin
  select a.account_id, a.status
    into v_account_id, v_status
  from public.auth_identities i
  join public.wand_accounts a on a.account_id = i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
    and i.identity_state='active'
  limit 1;

  if v_account_id is null then
    raise exception 'WandAccount mapping not found for active Supabase subject';
  end if;
  if v_status <> 'active' then
    raise exception 'WandAccount is not active';
  end if;
  return v_account_id;
end;
$$;

create or replace function public.community_open_recovery_case(
  p_admin_auth_subject uuid,
  p_account_id uuid,
  p_new_provider text,
  p_new_provider_subject text,
  p_reason text,
  p_verification_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_admin_account_id uuid;
  v_case_id uuid;
  v_target_status account_status;
  v_target_deleted_at timestamptz;
begin
  v_admin_account_id := private.resolve_active_account(p_admin_auth_subject);

  if not exists (
    select 1 from public.account_roles
    where account_id=v_admin_account_id and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if coalesce(length(btrim(p_new_provider)),0)=0
     or coalesce(length(btrim(p_new_provider_subject)),0)=0 then
    raise exception 'New provider and provider subject are required';
  end if;

  if coalesce(length(btrim(p_reason)),0)<8 then
    raise exception 'Recovery reason is required';
  end if;

  select status,deleted_at
    into v_target_status,v_target_deleted_at
  from public.wand_accounts
  where account_id=p_account_id
  for update;

  if v_target_status is null then raise exception 'Target WandAccount not found'; end if;
  if v_target_status='deleted' or v_target_deleted_at is not null then
    raise exception 'Deleted WandAccount cannot be recovered automatically';
  end if;

  if exists (
    select 1 from public.auth_identities
    where provider=btrim(p_new_provider)
      and provider_subject=btrim(p_new_provider_subject)
  ) then
    raise exception 'Requested AuthIdentity already exists';
  end if;

  insert into public.account_recovery_cases(
    account_id,requested_provider,requested_provider_subject,
    verification_ref,reason,opened_by_account_id
  ) values (
    p_account_id,btrim(p_new_provider),btrim(p_new_provider_subject),
    nullif(btrim(coalesce(p_verification_ref,'')),''),
    btrim(p_reason),v_admin_account_id
  )
  returning recovery_case_id into v_case_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'account.recovery_opened',null,
    jsonb_build_object(
      'accountId',p_account_id,
      'recoveryCaseId',v_case_id,
      'requestedProvider',btrim(p_new_provider),
      'verificationRefPresent',p_verification_ref is not null
    )
  );

  return jsonb_build_object(
    'recoveryCaseId',v_case_id,
    'accountId',p_account_id,
    'state','open'
  );
end;
$$;

create or replace function public.community_complete_recovery(
  p_admin_auth_subject uuid,
  p_recovery_case_id uuid,
  p_completion_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_admin_account_id uuid;
  v_case public.account_recovery_cases%rowtype;
  v_account public.wand_accounts%rowtype;
  v_new_identity_id uuid;
  v_retired_count integer;
begin
  v_admin_account_id := private.resolve_active_account(p_admin_auth_subject);

  if not exists (
    select 1 from public.account_roles
    where account_id=v_admin_account_id and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  if coalesce(length(btrim(p_completion_reason)),0)<8 then
    raise exception 'Completion reason is required';
  end if;

  select * into v_case
  from public.account_recovery_cases
  where recovery_case_id=p_recovery_case_id
  for update;

  if v_case.recovery_case_id is null then raise exception 'Recovery case not found'; end if;
  if v_case.state<>'open' then raise exception 'Recovery case is not open'; end if;

  select * into v_account
  from public.wand_accounts
  where account_id=v_case.account_id
  for update;

  if v_account.account_id is null then raise exception 'Target WandAccount not found'; end if;
  if v_account.status='deleted' or v_account.deleted_at is not null then
    raise exception 'Deleted WandAccount cannot be recovered automatically';
  end if;

  if exists (
    select 1 from public.auth_identities
    where provider=v_case.requested_provider
      and provider_subject=v_case.requested_provider_subject
  ) then
    raise exception 'Requested AuthIdentity already exists';
  end if;

  insert into public.auth_identities(
    account_id,provider,provider_subject,last_verified_at,identity_state
  ) values (
    v_case.account_id,
    v_case.requested_provider,
    v_case.requested_provider_subject,
    now(),
    'active'
  )
  returning auth_identity_id into v_new_identity_id;

  update public.auth_identities
  set identity_state='retired',
      retired_at=now(),
      replaced_by_auth_identity_id=v_new_identity_id
  where account_id=v_case.account_id
    and auth_identity_id<>v_new_identity_id
    and identity_state='active';

  get diagnostics v_retired_count = row_count;

  update public.account_recovery_cases
  set state='completed',
      completed_by_account_id=v_admin_account_id,
      completed_at=now(),
      updated_at=now()
  where recovery_case_id=p_recovery_case_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'account.recovery_completed',null,
    jsonb_build_object(
      'accountId',v_case.account_id,
      'recoveryCaseId',p_recovery_case_id,
      'newAuthIdentityId',v_new_identity_id,
      'retiredIdentityCount',v_retired_count,
      'completionReason',btrim(p_completion_reason)
    )
  );

  return jsonb_build_object(
    'recoveryCaseId',p_recovery_case_id,
    'accountId',v_case.account_id,
    'newAuthIdentityId',v_new_identity_id,
    'retiredIdentityCount',v_retired_count,
    'accountStatus',v_account.status,
    'state','completed'
  );
end;
$$;

revoke execute on function public.community_open_recovery_case(
  uuid,uuid,text,text,text,text
) from public, anon, authenticated;
revoke execute on function public.community_complete_recovery(
  uuid,uuid,text
) from public, anon, authenticated;

grant execute on function public.community_open_recovery_case(
  uuid,uuid,text,text,text,text
) to service_role;
grant execute on function public.community_complete_recovery(
  uuid,uuid,text
) to service_role;
