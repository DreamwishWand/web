create table if not exists private.preset_storage_reservations_r18 (
  reservation_id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.wand_accounts(account_id),
  creator_profile_id uuid not null references public.creator_profiles(creator_profile_id),
  auth_subject uuid not null,
  idempotency_key text not null check(length(btrim(idempotency_key)) between 1 and 160),
  request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
  source_staging_key text not null,
  published_storage_key text not null unique,
  byte_size bigint not null check(byte_size between 1 and 26214400),
  checksum_sha256 text not null check(checksum_sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null check(content_type='application/json'),
  schema_version integer not null check(schema_version>0),
  preset_type text not null check(preset_type='scene'),
  reservation_state text not null default 'RESERVED'
    check(reservation_state in (
      'RESERVED','PROMOTION_IN_PROGRESS','COPIED_UNVERIFIED',
      'VERIFICATION_REQUIRED','FAILED_RECOVERABLE','VERIFIED_PUBLISHED_OBJECT',
      'COMMITTED_PRESET_PUBLICATION')),
  state_version bigint not null default 1 check(state_version>0),
  copy_attempts integer not null default 0 check(copy_attempts>=0),
  committed_blob_id uuid null references public.artifact_blobs(blob_id),
  retry_after timestamptz null,
  last_failure text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_account_id,idempotency_key),
  check(source_staging_key like 'staging/%' and published_storage_key like 'published/%'),
  check((reservation_state='COMMITTED_PRESET_PUBLICATION')=(committed_blob_id is not null))
);
create index if not exists preset_storage_reservations_r18_owner_state
  on private.preset_storage_reservations_r18(owner_account_id,reservation_state);
create index if not exists preset_storage_reservations_r18_source
  on private.preset_storage_reservations_r18(source_staging_key);
alter table private.preset_storage_reservations_r18 enable row level security;
revoke all on private.preset_storage_reservations_r18 from public,anon,authenticated,service_role;
grant select on private.preset_storage_reservations_r18 to service_role;

create or replace function private.preset_storage_reservation_snapshot_r18(
  p_reservation private.preset_storage_reservations_r18
) returns jsonb language sql stable
set search_path=pg_catalog,public,private as $r18$
select jsonb_build_object(
  'contract','ddv.preset-storage-reservation@r18-work',
  'reservationId',p_reservation.reservation_id,
  'reservationState',p_reservation.reservation_state,
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
  'recoveryInstruction','REVERIFY_OBJECT_AND_RESUME_ONLY_AFTER_SIGNED_PROVIDER_ACCEPTANCE',
  'snapshotNotAnAtomicStorageOperation',true
);$r18$;
revoke all on function private.preset_storage_reservation_snapshot_r18(private.preset_storage_reservations_r18)
  from public,anon,authenticated,service_role;

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
  if v_row.request_hash<>v_hash or v_row.published_storage_key<>v_final_key
    then raise exception 'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT';end if;
  if v_row.reservation_state='COMMITTED_PRESET_PUBLICATION' then
    raise exception 'R18_PRESET_RESERVATION_COMMIT_NOT_ENROLLED';end if;
  return private.preset_storage_reservation_snapshot_r18(v_row);
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

create or replace function public.community_preset_storage_cleanup_preflight_r18(
  p_auth_subject uuid,p_storage_key text
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $r18$
declare v_owner uuid;v_count bigint;v_registered bigint;v_references bigint;
begin
  v_owner:=private.resolve_active_account(p_auth_subject);
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
  return jsonb_build_object(
    'contract','ddv.preset-storage-cleanup@r18-work',
    'reservationCount',v_count,'registeredBlobCount',v_registered,
    'historicalPresetRevisionReferenceCount',v_references,
    'allCurrentHistoricalAndCloudReferencesProven',false,
    'cleanupState','DENIED','cleanupAuthorized',false,
    'physicalDeleteAuthorized',false,
    'legalRetentionCleared',false,
    'reason','R18_STORAGE_CLEANUP_OWNERSHIP_AND_PROVIDER_NOT_ACCEPTED');
end;$r18$;
revoke all on function public.community_preset_storage_reserve_r18(uuid,uuid,text,text,text,bigint,text,integer,text)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_reserve_r18(uuid,uuid,text,text,text,bigint,text,integer,text)
 to service_role;
revoke all on function public.community_preset_storage_recovery_r18(uuid,uuid,bigint,text)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_recovery_r18(uuid,uuid,bigint,text)
 to service_role;
revoke all on function public.community_preset_storage_cleanup_preflight_r18(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_cleanup_preflight_r18(uuid,text)
 to service_role;

create or replace function public.community_publish_preset_envelope(
  p_auth_subject uuid,p_creator_profile_id uuid,p_visibility text,p_preset_type text,
  p_title text,p_description text,p_artifact_storage_key text,
  p_schema_version integer,p_content_type text,p_byte_size bigint,
  p_checksum_sha256 text,p_metadata jsonb,p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r18$
begin
  raise exception 'R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED';
end;$r18$;
revoke all on function public.community_publish_preset_envelope(
  uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text
) from public,anon,authenticated,service_role;
grant execute on function public.community_publish_preset_envelope(
  uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text
) to service_role;

create or replace function private.preset_storage_prohibit_unenrolled_published_blob_r18()
returns trigger language plpgsql set search_path=pg_catalog,public,private as $r18$
begin
  if new.storage_key like 'published/%'
    and (tg_op='INSERT' or new.storage_key is distinct from old.storage_key) then
      raise exception 'R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED';
  end if;
  return new;
end;$r18$;
drop trigger if exists preset_published_blob_reservation_guard_r18 on public.artifact_blobs;
create trigger preset_published_blob_reservation_guard_r18
  before insert or update of storage_key on public.artifact_blobs
  for each row execute function private.preset_storage_prohibit_unenrolled_published_blob_r18();
revoke all on function private.preset_storage_prohibit_unenrolled_published_blob_r18()
 from public,anon,authenticated,service_role;

insert into private.community_writer_reference_registry_r16(
  edge_key,source_relation,target_relation,identity_contract,owner_contract,
  time_scope,direction,mutation_owner,lock_scope,version_contract,privacy_visibility,
  enrollment_state,evidence_class
) values
('preset-storage-reservation-r18','private.preset_storage_reservations_r18','artifact_blobs + Storage published key','account/idempotency -> reservation','Account/Creator','BOTH','RESERVES','03 COMM Source-only','Account FOR SHARE -> reservation FOR UPDATE','state_version/idempotency request hash','OWNER_PRIVATE','SOURCE_PRESENT_UNENROLLED','CONFIRMED'),
('preset-storage-deferred-cleanup-r18','private.preset_storage_reservations_r18 + historical preset revisions','Storage.remove staging/published','storage key -> all reference owners','UNKNOWN legal + Cloud','UNKNOWN','DEFERRED_CLEANUP','03 COMM + retention ops','NO PHYSICAL DELETE LOCK ENROLLED','cleanupAuthorized=false','PRIVACY_INDEPENDENT','FAIL_CLOSED','CONFIRMED'),
('preset-storage-publication-r18','artifact_blobs/preset_revisions/preset_revision_publications','Storage object copy','published key -> committed blob','Account/Creator','BOTH','PUBLISHES','wep-preset-artifact publish','NO CROSS_SYSTEM_ATOMICITY','old publisher disabled','PUBLICATION_DISABLED','FAIL_CLOSED','CONFIRMED')
on conflict(edge_key) do update set
  enrollment_state=excluded.enrollment_state,version_contract=excluded.version_contract;
insert into private.community_writer_routes_r16(
  writer_key,source_rpc,edge_call_site,enrollment_state,
  lock_scope,graph_registry,optimistic_contract,retry_contract,limitation
) values
('preset-reserve-r18','public.community_preset_storage_reserve_r18','wep-preset-artifact.reservePublication',
 'SOURCE_PRESENT_UNENROLLED','Account FOR SHARE > Reservation FOR UPDATE','preset-storage-source-only@r18-work',
 'idempotency+state_version','same request returns same reservation','No verified provider object/commit path'),
('preset-recover-r18','public.community_preset_storage_recovery_r18','wep-preset-artifact.recoverPublication',
 'SOURCE_PRESENT_UNENROLLED','Account FOR SHARE > Reservation FOR UPDATE','preset-storage-source-only@r18-work',
 'state_version stale terminal','same expected version stale; explicit caller refresh','Safe failed-recoverable only'),
('preset-discard-r18','public.community_preset_storage_cleanup_preflight_r18','wep-preset-artifact.discard',
 'FAIL_CLOSED','NO PHYSICAL REMOVAL ALLOWED','preset-storage-source-only@r18-work',
 'cleanupAuthorized=false','NONE','Historical/current/Cloud/retention/provider cleanup cannot be proven')
on conflict(writer_key) do update set
  enrollment_state=excluded.enrollment_state,limitation=excluded.limitation;
update private.community_writer_routes_r16 set enrollment_state='FAIL_CLOSED',
  limitation='R18-work old envelope denied; no Storage provider verified reservation/commit authority'
where writer_key='preset-envelope';
