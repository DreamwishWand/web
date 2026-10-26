import os
import json
import uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
new = uuid.uuid4
owner_a, owner_b, subject_a, subject_b, creator_a, creator_b = (new() for _ in range(6))
stage_a = f'staging/{owner_a}/{new()}.json'
idempotency = 'r18-int-' + new().hex[:19]

def scalar(c, sql, args=()):
    return c.execute(sql, args).fetchone()[0]

def deny(c, fn, expected):
    try:
        fn()
    except psycopg.Error as e:
        assert expected in str(e), (expected, e.sqlstate, str(e))
        return e.sqlstate
    raise AssertionError('EXPECTED_FAIL_CLOSED_' + expected)

def reserve(c, actor=subject_a, creator=creator_a, stage=stage_a,
            key=idempotency, hash_value='b'*64):
    return scalar(c, '''
      select public.community_preset_storage_reserve_r18(
        %s,%s,%s,%s,%s,100,%s,1,'scene')
    ''', (actor, creator, stage, key, hash_value, 'a'*64))

with psycopg.connect(dsn, autocommit=True) as root:
    with root.transaction():
        for account, subject, creator in ((owner_a,subject_a,creator_a),(owner_b,subject_b,creator_b)):
            root.execute('insert into public.wand_accounts(account_id) values(%s)', (account,))
            root.execute('''insert into public.auth_identities(
                account_id,provider,provider_subject,last_verified_at,identity_state)
                values(%s,'supabase',%s,clock_timestamp(),'active')''',(account,str(subject)))
            root.execute('insert into public.community_entities(entity_id,entity_type) values(%s,%s)',
                         (creator,'creator_profile'))
            root.execute('''insert into public.creator_profiles(
                creator_profile_id,owner_account_id,handle,display_name)
                values(%s,%s,%s,'09 INT R18 fixture')''',
                (creator,account,'int_r18_'+new().hex[:15]))
    assert scalar(root, 'select count(*) from private.preset_storage_reservations_r18 where owner_account_id=%s',(owner_a,)) == 0
    for func in (
        'public.community_preset_storage_reserve_r18(uuid,uuid,text,text,text,bigint,text,integer,text)',
        'public.community_preset_storage_recovery_r18(uuid,uuid,bigint,text)',
        'public.community_preset_storage_cleanup_preflight_r18(uuid,text)'
    ):
        for role in ('anon','authenticated'):
            assert scalar(root,'select has_function_privilege(%s,%s,%s)',(role,func,'EXECUTE')) is False
        assert scalar(root,'select has_function_privilege(%s,%s,%s)',('service_role',func,'EXECUTE')) is True
    print(json.dumps({'case':'09INT_R18_ACTUAL_PG_RESERVATION_FUNCTION_SERVICE_ONLY'}))

with psycopg.connect(dsn,autocommit=True) as a, psycopg.connect(dsn,autocommit=True) as b:
    assert scalar(a,'select pg_backend_pid()') != scalar(b,'select pg_backend_pid()')
    first=reserve(a)
    assert first['reservationState']=='RESERVED'
    assert first['realPublishedObjectBytesVerified'] is False
    assert first['publicationCommitAuthorized'] is False
    assert first['physicalCleanupAuthorized'] is False
    assert first['snapshotNotAnAtomicStorageOperation'] is True
    assert first['publishedStorageKey'].startswith('published/'+str(owner_a)+'/')
    assert reserve(b)['reservationId']==first['reservationId']
    deny(b,lambda:reserve(b,stage=f'staging/{owner_a}/{new()}.json'),
         'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT')
    deny(b,lambda:reserve(b,hash_value='c'*64),
         'R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT')
    deny(b,lambda:reserve(b,creator=creator_b,key='another-'+new().hex[:12]),
         'R18_PRESET_RESERVATION_CREATOR_FORBIDDEN')
    deny(b,lambda:reserve(b,actor=subject_b,creator=creator_b,
                           stage=stage_a,key='foreign-'+new().hex[:10]),
         'R18_PRESET_STAGING_KEY_FORBIDDEN')
    assert scalar(b,'select count(*) from private.preset_storage_reservations_r18 where owner_account_id=%s',(owner_a,))==1
    print(json.dumps({'case':'09INT_R18_ACTUAL_PG_IDEMPOTENT_SAME_KEY_AND_FOREIGN_CREATOR_FAIL_CLOSED'}))
    a.execute('begin')
    a.execute('select 1 from private.preset_storage_reservations_r18 where reservation_id=%s for update',
              (first['reservationId'],))
    b.execute('begin')
    b.execute("set local lock_timeout='200ms'")
    try:
        b.execute('''select public.community_preset_storage_recovery_r18(
          %s,%s,1,'COPY_FAILED')''',(subject_a,first['reservationId']))
        raise AssertionError('RECOVERY_CONCURRENTLY_MODIFIED_LOCKED_RESERVATION')
    except psycopg.Error as e:
        assert e.sqlstate=='55P03',(e.sqlstate,str(e))
    b.execute('rollback')
    a.execute('commit')
    version2=scalar(b,'''select public.community_preset_storage_recovery_r18(
          %s,%s,1,'COPY_FAILED')''',(subject_a,first['reservationId']))
    assert version2['reservationState']=='FAILED_RECOVERABLE'
    assert version2['stateVersion']==2
    assert version2['physicalCleanupAuthorized'] is False
    deny(b,lambda:scalar(b,'''select public.community_preset_storage_recovery_r18(
          %s,%s,1,'COPY_FAILED')''',(subject_a,first['reservationId'])),
         'R18_PRESET_RESERVATION_STALE')
    assert reserve(a)['reservationId']==first['reservationId']
    print(json.dumps({'case':'09INT_R18_ACTUAL_PG_RECOVERY_LOCK_AND_STALE_SERIALIZATION'}))
    for storage_key in (
        first['publishedStorageKey'], stage_a,
        f'published/{owner_a}/{new().hex}.json',
        f'staging/{owner_a}/{new()}.json'
    ):
        state=scalar(b,'select public.community_preset_storage_cleanup_preflight_r18(%s,%s)',
            (subject_a,storage_key))
        assert state['cleanupAuthorized'] is False
        assert state['physicalDeleteAuthorized'] is False
        assert state['allCurrentHistoricalAndCloudReferencesProven'] is False
    deny(b,lambda:scalar(b,'select public.community_preset_storage_cleanup_preflight_r18(%s,%s)',
        (subject_b,first['publishedStorageKey'])),'R18_PRESET_CLEANUP_FORBIDDEN')
    print(json.dumps({'case':'09INT_R18_ACTUAL_PG_CLEANUP_ZERO_AND_RESERVED_UNCONDITIONALLY_DENIED'}))
    deny(b,lambda:scalar(b,'''
        select public.community_publish_preset_envelope(
        %s,%s,'public','scene','int',null,%s,1,'application/json',100,%s,
        '{}'::jsonb,%s)''',(subject_a,creator_a,first['publishedStorageKey'],'a'*64,idempotency)),
        'R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED')
    assert scalar(b,'select count(*) from public.artifact_blobs where storage_key=%s',(first['publishedStorageKey'],)) == 0
    assert scalar(b,'select count(*) from public.community_works where owner_account_id=%s',(owner_a,)) == 0
    assert scalar(b,'select count(*) from public.idempotency_keys where account_id=%s',(owner_a,)) == 0
    print(json.dumps({'case':'09INT_R18_ACTUAL_PG_NO_COMMITTED_PRESET_WITHOUT_PROVIDER_BYTES'}))

print(json.dumps({
 'result':'09INT_R18_SOURCE134_ACTUAL_TWO_POSTGRES_BACKENDS_SCOPED_RESERVATION_NEGATIVE_ACCEPTED',
 'actualPostgreSQL':True,'actualProviderStorage':False,'normalSignedActorJWT':False,
 'positivePublicationEnabled':False,'fullGraphComplete':False}))
