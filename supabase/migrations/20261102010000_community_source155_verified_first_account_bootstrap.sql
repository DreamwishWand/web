-- Source155 P0 safe signed first Account/Creator bootstrap.
-- LOCAL DISPOSABLE ONLY. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
-- The ONLY caller is authenticated community-command Edge with JWT claims
-- verified by withSupabase({auth:'user'}); never accept request-body identity.
-- This wrapper combines GoTrue registration + Wand bootstrap + v2 validation
-- in one Postgres transaction. It does NOT widen Source154 session v2.
create or replace function public.community_ensure_account_creator_signed_v1(
  p_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_session_id uuid,
  p_handle text,
  p_display_name text
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private
as $bootstrap$
declare
  v_identity record;
  v_provider_session uuid;
  v_result jsonb;
  v_account uuid;
  v_creator uuid;
  v_existing_creator uuid;
begin
  if p_auth_subject is null or p_session_id is null
     or p_issued_at_epoch is null or p_issued_at_epoch<=0
     or to_timestamp(p_issued_at_epoch)>clock_timestamp()+interval '30 seconds'
  then raise exception 'SIGNED_BOOTSTRAP_CLAIMS_INVALID'; end if;

  if coalesce(length(btrim(p_handle)),0)<3
     or length(btrim(p_handle))>40
     or btrim(p_handle)!~'^[A-Za-z0-9][A-Za-z0-9._-]*$'
     or coalesce(length(btrim(p_display_name)),0)<1
     or length(btrim(p_display_name))>80
  then raise exception 'SIGNED_BOOTSTRAP_PROFILE_INVALID'; end if;

  -- Serialize *all* concurrent first-registration attempts for this signed
  -- subject, including inherited community_ensure_account_creator.
  perform pg_advisory_xact_lock(
    hashtextextended('identity:'||p_auth_subject::text,0)
  );

  -- Only GoTrue may create auth.sessions records. FOR SHARE prevents its
  -- concurrent session deletion from committing mid-bootstrap.
  select s.id into v_provider_session from auth.sessions s
   where s.id=p_session_id and s.user_id=p_auth_subject
   for share;
  if v_provider_session is null
  then raise exception 'SIGNED_BOOTSTRAP_GOTRUE_SESSION_REQUIRED'; end if;
  if exists(
    select 1 from private.wand_verified_session_revocations_v1 r
     where r.provider_subject=p_auth_subject and r.session_id=p_session_id
  ) then raise exception 'SIGNED_BOOTSTRAP_TERMINALLY_REVOKED'; end if;

  -- Shared identity lock participates in Source154 revoke FOR UPDATE.
  -- On a present identity v2 enforces Account/Privacy/global cutoff and
  -- this exact per-session tombstone in the SAME transaction.
  select i.account_id,i.identity_state,i.retired_at
   into v_identity from public.auth_identities i
   where i.provider='supabase' and i.provider_subject=p_auth_subject::text
   for share;
  if found then
    if v_identity.identity_state is distinct from 'active'
       or v_identity.retired_at is not null
    then raise exception 'SIGNED_BOOTSTRAP_RETIRED_IDENTITY'; end if;
    perform public.community_authorize_signed_session_v2(
      p_auth_subject,p_issued_at_epoch,p_session_id
    );
  else
    -- Existing deleted/retired/recovery identities must NEVER be replaced.
    -- These checks are also repeated in inherited atomic creator creation.
    perform public.community_authorize_identity_bootstrap(
      p_auth_subject,p_issued_at_epoch
    );
  end if;

  -- New users have no trusted age/guardian attestation at this boundary.
  -- The initial Creator MUST be private; public visibility is a separate
  -- moderated/consented product journey, never a bootstrap side effect.
  select c.creator_profile_id into v_existing_creator
    from public.creator_profiles c
    join public.auth_identities i on i.account_id=c.owner_account_id
   where i.provider='supabase'
     and i.provider_subject=p_auth_subject::text
     and i.identity_state='active';

  -- Existing source creates Account + AuthIdentity + Creator + outbox as
  -- ONE transaction, with unique(provider,subject), unique(owner_account)
  -- and identity advisory locking. Replays return SAME Account/Creator IDs.
  v_result:=public.community_ensure_account_creator(
    p_auth_subject,btrim(p_handle),btrim(p_display_name)
  );
  v_account:=(v_result->>'accountId')::uuid;
  v_creator:=(v_result->>'creatorProfileId')::uuid;
  if v_existing_creator is null then
    update public.creator_profiles
      set profile_visibility='private'
      where creator_profile_id=v_creator and owner_account_id=v_account;
  end if;

  -- Critical post-bootstrap check: do not turn first-login into a special
  -- bypass around the normal verified-session gate.
  perform public.community_authorize_signed_session_v2(
    p_auth_subject,p_issued_at_epoch,p_session_id
  );
  if not exists(
    select 1 from public.creator_profiles c
      join public.wand_accounts a on a.account_id=c.owner_account_id
    where c.creator_profile_id=v_creator and c.owner_account_id=v_account
      and c.moderation_state='clear' and a.status='active'
      and a.deleted_at is null
  ) then raise exception 'SIGNED_BOOTSTRAP_CREATOR_OR_ACCOUNT_BLOCKED'; end if;
  return v_result;
end
$bootstrap$;

revoke all on function public.community_ensure_account_creator_signed_v1(
 uuid,bigint,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.community_ensure_account_creator_signed_v1(
 uuid,bigint,uuid,text,text) to service_role;
comment on function public.community_ensure_account_creator_signed_v1(
 uuid,bigint,uuid,text,text) is
 'Source155 service-only Edge verified GoTrue session first-account atomic bootstrap. No user-supplied subject/session, no entitlement, no widened v2.';
