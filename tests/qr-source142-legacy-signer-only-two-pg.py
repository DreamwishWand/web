#!/usr/bin/env python3
"""04 QR Source142 exclusive Legacy media direct SQL acceptance.
Synthetic local PostgreSQL/2 backend, never a signed Actor/Provider/Staging test.
Prior INT184 and QR182/179/177 accepted suites are not invoked.
"""
import json, os, uuid
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
dsn = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
uid=uuid.uuid4
def one(db, sql, vals=()):
    return db.execute(sql,vals).fetchone()[0]
def denied(db,sql,vals,term,role='service_role'):
    with db.transaction():
        db.execute('savepoint qr142')
        try:
            if role:
                db.execute('set local role '+role)
            v=one(db,sql,vals)
        except psycopg.Error as e:
            db.execute('rollback to savepoint qr142')
            assert term in str(e),(term,e.sqlstate,str(e))
            return
        db.execute('rollback to savepoint qr142')
        raise AssertionError('QR142_UNEXPECTED_MEDIA_KEY_OR_METADATA:'+term+':'+str(v))
with psycopg.connect(dsn, autocommit=True) as ownerdb, psycopg.connect(dsn, autocommit=True) as reporter:
    assert one(ownerdb,'select pg_backend_pid()')!=one(reporter,'select pg_backend_pid()')
    accs=[uid() for _ in range(3)]
    subjects=[uid() for _ in range(3)]
    a,b,m=subjects
    owner,other,mod=accs
    creator=uid()
    with ownerdb.transaction():
        for acc,sub in zip(accs,subjects):
            ownerdb.execute('insert into public.wand_accounts(account_id) values(%s)',(acc,))
            ownerdb.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(acc,str(sub)))
        ownerdb.execute("insert into public.account_roles(account_id,role) values(%s,'moderator')",(mod,))
        ownerdb.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        ownerdb.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR142 Local')",(creator,owner,'qr142_'+uid().hex[:15]))
    reserve=one(ownerdb,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",(a,creator,f'staging/{owner}/{uid()}.json','qr142-'+uid().hex,'a'*64,'b'*64))
    rid=uuid.UUID(reserve['reservationId'])
    claim=one(ownerdb,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(a,rid))
    media,cover,free=[uid() for _ in range(3)]
    affected,control,rev,oldrev=[uid() for _ in range(4)]
    key=lambda x:f'{a}/{x}.png'
    with ownerdb.transaction():
        ownerdb.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='QR142_LOCAL_SYNTHETIC_NOT_PROVIDER' where gate_key='verified_preset_publication'")
        ownerdb.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s",('b'*64,rid))
        receipt=one(ownerdb,"select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'QR142 synthetic',null,'public','{}'::jsonb)",(a,rid,uuid.UUID(claim['leaseToken'])))
        subject_id=uid()
        ownerdb.execute("insert into public.gallery_verified_subjects(subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,build_id,profile_schema,evidence_ref,verification_state) values(%s,'outdoor','floating_island',%s,'switch','1.25.0','52BD625D9B4E0053',624,'QR142_LOCAL_NOT_GAME_EVIDENCE','verified')",(subject_id,'qr142:'+str(subject_id)))
        for work in (affected,control):
            ownerdb.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
            ownerdb.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')",(work,owner,creator))
            ownerdb.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
            ownerdb.execute("insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)",(work,subject_id,owner,creator))
        for mid in (media,cover,free):
            ownerdb.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid,))
            ownerdb.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',100,20,20,%s,'ready','clear')",(mid,owner,key(mid),'e'*64))
        for work,mid,revid in ((affected,media,rev),(control,free,uid())):
            ownerdb.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revid,work,owner))
            ownerdb.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'QR142 Local')",(revid,))
            ownerdb.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')",(revid,mid))
            ownerdb.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(revid,work))
        ownerdb.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,2,%s)",(oldrev,affected,owner))
        ownerdb.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'QR142 historical cover')",(oldrev,))
        ownerdb.execute("insert into public.gallery_photo_revision_fields(revision_id,subject_id,cover_media_id,originality_attested) values(%s,%s,%s,true)",(oldrev,subject_id,cover))
        linked=uid()
        ownerdb.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(linked,))
        ownerdb.execute("insert into public.preset_artifacts(preset_artifact_id,owner_account_id,creator_profile_id,associated_gallery_work_id,preset_type) values(%s,%s,%s,%s,'scene')",(linked,owner,creator,affected))
        ownerdb.execute("insert into public.preset_revisions(preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id) values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s),%s)",(linked,rid,owner))
        ownerdb.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
    assert one(ownerdb,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    assert one(ownerdb,'select count(*) from public.work_revision_media where media_id=%s',(cover,))==0
    rpc='select public.community_get_media_storage_key(%s,%s)'
    for role in ('anon','authenticated'):
        assert not one(ownerdb,'select has_function_privilege(%s,%s,%s)',(role,'public.community_get_media_storage_key(uuid,uuid)','EXECUTE'))
        denied(ownerdb,rpc,(a,media),'permission denied',role)
    assert one(ownerdb,"select has_function_privilege('service_role','public.community_get_media_storage_key(uuid,uuid)','EXECUTE')") is True
    for actor,mid in ((a,media),(a,cover),(a,free),(b,media),(m,media),(m,cover)):
        result=one(ownerdb,rpc,(actor,mid))
        assert result['storageKey']==key(mid) and result['mediaId']==str(mid) and result['byteSize']==100
    denied(ownerdb,rpc,(b,cover),'Media is not accessible')
    with ownerdb.transaction():
        ownerdb.execute('update public.auth_identities set identity_state=%s,retired_at=now() where provider_subject=%s',('retired',str(a)))
        denied(ownerdb,rpc,(a,media),'Active AuthIdentity not found',None)
        ownerdb.execute('update public.auth_identities set identity_state=%s,retired_at=null where provider_subject=%s',('active',str(a)))
    with ownerdb.transaction():
        ownerdb.execute('insert into private.account_privacy_suppressions(account_id) values(%s)',(owner,))
        denied(ownerdb,rpc,(a,media),'ACCOUNT_PRIVACY_SUPPRESSED',None)
        ownerdb.execute('delete from private.account_privacy_suppressions where account_id=%s',(owner,))
    reporter.execute('begin')
    report=one(reporter,"select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','QR142 signer quarantined',null,null)",(a,rid))
    assert report['publicationAuthorized'] is False
    assert one(ownerdb,rpc,(a,media))['storageKey']==key(media)
    reporter.execute('commit')
    assert one(ownerdb,'select private.preset_storage_media_quarantined_r19(%s)',(media,))
    assert one(ownerdb,'select private.preset_storage_media_quarantined_r19(%s)',(cover,))
    assert not one(ownerdb,'select private.preset_storage_media_quarantined_r19(%s)',(free,))
    for actor,mid in ((a,media),(a,cover),(b,media),(m,media),(m,cover)):
        denied(ownerdb,rpc,(actor,mid),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
    for actor in (a,b,m):
        result=one(ownerdb,rpc,(actor,free))
        assert result['storageKey']==key(free) and result['checksumSha256']=='e'*64
    assert one(ownerdb,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,))==1
    assert one(ownerdb,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    print(json.dumps({'case':'QR_SOURCE142_LEGACY_SIGNER_AUTH_PRIVACY_HISTORY_POSTINCIDENT_TWO_PG','postincident_keys_and_metadata':'deny','preincident_owner_and_moderator':'allowed_local_synthetic','historical_cover_without_media_membership':'guarded','privacy_and_retired_actor':'denied_before_incident','unrelated_gallery_media':'preserved','signed_jwt':False,'real_provider':False,'staging_mutation':False,'real_dreamsnaps':False}))
