#!/usr/bin/env python3
import json
import os
import uuid
import psycopg

assert os.environ.get('DDVRE_QR_R18WORK_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.environ.get('DATABASE_URL')
DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
OWNER_SOURCE = '1e900d1ed18785cc3fc43e78a000b36124fc6a46'
U = uuid.uuid4
def val(db, sql, args=()):
    return db.execute(sql,args).fetchone()[0]
def expect_denial(db, op, reasons):
    try:
        op()
    except psycopg.Error as exc:
        assert any(marker in str(exc) for marker in reasons),(exc.sqlstate,str(exc),reasons)
        return exc.sqlstate
    raise AssertionError('R18_UNSAFE_DB_ACTION_ACCEPTED')
def state(db, owner, work, key):
    return tuple(db.execute("""select
      (select count(*) from private.preset_storage_reservations_r18 where owner_account_id=%s),
      (select count(*) from public.artifact_blobs where owner_account_id=%s),
      (select count(*) from public.preset_revisions where created_by_account_id=%s),
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select current_published_revision_id from public.community_works where work_id=%s),
      (select row_version from public.community_works where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s)
    """,(owner,owner,owner,work,work,work,work,owner,key)).fetchone())

with psycopg.connect(DSN,autocommit=True) as seed:
    assert val(seed,'select count(*) from supabase_migrations.schema_migrations')==134
    a,asub,b,bsub,creator,creator_b,work,artifact,blob=(U() for _ in range(9))
    key='qr18-'+U().hex
    staging='staging/'+str(a)+'/'+str(U())+'.json'
    published=''
    with seed.transaction():
        for account,subject in [(a,asub),(b,bsub)]:
            seed.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
            seed.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
              values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(subject)))
        for profile,account in [(creator,a),(creator_b,b)]:
            seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(profile,))
            seed.execute("""insert into public.creator_profiles(
              creator_profile_id,owner_account_id,handle,display_name)
              values(%s,%s,%s,'R18-work independent synthetic')""",
              (profile,account,'qr18_'+U().hex[:17]))
    def reserve(db, subject=asub, profile=creator, request=key, stage=staging, sha='a'*64):
        return val(db,"""select public.community_preset_storage_reserve_r18(
          %s,%s,%s,%s,%s,100,%s,1,'scene')""",
          (subject,profile,stage,request,'b'*64,sha))

with psycopg.connect(DSN,autocommit=True) as aconn,psycopg.connect(DSN,autocommit=True) as bconn:
    assert val(aconn,'select pg_backend_pid()')!=val(bconn,'select pg_backend_pid()')
    snap=reserve(aconn)
    published=snap['publishedStorageKey']
    assert snap['reservationState']=='RESERVED'
    assert snap['publicationCommitAuthorized'] is False
    assert snap['physicalCleanupAuthorized'] is False
    assert snap['realPublishedObjectBytesVerified'] is False
    assert snap['snapshotNotAnAtomicStorageOperation'] is True
    assert published.startswith('published/'+str(a)+'/')
    assert val(aconn,'select count(*) from private.preset_storage_reservations_r18')==1
    initial=reserve(bconn)
    assert initial['reservationId']==snap['reservationId']
    assert initial['stateVersion']==snap['stateVersion']
    assert initial['checksumSha256']==snap['checksumSha256']
    assert val(bconn,'select count(*) from private.preset_storage_reservations_r18')==1
    expect_denial(bconn,lambda:reserve(bconn,stage='staging/'+str(a)+'/'+str(U())+'.json'),
                  ['R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT'])
    expect_denial(bconn,lambda:reserve(bconn,subject=bsub,profile=creator,stage=staging),
                  ['R18_PRESET_RESERVATION_CREATOR_FORBIDDEN','R18_PRESET_STAGING_KEY_FORBIDDEN'])
    assert val(bconn,'select count(*) from private.preset_storage_reservations_r18')==1
    print(json.dumps({'case':'QR_R18_RESERVATION_SAME_KEY_CREATOR_CONFLICT_NONOWNER',
      'replaySameId':True,'changedStagingIdempotencyConflict':True,'nonownerDenied':True,
      'physicalProviderBytesVerified':False}))

    with aconn.transaction():
        aconn.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
        aconn.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(artifact,))
        aconn.execute("""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'preset','public','clear')""",(work,a,creator))
        aconn.execute("""insert into public.preset_artifacts(
          preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type)
          values(%s,%s,%s,%s,'scene')""",(artifact,a,creator,work))
        aconn.execute("""insert into public.artifact_blobs(
          blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
          values(%s,%s,%s,1,'application/json',100,%s)""",(blob,a,staging,'a'*64))
        for n in [1,2]:
            revision,presetrev=U(),U()
            aconn.execute("""insert into public.preset_revisions(
              preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
              values(%s,%s,%s,%s,'{}'::jsonb,%s)""",(presetrev,artifact,n,blob,a))
            aconn.execute("""insert into public.community_work_revisions(
              revision_id,work_id,revision_number,created_by_account_id)
              values(%s,%s,%s,%s)""",(revision,work,n,a))
            aconn.execute("""insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
              values(%s,%s)""",(revision,presetrev))
            aconn.execute("""update public.community_works set lifecycle_state='published',
               current_published_revision_id=%s,published_at=now() where work_id=%s""",(revision,work))
    refs=val(bconn,"""select count(*) from public.preset_revisions pr
       join public.artifact_blobs b on b.blob_id=pr.artifact_blob_id
       where b.storage_key=%s""",(staging,))
    assert refs==2,refs
    active=val(bconn,'select current_published_revision_id from public.community_works where work_id=%s',(work,))
    assert active is not None
    before=state(bconn,a,work,key)
    stagepre=val(bconn,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",
       (asub,staging))
    pubpre=val(bconn,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",
       (asub,published))
    assert stagepre['reservationCount']==1
    assert stagepre['registeredBlobCount']==1
    assert stagepre['historicalPresetRevisionReferenceCount']==2
    assert pubpre['reservationCount']==1 and pubpre['registeredBlobCount']==0
    for pre in [stagepre,pubpre]:
        assert pre['cleanupAuthorized'] is False
        assert pre['physicalDeleteAuthorized'] is False
        assert pre['legalRetentionCleared'] is False
        assert pre['allCurrentHistoricalAndCloudReferencesProven'] is False
    expect_denial(bconn,lambda:val(bconn,
        "select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",(bsub,staging)),
        ['R18_PRESET_CLEANUP_FORBIDDEN'])
    assert state(bconn,a,work,key)==before
    print(json.dumps({'case':'QR_R18_CURRENT_HISTORICAL_PRESET_REFERENCE_CLEANUP_DENIED',
      'referenceCount':refs,'stagingBlobRegistered':True,'publishedUnregisteredReserved':True,
      'nonownerDenied':True,'zeroWorkRevisionOutboxMutation':True}))

    # Hold actual reservation row to check recovery cannot jump over its stateVersion fence.
    aconn.execute('begin')
    val(aconn,"select reservation_id from private.preset_storage_reservations_r18 where reservation_id=%s for update",
        (snap['reservationId'],))
    bconn.execute('begin')
    bconn.execute("set local lock_timeout='220ms'")
    try:
        val(bconn,"select public.community_preset_storage_recovery_r18(%s,%s,%s,%s)",
            (asub,snap['reservationId'],snap['stateVersion'],'SQL_FAILED'))
        raise AssertionError('RESERVATION_LOCK_BYPASSED')
    except psycopg.Error as exc:
        assert exc.sqlstate=='55P03',(exc.sqlstate,str(exc))
    bconn.execute('rollback')
    aconn.execute('rollback')
    assert state(bconn,a,work,key)==before

    expect_denial(bconn,lambda:val(bconn,"""insert into public.artifact_blobs(
      owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
      values(%s,%s,1,'application/json',100,%s) returning blob_id""",(a,published,'a'*64)),
      ['R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED'])
    expect_denial(bconn,lambda:val(bconn,"""select public.community_publish_preset_envelope(
       %s,%s,'public','scene','Blocked',null,%s,1,'application/json',100,%s,'{}'::jsonb,%s)""",
       (asub,creator,published,'a'*64,key)),
      ['R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED'])
    assert state(bconn,a,work,key)==before
    print(json.dumps({'case':'QR_R18_ACTIVE_REFERENCES_RESERVATION_LOCK_AND_LEGACY_WRITER_FAILCLOSED',
      'stateVersionLock55P03':True,'directPublishedBlobDenied':True,
      'oldEnvelopeDenied':True,'noExtraCommunityRevisionOutbox':True}))

    for name,signature in [
      ('community_preset_storage_reserve_r18','uuid,uuid,text,text,text,bigint,text,integer,text'),
      ('community_preset_storage_cleanup_preflight_r18','uuid,text'),
      ('community_preset_storage_recovery_r18','uuid,uuid,bigint,text')]:
        for role in ['anon','authenticated']:
            assert val(bconn,"select has_function_privilege(%s,%s,'EXECUTE')",
             (role,'public.'+name+'('+signature+')')) is False,(name,role)
        assert val(bconn,"select has_function_privilege('service_role',%s,'EXECUTE')",
          ('public.'+name+'('+signature+')',)) is True
    assert val(bconn,"select has_table_privilege('anon','private.preset_storage_reservations_r18','SELECT')") is False
    assert val(bconn,"select has_table_privilege('authenticated','private.preset_storage_reservations_r18','SELECT')") is False
    print(json.dumps({'case':'QR_R18_RESERVATION_RPC_ACL_SERVICE_ONLY_AND_PRIVATE_TABLE',
      'anonDirectExecute':False,'authenticatedDirectExecute':False,'noPhysicalDelete':True}))

print(json.dumps({'result':'QR_R18WORK_SOURCE134_INDEPENDENT_PRESET_STORAGE_PG_SAFETY_PASS',
  'ownerFrozenHead':OWNER_SOURCE,'migrations':134,'realTwoBackendPostgres':True,
  'providerStorageSigned':False,'providerDownloadedBytesSha':False,
  'cleanupAuthorized':False,'publicationAuthorized':False,'formalReleaseR18':False}))
