#!/usr/bin/env python3
import json,os,uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
uid=uuid.uuid4
def one(c,q,p=()):return c.execute(q,p).fetchone()[0]
def deny(c,q,p,tag):
 c.execute('savepoint media141_reject')
 try:one(c,q,p)
 except psycopg.Error as e:
  c.execute('rollback to savepoint media141_reject')
  assert tag in str(e),(tag,e.sqlstate,str(e))
 else:
  c.execute('rollback to savepoint media141_reject')
  raise AssertionError('MEDIA_ISSUER_UNEXPECTED_ACCEPT:'+tag)

with psycopg.connect(dsn,autocommit=True) as reader,psycopg.connect(dsn,autocommit=True) as reporter:
 assert one(reader,'select pg_backend_pid()')!=one(reporter,'select pg_backend_pid()')
 owner,actor,creator=uid(),uid(),uid()
 with reader.transaction():
  reader.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
  reader.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(owner,str(actor)))
  reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  reader.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'INT141 Media Issuer')",(creator,owner,'mi141_'+uid().hex[:16]))
 res=one(reader,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",(actor,creator,f'staging/{owner}/{uid()}.json','mi141-'+uid().hex,'a'*64,'b'*64))
 rid=uuid.UUID(res['reservationId'])
 lease=one(reader,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,rid))
 token=uuid.UUID(lease['leaseToken'])
 affected,control=uid(),uid()
 media,unaffected=uid(),uid()
 key=lambda mid: f'{actor}/{mid}.png'
 with reader.transaction():
  reader.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='INT141_SYNTHETIC_NOT_PROVIDER' where gate_key='verified_preset_publication'")
  reader.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s",('b'*64,rid))
  committed=one(reader,"select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'Media issuer test',null,'public','{}'::jsonb)",(actor,rid,token))
  # Disposable verification fixture only: no canonical game subject was inferred.
  subject=uid()
  reader.execute("insert into public.gallery_verified_subjects(subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,build_id,profile_schema,evidence_ref,verification_state) values(%s,'outdoor','floating_island',%s,'switch','1.25.0','52BD625D9B4E0053',624,'INT141_LOCAL_SYNTHETIC_NO_GAME_EVIDENCE','verified')",(subject,'INT141-'+str(subject)))
  for work in (affected,control):
   reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
   reader.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')",(work,owner,creator))
   reader.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
   reader.execute("insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)",(work,subject,owner,creator))
  for mid in (media,unaffected):
   reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid,))
   reader.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',100,20,20,%s,'ready','clear')",(mid,owner,key(mid),'e'*64))
  for work,mid in ((affected,media),(control,unaffected)):
   revision=uid()
   reader.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revision,work,owner))
   reader.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'INT141 Media')",(revision,))
   reader.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')",(revision,mid))
   reader.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(revision,work))
  legacy=uid()
  reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(legacy,))
  reader.execute("insert into public.preset_artifacts(preset_artifact_id,owner_account_id,creator_profile_id,associated_gallery_work_id,preset_type) values(%s,%s,%s,%s,'scene')",(legacy,owner,creator,affected))
  reader.execute("insert into public.preset_revisions(preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id) values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s),%s)",(legacy,rid,owner))
  reader.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
 assert one(reader,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 pub=lambda mid:one(reader,'select public.community_get_public_media_storage_v2(%s)',(mid,))
 own=lambda mid:one(reader,'select public.community_gallery_owner_media_read_v1(%s,%s)',(actor,mid))
 legacy=lambda mid:one(reader,'select public.community_get_media_storage_key(%s,%s)',(actor,mid))
 assert pub(media)['storageKey']==key(media)
 assert own(media)['storageKey']==key(media)
 assert legacy(media)['storageKey']==key(media)
 assert pub(unaffected)['storageKey']==key(unaffected)
 assert own(unaffected)['storageKey']==key(unaffected)
 assert legacy(unaffected)['storageKey']==key(unaffected)
 assert not one(reader,'select private.preset_storage_media_quarantined_r19(%s)',(media,))
 reporter.execute('begin')
 resp=one(reporter,"select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','media-issuer-missing',null,null)",(actor,rid))
 assert resp['publicationAuthorized'] is False
 assert pub(media)['storageKey']==key(media)
 assert own(media)['storageKey']==key(media)
 reporter.execute('commit')
 assert one(reader,'select private.preset_storage_media_quarantined_r19(%s)',(media,))
 assert not one(reader,'select private.preset_storage_media_quarantined_r19(%s)',(unaffected,))
 reader.execute('begin')
 deny(reader,'select public.community_get_public_media_storage_v2(%s)',(media,),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
 deny(reader,'select public.community_gallery_owner_media_read_v1(%s,%s)',(actor,media),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
 reader.execute('rollback')
 assert pub(unaffected)['storageKey']==key(unaffected)
 assert own(unaffected)['storageKey']==key(unaffected)
 # The third direct SQL issuer has no R19 guard in the first Source141 migration.
 assert legacy(media)['storageKey']==key(media)
 assert legacy(unaffected)['storageKey']==key(unaffected)
 for fn in ['public.community_get_public_media_storage_v2(uuid)','public.community_gallery_owner_media_read_v1(uuid,uuid)','public.community_get_media_storage_key(uuid,uuid)']:
  assert one(reader,'select has_function_privilege(%s,%s,%s)',('service_role',fn,'EXECUTE')) is True
  assert one(reader,'select has_function_privilege(%s,%s,%s)',('anon',fn,'EXECUTE')) is False
  assert one(reader,'select has_function_privilege(%s,%s,%s)',('authenticated',fn,'EXECUTE')) is False
 assert one(reader,"select has_function_privilege('service_role','private.community_gallery_owner_media_read_unfenced_r19(uuid,uuid)','EXECUTE')") is False
 assert one(reader,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
 assert one(reader,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 print(json.dumps({'marker':'09INT_SOURCE141_DIRECT_TWO_SQL_GUARDED_THIRD_LEGACY_OPEN_2PG','real_postgres_connections':2,
 'pub_v2_direct_sql_denied':True,'owner_gallery_direct_sql_denied':True,'third_legacy_owner_storage_key_still_visible':True,
 'unrelated_media_remains_visible':True,'reporter_before_commit_snapshot':True,'private_helper_revoke':True,
 'real_provider':False,'signed_jwt':False,'cdn':False,'staging_mutation':False}))
