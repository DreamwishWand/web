#!/usr/bin/env python3
import os
import uuid
import json
import psycopg

assert os.environ.get('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.environ.get('DATABASE_URL')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
new=uuid.uuid4

def value(db,sql,params=()):
    return db.execute(sql,params).fetchone()[0]

def deny(db,sql,params,message):
    db.execute('savepoint int138_case')
    try:
        value(db,sql,params)
    except psycopg.Error as err:
        db.execute('rollback to savepoint int138_case')
        assert message in str(err),(message,err.sqlstate,str(err))
        return err.sqlstate
    db.execute('rollback to savepoint int138_case')
    raise AssertionError('UNEXPECTED_ALLOWED_'+message)

def scope_counts(db,account):
    rows={}
    rows['blobs']=value(db,"select count(*) from public.artifact_blobs where owner_account_id=%s",(account,))
    rows['works']=value(db,"select count(*) from public.community_works where owner_account_id=%s",(account,))
    rows['reserves']=value(db,"select count(*) from private.preset_storage_reservations_r18 where owner_account_id=%s",(account,))
    rows['incidents']=value(db,"select count(*) from private.preset_storage_integrity_incidents_r18 where owner_account_id=%s",(account,))
    return rows

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert value(a,'select pg_backend_pid()')!=value(b,'select pg_backend_pid()')
    owner,actor,creator=new(),new(),new()
    stage='staging/'+str(owner)+'/'+str(new())+'.json'
    key='int138-inverse-'+new().hex
    with a.transaction():
        a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        a.execute("""insert into public.auth_identities(
             account_id,provider,provider_subject,last_verified_at,identity_state)
             values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(actor)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        a.execute("""insert into public.creator_profiles(
          creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,'09 INT source138 inverse')""",(creator,owner,'intinv_'+new().hex[:16]))
    reservation=value(a,"""select public.community_preset_storage_reserve_r18(
         %s,%s,%s,%s,%s,100,%s,1,'scene')""",(actor,creator,stage,key,'a'*64,'b'*64))
    rid=uuid.UUID(reservation['reservationId'])
    lease=value(a,"select public.community_preset_storage_claim_promotion_r18(%s,%s,1)",(actor,rid))
    token=uuid.UUID(lease['leaseToken'])
    assert lease['stateVersion']==2 and lease['leaseFence']==1
    baseline=scope_counts(a,owner)
    assert baseline['incidents']==0 and baseline['blobs']==0
    commit="""select private.preset_storage_commit_candidate_r18(
        %s,%s,2,%s,1,'Independent inverse-lock 138',null,'public','{}'::jsonb)"""
    report="""select public.community_preset_storage_report_integrity_r18(
        %s,%s,%s,%s,%s,%s,%s,%s)"""
    # Reverse the ordering of the Owner test: synthetic positive transaction reaches
    # reservation FOR UPDATE FIRST; incident reporter must wait, never interleave.
    a.execute('begin')
    a.execute("""update private.preset_storage_release_gate_r18
         set enabled=true,provider_precondition_accepted=true,
         operator_evidence_ref='INT138_INVERSE_LOCAL_ROLLBACK_NOT_PROVIDER'
         where gate_key='verified_preset_publication'""")
    a.execute("""update private.preset_storage_reservations_r18
         set reservation_state='VERIFIED_PUBLISHED_OBJECT',
         verification_evidence_state='PROVIDER_ATTESTED',
         readback_at=clock_timestamp(),readback_byte_size=100,
         readback_sha256=%s where reservation_id=%s""",('b'*64,rid))
    synthetic=value(a,commit,(actor,rid,token))
    assert synthetic['workId'] and synthetic['presetArtifactId']
    assert scope_counts(a,owner)['blobs']==1
    b.execute('begin')
    b.execute("set local lock_timeout='160ms'")
    try:
        value(b,report,(actor,rid,3,1,'PUBLISHED_MISSING_POST_COMMIT','mock-copy-v1',None,None))
        raise AssertionError('INTEGRITY_REPORTER_INTERLEAVED_UNCOMMITTED_POSITIVE')
    except psycopg.Error as err:
        assert err.sqlstate=='55P03',(err.sqlstate,str(err))
    b.execute('rollback')
    # STRICTLY rollback synthetic gate and positive work; never persist forged attestation.
    a.execute('rollback')
    assert scope_counts(b,owner)==baseline
    assert value(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    print(json.dumps({'case':'09INT_R18_SOURCE138_INVERSE_COMMIT_FIRST_HELD_LOCK_REPORTER_55P03',
      'actualTwoPostgreSQLBackends':True,'syntheticCommitRolledBack':True,'providerBytes':False}))

    # Report on the uncommitted reservation after rollback: stale postcommit issue prohibited.
    b.execute('begin')
    deny(b,report,(actor,rid,2,1,'PUBLISHED_MISSING_POST_COMMIT',None,None,None),
          'R18_PRESET_INTEGRITY_NOT_COMMITTED')
    b.execute('rollback')
    incident=value(b,report,(actor,rid,2,1,'CONDITIONAL_COPY_OUTCOME_UNKNOWN',
                            'unknown-provider',None,None))
    assert incident['state']=='QUARANTINED_PENDING_OPERATOR'
    assert scope_counts(a,owner)['incidents']==1

    # A later reissued old lease/forged attestation cannot erase this durable uncertainty.
    a.execute('begin')
    a.execute("""update private.preset_storage_release_gate_r18
      set enabled=true,provider_precondition_accepted=true,
      operator_evidence_ref='INT138_DENIAL_LOCAL_ROLLBACK_NOT_PROVIDER'
      where gate_key='verified_preset_publication'""")
    a.execute("""update private.preset_storage_reservations_r18
      set reservation_state='VERIFIED_PUBLISHED_OBJECT',
        verification_evidence_state='PROVIDER_ATTESTED',
        readback_at=clock_timestamp(),readback_byte_size=100,
        readback_sha256=%s where reservation_id=%s""",('b'*64,rid))
    deny(a,commit,(actor,rid,token),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
    assert scope_counts(a,owner)['blobs']==0
    a.execute('rollback')
    assert scope_counts(a,owner)=={**baseline,'incidents':1}
    assert value(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False

    # Incident has no owner/client/operator shortcut, cleanup is not the path to resolution.
    a.execute('begin')
    deny(a,"delete from private.preset_storage_integrity_incidents_r18 where reservation_id=%s returning incident_id",
         (rid,),'R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED')
    deny(a,"update private.preset_storage_integrity_incidents_r18 set incident_state='QUARANTINED_PENDING_OPERATOR' where reservation_id=%s returning incident_id",
         (rid,),'R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED')
    a.execute('rollback')
    result=value(a,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",
                 (actor,reservation['publishedStorageKey']))
    assert result['physicalDeleteAuthorized'] is False
    assert result['unresolvedIncidentCount']==1
    print(json.dumps({'case':'09INT_R18_SOURCE138_OPPOSITE_ORDER_QUARANTINE_NO_LEAK',
     'incidentDurable':True,'storageDeleteDenied':True,'realPostgreSQL':True,
     'genuineSignedProvider':False,'rolloutEnabled':False}))
