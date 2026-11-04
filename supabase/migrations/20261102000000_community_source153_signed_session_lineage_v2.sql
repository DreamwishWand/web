-- DDVRE Source153 experimental server-enforced per-session revocation.
-- ISOLATED DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. No staging migration.
-- GoTrue auth.sessions is the ONLY trusted session-registration authority.
create table if not exists private.wand_verified_session_revocations_v1 (
  provider_subject uuid not null,
  session_id uuid not null,
  scope text not null check(scope in ('local','global')),
  revoked_at timestamptz not null default clock_timestamp(),
  primary key(provider_subject,session_id)
);
revoke all on private.wand_verified_session_revocations_v1 from public, anon, authenticated;

create or replace function public.community_authorize_signed_session_v2(
  p_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_session_id uuid
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_existing jsonb;
begin
  if p_auth_subject is null or p_session_id is null or
     p_issued_at_epoch is null or p_issued_at_epoch<=0 then
    raise exception 'SIGNED_SESSION_REQUIRED';
  end if;
  -- Inherited Account/Identity and Account-global cutoff semantics.
  v_existing:=public.community_authorize_session(p_auth_subject,p_issued_at_epoch,null);
  -- This table is created and owned by GoTrue, NOT a Wand self-registration API.
  -- If GoTrue session records are absent/inaccessible, fail closed.
  if not exists(
    select 1 from auth.sessions s
    where s.id=p_session_id and s.user_id=p_auth_subject
  ) then
    raise exception 'SIGNED_SESSION_NOT_REGISTERED_OR_REVOKED';
  end if;
  if exists(
    select 1 from private.wand_verified_session_revocations_v1 r
    where r.provider_subject=p_auth_subject and r.session_id=p_session_id
  ) then
    raise exception 'SIGNED_SESSION_TERMINALLY_REVOKED';
  end if;
  return jsonb_build_object('authorized',true,'source','verified-gotrue-session-and-wand');
end;
$$;

-- Service-role-only writer. Verified subject, iat and session_id are passed
-- solely from Edge trusted JWT claims, never the caller JSON/body.
-- Repeat with the SAME scope is terminal/no-op. A replay of global logout
-- can NEVER slide the Account cutoff forward and deny newly logged-in A3.
create or replace function public.community_revoke_signed_session_v1(
  p_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_session_id uuid,
  p_scope text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account uuid;
  v_identity uuid;
  v_existing_scope text;
  v_cutoff timestamptz;
begin
  if p_scope not in ('local','global') or p_auth_subject is null or
     p_session_id is null or p_issued_at_epoch is null or p_issued_at_epoch<=0 then
    raise exception 'INVALID_LOGOUT_SCOPE_OR_SIGNED_SESSION';
  end if;
  v_account:=private.resolve_active_account(p_auth_subject);
  -- Lock the unique identity to serialize duplicate logout requests.
  select auth_identity_id into v_identity
    from public.auth_identities
    where provider='supabase' and provider_subject=p_auth_subject::text
      and account_id=v_account and identity_state='active'
    for update;
  if v_identity is null then raise exception 'SIGNED_IDENTITY_REQUIRED'; end if;
  select scope into v_existing_scope
    from private.wand_verified_session_revocations_v1
    where provider_subject=p_auth_subject and session_id=p_session_id;
  if v_existing_scope is not null then
    if v_existing_scope<>p_scope then
      raise exception 'REVOKED_SESSION_CANNOT_ESCALATE_SCOPE';
    end if;
    return jsonb_build_object('state','already-revoked','scope',p_scope);
  end if;
  -- Enrollment/eligibility must be established before any terminal record.
  perform public.community_authorize_signed_session_v2(
    p_auth_subject,p_issued_at_epoch,p_session_id
  );
  insert into private.wand_verified_session_revocations_v1
    (provider_subject,session_id,scope) values
    (p_auth_subject,p_session_id,p_scope);
  if p_scope='global' then
    -- Only GLOBAL scope may change this existing Account/Identity-wide cutoff.
    -- Preserve monotonicity and block old/unregistered pre-cutoff JWTs.
    v_cutoff:=date_trunc('second',clock_timestamp())+interval '1 second';
    update public.auth_identities
      set sessions_valid_after=greatest(sessions_valid_after,v_cutoff)
      where auth_identity_id=v_identity;
  end if;
  return jsonb_build_object('state','revoked','scope',p_scope);
end;
$$;
revoke execute on function public.community_authorize_signed_session_v2(uuid,bigint,uuid)
  from public,anon,authenticated;
revoke execute on function public.community_revoke_signed_session_v1(uuid,bigint,uuid,text)
  from public,anon,authenticated;
grant execute on function public.community_authorize_signed_session_v2(uuid,bigint,uuid)
  to service_role;
grant execute on function public.community_revoke_signed_session_v1(uuid,bigint,uuid,text)
  to service_role;

-- Close the direct PostgREST bypass: existing authenticated Source149–153
-- SQL writers/readers all call this *private* verifier inside their transaction.
-- Historical Source150 migration remains frozen; only this forward migration
-- rebinds the private verifier, preserving original for-share Account locks.
create or replace function private.dreamsnap_x05_verified_db_subject_v1()
returns uuid language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private as $verified$
declare
  v_subject uuid;
  v_iat bigint;
  v_role text;
  v_claims jsonb;
  v_identity record;
begin
  v_claims:=auth.jwt();
  v_role:=v_claims->>'role';
  if v_role is distinct from 'authenticated'
     or coalesce(v_claims->>'is_anonymous','false')='true'
     or v_claims->>'sub' is null
     or v_claims->>'sub' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_claims->>'session_id' is null
     or v_claims->>'session_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_claims->>'iat' is null
     or v_claims->>'iat' !~ '^[0-9]{9,12}$'
  then raise exception 'X05_VERIFIED_SUBJECT_REQUIRED'; end if;
  v_subject:=(v_claims->>'sub')::uuid;
  v_iat:=(v_claims->>'iat')::bigint;
  if auth.uid() is distinct from v_subject
     or to_timestamp(v_iat)>clock_timestamp()+interval '30 seconds'
  then raise exception 'X05_VERIFIED_SUBJECT_REQUIRED'; end if;
  select a.account_id,i.sessions_valid_after
    into v_identity
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase' and i.provider_subject=v_subject::text
    and i.identity_state='active' and i.retired_at is null
    and a.status='active' and a.deleted_at is null
    and not private.is_account_privacy_suppressed(a.account_id)
  for share of i,a;
  if not found or to_timestamp(v_iat)<v_identity.sessions_valid_after then
    raise exception 'X05_IDENTITY_SESSION_DENIED'; end if;
  -- Preserve original Account/Identity/Privacy/iat checks with row SHARE locks.
  -- This call executes INSIDE the SAME SQL transaction for direct PostgREST
  -- Owner read and writer RPCs, not just through the Source153 Edge.
  perform public.community_authorize_signed_session_v2(
    v_subject,v_iat,(v_claims->>'session_id')::uuid
  );
  return v_subject;
end
$verified$;
