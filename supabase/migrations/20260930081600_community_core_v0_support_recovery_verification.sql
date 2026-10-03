
alter table public.account_recovery_cases
  add column if not exists verification_method text null
    check (verification_method in ('provider_recovery','linked_ddv_profile')),
  add column if not exists verification_state text not null default 'pending'
    check (verification_state in ('pending','verified','rejected')),
  add column if not exists verified_by_account_id uuid null
    references public.wand_accounts(account_id),
  add column if not exists verified_at timestamptz null,
  add column if not exists ready_at timestamptz null;

create index if not exists account_recovery_cases_verification_idx
  on public.account_recovery_cases(verification_state,ready_at,created_at);

create or replace function public.community_admin_open_recovery_case_v2(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_account_id uuid,
  p_new_provider text,
  p_new_provider_subject text,
  p_verification_method text,
  p_verification_ref text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_case_id uuid;
  v_target_status account_status;
  v_target_deleted_at timestamptz;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if p_verification_method not in ('provider_recovery','linked_ddv_profile') then
    raise exception 'Unsupported recovery verification method';
  end if;

  if p_verification_method='linked_ddv_profile' then
    raise exception 'Linked DDV Profile recovery is not enabled until a stable claim contract is confirmed';
  end if;

  if coalesce(length(btrim(p_verification_ref)),0) < 8
     or length(btrim(p_verification_ref)) > 256 then
    raise exception 'Opaque verification reference must be 8-256 characters';
  end if;

  if coalesce(length(btrim(p_new_provider)),0)=0
     or coalesce(length(btrim(p_new_provider_subject)),0)=0 then
    raise exception 'New provider and provider subject are required';
  end if;

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Recovery reason must be 8-500 characters';
  end if;

  select status,deleted_at
    into v_target_status,v_target_deleted_at
  from public.wand_accounts
  where account_id=p_account_id
  for update;

  if v_target_status is null then
    raise exception 'Target WandAccount not found';
  end if;

  if v_target_status='deleted' or v_target_deleted_at is not null then
    raise exception 'Deleted WandAccount cannot be recovered';
  end if;

  if exists (
    select 1
    from public.auth_identities
    where provider=btrim(p_new_provider)
      and provider_subject=btrim(p_new_provider_subject)
  ) then
    raise exception 'Requested AuthIdentity already exists';
  end if;

  if exists (
    select 1
    from public.account_recovery_cases
    where account_id=p_account_id
      and state='open'
  ) then
    raise exception 'An open recovery case already exists for this WandAccount';
  end if;

  insert into public.account_recovery_cases(
    account_id,state,requested_provider,requested_provider_subject,
    verification_method,verification_state,verification_ref,
    reason,opened_by_account_id
  ) values (
    p_account_id,'open',btrim(p_new_provider),btrim(p_new_provider_subject),
    p_verification_method,'pending',btrim(p_verification_ref),
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
      'verificationMethod',p_verification_method,
      'verificationRefPresent',true
    )
  );

  return jsonb_build_object(
    'recoveryCaseId',v_case_id,
    'accountId',p_account_id,
    'state','open',
    'verificationState','pending',
    'verificationMethod',p_verification_method
  );
end;
$$;

create or replace function public.community_admin_verify_recovery_case(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_recovery_case_id uuid,
  p_verification_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_case public.account_recovery_cases%rowtype;
  v_verified_at timestamptz := clock_timestamp();
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_verification_note)),0) < 8
     or length(btrim(p_verification_note)) > 500 then
    raise exception 'Verification note must be 8-500 characters';
  end if;

  select * into v_case
  from public.account_recovery_cases
  where recovery_case_id=p_recovery_case_id
  for update;

  if v_case.recovery_case_id is null then
    raise exception 'Recovery case not found';
  end if;

  if v_case.state<>'open' then
    raise exception 'Recovery case is not open';
  end if;

  if v_case.verification_state<>'pending' then
    raise exception 'Recovery verification is not pending';
  end if;

  if v_case.verification_method='linked_ddv_profile' then
    raise exception 'Linked DDV Profile recovery is not enabled until a stable claim contract is confirmed';
  end if;

  if v_case.verification_method<>'provider_recovery'
     or coalesce(length(btrim(v_case.verification_ref)),0)<8 then
    raise exception 'Strong recovery verification evidence is required';
  end if;

  update public.account_recovery_cases
  set verification_state='verified',
      verified_by_account_id=v_admin_account_id,
      verified_at=v_verified_at,
      ready_at=v_verified_at,
      updated_at=v_verified_at
  where recovery_case_id=p_recovery_case_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'account.recovery_verified',null,
    jsonb_build_object(
      'accountId',v_case.account_id,
      'recoveryCaseId',p_recovery_case_id,
      'verificationMethod',v_case.verification_method,
      'verificationNote',btrim(p_verification_note)
    )
  );

  return jsonb_build_object(
    'recoveryCaseId',p_recovery_case_id,
    'accountId',v_case.account_id,
    'state','open',
    'verificationState','verified',
    'verifiedAt',v_verified_at,
    'readyAt',v_verified_at
  );
end;
$$;

create or replace function public.community_admin_complete_recovery_v2(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_recovery_case_id uuid,
  p_completion_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_case public.account_recovery_cases%rowtype;
  v_account public.wand_accounts%rowtype;
  v_new_identity_id uuid;
  v_retired_count integer;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_completion_reason)),0)<8
     or length(btrim(p_completion_reason))>500 then
    raise exception 'Completion reason must be 8-500 characters';
  end if;

  select * into v_case
  from public.account_recovery_cases
  where recovery_case_id=p_recovery_case_id
  for update;

  if v_case.recovery_case_id is null then
    raise exception 'Recovery case not found';
  end if;

  if v_case.state<>'open' then
    raise exception 'Recovery case is not open';
  end if;

  if v_case.verification_state<>'verified'
     or v_case.verified_at is null
     or v_case.ready_at is null
     or v_case.ready_at > clock_timestamp() then
    raise exception 'Recovery case is not verified and ready';
  end if;

  select * into v_account
  from public.wand_accounts
  where account_id=v_case.account_id
  for update;

  if v_account.account_id is null then
    raise exception 'Target WandAccount not found';
  end if;

  if v_account.status='deleted' or v_account.deleted_at is not null then
    raise exception 'Deleted WandAccount cannot be recovered';
  end if;

  if exists (
    select 1
    from public.auth_identities
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
      replaced_by_auth_identity_id=v_new_identity_id,
      sessions_valid_after=now()
  where account_id=v_case.account_id
    and auth_identity_id<>v_new_identity_id
    and identity_state='active';

  get diagnostics v_retired_count=row_count;

  update public.account_recovery_cases
  set state='completed',
      completed_by_account_id=v_admin_account_id,
      completed_at=now(),
      updated_at=now(),
      requested_provider_subject='completed:' || recovery_case_id::text,
      verification_ref=null
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
      'verificationMethod',v_case.verification_method,
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
        'verificationMethod',r.verification_method,
        'verificationState',r.verification_state,
        'verificationRefPresent',r.verification_ref is not null,
        'verifiedAt',r.verified_at,
        'readyAt',r.ready_at,
        'reason',r.reason,
        'openedByAccountId',r.opened_by_account_id,
        'verifiedByAccountId',r.verified_by_account_id,
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

revoke execute on function public.community_admin_open_recovery_case_v2(
  uuid,uuid,bigint,uuid,text,text,text,text,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_verify_recovery_case(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_complete_recovery_v2(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;

grant execute on function public.community_admin_open_recovery_case_v2(
  uuid,uuid,bigint,uuid,text,text,text,text,text
) to service_role;
grant execute on function public.community_admin_verify_recovery_case(
  uuid,uuid,bigint,uuid,text
) to service_role;
grant execute on function public.community_admin_complete_recovery_v2(
  uuid,uuid,bigint,uuid,text
) to service_role;
