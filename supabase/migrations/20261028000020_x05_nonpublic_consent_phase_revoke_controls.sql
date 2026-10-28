-- Source149 / 03 COMM X05. ADDITIVE NONPUBLIC ONLY.
-- Source141-148 and all public readers, Edge, signers, workers remain unchanged.
-- This is a private owner-consent / preflight / revoke staging contract, NOT a publisher.
create table private.dreamsnap_x05_work_control_v1 (
  work_id uuid primary key references public.dreamsnap_works(work_id) on delete cascade,
  owner_account_id uuid not null references public.wand_accounts(account_id),
  creator_profile_id uuid not null references public.creator_profiles(creator_profile_id),
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  work_kind text not null check(work_kind in ('OriginalCompetition','PostEventCreation')),
  frozen_photo_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  frozen_media_id uuid not null references public.media_assets(media_id),
  concept_revision_id uuid not null references public.community_work_revisions(revision_id),
  grant_policy_version text not null check(char_length(grant_policy_version) between 1 and 80),
  grant_policy_digest text not null check(grant_policy_digest ~ '^[0-9a-f]{64}$'),
  grant_scopes text[] not null default array['cdn','display','store','thumbnail']::text[]
    check(grant_scopes = array['cdn','display','store','thumbnail']::text[]),
  creator_self_capture_declared boolean not null check(creator_self_capture_declared),
  grant_at timestamptz not null default clock_timestamp(),
  withdrawn_at timestamptz,
  control_state text not null default 'consented'
    check(control_state in ('consented','preflight_blocked','withdrawn','delete_requested')),
  public_activation_allowed boolean not null default false check(public_activation_allowed=false),
  authorization_epoch bigint not null default 1 check(authorization_epoch>0),
  row_version bigint not null default 1 check(row_version>0),
  updated_at timestamptz not null default clock_timestamp(),
  check((control_state in ('withdrawn','delete_requested'))=(withdrawn_at is not null))
);

create table private.dreamsnap_x05_consent_events_v1 (
  work_id uuid not null references private.dreamsnap_x05_work_control_v1(work_id) on delete cascade,
  event_version bigint not null check(event_version>0),
  action text not null check(action in ('grant','withdraw','delete_requested')),
  account_id uuid not null references public.wand_accounts(account_id),
  policy_version text not null,
  policy_digest text not null check(policy_digest ~ '^[0-9a-f]{64}$'),
  event_at timestamptz not null default clock_timestamp(),
  primary key(work_id,event_version)
);

create table private.dreamsnap_x05_purge_tracking_v1 (
  work_id uuid primary key references private.dreamsnap_x05_work_control_v1(work_id) on delete cascade,
  frozen_media_id uuid not null references public.media_assets(media_id),
  request_state text not null default 'requested'
    check(request_state in ('requested','provider_pending','provider_reported','verified')),
  requested_at timestamptz not null default clock_timestamp(),
  provider_reported_at timestamptz,
  verified_at timestamptz,
  provider_receipt_digest text check(provider_receipt_digest is null or provider_receipt_digest ~ '^[0-9a-f]{64}$'),
  check(request_state <> 'verified' or (verified_at is not null and provider_receipt_digest is not null)),
  check(request_state <> 'provider_reported' or provider_reported_at is not null)
);
comment on table private.dreamsnap_x05_purge_tracking_v1 is
  'Requested and pending are DB-only states; verified requires a future separately approved real provider attestation integration. No Source149 function can mark verified. Existing Retention/Cloud/Incident remain authoritative.';
revoke all on private.dreamsnap_x05_work_control_v1,
  private.dreamsnap_x05_consent_events_v1,
  private.dreamsnap_x05_purge_tracking_v1
from public,anon,authenticated,service_role;

-- Official published weekly 13:00 UTC cadence; NEVER an issuer-verified real challenge phase.
create or replace function private.dreamsnap_x05_schedule_preflight_v1(
  p_official_submission_week_start timestamptz,
  p_asof timestamptz
) returns jsonb language plpgsql immutable security invoker
set search_path=pg_catalog as $preflight$
declare
  v_start timestamp;
  v_state text;
begin
  if p_official_submission_week_start is null or p_asof is null then
    return jsonb_build_object('scheduleState','unknown','positivePublicAllowed',false,'source','OFFICIAL_WEEKLY_SCHEDULE_ONLY');
  end if;
  v_start:=p_official_submission_week_start at time zone 'UTC';
  if extract(isodow from v_start)<>3 or extract(hour from v_start)<>13
     or extract(minute from v_start)<>0 or extract(second from v_start)<>0 then
    return jsonb_build_object('scheduleState','invalid_anchor','positivePublicAllowed',false,'source','OFFICIAL_WEEKLY_SCHEDULE_ONLY');
  end if;
  v_state:=case
    when p_asof < p_official_submission_week_start then 'upcoming'
    when p_asof < p_official_submission_week_start+interval '7 days' then 'submission'
    when p_asof < p_official_submission_week_start+interval '14 days' then 'voting'
    else 'scheduled_post_voting'
  end;
  return jsonb_build_object('scheduleState',v_state,'positivePublicAllowed',false,
    'source','OFFICIAL_WEEKLY_SCHEDULE_ONLY','verifiedChallengeId',false,
    'officialServerPhaseVerified',false);
end
$preflight$;
revoke all on function private.dreamsnap_x05_schedule_preflight_v1(timestamptz,timestamptz)
from public,anon,authenticated,service_role;

-- Private read-time fence: existing Work privacy/incident controls remain independent.
create or replace function private.dreamsnap_x05_control_live_v1(p_work_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private as $live$
  select exists (
    select 1 from private.dreamsnap_x05_work_control_v1 x
    join public.community_works w on w.work_id=x.work_id
    join public.wand_accounts a on a.account_id=w.owner_account_id
    join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
    join public.community_entities ce on ce.entity_id=cp.creator_profile_id
    join public.dreamsnap_works dw on dw.work_id=w.work_id
    join public.media_assets m on m.media_id=x.frozen_media_id
    where x.work_id=p_work_id
      and x.control_state in ('consented','preflight_blocked')
      and x.withdrawn_at is null and x.public_activation_allowed=false
      and w.owner_account_id=x.owner_account_id
      and w.creator_profile_id=x.creator_profile_id
      and dw.challenge_id=x.challenge_id
      and dw.managed_under13=false
      and a.status='active' and a.deleted_at is null
      and cp.owner_account_id=w.owner_account_id
      and cp.moderation_state='clear' and ce.deleted_at is null
      and w.moderation_state='clear'
      and not private.is_account_privacy_suppressed(w.owner_account_id)
      and exists (select 1 from public.auth_identities ai
        where ai.account_id=w.owner_account_id
          and ai.provider='supabase' and ai.identity_state='active')
      and m.owner_account_id=w.owner_account_id
      and m.processing_state='ready' and m.moderation_state='clear' and m.purged_at is null
  )
$live$;
revoke all on function private.dreamsnap_x05_control_live_v1(uuid)
from public,anon,authenticated,service_role;

-- Existing private issuer MUST pin p_auth_subject to the verified JWT; function is
-- NOT granted to service_role/anon/authenticated and cannot be invoked over Edge.
-- All mutable control calls lock the actual Work first for concurrent withdraw/CAS.
create or replace function private.dreamsnap_x05_record_creator_grant_v1(
  p_auth_subject uuid, p_work_id uuid, p_photo_revision_id uuid, p_media_id uuid,
  p_policy_version text, p_policy_digest text, p_expected_version bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $grant$
declare
  v_account uuid;
  v_work public.community_works%rowtype;
  v_dw public.dreamsnap_works%rowtype;
  v_kind text;
  v_old private.dreamsnap_x05_work_control_v1%rowtype;
  v_challenge uuid;
  v_concept uuid;
  v_version bigint;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if p_work_id is null or p_photo_revision_id is null or p_media_id is null
     or coalesce(char_length(p_policy_version),0) not between 1 and 80
     or p_policy_digest is null or p_policy_digest !~ '^[0-9a-f]{64}$'
     or p_expected_version is null or p_expected_version<0 then
    raise exception 'X05_INVALID_GRANT';
  end if;
  select * into v_work from public.community_works
  where work_id=p_work_id for update;
  select * into v_dw from public.dreamsnap_works where work_id=p_work_id;
  if v_work.work_id is null or v_work.work_type<>'dreamsnap'
     or v_work.owner_account_id is distinct from v_account
     or v_work.moderation_state<>'clear' or v_work.lifecycle_state='deleted'
     or v_dw.work_id is null or v_dw.managed_under13
     or v_work.current_published_revision_id is null
     or not exists(select 1 from public.wand_accounts a where a.account_id=v_account
       and a.status='active' and a.deleted_at is null)
     or not exists(select 1 from public.auth_identities ai
       where ai.provider='supabase' and ai.provider_subject=p_auth_subject::text
       and ai.account_id=v_account and ai.identity_state='active')
     or not exists(select 1 from public.creator_profiles cp
       join public.community_entities ce on ce.entity_id=cp.creator_profile_id
       where cp.creator_profile_id=v_work.creator_profile_id and cp.owner_account_id=v_account
         and cp.moderation_state='clear' and ce.deleted_at is null)
     or private.is_account_privacy_suppressed(v_account)
  then raise exception 'X05_OWNER_OR_PRIVACY_DENIED'; end if;
  if not exists (
    select 1 from public.community_work_revisions cr
    join public.dreamsnap_work_revisions dr on dr.revision_id=cr.revision_id
    join public.work_revision_media wrm on wrm.work_revision_id=cr.revision_id
      and wrm.media_id=p_media_id and wrm.role='dreamsnap' and wrm.ordinal=0
    join public.media_assets m on m.media_id=wrm.media_id
    where cr.revision_id=p_photo_revision_id and cr.work_id=p_work_id
      and dr.challenge_id=v_dw.challenge_id and dr.integrity_state='eligible'
      and dr.game_screenshot_attested and dr.no_external_edits_attested
      and m.owner_account_id=v_account and m.processing_state='ready'
      and m.moderation_state='clear' and m.purged_at is null
  ) then raise exception 'X05_FROZEN_PHOTO_INVALID'; end if;
  if exists(select 1 from public.dreamsnap_entries where work_id=p_work_id) then
    v_kind:='OriginalCompetition';
    if not exists(select 1 from public.dreamsnap_entries e
      where e.work_id=p_work_id and e.account_id=v_account
        and e.entry_revision_id=p_photo_revision_id and e.entry_state='entered'
        and e.eligibility_state='eligible' and not e.managed_under13)
    then raise exception 'X05_ORIGINAL_ENTRY_FROZEN_MISMATCH'; end if;
  else
    v_kind:='PostEventCreation';
    if not exists(select 1 from private.dreamsnap_post_event_staged_v1 s
      where s.work_id=p_work_id and s.creator_profile_id=v_work.creator_profile_id
        and s.challenge_id=v_dw.challenge_id
        and s.immutable_photo_revision_id=p_photo_revision_id and s.media_id=p_media_id
        and s.publication_state='staged' and s.official_voting_authority='unknown'
        and s.wand_voting_authority='unknown'
        and s.rights_provenance='unknown')
       or exists(select 1 from public.dreamsnap_gallery_publications where work_id=p_work_id)
    then raise exception 'X05_POSTEVENT_STAGED_REFERENCE_INVALID'; end if;
  end if;
  select * into v_old from private.dreamsnap_x05_work_control_v1
    where work_id=p_work_id for update;
  if v_old.work_id is null then
    if p_expected_version<>0 then raise exception 'X05_ROW_VERSION_CONFLICT'; end if;
    v_version:=1;
    v_concept:=v_work.current_published_revision_id;
    insert into private.dreamsnap_x05_work_control_v1(
      work_id,owner_account_id,creator_profile_id,challenge_id,work_kind,
      frozen_photo_revision_id,frozen_media_id,concept_revision_id,
      grant_policy_version,grant_policy_digest,creator_self_capture_declared
    ) values(p_work_id,v_account,v_work.creator_profile_id,v_dw.challenge_id,v_kind,
      p_photo_revision_id,p_media_id,v_concept,p_policy_version,p_policy_digest,true);
  else
    if p_expected_version<>v_old.row_version
       or v_old.control_state in ('withdrawn','delete_requested')
       or v_old.frozen_photo_revision_id<>p_photo_revision_id
       or v_old.frozen_media_id<>p_media_id
       or v_old.work_kind<>v_kind
       or v_old.owner_account_id<>v_account
    then raise exception 'X05_GRANT_CAS_OR_IMMUTABLE_MISMATCH'; end if;
    v_version:=v_old.row_version+1;
    update private.dreamsnap_x05_work_control_v1
      set grant_policy_version=p_policy_version,grant_policy_digest=p_policy_digest,
          row_version=v_version,authorization_epoch=authorization_epoch+1,
          updated_at=clock_timestamp(),control_state='consented'
    where work_id=p_work_id;
  end if;
  insert into private.dreamsnap_x05_consent_events_v1(
    work_id,event_version,action,account_id,policy_version,policy_digest
  ) values(p_work_id,v_version,'grant',v_account,p_policy_version,p_policy_digest);
  return jsonb_build_object('workId',p_work_id,'kind',v_kind,'rowVersion',v_version,
    'publicActivationAllowed',false,'consentRecorded',true);
end
$grant$;
revoke all on function private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint)
from public,anon,authenticated,service_role;

create or replace function private.dreamsnap_x05_owner_transition_v1(
  p_auth_subject uuid, p_work_id uuid, p_expected_version bigint,
  p_action text, p_concept_revision_id uuid default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $transition$
declare
  v_account uuid;
  v_work public.community_works%rowtype;
  v_ctl private.dreamsnap_x05_work_control_v1%rowtype;
  v_next text;
  v_version bigint;
  v_schedule jsonb;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  select * into v_work from public.community_works where work_id=p_work_id for update;
  select * into v_ctl from private.dreamsnap_x05_work_control_v1
    where work_id=p_work_id for update;
  if v_work.work_id is null or v_ctl.work_id is null
    or v_work.owner_account_id is distinct from v_account
    or v_ctl.owner_account_id is distinct from v_account
    or not exists(select 1 from public.auth_identities ai
      where ai.provider='supabase' and ai.provider_subject=p_auth_subject::text
        and ai.account_id=v_account and ai.identity_state='active')
    or private.is_account_privacy_suppressed(v_account)
  then raise exception 'X05_OWNER_OR_PRIVACY_DENIED'; end if;
  if p_expected_version is distinct from v_ctl.row_version
  then raise exception 'X05_ROW_VERSION_CONFLICT'; end if;
  if v_ctl.control_state in ('withdrawn','delete_requested')
    then raise exception 'X05_TERMINAL_WITHDRAWN'; end if;
  if p_action in ('preflight','concept') and
      (v_work.moderation_state<>'clear'
       or not private.dreamsnap_x05_control_live_v1(p_work_id))
  then raise exception 'X05_AUTHORITY_REVOKED'; end if;
  v_version:=v_ctl.row_version+1;
  if p_action='preflight' then
    -- Real Challenge start/OnlineId/issuer/override never assumed.
    v_schedule:=private.dreamsnap_x05_schedule_preflight_v1(null,statement_timestamp());
    v_next:='preflight_blocked';
    update private.dreamsnap_x05_work_control_v1
      set control_state=v_next,row_version=v_version,
        authorization_epoch=authorization_epoch+1,updated_at=clock_timestamp()
      where work_id=p_work_id;
  elsif p_action='concept' then
    if p_concept_revision_id is null
      or not exists(select 1 from public.community_work_revisions r
        where r.revision_id=p_concept_revision_id and r.work_id=p_work_id)
      or p_concept_revision_id=v_ctl.frozen_photo_revision_id
      or exists(select 1 from public.work_revision_media wrm
        where wrm.work_revision_id=p_concept_revision_id)
    then raise exception 'X05_CONCEPT_REVISION_INVALID'; end if;
    -- Draft Concept pointer only, not published Work/Entry/image.
    update private.dreamsnap_x05_work_control_v1
      set concept_revision_id=p_concept_revision_id,
        row_version=v_version,authorization_epoch=authorization_epoch+1,
        updated_at=clock_timestamp()
      where work_id=p_work_id;
    v_next:=v_ctl.control_state;
  elsif p_action in ('withdraw','delete') then
    v_next:=case when p_action='withdraw' then 'withdrawn' else 'delete_requested' end;
    -- CURRENT Source144/145 and Source146 checks read the same Work.visibility,
    -- and original Gallery publication sync trigger makes legacy signer fail closed.
    update public.community_works set visibility='private',updated_at=clock_timestamp()
      where work_id=p_work_id and visibility<>'private';
    update private.dreamsnap_x05_work_control_v1
      set control_state=v_next,withdrawn_at=clock_timestamp(),
        authorization_epoch=authorization_epoch+1,
        row_version=v_version,updated_at=clock_timestamp()
      where work_id=p_work_id;
    insert into private.dreamsnap_x05_consent_events_v1(
      work_id,event_version,action,account_id,policy_version,policy_digest
    ) values(p_work_id,v_version,
      case when p_action='withdraw' then 'withdraw' else 'delete_requested' end,
      v_account,v_ctl.grant_policy_version,v_ctl.grant_policy_digest);
    if p_action='delete' then
      insert into private.dreamsnap_x05_purge_tracking_v1(work_id,frozen_media_id)
      values(p_work_id,v_ctl.frozen_media_id)
      on conflict(work_id) do nothing;
    end if;
  else
    raise exception 'X05_UNKNOWN_ACTION';
  end if;
  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key
  ) values('community_work',p_work_id,'dreamsnap.x05_nonpublic_'||p_action,
    jsonb_build_object('workId',p_work_id,'rowVersion',v_version,'authzEpoch',
      v_ctl.authorization_epoch+1,'publicAllowed',false),
    'dreamsnap.x05:'||p_work_id::text||':'||v_version::text);
  return jsonb_build_object('workId',p_work_id,'kind',v_ctl.work_kind,
    'rowVersion',v_version,'authorizationEpoch',v_ctl.authorization_epoch+1,
    'state',v_next,'publicActivationAllowed',false,
    'scheduledPreflight',v_schedule,
    'purgeState',case when p_action='delete' then 'requested' else null end);
end
$transition$;
revoke all on function private.dreamsnap_x05_owner_transition_v1(uuid,uuid,bigint,text,uuid)
from public,anon,authenticated,service_role;

-- Always false: an explicit contract for Source-only clients, not a bypass route.
create or replace function private.dreamsnap_x05_public_activation_v1(p_work_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select false $$;
revoke all on function private.dreamsnap_x05_public_activation_v1(uuid)
from public,anon,authenticated,service_role;
comment on function private.dreamsnap_x05_public_activation_v1(uuid) is
 'Source149 only: positive public activation always FALSE, even with a consent, scheduled phase or READY image. No issuer authority, signer, provider, public grants or browser route.';
