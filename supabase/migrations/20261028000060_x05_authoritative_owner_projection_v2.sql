-- 03 COMM X05 Source153. NONPUBLIC authenticated projection only.
-- Existing Source149..152, service@1, registration, policies and publisher unchanged.
-- This function returns the DB-evidenced *owner-specific* authority without
-- claiming JWT runtime, Media Provider, licence approval or global physical purge.
create or replace function public.community_dreamsnap_x05_owner_authority_v2(
  p_work_id uuid,
  p_expected_row_version bigint default null,
  p_expected_authorization_epoch bigint default null
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,auth,public,private as $projection$
declare
  v_subject uuid;
  v_account uuid;
  v_work public.community_works%rowtype;
  v_control private.dreamsnap_x05_work_control_v1%rowtype;
  v_dw public.dreamsnap_works%rowtype;
  v_media public.media_assets%rowtype;
  v_entry uuid;
  v_last_grant private.dreamsnap_x05_consent_events_v1%rowtype;
  v_policy private.dreamsnap_x05_owner_policy_v1%rowtype;
  v_receipt private.dreamsnap_x05_policy_receipt_v1%rowtype;
  v_purge private.dreamsnap_x05_purge_tracking_v1%rowtype;
  v_hold boolean;
  v_policy_valid boolean:=false;
  v_public_disabled boolean;
  v_local_purge boolean:=false;
  v_local_state text;
begin
  -- Same SQL call as the verified actor; no AccountID/CreatorID/MediaID
  -- parameter and no service_role direct execution.
  v_subject:=private.dreamsnap_x05_verified_db_subject_v1();
  v_account:=private.resolve_active_account(v_subject);
  if p_work_id is null then raise exception 'X05_V2_OWNER_DENIED'; end if;

  -- Work before Control is the accepted Source149 writer lock order.
  select * into v_work from public.community_works w
    where w.work_id=p_work_id for share;
  if not found or v_work.work_type<>'dreamsnap'
    or v_work.owner_account_id is distinct from v_account
    or v_work.lifecycle_state='deleted' or v_work.moderation_state<>'clear'
  then raise exception 'X05_V2_OWNER_DENIED'; end if;
  select * into v_control from private.dreamsnap_x05_work_control_v1 ctl
    where ctl.work_id=p_work_id for share;
  if not found or v_control.owner_account_id is distinct from v_account
    or v_control.creator_profile_id is distinct from v_work.creator_profile_id
    or v_control.public_activation_allowed is distinct from false
    or v_control.creator_self_capture_declared is distinct from true
  then raise exception 'X05_V2_CONTROL_DENIED'; end if;

  if (p_expected_row_version is not null and
       p_expected_row_version is distinct from v_control.row_version)
     or (p_expected_authorization_epoch is not null and
       p_expected_authorization_epoch is distinct from v_control.authorization_epoch)
  then raise exception 'X05_V2_STALE_VERSION_OR_EPOCH'; end if;

  if not exists(
    select 1 from public.wand_accounts a
    join public.auth_identities ai on ai.account_id=a.account_id
    join public.creator_profiles cp on cp.owner_account_id=a.account_id
    join public.community_entities ce on ce.entity_id=cp.creator_profile_id
    where a.account_id=v_account and a.status='active' and a.deleted_at is null
      and ai.provider='supabase' and ai.provider_subject=v_subject::text
      and ai.identity_state='active' and ai.retired_at is null
      and cp.creator_profile_id=v_work.creator_profile_id
      and cp.moderation_state='clear' and ce.deleted_at is null
  ) or private.is_account_privacy_suppressed(v_account)
  then raise exception 'X05_V2_ACTOR_CREATOR_PRIVACY_DENIED'; end if;

  select * into v_dw from public.dreamsnap_works dw
    where dw.work_id=p_work_id for share;
  if not found or v_dw.managed_under13
    or v_dw.challenge_id is distinct from v_control.challenge_id
  then raise exception 'X05_V2_CHALLENGE_DENIED'; end if;
  if v_work.current_published_revision_id is distinct from v_control.concept_revision_id
     or not exists(select 1 from public.community_work_revisions current_r
       where current_r.revision_id=v_control.concept_revision_id and current_r.work_id=p_work_id)
  then raise exception 'X05_V2_CURRENT_REVISION_MISMATCH'; end if;

  -- Frozen Work-specific revision is the only permitted Media binding:
  -- owning another READY Media belonging to another Work is insufficient.
  if not exists(
    select 1 from public.community_work_revisions r
    join public.dreamsnap_work_revisions dr on dr.revision_id=r.revision_id
    join public.work_revision_media wrm on wrm.work_revision_id=r.revision_id
      and wrm.ordinal=0 and wrm.role='dreamsnap'
    join public.media_assets m on m.media_id=wrm.media_id
    where r.revision_id=v_control.frozen_photo_revision_id and r.work_id=p_work_id
      and dr.challenge_id=v_control.challenge_id
      and dr.integrity_state='eligible' and dr.game_screenshot_attested
      and dr.no_external_edits_attested
      and wrm.media_id=v_control.frozen_media_id
      and m.owner_account_id=v_account and m.moderation_state='clear'
  ) then raise exception 'X05_V2_WORK_PHOTO_MEDIA_MISMATCH'; end if;
  select * into v_media from public.media_assets m
    where m.media_id=v_control.frozen_media_id and m.owner_account_id=v_account for share;
  if not found then raise exception 'X05_V2_MEDIA_OWNER_DENIED'; end if;

  -- Provider integrity incidents are independent of this owner grant.
  if private.preset_storage_work_quarantined_r19(p_work_id)
     or private.preset_storage_media_quarantined_r19(v_control.frozen_media_id)
  then raise exception 'X05_V2_INCIDENT_SUPPRESSED'; end if;

  if v_control.work_kind='OriginalCompetition' then
    select e.entry_id into v_entry from public.dreamsnap_entries e
    where e.work_id=p_work_id and e.account_id=v_account
      and e.challenge_id=v_control.challenge_id
      and e.entry_revision_id=v_control.frozen_photo_revision_id
      and e.entry_state='entered' and e.eligibility_state='eligible'
      and not e.managed_under13 for share;
    if v_entry is null then raise exception 'X05_V2_ORIGINAL_ENTRY_INVALID'; end if;
  elsif v_control.work_kind='PostEventCreation' then
    if exists(select 1 from public.dreamsnap_entries e where e.work_id=p_work_id)
       or exists(select 1 from public.dreamsnap_gallery_publications gp where gp.work_id=p_work_id)
       or not exists(select 1 from private.dreamsnap_post_event_staged_v1 st
          where st.work_id=p_work_id and st.creator_profile_id=v_work.creator_profile_id
            and st.challenge_id=v_control.challenge_id
            and st.immutable_photo_revision_id=v_control.frozen_photo_revision_id
            and st.media_id=v_control.frozen_media_id
            and st.concept_revision_id=v_control.concept_revision_id
            and st.publication_state='staged'
            and st.official_voting_authority='unknown'
            and st.wand_voting_authority='unknown'
            and st.rights_provenance='unknown')
    then raise exception 'X05_V2_POSTEVENT_STAGED_INVALID'; end if;
  else raise exception 'X05_V2_KIND_INVALID'; end if;

  -- Last *GRANT* event, not current Work CAS version after withdraw/delete.
  select * into v_last_grant from private.dreamsnap_x05_consent_events_v1 e
    where e.work_id=p_work_id and e.action='grant'
    order by e.event_version desc limit 1 for share;
  if not found or v_last_grant.account_id is distinct from v_account
    or v_last_grant.policy_version is distinct from v_control.grant_policy_version
    or v_last_grant.policy_digest is distinct from v_control.grant_policy_digest
    or v_last_grant.event_version>v_control.row_version
  then raise exception 'X05_V2_GRANT_RECEIPT_INVALID'; end if;

  -- A stored grant/event is NOT itself approved publication scope.
  select * into v_policy from private.dreamsnap_x05_owner_policy_v1 p
    where p.policy_version=v_control.grant_policy_version
      and p.policy_digest=v_control.grant_policy_digest and p.is_active for share;
  if found then
    select * into v_receipt from private.dreamsnap_x05_policy_receipt_v1 r
    where r.policy_version=v_policy.policy_version
      and r.purpose_id=v_policy.scope_id and r.approved_at<=clock_timestamp()
      and encode(pg_catalog.sha256(convert_to(r.canonical_text,'UTF8')),'hex')=v_policy.policy_digest
      for share;
    v_policy_valid:=found;
  end if;

  select * into v_purge from private.dreamsnap_x05_purge_tracking_v1 p
    where p.work_id=p_work_id and p.frozen_media_id=v_control.frozen_media_id for share;
  select exists(select 1 from private.account_retention_holds h
     where h.account_id=v_account and h.hold_type='legal'
       and h.released_at is null
       and (h.expires_at is null or h.expires_at>clock_timestamp()))
     into v_hold;
  v_public_disabled:=(v_work.visibility<>'public'
    or v_control.control_state in ('withdrawn','delete_requested'));
  v_local_purge:=v_purge.work_id is not null and v_purge.request_state='verified'
     and v_purge.verified_at is not null
     and v_purge.provider_receipt_digest is not null and v_media.purged_at is not null
     and v_public_disabled and not v_hold;
  v_local_state:=case
    when v_hold and v_purge.work_id is not null then 'LOCAL_LEGAL_HOLD'
    when v_local_purge then 'LOCAL_FROZEN_MEDIA_VERIFIED'
    when v_purge.work_id is not null then 'LOCAL_PURGE_PENDING'
    when v_public_disabled then 'PUBLIC_DISABLED'
    else 'NOT_REQUESTED' end;

  return jsonb_strip_nulls(jsonb_build_object(
    'contractVersion','wand.dreamsnaps.owner-authority-projection@1',
    'consumerTarget','wand.dreamsnaps.private-owner-consumer@2',
    'work',jsonb_build_object(
       'workId',p_work_id,'creatorProfileId',v_work.creator_profile_id,
       'challengeId',v_control.challenge_id,'kind',v_control.work_kind,
       'photoRevisionId',v_control.frozen_photo_revision_id,
       'photoMediaId',v_control.frozen_media_id,
       'currentWorkRevisionId',v_control.concept_revision_id,
       'entryId',case when v_control.work_kind='OriginalCompetition' then to_jsonb(v_entry) else null end,
       'frozenEntryRevisionId',case when v_control.work_kind='OriginalCompetition' then to_jsonb(v_control.frozen_photo_revision_id) else null end),
    'authority',jsonb_build_object(
       'ownerAuthorized',true,'authenticatedAccountBound',true,
       'activeIdentityVerified',true,'creatorOwnerVerified',true,
       'workPhotoBindingVerified',true,'mediaOwnershipVerified',true,
       'mediaReady',v_media.processing_state='ready' and v_media.purged_at is null,
       'rowVersion',v_control.row_version,
       'authorizationEpoch',v_control.authorization_epoch,
       'controlState',v_control.control_state),
    'grant',jsonb_build_object(
       'mediaId',v_control.frozen_media_id,
       'photoRevisionId',v_control.frozen_photo_revision_id,
       'creatorSelfCaptureDeclared',v_control.creator_self_capture_declared,
       'explicitGrantAccepted',true,
       'consentRecorded',true,
       'lastGrantConsentRevision',v_last_grant.event_version,
       'policyVersionText',v_control.grant_policy_version,
       'policyDigest',v_control.grant_policy_digest,
       'state',case when v_control.withdrawn_at is null then 'recorded' else 'withdrawn' end,
       'policyReceiptVerified',v_policy_valid,
       'scopeStatus',case when v_policy_valid then 'APPROVED_CANONICAL_RECEIPT' else 'UNVERIFIED' end,
       'scopeId',case when v_policy_valid then v_policy.scope_id else null end,
       'approvedPurposeIds',case when v_policy_valid then to_jsonb(array[v_receipt.purpose_id]) else null end,
       'publicUsageAuthorized',false),
    'deletion',jsonb_build_object(
       'controlState',v_control.control_state,
       'localState',v_local_state,
       'publicDisabled',v_public_disabled,
       'activeAccountLegalHold',v_hold,
       'localProviderReceiptVerified',v_local_purge,
       'localProviderScope','SINGLE_FROZEN_MEDIA_RECORD',
       'providerStatus',coalesce(v_purge.request_state,'not_requested'),
       'globalPurgeScopeComplete',false,
       'cloudCdnIssuedBearerStatus','UNKNOWN'),
    'externalEvidence',jsonb_build_object(
       'signedRuntimeSessionVerified',false,
       'storageProviderObjectVerified',false,
       'officialChallengePhaseVerified',false,
       'cloudCdnPhysicalPurgeVerified',false,
       'publicActivationAllowed',false),
    'capabilities',jsonb_build_object(
       'ownerActionsEnabled',false,'publicDetail',false,
       'publicMedia',false,'publish',false,'mediaSigner',false)
  ));
end
$projection$;
revoke all on function public.community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)
  to authenticated;
comment on function public.community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)
  is 'Versioned NONPUBLIC authenticated Work/Grant/Media source projection. Local scope only; all public/operator/provider capabilities OFF.';
