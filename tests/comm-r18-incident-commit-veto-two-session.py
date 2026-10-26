#!/usr/bin/env python3
import json
import os
import uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,actor,creator=u(),u(),u()
stage=f'staging/{owner}/{u()}.json'
idem='veto-'+u().hex
def one(c,q,args=()):
 return c.execute(q,args).fetchone()[0]
def denied(c,q,args,reason,savepoint=False):
 if savepoint:c.execute('savepoint veto_probe')
 try:one(c,q,args)
 except psycopg.Error as e:
  if savepoint:c.execute('rollback to savepoint veto_probe')
  assert reason in str(e),(reason,str(e))
  return
 if savepoint:c.execute('rollback to savepoint veto_probe')
 raise AssertionError('VETO_BYPASS:'+reason)
def counts(c):
 return {name:one(c,'select count(*) from public.'+name) for name in
   ('artifact_blobs','community_works','preset_revisions',
    'community_work_revisions','preset_revision_publications',
    'search_documents','outbox_events','idempotency_keys')}
commit='''select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'source138 test',null,'public','{}'::jsonb)'''
report='''select public.community_preset_storage_report_integrity_r18(%s,%s,%s,%s,%s,%s,%s,%s)'''
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
 for role in ('service_role','authenticated','anon'):
  assert not one(a,"select has_function_privilege(%s,'private.preset_storage_commit_candidate_r18(uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb)','EXECUTE')",(role,))
 for role in ('authenticated','anon'):
  assert not one(a,"select has_function_privilege(%s,'public.community_preset_storage_report_integrity_r18(uuid,uuid,bigint,bigint,text,text,text,bigint)','EXECUTE')",(role,))
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
  a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
    values(%s,'supabase',%s,now(),'active')""",(owner,str(actor)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
    values(%s,%s,%s,'Source138 incident veto')""",(creator,owner,'veto_'+u().hex[:15]))
 reserveArgs=(actor,creator,stage,idem,'a'*64,100,'b'*64,1,'scene')
 reserve='''select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,%s,%s,%s,%s)'''
 reservation=one(a,reserve,reserveArgs)
 rid=uuid.UUID(reservation['reservationId'])
 lease=one(a,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,rid))
 token=uuid.UUID(lease['leaseToken'])
 assert lease['stateVersion']==2 and lease['leaseFence']==1
 baseline=counts(a)
 issueArgs=(actor,rid,2,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN','provider-uncertain',None,None)
 # Concurrent reporter holds Account SHARE/Reservation UPDATE while prospective commit waits.
 a.execute('begin')
 first=one(a,report,issueArgs)
 assert first['state']=='QUARANTINED_PENDING_OPERATOR'
 b.execute('begin')
 b.execute("""update private.preset_storage_release_gate_r18 set
   enabled=true,provider_precondition_accepted=true,
   operator_evidence_ref='SOURCE138_CONCURRENT_ROLLBACK_NEVER_PROVIDER'
   where gate_key='verified_preset_publication'""")
 b.execute("set local lock_timeout='150ms'")
 try:
  one(b,commit,(actor,rid,token))
  raise AssertionError('COMMIT_DID_NOT_WAIT_FOR_INCIDENT_REPORTER')
 except psycopg.Error as e:assert e.sqlstate=='55P03',e.sqlstate
 b.execute('rollback')
 a.execute('commit')
 assert one(b,report,issueArgs)['incidentId']==first['incidentId']
 assert one(a,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==1
 # Synthetic gate + fake attestation only inside this transaction; no committed provider or positive work.
 b.execute('begin')
 b.execute("""update private.preset_storage_release_gate_r18
   set enabled=true,provider_precondition_accepted=true,
       operator_evidence_ref='SOURCE138_ROLLBACK_SYNTHETIC_NEVER_PROVIDER'
   where gate_key='verified_preset_publication'""")
 b.execute("""update private.preset_storage_reservations_r18
   set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',
       readback_at=clock_timestamp(),readback_byte_size=100,readback_sha256=%s
   where reservation_id=%s""",('b'*64,rid))
 denied(b,commit,(actor,rid,token),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL',True)
 assert counts(b)==baseline
 b.execute('rollback')
 assert counts(a)==baseline
 # Old fence: lock-respecting synthetic administrative lease advancement cannot hide previous incident.
 b.execute('begin')
 b.execute("""update private.preset_storage_reservations_r18 set
   lease_fence=lease_fence+1,state_version=state_version+1,lease_token=%s,
   lease_expires_at=clock_timestamp()+interval '30 seconds'
   where reservation_id=%s""",(u(),rid))
 denied(b,'select public.community_preset_storage_claim_promotion_r18(%s,%s,3)',
   (actor,rid),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL',True)
 assert one(b,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s and observed_lease_fence=1",(rid,))==1
 b.execute('rollback')
 # Reserve replay, Readback, recovery, and cleanup preflight are quarantined/non-actionable.
 denied(a,reserve,reserveArgs,'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
 denied(a,'select public.community_preset_storage_recovery_r18(%s,%s,2,%s)',
   (actor,rid,'READBACK_FAILED'),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
 denied(a,'select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,1,100,%s)',
   (actor,rid,token,'b'*64),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
 cleanup=one(a,'select public.community_preset_storage_cleanup_preflight_r18(%s,%s)',(actor,reservation['publishedStorageKey']))
 assert cleanup['unresolvedIncidentCount']==1 and cleanup['cleanupAuthorized'] is False
 assert cleanup['physicalDeleteAuthorized'] is False
 snap=one(a,'select private.preset_storage_reservation_snapshot_r18(r) from private.preset_storage_reservations_r18 r where reservation_id=%s',(rid,))
 assert snap['reservationState']=='QUARANTINED_PENDING_OPERATOR' and snap['unresolvedIncidentCount']==1
 denied(a,'delete from private.preset_storage_integrity_incidents_r18 where reservation_id=%s returning incident_id',
   (rid,),'R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED')
 denied(a,"update private.preset_storage_integrity_incidents_r18 set incident_state='QUARANTINED_PENDING_OPERATOR' where reservation_id=%s returning incident_id",
   (rid,),'R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED')
 assert counts(a)==baseline
 # Completed replay: separately fabricate a successful Commit, report a post-Commit missing object,
 # then prove replay is VETOED. Entire synthetic DB positive work is ROLLBACK.
 b.execute('begin')
 try:
  assert one(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
  # This synthetic success must use another reservation without an incident.
  altstage=f'staging/{owner}/{u()}.json'
  altid='veto-complete-'+u().hex
  altArgs=(actor,creator,altstage,altid,'c'*64,100,'d'*64,1,'scene')
  alt=one(b,reserve,altArgs);altid_uuid=uuid.UUID(alt['reservationId'])
  altlease=one(b,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,altid_uuid))
  b.execute("""update private.preset_storage_release_gate_r18 set
    enabled=true,provider_precondition_accepted=true,
    operator_evidence_ref='SOURCE138_ROLLBACK_SYNTHETIC_NEVER_PROVIDER'
    where gate_key='verified_preset_publication'""")
  b.execute("""update private.preset_storage_reservations_r18 set
    reservation_state='VERIFIED_PUBLISHED_OBJECT',
    verification_evidence_state='PROVIDER_ATTESTED',
    readback_at=clock_timestamp(),readback_byte_size=100,readback_sha256=%s
    where reservation_id=%s""",('d'*64,altid_uuid))
  v=one(b,commit,(actor,altid_uuid,uuid.UUID(altlease['leaseToken'])))
  assert v['workId'] and v['presetArtifactId']
  altstate=one(b,'select state_version from private.preset_storage_reservations_r18 where reservation_id=%s',(altid_uuid,))
  assert altstate==3
  miss=one(b,report,(actor,altid_uuid,3,1,'PUBLISHED_MISSING_POST_COMMIT','fake-provider-version',None,None))
  assert miss['publicationAuthorized'] is False
  denied(b,commit,(actor,altid_uuid,uuid.UUID(altlease['leaseToken'])),
    'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL',True)
  assert one(b,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(altid_uuid,))==1
 finally:
  b.execute('rollback')
 assert counts(a)==baseline
 assert one(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 assert one(a,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))=='PROMOTION_IN_PROGRESS'
 print(json.dumps({'case':'R18_SOURCE138_INTEGRITY_ALL_FENCE_COMMIT_AND_COMPLETED_REPLAY_VETO_ACTUAL_2PG',
   'actualTwoPostgresBackends':True,'reporterCommitSerialized':True,
   'unknownProviderEvidenceOnly':True,'syntheticPositiveRollback':True,
   'oldFenceBlocks':True,'noPartialBlobWorkRevisionSearchOutbox':True,
   'incidentImmutable':True,'preflightDeniesCleanup':True,'signedProviderExecuted':False}))
