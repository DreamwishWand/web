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
