#!/usr/bin/env python3
import os,json,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,subject,creator=u(),u(),u()
idem='r18-'+u().hex[:22]
stage=f'staging/{owner}/{u()}.json'
def scalar(c,q,args=()):
    return c.execute(q,args).fetchone()[0]
def reserve(c,key=idem,sha='a'*64,stage_key=stage):
    return scalar(c,"""select public.community_preset_storage_reserve_r18(
      %s,%s,%s,%s,%s,%s,%s,1,'scene')""",
      (subject,creator,stage_key,key,'b'*64,100,sha))
def expect(c,fn,reason):
    try:fn()
    except psycopg.Error as e:
        assert reason in str(e),(reason,e.sqlstate,str(e))
        return e.sqlstate
    raise AssertionError('WRITER_UNEXPECTEDLY_ACCEPTED_'+reason)
with psycopg.connect(dsn,autocommit=True) as c:
    with c.transaction():
        c.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        c.execute("""insert into public.auth_identities(
          account_id,provider,provider_subject,last_verified_at,identity_state)
          values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(subject)))
        c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        c.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,'R18 owner')""",(creator,owner,'r18_'+u().hex[:16]))
    assert scalar(c,"select count(*) from private.preset_storage_reservations_r18")==0
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert scalar(a,"select pg_backend_pid()")!=scalar(b,"select pg_backend_pid()")
    a.execute('begin')
    first=reserve(a)
    assert first['reservationState']=='RESERVED' and first['stateVersion']==1
    assert first['publishedStorageKey'].startswith(f'published/{owner}/')
    assert first['publicationCommitAuthorized'] is False
    assert first['physicalCleanupAuthorized'] is False
    b.execute('begin')
    b.execute("set local lock_timeout='200ms'")
    try:
        reserve(b)
        raise AssertionError('CONCURRENT_SECOND_KEY_BYPASSED')
    except psycopg.Error as e:
        assert e.sqlstate=='55P03',(e.sqlstate,str(e))
    b.execute('rollback')
    a.execute('commit')
    second=reserve(b)
    assert first['reservationId']==second['reservationId']
    assert first['stateVersion']==second['stateVersion']
    assert scalar(b,"select count(*) from private.preset_storage_reservations_r18")==1
    expect(b,lambda:reserve(b,sha='c'*64),'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT')
    print(json.dumps({'case':'R18_SAME_KEY_TWO_BACKEND_SERIALIZED_REPLAY','unique':True,'conflict':True}))
    assert scalar(b,"select count(*) from public.artifact_blobs where storage_key=%s",(first["publishedStorageKey"],))==0
    expect(b,lambda:scalar(b,"""insert into public.artifact_blobs(
      owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
      values(%s,%s,1,'application/json',100,%s) returning blob_id""",
      (owner,first['publishedStorageKey'],'a'*64)),'R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED')
    assert scalar(b,"select count(*) from public.artifact_blobs where storage_key=%s",(first["publishedStorageKey"],))==0
    expect(b,lambda:scalar(b,"""select public.community_publish_preset_envelope(
      %s,%s,'public','scene','blocked',null,%s,1,'application/json',100,%s,'{}'::jsonb,%s)""",
      (subject,creator,first['publishedStorageKey'],'a'*64,idem)),
      'R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED')
    assert scalar(b,"select count(*) from public.idempotency_keys where account_id=%s",(owner,))==0
    assert scalar(b,"select count(*) from public.community_works where owner_account_id=%s",(owner,))==0
    print(json.dumps({'case':'R18_REGISTRATION_AND_LEGACY_ENVELOPE_DENIED','partialPublication':False}))
    preflight=scalar(b,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",(subject,first['publishedStorageKey']))
    assert preflight['reservationCount']==1 and preflight['cleanupAuthorized'] is False
    assert preflight['physicalDeleteAuthorized'] is False
    stagepre=scalar(b,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",(subject,stage))
    assert stagepre['reservationCount']==1 and stagepre['cleanupAuthorized'] is False
    assert scalar(b,"select count(*) from private.preset_storage_reservations_r18")==1
    print(json.dumps({'case':'R18_PUBLISHED_AND_STAGING_CLEANUP_DENIED','noExternalRemove':True}))
    bad_subject=u()
    expect(b,lambda:scalar(b,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",(subject,f'published/{bad_subject}/unsafe.json')),
      'R18_PRESET_CLEANUP_FORBIDDEN')
    expect(b,lambda:scalar(b,"select public.community_preset_storage_recovery_r18(%s,%s,%s,%s)",
      (subject,first['reservationId'],2,'SQL_FAILED')),'R18_PRESET_RESERVATION_STALE')
    recovery=scalar(b,"select public.community_preset_storage_recovery_r18(%s,%s,%s,%s)",
      (subject,first['reservationId'],1,'SQL_FAILED'))
    assert recovery['reservationState']=='FAILED_RECOVERABLE' and recovery['stateVersion']==2
    assert recovery['copyAttempts']==1 and recovery['physicalCleanupAuthorized'] is False
    replay=reserve(b)
    assert replay['reservationId']==first['reservationId']
    assert replay['reservationState']=='FAILED_RECOVERABLE' and replay['stateVersion']==2
    expect(b,lambda:scalar(b,"select public.community_preset_storage_recovery_r18(%s,%s,%s,%s)",
      (subject,first['reservationId'],1,'SQL_FAILED')),'R18_PRESET_RESERVATION_STALE')
    assert scalar(b,"select count(*) from private.preset_storage_reservations_r18")==1
    print(json.dumps({'case':'R18_FAILED_PUBLISH_RECOVERY_STALE_REJECTION','noCompensationRemove':True}))
    with b.transaction():
        b.execute("""insert into private.account_privacy_suppressions(account_id,next_cleanup_at)
          values(%s,now())""",(owner,))
    expect(b,lambda:reserve(b),'Privacy') if False else None
    try:
        reserve(b)
        raise AssertionError('PRIVACY_SUPPRESSED_ACTOR_BYPASSED')
    except psycopg.Error as e:
        assert any(s in str(e).lower() for s in ['suppress','active','privacy']),str(e)
    assert scalar(b,"select count(*) from private.preset_storage_reservations_r18")==1
    print(json.dumps({'case':'R18_PRIVACY_BARRIER_INDEPENDENT','noNewReservation':True}))
print(json.dumps({'result':'03COMM_R18_PRESET_STORAGE_RESERVATION_REAL_TWO_BACKEND_SOURCE_PASS',
    'realProviderStorage':False,'signedStaging':False,'publicationEnabled':False,'cleanupEnabled':False}))
