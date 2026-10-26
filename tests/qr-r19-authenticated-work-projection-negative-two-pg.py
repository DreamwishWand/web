#!/usr/bin/env python3
"""Independent QR Source139 local TWO-PG witness, NEW authenticated projections only.
All fabricated Provider/ReleaseGate setup is DISPOSABLE and reset to OFF in the
same real SQL transaction. No storage, JWT, or Staging endpoint connection."""
import json,os,uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert os.getenv('DATABASE_URL','')=='' and os.getenv('SUPABASE_ACCESS_TOKEN','')==''
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,actor,creator=u(),u(),u()

def val(db,sql,params=()):
 return db.execute(sql,params).fetchone()[0]

with psycopg.connect(dsn,autocommit=True) as a, psycopg.connect(dsn,autocommit=True) as b:
 assert val(a,'select pg_backend_pid()')!=val(b,'select pg_backend_pid()')
 assert val(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 with a.transaction():
  a.execute("insert into public.wand_accounts(account_id) values(%s)",(owner,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(owner,str(actor)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,%s)",(creator,owner,'qr139_'+u().hex[:15],'QR139 isolated'))
 res=val(a,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",(actor,creator,f'staging/{owner}/{u()}.json','qr139-'+u().hex,'a'*64,'b'*64))
 rid=uuid.UUID(res['reservationId'])
 claim=val(a,"select public.community_preset_storage_claim_promotion_r18(%s,%s,1)",(actor,rid))
 with a.transaction():
  a.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='QR139_LOCAL_SYNTHETIC_NOT_PROVIDER' where gate_key='verified_preset_publication'")
  a.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s",('b'*64,rid))
  receipt=val(a,"select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'QR139 synthetic',null,'public','{}'::jsonb)",(actor,rid,uuid.UUID(claim['leaseToken'])))
  rev=uuid.UUID(receipt['presetRevisionId'])
  impacted,rev_impacted,unrelated,rev_unrelated=u(),u(),u(),u()
  for work,revision in [(impacted,rev_impacted),(unrelated,rev_unrelated)]:
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
   a.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')",(work,owner,creator))
   a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
   a.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revision,work,owner))
   a.execute("insert into public.gallery_work_revisions(revision_id,title,description) values(%s,%s,'QR139 test')",(revision,'Quarantined' if work==impacted else 'Unrelated'))
  a.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(rev_impacted,rev))
  for work,revision in [(impacted,rev_impacted),(unrelated,rev_unrelated)]:
   a.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(revision,work))
   a.execute("insert into public.saved_items(account_id,target_entity_id) values(%s,%s)",(owner,work))
  a.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
 assert val(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 before=val(b,'select public.community_get_my_gallery_v1(%s,50)',(actor,))
 assert any(x['workId']==str(impacted) for x in before['myWorks'])
 assert any(x['workId']==str(unrelated) for x in before['myWorks'])
 assert val(b,'select public.community_get_work(%s,%s)',(actor,impacted))['workId']==str(impacted)
 incident=val(b,"select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','qr139 synthetic missing',null,null)",(actor,rid))
 assert incident['publicationAuthorized'] is False
 assert val(a,'select private.preset_storage_work_quarantined_r19(%s)',(impacted,)) is True
 assert val(a,'select private.preset_storage_work_quarantined_r19(%s)',(unrelated,)) is False
 assert val(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 assert val(a,'select public.community_get_work(%s,%s)',(actor,unrelated))['workId']==str(unrelated)
 # RED ACCEPTANCE WITNESS: once Incident is durable the three legacy
 # SECURITY DEFINER authenticated projections still contain impacted Work.
 leaked={}
 leaked['work_detail']=val(a,'select public.community_get_work(%s,%s)',(actor,impacted))['workId']==str(impacted)
 listed=val(a,'select public.community_get_my_gallery_v1(%s,50)',(actor,))
 leaked['my_gallery']=any(x['workId']==str(impacted) for x in listed['myWorks'])
 assert any(x['workId']==str(unrelated) for x in listed['myWorks'])
 saved=val(a,'select public.community_get_saved(%s,50)',(actor,))
 leaked['saved']=any(x['targetEntityId']==str(impacted) and x['accessible'] for x in saved)
 assert any(x['targetEntityId']==str(unrelated) for x in saved)
 assert all(leaked.values()),('Expected Source139 pre-fix negative witness changed: ',leaked)
 assert val(a,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==1
 print(json.dumps({'case':'QR_SOURCE139_AUTHENTICATED_LEGACY_PROJECTION_NEGATIVE_WITNESS_ACTUAL_TWO_PG',
 'incidentDurable':True,'impactedWorkQuarantined':True,'unrelatedWorkUnquarantined':True,
 'leakWitness':leaked,'testType':'RED_SOURCE139_CONTRACT_GAP_CONFIRMED_LOCAL_PG',
 'realProvider':False,'signedJWT':False,'stagingTouched':False,
 'positiveGateRemainsOff':True}))
