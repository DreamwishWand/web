create table if not exists private.preset_storage_integrity_incidents_r18(
 incident_id uuid primary key default gen_random_uuid(),
 reservation_id uuid not null references private.preset_storage_reservations_r18(reservation_id),
 owner_account_id uuid not null references public.wand_accounts(account_id),
 observed_lease_fence bigint not null,
 issue_code text not null check(issue_code in (
  'CONDITIONAL_COPY_OUTCOME_UNKNOWN',
  'LATE_COPY_AFTER_LEASE',
  'DESTINATION_VERSION_DRIFT',
  'PUBLISHED_SHA_MISMATCH',
  'PUBLISHED_MISSING_POST_COMMIT',
  'HISTORICAL_REFERENCE_UNKNOWN',
  'PROVIDER_CAPABILITY_UNPROVEN'
 )),
 reported_object_version text,
 reported_sha256 text check(reported_sha256 is null or reported_sha256 ~ '^[0-9a-f]{64}$'),
 reported_byte_size bigint check(reported_byte_size is null or reported_byte_size>=0),
 evidence_class text not null default 'EDGE_OBSERVATION_UNATTESTED'
  check(evidence_class='EDGE_OBSERVATION_UNATTESTED'),
 incident_state text not null default 'QUARANTINED_PENDING_OPERATOR'
  check(incident_state='QUARANTINED_PENDING_OPERATOR'),
 publication_authorized boolean not null default false check(publication_authorized=false),
 physical_delete_authorized boolean not null default false check(physical_delete_authorized=false),
 created_at timestamptz not null default clock_timestamp(),
 unique(reservation_id,observed_lease_fence,issue_code)
);
create index if not exists preset_storage_incident_owner_r18
 on private.preset_storage_integrity_incidents_r18(owner_account_id,created_at);
alter table private.preset_storage_integrity_incidents_r18 enable row level security;
revoke all on private.preset_storage_integrity_incidents_r18 from public,anon,authenticated,service_role;

create or replace function public.community_preset_storage_report_integrity_r18(
 p_auth_subject uuid,p_reservation_id uuid,p_expected_version bigint,p_lease_fence bigint,
 p_issue_code text,p_object_version text,p_reported_sha256 text,p_reported_byte_size bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r18$
declare
 v_owner uuid;
 v_res private.preset_storage_reservations_r18%rowtype;
 v_incident_id uuid;
begin
 v_owner:=private.resolve_active_account(p_auth_subject);
 perform 1 from public.wand_accounts a
  where a.account_id=v_owner and a.status='active' and a.deleted_at is null
  for share;
 if not found or private.is_account_privacy_suppressed(v_owner) then
  raise exception 'R18_PRESET_INTEGRITY_ACTOR_INACTIVE';
 end if;
 select * into v_res from private.preset_storage_reservations_r18 r
  where r.reservation_id=p_reservation_id and r.owner_account_id=v_owner for update;
 if v_res.reservation_id is null then
  raise exception 'R18_PRESET_INTEGRITY_RESERVATION_FORBIDDEN';
 end if;
 if v_res.state_version<>p_expected_version or v_res.lease_fence<>p_lease_fence then
  raise exception 'R18_PRESET_INTEGRITY_STALE_FENCE_OR_VERSION';
 end if;
 if not exists(select 1 from public.creator_profiles c
  where c.creator_profile_id=v_res.creator_profile_id and c.owner_account_id=v_owner)
 then raise exception 'R18_PRESET_INTEGRITY_CREATOR_FORBIDDEN';end if;
 if p_issue_code not in (
  'CONDITIONAL_COPY_OUTCOME_UNKNOWN','LATE_COPY_AFTER_LEASE',
  'DESTINATION_VERSION_DRIFT','PUBLISHED_SHA_MISMATCH',
  'PUBLISHED_MISSING_POST_COMMIT','HISTORICAL_REFERENCE_UNKNOWN',
  'PROVIDER_CAPABILITY_UNPROVEN'
 ) or p_issue_code is null then
  raise exception 'R18_PRESET_INTEGRITY_ISSUE_INVALID';
 end if;
 if p_issue_code='PUBLISHED_MISSING_POST_COMMIT'
   and v_res.reservation_state<>'COMMITTED_PRESET_PUBLICATION'
 then raise exception 'R18_PRESET_INTEGRITY_NOT_COMMITTED';end if;
 if p_reported_sha256 is not null and p_reported_sha256 !~ '^[0-9a-f]{64}$'
   or p_reported_byte_size is not null and p_reported_byte_size<0
   or length(coalesce(p_object_version,''))>256
 then raise exception 'R18_PRESET_INTEGRITY_METADATA_INVALID';end if;
 insert into private.preset_storage_integrity_incidents_r18(
  reservation_id,owner_account_id,observed_lease_fence,issue_code,
  reported_object_version,reported_sha256,reported_byte_size
 ) values (
  v_res.reservation_id,v_owner,v_res.lease_fence,p_issue_code,
  nullif(p_object_version,''),p_reported_sha256,p_reported_byte_size
 )
 on conflict(reservation_id,observed_lease_fence,issue_code) do nothing;
 select incident_id into v_incident_id
  from private.preset_storage_integrity_incidents_r18
  where reservation_id=v_res.reservation_id
    and observed_lease_fence=v_res.lease_fence and issue_code=p_issue_code;
 return jsonb_build_object(
  'contract','ddv.preset-provider-integrity-incident@r18-work',
  'incidentId',v_incident_id,
  'reservationId',v_res.reservation_id,
  'state','QUARANTINED_PENDING_OPERATOR',
  'evidenceClass','EDGE_OBSERVATION_UNATTESTED',
  'providerOriginAttested',false,
  'publicationAuthorized',false,
  'physicalDeleteAuthorized',false,
  'cleanupClaimAuthorized',false
 );
end;$r18$;
revoke all on function public.community_preset_storage_report_integrity_r18(
 uuid,uuid,bigint,bigint,text,text,text,bigint
) from public,anon,authenticated,service_role;
grant execute on function public.community_preset_storage_report_integrity_r18(
 uuid,uuid,bigint,bigint,text,text,text,bigint
) to service_role;

insert into private.community_writer_reference_registry_r16(
 edge_key,source_relation,target_relation,identity_contract,owner_contract,
 time_scope,direction,mutation_owner,lock_scope,version_contract,
 privacy_visibility,enrollment_state,evidence_class
) values(
 'r18-provider-integrity-quarantine',
 'private.preset_storage_integrity_incidents_r18',
 'Published Storage object and immutable Preset/Scene/Gallery/Cloud graph',
 'reservation id+owner+lease fence+state version',
 'Account/Creator','BOTH','OBSERVES_INCIDENT',
 '03 COMM Source-only integrity reporter',
 'Account FOR SHARE > Reservation FOR UPDATE',
 'EDGE_OBSERVATION_UNATTESTED never becomes provider attestation',
 'OWNER_PRIVATE','SOURCE_PRESENT_UNENROLLED','CONFIRMED'
) on conflict(edge_key) do nothing;
insert into private.community_writer_routes_r16(
 writer_key,source_rpc,edge_call_site,enrollment_state,lock_scope,
 graph_registry,optimistic_contract,retry_contract,limitation
) values(
 'r18-provider-integrity-incident',
 'public.community_preset_storage_report_integrity_r18',
 'NO DEPLOYED OWNER EDGE ROUTE',
 'SOURCE_PRESENT_UNENROLLED',
 'Account>Reservation',
 'provider-integrity-source-only@r18-work',
 'STATE_VERSION+LEASE_FENCE',
 'Idempotent incident by reservation/fence/issue; never delete object',
 'Signed owner only; untrusted observation not provider proof, cannot publish or cleanup'
) on conflict(writer_key) do nothing;
