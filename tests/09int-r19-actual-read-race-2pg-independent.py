#!/usr/bin/env python3
import json
import os
import uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
def scalar(c,q,params=()): return c.execute(q,params).fetchone()[0]
def reject(c,q,params,expected):
    c.execute('savepoint int_reader_deny')
    try:
        scalar(c,q,params)
    except psycopg.Error as e:
        c.execute('rollback to savepoint int_reader_deny')
        assert expected in str(e),(expected,e.sqlstate,str(e))
        return
    c.execute('rollback to savepoint int_reader_deny')
    raise AssertionError('unexpected acceptance '+expected)

with psycopg.connect(dsn,autocommit=True) as reader, psycopg.connect(dsn,autocommit=True) as reporter:
    assert scalar(reader,'select pg_backend_pid()')!=scalar(reporter,'select pg_backend_pid()')
    assert scalar(reader,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    owner,subject,creator=u(),u(),u()
    with reader.transaction():
        reader.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        reader.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(owner,str(subject)))
        reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        reader.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'INT r19 read-race')",(creator,owner,'int139_'+u().hex[:17]))
    reserve=scalar(reader,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",
      (subject,creator,f'staging/{owner}/{u()}.json','readrace-'+u().hex,'a'*64,'b'*64))
    rid=uuid.UUID(reserve['reservationId'])
    lease=scalar(reader,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(subject,rid))
    token=uuid.UUID(lease['leaseToken'])
    affected_gallery, historical_rev, current_rev, media=u(),u(),u(),u()
    unaffected_gallery, unaffected_rev=u(),u()
    with reader.transaction():
        reader.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='INT139_EPHEMERAL_TEST_NOT_REAL_PROVIDER' where gate_key='verified_preset_publication'")
        reader.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s",('b'*64,rid))
        committed=scalar(reader,"select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'INT139 preset',null,'public','{}'::jsonb)",(subject,rid,token))
        preset_work=uuid.UUID(committed['workId'])
        preset_artifact=uuid.UUID(committed['presetArtifactId'])
        preset_revision=uuid.UUID(committed['presetRevisionId'])
        for work,title,revision in [(affected_gallery,'affected',current_rev),(unaffected_gallery,'unaffected',unaffected_rev)]:
            reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
            reader.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')",(work,owner,creator))
            reader.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
            reader.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,%s,%s)",(revision,work,2 if work==affected_gallery else 1,owner))
            reader.execute("insert into public.gallery_work_revisions(revision_id,title,description) values(%s,%s,'INT139')",(revision,title))
        reader.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(historical_rev,affected_gallery,owner))
        reader.execute("insert into public.gallery_work_revisions(revision_id,title,description) values(%s,'INT139 historical','prior preset reference')",(historical_rev,))
        reader.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(historical_rev,preset_revision))
        reader.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
        reader.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,checksum_sha256,processing_state) values(%s,%s,%s,'image/png',100,%s,'ready')",(media,owner,f'{subject}/{u()}.png','e'*64))
        reader.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')",(current_rev,media))
        for work,revision in [(affected_gallery,current_rev),(unaffected_gallery,unaffected_rev)]:
            reader.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(revision,work))
            reader.execute("insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at) values(%s,%s,'gallery',%s,%s,now())",(work,work,creator,'INT139 '+str(work)))
        reader.execute("insert into public.saved_items(account_id,target_entity_id) values(%s,%s)",(owner,affected_gallery))
        reader.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
    assert scalar(reader,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    getwork=lambda w:scalar(reader,'select public.community_get_work(%s,%s)',(subject,w))
    gallery_list=lambda:scalar(reader,'select public.community_get_my_gallery_v1(%s,50)',(subject,))
    saved_list=lambda:scalar(reader,'select public.community_get_saved(%s,50)',(subject,))
    publicmedia=lambda:scalar(reader,'select public.community_get_public_media_storage_v2(%s)',(media,))
    assert getwork(affected_gallery)['workId']==str(affected_gallery)
    assert any(x['workId']==str(affected_gallery) for x in gallery_list()['myWorks'])
    assert any(x['targetEntityId']==str(affected_gallery) and x['accessible'] for x in saved_list())
    assert publicmedia()['mediaId']==str(media)
    assert scalar(reader,'select public.community_preset_storage_assert_media_not_quarantined_r19(%s)',(media,)) is True
    assert scalar(reader,'select public.community_get_gallery_public_v1(%s)',(affected_gallery,))['workId']==str(affected_gallery)
    # The reporter holds a live, uncommitted incident transaction. A separate
    # READ COMMITTED reader must see the old preincident projection until commit.
    reporter.execute('begin')
    incident=scalar(reporter,"select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','provider-missing',null,null)",(subject,rid))
    assert incident['publicationAuthorized'] is False
    assert getwork(affected_gallery)['workId']==str(affected_gallery)
    assert scalar(reader,'select public.community_get_gallery_public_v1(%s)',(affected_gallery,))['workId']==str(affected_gallery)
    assert scalar(reader,"select count(*) from public.search_documents where work_id=%s",(affected_gallery,))==1
    reporter.execute('commit')
    assert scalar(reader,'select private.preset_storage_work_quarantined_r19(%s)',(affected_gallery,)) is True
    assert scalar(reader,'select private.preset_storage_work_quarantined_r19(%s)',(unaffected_gallery,)) is False
    assert scalar(reader,"select count(*) from public.search_documents where work_id=%s",(affected_gallery,))==0
    assert scalar(reader,"select count(*) from public.search_documents where work_id=%s",(unaffected_gallery,))==1
    assert scalar(reader,'select public.community_get_gallery_public_v1(%s)',(unaffected_gallery,))['workId']==str(unaffected_gallery)
    reader.execute('begin')
    reject(reader,'select public.community_get_gallery_public_v1(%s)',(affected_gallery,),'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
    reject(reader,'select public.community_get_preset(%s,%s)',(subject,preset_artifact),'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
    reject(reader,'select public.wep_get_accessible_preset_blob(%s,%s,null)',(subject,preset_artifact),'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
    reject(reader,'select public.community_preset_storage_assert_media_not_quarantined_r19(%s)',(media,),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
    reject(reader,"insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at) values(%s,%s,'gallery',%s,'stale',now()) returning entity_id",
       (affected_gallery,affected_gallery,creator),'R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED')
    reader.execute('rollback')
    # DISTINCT novel 09 INT witness: SECURITY DEFINER and direct service RPCs
    # still advertise the quarantined Work and its current media Storage key.
    assert getwork(affected_gallery)['workId']==str(affected_gallery)
    assert any(x['workId']==str(affected_gallery) for x in gallery_list()['myWorks'])
    assert any(x['targetEntityId']==str(affected_gallery) and x['accessible'] for x in saved_list())
    assert publicmedia()['mediaId']==str(media)
    assert scalar(reader,'select public.community_get_work(%s,%s)',(subject,unaffected_gallery))['workId']==str(unaffected_gallery)
    assert scalar(reader,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    assert scalar(reader,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
    print(json.dumps({'marker':'09INT_R19_READER_VS_INCIDENT_2PG_SQL_AND_AUTH_RESULT_GAPS',
      'pg_backends':2,'during_uncommitted_incident_public_gallery_visible':True,
      'after_commit_public_gallery_and_preset_denied':True,
      'after_commit_work_and_myGallery_and_saved_metadata_still_visible':True,
      'direct_public_media_sql_result_still_returns_storage_key':True,
      'unaffected_sibling_visible':True,'historical_gallery_revision_reference':True,
      'search_reinsert_denied':True,'provider_test':'NOT_EXECUTED',
      'actor_jwt':'LOCAL_SYNTHETIC_SQL_SUBJECT','staging_mutation':False,
      'source_release_gate_on':False}))
