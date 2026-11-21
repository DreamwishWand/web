
alter table private.preset_storage_reservations_r18
  add column if not exists lease_token uuid,
  add column if not exists lease_fence bigint not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists readback_byte_size bigint,
  add column if not exists readback_sha256 text,
  add column if not exists readback_at timestamptz,
  add column if not exists provider_object_version text,
  add column if not exists verification_evidence_state text not null default 'NOT_ATTESTED';
alter table private.preset_storage_reservations_r18
  drop constraint if exists preset_storage_reservations_r18_readback_hash_ck;
alter table private.preset_storage_reservations_r18
  add constraint preset_storage_reservations_r18_readback_hash_ck
  check(readback_sha256 is null or readback_sha256 ~ '^[0-9a-f]{64}$');
alter table private.preset_storage_reservations_r18
  drop constraint if exists preset_storage_reservations_r18_evidence_ck;
alter table private.preset_storage_reservations_r18
  add constraint preset_storage_reservations_r18_evidence_ck
  check(verification_evidence_state in
    ('NOT_ATTESTED','EDGE_READBACK_UNATTESTED','PROVIDER_ATTESTED'));
create index if not exists preset_storage_lease_expiry_r18
  on private.preset_storage_reservations_r18(lease_expires_at)
  where lease_token is not null;
create table if not exists private.preset_storage_release_gate_r18(
  gate_key text primary key check(gate_key='verified_preset_publication'),
  enabled boolean not null default false,
  provider_precondition_accepted boolean not null default false,
  operator_evidence_ref text,
  updated_at timestamptz not null default now(),
  check(not enabled or (provider_precondition_accepted and operator_evidence_ref is not null))
);
insert into private.preset_storage_release_gate_r18(gate_key)
values('verified_preset_publication') on conflict do nothing;
alter table private.preset_storage_release_gate_r18 enable row level security;
revoke all on private.preset_storage_release_gate_r18 from public,anon,authenticated,service_role;
create table if not exists private.preset_storage_commit_scope_r18(
  txn_id bigint not null,
  reservation_id uuid not null,
  storage_key text not null,
  primary key(txn_id,reservation_id)
);
alter table private.preset_storage_commit_scope_r18 enable row level security;
revoke all on private.preset_storage_commit_scope_r18 from public,anon,authenticated,service_role;

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

create or replace function private.preset_storage_prohibit_unenrolled_published_blob_r18()
returns trigger language plpgsql set search_path=pg_catalog,public,private as $r18$
begin
  if new.storage_key like 'published/%'
    and (tg_op='INSERT' or new.storage_key is distinct from old.storage_key) then
    if not exists(
       select 1 from private.preset_storage_commit_scope_r18 s
       join private.preset_storage_reservations_r18 r on r.reservation_id=s.reservation_id
       where s.txn_id=txid_current()
         and s.storage_key=new.storage_key
         and r.owner_account_id=new.owner_account_id
         and r.published_storage_key=new.storage_key
         and r.reservation_state='VERIFIED_PUBLISHED_OBJECT'
         and r.readback_byte_size=new.byte_size
         and r.readback_sha256=new.checksum_sha256
    ) then raise exception 'R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED';end if;
  end if;
  return new;
end;$r18$;

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
revoke all on function private.preset_storage_commit_candidate_r18(
  uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.community_preset_storage_claim_promotion_r18(
  uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_claim_promotion_r18(
  uuid,uuid,bigint) to service_role;
revoke all on function public.community_preset_storage_report_readback_r18(
  uuid,uuid,bigint,uuid,bigint,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_report_readback_r18(
  uuid,uuid,bigint,uuid,bigint,bigint,text) to service_role;
insert into private.community_writer_reference_registry_r16(
  edge_key,source_relation,target_relation,identity_contract,
  owner_contract,time_scope,direction,mutation_owner,lock_scope,
  version_contract,privacy_visibility,enrollment_state,evidence_class)
values
('preset-storage-fenced-promotion-r18',
 'private.preset_storage_reservations_r18(lease_token,lease_fence)',
 'Storage published object','Reservation+Fence+Version',
 'Account/Creator','BOTH','PROMOTION_GATED','03 COMM',
 'Account FOR SHARE > Reservation FOR UPDATE',
 'No provider conditional copy accepted','OWNER_PRIVATE','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('preset-storage-verified-commit-r18',
 'private.preset_storage_commit_candidate_r18',
 'artifact_blobs/preset_revisions/community_works/idempotency/outbox',
 'Reservation+Fencing+Provider Attestation',
 'Account/Creator','BOTH','PUBLISHES','03 COMM',
 'Account FOR SHARE > Reservation FOR UPDATE > Preset',
 'Owner-only gate disabled/no attestor registered','PUBLICATION_DISABLED','FAIL_CLOSED','CONFIRMED')
on conflict(edge_key) do nothing;
insert into private.community_writer_routes_r16(
 writer_key,source_rpc,edge_call_site,enrollment_state,lock_scope,
 graph_registry,optimistic_contract,retry_contract,limitation)
values
('preset-claim-promotion-r18','public.community_preset_storage_claim_promotion_r18',
 'wep-preset-artifact.inspectPublishedObject','SOURCE_PRESENT_UNENROLLED',
 'Account>Reservation','preset-fenced@r18-work','LEASE_TOKEN+FENCE+STATE_VERSION',
 'Stale terminal until authoritative recovery','Lease does not authorize Storage.copy'),
('preset-commit-candidate-r18','private.preset_storage_commit_candidate_r18',
 'NO PUBLIC EDGE ROUTE','FAIL_CLOSED',
 'Account>Reservation>New Work','preset-fenced@r18-work',
 'LEASE_TOKEN+FENCE+STATE_VERSION+ATTESTATION','Gate disabled',
 'Actual provider attestor/Copy/cleanup reference graph not accepted')
on conflict(writer_key) do nothing;
