#!/usr/bin/env python3
import json
import os
import uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
fresh = uuid.uuid4
def one(db, sql, args=()):
    return db.execute(sql, args).fetchone()[0]
def must_reject(db, sql, args, marker):
    db.execute('savepoint int140_denial')
    try:
        one(db, sql, args)
    except psycopg.Error as e:
        db.execute('rollback to savepoint int140_denial')
        assert marker in str(e), (marker, str(e))
    else:
        db.execute('rollback to savepoint int140_denial')
        raise AssertionError('UNEXPECTED_ACCEPT:' + marker)

with psycopg.connect(dsn, autocommit=True) as reads, psycopg.connect(dsn, autocommit=True) as reporter:
    assert one(reads, 'select pg_backend_pid()') != one(reporter, 'select pg_backend_pid()')
    assert one(reads, "select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    owner, actor, creator = fresh(), fresh(), fresh()
    moderator_account, moderator_subject = fresh(), fresh()
    with reads.transaction():
        reads.execute('insert into public.wand_accounts(account_id) values(%s)', (owner,))
        reads.execute('insert into public.wand_accounts(account_id) values(%s)', (moderator_account,))
        reads.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')", (moderator_account,str(moderator_subject)))
        reads.execute("insert into public.account_roles(account_id,role) values(%s,'moderator')",(moderator_account,))
        reads.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')", (owner, str(actor)))
        reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')", (creator,))
        reads.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'INT140 independent reader')", (creator, owner, 'i140_'+fresh().hex[:18]))
    reserved = one(reads, "select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",
                   (actor,creator,f'staging/{owner}/{fresh()}.json','int140-'+fresh().hex,'a'*64,'b'*64))
    rid = uuid.UUID(reserved['reservationId'])
    lease = one(reads, 'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)', (actor,rid))
    token = uuid.UUID(lease['leaseToken'])
    direct, historical, unrelated = fresh(), fresh(), fresh()
    revisions = {}
    image = fresh()
    with reads.transaction():
        reads.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='INT140_LOCAL_SYNTHETIC_NOT_STORAGE' where gate_key='verified_preset_publication'")
        reads.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s", ('b'*64,rid))
        artifact = one(reads, "select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'INT140 control',null,'public','{}'::jsonb)", (actor,rid,token))
        original_work, original_revision = uuid.UUID(artifact['workId']), uuid.UUID(artifact['presetRevisionId'])
        for work, label in [(direct,'direct'),(historical,'history'),(unrelated,'control')]:
            reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')", (work,))
            reads.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')", (work,owner,creator))
            reads.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')", (work,))
            current=fresh()
            revisions[label]=current
            reads.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,2,%s)", (current,work,owner))
            reads.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,%s)", (current,'INT140 '+label))
            reads.execute("insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at) values(%s,%s,'gallery',%s,%s,now())", (work,work,creator,'INT140 '+label))
            reads.execute("insert into public.saved_items(account_id,target_entity_id) values(%s,%s)", (owner,work))
        older=fresh()
        reads.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)", (older,historical,owner))
        reads.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'INT140 superseded revision')", (older,))
        reads.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)", (older,original_revision))
        # A separate direct-only legacy PresetArtifact uses the same committed
        # synthetic Blob, but has no GalleryRevisionPreset link.
        direct_artifact=fresh()
        reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')", (direct_artifact,))
        reads.execute("insert into public.preset_artifacts(preset_artifact_id,owner_account_id,creator_profile_id,associated_gallery_work_id,preset_type) values(%s,%s,%s,%s,'scene')", (direct_artifact,owner,creator,direct))
        reads.execute("insert into public.preset_revisions(preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id) values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s),%s)", (direct_artifact,rid,owner))
        reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')", (image,))
        reads.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',100,20,20,%s,'ready','clear')", (image,owner,f'{actor}/{fresh()}.png','e'*64))
        reads.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')", (revisions['direct'],image))
        for w, label in [(direct,'direct'),(historical,'history'),(unrelated,'control')]:
            reads.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s", (revisions[label],w))
        reads.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
    def visibility():
        return {str(w): one(reads,'select private.preset_storage_work_quarantined_r19(%s)',(w,)) for w in [direct,historical,unrelated]}
    assert not any(visibility().values())
    assert one(reads,'select private.is_staff(%s)',(moderator_account,)) is True
    assert one(reads,'select public.community_get_work(%s,%s)',(actor,direct))['workId']==str(direct)
    assert one(reads,'select public.community_get_work(%s,%s)',(moderator_subject,direct))['workId']==str(direct)
    assert len(one(reads,'select public.community_get_my_gallery_v1(%s,50)',(actor,))['myWorks'])==3
    pre_key = one(reads,'select public.community_get_public_media_storage_v2(%s)',(image,))['storageKey']
    assert pre_key
    assert one(reads,'select public.community_gallery_media_gateway_v1(%s)',(image,))['galleryManaged'] is False
    reporter.execute('begin')
    report = one(reporter, "select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','int140-controlled-missing',null,null)", (actor,rid))
    assert report['publicationAuthorized'] is False
    # A distinct PG READ COMMITTED session observes only committed rows.
    assert len(one(reads,'select public.community_get_my_gallery_v1(%s,50)',(actor,))['myWorks'])==3
    assert one(reads,'select count(*) from public.search_documents where work_id in (%s,%s)',(direct,historical))==2
    reporter.execute('commit')
    assert visibility()=={str(direct):True,str(historical):True,str(unrelated):False}
    assert one(reads,'select count(*) from private.preset_storage_work_read_suppressions_r19 where reservation_id=%s',(rid,))==3
    assert one(reads,'select count(*) from public.search_documents where work_id in (%s,%s)',(direct,historical))==0
    assert one(reads,'select count(*) from public.search_documents where work_id=%s',(unrelated,))==1
    assert [x['workId'] for x in one(reads,'select public.community_get_my_gallery_v1(%s,50)',(actor,))['myWorks']]==[str(unrelated)]
    assert [x['targetEntityId'] for x in one(reads,'select public.community_get_saved(%s,50)',(actor,))]==[str(unrelated)]
    assert one(reads,'select public.community_get_work(%s,%s)',(actor,unrelated))['workId']==str(unrelated)
    reads.execute('begin')
    for w in [direct,historical,original_work]:
        must_reject(reads,'select public.community_get_work(%s,%s)',(actor,w),'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
        must_reject(reads,'select public.community_get_work(%s,%s)',(moderator_subject,w),'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
    must_reject(reads,'select public.community_gallery_media_gateway_v1(%s)',(image,),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
    must_reject(reads,'select public.community_preset_storage_assert_media_not_quarantined_r19(%s)',(image,),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
    must_reject(reads,"insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at) values(%s,%s,'gallery',%s,'stale',now()) returning entity_id",(direct,direct,creator),'R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED')
    # Exact replay with stale fence cannot repair read suppression.
    must_reject(reads,'select public.community_preset_storage_resolution_readiness_r19(%s,%s,2,1)',(actor,rid),'R19_PRESET_RESOLUTION_STALE_VERSION_OR_FENCE')
    reads.execute('rollback')
    assert one(reads,'select public.community_get_public_media_storage_v2(%s)',(image,))['storageKey']==pre_key
    reads.execute('begin')
    reads.execute("update public.auth_identities set identity_state='retired',retired_at=now() where account_id=%s",(owner,))
    must_reject(reads,'select public.community_get_my_gallery_v1(%s,50)',(actor,),'Active AuthIdentity not found')
    reads.execute('rollback')
    reads.execute('begin')
    reads.execute('insert into private.account_privacy_suppressions(account_id) values(%s)',(owner,))
    must_reject(reads,'select public.community_get_my_gallery_v1(%s,50)',(actor,),'ACCOUNT_PRIVACY_SUPPRESSED')
    assert one(reads,'select private.is_discoverable_work(%s)',(unrelated,)) is False
    reads.execute('rollback')
    assert one(reads,'select private.is_discoverable_work(%s)',(unrelated,)) is True
    assert one(reads,'select public.community_get_work(%s,%s)',(moderator_subject,unrelated))['workId']==str(unrelated)
    for dbrole in ['anon','authenticated']:
        assert one(reads,"select has_function_privilege(%s,'public.community_get_work(uuid,uuid)','EXECUTE')",(dbrole,)) is False
    assert one(reads,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    assert one(reads,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
    print(json.dumps(dict(marker='09INT_SOURCE140_DIRECT_HISTORICAL_READ_SQL_2PG',
          distinct_pg_backends=True, current_direct_and_past_revision_suppressed=True,
          owner_lists_filtered=True, unaffected_gallery_preserved=True,
          sql_media_gateway_denied=True, direct_legacy_public_media_key_remains_accessible=True,
          local_moderator_override_blocked=True, retired_identity_and_privacy_barriers_preserved=True,
          in_flight_read_committed_snapshot=True, incident_immutable=True,
          true_provider=False, normal_jwt=False, cdn=False, staging_writes=False)))
