-- Source150 / 03 COMM X05, private Owner management via VERIFIED Supabase JWT
-- gateway. Forward-only after independently accepted Source149. This is NOT a
-- public DreamSnaps publisher, Public Work Detail or Media signer.
--
-- Private Source149 functions retain REVOKE ALL, including service_role.
-- These two narrow public functions are authenticated-JWT wrappers only:
-- no subject/account identifiers supplied by the browser; no admin-key caller.
-- PostgREST must verify the bearer signature/claims before setting auth.uid().
--
-- Authoritative policy registry is deliberately UNSEEDED. Without an actual
-- versioned policy receipt approved for display, grant fails closed.
create table private.dreamsnap_x05_owner_policy_v1 (
  policy_version text primary key
    check (policy_version ~ '^v[1-9][0-9]{0,6}$'),
  policy_digest text not null check (policy_digest ~ '^[0-9a-f]{64}$'),
  scope_id text not null default 'wand.dreamsnaps.creator-photo-grant@1'
    check (scope_id = 'wand.dreamsnaps.creator-photo-grant@1'),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
revoke all on private.dreamsnap_x05_owner_policy_v1
  from public,anon,authenticated,service_role;

-- Keep subject verification INSIDE the same single PG transaction as the
-- source149 Work lock and CAS; do not trust raw caller p_auth_subject parameters.
create or replace function private.dreamsnap_x05_verified_db_subject_v1()
returns uuid language plpgsql stable security definer
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
  return v_subject;
end
$verified$;
revoke all on function private.dreamsnap_x05_verified_db_subject_v1()
  from public,anon,authenticated,service_role;

-- Projection deliberately excludes AccountID, MediaID, storage key, raw
-- media hashes, signer URL, DB/incident internals or legal hold reason.
-- Always private/no-store via the Edge caller. No public Work Detail granted.
create or replace function public.community_dreamsnap_x05_owner_read_v1(
  p_work_id uuid
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private as $read$
declare
  v_subject uuid;
  v_account uuid;
  v_work public.community_works%rowtype;
  v_ctl private.dreamsnap_x05_work_control_v1%rowtype;
  v_purge private.dreamsnap_x05_purge_tracking_v1%rowtype;
  v_holder boolean;
  v_held boolean;
  v_provenance boolean;
  v_entry uuid;
  v_concept text;
  v_policy_ordinal bigint;
  v_erasure text;
  v_public_disabled boolean;
  v_purged boolean;
begin
  v_subject:=private.dreamsnap_x05_verified_db_subject_v1();
  v_account:=private.resolve_active_account(v_subject);
  select * into v_work from public.community_works where work_id=p_work_id;
  select * into v_ctl from private.dreamsnap_x05_work_control_v1 where work_id=p_work_id;
  if v_work.work_id is null or v_ctl.work_id is null
     or v_work.work_type<>'dreamsnap'
     or v_work.owner_account_id is distinct from v_account
     or v_ctl.owner_account_id is distinct from v_account
     or v_ctl.creator_profile_id is distinct from v_work.creator_profile_id
     or v_work.moderation_state<>'clear'
     or v_work.lifecycle_state='deleted'
     or not exists(select 1 from public.creator_profiles cp
       join public.community_entities ce on ce.entity_id=cp.creator_profile_id
       where cp.creator_profile_id=v_work.creator_profile_id
         and cp.owner_account_id=v_account and cp.moderation_state='clear'
         and ce.deleted_at is null)
     or not exists(select 1 from public.dreamsnap_works dw
       where dw.work_id=p_work_id and dw.challenge_id=v_ctl.challenge_id
         and not dw.managed_under13)
  then raise exception 'X05_OWNER_NOT_AVAILABLE'; end if;

  select (m.purged_at is not null) into v_purged
    from public.media_assets m
    where m.media_id=v_ctl.frozen_media_id and m.owner_account_id=v_account;
  if not found then raise exception 'X05_MEDIA_REFERENCE_INVALID'; end if;
  v_provenance:=exists(select 1
    from public.community_work_revisions cr
    join public.dreamsnap_work_revisions dr on dr.revision_id=cr.revision_id
    join public.work_revision_media wrm on wrm.work_revision_id=cr.revision_id
     and wrm.media_id=v_ctl.frozen_media_id and wrm.role='dreamsnap' and wrm.ordinal=0
    where cr.revision_id=v_ctl.frozen_photo_revision_id and cr.work_id=p_work_id
      and dr.challenge_id=v_ctl.challenge_id and dr.integrity_state='eligible');
  if not v_provenance then raise exception 'X05_FROZEN_REFERENCE_INVALID'; end if;

  if v_ctl.work_kind='OriginalCompetition' then
    select e.entry_id into v_entry from public.dreamsnap_entries e
      where e.work_id=p_work_id and e.account_id=v_account
        and e.entry_revision_id=v_ctl.frozen_photo_revision_id
        and e.entry_state='entered' and e.eligibility_state='eligible'
        and not e.managed_under13;
    if v_entry is null then raise exception 'X05_ENTRY_BINDING_INVALID'; end if;
  elsif v_ctl.work_kind='PostEventCreation' then
    if exists(select 1 from public.dreamsnap_entries e where e.work_id=p_work_id)
      or not exists(select 1 from private.dreamsnap_post_event_staged_v1 st
        where st.work_id=p_work_id and st.publication_state='staged'
          and st.immutable_photo_revision_id=v_ctl.frozen_photo_revision_id
          and st.media_id=v_ctl.frozen_media_id
          and st.challenge_id=v_ctl.challenge_id)
    then raise exception 'X05_POST_EVENT_BINDING_INVALID'; end if;
  else raise exception 'X05_UNKNOWN_KIND'; end if;

  select * into v_purge from private.dreamsnap_x05_purge_tracking_v1
    where work_id=p_work_id;
  select exists(select 1 from private.account_retention_holds h
    where h.account_id=v_account and h.hold_type='legal'
      and h.released_at is null
      and (h.expires_at is null or h.expires_at>clock_timestamp()))
    into v_held;
  v_public_disabled:=(v_work.visibility<>'public' or
    v_ctl.control_state in ('withdrawn','delete_requested'));
  v_erasure:=case
    when v_purge.work_id is not null and v_held then 'LEGAL_HOLD'
    when v_purge.work_id is not null and v_purge.request_state='verified'
      and v_purge.verified_at is not null
      and v_purge.provider_receipt_digest is not null
      and v_purged and v_public_disabled then 'MEDIA_PURGED'
    when v_purge.work_id is not null then 'MEDIA_PURGE_PENDING'
    when v_public_disabled then 'PUBLIC_DISABLED'
    else 'NOT_REQUESTED' end;
  if v_ctl.grant_policy_version ~ '^v[1-9][0-9]{0,6}$' then
    v_policy_ordinal:=substring(v_ctl.grant_policy_version from 2)::bigint;
  end if;
  select coalesce(g.description,'') into v_concept
    from public.gallery_work_revisions g
    where g.revision_id=v_ctl.concept_revision_id;
  v_concept:=coalesce(v_concept,'');
  if length(v_concept)>2000 then v_concept:=''; end if;

  return jsonb_build_object(
    'contractVersion','wand.dreamsnaps.owner-management-service@1',
    'sourceContractVersion','wand.dreamsnaps.owner-management@1',
    'workId',p_work_id,'kind',v_ctl.work_kind,
    'creatorProfileId',v_ctl.creator_profile_id,
    'challengeId',v_ctl.challenge_id,
    'entryId',case when v_ctl.work_kind='OriginalCompetition' then to_jsonb(v_entry) else null end,
    'frozenEntryRevisionId',case when v_ctl.work_kind='OriginalCompetition' then to_jsonb(v_ctl.frozen_photo_revision_id) else null end,
    'photoRevisionId',v_ctl.frozen_photo_revision_id,
    'conceptRevisionId',v_ctl.concept_revision_id,
    'concept',v_concept,
    'rowVersion',v_ctl.row_version,
    'authorizationEpoch',v_ctl.authorization_epoch,
    'ownerAuthorized',true,'accountState','active',
    'identityState','active','retired',false,
    'privacySuppressed',false,'moderationAllowed',true,
    'imageGrant',jsonb_build_object(
      'policyVersionText',v_ctl.grant_policy_version,
      'policyVersionOrdinal',v_policy_ordinal,
      'policyDigest',v_ctl.grant_policy_digest,
      'consentRevision',v_ctl.row_version,
      'workId',p_work_id,
      'state',case when v_ctl.withdrawn_at is null then 'accepted' else 'withdrawn' end),
    'erasure',jsonb_build_object(
      'state',v_erasure,'revision',v_ctl.row_version,
      'publicDisabled',v_public_disabled,'physicalPurgeVerified',v_erasure='MEDIA_PURGED',
      'providerStatus',coalesce(v_purge.request_state,'not_requested')),
    'capabilities',jsonb_build_object(
      'ownerRead',true,'grant',v_ctl.withdrawn_at is null,
      'concept',v_ctl.withdrawn_at is null,
      'withdraw',v_ctl.withdrawn_at is null,
      'deleteRequest',v_ctl.withdrawn_at is null,
      'publicDetail',false,'publicMedia',false,'publish',false,'verifyPurge',false)
  );
end
$read$;
revoke all on function public.community_dreamsnap_x05_owner_read_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_x05_owner_read_v1(uuid)
  to authenticated;

create or replace function public.community_dreamsnap_x05_owner_action_v1(
  p_work_id uuid,
  p_expected_row_version bigint,
  p_expected_authorization_epoch bigint,
  p_action text,
  p_photo_revision_id uuid default null,
  p_photo_media_id uuid default null,
  p_policy_version text default null,
  p_policy_digest text default null,
  p_self_capture_declared boolean default null,
  p_grant_accepted boolean default null,
  p_concept_revision_id uuid default null
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private as $act$
declare
  v_subject uuid;
  v_account uuid;
  v_work public.community_works%rowtype;
  v_ctl private.dreamsnap_x05_work_control_v1%rowtype;
  v_policy private.dreamsnap_x05_owner_policy_v1%rowtype;
  v_result jsonb;
begin
  v_subject:=private.dreamsnap_x05_verified_db_subject_v1();
  v_account:=private.resolve_active_account(v_subject);
  -- Source149 itself locks Work before private Control: preserve lock order.
  select * into v_work from public.community_works where work_id=p_work_id for update;
  if v_work.work_id is null or v_work.work_type<>'dreamsnap'
    or v_work.owner_account_id is distinct from v_account
    or v_work.moderation_state<>'clear' or v_work.lifecycle_state='deleted'
  then raise exception 'X05_OWNER_NOT_AVAILABLE'; end if;
  select * into v_ctl from private.dreamsnap_x05_work_control_v1
    where work_id=p_work_id for update;
  if (v_ctl.work_id is null and (p_action<>'grant'
      or p_expected_row_version is distinct from 0
      or p_expected_authorization_epoch is distinct from 0))
    or (v_ctl.work_id is not null and
      (v_ctl.owner_account_id is distinct from v_account
       or v_ctl.row_version is distinct from p_expected_row_version
       or v_ctl.authorization_epoch is distinct from p_expected_authorization_epoch))
  then raise exception 'X05_STALE_EPOCH_OR_REVISION'; end if;
  if p_action='grant' then
    if p_photo_revision_id is null or p_photo_media_id is null
       or p_policy_version is null or p_policy_digest is null
       or p_self_capture_declared is distinct from true
       or p_grant_accepted is distinct from true
       or p_concept_revision_id is not null
    then raise exception 'X05_INVALID_GRANT_PAYLOAD'; end if;
    select * into v_policy from private.dreamsnap_x05_owner_policy_v1
      where policy_version=p_policy_version and is_active for share;
    if v_policy.policy_version is null
       or v_policy.policy_digest is distinct from p_policy_digest
    then raise exception 'X05_POLICY_UNAVAILABLE_OR_MISMATCH'; end if;
    v_result:=private.dreamsnap_x05_record_creator_grant_v1(
      v_subject,p_work_id,p_photo_revision_id,p_photo_media_id,
      p_policy_version,p_policy_digest,p_expected_row_version,true,true);
  elsif p_action in ('preflight','concept','withdraw','delete') then
    if v_ctl.work_id is null or p_photo_revision_id is not null
       or p_photo_media_id is not null or p_policy_version is not null
       or p_policy_digest is not null or p_self_capture_declared is not null
       or p_grant_accepted is not null
       or (p_action='concept' and p_concept_revision_id is null)
       or (p_action<>'concept' and p_concept_revision_id is not null)
    then raise exception 'X05_INVALID_ACTION_PAYLOAD'; end if;
    v_result:=private.dreamsnap_x05_owner_transition_v1(
      v_subject,p_work_id,p_expected_row_version,p_action,p_concept_revision_id);
  else raise exception 'X05_ACTION_NOT_ALLOWED'; end if;
  -- Returned snapshot shares EXACT Work transaction with Source149 CAS/outbox.
  return jsonb_build_object(
    'result',v_result,
    'owner',public.community_dreamsnap_x05_owner_read_v1(p_work_id),
    'publicActivationAllowed',false);
end
$act$;
revoke all on function public.community_dreamsnap_x05_owner_action_v1(
 uuid,bigint,bigint,text,uuid,uuid,text,text,boolean,boolean,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_x05_owner_action_v1(
 uuid,bigint,bigint,text,uuid,uuid,text,text,boolean,boolean,uuid)
to authenticated;

comment on function public.community_dreamsnap_x05_owner_read_v1(uuid) is
 'Authenticated actor-scoped NONPUBLIC owner projection. Only verified Supabase JWT auth.uid; no AccountID/SubjectID input. Not a Public Detail/Media API.';
comment on function public.community_dreamsnap_x05_owner_action_v1(uuid,bigint,bigint,text,uuid,uuid,text,text,boolean,boolean,uuid) is
 'Authenticated least-privilege CAS wrapper to Source149 nonpublic private functions. No service_role or unsigned subject delegate; no Public Publisher/Signer/Storage.';
