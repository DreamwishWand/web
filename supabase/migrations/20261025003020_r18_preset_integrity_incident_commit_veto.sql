-- Source138 additive repair: all Source134–137 migration files remain untouched.
-- Source137 incident reporter and all guarded mutations serialize via Account FOR SHARE
-- followed by Reservation FOR UPDATE; the helper is called only under the row lock.
-- No positive release, resolution, staging, provider copy or physical delete is enrolled.
create or replace function private.preset_storage_assert_no_integrity_incident_r18(
 p_reservation_id uuid
) returns void language plpgsql stable security invoker
set search_path=pg_catalog,public,private as $r18$
begin
  -- CALLER MUST HOLD THE SAME RESERVATION ROW FOR UPDATE (or equivalent) first.
  -- All fences are included: a new lease never erases old provider uncertainty.
  if exists(
    select 1 from private.preset_storage_integrity_incidents_r18 i
    where i.reservation_id=p_reservation_id
      and i.incident_state='QUARANTINED_PENDING_OPERATOR'
  ) then
    raise exception 'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL';
  end if;
end;$r18$;
revoke all on function private.preset_storage_assert_no_integrity_incident_r18(uuid)
 from public,anon,authenticated,service_role;
create or replace function private.preset_storage_integrity_incident_immutable_r18()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public,private as $r18$
begin
 raise exception 'R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED';
end;$r18$;
revoke all on function private.preset_storage_integrity_incident_immutable_r18()
 from public,anon,authenticated,service_role;
drop trigger if exists preset_integrity_incidents_immutable_r18
 on private.preset_storage_integrity_incidents_r18;
create trigger preset_integrity_incidents_immutable_r18
 before update or delete on private.preset_storage_integrity_incidents_r18
 for each row execute function private.preset_storage_integrity_incident_immutable_r18();

create or replace function private.preset_storage_commit_candidate_r18(
  p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint,
  p_lease_token uuid,p_lease_fence bigint,
  p_title text,p_description text,p_visibility text,p_metadata jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,extensions as $r18$
declare v_res private.preset_storage_reservations_r18%rowtype;
  v_owner uuid;v_blob uuid;v_art uuid;v_preset_revision uuid;
  v_work uuid;v_work_revision uuid;v_response jsonb;
begin
  if not exists(select 1 from private.preset_storage_release_gate_r18
    where gate_key='verified_preset_publication' and enabled
      and provider_precondition_accepted and operator_evidence_ref is not null)
    then raise exception 'R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED';end if;
  v_owner:=private.resolve_active_account(p_auth_subject);
  perform 1 from public.wand_accounts a
   where a.account_id=v_owner and a.status='active' and a.deleted_at is null
   for share;
  if not found or private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_ACTOR_INACTIVE';end if;
  select * into v_res from private.preset_storage_reservations_r18
    where reservation_id=p_reservation_id and owner_account_id=v_owner for update;
  if v_res.reservation_id is null then raise exception 'R18_PRESET_RESERVATION_FORBIDDEN';end if;
  perform private.preset_storage_assert_no_integrity_incident_r18(v_res.reservation_id);
  if v_res.reservation_state='COMMITTED_PRESET_PUBLICATION' then
    select i.response into v_response from public.idempotency_keys i
      where i.account_id=v_owner and i.idempotency_key=v_res.idempotency_key
        and i.request_hash=v_res.request_hash
        and i.completed_at is not null;
    if v_res.committed_blob_id is null or v_response is null
      then raise exception 'R18_PRESET_COMMITTED_REPLAY_NOT_PROVABLE';end if;
    return v_response;
  end if;
  if v_res.state_version<>p_expected_version
   or v_res.lease_token is distinct from p_lease_token
   or v_res.lease_fence<>p_lease_fence
   or v_res.lease_expires_at<=clock_timestamp()
    then raise exception 'R18_PRESET_STALE_FENCE_OR_LEASE';end if;
  if v_res.reservation_state<>'VERIFIED_PUBLISHED_OBJECT'
    or v_res.verification_evidence_state<>'PROVIDER_ATTESTED'
    or v_res.readback_at is null
    or v_res.readback_sha256<>v_res.checksum_sha256
    or v_res.readback_byte_size<>v_res.byte_size
    then raise exception 'R18_PRESET_PUBLISHED_BYTES_NOT_INDEPENDENTLY_VERIFIED';end if;
  if not exists(select 1 from public.creator_profiles c
    where c.creator_profile_id=v_res.creator_profile_id and c.owner_account_id=v_owner
      and c.moderation_state='clear')
    then raise exception 'R18_PRESET_CREATOR_INACTIVE';end if;
  if exists(select 1 from public.artifact_blobs b
    where b.storage_key=v_res.published_storage_key)
    then raise exception 'R18_PRESET_PUBLISHED_STORAGE_KEY_IN_USE';end if;
  if p_visibility not in ('public','private','unlisted')
      or nullif(btrim(p_title),'') is null
    then raise exception 'R18_PRESET_PUBLICATION_METADATA_INVALID';end if;
  insert into private.preset_storage_commit_scope_r18(txn_id,reservation_id,storage_key)
    values(txid_current(),v_res.reservation_id,v_res.published_storage_key);
  insert into public.artifact_blobs(
    owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
  values(v_owner,v_res.published_storage_key,v_res.schema_version,
    v_res.content_type,v_res.byte_size,v_res.checksum_sha256)
  returning blob_id into v_blob;
  v_art:=gen_random_uuid();v_work:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values
    (v_art,'preset_artifact'),(v_work,'community_work');
  insert into public.community_works(work_id,owner_account_id,creator_profile_id,
    work_type,visibility) values(v_work,v_owner,v_res.creator_profile_id,
    'preset',p_visibility::visibility_state);
  insert into public.preset_artifacts(preset_artifact_id,owner_account_id,
    creator_profile_id,community_work_id,preset_type)
  values(v_art,v_owner,v_res.creator_profile_id,v_work,v_res.preset_type);
  insert into public.preset_revisions(preset_artifact_id,revision_number,
    artifact_blob_id,metadata,created_by_account_id)
  values(v_art,1,v_blob,coalesce(p_metadata,'{}'::jsonb),v_owner)
  returning preset_revision_id into v_preset_revision;
  insert into public.community_work_revisions(work_id,revision_number,
    created_by_account_id,shared_metadata)
  values(v_work,1,v_owner,jsonb_build_object('title',p_title,'description',p_description))
  returning revision_id into v_work_revision;
  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
    values(v_work_revision,v_preset_revision);
  update public.community_works
    set lifecycle_state='published',
        current_published_revision_id=v_work_revision,published_at=now()
    where work_id=v_work;
  if p_visibility='public' then
    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,
      published_at,updated_at)
    values(v_work,v_work,'preset',v_res.creator_profile_id,p_title,
      coalesce(p_description,''),now(),now());
  end if;
  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values('community_work',v_work,'work.published',
     jsonb_build_object('workId',v_work,'revisionId',v_work_revision,
       'presetArtifactId',v_art,'presetRevisionId',v_preset_revision),
     'work.published:'||v_work_revision::text);
  v_response:=jsonb_build_object('presetArtifactId',v_art,
     'presetRevisionId',v_preset_revision,'workId',v_work,
     'workRevisionId',v_work_revision);
  insert into public.idempotency_keys(account_id,idempotency_key,
    command_name,request_hash,response,completed_at)
  values(v_owner,v_res.idempotency_key,'publish_preset_envelope',
    v_res.request_hash,v_response,now());
  update private.preset_storage_reservations_r18
    set reservation_state='COMMITTED_PRESET_PUBLICATION',
      state_version=state_version+1,committed_blob_id=v_blob,
      lease_token=null,lease_expires_at=null,updated_at=clock_timestamp()
    where reservation_id=v_res.reservation_id;
  delete from private.preset_storage_commit_scope_r18 where
    txn_id=txid_current() and reservation_id=v_res.reservation_id;
  return v_response;
end;$r18$;

create or replace function public.community_preset_storage_claim_promotion_r18(
  p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r18$
declare v_owner uuid;v_res private.preset_storage_reservations_r18%rowtype;
  v_token uuid;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  perform 1 from public.wand_accounts a
   where a.account_id=v_owner and a.status='active' and a.deleted_at is null
   for share;
  if not found or private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_ACTOR_INACTIVE'; end if;
  select * into v_res from private.preset_storage_reservations_r18
   where reservation_id=p_reservation_id and owner_account_id=v_owner for update;
  if v_res.reservation_id is null then raise exception 'R18_PRESET_RESERVATION_FORBIDDEN';end if;
  perform private.preset_storage_assert_no_integrity_incident_r18(v_res.reservation_id);
  if v_res.state_version<>p_expected_version then raise exception 'R18_PRESET_RESERVATION_STALE';end if;
  if not exists(select 1 from public.creator_profiles c
     where c.creator_profile_id=v_res.creator_profile_id
      and c.owner_account_id=v_owner and c.moderation_state='clear')
    then raise exception 'R18_PRESET_CREATOR_INACTIVE';end if;
  if v_res.reservation_state not in ('RESERVED','FAILED_RECOVERABLE')
     or (v_res.retry_after is not null and v_res.retry_after>clock_timestamp())
    then raise exception 'R18_PRESET_PROMOTION_NOT_CLAIMABLE';end if;
  if exists(select 1 from public.artifact_blobs b
     where b.storage_key=v_res.published_storage_key)
    then raise exception 'R18_PRESET_PUBLISHED_BLOB_ALREADY_REGISTERED';end if;
  v_token:=gen_random_uuid();
  update private.preset_storage_reservations_r18 set
    reservation_state='PROMOTION_IN_PROGRESS',
    lease_token=v_token,lease_fence=lease_fence+1,
    lease_expires_at=clock_timestamp()+interval '90 seconds',
    state_version=state_version+1,
    readback_byte_size=null,readback_sha256=null,readback_at=null,
    provider_object_version=null,
    verification_evidence_state='NOT_ATTESTED',
    updated_at=clock_timestamp()
  where reservation_id=p_reservation_id returning * into v_res;
  return jsonb_build_object(
    'contract','ddv.preset-promotion-fence@r18-work',
    'reservationId',v_res.reservation_id,
    'stateVersion',v_res.state_version,
    'leaseToken',v_res.lease_token,'leaseFence',v_res.lease_fence,
    'leaseExpiresAt',v_res.lease_expires_at,
    'publishedStorageKey',v_res.published_storage_key,
    'sourceStagingKey',v_res.source_staging_key,
    'checksumSha256',v_res.checksum_sha256,
    'byteSize',v_res.byte_size,
    'providerCopyAuthorized',false,'publicationCommitAuthorized',false,
    'cleanupAuthorized',false);
end;$r18$;

create or replace function public.community_preset_storage_report_readback_r18(
  p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint,
  p_lease_token uuid,p_lease_fence bigint,
  p_downloaded_byte_size bigint,p_downloaded_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r18$
declare v_owner uuid;v_res private.preset_storage_reservations_r18%rowtype;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  perform 1 from public.wand_accounts a
   where a.account_id=v_owner and a.status='active' and a.deleted_at is null
   for share;
  if not found or private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_ACTOR_INACTIVE';end if;
  select * into v_res from private.preset_storage_reservations_r18
   where reservation_id=p_reservation_id and owner_account_id=v_owner for update;
  if v_res.reservation_id is null then raise exception 'R18_PRESET_RESERVATION_FORBIDDEN';end if;
  perform private.preset_storage_assert_no_integrity_incident_r18(v_res.reservation_id);
  if v_res.state_version<>p_expected_version or v_res.lease_token is distinct from p_lease_token
      or v_res.lease_fence<>p_lease_fence
      or v_res.lease_expires_at<=clock_timestamp()
      or v_res.reservation_state<>'PROMOTION_IN_PROGRESS'
    then raise exception 'R18_PRESET_STALE_FENCE_OR_LEASE';end if;
  if not exists(select 1 from public.creator_profiles c
     where c.creator_profile_id=v_res.creator_profile_id
       and c.owner_account_id=v_owner and c.moderation_state='clear')
    then raise exception 'R18_PRESET_CREATOR_INACTIVE';end if;
  if p_downloaded_byte_size<>v_res.byte_size
     or p_downloaded_sha256 is distinct from v_res.checksum_sha256 then
    update private.preset_storage_reservations_r18 set
      reservation_state='FAILED_RECOVERABLE',
      lease_token=null,lease_expires_at=null,
      state_version=state_version+1,
      last_failure='PROVIDER_READBACK_MISMATCH',
      retry_after=clock_timestamp()+interval '30 seconds',
      updated_at=clock_timestamp()
    where reservation_id=p_reservation_id returning * into v_res;
    return jsonb_build_object(
      'reservationId',v_res.reservation_id,'stateVersion',v_res.state_version,
      'readbackMatches',false,'publicationCommitAuthorized',false,
      'cleanupAuthorized',false,'state','FAILED_RECOVERABLE');
  end if;
  update private.preset_storage_reservations_r18 set
    reservation_state='VERIFICATION_REQUIRED',
    readback_byte_size=p_downloaded_byte_size,
    readback_sha256=p_downloaded_sha256,readback_at=clock_timestamp(),
    verification_evidence_state='EDGE_READBACK_UNATTESTED',
    state_version=state_version+1,
    updated_at=clock_timestamp()
  where reservation_id=p_reservation_id returning * into v_res;
  return jsonb_build_object(
    'reservationId',v_res.reservation_id,'stateVersion',v_res.state_version,
    'readbackMatches',true,'readbackSource','EDGE_DOWNLOADED_BYTES_NOT_INDEPENDENTLY_ATTESTED',
    'leaseFence',v_res.lease_fence,
    'leaseExpiresAt',v_res.lease_expires_at,
    'verifiedPublishedObject',false,'publicationCommitAuthorized',false,
    'cleanupAuthorized',false,'state','VERIFICATION_REQUIRED');
end;$r18$;

create or replace function public.community_preset_storage_recovery_r18(
  p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint,
  p_failure_code text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r18$
declare v_owner uuid;v_row private.preset_storage_reservations_r18%rowtype;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  perform 1 from public.wand_accounts a
    where a.account_id=v_owner and a.status='active' and a.deleted_at is null
    for share;
  if not found or private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_RESERVATION_ACTOR_INACTIVE';end if;
  select * into v_row from private.preset_storage_reservations_r18
    where reservation_id=p_reservation_id and owner_account_id=v_owner for update;
  if v_row.reservation_id is null
    then raise exception 'R18_PRESET_RESERVATION_FORBIDDEN';end if;
  perform private.preset_storage_assert_no_integrity_incident_r18(v_row.reservation_id);
  if v_row.state_version<>p_expected_version
    then raise exception 'R18_PRESET_RESERVATION_STALE';end if;
  if v_row.reservation_state='COMMITTED_PRESET_PUBLICATION'
    then raise exception 'R18_PRESET_PUBLISHED_KEY_IMMUTABLE';end if;
  if p_failure_code is null or length(btrim(p_failure_code)) not between 1 and 80
     or p_failure_code !~ '^[A-Z0-9_]+$'
    then raise exception 'R18_PRESET_RECOVERY_REASON_INVALID';end if;
  update private.preset_storage_reservations_r18
  set reservation_state='FAILED_RECOVERABLE',state_version=state_version+1,
      copy_attempts=copy_attempts+1,last_failure=p_failure_code,
      retry_after=now()+interval '30 seconds',updated_at=now()
  where reservation_id=p_reservation_id returning * into v_row;
  return private.preset_storage_reservation_snapshot_r18(v_row);
end;$r18$;

create or replace function public.community_preset_storage_reserve_r18(
  p_auth_subject uuid,p_creator_profile_id uuid,p_source_staging_key text,
  p_idempotency_key text,p_request_hash text,p_byte_size bigint,
  p_checksum_sha256 text,p_schema_version integer,p_preset_type text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,extensions as $r18$
declare v_owner uuid; v_account public.wand_accounts%rowtype;
  v_row private.preset_storage_reservations_r18%rowtype;
  v_final_key text;v_hash text;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  select * into v_account from public.wand_accounts a
    where a.account_id=v_owner and a.status='active' and a.deleted_at is null
    for share;
  if v_account.account_id is null or private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_RESERVATION_ACTOR_INACTIVE';end if;
  if not exists(select 1 from public.creator_profiles c
      where c.creator_profile_id=p_creator_profile_id
        and c.owner_account_id=v_owner and c.moderation_state='clear')
    then raise exception 'R18_PRESET_RESERVATION_CREATOR_FORBIDDEN';end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_byte_size not between 1 and 26214400
    or p_schema_version<=0 or p_preset_type<>'scene'
  then raise exception 'R18_PRESET_RESERVATION_METADATA_INVALID';end if;
  if p_source_staging_key is null
    or left(p_source_staging_key,length('staging/'||v_owner::text||'/'))
       <> 'staging/'||v_owner::text||'/'
    or p_source_staging_key !~ '^staging/[0-9a-f-]{36}/[0-9a-f-]{36}\.json$'
  then raise exception 'R18_PRESET_STAGING_KEY_FORBIDDEN';end if;
  v_final_key:='published/'||v_owner::text||'/'||
    encode(extensions.digest(convert_to(v_owner::text||':'||p_idempotency_key,'UTF8'),'sha256'),'hex')||'.json';
  v_hash:=encode(extensions.digest(convert_to(
    concat_ws('|','preset-reservation-r18',p_creator_profile_id::text,
      p_source_staging_key,p_idempotency_key,p_request_hash,p_byte_size::text,
      lower(p_checksum_sha256),p_schema_version::text,p_preset_type),
    'UTF8'),'sha256'),'hex');
  insert into private.preset_storage_reservations_r18(
    owner_account_id,creator_profile_id,auth_subject,idempotency_key,request_hash,
    source_staging_key,published_storage_key,byte_size,checksum_sha256,
    content_type,schema_version,preset_type)
  values(v_owner,p_creator_profile_id,p_auth_subject,p_idempotency_key,v_hash,
    p_source_staging_key,v_final_key,p_byte_size,lower(p_checksum_sha256),
    'application/json',p_schema_version,p_preset_type)
  on conflict(owner_account_id,idempotency_key) do nothing;
  select * into v_row from private.preset_storage_reservations_r18
    where owner_account_id=v_owner and idempotency_key=p_idempotency_key for update;
  if v_row.reservation_id is null then
    raise exception 'R18_PRESET_RESERVATION_UNAVAILABLE';
  end if;
  perform private.preset_storage_assert_no_integrity_incident_r18(v_row.reservation_id);
  if v_row.request_hash<>v_hash or v_row.published_storage_key<>v_final_key
    then raise exception 'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT';end if;
  if v_row.reservation_state='COMMITTED_PRESET_PUBLICATION' then
    raise exception 'R18_PRESET_RESERVATION_COMMIT_NOT_ENROLLED';end if;
  return private.preset_storage_reservation_snapshot_r18(v_row);
end;$r18$;

create or replace function private.preset_storage_reservation_snapshot_r18(
  p_reservation private.preset_storage_reservations_r18
) returns jsonb language sql stable
set search_path=pg_catalog,public,private as $r18$
select jsonb_build_object(
  'contract','ddv.preset-storage-reservation@r18-work',
  'reservationId',p_reservation.reservation_id,
  'reservationState',case when exists(
    select 1 from private.preset_storage_integrity_incidents_r18 i
    where i.reservation_id=p_reservation.reservation_id
      and i.incident_state='QUARANTINED_PENDING_OPERATOR'
  ) then 'QUARANTINED_PENDING_OPERATOR' else p_reservation.reservation_state end,
  'unresolvedIncidentCount',(
    select count(*) from private.preset_storage_integrity_incidents_r18 i
    where i.reservation_id=p_reservation.reservation_id
      and i.incident_state='QUARANTINED_PENDING_OPERATOR'
  ),
  'stateVersion',p_reservation.state_version,
  'ownerAccountId',p_reservation.owner_account_id,
  'creatorProfileId',p_reservation.creator_profile_id,
  'sourceStagingKey',p_reservation.source_staging_key,
  'publishedStorageKey',p_reservation.published_storage_key,
  'byteSize',p_reservation.byte_size,
  'checksumSha256',p_reservation.checksum_sha256,
  'contentType',p_reservation.content_type,
  'schemaVersion',p_reservation.schema_version,
  'presetType',p_reservation.preset_type,
  'copyAttempts',p_reservation.copy_attempts,
  'retryAfter',p_reservation.retry_after,
  'registeredBlobId',p_reservation.committed_blob_id,
  'realPublishedObjectBytesVerified',false,
  'publishedObjectVerificationAuthorized',false,
  'publicationCommitAuthorized',false,
  'physicalCleanupAuthorized',false,
  'sourceFullyEnrolled',false,
  'recoveryInstruction',case when exists(
    select 1 from private.preset_storage_integrity_incidents_r18 i
    where i.reservation_id=p_reservation.reservation_id
      and i.incident_state='QUARANTINED_PENDING_OPERATOR'
  ) then 'TERMINAL_OPERATOR_AND_INDEPENDENT_PROVIDER_EVIDENCE_REQUIRED'
    else 'REVERIFY_OBJECT_AND_RESUME_ONLY_AFTER_SIGNED_PROVIDER_ACCEPTANCE' end,
  'snapshotNotAnAtomicStorageOperation',true
);$r18$;
revoke all on function private.preset_storage_reservation_snapshot_r18(private.preset_storage_reservations_r18)
  from public,anon,authenticated,service_role;



create or replace function public.community_preset_storage_cleanup_preflight_r18(
  p_auth_subject uuid,p_storage_key text
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $r18$
declare v_owner uuid;v_count bigint;v_registered bigint;v_references bigint;v_incidents bigint;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
  if private.is_account_privacy_suppressed(v_owner)
    then raise exception 'R18_PRESET_CLEANUP_ACTOR_INACTIVE';end if;
  if p_storage_key is null
     or (left(p_storage_key,length('staging/'||v_owner::text||'/'))
         <> 'staging/'||v_owner::text||'/'
       and left(p_storage_key,length('published/'||v_owner::text||'/'))
         <> 'published/'||v_owner::text||'/')
     then raise exception 'R18_PRESET_CLEANUP_FORBIDDEN';end if;
  select count(*) into v_count from private.preset_storage_reservations_r18
    where source_staging_key=p_storage_key or published_storage_key=p_storage_key;
  select count(*) into v_registered from public.artifact_blobs b
    where b.storage_key=p_storage_key;
  select count(*) into v_references from public.preset_revisions pr
    join public.artifact_blobs b on b.blob_id=pr.artifact_blob_id
    where b.storage_key=p_storage_key;
  select count(*) into v_incidents
    from private.preset_storage_integrity_incidents_r18 i
    join private.preset_storage_reservations_r18 r on r.reservation_id=i.reservation_id
    where r.owner_account_id=v_owner
      and (r.source_staging_key=p_storage_key or r.published_storage_key=p_storage_key)
      and i.incident_state='QUARANTINED_PENDING_OPERATOR';
  return jsonb_build_object(
    'contract','ddv.preset-storage-cleanup@r18-work',
    'reservationCount',v_count,'unresolvedIncidentCount',v_incidents,'registeredBlobCount',v_registered,
    'historicalPresetRevisionReferenceCount',v_references,
    'allCurrentHistoricalAndCloudReferencesProven',false,
    'cleanupState','DENIED','cleanupAuthorized',false,
    'physicalDeleteAuthorized',false,
    'legalRetentionCleared',false,
    'reason','R18_STORAGE_CLEANUP_OWNERSHIP_AND_PROVIDER_NOT_ACCEPTED');
end;$r18$;

-- Reassert Source135 private Commit ACL and fail-closed release gate.
revoke all on function private.preset_storage_commit_candidate_r18(
 uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb
) from public,anon,authenticated,service_role;
do $r18_veto_safety$
begin
 if exists (select 1 from private.preset_storage_release_gate_r18
            where enabled or provider_precondition_accepted or operator_evidence_ref is not null)
 then raise exception 'R18_PRESET_SOURCE138_UNEXPECTED_RELEASE_GATE_ENABLED';end if;
 if has_function_privilege('service_role',
     'private.preset_storage_commit_candidate_r18(uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb)','EXECUTE')
 then raise exception 'R18_PRESET_SOURCE138_PRIVATE_COMMIT_EXPOSED';end if;
end;$r18_veto_safety$;
