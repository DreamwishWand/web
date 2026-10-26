#!/usr/bin/env python3
import os
import uuid
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL')
DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
newid = uuid.uuid4

def scalar(db, statement, params=()):
    return db.execute(statement, params).fetchone()[0]

def counters(db):
    names = ('artifact_blobs','community_works','preset_revisions','community_work_revisions','preset_revision_publications','search_documents','outbox_events','idempotency_keys')
    return {name:scalar(db, 'select count(*) from public.'+name) for name in names}

def failcode(db, statement, params, expected):
    db.execute('savepoint qr_before_denial')
    try:
        scalar(db, statement, params)
    except psycopg.Error as err:
        db.execute('rollback to savepoint qr_before_denial')
        assert expected in str(err),(expected,str(err))
        return
    db.execute('rollback to savepoint qr_before_denial')
    raise AssertionError('QR138_UNEXPECTED_SUCCESS:'+expected)

with psycopg.connect(DSN,autocommit=True) as ownerdb, psycopg.connect(DSN,autocommit=True) as rivaldb:
    assert scalar(ownerdb,'select pg_backend_pid()') != scalar(rivaldb,'select pg_backend_pid()')
    owner, actor, creator = newid(),newid(),newid()
    with ownerdb.transaction():
        ownerdb.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        ownerdb.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(owner,str(actor)))
        ownerdb.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        ownerdb.execute('insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,%s)',(creator,owner,'qr138_'+newid().hex[:14],'QR138 independent'))
    reserve_sql='select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,%s,%s,%s,%s)'
    def reserve_arguments(suffix,digest):
        return (actor,creator,f'staging/{owner}/{newid()}.json','qr138-'+suffix+'-'+newid().hex,'a'*64,100,digest*64,1,'scene')
    quarantined_args=reserve_arguments('quarantine','b')
    untouched_args=reserve_arguments('unrelated','c')
    quarantined=scalar(ownerdb,reserve_sql,quarantined_args)
    untouched=scalar(ownerdb,reserve_sql,untouched_args)
    qid, uid=uuid.UUID(quarantined['reservationId']),uuid.UUID(untouched['reservationId'])
    qlease=scalar(ownerdb,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,qid))
    ulease=scalar(ownerdb,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,uid))
    initial=counters(ownerdb)
    report='select public.community_preset_storage_report_integrity_r18(%s,%s,2,1,%s,%s,%s,%s)'
    ownerdb.execute('begin')
    incident=scalar(ownerdb,report,(actor,qid,'CONDITIONAL_COPY_OUTCOME_UNKNOWN','missing-ack',None,None))
    assert incident['state']=='QUARANTINED_PENDING_OPERATOR'
    rivaldb.execute('begin')
    rivaldb.execute("set local lock_timeout='200ms'")
    try:
        scalar(rivaldb,reserve_sql,quarantined_args)
        raise AssertionError('QR138_RACE_UNSERIALIZED')
    except psycopg.Error as e:
        assert e.sqlstate == '55P03',e.sqlstate
    rivaldb.execute('rollback')
    ownerdb.execute('commit')
    assert scalar(rivaldb,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(qid,)) == 1
    assert scalar(ownerdb,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(uid,)) == 0
    assert scalar(ownerdb,'select private.preset_storage_reservation_snapshot_r18(r) from private.preset_storage_reservations_r18 r where r.reservation_id=%s',(qid,))['reservationState']=='QUARANTINED_PENDING_OPERATOR'
    assert scalar(ownerdb,'select private.preset_storage_reservation_snapshot_r18(r) from private.preset_storage_reservations_r18 r where r.reservation_id=%s',(uid,))['reservationState']=='PROMOTION_IN_PROGRESS'
    cleanup=scalar(ownerdb,'select public.community_preset_storage_cleanup_preflight_r18(%s,%s)',(actor,quarantined['publishedStorageKey']))
    assert cleanup['unresolvedIncidentCount']==1 and cleanup['physicalDeleteAuthorized'] is False
    rivaldb.execute('begin')
    try:
        rivaldb.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='QR138_SYNTHETIC_ROLLBACK_ONLY' where gate_key='verified_preset_publication'")
        rivaldb.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=clock_timestamp(),readback_byte_size=100,readback_sha256=%s where reservation_id in (%s,%s)",('b'*64,qid,uid))
        rivaldb.execute("update private.preset_storage_reservations_r18 set readback_sha256=%s where reservation_id=%s",('c'*64,uid))
        commit="select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'QR138','', 'public','{}'::jsonb)"
        failcode(rivaldb,commit,(actor,qid,uuid.UUID(qlease['leaseToken'])),'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
        assert counters(rivaldb) == initial, 'quarantined positive commit wrote partial data'
        positive=scalar(rivaldb,commit,(actor,uid,uuid.UUID(ulease['leaseToken'])))
        assert positive['workId'], 'unrelated reservation unexpectedly quarantined'
        assert counters(rivaldb)['artifact_blobs']==initial['artifact_blobs']+1
        assert counters(rivaldb)['outbox_events']==initial['outbox_events']+1
    finally:
        rivaldb.execute('rollback')
    assert counters(ownerdb)==initial,'synthetic commit escaped rollback'
    assert scalar(ownerdb,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    assert scalar(ownerdb,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(qid,))==1
    failcode(ownerdb,reserve_sql,quarantined_args,'R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL')
    assert scalar(ownerdb,reserve_sql,untouched_args)['reservationId']==str(uid)
    print('QR_SOURCE138_INDEPENDENT_2PG_RACE_QUARANTINE_SCOPED_COMMIT_ROLLBACK_ACCEPTED')
    print('SOURCE_ONLY_SYNTHETIC_ATTESTATION_ROLLED_BACK; ACTUAL_SIGNED_PROVIDER_NOT_EXECUTED')
