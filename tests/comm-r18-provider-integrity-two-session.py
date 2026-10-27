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
def one(c,q,args=()):
 return c.execute(q,args).fetchone()[0]
def denied(c,q,args,reason):
 try:
  one(c,q,args)
 except psycopg.Error as e:
  assert reason in str(e),(reason,str(e))
  return
 raise AssertionError('UNEXPECTED_POSITIVE:'+reason)
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
 assert one(a,"select has_function_privilege('service_role','public.community_preset_storage_report_integrity_r18(uuid,uuid,bigint,bigint,text,text,text,bigint)','EXECUTE')") is True
 for role in ('anon','authenticated'):
  assert one(b,"select has_function_privilege(%s,'public.community_preset_storage_report_integrity_r18(uuid,uuid,bigint,bigint,text,text,text,bigint)','EXECUTE')",(role,)) is False
 assert one(b,"select has_table_privilege('service_role','private.preset_storage_integrity_incidents_r18','INSERT')") is False
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
  a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
     values(%s,'supabase',%s,now(),'active')""",(owner,str(actor)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
     values(%s,%s,%s,'Provider incident local fixture')""",(creator,owner,'incident_'+u().hex[:14]))
 r=one(a,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",
  (actor,creator,stage,'incident-'+u().hex,'a'*64,'b'*64))
 rid=uuid.UUID(r['reservationId'])
 claim=one(a,"select public.community_preset_storage_claim_promotion_r18(%s,%s,1)",(actor,rid))
 assert claim['leaseFence']==1 and claim['stateVersion']==2
 q="""select public.community_preset_storage_report_integrity_r18(%s,%s,%s,%s,%s,%s,%s,%s)"""
 args=(actor,rid,2,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN','provider-v1',None,None)
 issue=one(a,q,args)
 assert issue['state']=='QUARANTINED_PENDING_OPERATOR' and issue['providerOriginAttested'] is False
 assert issue['publicationAuthorized'] is False and issue['physicalDeleteAuthorized'] is False
 assert one(b,q,args)['incidentId']==issue['incidentId']
 denied(a,q,(actor,rid,3,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN',None,None,None),'R18_PRESET_INTEGRITY_STALE_FENCE_OR_VERSION')
 denied(b,q,(actor,rid,2,999,'CONDITIONAL_COPY_OUTCOME_UNKNOWN',None,None,None),'R18_PRESET_INTEGRITY_STALE_FENCE_OR_VERSION')
 denied(b,q,(actor,rid,2,1,'PUBLISHED_MISSING_POST_COMMIT',None,None,None),'R18_PRESET_INTEGRITY_NOT_COMMITTED')
 denied(b,q,(actor,rid,2,1,'UNKNOWN_CODE',None,None,None),'R18_PRESET_INTEGRITY_ISSUE_INVALID')
 denied(a,q,(u(),rid,2,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN',None,None,None),'')
 a.execute('begin')
 a.execute('select reservation_id from private.preset_storage_reservations_r18 where reservation_id=%s for update',(rid,))
 b.execute('begin')
 b.execute("set local lock_timeout='150ms'")
 try:
  one(b,q,(actor,rid,2,1,'DESTINATION_VERSION_DRIFT','version-2','f'*64,45))
  raise AssertionError('INTEGRITY_INCIDENT_MISSING_LOCK')
 except psycopg.Error as e:
  assert e.sqlstate=='55P03',e.sqlstate
 b.execute('rollback')
 a.execute('commit')
 bad=one(b,q,(actor,rid,2,1,'DESTINATION_VERSION_DRIFT','version-2','f'*64,45))
 assert bad['evidenceClass']=='EDGE_OBSERVATION_UNATTESTED'
 assert one(a,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==2
 assert one(a,"select count(*) from public.artifact_blobs where storage_key=%s",(r['publishedStorageKey'],))==0
 assert one(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 assert one(a,"select state_version from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))==2
 print(json.dumps({'case':'R18_PROVIDER_INTEGRITY_QUARANTINE_2PG_SOURCE_ONLY',
  'actualTwoBackends':True,'noPositiveCommit':True,'noPhysicalDelete':True,
  'providerOriginAttested':False,'staleRejected':True,'idempotentIssue':True}))
