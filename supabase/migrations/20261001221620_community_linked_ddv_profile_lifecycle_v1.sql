alter table public.wand_account_ddv_profiles
  add column if not exists relationship_kind text not null default 'self';

alter table public.wand_account_ddv_profiles
  drop constraint if exists wand_account_ddv_profiles_relationship_kind_check;

alter table public.wand_account_ddv_profiles
  add constraint wand_account_ddv_profiles_relationship_kind_check
  check (relationship_kind in ('self','parent_guardian_managed'));

create table if not exists private.ddv_profile_binding_tombstones (
  binding_key_hash text primary key,
  prior_account_id uuid not null references public.wand_accounts(account_id),
  ddv_profile_id uuid not null,
  relationship_kind text not null
    check (relationship_kind in ('self','parent_guardian_managed')),
  reason text not null
    check (reason in ('link_removed','account_deleted','exceptional_correction')),
  revoked_at timestamptz not null default now(),
  purge_after timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ddv_profile_binding_tombstones_prior_account_idx
  on private.ddv_profile_binding_tombstones(prior_account_id,purge_after);

insert into private.community_security_config(policy_key,integer_value,updated_at)
values ('linked_ddv_profile_recent_auth_seconds',900,now())
on conflict(policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=excluded.updated_at;

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values (
  'ddv_profile_link',3600,12,true,now()
)
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;

create or replace function private.community_tombstone_removed_ddv_link()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_binding_key_hash text;
  v_binding_state text;
  v_reason text;
begin
  select d.binding_key_hash,d.binding_state
    into v_binding_key_hash,v_binding_state
  from public.ddv_profiles d
  where d.ddv_profile_id=old.ddv_profile_id
  for update;

  if v_binding_key_hash is not null
     and v_binding_state in ('verified','revoked') then
    v_reason:=case
      when exists (
        select 1 from public.wand_accounts a
        where a.account_id=old.account_id
          and (a.status='deleted' or a.deleted_at is not null)
      ) then 'account_deleted'
      else 'link_removed'
    end;

    insert into private.ddv_profile_binding_tombstones(
      binding_key_hash,
      prior_account_id,
      ddv_profile_id,
      relationship_kind,
      reason,
      revoked_at,
      purge_after
    ) values (
      v_binding_key_hash,
      old.account_id,
      old.ddv_profile_id,
      old.relationship_kind,
      v_reason,
      clock_timestamp(),
      clock_timestamp()+interval '7 days'
    )
    on conflict(binding_key_hash) do update
    set prior_account_id=excluded.prior_account_id,
        ddv_profile_id=excluded.ddv_profile_id,
        relationship_kind=excluded.relationship_kind,
        reason=excluded.reason,
        revoked_at=least(
          private.ddv_profile_binding_tombstones.revoked_at,
          excluded.revoked_at
        ),
        purge_after=greatest(
          private.ddv_profile_binding_tombstones.purge_after,
          excluded.purge_after
        );
  end if;

  delete from public.ddv_profiles
  where ddv_profile_id=old.ddv_profile_id;

  return old;
end;
$$;

drop trigger if exists wand_account_ddv_profiles_tombstone_removed_link
on public.wand_account_ddv_profiles;

create trigger wand_account_ddv_profiles_tombstone_removed_link
after delete on public.wand_account_ddv_profiles
for each row execute function private.community_tombstone_removed_ddv_link();

create or replace function public.community_link_ddv_profile_v1(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_binding_key_hash text,
  p_relationship_kind text default 'self'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_window integer;
  v_account_id uuid;
  v_existing_profile_id uuid;
  v_existing_account_id uuid;
  v_existing_relationship_kind text;
  v_tombstone private.ddv_profile_binding_tombstones%rowtype;
  v_profile_id uuid;
begin
  select integer_value into v_window
  from private.community_security_config
  where policy_key='linked_ddv_profile_recent_auth_seconds';

  if v_window is null then
    raise exception 'Linked DDV Profile recent-auth policy is not configured';
  end if;

  v_account_id:=private.require_recent_session(
    p_auth_subject,
    p_session_id,
    p_issued_at_epoch,
    v_window
  );

  if p_binding_key_hash is null
     or p_binding_key_hash !~ '^hmac-sha256:v1:[0-9a-f]{64}$' then
    raise exception 'Invalid DDV Profile binding digest';
  end if;

  if p_relationship_kind not in ('self','parent_guardian_managed') then
    raise exception 'Unsupported DDV Profile relationship kind';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ddv-profile-binding:' || p_binding_key_hash,0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('ddv-profile-account:' || v_account_id::text,0)
  );

  select * into v_tombstone
  from private.ddv_profile_binding_tombstones
  where binding_key_hash=p_binding_key_hash
  for update;

  if v_tombstone.binding_key_hash is not null then
    if v_tombstone.purge_after <= clock_timestamp()
       and not private.community_account_has_retention_hold(v_tombstone.prior_account_id) then
      delete from private.ddv_profile_binding_tombstones
      where binding_key_hash=p_binding_key_hash;
    else
      raise exception 'DDV_PROFILE_COOLDOWN_ACTIVE';
    end if;
  end if;

  select
    d.ddv_profile_id,
    l.account_id,
    l.relationship_kind
  into
    v_existing_profile_id,
    v_existing_account_id,
    v_existing_relationship_kind
  from public.ddv_profiles d
  left join public.wand_account_ddv_profiles l
    on l.ddv_profile_id=d.ddv_profile_id
  where d.binding_state='verified'
    and d.binding_key_hash=p_binding_key_hash
  limit 1
  for update of d;

  if v_existing_profile_id is not null then
    if v_existing_account_id=v_account_id then
      return jsonb_build_object(
        'ddvProfileId',v_existing_profile_id,
        'relationshipKind',v_existing_relationship_kind,
        'bindingState','verified',
        'replayed',true
      );
    end if;

    raise exception 'DDV_PROFILE_ALREADY_LINKED';
  end if;

  insert into public.ddv_profiles(
    binding_state,
    binding_key_hash
  ) values (
    'verified',
    p_binding_key_hash
  )
  returning ddv_profile_id into v_profile_id;

  insert into public.wand_account_ddv_profiles(
    account_id,
    ddv_profile_id,
    verification_evidence_ref,
    relationship_kind
  ) values (
    v_account_id,
    v_profile_id,
    null,
    p_relationship_kind
  );

  insert into public.audit_events(
    actor_account_id,
    action_type,
    target_entity_id,
    metadata
  ) values (
    v_account_id,
    'ddv_profile.linked',
    null,
    jsonb_build_object(
      'ddvProfileId',v_profile_id,
      'relationshipKind',p_relationship_kind
    )
  );

  return jsonb_build_object(
    'ddvProfileId',v_profile_id,
    'relationshipKind',p_relationship_kind,
    'bindingState','verified',
    'replayed',false
  );
end;
$$;

create or replace function public.community_get_linked_ddv_profiles(
  p_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ddvProfileId',d.ddv_profile_id,
        'bindingState',d.binding_state,
        'relationshipKind',l.relationship_kind,
        'linkedAt',l.linked_at
      )
      order by l.linked_at,d.ddv_profile_id
    ),
    '[]'::jsonb
  )
  into v_result
  from public.wand_account_ddv_profiles l
  join public.ddv_profiles d
    on d.ddv_profile_id=l.ddv_profile_id
  where l.account_id=v_account_id;

  return v_result;
end;
$$;

create or replace function public.community_admin_correct_ddv_profile_link_v1(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_account_id uuid,
  p_ddv_profile_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_relationship_kind text;
begin
  v_admin_account_id:=private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Correction reason must be 8-500 characters';
  end if;

  select relationship_kind into v_relationship_kind
  from public.wand_account_ddv_profiles
  where account_id=p_account_id
    and ddv_profile_id=p_ddv_profile_id
  for update;

  if v_relationship_kind is null then
    raise exception 'Linked DDV Profile not found for account';
  end if;

  delete from public.wand_account_ddv_profiles
  where account_id=p_account_id
    and ddv_profile_id=p_ddv_profile_id;

  update private.ddv_profile_binding_tombstones
  set reason='exceptional_correction'
  where ddv_profile_id=p_ddv_profile_id;

  insert into public.audit_events(
    actor_account_id,
    action_type,
    target_entity_id,
    metadata
  ) values (
    v_admin_account_id,
    'ddv_profile.exceptional_correction',
    null,
    jsonb_build_object(
      'accountId',p_account_id,
      'ddvProfileId',p_ddv_profile_id,
      'relationshipKind',v_relationship_kind,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'accountId',p_account_id,
    'ddvProfileId',p_ddv_profile_id,
    'state','revoked',
    'tombstoneDays',7
  );
end;
$$;

create or replace function public.community_purge_expired_ddv_binding_tombstones()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_count integer;
begin
  delete from private.ddv_profile_binding_tombstones t
  where t.purge_after <= clock_timestamp()
    and not private.community_account_has_retention_hold(t.prior_account_id);

  get diagnostics v_count=row_count;

  if v_count>0 then
    insert into public.audit_events(
      actor_account_id,
      action_type,
      target_entity_id,
      metadata
    ) values (
      null,
      'ddv_profile.binding_tombstones_purged',
      null,
      jsonb_build_object('count',v_count)
    );
  end if;

  return jsonb_build_object('purged',v_count);
end;
$$;

revoke execute on function private.community_tombstone_removed_ddv_link()
from public,anon,authenticated,service_role;

revoke execute on function public.community_link_ddv_profile_v1(
  uuid,uuid,bigint,text,text
) from public,anon,authenticated;

revoke execute on function public.community_get_linked_ddv_profiles(uuid)
from public,anon,authenticated;

revoke execute on function public.community_admin_correct_ddv_profile_link_v1(
  uuid,uuid,bigint,uuid,uuid,text
) from public,anon,authenticated;

revoke execute on function public.community_purge_expired_ddv_binding_tombstones()
from public,anon,authenticated;

grant execute on function public.community_link_ddv_profile_v1(
  uuid,uuid,bigint,text,text
) to service_role;

grant execute on function public.community_get_linked_ddv_profiles(uuid)
to service_role;

grant execute on function public.community_admin_correct_ddv_profile_link_v1(
  uuid,uuid,bigint,uuid,uuid,text
) to service_role;

grant execute on function public.community_purge_expired_ddv_binding_tombstones()
to service_role;
