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
 # GREEN SOURCE140 ACCEPTANCE: the same independently sourced RED fixture
 # now MUST suppress quarantined Work, My Gallery, Saved, not unrelated Gallery.
 a.execute('begin')
 a.execute('savepoint qr140_denied_work')
 try:
  val(a,'select public.community_get_work(%s,%s)',(actor,impacted))
 except psycopg.Error as ex:
  assert 'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED' in str(ex),str(ex)
  a.execute('rollback to savepoint qr140_denied_work')
 else:
  raise AssertionError('QR140_AUTHENTICATED_WORK_DETAIL_NOT_SUPPRESSED')
 a.execute('rollback')
 listed=val(a,'select public.community_get_my_gallery_v1(%s,50)',(actor,))
 assert not any(x['workId']==str(impacted) for x in listed['myWorks']),'QR140_QUARANTINED_MY_GALLERY_VISIBLE'
 assert any(x['workId']==str(unrelated) for x in listed['myWorks']),'QR140_UNRELATED_MY_GALLERY_OVER_SUPPRESSED'
 assert not any(x['targetEntityId']==str(impacted) for x in listed['saved']),'QR140_QUARANTINED_MY_GALLERY_SAVED_VISIBLE'
 saved=val(a,'select public.community_get_saved(%s,50)',(actor,))
 assert not any(x['targetEntityId']==str(impacted) for x in saved),'QR140_QUARANTINED_SAVED_VISIBLE'
 assert any(x['targetEntityId']==str(unrelated) for x in saved),'QR140_UNRELATED_SAVED_OVER_SUPPRESSED'
 assert val(a,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==1
 print(json.dumps({'case':'QR_SOURCE140_AUTHENTICATED_PROJECTION_SCOPED_DENIAL_ACTUAL_TWO_PG',
 'incidentDurable':True,'impactedWorkQuarantined':True,'unrelatedWorkUnquarantined':True,
 'workDetailDenied':True,'myGalleryOmittedAffected':True,'savedOmittedAffected':True,'unrelatedPreserved':True,'testType':'SOURCE140_LOCAL_PG_GREEN_DELTA',
 'realProvider':False,'signedJWT':False,'stagingTouched':False,
 'positiveGateRemainsOff':True}))
