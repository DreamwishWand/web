#!/usr/bin/env python3
import os
import json
import uuid
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
uid=uuid.uuid4
owner,subject,creator=uid(),uid(),uid()
stage=f'staging/{owner}/{uid()}.json'
def one(conn,sql,args=()):
 return conn.execute(sql,args).fetchone()[0]
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
  a.execute("""insert into public.auth_identities(
   account_id,provider,provider_subject,last_verified_at,identity_state)
   values(%s,'supabase',%s,now(),'active')""",(owner,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("""insert into public.creator_profiles(
   creator_profile_id,owner_account_id,handle,display_name)
   values(%s,%s,%s,'INT provider quarantine')""",(creator,owner,'int137_'+uid().hex[:15]))
 reservation=one(a,"""select public.community_preset_storage_reserve_r18(
  %s,%s,%s,%s,%s,100,%s,1,'scene')""",
  (subject,creator,stage,'int137-'+uid().hex[:18],'a'*64,'b'*64))
 rid=uuid.UUID(reservation['reservationId'])
 lease=one(b,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(subject,rid))
 assert lease['stateVersion']==2
 issue=one(a,"""select public.community_preset_storage_report_integrity_r18(
  %s,%s,2,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN','version-synthetic',null,null)""",
  (subject,rid))
 assert issue['state']=='QUARANTINED_PENDING_OPERATOR'
 assert issue['publicationAuthorized'] is False
 assert issue['physicalDeleteAuthorized'] is False
 assert one(b,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
 assert one(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 print(json.dumps({'case':'09INT_R18_SOURCE137_ACTUAL_PG_INCIDENT_RECORDED_GATE_CLOSED',
  'separateRealPGBackends':True,'providerActualStorage':False}))
 a.execute('begin')
 try:
  a.execute("""update private.preset_storage_release_gate_r18 set
    enabled=true,provider_precondition_accepted=true,
    operator_evidence_ref='INT137_LOCAL_SYNTHETIC_NOT_PROVIDER'
    where gate_key='verified_preset_publication'""")
  a.execute("""update private.preset_storage_reservations_r18
    set reservation_state='VERIFIED_PUBLISHED_OBJECT',
     verification_evidence_state='PROVIDER_ATTESTED',
     readback_at=clock_timestamp(),readback_byte_size=100,
     readback_sha256=%s where reservation_id=%s""",('b'*64,rid))
  v=one(a,"""select private.preset_storage_commit_candidate_r18(
    %s,%s,2,%s,1,'INT137',null,'public','{}'::jsonb)""",
    (subject,rid,uuid.UUID(lease['leaseToken'])))
  assert v['workId'] and v['presetArtifactId']
  assert one(a,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))=='COMMITTED_PRESET_PUBLICATION'
  assert one(a,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==1
  assert one(a,'select count(*) from public.artifact_blobs where storage_key=%s',(reservation['publishedStorageKey'],))==1
  print(json.dumps({'case':'09INT_R18_SOURCE137_SYNTHETIC_GATE_TRUE_COMMIT_WITH_UNRESOLVED_QUARANTINE',
    'isolation':'LOCAL_TRANSACTION_ROLLBACK_ONLY',
    'finding':'HYPOTHESIS_CONFIRMED_IN_LOCAL_SQL; integrity incident is not SQL commit veto',
    'realProviderObject':False,'publicPositiveWriterEnabled':False,'unsafeFutureIfGateEnabledWithoutVeto':True}))
 finally:
  a.execute('rollback')
 assert one(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 assert one(b,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
 assert one(b,'select count(*) from public.artifact_blobs where storage_key=%s',(reservation['publishedStorageKey'],))==0
 assert one(b,'select count(*) from public.community_works where owner_account_id=%s',(owner,))==0
 assert one(b,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))=='PROMOTION_IN_PROGRESS'
 print(json.dumps({'result':'09INT_R18_SOURCE137_QUARANTINE_DOES_NOT_VETO_SYNTHETIC_POSITIVE_COMMIT_SQL',
 'actualPostgreSQL':True,'actualProviderStorage':False,
 'signedJWT':False,'allPositiveWriterStillOff':True,'releaseGateRestoredOff':True}))
