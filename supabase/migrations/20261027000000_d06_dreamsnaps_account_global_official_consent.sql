-- D06 / Issue #213: ONE Wand Account-wide Official DDV Results disclosure preference.
-- Source143 is justified by the independent QR #212 D06 SQL/Edge mismatch.
-- NOT a positive publication migration. No Source134-142 rewrite or Stage action.
-- A stored ON is only consent; a verified judged-image/rights/phase public proof
-- is unavailable and public projection remains DENIED until separately accepted.

create table if not exists private.dreamsnap_official_result_account_consent_r20 (
  account_id uuid primary key references public.wand_accounts(account_id) on delete cascade,
  enabled boolean not null default false,
  row_version bigint not null default 1 check (row_version > 0),
  updated_at timestamptz not null default now()
);
alter table private.dreamsnap_official_result_account_consent_r20 enable row level security;
revoke all on private.dreamsnap_official_result_account_consent_r20
from public,anon,authenticated,service_role;

-- Legacy entry/field opt-ins were never Account-wide consent. Destroy their
-- effective opt-in, not the owner-private official-result records.
update public.dreamsnap_official_result_publication
set public_fields=array[]::text[],published_at=null,updated_at=now()
where cardinality(public_fields)>0 or published_at is not null;
alter table public.dreamsnap_official_result_publication
  drop constraint if exists dreamsnap_legacy_publication_disabled_r20;
alter table public.dreamsnap_official_result_publication
  add constraint dreamsnap_legacy_publication_disabled_r20
    check (cardinality(public_fields)=0 and published_at is null);

-- Preserve historical function identity for old callers, but no per-entry or
-- per-field service-role direct writer can ever grant disclosure again.
create or replace function public.community_dreamsnap_set_official_result_publication_v1(
  p_auth_subject uuid,p_entry_id uuid,p_public_fields text[]
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
begin
  raise exception 'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED';
end
$$;
revoke all on function public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])
from public,anon,authenticated,service_role;

-- Explicit account setting. No consent row is required for an Account:
-- missing row = OFF, rowVersion=0. Even ON is not yet publication authority.
-- Consent acknowledgement and recent actual auth session are required for ON.
create or replace function public.community_dreamsnap_set_account_official_result_consent_r20(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_expected_version bigint,
  p_enabled boolean,
  p_acknowledged_scope boolean
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_account_id uuid;
  v_current private.dreamsnap_official_result_account_consent_r20%rowtype;
  v_version bigint;
begin
  if p_expected_version is null or p_expected_version<0 or p_enabled is null then
    raise exception 'D06_INVALID_ACCOUNT_CONSENT_REQUEST';
  end if;
  if p_enabled then
    if p_acknowledged_scope is distinct from true then
      raise exception 'D06_ACCOUNT_WIDE_DISCLOSURE_CONFIRMATION_REQUIRED';
    end if;
    v_account_id:=private.require_recent_session(
      p_auth_subject,p_session_id,p_issued_at_epoch,300
    );
  else
    perform public.community_authorize_session(p_auth_subject,p_issued_at_epoch,null);
    v_account_id:=private.resolve_active_account(p_auth_subject);
  end if;

  -- Phase1 Privacy Suppression is independently authoritative. An older
  -- enabled preference is not a license to restore disclosure while held.
  if p_enabled and exists(
    select 1 from private.account_privacy_suppressions
    where account_id=v_account_id
  ) then
    raise exception 'D06_ACCOUNT_PRIVACY_SUPPRESSED';
  end if;

  -- Serialize all ON/OFF toggles for a Wand Account, not by Entry/Workspace.
  perform 1 from public.wand_accounts
  where account_id=v_account_id for update;
  if not found then raise exception 'D06_ACCOUNT_UNAVAILABLE'; end if;

  select * into v_current
  from private.dreamsnap_official_result_account_consent_r20
  where account_id=v_account_id for update;

  if v_current.account_id is null then
    if p_expected_version<>0 then
      raise exception 'D06_STALE_ACCOUNT_CONSENT';
    end if;
    insert into private.dreamsnap_official_result_account_consent_r20(
      account_id,enabled,row_version,updated_at
    ) values(v_account_id,p_enabled,1,now());
    v_version:=1;
  else
    if v_current.row_version<>p_expected_version then
      raise exception 'D06_STALE_ACCOUNT_CONSENT';
    end if;
    if v_current.enabled is distinct from p_enabled then
      update private.dreamsnap_official_result_account_consent_r20
      set enabled=p_enabled,row_version=row_version+1,updated_at=now()
      where account_id=v_account_id
      returning row_version into v_version;
    else
      v_version:=v_current.row_version;
    end if;
  end if;

  insert into public.audit_events(actor_account_id,action_type,metadata)
  values(v_account_id,'dreamsnap.official_account_consent_changed',
    jsonb_build_object('enabled',p_enabled,'rowVersion',v_version,
                       'scope','all_linked_profiles_and_past_future_results',
                       'publicProjectionAuthorized',false));
  return jsonb_build_object(
    'enabled',p_enabled,'rowVersion',v_version,
    'scope','all_linked_profiles_and_past_future_results',
    'publicProjectionAuthorized',false
  );
end
$$;

revoke all on function public.community_dreamsnap_set_account_official_result_consent_r20(
  uuid,uuid,bigint,bigint,boolean,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_set_account_official_result_consent_r20(
  uuid,uuid,bigint,bigint,boolean,boolean
) to service_role;

create or replace function public.community_dreamsnap_get_account_official_result_consent_r20(
  p_auth_subject uuid
)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_enabled boolean;
  v_version bigint;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select enabled,row_version into v_enabled,v_version
  from private.dreamsnap_official_result_account_consent_r20
  where account_id=v_account_id;
  return jsonb_build_object(
    'enabled',coalesce(v_enabled,false),'rowVersion',coalesce(v_version,0),
    'scope','all_linked_profiles_and_past_future_results',
    'publicProjectionAuthorized',false
  );
end
$$;
revoke all on function public.community_dreamsnap_get_account_official_result_consent_r20(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_get_account_official_result_consent_r20(uuid)
to service_role;

-- The only known canonical SQL projection helper for public Official results
-- is used by Results and Gallery Detail. In-Game owner-private results do NOT
-- depend on it. Source validation proves save provenance, NOT judged-image
-- identity, DDV submission ownership, verified rights or safe minor disclosure.
-- Do not infer those predicates from an ON consent bit or legacy public_fields.
create or replace function private.dreamsnap_public_official_result(p_entry_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_consent boolean;
begin
  select e.account_id,coalesce(c.enabled,false)
  into v_account_id,v_consent
  from public.dreamsnap_entries e
  left join private.dreamsnap_official_result_account_consent_r20 c
    on c.account_id=e.account_id
  where e.entry_id=p_entry_id
    and e.managed_under13=false
    and e.entry_state='entered'
    and e.eligibility_state='eligible';
  if v_account_id is null or v_consent is distinct from true then
    return null;
  end if;
  -- Hard stop: no original judged-photo match, authoritative rank provenance,
  -- rights/legal/privacy or linked-profile validation source has been accepted.
  -- Deliberately deny EVEN AFTER Account-wide ON pending separate proof.
  return null;
end
$$;
revoke all on function private.dreamsnap_public_official_result(uuid)
from public,anon,authenticated,service_role;
comment on function private.dreamsnap_public_official_result(uuid) is
  'D06 Source143: fail closed. Account-global consent is necessary but not sufficient; independent bound-photo/rights/phase provenance unaccepted. No public projection.';

-- Old per-entry table cannot be a positive issuer, even if direct SQL attempts
-- to bypass the retired command. service_role direct SELECT of private result
-- records is NOT accepted as any kind of public disclosure authority.
comment on table private.dreamsnap_official_result_account_consent_r20 is
  'One preference per Wand Account; missing row is OFF; ON never bypasses verified image, rights, privacy or managed-minor preconditions.';
