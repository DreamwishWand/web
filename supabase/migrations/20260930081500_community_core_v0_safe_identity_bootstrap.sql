
create or replace function public.community_authorize_identity_bootstrap(
  p_auth_subject uuid,
  p_issued_at_epoch bigint
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_active_account_id uuid;
  v_existing_auth jsonb;
begin
  if p_auth_subject is null then
    raise exception 'Authenticated subject is required';
  end if;

  if p_issued_at_epoch is null or p_issued_at_epoch <= 0 then
    raise exception 'JWT issued-at claim is required';
  end if;

  select i.account_id
    into v_active_account_id
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
    and i.identity_state='active'
  limit 1;

  if v_active_account_id is not null then
    v_existing_auth := public.community_authorize_session(
      p_auth_subject,
      p_issued_at_epoch,
      null
    );

    return v_existing_auth || jsonb_build_object('mode','existing');
  end if;

  if exists (
    select 1
    from public.auth_identities i
    where i.provider='supabase'
      and i.provider_subject=p_auth_subject::text
      and i.identity_state<>'active'
  ) then
    raise exception 'Retired AuthIdentity cannot bootstrap';
  end if;

  if exists (
    select 1
    from private.provider_cleanup_jobs j
    where j.provider='supabase'
      and j.provider_subject=p_auth_subject::text
      and j.state in ('pending','processing','dead_letter')
  ) then
    raise exception 'Provider identity is pending deletion';
  end if;

  if exists (
    select 1
    from public.account_recovery_cases r
    where r.requested_provider='supabase'
      and r.requested_provider_subject=p_auth_subject::text
      and r.state='open'
  ) then
    raise exception 'Provider identity is reserved by an open recovery case';
  end if;

  return jsonb_build_object(
    'mode','bootstrap',
    'authSubject',p_auth_subject
  );
end;
$$;

create or replace function public.community_ensure_account_creator(
  p_auth_subject uuid,
  p_handle text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_creator_id uuid;
  v_account_status account_status;
  v_account_deleted_at timestamptz;
begin
  if p_auth_subject is null then
    raise exception 'Authenticated subject is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('identity:' || p_auth_subject::text,0)
  );

  select i.account_id,a.status,a.deleted_at
    into v_account_id,v_account_status,v_account_deleted_at
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
    and i.identity_state='active'
  limit 1;

  if v_account_id is not null then
    if v_account_status <> 'active' or v_account_deleted_at is not null then
      raise exception 'WandAccount is not active';
    end if;
  else
    if exists (
      select 1
      from public.auth_identities i
      where i.provider='supabase'
        and i.provider_subject=p_auth_subject::text
        and i.identity_state<>'active'
    ) then
      raise exception 'Retired AuthIdentity cannot bootstrap';
    end if;

    if exists (
      select 1
      from private.provider_cleanup_jobs j
      where j.provider='supabase'
        and j.provider_subject=p_auth_subject::text
        and j.state in ('pending','processing','dead_letter')
    ) then
      raise exception 'Provider identity is pending deletion';
    end if;

    if exists (
      select 1
      from public.account_recovery_cases r
      where r.requested_provider='supabase'
        and r.requested_provider_subject=p_auth_subject::text
        and r.state='open'
    ) then
      raise exception 'Provider identity is reserved by an open recovery case';
    end if;

    insert into public.wand_accounts default values
    returning account_id into v_account_id;

    insert into public.auth_identities(
      account_id,
      provider,
      provider_subject,
      identity_state,
      last_verified_at
    ) values (
      v_account_id,
      'supabase',
      p_auth_subject::text,
      'active',
      now()
    );
  end if;

  select creator_profile_id
    into v_creator_id
  from public.creator_profiles
  where owner_account_id=v_account_id;

  if v_creator_id is null then
    v_creator_id := gen_random_uuid();

    insert into public.community_entities(entity_id,entity_type)
    values(v_creator_id,'creator_profile');

    insert into public.creator_profiles(
      creator_profile_id,
      owner_account_id,
      handle,
      display_name
    ) values (
      v_creator_id,
      v_account_id,
      p_handle,
      p_display_name
    );

    insert into public.outbox_events(
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      dedupe_key
    ) values (
      'creator_profile',
      v_creator_id,
      'creator.created',
      jsonb_build_object('creatorProfileId',v_creator_id),
      'creator.created:' || v_creator_id::text
    );
  end if;

  return jsonb_build_object(
    'accountId',v_account_id,
    'creatorProfileId',v_creator_id
  );
end;
$$;

revoke execute on function public.community_authorize_identity_bootstrap(uuid,bigint)
from public,anon,authenticated;
revoke execute on function public.community_ensure_account_creator(uuid,text,text)
from public,anon,authenticated;

grant execute on function public.community_authorize_identity_bootstrap(uuid,bigint)
to service_role;
grant execute on function public.community_ensure_account_creator(uuid,text,text)
to service_role;
