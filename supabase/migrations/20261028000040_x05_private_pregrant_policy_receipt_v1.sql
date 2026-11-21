-- 03 COMM X05 Source151 -- additive NONPUBLIC pre-grant bootstrap.
-- Extends accepted Source150 only. No public Work/Media/Publisher/Signer.
-- Policy evidence must be an actual approved canonical text/hash; no seeded
-- production policy and no presumed licensor or new per-image legal approval.

-- A signed-in Creator can read the currently eligible immutable Work image
-- BEFORE any Source149 control/consent event exists. Only verified JWT
-- subject and live Account/Identity/Privacy may access; never accept
-- user-supplied AccountID or SubjectID in the function signature.
create table private.dreamsnap_x05_policy_receipt_v1 (
  policy_version text primary key references private.dreamsnap_x05_owner_policy_v1(policy_version),
  canonical_text text not null check(length(canonical_text) between 20 and 16000),
  purpose_id text not null default 'wand.dreamsnaps.creator-photo-grant@1'
    check(purpose_id='wand.dreamsnaps.creator-photo-grant@1'),
  approval_reference text not null check(length(approval_reference) between 20 and 500),
  approved_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);
revoke all on private.dreamsnap_x05_policy_receipt_v1
  from public,anon,authenticated,service_role;

-- Active registry rows REQUIRE exact source-text SHA256 and non-empty
-- approval evidence. Only a privileged offline owner may prepare a policy;
-- the ordinary Edge caller cannot INSERT into either private table.
create or replace function private.dreamsnap_x05_policy_activate_guard_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $guard$
declare
  v_receipt private.dreamsnap_x05_policy_receipt_v1%rowtype;
begin
  if new.is_active then
    select * into v_receipt from private.dreamsnap_x05_policy_receipt_v1
      where policy_version=new.policy_version;
    if v_receipt.policy_version is null
      or v_receipt.approved_at>clock_timestamp()
      or encode(pg_catalog.sha256(convert_to(v_receipt.canonical_text,'UTF8')),'hex')
         is distinct from new.policy_digest
    then raise exception 'X05_POLICY_ARTIFACT_REQUIRED_OR_DIGEST_MISMATCH'; end if;
  end if;
  return new;
end
$guard$;
revoke all on function private.dreamsnap_x05_policy_activate_guard_v1()
  from public,anon,authenticated,service_role;
create trigger dreamsnap_x05_policy_activation_receipt_gate
before insert or update of is_active,policy_digest
on private.dreamsnap_x05_owner_policy_v1
for each row execute function private.dreamsnap_x05_policy_activate_guard_v1();

create or replace function private.dreamsnap_x05_policy_receipt_immutable_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog as $immutable$
begin
  raise exception 'X05_APPROVED_POLICY_RECEIPT_IMMUTABLE';
end
$immutable$;
revoke all on function private.dreamsnap_x05_policy_receipt_immutable_v1()
  from public,anon,authenticated,service_role;
create trigger dreamsnap_x05_policy_receipt_immutable
before update or delete on private.dreamsnap_x05_policy_receipt_v1
for each row execute function private.dreamsnap_x05_policy_receipt_immutable_v1();

-- This read never creates Work Control, consent, outbox, storage payload,
-- signer, public grant, or official Challenge verification. Positive
-- canGrant requires both immutable eligible source and *real* active policy
-- receipt. Empty policy registry gives NEED_POLICY_ARTIFACT, not a fake grant.
create or replace function public.community_dreamsnap_x05_pregrant_read_v1(
  p_work_id uuid
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private as $pregrant$
declare
  v_subject uuid;
  v_account uuid;
  v_work public.community_works%rowtype;
  v_dw public.dreamsnap_works%rowtype;
  v_photo public.dreamsnap_work_revisions%rowtype;
  v_entry uuid;
  v_kind text;
  v_media uuid;
  v_policy record;
  v_policy_ready boolean:=false;
  v_status text;
begin
  v_subject:=private.dreamsnap_x05_verified_db_subject_v1();
  v_account:=private.resolve_active_account(v_subject);
  if p_work_id is null then raise exception 'X05_PREGRANT_OWNER_NOT_AVAILABLE'; end if;
  select * into v_work from public.community_works
    where work_id=p_work_id;
  select * into v_dw from public.dreamsnap_works
    where work_id=p_work_id;
  -- fail closed: never allow grant setup after a control was registered,
  -- terminal withdrawal, delete, or any orphaned consent event.
  if v_work.work_id is null or v_work.work_type<>'dreamsnap'
    or v_work.owner_account_id is distinct from v_account
    or v_work.lifecycle_state='deleted' or v_work.moderation_state<>'clear'
    or v_work.current_published_revision_id is null
    or v_dw.work_id is null or v_dw.managed_under13
    or exists(select 1 from private.dreamsnap_x05_work_control_v1
              where work_id=p_work_id)
    or exists(select 1 from private.dreamsnap_x05_consent_events_v1
              where work_id=p_work_id)
    or exists(select 1 from private.dreamsnap_x05_purge_tracking_v1
              where work_id=p_work_id)
    or not exists(select 1 from public.creator_profiles cp
      join public.community_entities ce on ce.entity_id=cp.creator_profile_id
      where cp.creator_profile_id=v_work.creator_profile_id
        and cp.owner_account_id=v_account
        and cp.moderation_state='clear' and ce.deleted_at is null)
  then raise exception 'X05_PREGRANT_OWNER_NOT_AVAILABLE'; end if;

  select * into v_photo from public.dreamsnap_work_revisions
    where revision_id=v_work.current_published_revision_id
      and challenge_id=v_dw.challenge_id and integrity_state='eligible'
      and game_screenshot_attested and no_external_edits_attested;
  if v_photo.revision_id is null
    or not exists(select 1 from public.community_work_revisions r
      where r.revision_id=v_photo.revision_id and r.work_id=p_work_id)
  then raise exception 'X05_PREGRANT_FROZEN_PHOTO_INVALID'; end if;
  select wrm.media_id into v_media
  from public.work_revision_media wrm
  join public.media_assets m on m.media_id=wrm.media_id
  where wrm.work_revision_id=v_photo.revision_id
    and wrm.role='dreamsnap' and wrm.ordinal=0
    and m.owner_account_id=v_account and m.processing_state='ready'
    and m.moderation_state='clear' and m.purged_at is null;
  if v_media is null then raise exception 'X05_PREGRANT_MEDIA_UNAVAILABLE'; end if;
  if exists(select 1 from public.dreamsnap_entries where work_id=p_work_id) then
    v_kind:='OriginalCompetition';
    select e.entry_id into v_entry from public.dreamsnap_entries e
      where e.work_id=p_work_id and e.account_id=v_account
        and e.challenge_id=v_dw.challenge_id
        and e.entry_revision_id=v_photo.revision_id
        and e.entry_state='entered' and e.eligibility_state='eligible'
        and not e.managed_under13;
    if v_entry is null then raise exception 'X05_PREGRANT_ENTRY_MISMATCH'; end if;
  else
    v_kind:='PostEventCreation';
    if not exists(select 1 from private.dreamsnap_post_event_staged_v1 st
      where st.work_id=p_work_id and st.creator_profile_id=v_work.creator_profile_id
        and st.challenge_id=v_dw.challenge_id
        and st.immutable_photo_revision_id=v_photo.revision_id
        and st.media_id=v_media and st.publication_state='staged'
        and st.official_voting_authority='unknown'
        and st.wand_voting_authority='unknown'
        and st.rights_provenance='unknown')
      or exists(select 1 from public.dreamsnap_gallery_publications
        where work_id=p_work_id)
    then raise exception 'X05_PREGRANT_POSTEVENT_NOT_STAGED'; end if;
  end if;

  -- Active policy evidence is not inferred from Owner P01-P03 guidance.
  select pr.policy_version,pr.policy_digest,
    pr.scope_id,rec.canonical_text,rec.approval_reference
    into v_policy
  from private.dreamsnap_x05_owner_policy_v1 pr
  join private.dreamsnap_x05_policy_receipt_v1 rec
    on rec.policy_version=pr.policy_version
  where pr.is_active
    and rec.approved_at<=clock_timestamp()
    and encode(pg_catalog.sha256(convert_to(rec.canonical_text,'UTF8')),'hex')=pr.policy_digest
  order by pr.policy_version desc limit 1;
  v_policy_ready:=found;
  v_status:=case when v_policy_ready then 'PREGRANT_READY'
                 else 'NEED_POLICY_ARTIFACT' end;
  return jsonb_strip_nulls(jsonb_build_object(
    'contractVersion','wand.dreamsnaps.pregrant-service@1',
    'state',v_status,
    'ownerAuthorized',true,
    'workId',p_work_id,'kind',v_kind,
    'creatorProfileId',v_work.creator_profile_id,
    'challengeId',v_dw.challenge_id,
    'photoRevisionId',v_photo.revision_id,
    'photoMediaId',v_media,
    'entryId',case when v_kind='OriginalCompetition' then to_jsonb(v_entry) else null end,
    'frozenEntryRevisionId',case when v_kind='OriginalCompetition' then to_jsonb(v_photo.revision_id) else null end,
    'authenticatedAccountBound',true,
    'workPhotoBindingVerified',true,
    'mediaOwnershipVerified',true,
    'originalImageImmutable',true,
    'expectedRowVersion',0,
    'expectedAuthorizationEpoch',0,
    'grantRecorded',false,
    'publicActivationAllowed',false,
    'officialChallengePhaseVerified',false,
    'policyReceipt',case when v_policy_ready then
       jsonb_build_object('policyVersionText',v_policy.policy_version,
         'policyDigest',v_policy.policy_digest,'scopeId',v_policy.scope_id,
         'canonicalText',v_policy.canonical_text)
       else null end,
    'grantAvailable',v_policy_ready,
    'erasure',jsonb_build_object('state','NOT_REQUESTED',
         'physicalPurgeVerified',false,'publicDisabled',v_work.visibility<>'public')
  ));
end
$pregrant$;
revoke all on function public.community_dreamsnap_x05_pregrant_read_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_x05_pregrant_read_v1(uuid)
  to authenticated;
comment on function public.community_dreamsnap_x05_pregrant_read_v1(uuid) is
 'Authenticated immutable photo and active canonical policy receipt preview BEFORE first Source149 grant. No public issuer or implied rights acceptance.';
