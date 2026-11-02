-- Source155 isolated candidate: legacy R16 Gallery metadata writer atomically bound
-- to a genuine verified GoTrue session. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
-- Source150 X05, historical SQL, and production deployment remain unchanged.
--
-- Revoker (Source154) first obtains auth_identities FOR UPDATE, then writes
-- the terminal tombstone. The writer holds FOR SHARE on the same identity
-- until its last Work/Audit/Idempotency mutation commits or rolls back.
-- Revocation therefore cannot commit between verification and writer commit.
create or replace function private.community_legacy_signed_writer_guard_v1(
  p_auth_subject uuid,p_issued_at_epoch bigint,p_session_id uuid
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth as $guard$
declare v_identity uuid;
begin
  if p_auth_subject is null or p_issued_at_epoch is null or p_issued_at_epoch<=0
     or p_session_id is null then
    raise exception 'LEGACY_SIGNED_WRITER_CLAIMS_REQUIRED';
  end if;
  select i.auth_identity_id into v_identity
    from public.auth_identities i
    where i.provider='supabase' and i.provider_subject=p_auth_subject::text
      and i.identity_state='active' and i.retired_at is null
    for share;
  if v_identity is null then raise exception 'LEGACY_SIGNED_WRITER_IDENTITY_DENIED'; end if;
  perform public.community_authorize_signed_session_v2(
    p_auth_subject,p_issued_at_epoch,p_session_id);
end;
$guard$;
revoke all on function private.community_legacy_signed_writer_guard_v1(uuid,bigint,uuid)
  from public,anon,authenticated,service_role;

create or replace function public.community_set_gallery_comments_enabled_atomic_signed_v1(
  p_auth_subject uuid,p_issued_at_epoch bigint,p_session_id uuid,
  p_work_id uuid,p_expected_version bigint,p_expected_current_revision_id uuid,
  p_enabled boolean,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,extensions,public,private as $writer$
begin
  -- One transaction encompasses identity SHARE lock, verified-session check,
  -- R16's exact Work/CAS/ownership/idempotency checks and ALL side effects.
  -- Never accept these first three arguments from client request JSON.
  perform private.community_legacy_signed_writer_guard_v1(
    p_auth_subject,p_issued_at_epoch,p_session_id);
  return public.community_set_gallery_comments_enabled_atomic_r16(
    p_auth_subject,p_work_id,p_expected_version,
    p_expected_current_revision_id,p_enabled,p_idempotency_key);
end;
$writer$;

-- Retire the unbound service-role entrypoint. SQL-function ownership still
-- lets the SECURITY DEFINER wrapper invoke the frozen R16 implementation.
revoke all on function public.community_set_gallery_comments_enabled_atomic_r16(
  uuid,uuid,bigint,uuid,boolean,text) from public,anon,authenticated,service_role;
revoke all on function public.community_set_gallery_comments_enabled_atomic_signed_v1(
  uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.community_set_gallery_comments_enabled_atomic_signed_v1(
  uuid,bigint,uuid,uuid,bigint,uuid,boolean,text) to service_role;
