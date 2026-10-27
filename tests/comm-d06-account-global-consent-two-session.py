#!/usr/bin/env python3
"""D06 SOURCE+LOCAL negative two-PostgreSQL-backend tests; NEVER live Provider/JWT."""
import json,os,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,subject,other,other_subject=u(),u(),u(),u()
def one(c,sql,args=()): return c.execute(sql,args).fetchone()[0]
def read(c,s):return one(c,'select public.community_dreamsnap_get_account_official_result_consent_r20(%s)',(s,))
def setflag(c,s,version,enabled,session=None,ack=False):
    return one(c,'''select public.community_dreamsnap_set_account_official_result_consent_r20(
      %s,%s,extract(epoch from clock_timestamp())::bigint,%s,%s,%s)''',
      (s,session,version,enabled,ack))
def denied(c,fn,part):
    try:fn()
    except psycopg.Error as e:
        assert part in str(e),(part,e.sqlstate,str(e))
        return e.sqlstate
    raise AssertionError('D06_UNEXPECTEDLY_ACCEPTED_'+part)
with psycopg.connect(dsn,autocommit=True) as setup:
    with setup.transaction():
        for account,sub in [(owner,subject),(other,other_subject)]:
            setup.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
            setup.execute("""insert into public.auth_identities(
                account_id,provider,provider_subject,last_verified_at,identity_state)
                values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(sub)))
    assert read(setup,subject)['enabled'] is False and read(setup,subject)['rowVersion']==0
    assert read(setup,other_subject)['enabled'] is False
    assert one(setup,"select private.dreamsnap_public_official_result(%s)",(u(),)) is None
    assert not one(setup,"select has_function_privilege('anon','public.community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)','EXECUTE')")
    assert not one(setup,"select has_function_privilege('authenticated','public.community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)','EXECUTE')")
    assert not one(setup,"select has_function_privilege('service_role','public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])','EXECUTE')")
    assert not one(setup,"select has_table_privilege('service_role','private.dreamsnap_official_result_account_consent_r20','SELECT')")
    legacy_check=one(setup,"""select pg_get_constraintdef(c.oid)
        from pg_constraint c where c.conname='dreamsnap_legacy_publication_disabled_r20'""")
    assert 'cardinality(public_fields)' in legacy_check and 'published_at IS NULL' in legacy_check
    denied(setup,lambda:one(setup,"select public.community_dreamsnap_set_official_result_publication_v1(%s,%s,array['rank']::text[])",(subject,u())),
           'D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED')
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
    a.execute('begin')
    first=setflag(a,subject,0,False)
    assert first['enabled'] is False and first['rowVersion']==1
    assert first['publicProjectionAuthorized'] is False
    b.execute('begin')
    b.execute("set local lock_timeout='250ms'")
    try:
        setflag(b,subject,0,False)
        raise AssertionError('D06_ACCOUNT_LOCK_BYPASSED')
    except psycopg.Error as e:
        assert e.sqlstate=='55P03',(e.sqlstate,str(e))
    b.execute('rollback')
    a.execute('commit')
    assert read(b,subject)['rowVersion']==1
    denied(b,lambda:setflag(b,subject,0,False),'D06_STALE_ACCOUNT_CONSENT')
    stable=setflag(b,subject,1,False)
    assert stable['rowVersion']==1 and stable['enabled'] is False
    denied(b,lambda:setflag(b,other_subject,1,False),'D06_STALE_ACCOUNT_CONSENT')
    assert read(b,other_subject)=={
        'enabled':False,'rowVersion':0,
        'scope':'all_linked_profiles_and_past_future_results',
        'publicProjectionAuthorized':False}
    denied(b,lambda:setflag(b,subject,1,True,session=None,ack=False),
           'D06_ACCOUNT_WIDE_DISCLOSURE_CONFIRMATION_REQUIRED')
    denied(b,lambda:setflag(b,subject,1,True,session=None,ack=True),
           'Session ID is required for recent authentication')
    assert one(b,'select enabled from private.dreamsnap_official_result_account_consent_r20 where account_id=%s',(owner,)) is False
    # Owner-private results are not deleted. A synthetic ON row itself still
    # cannot mint public official-result fields while image provenance is unproven.
    with b.transaction():
        b.execute("update private.dreamsnap_official_result_account_consent_r20 set enabled=true where account_id=%s",(owner,))
        assert read(b,subject)['enabled'] is True
        assert read(b,subject)['publicProjectionAuthorized'] is False
        assert one(b,"select private.dreamsnap_public_official_result(%s)",(u(),)) is None
        b.execute("update private.dreamsnap_official_result_account_consent_r20 set enabled=false where account_id=%s",(owner,))
    assert read(b,subject)['enabled'] is False
print(json.dumps({
 'marker':'D06_ACCOUNT_GLOBAL_OFF_BY_DEFAULT_TWO_REAL_PG_BACKENDS_SOURCE_PASS',
 'realProvider':False,'signedJwt':False,'photoBindingAccepted':False,
 'publicOfficialResultProjectionEnabled':False,'physicalDelete':False
}))
